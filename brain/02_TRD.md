# 02 — Technical Requirements Document

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| AI Model | Gemini 3.6 Flash (env-configurable via GEMINI_MODEL) |
| PDF Parsing | pdf-parse |
| Validation | Zod |
| Icons | lucide-react |
| Upload | react-dropzone |
| Deployment | Vercel |

## Environment Variables
GEMINI_API_KEY=your_key_here
NEXT_PUBLIC_MAX_FILE_SIZE_MB=20
NEXT_PUBLIC_MAX_PAGES=50

## Performance Targets
| Metric | Target |
|--------|--------|
| PDF Parse | < 3s |
| AI Analysis | < 8s |
| Q&A Response | < 5s |
| Lighthouse | > 90 |
