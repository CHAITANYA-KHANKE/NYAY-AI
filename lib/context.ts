/**
 * lib/context.ts — Centralized document context processing, token budgeting,
 * lexical relevance scoring, and memoized page normalization.
 */

import { TtlCache, type CacheStats } from './cache';
import type { ParsedPage } from './types';

export const CHARS_PER_TOKEN = 4;

/** Fast heuristic token estimator based on 4 characters per token. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Fast, zero-allocation word counter (O(N) time, O(1) heap memory). */
export function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  const len = text.length;
  for (let i = 0; i < len; i += 1) {
    const code = text.charCodeAt(i);
    if (code <= 32 || code === 160) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count += 1;
    }
  }
  return count;
}

/** Lowercase and collapse whitespace for consistent lexical matching. */
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface NormalizedPage {
  pageNumber: number;
  normalized: string;
}

/**
 * 32-entry, 15-minute TTL cache for normalized page arrays.
 * Reuses normalized strings across multiple quote lookups and chat turns.
 */
const normalizedCache = new TtlCache<NormalizedPage[]>(32, 15 * 60_000);

export function normalizedCacheStats(): CacheStats {
  return normalizedCache.stats();
}

export function clearNormalizedCache(): void {
  normalizedCache.clear();
}

/**
 * Normalizes an array of ParsedPage objects. If contextKey is provided,
 * results are memoized in the LRU TTL cache.
 */
export function getNormalizedPages(
  pages: ParsedPage[],
  contextKey?: string,
): NormalizedPage[] {
  if (contextKey) {
    const cached = normalizedCache.get(contextKey);
    if (cached) return cached;
  }

  const normalized = pages.map((page) => ({
    pageNumber: page.pageNumber,
    normalized: normalizeForSearch(page.text),
  }));

  if (contextKey) {
    normalizedCache.set(contextKey, normalized);
  }

  return normalized;
}

/** Canonical document format shared by analysis and chat: [PAGE n] blocks. */
export function formatPagesAsContext(pages: ParsedPage[]): string {
  return pages.map((page) => `[PAGE ${page.pageNumber}]\n${page.text.trim()}`).join('\n\n');
}

/** Rebuild ParsedPage[] from the "[PAGE n]\ntext" context string. */
export function parseContextToPages(documentContext: string): ParsedPage[] {
  const marker = /\[PAGE\s+(\d+)\s*\]/gi;
  const matches = [...documentContext.matchAll(marker)];
  const pages: ParsedPage[] = [];

  matches.forEach((match, index) => {
    const pageNumber = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? documentContext.length
        : documentContext.length;
    const text = documentContext.slice(start, end).trim();
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || text.length === 0) return;
    pages.push({
      pageNumber,
      text,
      wordCount: countWords(text),
    });
  });

  return pages;
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn',
  'we', 'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'tell', 'explain', 'show',
]);

export interface PageScore {
  pageNumber: number;
  score: number;
}

/**
 * Lexical scoring of normalized pages against query terms.
 * Filter stop-words and give Page 1 a +0.5 base score for foundational context.
 */
export function scorePages(
  question: string,
  normalizedPages: NormalizedPage[],
): PageScore[] {
  const terms = (question.toLowerCase().match(/[\w-]+/g) ?? [])
    .map((t) => t.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

  return normalizedPages.map((page) => {
    let score = page.pageNumber === 1 ? 0.5 : 0;
    for (const term of terms) {
      if (page.normalized.includes(term)) {
        score += 1;
      }
    }
    return {
      pageNumber: page.pageNumber,
      score,
    };
  });
}

export interface BudgetedContext {
  context: string;
  pageCount: number;
  totalPages: number;
  trimmed: boolean;
  tokens: number;
}

/**
 * Fits document context to an allowed token budget.
 * - If the document already fits, returns it untouched (trimmed: false).
 * - If oversized, prioritizes Page 1 (parties/preamble) and top-scored pages
 *   based on lexical match with the user's question, preserving document order.
 */
export function fitContextToBudget(
  question: string,
  documentContext: string,
  maxTokens: number,
): BudgetedContext {
  const pages = parseContextToPages(documentContext);
  const totalTokens = estimateTokens(documentContext);

  if (pages.length === 0 || totalTokens <= maxTokens) {
    return {
      context: documentContext,
      pageCount: pages.length,
      totalPages: pages.length,
      trimmed: false,
      tokens: totalTokens,
    };
  }

  const normalized = getNormalizedPages(pages, documentContext);
  const scores = scorePages(question, normalized);
  const scoreMap = new Map<number, number>(scores.map((s) => [s.pageNumber, s.score]));

  const page1 = pages.find((p) => p.pageNumber === 1);
  const otherPages = pages.filter((p) => p.pageNumber !== 1);

  // Sort other pages by relevance score descending, then pageNumber ascending
  otherPages.sort((a, b) => {
    const scoreA = scoreMap.get(a.pageNumber) ?? 0;
    const scoreB = scoreMap.get(b.pageNumber) ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.pageNumber - b.pageNumber;
  });

  const selectedPages: ParsedPage[] = [];
  if (page1) selectedPages.push(page1);

  for (const candidate of otherPages) {
    const candidateList = [...selectedPages, candidate].sort((a, b) => a.pageNumber - b.pageNumber);
    const candidateContext = formatPagesAsContext(candidateList);
    if (estimateTokens(candidateContext) <= maxTokens) {
      selectedPages.push(candidate);
    }
  }

  // Ensure selected pages are in document order
  selectedPages.sort((a, b) => a.pageNumber - b.pageNumber);
  const finalContext = formatPagesAsContext(selectedPages);

  return {
    context: finalContext,
    pageCount: selectedPages.length,
    totalPages: pages.length,
    trimmed: true,
    tokens: estimateTokens(finalContext),
  };
}
