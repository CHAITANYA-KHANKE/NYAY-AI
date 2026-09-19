# 09 — Error Handling

## File Errors
- Wrong type: "Please upload a PDF file only."
- Too large: "File exceeds 20MB limit."
- Empty: "This PDF appears to be empty."
- Corrupt: "Unable to read this PDF."

## AI Errors
- Timeout: "Analysis taking long. Please retry."
- Rate limit: "Too many requests. Please wait."
- Malformed JSON: Retry once, then show error.

## Hallucination Prevention
- Validate page numbers <= totalPages
- Regex check clause number format
- Force "not available" for missing info
- Auto-append disclaimer
