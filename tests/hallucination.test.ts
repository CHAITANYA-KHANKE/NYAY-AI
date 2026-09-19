/**
 * tests/hallucination.test.ts — CRITICAL suite (brain/13: "Hallucination
 * Tests"). These guard the Zero-Hallucination Policy (brain/00 rule R1):
 * fabricated citations must be corrected or dropped, page numbers must
 * stay in range, and the disclaimer is never model-controlled.
 */

import { describe, expect, it } from 'vitest';
import { LEGAL_DISCLAIMER } from '../lib/constants';
import { formatPagesAsContext } from '../lib/prompts';
import {
  locateQuotePage,
  parseContextToPages,
  postProcessAnalysis,
  postProcessChatResponse,
} from '../lib/validators';
import type { AnalysisResult, ParsedPage } from '../lib/types';

const pages: ParsedPage[] = [
  {
    pageNumber: 1,
    text: '4.2 After confirmation, either party may terminate with 60 days written notice or salary in lieu thereof.',
    wordCount: 17,
  },
  {
    pageNumber: 2,
    text: '8.2 Upon termination, you shall return all Company property within 7 days. 8.3 Nothing else matters here.',
    wordCount: 20,
  },
];

function modelClause(overrides: Partial<AnalysisResult['keyClauses'][number]>) {
  return {
    clauseTitle: 'Notice Period',
    clauseNumber: '4.2',
    pageNumber: 1,
    exactQuote: 'either party may terminate with 60 days written notice',
    simplifiedExplanation: 'You can leave with 60 days notice.',
    riskLevel: 'MEDIUM' as const,
    recommendation: 'Try to negotiate it down.',
    ...overrides,
  };
}

function modelResult(clauses: AnalysisResult['keyClauses'], score = 55): AnalysisResult {
  return {
    documentHealthScore: score,
    summary: 'Summary.',
    keyClauses: clauses,
    missingConcerns: ['Equity / Vesting'],
    legalDisclaimer: 'MODEL-CONTROLLED GARBAGE',
  };
}

describe('postProcessAnalysis — hallucination defence', () => {
  it('clamps the health score into [0, 100]', () => {
    const result = postProcessAnalysis(modelResult([modelClause({})], 137), pages);
    expect(result.documentHealthScore).toBe(100);
    const negative = postProcessAnalysis(modelResult([modelClause({})], -12), pages);
    expect(negative.documentHealthScore).toBe(0);
  });

  it('corrects a wrong page number when the quote is found on another page', () => {
    // Model cites page 1, but the quote actually lives on page 2.
    const clause = modelClause({
      pageNumber: 1,
      exactQuote: 'you shall return all Company property within 7 days',
    });
    const result = postProcessAnalysis(modelResult([clause]), pages);
    expect(result.keyClauses[0]?.pageNumber).toBe(2);
  });

  it('DROPS clauses whose page citation is outside the document range', () => {
    const fabricated = modelClause({
      clauseTitle: 'Imaginary Bonus Clause',
      exactQuote: 'this text does not exist anywhere in the document at all',
      pageNumber: 99,
    });
    const result = postProcessAnalysis(modelResult([fabricated]), pages);
    expect(result.keyClauses).toHaveLength(0);
  });

  it('normalizes clause numbers ("Clause 4.2" -> "4.2", "N/A" -> "General")', () => {
    const withPrefix = postProcessAnalysis(modelResult([modelClause({ clauseNumber: 'Clause 4.2' })]), pages);
    expect(withPrefix.keyClauses[0]?.clauseNumber).toBe('4.2');
    const withNA = postProcessAnalysis(modelResult([modelClause({ clauseNumber: 'N/A' })]), pages);
    expect(withNA.keyClauses[0]?.clauseNumber).toBe('General');
  });

  it('ALWAYS replaces the model disclaimer with the server-enforced text', () => {
    const result = postProcessAnalysis(modelResult([modelClause({})]), pages);
    expect(result.legalDisclaimer).toBe(LEGAL_DISCLAIMER);
    expect(result.legalDisclaimer).not.toContain('GARBAGE');
  });

  it('keeps user-declared missing concerns instead of inventing answers', () => {
    const result = postProcessAnalysis(modelResult([modelClause({})]), pages);
    expect(result.missingConcerns).toEqual(['Equity / Vesting']);
  });
});

describe('locateQuotePage', () => {
  it('finds the page containing a quote', () => {
    expect(locateQuotePage(pages, 'return all Company property within 7 days')).toBe(2);
    expect(locateQuotePage(pages, '60 days written notice')).toBe(1);
  });

  it('is robust to whitespace differences between quote and document', () => {
    expect(locateQuotePage(pages, 'either   party may\nterminate   with 60 days')).toBe(1);
  });

  it('returns null for unverifiable or trivially short quotes', () => {
    expect(locateQuotePage(pages, 'payment of 5,00,000 bonus shares')).toBeNull();
    expect(locateQuotePage(pages, 'the')).toBeNull();
  });
});

describe('parseContextToPages', () => {
  it('round-trips formatPagesAsContext output', () => {
    const context = formatPagesAsContext(pages);
    const rebuilt = parseContextToPages(context);
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0]?.pageNumber).toBe(1);
    expect(rebuilt[0]?.text).toBe(pages[0]?.text);
    expect(rebuilt[1]?.text).toBe(pages[1]?.text);
  });
});

describe('postProcessChatResponse — hallucination defence', () => {
  const context = formatPagesAsContext(pages);

  it('re-points chat citations to the page where the quote actually is', () => {
    const response = postProcessChatResponse(
      {
        answer: 'You must return property within 7 days.',
        citations: [
          { clauseNumber: '8.2', pageNumber: 1, exactText: 'return all Company property within 7 days' },
        ],
        isMissingInfo: false,
      },
      context,
    );
    expect(response.citations[0]?.pageNumber).toBe(2);
  });

  it('drops citations with out-of-range pages', () => {
    const response = postProcessChatResponse(
      {
        answer: 'Answer.',
        citations: [{ clauseNumber: '12.9', pageNumber: 42, exactText: 'invented text, not in document' }],
        isMissingInfo: false,
      },
      context,
    );
    expect(response.citations).toHaveLength(0);
  });

  it('appends the server-enforced disclaimer to every answer', () => {
    const response = postProcessChatResponse({ answer: 'Answer.', citations: [], isMissingInfo: true }, context);
    expect(response.disclaimer).toBe(LEGAL_DISCLAIMER);
    expect(response.isMissingInfo).toBe(true);
  });
});
