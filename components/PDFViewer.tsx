'use client';

/**
 * components/PDFViewer.tsx — Side-by-side verification viewer (PRD F4).
 * Renders the extracted page text with the cited quote highlighted,
 * plus prev/next navigation. Text-based by design (brain spec) — the
 * extract is exactly what the AI read, so verification is faithful.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ParsedPage } from '@/lib/types';

interface PDFViewerProps {
  pages: ParsedPage[];
  activePage: number;
  highlightText?: string;
  onPageChange: (page: number) => void;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pre-compile regexes for a quote so we don't compile RegExp inside tight loops. */
function buildQuoteRegexes(quote: string): RegExp[] {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const snippets: string[][] = [words.slice(0, 6)];
  if (words.length > 9) snippets.push(words.slice(-6));
  return snippets.map((snippet) => new RegExp(snippet.map(escapeRegExp).join('\\s+'), 'i'));
}

function findRangesWithRegexes(text: string, regexes: RegExp[]): Array<[number, number]> {
  if (regexes.length === 0) return [];
  const ranges: Array<[number, number]> = [];
  for (const regex of regexes) {
    const match = regex.exec(text);
    if (match) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function PDFViewer({ pages, activePage, highlightText, onPageChange }: PDFViewerProps) {
  const totalPages = pages.length;
  const firstMarkRef = useRef<HTMLElement | null>(null);

  const page = useMemo(() => {
    const clamped = Math.min(Math.max(1, activePage), Math.max(1, totalPages));
    return pages[clamped - 1];
  }, [pages, activePage, totalPages]);

  const quoteRegexes = useMemo(() => {
    return highlightText && highlightText.trim().length > 0 ? buildQuoteRegexes(highlightText) : [];
  }, [highlightText]);

  // If the cited quote lives on a different page than requested, follow it.
  useEffect(() => {
    if (!highlightText || !page || totalPages === 0 || quoteRegexes.length === 0) return;
    if (findRangesWithRegexes(page.text, quoteRegexes).length > 0) return;
    const found = pages.find((candidate) => findRangesWithRegexes(candidate.text, quoteRegexes).length > 0);
    if (found && found.pageNumber !== activePage) onPageChange(found.pageNumber);
  }, [highlightText, page, pages, activePage, totalPages, onPageChange, quoteRegexes]);

  // Scroll the first highlight into view whenever it changes.
  useEffect(() => {
    firstMarkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePage, highlightText]);

  const content = useMemo<ReactNode[]>(() => {
    if (!page) return [];
    if (!highlightText || highlightText.trim().length === 0 || quoteRegexes.length === 0) return [page.text];

    const ranges = findRangesWithRegexes(page.text, quoteRegexes).sort((a, b) => a[0] - b[0]);
    if (ranges.length === 0) return [page.text];

    const nodes: ReactNode[] = [];
    let cursor = 0;
    let first = true;
    ranges.forEach(([start, end], index) => {
      if (start < cursor) return; // overlapping ranges — skip
      nodes.push(page.text.slice(cursor, start));
      nodes.push(
        <mark key={`mark-${index}`} ref={first ? firstMarkRef : undefined}>
          {page.text.slice(start, end)}
        </mark>,
      );
      first = false;
      cursor = end;
    });
    nodes.push(page.text.slice(cursor));
    return nodes;
  }, [page, highlightText, quoteRegexes]);

  if (!page) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
        <FileSearch className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm">No pages to display.</p>
      </div>
    );
  }

  const pageNumber = page.pageNumber;

  return (
    <section aria-label="Original document text" className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => onPageChange(pageNumber - 1)}
          disabled={pageNumber <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="text-xs font-semibold text-slate-500" aria-live="polite">
          Page {pageNumber} of {totalPages}
          <span className="ml-2 font-normal text-slate-400">· {page.wordCount} words</span>
        </p>
        <button
          type="button"
          onClick={() => onPageChange(pageNumber + 1)}
          disabled={pageNumber >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {highlightText && (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          Highlighting the cited text — jump with the page arrows to explore around it.
        </p>
      )}

      {/* Page text */}
      <pre
        aria-label={`Extracted text of page ${pageNumber}`}
        className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words bg-white px-4 py-4 font-sans text-[13px] leading-relaxed text-slate-700"
      >
        {content}
      </pre>
    </section>
  );
}

export default memo(PDFViewer);
