# 03 — System Architecture

## Data Flow
1. User uploads PDF -> Client validation
2. PDF -> /api/parse -> text + page numbers
3. Parsed text + user profile -> /api/analyze -> Gemini API
4. Structured JSON -> Dashboard UI
5. Q&A -> /api/chat -> grounded response with citations

## Component Tree
app/
  page.tsx (Upload + Profile)
  dashboard/page.tsx (Analysis + Chat)
  api/parse/route.ts
  api/analyze/route.ts
  api/chat/route.ts
components/
  FileUploader, UserProfileForm, HealthScore,
  ClauseCard, ChatInterface, PDFViewer,
  CitationBadge, Disclaimer, RiskBadge, Navbar
lib/
  gemini.ts, pdf-parser.ts, prompts.ts,
  validators.ts, types.ts

## State Passing Between Pages
Analysis results and parsed pages are stored in sessionStorage
(never persisted server-side) and read by /dashboard on mount.
This keeps document data in the user's browser tab only.

## AI Grounding Strategy
- Gemini called with responseMimeType: application/json
- Document text injected with [PAGE n] markers
- Zod validates the model's JSON output shape
- Post-processing re-locates each exact quote inside the extracted
  pages and corrects/drops citations that do not match (R1/R2)
