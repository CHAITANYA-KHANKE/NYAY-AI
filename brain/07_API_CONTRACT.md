# 07 — API Contract

## POST /api/parse
Request: multipart/form-data { file: File }
Response: { success, data: { pageCount, pages: [{pageNumber, text}] } }

## POST /api/analyze
Request: { pages: ParsedPage[], userProfile: UserProfile }
Response: { success, data: AnalysisResult }

## POST /api/chat
Request: { question, documentContext, chatHistory }
Response: { success, data: { answer, citations, isMissingInfo, disclaimer } }

## Error Codes
400: Invalid input | 413: File too large | 422: Unprocessable
429: Rate limited | 500: Server error | 504: AI timeout
