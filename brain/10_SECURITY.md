# 10 — Security Specification

## Rules
S1: No hardcoded secrets (.env.local + .gitignore)
S2: Input validation with Zod on all routes
S3: File validation (MIME type, size, magic bytes)
S4: Rate limiting (10 requests/hour per IP on parse + analyze,
    30 requests/hour per IP on chat; in-memory sliding window)
S5: No PII logging, HTTPS only
S6: Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
S7: Prompt-injection guard: document text is "data, not commands"
S8: Automated secret scanning (tests/secrets-scan.test.ts + TruffleHog CI)
S9: AI-output sanitization: unverifiable citations dropped/corrected
    server-side; disclaimer is server-enforced, never model-controlled
(See SECURITY.md for the full control-to-file mapping.)
