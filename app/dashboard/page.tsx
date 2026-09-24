'use client';

/**
 * app/dashboard/page.tsx — Analysis dashboard (PRD F3–F7).
 * Reads parsed pages + analysis + profile from sessionStorage (ADR-007)
 * and renders: health score, risk breakdown, clause cards, missing
 * concerns, grounded chat and the side-by-side document viewer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  FileWarning,
  HelpCircle,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import ClauseCard from '@/components/ClauseCard';
import Disclaimer from '@/components/Disclaimer';
import HealthScore from '@/components/HealthScore';
import RiskBadge from '@/components/RiskBadge';
import Reveal from '@/components/ui/Reveal';
import { useRouter } from 'next/navigation';
import {
  DOC_TYPE_LABELS,
  ROLE_LABELS,
  SESSION_STORAGE_KEYS,
} from '@/lib/constants';
import { formatPagesAsContext } from '@/lib/prompts';
import type {
  AnalysisResult,
  ParsedPage,
  RiskLevel,
  UserProfile,
} from '@/lib/types';

const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-white p-6" aria-hidden="true">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
    </div>
  ),
});

const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-white p-6" aria-hidden="true">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
    </div>
  ),
});

interface ViewerTarget {
  page: number;
  quote?: string;
}

type LoadState = 'loading' | 'ready' | 'empty';

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-10 sm:px-6" aria-hidden="true">
      <div className="h-8 w-64 rounded-lg bg-slate-200" />
      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="h-40 rounded-3xl bg-slate-200" />
          <div className="h-28 rounded-3xl bg-slate-200" />
          <div className="h-28 rounded-3xl bg-slate-200" />
        </div>
        <div className="h-[420px] rounded-3xl bg-slate-200 lg:col-span-2" />
      </div>
    </div>
  );
}

const RISK_ORDER: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW'];

export default function DashboardPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [pages, setPages] = useState<ParsedPage[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [activeTab, setActiveTab] = useState<'chat' | 'viewer'>('chat');
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget>({ page: 1 });

  useEffect(() => {
    const storedPages = readSession<ParsedPage[]>(SESSION_STORAGE_KEYS.PAGES);
    const storedAnalysis = readSession<AnalysisResult>(SESSION_STORAGE_KEYS.ANALYSIS);
    const storedProfile = readSession<UserProfile>(SESSION_STORAGE_KEYS.PROFILE);
    const storedName = sessionStorage.getItem(SESSION_STORAGE_KEYS.FILE_NAME);

    if (storedPages && storedAnalysis && Array.isArray(storedPages) && storedPages.length > 0) {
      setPages(storedPages);
      setAnalysis(storedAnalysis);
      setProfile(storedProfile);
      setFileName(storedName ?? 'document.pdf');
      setViewerTarget({ page: 1 });
      setLoadState('ready');
    } else {
      setLoadState('empty');
    }
  }, []);

  const documentContext = useMemo(() => formatPagesAsContext(pages), [pages]);

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    analysis?.keyClauses.forEach((clause) => {
      counts[clause.riskLevel] += 1;
    });
    return counts;
  }, [analysis]);

  const handleCitationClick = useCallback((page: number, quote?: string) => {
    setViewerTarget({ page, quote });
    setActiveTab('viewer');
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setViewerTarget((prev) => ({ ...prev, page }));
  }, []);

  const handleNewDocument = useCallback(() => {
    Object.values(SESSION_STORAGE_KEYS).forEach((key) => sessionStorage.removeItem(key));
    router.push('/');
  }, [router]);

  if (loadState === 'loading') return <Skeleton />;

  if (loadState === 'empty' || !analysis) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
        <FileWarning className="h-12 w-12 text-slate-300" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">No document found</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your session may have expired. Upload a legal document to see its analysis here.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Analyze a document
        </Link>
      </main>
    );
  }

  const totalPages = pages.length;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      {/* ---------------------------- Header meta ---------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink" title={fileName}>
              {fileName}
            </h1>
            <p className="text-xs text-slate-500">
              {totalPages} page{totalPages === 1 ? '' : 's'}
              {profile && (
                <>
                  {' · '}
                  {ROLE_LABELS[profile.role]} · {DOC_TYPE_LABELS[profile.documentType]}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleNewDocument}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-card transition hover:border-brand-300 hover:text-brand-700"
          aria-label="Analyze a new document"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          New document
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ---------------------------- Left: analysis ---------------------------- */}
        <div className="space-y-6 lg:col-span-3">
          {/* Health score */}
          <Reveal>
          <section
            aria-label="Document health"
            className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition-shadow duration-300 hover:shadow-pop sm:flex-row sm:items-center"
          >
            <HealthScore
              score={analysis.documentHealthScore}
              high={riskCounts.HIGH}
              medium={riskCounts.MEDIUM}
              low={riskCounts.LOW}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Document summary
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{analysis.summary}</p>
            </div>
          </section>
          </Reveal>

          {/* Clause list */}
          <Reveal delay={100}>
          <section aria-label="Key clauses">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">
                Key clauses
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {analysis.keyClauses.length}
                </span>
              </h2>
              <div className="flex items-center gap-2" aria-label="Risk legend">
                {RISK_ORDER.map((level) => (
                  <span key={level} className="hidden items-center gap-1 text-[11px] text-slate-500 sm:inline-flex">
                    <RiskBadge level={level} size="sm" />
                    {riskCounts[level]}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {analysis.keyClauses.map((clause, index) => (
                <ClauseCard
                  key={`${clause.clauseTitle}-${index}`}
                  clause={clause}
                  defaultOpen={index === 0}
                  onCitationClick={handleCitationClick}
                />
              ))}
              {analysis.keyClauses.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  No specific clauses could be verified in this document.
                </p>
              )}
            </div>
          </section>
          </Reveal>

          {/* Missing concerns (zero-hallucination honesty, PRD F3) */}
          {analysis.missingConcerns.length > 0 && (
            <Reveal delay={150}>
            <section
              aria-label="Concerns not found in the document"
              className="rounded-3xl border border-amber-200 bg-amber-50 p-6"
            >
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                Not addressed in this document
              </h2>
              <p className="mt-1 text-xs text-amber-700">
                You asked about these, but the document is silent on them — NyayAI will never
                fill the gaps with guesses.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {analysis.missingConcerns.map((concern) => (
                  <li
                    key={concern}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800"
                  >
                    {concern}
                  </li>
                ))}
              </ul>
            </section>
            </Reveal>
          )}

          <Reveal delay={200}>
            <Disclaimer />
          </Reveal>
        </div>

        {/* ----------------------- Right: chat / viewer ----------------------- */}
        <Reveal delay={150} className="lg:col-span-2">
        <aside>
          <div className="flex h-[78vh] min-h-[460px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card lg:sticky lg:top-20">
            <div role="tablist" aria-label="Assistant and document" className="flex border-b border-slate-100">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-brand-600 text-brand-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Ask NyayAI
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'viewer'}
                onClick={() => setActiveTab('viewer')}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === 'viewer'
                    ? 'border-b-2 border-brand-600 text-brand-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Document
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {activeTab === 'chat' ? (
                <ChatInterface documentContext={documentContext} onCitationClick={handleCitationClick} />
              ) : (
                <PDFViewer
                  pages={pages}
                  activePage={viewerTarget.page}
                  highlightText={viewerTarget.quote}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Click any citation badge to see the original text side-by-side — trust, but verify.
          </p>
        </aside>
        </Reveal>
      </div>
    </main>
  );
}
