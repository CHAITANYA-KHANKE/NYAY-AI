# 14 — Production Checklist

## Code
- [ ] TypeScript strict mode
- [ ] No any types
- [ ] No console.log in production
- [ ] ESLint zero warnings

## Security
- [ ] .env.local in .gitignore
- [ ] No API keys committed
- [ ] Zod validation on all routes
- [ ] Rate limiting active

## Functionality
- [ ] PDF upload + parse works
- [ ] AI returns valid JSON with citations
- [ ] "Not available" for missing info
- [ ] Disclaimer on every response

## Deployment
- [ ] Vercel live URL working
- [ ] Env vars set in Vercel
- [ ] HTTPS enforced
- [ ] Demo video < 40 clicks
