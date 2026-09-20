/**
 * lib/gemini.ts — Google Gemini integration (brain/02 TRD, brain/17 ADR-002/004).
 *
 * Guarantees enforced here:
 *  - JSON mode (`responseMimeType: application/json`) so output parses
 *  - Zod validation of every model response before it reaches a client
 *  - one automatic retry on malformed JSON (brain/09)
 *  - **model fallback chain**: on 503/high-demand or retired-model errors
 *    the next verified model is tried transparently (models get
 *    deprecated/overloaded in production — the demo must never die)
 *  - timeouts mapped to clean, typed errors (503/504/429/502 semantics)
 *  - hallucination post-processing via lib/validators.ts (rule R1/R2)
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { LEGAL_DISCLAIMER } from './constants';
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

const ANALYSIS_TIMEOUT_MS = 60_000;
const CHAT_TIMEOUT_MS = 30_000;
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

function getJsonModel(modelName: string): GenerativeModel {
  const cached = modelCache.get(modelName);
  if (cached) return cached;
  const model = getClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json', // ADR-004 — guarantees JSON-shaped output
      temperature: 0.2, // low temperature = less creativity, more grounding
      topP: 0.8,
      maxOutputTokens: 8192,
    },
  });
  modelCache.set(modelName, model);
  return model;
}

/* -------------------------------- Helpers -------------------------------- */

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new GeminiError(`${label} is taking too long. Please retry.`, 'AI_TIMEOUT'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(mapGeminiError(error));
      },
    );
  });
}

/** True when trying the next model in the chain is worthwhile. */
function isModelFallbackError(message: string): boolean {
  return /503|unavailable|high demand|overloaded|no longer available|not found|NOT_FOUND|deadline/i.test(
    message,
  );
}

function mapGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error;
  const message = error instanceof Error ? error.message : String(error);

  if (/429|quota|rate\s*limit|resource\s*exhausted/i.test(message)) {
    return new GeminiError(
      'The AI service is busy right now. Please wait a few seconds and try again.',
      'AI_RATE_LIMIT',
      30,
    );
  }
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(message)) {
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
function extractJsonText(raw: string): string {
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
): Promise<unknown> {
  const result = await withTimeout(getJsonModel(modelName).generateContent(prompt), timeoutMs, label);
  const text = result.response.text();
  return JSON.parse(extractJsonText(text));
}

/**
 * Shared driver: tries each candidate model; per model, retries once on
 * malformed JSON (brain/09); cascades to the next model on 503/high
 * demand/retired-model errors. Throws only when configuration, rate
 * limits or timeouts make further attempts pointless.
 */
async function runWithModelFallback<T>(
  label: string,
  timeoutMs: number,
  prompt: string,
  process: (raw: unknown) => T | null,
): Promise<T> {
  let lastError: GeminiError | null = null;

  for (const modelName of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        const raw = await generateJson(prompt, timeoutMs, label, modelName);
        const processed = process(raw);
        if (processed === null) {
          lastError = new GeminiError(
            'The AI returned an unexpected response format. Please retry.',
            'AI_BAD_RESPONSE',
          );
          continue; // brain/09 — retry once on malformed JSON
        }
        return processed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const mapped = mapGeminiError(error);
        if (isModelFallbackError(message) || mapped.code === 'AI_UNAVAILABLE') {
          lastError = mapped.code === 'AI_UNAVAILABLE' ? mapped : mapGeminiError(error);
          break; // try the next model in the chain
        }
        if (mapped.code === 'AI_BAD_RESPONSE') {
          lastError = mapped;
          continue;
        }
        throw mapped; // config / rate-limit / timeout — other models won't help
      }
    }
  }

  throw (
    lastError ??
    new GeminiError('The AI service returned an error. Please retry.', 'AI_ERROR')
  );
}

/* ------------------------------ Public API ------------------------------- */

/**
 * Full personalized document analysis. Cascades through the model chain
 * on transient failures, then post-processes to verify every citation
 * against the real extracted pages.
 */
export async function analyzeDocument(
  pages: ParsedPage[],
  userProfile: UserProfile,
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(pages, userProfile);
  return runWithModelFallback('Document analysis', ANALYSIS_TIMEOUT_MS, prompt, (raw) => {
    const parsed = analysisResultSchema.safeParse(raw);
    if (!parsed.success) return null;
    return postProcessAnalysis(parsed.data as AnalysisResult, pages);
  });
}

/**
 * Grounded Q&A over the document context. Same fallback + verification
 * policy as analysis; the disclaimer is always server-appended.
 */
export async function chatWithDocument(
  question: string,
  documentContext: string,
  history: ChatMessage[],
): Promise<ChatResponse> {
  const prompt = buildChatPrompt(question, documentContext, history);
  const response = await runWithModelFallback('Answer generation', CHAT_TIMEOUT_MS, prompt, (raw) => {
    const parsed = chatResponseSchema.safeParse(raw);
    if (!parsed.success) return null;
    return postProcessChatResponse(parsed.data, documentContext);
  });
  return { ...response, disclaimer: LEGAL_DISCLAIMER };
}
