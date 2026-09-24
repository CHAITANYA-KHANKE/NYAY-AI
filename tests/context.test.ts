/**
 * tests/context.test.ts — Unit tests for lib/context.ts.
 * Validates word counting, token estimation, context rebuilding, memoized normalization,
 * relevance scoring, and context budget trimming.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearNormalizedCache,
  countWords,
  estimateTokens,
  fitContextToBudget,
  formatPagesAsContext,
  getNormalizedPages,
  normalizedCacheStats,
  normalizeForSearch,
  parseContextToPages,
  scorePages,
} from '../lib/context';
import type { ParsedPage } from '../lib/types';

describe('countWords', () => {
  it('counts words accurately across spaces, tabs, and newlines without allocating arrays', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  \n  this is\ta test  ')).toBe(6);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('single')).toBe(1);
  });
});

describe('estimateTokens', () => {
  it('estimates ~4 characters per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('12345')).toBe(2);
  });
});

describe('normalizeForSearch', () => {
  it('lowercases and collapses multiple whitespace characters', () => {
    expect(normalizeForSearch('  Clause   8.2:\n Notice Period  ')).toBe('clause 8.2: notice period');
  });
});

describe('parseContextToPages and formatPagesAsContext', () => {
  const samplePages: ParsedPage[] = [
    { pageNumber: 1, text: 'First page contract text.', wordCount: 4 },
    { pageNumber: 2, text: 'Second page termination terms.', wordCount: 4 },
  ];

  it('formats and parses [PAGE n] blocks in round-trip', () => {
    const formatted = formatPagesAsContext(samplePages);
    expect(formatted).toContain('[PAGE 1]\nFirst page contract text.');
    expect(formatted).toContain('[PAGE 2]\nSecond page termination terms.');

    const parsed = parseContextToPages(formatted);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.pageNumber).toBe(1);
    expect(parsed[0]?.text).toBe('First page contract text.');
    expect(parsed[1]?.pageNumber).toBe(2);
    expect(parsed[1]?.text).toBe('Second page termination terms.');
  });
});

describe('memoized normalization', () => {
  beforeEach(() => {
    clearNormalizedCache();
  });

  const pages: ParsedPage[] = [
    { pageNumber: 1, text: 'Company Confidential Information', wordCount: 3 },
    { pageNumber: 2, text: 'Employee Notice Period Clause', wordCount: 4 },
  ];

  it('memoizes normalized results when contextKey is provided (returns exact same object identity)', () => {
    const contextKey = 'doc-hash-123';
    const first = getNormalizedPages(pages, contextKey);
    const second = getNormalizedPages(pages, contextKey);

    expect(first).toBe(second);
    expect(normalizedCacheStats().hits).toBe(1);
  });

  it('computes without caching when contextKey is omitted', () => {
    const first = getNormalizedPages(pages);
    const second = getNormalizedPages(pages);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(normalizedCacheStats().hits).toBe(0);
  });
});

describe('scorePages', () => {
  const normalizedPages = [
    { pageNumber: 1, normalized: 'employment agreement between company and employee preamble.' },
    { pageNumber: 2, normalized: 'salary remuneration ctc benefits and compensation.' },
    { pageNumber: 3, normalized: 'notice period termination 60 days exit policy severance.' },
  ];

  it('scores higher for matching terms and filters stop-words', () => {
    const scores = scorePages('What is my notice period and termination clause?', normalizedPages);

    const scoreMap = new Map(scores.map((s) => [s.pageNumber, s.score]));
    // Page 3 has both 'notice', 'period', 'termination'
    expect(scoreMap.get(3)).toBeGreaterThan(scoreMap.get(2) ?? 0);
  });

  it('gives Page 1 a baseline floor bonus for foundational preamble context', () => {
    const scores = scorePages('unrelated query wordsxyz', normalizedPages);
    const scoreMap = new Map(scores.map((s) => [s.pageNumber, s.score]));
    expect(scoreMap.get(1)).toBe(0.5);
    expect(scoreMap.get(2)).toBe(0);
  });
});

describe('fitContextToBudget', () => {
  const pages: ParsedPage[] = Array.from({ length: 10 }, (_, i) => ({
    pageNumber: i + 1,
    text: `Page ${i + 1} content. Clause ${i + 1}.1 details about topic-${i + 1}. `.repeat(20),
    wordCount: 160,
  }));

  const fullContext = formatPagesAsContext(pages);

  it('returns small document context untouched when within token budget', () => {
    const result = fitContextToBudget('topic-3', fullContext, 50_000);
    expect(result.trimmed).toBe(false);
    expect(result.pageCount).toBe(10);
    expect(result.context).toBe(fullContext);
  });

  it('trims oversized documents to stay under token budget while preserving Page 1 and relevant pages', () => {
    // A tight budget of ~800 tokens (~3200 chars)
    const result = fitContextToBudget('Tell me about topic-8 details', fullContext, 800);

    expect(result.trimmed).toBe(true);
    expect(result.pageCount).toBeLessThan(10);
    expect(result.tokens).toBeLessThanOrEqual(800);

    // Page 1 is ALWAYS preserved
    expect(result.context).toContain('[PAGE 1]');

    // Relevant page (Page 8) is preserved
    expect(result.context).toContain('[PAGE 8]');

    // Document order is strictly maintained
    const p1Index = result.context.indexOf('[PAGE 1]');
    const p8Index = result.context.indexOf('[PAGE 8]');
    expect(p1Index).toBeLessThan(p8Index);
  });
});
