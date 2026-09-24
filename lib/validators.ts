/**
 * lib/validators.ts — Zod schemas for every API boundary (brain/10 rule S2)
 * plus the post-processing layer that enforces the Zero-Hallucination
 * policy (brain/09): quotes are re-located inside the extracted pages,
 * out-of-range page citations are dropped, and the disclaimer text is
 * always server-controlled.
 */

import { z } from 'zod';
import {
  LEGAL_DISCLAIMER,
  MAX_CHAT_HISTORY_MESSAGES,
  MAX_CHAT_QUESTION_CHARS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MAX_PAGES,
  PDF_MIME_TYPE,
} from './constants';
import {
  getNormalizedPages,
  normalizeForSearch,
  parseContextToPages,
  type NormalizedPage,
} from './context';
import type { AnalysisResult, ChatResponse, ParsedPage } from './types';

// Re-export parseContextToPages for backwards compatibility
export { parseContextToPages } from './context';

/* ------------------------------- Domain enums ---------------------------- */

export const userRoleSchema = z.enum(['employee', 'freelancer', 'tenant', 'founder', 'other']);

export const docTypeSchema = z.enum([
  'offer_letter',
  'employment_contract',
  'nda',
  'rental_agreement',
  'terms_of_service',
  'freelance_contract',
  'other',
]);

export const riskLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const userProfileSchema = z.object({
  role: userRoleSchema,
  documentType: docTypeSchema,
  specificConcerns: z.array(z.string().trim().min(1).max(120)).max(15).default([]),
});

export const parsedPageSchema = z.object({
  pageNumber: z.number().int().min(1).max(MAX_PAGES),
  text: z.string().min(1).max(200_000),
  wordCount: z.number().int().min(0),
});

export const citationSchema = z.object({
  clauseNumber: z.string().trim().min(1).max(60),
  pageNumber: z.number().min(1).max(10_000),
  exactText: z.string().trim().min(1).max(4_000),
});

/* ------------------------------ AI output shape -------------------------- */
/** Used to validate Gemini's JSON before it ever reaches the client. */
export const analysisResultSchema = z.object({
  documentHealthScore: z.number().min(0).max(100),
  summary: z.string().min(1).max(4_000),
  keyClauses: z
    .array(
      z.object({
        clauseTitle: z.string().max(200).default('Clause'),
        clauseNumber: z.string().max(60).default('General'),
        pageNumber: z.number().min(0).max(10_000),
        exactQuote: z.string().min(1).max(4_000),
        simplifiedExplanation: z.string().min(1).max(2_000),
        riskLevel: riskLevelSchema,
        recommendation: z.string().min(1).max(1_000),
      }),
    )
    .max(20),
  missingConcerns: z.array(z.string().max(200)).max(15),
  legalDisclaimer: z.string().max(1_000),
});

export const chatResponseSchema = z.object({
  answer: z.string().min(1).max(8_000),
  citations: z.array(citationSchema).max(5).default([]),
  isMissingInfo: z.boolean().default(false),
});

/* ------------------------------ API request bodies ------------------------ */

export const analyzeRequestSchema = z.object({
  pages: z
    .array(parsedPageSchema)
    .min(1, 'At least one parsed page is required.')
    .max(MAX_PAGES, `A maximum of ${MAX_PAGES} pages is supported.`),
  userProfile: userProfileSchema,
});

export const chatMessageSchema = z.object({
  id: z.string().max(80),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8_000),
  citations: z.array(citationSchema).max(5).optional(),
  isMissingInfo: z.boolean().optional(),
});

export const chatRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Please type a question of at least 3 characters.')
    .max(MAX_CHAT_QUESTION_CHARS, `Questions are limited to ${MAX_CHAT_QUESTION_CHARS} characters.`),
  documentContext: z.string().min(50).max(600_000),
  chatHistory: z.array(chatMessageSchema).max(MAX_CHAT_HISTORY_MESSAGES).default([]),
});

/* ------------------------------ File validation --------------------------- */

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string; status: number };

/** S3 — type + size validation executed on the server before parsing. */
export function validateFileUpload(input: {
  type: string;
  size: number;
  name: string;
}): FileValidationResult {
  if (input.size === 0) {
    return { valid: false, error: 'This PDF appears to be empty.', status: 422 };
  }
  if (input.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
      status: 413,
    };
  }
  const isPdf = input.type === PDF_MIME_TYPE || input.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return { valid: false, error: 'Please upload a PDF file only.', status: 400 };
  }
  return { valid: true };
}

/* ------------------- Hallucination defence (brain/09) -------------------- */

/**
 * Try to find the page that actually contains `quote`. Returns the
 * pageNumber on success, or null when the quote cannot be verified —
 * the caller then treats the citation as untrustworthy (rule R1).
 * Accepts an optional pre-computed array of NormalizedPage objects for efficiency.
 */
export function locateQuotePage(
  pages: ParsedPage[],
  quote: string,
  preNormalized?: NormalizedPage[],
): number | null {
  const normalizedQuote = normalizeForSearch(quote);
  if (normalizedQuote.length < 8) return null;

  const normalizedPages = preNormalized ?? getNormalizedPages(pages);
  const probes = [normalizedQuote.slice(0, 100), normalizedQuote.slice(0, 60)];

  for (const probe of probes) {
    if (probe.length < 8) continue;
    for (const page of normalizedPages) {
      if (page.normalized.includes(probe)) {
        return page.pageNumber;
      }
    }
  }
  return null;
}

function normalizeClauseNumber(raw: string): string {
  const trimmed = raw.trim().replace(/^clause\s*[:\-#]?\s*/i, '');
  if (!trimmed || /^n\/?a$/i.test(trimmed) || /^general$/i.test(trimmed)) {
    return 'General';
  }
  return trimmed.slice(0, 40);
}

/**
 * Validate + repair the model's analysis:
 *  - clamps the health score into [0, 100]
 *  - pre-normalizes page texts once and re-locates every exact quote
 *  - drops clauses whose page citation is outside the document range
 *  - forces the server-side disclaimer verbatim (rule R5)
 */
export function postProcessAnalysis(result: AnalysisResult, pages: ParsedPage[]): AnalysisResult {
  const totalPages = pages.length;
  const normalizedPages = getNormalizedPages(pages);

  const keyClauses = result.keyClauses
    .map((clause) => {
      const exactQuote = clause.exactQuote.trim();
      const verifiedPage = locateQuotePage(pages, exactQuote, normalizedPages);
      return {
        ...clause,
        clauseTitle: clause.clauseTitle.trim() || 'Clause',
        clauseNumber: normalizeClauseNumber(clause.clauseNumber),
        pageNumber: verifiedPage ?? Math.round(clause.pageNumber),
        exactQuote,
      };
    })
    .filter((clause) => clause.pageNumber >= 1 && clause.pageNumber <= totalPages)
    .slice(0, 15);

  return {
    documentHealthScore: Math.min(100, Math.max(0, Math.round(result.documentHealthScore))),
    summary: result.summary.trim(),
    keyClauses,
    missingConcerns: result.missingConcerns.map((concern) => concern.trim()).filter(Boolean),
    legalDisclaimer: LEGAL_DISCLAIMER,
  };
}

/**
 * Validate + repair the model's chat answer: citations are verified
 * against the memoized normalized document context.
 */
export function postProcessChatResponse(
  raw: z.infer<typeof chatResponseSchema>,
  documentContext: string,
): ChatResponse {
  const pages = parseContextToPages(documentContext);
  const totalPages = pages.length;
  const normalizedPages = getNormalizedPages(pages, documentContext);

  const citations = raw.citations
    .map((citation) => ({
      ...citation,
      clauseNumber: normalizeClauseNumber(citation.clauseNumber),
      pageNumber:
        locateQuotePage(pages, citation.exactText, normalizedPages) ?? Math.round(citation.pageNumber),
    }))
    .filter(
      (citation) =>
        citation.exactText.trim().length > 0 &&
        (totalPages === 0 || (citation.pageNumber >= 1 && citation.pageNumber <= totalPages)),
    )
    .slice(0, 3);

  return {
    answer: raw.answer.trim(),
    citations,
    isMissingInfo: Boolean(raw.isMissingInfo),
    disclaimer: LEGAL_DISCLAIMER,
  };
}

/** First issue message from a failed Zod parse, for API error bodies. */
export function firstZodIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request body.';
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  return `Invalid request — ${path}${issue.message}`;
}
