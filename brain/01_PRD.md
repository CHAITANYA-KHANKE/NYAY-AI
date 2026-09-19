# 01 — Product Requirements Document

## Product: NyayAI — AI Legal Document Analyzer

## Problem Statement
Legal documents are written in complex language that non-lawyers cannot
understand. Users need a tool that simplifies legal jargon, highlights
risky clauses personalized to their role, provides exact citations for
verification, and never hallucinates legal information.

## Target Users
| Persona | Use Case |
|---------|----------|
| Fresher Employee | Offer letter (CTC, bond, notice period) |
| Freelancer | Client contracts (IP, payment, termination) |
| Tenant | Rental agreement (deposit, eviction) |
| Startup Founder | Investor term sheets (equity, vesting) |

## Core Features (MVP)
F1: Smart Document Upload (PDF, max 20MB)
F2: User Context Profile (role, document type, concerns)
F3: Personalized Clause Analysis (risk levels, explanations)
F4: Exact Citation & Verification (clause + page, side-by-side)
F5: Intelligent Q&A (grounded, cited, no hallucination)
F6: Document Health Dashboard (score 0-100, risk breakdown)
F7: Legal Disclaimer (on every AI response)

## Non-Functional Requirements
- Response time: < 10 seconds
- Max 50 pages per document
- Mobile-responsive, WCAG 2.1 AA
