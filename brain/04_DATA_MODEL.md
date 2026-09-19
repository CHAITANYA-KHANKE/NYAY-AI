# 04 — Data Model

## TypeScript Interfaces

interface ParsedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

interface UserProfile {
  role: 'employee' | 'freelancer' | 'tenant' | 'founder' | 'other';
  documentType: 'offer_letter' | 'employment_contract' | 'nda' |
    'rental_agreement' | 'terms_of_service' | 'freelance_contract' | 'other';
  specificConcerns: string[];
}

interface ClauseAnalysis {
  clauseTitle: string;
  clauseNumber: string;
  pageNumber: number;
  exactQuote: string;
  simplifiedExplanation: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

interface AnalysisResult {
  documentHealthScore: number;
  summary: string;
  keyClauses: ClauseAnalysis[];
  missingConcerns: string[];
  legalDisclaimer: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { clauseNumber: string; pageNumber: number; exactText: string }[];
  isMissingInfo?: boolean;
}
