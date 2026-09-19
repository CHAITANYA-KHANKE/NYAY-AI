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
