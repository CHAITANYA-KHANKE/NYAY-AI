'use client';

/**
 * components/CitationBadge.tsx — "Clause X.Y | Pg Z" chip (brain/00 R2).
 * Clicking it scrolls the document viewer to the cited page and
 * highlights the original text; hovering previews the exact quote.
 */

import { Quote } from 'lucide-react';

interface CitationBadgeProps {
  clauseNumber: string;
  pageNumber: number;
  quote?: string;
  onClick?: (page: number, quote?: string) => void;
}

export default function CitationBadge({ clauseNumber, pageNumber, quote, onClick }: CitationBadgeProps) {
  const label = clauseNumber === 'General' ? `General | Pg ${pageNumber}` : `Clause ${clauseNumber} | Pg ${pageNumber}`;
  const tooltip = quote && quote.length > 280 ? `${quote.slice(0, 280)}…` : quote;

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => onClick?.(pageNumber, quote)}
        aria-label={`Verify citation ${label}${onClick ? ' — open original text' : ''}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-100"
      >
        <Quote className="h-3 w-3" aria-hidden="true" />
        {label}
      </button>
      {tooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-72 rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-normal leading-relaxed text-slate-600 shadow-pop group-hover:block"
        >
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Exact text from page {pageNumber}
          </span>
          “{tooltip}”
        </span>
      )}
    </span>
  );
}
