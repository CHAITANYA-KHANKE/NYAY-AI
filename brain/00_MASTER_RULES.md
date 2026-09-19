# 00 — MASTER RULES (NyayAI: AI Legal Assistance)

## North Star
Build an AI-powered Legal Document Analyzer that makes contracts,
offer letters, NDAs, and rental agreements understandable, verifiable,
and personalized for non-lawyers.

## Non-Negotiable Rules

### R1: Zero Hallucination Policy
- Every AI output MUST be grounded in the uploaded document.
- If info is missing: "Information not available in the uploaded document."
- NEVER fabricate clause numbers, page numbers, or legal terms.

### R2: Citation is Mandatory
- Every insight must include: Clause X.Y, Page Z
- Side-by-side original text verification must be available.

### R3: Problem Alignment > Fancy Tech
- The app must solve the SPECIFIC legal assistance problem.
- General Q&A chatbot = automatic score reduction.

### R4: Clean Code & Security
- No hardcoded API keys (use .env.local).
- TypeScript strict mode enabled.
- Proper error handling on every API route.

### R5: UX Simplicity
- Video demo must have < 40 clicks.
- Flow: Upload -> Set Profile -> View Analysis -> Ask Questions.
- Legal disclaimer visible on every AI response.

### R6: Last Attempt = Final Score
- 3 attempts allowed. Last submission's score counts.

## Evaluation Pillars
| Pillar | Weight | Focus |
|--------|--------|-------|
| Code Quality | High | Clean, typed, tested |
| Security | High | No secrets, input validation |
| Problem Alignment | Critical | Solves legal doc understanding |
| AI Integration | High | Grounded, cited, no hallucination |
| UX/Accessibility | Medium | Clean UI, <40 clicks |
| Google Services | Bonus | Gemini API usage |

## Tech Stack
- Frontend: Next.js 14 (App Router) + Tailwind CSS
- Backend: Next.js API Routes
- AI: Google Gemini Flash (gemini-3.6-flash, configurable)
- PDF: pdf-parse
- Language: TypeScript (strict)
