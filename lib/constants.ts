/**
 * lib/constants.ts — Single source of truth for limits, labels and the
 * mandatory legal disclaimer (brain/00 rule R5 + brain/09).
 */

import type { DocType, UserRole } from './types';

export const APP_NAME = 'NyayAI';
export const APP_NAME_HINDI = 'न्याय AI';
export const APP_TAGLINE = 'Har Contract, Crystal Clear';

/**
 * Mandatory disclaimer. The server ALWAYS enforces this exact text —
 * it is never trusted to the model (brain/09 Hallucination Prevention).
 */
export const LEGAL_DISCLAIMER =
  'This is AI-generated legal guidance for informational purposes only. It does not constitute legal advice. Please consult a qualified legal professional for specific legal matters.';

/** Short footer variant used inside individual chat bubbles. */
export const LEGAL_DISCLAIMER_SHORT = 'Informational only — not legal advice.';

/** Phrase the model must produce when information is missing (rule R1). */
export const MISSING_INFO_PHRASE = 'Information not available in the uploaded document.';

/* --------------------------------- Limits -------------------------------- */

function envNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_FILE_SIZE_MB = envNumber(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB, 20);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_PAGES = envNumber(process.env.NEXT_PUBLIC_MAX_PAGES, 50);
export const PDF_MIME_TYPE = 'application/pdf';

export const MAX_CHAT_QUESTION_CHARS = 2_000;
export const MAX_CHAT_HISTORY_MESSAGES = 20;

/* ------------------------------- AI Budgets ------------------------------ */

export const AI_BUDGETS = {
  analyze: { perAttemptMs: 45_000, totalMs: 75_000 },
  chat: { perAttemptMs: 20_000, totalMs: 45_000 },
} as const;

export const MAX_CHAT_OUTPUT_TOKENS = envNumber(process.env.MAX_CHAT_OUTPUT_TOKENS, 1_024);
export const MAX_ANALYSIS_OUTPUT_TOKENS = envNumber(process.env.MAX_ANALYSIS_OUTPUT_TOKENS, 6_144);
export const MAX_CHAT_CONTEXT_TOKENS = envNumber(process.env.MAX_CHAT_CONTEXT_TOKENS, 24_000);
export const RETRY_BASE_DELAY_MS = 250;
export const RETRY_MAX_DELAY_MS = 2_000;
export const ANALYSIS_CACHE = { maxEntries: 64, ttlMs: 10 * 60_000 } as const;
export const PROMPT_VERSION = 'v2';

/* ------------------------------ Rate limits ------------------------------ */
/** brain/10 rule S4 — in-memory sliding window, per route + IP. */
export const RATE_LIMITS = {
  parse: { limit: 10, windowMs: 60 * 60 * 1000 },
  analyze: { limit: 10, windowMs: 60 * 60 * 1000 },
  chat: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const;

/* --------------------------- Session storage ----------------------------- */
/** brain/17 ADR-007 — document never leaves the browser tab. */
export const SESSION_STORAGE_KEYS = {
  PAGES: 'nyayai:pages',
  ANALYSIS: 'nyayai:analysis',
  PROFILE: 'nyayai:profile',
  FILE_NAME: 'nyayai:fileName',
} as const;

/* ------------------------------ Form options ----------------------------- */

export const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Employee',
  freelancer: 'Freelancer',
  tenant: 'Tenant',
  founder: 'Founder',
  other: 'Other',
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  offer_letter: 'Offer Letter',
  employment_contract: 'Employment Contract',
  nda: 'NDA / Confidentiality',
  rental_agreement: 'Rental Agreement',
  terms_of_service: 'Terms of Service',
  freelance_contract: 'Freelance Contract',
  other: 'Other',
};

export const CONCERN_OPTIONS: string[] = [
  'Notice Period',
  'CTC / Salary Structure',
  'Bond / Service Agreement',
  'Non-Compete',
  'Termination Clause',
  'Probation',
  'IP / Intellectual Property',
  'Payment Terms',
  'Security Deposit',
  'Maintenance & Repairs',
  'Lock-in Period',
  'Equity / Vesting',
  'Confidentiality',
  'Renewal & Exit',
  'Penalty & Late Fees',
  'Governing Law',
];
