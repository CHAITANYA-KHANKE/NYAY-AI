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
cp .env.local.example .env.local
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
│   ├── page.tsx            # Landing: hero → upload → profile → processing
│   ├── dashboard/page.tsx  # Health score, clauses, missing concerns, chat, viewer
│   └── api/
│       ├── parse/route.ts    # POST multipart PDF → per-page text
│       ├── analyze/route.ts  # POST pages+profile → AnalysisResult (grounded)
│       └── chat/route.ts     # POST question → cited answer / "not available"
├── components/             # 10 UI components (all aria-labelled, WCAG 2.1 AA)
├── lib/
│   ├── types.ts            # Domain model (brain/04)
│   ├── constants.ts        # Limits, labels, server-enforced disclaimer
│   ├── pdf-parser.ts       # Deterministic per-page extraction
│   ├── prompts.ts          # Zero-hallucination prompt builders
│   ├── gemini.ts           # Gemini client: JSON mode, retry, timeouts
│   ├── validators.ts       # Zod schemas + citation verification / repair
│   └── rate-limit.ts       # In-memory sliding-window limiter (10/ip/hr)
├── scripts/build-sample-pdf.mjs  # Regenerates public/sample-offer-letter.pdf
└── public/sample-offer-letter.pdf
```

## ✅ Quality Gates (all green in CI)

```bash
npm run lint        # ESLint — zero warnings allowed
npm run typecheck   # TypeScript strict, zero errors
npm run test        # Vitest — 81 tests across 8 suites
npm run test:coverage  # ~80% statements / ~94% functions on lib/, floor enforced
npm run check:env   # validates runtime env (placeholder detection)
npm run build       # next build
```

The suite covers what matters most for this product: **API integration
tests** (all 3 routes with a real PDF), **component tests** (Testing
Library), **hallucination defence** (fabricated citations are
corrected/dropped, disclaimers are forced), input validation,
prompt-contract integrity, rate limiting, a **repository secrets scan**,
and accessibility regressions. Every push runs lint → typecheck → test →
build → TruffleHog in [GitHub Actions](.github/workflows/ci.yml).
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
