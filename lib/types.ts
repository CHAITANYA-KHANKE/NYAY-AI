/**
 * lib/types.ts — Shared TypeScript domain model (brain/04_DATA_MODEL.md).
 * Every interface here is used across API routes, lib helpers and UI.
 */

export type UserRole = 'employee' | 'freelancer' | 'tenant' | 'founder' | 'other';

export type DocType =
  | 'offer_letter'
  | 'employment_contract'
  | 'nda'
  | 'rental_agreement'
  | 'terms_of_service'
  | 'freelance_contract'
  | 'other';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** One extracted page of document text. */
export interface ParsedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

/** Who the user is — drives personalized risk analysis (PRD F2/F3). */
export interface UserProfile {
  role: UserRole;
  documentType: DocType;
  specificConcerns: string[];
}

/** A single mandatory citation (brain/00 rule R2). */
export interface Citation {
  clauseNumber: string;
  pageNumber: number;
  exactText: string;
}

/** Personalized, cited, simplified analysis of one clause. */
export interface ClauseAnalysis {
  clauseTitle: string;
  clauseNumber: string;
  pageNumber: number;
  exactQuote: string;
  simplifiedExplanation: string;
  riskLevel: RiskLevel;
  recommendation: string;
}

/** Full structured result returned by POST /api/analyze. */
export interface AnalysisResult {
  documentHealthScore: number;
  summary: string;
  keyClauses: ClauseAnalysis[];
  missingConcerns: string[];
  legalDisclaimer: string;
}

/** One chat turn. Assistant messages must carry citations + disclaimer. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isMissingInfo?: boolean;
  disclaimer?: string;
}

/** Payload returned by POST /api/chat (inside ApiSuccess.data). */
export interface ChatResponse {
  answer: string;
  citations: Citation[];
  isMissingInfo: boolean;
  disclaimer: string;
}

/** Payload returned by POST /api/parse (inside ApiSuccess.data). */
export interface ParseResponse {
  pageCount: number;
  pages: ParsedPage[];
  fileName: string;
}

/** Body of POST /api/analyze. */
export interface AnalyzeRequestBody {
  pages: ParsedPage[];
  userProfile: UserProfile;
}

/** Body of POST /api/chat. */
export interface ChatRequestBody {
  question: string;
  documentContext: string;
  chatHistory: ChatMessage[];
}

/* ----------------------------- API envelope ----------------------------- */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
