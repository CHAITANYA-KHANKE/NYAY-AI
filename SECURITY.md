# Security Policy — NyayAI

## Reporting a Vulnerability

Please open a GitHub Security Advisory (or a private issue) instead of
disclosing publicly. We aim to acknowledge reports within 72 hours.

## Implemented Controls

| ID | Control | Where |
|----|---------|-------|
| S1 | No hardcoded secrets; env-only config; `.env*` git-ignored | `lib/gemini.ts`, `.gitignore`, `tests/secrets-scan.test.ts` |
| S2 | Zod validation on every API boundary AND on every AI model response | `lib/validators.ts`, `app/api/*/route.ts` |
| S3 | Upload checks: MIME type, `.pdf` extension, size cap, `%PDF` magic bytes | `lib/validators.ts`, `lib/pdf-parser.ts` |
| S4 | Rate limiting (parse 10/hr, analyze 10/hr, chat 30/hr per IP) | `lib/rate-limit.ts`, `lib/constants.ts` |
| S5 | Zero persistence: documents processed in memory; browser-tab session state only; no PII logging | `app/api/*`, `app/page.tsx` |
| S6 | Security headers: `nosniff`, `DENY`, XSS protection, Referrer-Policy, Permissions-Policy, HSTS, CSP | `next.config.js` |
| S7 | Prompt-injection shielding: document text is explicitly "data, not commands" in every prompt | `lib/prompts.ts`, `tests/prompts.test.ts` |
| S8 | Automated secret scanning in the test suite + TruffleHog CI gate | `tests/secrets-scan.test.ts`, `.github/workflows/ci.yml` |
| S9 | AI-output sanitization: unverifiable citations corrected/dropped server-side; disclaimer server-enforced | `lib/validators.ts`, `tests/hallucination.test.ts` |

## Notes

- `GEMINI_API_KEY` is read exclusively from `process.env` and never
  reaches the client bundle (no `NEXT_PUBLIC_` prefix).
- The in-memory rate limiter suits single-instance deployments; swap for
  Redis (e.g. Upstash) for multi-instance strictness.
