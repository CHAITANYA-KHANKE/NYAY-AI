/**
 * lib/gemini.ts — Google Gemini integration (brain/02 TRD, brain/17 ADR-002/004/008).
 *
 * Guarantees enforced here:
 *  - JSON mode (`responseMimeType: application/json`) so output parses cleanly
 *  - Zod validation of every model response before it reaches a client
 *  - Token-budgeted prompts and output token bounds per task type
 *  - In-memory TTL cache for document analysis (0-cost repeated runs)
 *  - **Time-bounded fallback chain**: on 503/high-demand or retired-model errors
 *    the next verified model is tried within the global deadline budget
 *  - Strict AbortController timeouts mapped to typed errors (503/504/429/502)
 *  - Hallucination post-processing via lib/validators.ts (rule R1/R2)
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { hashKey, TtlCache, type CacheStats } from './cache';
import {
  AI_BUDGETS,
  ANALYSIS_CACHE,
  LEGAL_DISCLAIMER,
  MAX_ANALYSIS_OUTPUT_TOKENS,
  MAX_CHAT_CONTEXT_TOKENS,
  MAX_CHAT_OUTPUT_TOKENS,
  PROMPT_VERSION,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from './constants';
import { fitContextToBudget } from './context';
import { buildAnalysisPrompt, buildChatPrompt } from './prompts';
import type { AnalysisResult, ChatMessage, ChatResponse, ParsedPage, UserProfile } from './types';
import {
  analysisResultSchema,
  chatResponseSchema,
  postProcessAnalysis,
  postProcessChatResponse,
} from './validators';

/**
 * Model is env-configurable (GEMINI_MODEL) — Google retires models and
 * flash endpoints see capacity spikes, so on 503/404 errors we cascade
 * through this verified chain instead of failing the request.
 */
const PRIMARY_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
const MODEL_CANDIDATES: string[] = Array.from(
  new Set([PRIMARY_MODEL, 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview']),
);

const MAX_ATTEMPTS_PER_MODEL = 2;

export type GeminiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMIT'
  | 'AI_BAD_RESPONSE'
  | 'AI_UNAVAILABLE'
  | 'AI_ERROR';

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: GeminiErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** HTTP status used by API routes for each failure class. */
export function geminiErrorStatus(error: GeminiError): number {
  switch (error.code) {
    case 'AI_UNAVAILABLE':
      return 503;
    case 'AI_TIMEOUT':
      return 504;
    case 'AI_RATE_LIMIT':
      return 429;
    case 'AI_BAD_RESPONSE':
      return 502;
    case 'AI_NOT_CONFIGURED':
    case 'AI_ERROR':
    default:
      return 500;
  }
}

/* ------------------------------ Client setup ----------------------------- */

let cachedClient: GoogleGenerativeAI | null = null;
const modelCache = new Map<string, GenerativeModel>();

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new GeminiError(
      'GEMINI_API_KEY is not configured. Copy env.template to .env.local and add your key.',
      'AI_NOT_CONFIGURED',
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
}

function getJsonModel(modelName: string, maxOutputTokens: number): GenerativeModel {
  const cacheKey = `${modelName}:${maxOutputTokens}`;
  const cached = modelCache.get(cacheKey);
  if (cached) return cached;
  const model = getClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json', // ADR-004 — guarantees JSON-shaped output
      temperature: 0.2, // low temperature = less creativity, more grounding
      topP: 0.8,
      maxOutputTokens,
    },
  });
  modelCache.set(cacheKey, model);
  return model;
}

/* -------------------------------- Helpers -------------------------------- */

/** True when trying the next model in the chain is worthwhile. */
export function isModelFallbackError(message: string): boolean {
  return /503|unavailable|high demand|overloaded|no longer available|not found|NOT_FOUND|deadline/i.test(
    message,
  );
}

export function mapGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error;
  const message = error instanceof Error ? error.message : String(error);

  if (/429|quota|rate\s*limit|resource\s*exhausted/i.test(message)) {
    return new GeminiError(
      'The AI service is busy right now. Please wait a few seconds and try again.',
      'AI_RATE_LIMIT',
      30,
    );
  }
  if (/abort|timeout|ETIMEDOUT|ECONNRESET/i.test(message)) {
    return new GeminiError('The AI service timed out. Please retry.', 'AI_TIMEOUT');
  }
  if (/API key not valid|API_KEY_INVALID|permission|unregistered/i.test(message)) {
    return new GeminiError(
      'The configured Gemini API key is invalid. Check GEMINI_API_KEY in .env.local.',
      'AI_NOT_CONFIGURED',
    );
  }
  if (/no longer available|NOT_FOUND|not found|unsupported model|does not exist/i.test(message)) {
    return new GeminiError(
      'The configured Gemini model is unavailable. Set GEMINI_MODEL in .env.local to an available model.',
      'AI_UNAVAILABLE',
    );
  }
  if (/503|high demand|overloaded|unavailable/i.test(message)) {
    return new GeminiError(
      'The AI service is at capacity. Please retry in a few seconds.',
      'AI_UNAVAILABLE',
      10,
    );
  }
  return new GeminiError('The AI service returned an error. Please retry.', 'AI_ERROR');
}

/** Defensive cleanup in case the model wraps JSON in markdown fences. */
export function extractJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return cleaned;
}

async function generateJson(
  prompt: string,
  timeoutMs: number,
  label: string,
  modelName: string,
  maxOutputTokens: number,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const model = getJsonModel(modelName, maxOutputTokens);
    const result = await Promise.race([
      model.generateContent(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { signal: controller.signal, timeout: timeoutMs },
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new GeminiError(`${label} is taking too long. Please retry.`, 'AI_TIMEOUT'));
        }, timeoutMs);
      }),
    ]);
    const text = result.response.text();
    return JSON.parse(extractJsonText(text));
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw mapGeminiError(error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function backoff(attempt: number, deadline: number): Promise<void> {
  const base = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
  const jitter = Math.random() * (0.25 * base);
  const delay = Math.round(base + jitter);
  if (Date.now() + delay >= deadline) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Shared driver: tries candidate models within the total deadline budget;
 * per model, retries once on malformed JSON or recoverable timeouts;
 * cascades to the next model on 503/high demand/retired-model errors.
 */
async function runWithModelFallback<T>(
  label: string,
  budget: { perAttemptMs: number; totalMs: number },
  prompt: string,
  process: (raw: unknown) => T | null,
  maxOutputTokens: number,
): Promise<T> {
  const deadline = Date.now() + budget.totalMs;
  let lastError: GeminiError | null = null;

  for (const modelName of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      const remainingTotal = deadline - Date.now();
      if (remainingTotal <= 1_500) {
        throw new GeminiError(`${label} is taking too long.`, 'AI_TIMEOUT');
      }

      const attemptTimeout = Math.max(1_000, Math.min(budget.perAttemptMs, remainingTotal));

      try {
        const raw = await generateJson(prompt, attemptTimeout, label, modelName, maxOutputTokens);
        const processed = process(raw);
        if (processed === null) {
          lastError = new GeminiError(
            'The AI returned an unexpected response format. Please retry.',
            'AI_BAD_RESPONSE',
          );
          if (attempt < MAX_ATTEMPTS_PER_MODEL) {
            await backoff(attempt, deadline);
            continue; // retry once with exponential backoff + jitter
          }
          break;
        }
        return processed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const mapped = error instanceof GeminiError ? error : mapGeminiError(error);

        if (isModelFallbackError(message) || mapped.code === 'AI_UNAVAILABLE') {
          lastError = mapped.code === 'AI_UNAVAILABLE' ? mapped : mapGeminiError(error);
          break; // cascade to next model
        }

        if (mapped.code === 'AI_BAD_RESPONSE') {
          lastError = mapped;
          if (attempt < MAX_ATTEMPTS_PER_MODEL) {
            await backoff(attempt, deadline);
            continue;
          }
          break;
        }

        if (mapped.code === 'AI_TIMEOUT') {
          lastError = mapped;
          if (attempt < MAX_ATTEMPTS_PER_MODEL && deadline - Date.now() > 1_500) {
            await backoff(attempt, deadline);
            continue;
          }
          break;
        }

        throw mapped; // config / rate-limit — other models won't help
      }
    }
  }

  throw (
    lastError ??
    new GeminiError('The AI service returned an error. Please retry.', 'AI_ERROR')
  );
}

/* ------------------------------ Caching ---------------------------------- */

const analysisCache = new TtlCache<AnalysisResult>(
  ANALYSIS_CACHE.maxEntries,
  ANALYSIS_CACHE.ttlMs,
);

export function buildAnalysisCacheKey(pages: ParsedPage[], profile: UserProfile): string {
  return `analyze:${hashKey(
    JSON.stringify({
      v: PROMPT_VERSION,
      pages: pages.map((p) => [p.pageNumber, p.text]),
      profile,
    }),
  )}`;
}

export function getAiCacheStats(): CacheStats {
  return analysisCache.stats();
}

export function clearAiCache(): void {
  analysisCache.clear();
}

/* ------------------------------ Public API ------------------------------- */

/**
 * Full personalized document analysis.
 * Checks bounded in-memory cache first (0 network tokens on repeat);
 * otherwise cascades through the model chain within the total time budget.
 */
export async function analyzeDocument(
  pages: ParsedPage[],
  userProfile: UserProfile,
): Promise<AnalysisResult> {
  const key = buildAnalysisCacheKey(pages, userProfile);
  const cached = analysisCache.get(key);
  if (cached) return cached;

  const prompt = buildAnalysisPrompt(pages, userProfile);
  const result = await runWithModelFallback(
    'Document analysis',
    AI_BUDGETS.analyze,
    prompt,
    (raw) => {
      const parsed = analysisResultSchema.safeParse(raw);
      if (!parsed.success) return null;
      return postProcessAnalysis(parsed.data as AnalysisResult, pages);
    },
    MAX_ANALYSIS_OUTPUT_TOKENS,
  );

  analysisCache.set(key, result);
  return result;
}

/**
 * Grounded Q&A over the document context.
 * Fits context to budget while verifying citations against the full document.
 */
export async function chatWithDocument(
  question: string,
  documentContext: string,
  history: ChatMessage[],
): Promise<ChatResponse> {
  const budgeted = fitContextToBudget(question, documentContext, MAX_CHAT_CONTEXT_TOKENS);
  const prompt = buildChatPrompt(question, budgeted.context, history);
  const response = await runWithModelFallback(
    'Answer generation',
    AI_BUDGETS.chat,
    prompt,
    (raw) => {
      const parsed = chatResponseSchema.safeParse(raw);
      if (!parsed.success) return null;
      return postProcessChatResponse(parsed.data, documentContext); // Always verify against the FULL document
    },
    MAX_CHAT_OUTPUT_TOKENS,
  );
  return { ...response, disclaimer: LEGAL_DISCLAIMER };
}
