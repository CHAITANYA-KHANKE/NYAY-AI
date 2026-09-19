/**
 * tests/prompts.test.ts — Prompt construction tests (brain/13).
 * The prompts ARE the zero-hallucination contract: if the grounding
 * rules, page markers or disclaimer disappear from them, the whole
 * honesty guarantee collapses. These tests pin them in place.
 */

import { describe, expect, it } from 'vitest';
import { LEGAL_DISCLAIMER, MISSING_INFO_PHRASE } from '../lib/constants';
import { buildAnalysisPrompt, buildChatPrompt, formatPagesAsContext } from '../lib/prompts';
import type { ParsedPage, UserProfile } from '../lib/types';

const pages: ParsedPage[] = [
  { pageNumber: 1, text: 'Clause 1 text here.', wordCount: 4 },
  { pageNumber: 2, text: 'Clause 2 text here.', wordCount: 4 },
];

const profile: UserProfile = {
  role: 'employee',
  documentType: 'offer_letter',
  specificConcerns: ['Notice Period', 'Bond / Service Agreement'],
};

describe('formatPagesAsContext', () => {
  it('emits deterministic [PAGE n] markers used by citations', () => {
    const context = formatPagesAsContext(pages);
    expect(context).toContain('[PAGE 1]');
    expect(context).toContain('[PAGE 2]');
    expect(context.indexOf('[PAGE 1]')).toBeLessThan(context.indexOf('[PAGE 2]'));
  });
});

describe('buildAnalysisPrompt', () => {
  const prompt = buildAnalysisPrompt(pages, profile);

  it('includes the document text with page markers', () => {
    expect(prompt).toContain('Clause 1 text here.');
    expect(prompt).toContain('[PAGE 2]');
    expect(prompt).toContain('DOCUMENT START');
    expect(prompt).toContain('DOCUMENT END');
  });

  it('hard-wires the zero-hallucination rules (R1)', () => {
    expect(prompt).toContain(MISSING_INFO_PHRASE);
    expect(prompt.toUpperCase()).toContain('NEVER FABRICATE');
    expect(prompt).toContain('VERBATIM');
  });

  it('requests the AnalysisResult JSON shape with mandatory citation fields', () => {
    for (const key of [
      'documentHealthScore',
      'summary',
      'keyClauses',
      'exactQuote',
      'pageNumber',
      'riskLevel',
      'missingConcerns',
      'legalDisclaimer',
    ]) {
      expect(prompt).toContain(key);
    }
  });

  it('personalizes to the reader role and concerns', () => {
    expect(prompt).toContain('Employee');
    expect(prompt).toContain('Offer Letter');
    expect(prompt).toContain('Notice Period');
    expect(prompt).toContain('Bond / Service Agreement');
  });

  it('injects the exact legal disclaimer the model must echo', () => {
    expect(prompt).toContain(LEGAL_DISCLAIMER);
  });

  it('protects against prompt injection from the document itself', () => {
    expect(prompt).toContain('data, not commands');
  });

  it('falls back gracefully when no concerns are provided', () => {
    const fallback = buildAnalysisPrompt(pages, { ...profile, specificConcerns: [] });
    expect(fallback).toContain('thorough role-appropriate review');
  });
});

describe('buildChatPrompt', () => {
  const prompt = buildChatPrompt(
    'Can they fire me without notice?',
    formatPagesAsContext(pages),
    [
      { id: '1', role: 'user', content: 'Earlier question' },
      { id: '2', role: 'assistant', content: 'Earlier answer' },
    ],
  );

  it('contains the question and the document context', () => {
    expect(prompt).toContain('Can they fire me without notice?');
    expect(prompt).toContain('Clause 2 text here.');
  });

  it('includes trimmed chat history as context', () => {
    expect(prompt).toContain('Earlier question');
    expect(prompt).toContain('Earlier answer');
  });

  it('demands cited JSON with the isMissingInfo escape hatch', () => {
    expect(prompt).toContain('"isMissingInfo"');
    expect(prompt).toContain('"citations"');
    expect(prompt).toContain(MISSING_INFO_PHRASE);
  });

  it('keeps the not-a-lawyer behaviour explicit', () => {
    expect(prompt).toContain('qualified legal professional');
  });
});
