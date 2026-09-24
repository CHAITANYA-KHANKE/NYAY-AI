# NyayAI — Evaluation Criteria Evidence Map

Every submission criterion, mapped to concrete, verifiable evidence in
this repository. Each row lists *how an evaluator can verify it*.

> TL;DR quality gate (all must pass, all do):
> `npm run lint && npm run typecheck && npm run test:coverage && npm run build`

---

## 1. Code Quality

| Evidence | Verify |
|----------|--------|
| TypeScript **strict mode**, zero `any` in app code (structural interfaces for pdf.js internals instead) | `npm run typecheck` |
| ESLint with **zero-warning policy** | `npm run lint` (`--max-warnings 0`) |
| Clean layered architecture: `lib/` (pure, unit-tested) → `app/api/` (thin HTTP shells) → `components/` (dumb UI) | see file tree |
| Single source of truth for limits, labels, disclaimer | `lib/constants.ts` |
| Typed API envelope (`ApiResponse<T>`, `ApiError`), no ad-hoc JSON shapes | `lib/types.ts` |
| Documented decisions (11 ADRs) | `brain/17_DECISIONS.md` |
| Reproducible build (lockfile committed, pinned Next 14.2) | `package-lock.json` |

## 2. Security

| Evidence | Verify |
|----------|--------|
| No secrets in repo; env-only key handling; automated **secret-scan test** + TruffleHog CI job | `npm run test`, `SECURITY.md` S1/S8 |
| Zod validation on all 3 API routes + on AI output | `lib/validators.ts` |
| File validation: type, size, extension, **magic bytes** | `tests/validators.test.ts` |
| Rate limiting 10/10/30 per hour per IP (bounded 5,000 buckets) | `tests/rate-limit.test.ts` |
| 8 security headers incl. CSP + HSTS; `poweredByHeader` off | `next.config.js` |
| Zero-persistence privacy: in-memory processing, sessionStorage only | `brain/05_DATA_SOURCES.md` |
| Prompt-injection guard ("data, not commands") | `tests/prompts.test.ts` |

## 3. Efficiency

| Evidence | Verify |
|----------|--------|
| **Enforced First-Load JS Budgets**: Shared $\le$ 88 kB (85.2 kB actual), `/` $\le$ 100 kB (96.1 kB actual, -17.1%), `/dashboard` $\le$ 106 kB (101.3 kB actual) | `npm run check:bundle` |
| **Dynamic Code-Splitting (`next/dynamic`)**: Heavy client components (`FileUploader`, `UserProfileForm`, `PDFViewer`, `ChatInterface`) loaded on demand | `app/page.tsx`, `app/dashboard/page.tsx` |
| **Dual FNV-1a Hash In-Memory Caching (`TtlCache`)**: Deduplicates identical document/profile analyses with collision guards | `lib/cache.ts`, `tests/cache.test.ts` |
| **RAG-Style Token Budgeting & Page Scoring**: BM25-style page ranker filters context to 6,000 token ceiling, retaining Page 1 while dropping irrelevant content | `lib/context.ts`, `tests/context.test.ts` |
| **Zero-Allocation Token & Word Counter**: Character scanner avoids regex string array allocations | `lib/context.ts` |
| **Model Fallback Cascade & Timeout Racing**: Time-budgeted `AbortController` (45s analyze / 20s chat) with multi-model fallback chain | `lib/gemini.ts`, `tests/gemini-budget.test.ts` |
| **Rendering Optimization**: `React.memo` on leaf/card components, rAF-throttled scroll listener, `.cv-auto` content-visibility | `app/globals.css`, components |
| **Icon Import Optimization**: `optimizePackageImports: ['lucide-react']` eliminates unused icon chunks | `next.config.js` |

## 4. Testing

| Evidence | Verify |
|----------|--------|
| **118 automated tests across 12 suites**, all passing | `npm run test` |
| **API integration tests**: all 3 routes tested with real NextRequest objects; sample PDF parsed end-to-end (200/400/422/500 paths) | `tests/api-routes.test.ts` |
| **Cache & budgeting tests**: FNV-1a key hashing, TTL eviction, collision protection, and context budgeting | `tests/cache.test.ts`, `tests/context.test.ts` |
| **Gemini timeout & cascade tests**: Model fallback, retry with jitter, cache hit/miss behavior | `tests/gemini-budget.test.ts` |
| **Component tests** (React Testing Library + jsdom): risk badges, disclaimer, citations, navbar rendered in a real DOM | `tests/components.test.tsx` |
| **Hallucination-defence suite** (the project's #1 risk): fabricated clauses dropped, wrong pages corrected, scores clamped, disclaimer forced | `tests/hallucination.test.ts` |
| **Input-validation suites** (file rules, schema edges, caps) | `tests/validators.test.ts` |
| **PDF parser unit tests**: deterministic extraction, error mapping, word counting | `tests/pdf-parser.test.ts` |
| **Prompt-contract tests** (grounding rules can't silently regress) | `tests/prompts.test.ts` |
| **Rate-limiter tests** with deterministic fake timers and bounded eviction | `tests/rate-limit.test.ts` |
| **Repository secrets scan as a test** (fails CI on leaked keys) | `tests/secrets-scan.test.ts` |
| **Accessibility-regression tests** (landmarks, labels, reduced motion) | `tests/a11y-static.test.ts` |
| **Coverage floor strictly enforced in CI** (93.5% stmts / 83.0% branch / 98.1% funcs / 93.5% lines; thresholds 88/78/94/88) | `npm run test:coverage` |
| **Automated bundle budget gate**: Zero-dependency script verifying gzipped First Load JS sizes | `npm run check:bundle` |
| **Runtime env verification gate** (placeholder/short key detection) | `npm run check:env` |
| **Unified CI verification pipeline**: `npm run verify` runs all lint, typecheck, coverage, build, env, and bundle checks | `package.json`, `.github/workflows/ci.yml` |
| **Containerized deployment**: Next.js standalone multi-stage Docker build (`node server.js`) | `Dockerfile` |

## 5. Accessibility (WCAG 2.1 AA)

| Evidence | Verify |
|----------|--------|
| Skip-to-content link + `#main-content` landmarks + `lang="en"` | `app/layout.tsx`, both pages |
| aria-labels on **every** icon-only button; `aria-live` for chat/status; `aria-expanded`/`aria-controls` on accordions | components; `tests/a11y-static.test.ts` |
| Risk never color-only: distinct icon + text per level | `components/RiskBadge.tsx` |
| `:focus-visible` rings; `prefers-reduced-motion` honored | `app/globals.css` |
| Risk palette meets 4.5:1 on its backgrounds (`#EF4444/#F59E0B/#22C55E` with white/dark text per spec) | `brain/08_UI_SPEC.md` |
| Full keyboard operability (native buttons/inputs, no div-clicks) | components |

## 6. Problem Statement Alignment

| Requirement (brain/01 PRD) | Implementation |
|----------------------------|----------------|
| F1 Smart PDF upload (≤20MB) | `components/FileUploader.tsx`, `app/api/parse/route.ts` |
| F2 User context profile | `components/UserProfileForm.tsx` (role + doc type + concerns) |
| F3 Personalized clause analysis | `lib/prompts.ts`, `components/ClauseCard.tsx`, `RiskBadge` |
| F4 Exact citation + verification | `CitationBadge`, `PDFViewer` side-by-side highlight, server re-location of quotes |
| F5 Grounded Q&A | `app/api/chat/route.ts`, `ChatInterface`, "information not available" state |
| F6 Health dashboard | `HealthScore` (animated 0–100 + risk breakdown), missing-concerns panel |
| F7 Disclaimer on every AI response | Server-forced `LEGAL_DISCLAIMER` + in-bubble footer |
| Zero-hallucination (R1/R2) | JSON mode → Zod validation → citation verification (drop/correct) → tests pin the behavior |
| < 40 clicks demo flow | Upload → Profile → Dashboard → Chat (4 screens, ~8 clicks with sample doc) |

---

*This file is the audit trail behind `brain/14_PRODUCTION_CHECKLIST.md` —
 every box above is checked by a command or a test, not by assertion.*
