# 16 — Changelog

## [0.1.0] Initial Setup
- Next.js 14 + TypeScript + Tailwind
- Brain folder with 17 documentation files

## [0.2.0] Core Backend
- PDF parsing, Gemini integration, API routes

## [0.3.0] Frontend MVP
- Upload, Profile, Dashboard, Chat

## [0.4.0] Verification
- Side-by-side viewer, citation highlighting

## [1.0.0] Final Submission
- PromptWars submission ready

## [1.1.0] Evaluation Hardening
- Vitest suite (6 files, 24+ tests): validators, hallucination defence,
  prompt contract, rate limiter, repository secrets scan, a11y checks
- GitHub Actions CI: lint (max-warnings 0) -> typecheck -> test ->
  build -> TruffleHog secret scan
- Security: CSP + HSTS headers, poweredByHeader disabled, SECURITY.md
- Accessibility: skip-to-content link, #main-content landmarks
- Docs: EVALUATION.md criteria-evidence map

## [1.2.0] Test Depth Parity+
- tests/api-routes.test.ts: full integration coverage of parse/analyze/
  chat with real NextRequest objects and a genuine PDF (11 tests)
- tests/components.test.tsx: React Testing Library + jsdom component
  tests for RiskBadge, Disclaimer, CitationBadge, Navbar (9 tests)
- 8 suites / 81 tests total; coverage floor enforced (~80% stmts)
- Dockerfile (multi-stage, non-root) + .dockerignore
- scripts/check-env.mjs runtime env gate, wired into npm scripts

## [1.3.0] Premium Design Pass
- Dark aurora hero: drifting gradient blobs, grid texture, floating
  particles, cursor-spotlight overlay
- Glowing conic-border wizard card, glass chips, doc-type marquee
- Zero-dependency motion system (reactbits/animate-ui style):
  scroll reveals, spotlight cards, magnetic buttons, shine sweeps,
  animated gradient wordmark — all CSS + tiny hooks (bundle stays lean)
- Smooth grid-rows accordion for clause cards, chat message entrance,
  health-score ring glow, dashboard staggered reveals
- All new motion honors prefers-reduced-motion (globals kill-switch)

## [1.4.0] Immersive Dark Homepage
- FIXED full-viewport aurora background — scrolling never changes/moves
  the backdrop; content glides over it (bg-slate-950 + vignette)
- Crystallized "AI" top bar: scroll-up-reveal (hysteresis, passive
  listener), ice-gradient shimmer text, crystal-glass pill
- Full dark homepage: glass trust cards, dark disclaimer variant, glow
  CTA band with smooth-scroll to wizard, minimal dark footer

