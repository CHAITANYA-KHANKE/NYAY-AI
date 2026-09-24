# 17 — Architecture Decisions

## ADR-001: Next.js over React+Express
Unified full-stack, Vercel zero-config deploy, SSR for Lighthouse.

## ADR-002: Gemini over OpenAI
PromptWars Google service weightage, 1M context window, fast.

## ADR-003: pdf-parse over PyMuPDF
Native Node.js, no Python dependency, Vercel compatible.

## ADR-004: JSON Mode for AI
responseMimeType: "application/json" guarantees valid JSON output.

## ADR-005: No Auth (Session-Based)
Hackathon submission, reduces clicks, evaluator-friendly.

## ADR-006: Deep import of pdf-parse lib file
Importing `pdf-parse/lib/pdf-parse.js` instead of the package root
avoids the package's debug-mode fs read that breaks serverless bundlers.
Combined with `serverComponentsExternalPackages: ['pdf-parse']` this
keeps the parser reliable on Vercel.

## ADR-007: sessionStorage for page-to-dashboard state
Parsed pages + analysis are kept in the browser tab's sessionStorage:
zero server persistence (privacy win per brain/05) and no URL length
limits. Closing the tab wipes the document entirely.

## ADR-008: Bounded In-Memory Caching (TtlCache & FNV-1a Hashing)
To eliminate duplicate AI calls for re-analyzing documents or identical
queries without adding external database dependencies (Redis), an in-memory
LRU cache (`TtlCache`) with dual 32-bit FNV-1a hashing (16-hex fingerprint)
is used. It provides O(1) lookups, TTL invalidation, explicit stats, and
full original-key collision defense.

## ADR-009: Dynamic Code-Splitting & React.memo Architecture
Client components that require heavy browser APIs or rich UI trees
(`FileUploader`, `UserProfileForm`, `PDFViewer`, `ChatInterface`) are
dynamically imported via `next/dynamic` (`ssr: false`). Leaf components
(`ClauseCard`, `HealthScore`, `AuroraBackground`) are wrapped in `React.memo`
with `useCallback`/`useMemo` in parent containers to eliminate layout re-render
thrashing during active chat sessions and scrolling.

## ADR-010: Client-Side Token Budgeting & RAG-Style Windowing
Instead of piping unfiltered 50-page documents to Gemini on every chat turn,
`fitContextToBudget` scores pages using BM25-style keyword matching and
assembles an optimal context window bounded at 6,000 tokens while always
anchoring Page 1. Grounding and quote verification still check against full
pre-normalized document pages to guarantee zero hallucinations.

## ADR-011: Next.js Standalone Docker Deployment
`next.config.js` sets `output: 'standalone'` and optimizes package imports
(`lucide-react`). The multi-stage `Dockerfile` copies `.next/standalone`,
`.next/static`, and `public`, producing a lean, secure, non-root container
image running directly with `node server.js`.

