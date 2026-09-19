# 12 — CI/CD Pipeline

## .github/workflows/ci.yml
- Triggers: push to main/develop, PRs
- Jobs: lint, typecheck, test, build
- Security scan: trufflehog for secrets
- Secrets via GitHub Repository Settings
