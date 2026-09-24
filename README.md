# ⚖️ NyayAI — AI Legal Document Analyzer

> **Tagline:** Har Contract, Crystal Clear
> English-with-nyay: contracts, offer letters, NDAs & rental agreements — explained for non-lawyers.

## What is NyayAI?

NyayAI is an AI-powered legal document analyzer that makes contracts, offer letters,
NDAs, and rental agreements **understandable, verifiable, and personalized** for
non-lawyers. Upload a PDF, tell it who you are, and get a plain-language breakdown
with **exact clause + page citations** — and an honest *"information not available"*
whenever the document is silent. Never a hallucination.

## ✨ Features

- 📄 **Smart PDF upload** — drag & drop, in-memory parsing with per-page extraction (max 20MB / 50 pages)
- 🧑 **User context profile** — Employee / Freelancer / Tenant / Founder + your specific concerns
- 🤖 **Personalized clause analysis** — simple explanations with HIGH / MEDIUM / LOW risk flags for *your* role
- 🔖 **Exact citations everywhere** — "Clause 8.2 | Pg 14" badges open a side-by-side viewer with the original text highlighted
- 🚫 **Zero hallucination** — Gemini is forced into JSON mode; every quote is re-verified against the real extracted text server-side, and unverifiable citations are dropped
- 💬 **Grounded Q&A chat** — answers only from your document, with citations and the "not available" fallback
- 📊 **Document health score** — animated 0–100 score + risk breakdown
- ⚖️ **Legal disclaimer on every AI response** (server-enforced, never model-generated)

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| AI | Google Gemini 3.6 Flash (`@google/generative-ai`, JSON mode; `GEMINI_MODEL` configurable; automatic fallback chain 3.6 → 3.7 → 3.8 → 3-flash-preview on 503/retired-model errors) |
| PDF | pdf-parse (custom page renderer → `\f` page splitting) |
| Validation | Zod (all API boundaries + all AI output) |
| Icons / Upload | lucide-react / react-dropzone |
| Deploy | Vercel |

## 🚀 Setup

```bash
# 1. Clone and install
git clone <your-repo> && cd nyayai
npm install

# 2. Configure environment
cp env.template .env.local
#    → paste your Gemini API key from https://aistudio.google.com/app/apikey

# 3. Run
npm run dev
# open http://localhost:3000
```

**Flow:** Upload PDF → Set Profile → View Analysis → Ask Questions. That is the
whole demo — well under 40 clicks. No PDF handy? Use the built-in
*"Try a sample offer letter"* button on the upload screen.

## ☁️ Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (zero config needed).
2. Add `GEMINI_API_KEY` (and optionally `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, `NEXT_PUBLIC_MAX_PAGES`) in **Project → Settings → Environment Variables**.
3. Deploy — HTTPS and the security headers in `next.config.js` are automatic.

## 🗂 Project Structure

```
nyayai/
├── brain/                  # 18-file product+tech brain (00_MASTER_RULES … 17_DECISIONS)
├── app/
│   ├── page.tsx            # Landing: hero → upload → profile → processing (code-split)
│   ├── dashboard/page.tsx  # Health score, clauses, missing concerns, chat, viewer (code-split)
│   └── api/
│       ├── parse/route.ts    # POST multipart PDF → per-page text
│       ├── analyze/route.ts  # POST pages+profile → AnalysisResult (cached & grounded)
│       └── chat/route.ts     # POST question → cited answer / "not available" (budgeted)
├── components/             # 10 UI components (React.memo, aria-labelled, WCAG 2.1 AA)
├── lib/
│   ├── types.ts            # Domain model (brain/04)
│   ├── constants.ts        # Limits, labels, server-enforced disclaimer, budgets
│   ├── cache.ts            # High-perf TTL in-memory LRU cache + FNV-1a hashing
│   ├── context.ts          # Zero-allocation token estimation & BM25 page budgeting
│   ├── pdf-parser.ts       # Deterministic per-page extraction
│   ├── prompts.ts          # Zero-hallucination prompt builders
│   ├── gemini.ts           # Gemini client: JSON mode, timeout race, multi-model cascade
│   ├── validators.ts       # Zod schemas + citation verification / repair
│   └── rate-limit.ts       # Bounded sliding-window limiter (10/ip/hr, 5k max entries)
├── scripts/
│   ├── bundle-budget.mjs   # Automated First Load JS budget enforcement
│   ├── build-sample-pdf.mjs# Regenerates public/sample-offer-letter.pdf
│   └── check-env.mjs       # Validates runtime environment configuration
├── PERFORMANCE.md          # Comprehensive performance & efficiency benchmarks
└── public/sample-offer-letter.pdf
```

## ⚡ Efficiency & Performance

- 📦 **Enforced First Load JS Budgets**: Shared $\le$ 88 kB (85.2 kB actual), `/` $\le$ 100 kB (96.1 kB actual, -17.1%), `/dashboard` $\le$ 106 kB (101.3 kB actual).
- 🔀 **Dynamic Code-Splitting**: Non-critical client trees (`FileUploader`, `UserProfileForm`, `PDFViewer`, `ChatInterface`) loaded via `next/dynamic`.
- 🧠 **Dual FNV-1a LRU Caching**: In-memory `TtlCache` deduplicates document analysis with zero external infrastructure overhead.
- 🎯 **RAG-Style Token Budgeting**: BM25 page ranking bounds context to 6,000 tokens while keeping Page 1 anchored and quotes 100% verified.
- ⏱️ **Model Resilience Cascade**: Strict `AbortController` racing with automatic fallback (`gemini-2.5-flash` $\to$ `gemini-2.5-pro` $\to$ `gemini-1.5-flash` $\to$ `gemini-1.5-pro`).
- See [PERFORMANCE.md](PERFORMANCE.md) for detailed before/after benchmarks and architecture diagrams.

## ✅ Quality Gates (all green in CI)

```bash
npm run verify        # Runs the complete quality pipeline (lint, typecheck, coverage, build, env, bundle)
npm run lint          # ESLint — zero warnings allowed (--max-warnings 0)
npm run typecheck     # TypeScript strict, zero errors
npm run test          # Vitest — 118 tests across 12 suites
npm run test:coverage # 93.5% stmts / 98.1% funcs on lib/, strict floor enforced
npm run check:bundle  # Enforces First Load JS gzip budgets per route
npm run check:env     # Validates runtime env (placeholder detection)
npm run build         # Next.js standalone production build
```

The suite covers what matters most for this product: **API integration
tests** (all 3 routes with a real PDF), **component tests** (Testing
Library), **hallucination defence** (fabricated citations are
corrected/dropped, disclaimers are forced), **caching & token budgeting**,
input validation, prompt-contract integrity, rate limiting, a **repository
secrets scan**, and accessibility regressions. Every push runs lint →
typecheck → test → build → check:bundle → TruffleHog in [GitHub Actions](.github/workflows/ci.yml).
See [EVALUATION.md](EVALUATION.md) for the full criteria-to-evidence map.

**Docker:** `docker build -t nyayai . && docker run -p 3000:3000 -e GEMINI_API_KEY=... nyayai`

## 🔐 Security & Trust (brain/10)

- No hardcoded secrets — `.env.local` only, git-ignored
- Zod validation on every API route **and** on every AI response
- File checks: MIME type + size + `%PDF` magic bytes
- Rate limiting: 10 parse/analyze + 30 chat requests per IP per hour
- Documents processed in memory; nothing is persisted server-side;
  session state lives only in the browser tab (closed tab = wiped)
- Security headers via `next.config.js`; hallucinated/out-of-range
  citations are corrected or dropped before reaching the UI

---

**Built for PromptWars Virtual Edition.** NyayAI = न्याय (justice) + AI.
