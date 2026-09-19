'use client';

/**
 * components/ClauseCard.tsx — Expandable clause analysis card (PRD F3/F4).
 * Smooth grid-rows accordion animation, hover lift, and the verified
 * quote block with clickable citation inside.
 */

import { useState } from 'react';
import { ChevronDown, Lightbulb, Quote } from 'lucide-react';
import CitationBadge from '@/components/CitationBadge';
import RiskBadge from '@/components/RiskBadge';
import type { ClauseAnalysis } from '@/lib/types';

interface ClauseCardProps {
  clause: ClauseAnalysis;
  defaultOpen?: boolean;
  onCitationClick?: (page: number, quote?: string) => void;
}

const BORDER_BY_RISK: Record<ClauseAnalysis['riskLevel'], string> = {
  HIGH: 'border-l-risk-high',
  MEDIUM: 'border-l-risk-medium',
  LOW: 'border-l-risk-low',
};

export default function ClauseCard({ clause, defaultOpen = false, onCitationClick }: ClauseCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `clause-panel-${clause.clauseTitle.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pop animate-fade-in-up ${BORDER_BY_RISK[clause.riskLevel]}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} details for ${clause.clauseTitle} (risk ${clause.riskLevel})`}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <RiskBadge level={clause.riskLevel} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{clause.clauseTitle}</span>
          <span className="block text-[11px] text-slate-400">
            {clause.clauseNumber === 'General' ? 'General section' : `Clause ${clause.clauseNumber}`} · Page{' '}
            {clause.pageNumber}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div id={panelId} className={`expandable ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="expand-inner">
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
            {/* Simple explanation */}
            <p className="text-sm leading-relaxed text-slate-600">{clause.simplifiedExplanation}</p>

            {/* Verbatim quote block — the verifiable evidence */}
            <figure
              aria-label={`Original document text for ${clause.clauseTitle}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <blockquote className="flex gap-2 text-xs italic leading-relaxed text-slate-500">
                <Quote className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
                <span className="whitespace-pre-wrap">“{clause.exactQuote}”</span>
              </blockquote>
              <figcaption className="mt-3">
                <CitationBadge
                  clauseNumber={clause.clauseNumber}
                  pageNumber={clause.pageNumber}
                  quote={clause.exactQuote}
                  onClick={onCitationClick}
                />
              </figcaption>
            </figure>

            {/* Recommendation */}
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-brand-900">
                <span className="font-bold">What you should do: </span>
                {clause.recommendation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
