# 06 — PDF Extraction Specification

## Pipeline
1. Validate file (type: application/pdf, size < 20MB)
2. Extract text with pdf-parse (page breaks via \f)
3. Format as [PAGE 1] text... [PAGE 2] text...
4. Feed to Gemini with grounding prompt

## Edge Cases
| Case | Handling |
|------|----------|
| Scanned PDF | Error: "Scanned PDFs not supported" |
| Password protected | Error: "Remove password first" |
| Empty PDF | Error: "No extractable text" |
| Non-English | Process with warning |

## Implementation Notes
- pdf-parse is imported from `pdf-parse/lib/pdf-parse.js` directly
  (avoids the debug-mode file read in the package index).
- A custom `pagerender` appends a form-feed (\f) after every page so
  page splitting is deterministic and citation page numbers are exact.
- Magic bytes (%PDF) checked before parsing.
