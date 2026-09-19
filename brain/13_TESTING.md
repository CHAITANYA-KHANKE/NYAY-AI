# 13 — Testing Strategy

## Runner: Vitest (+ @vitest/coverage-v8)
- `npm run test` — full suite (CI gate)
- `npm run test:coverage` — V8 coverage over `lib/**`
- `npm run typecheck` — strict TS over app + tests
- `npm run lint` — ESLint with `--max-warnings 0`

## Suites (tests/) — 8 suites, 81 tests

### api-routes.test.ts — Integration (route handlers)
- parse: genuine PDF end-to-end (200), non-PDF (400), missing field
  (400), corrupt PDF (422)
- analyze/chat: malformed JSON (400), schema errors (422), deterministic
  AI_NOT_CONFIGURED (500) via stubbed env — no network in CI

### components.test.tsx — React components (Testing Library + jsdom)
- RiskBadge accessible names per level, Disclaimer role+full text,
  CitationBadge label/verify action/tooltip, Navbar landmark + no
  promotional badges

### validators.test.ts — Input validation
- PDF-only acceptance, wrong-MIME `.pdf` recovery, size cap (413),
  empty file (422)
- analyze schema: page caps, unknown roles, concern defaults
- chat schema: min question length, context floor, history cap

### hallucination.test.ts — CRITICAL (Zero-Hallucination, R1)
- Health score clamped to [0, 100]
- Wrong page numbers corrected when the quote is found elsewhere
- Fabricated clauses with out-of-range pages are DROPPED
- Clause numbers normalized ("Clause 4.2" -> "4.2", "N/A" -> "General")
- Model disclaimer always replaced by the server-enforced text
- Missing info surfaces in `missingConcerns`, never invented
- Chat citations re-located and out-of-range citations dropped

### prompts.test.ts — Prompt contract
- Grounding rules, verbatim-quote mandate, "not available" phrase,
  disclaimer injection, page markers, role/concern personalization,
  prompt-injection guard ("data, not commands")

### rate-limit.test.ts — Limiter behaviour (S4)
- Allowance, blocking, window reset (fake timers), per-key isolation

### secrets-scan.test.ts — Repository secret scan (S1)
- Scans tracked source for key formats (Google/GitHub/AWS/Slack/PEM)
- Asserts `.env.local` absent from repo, `.env*` git-ignored, example
  file is placeholder-only, Gemini key read only from process.env

### a11y-static.test.ts — Accessibility regression (WCAG 2.1 AA)
- `lang`, skip link, landmarks, aria labels on icon-only controls,
  aria-live regions, icon+text risk levels, reduced motion, focus rings

## Integration Tests
- API route error handling verified via route contracts (400/413/422/
  429/500/502/504 mapping) and CI build
- End-to-end: build + `npm run start` smoke (parse sample PDF)

## CI (brain/12)
Every push/PR: lint -> typecheck -> check-env -> test (with coverage
floor 75/65/90/75 on lib/) -> build -> secret scan.
