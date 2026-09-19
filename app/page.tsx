'use client';

/**
 * app/page.tsx — Landing + Upload + Profile (PRD F1, F2).
 * Full premium dark experience: a FIXED aurora background that never
 * moves while you scroll, a crystallized "AI" top bar that slides in on
 * scroll-up, glass cards, glowing wizard card, CTA band and footer.
 * Flow: Upload PDF -> Set Profile -> (parse + analyze) -> /dashboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  FileSearch,
  FileText,
  Loader2,
  MousePointerClick,
  Quote,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wand2,
} from 'lucide-react';
import Disclaimer from '@/components/Disclaimer';
import FileUploader from '@/components/FileUploader';
import UserProfileForm from '@/components/UserProfileForm';
import AuroraBackground from '@/components/ui/AuroraBackground';
import GradientText from '@/components/ui/GradientText';
import Magnetic from '@/components/ui/Magnetic';
import Reveal from '@/components/ui/Reveal';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { APP_NAME_HINDI, APP_TAGLINE, SESSION_STORAGE_KEYS } from '@/lib/constants';
import type { AnalysisResult, ApiResponse, ParseResponse, UserProfile } from '@/lib/types';

type Step = 'upload' | 'profile' | 'processing';

const PROCESSING_STAGES = [
  'Extracting text from your PDF…',
  'NyayAI is reading every clause…',
  'Scoring risks for your role…',
  'Verifying citations against the document…',
];

const TRUST_POINTS = [
  { icon: ShieldCheck, title: 'Zero Hallucination', blurb: 'Answers only from your document — nothing invented.' },
  { icon: Quote, title: 'Exact Citations', blurb: 'Every insight shows Clause + Page with the original text.' },
  { icon: UserCheck, title: 'Personalized Risk', blurb: 'Flagged for YOUR role — employee, tenant, freelancer.' },
  { icon: BadgeCheck, title: 'Honest Gaps', blurb: 'Says "information not available" instead of guessing.' },
] as const;

const HERO_STATS = [
  { icon: ShieldCheck, label: 'Zero-hallucination promise' },
  { icon: Quote, label: 'Clause + page citations' },
  { icon: MousePointerClick, label: 'Under 40 clicks' },
] as const;

const HOW_IT_WORKS = [
  { step: '01', icon: FileSearch, title: 'Upload & read', blurb: 'Your PDF is parsed page-by-page — in memory only, never stored.' },
  { step: '02', icon: BrainCircuit, title: 'Analyze for you', blurb: 'Gemini explains clauses in plain words and scores risk for your role.' },
  { step: '03', icon: BadgeCheck, title: 'Verify everything', blurb: 'Click any citation to see the original text highlighted side-by-side.' },
] as const;

const MARQUEE_ITEMS = [
  'Offer Letters',
  'Employment Contracts',
  'NDAs',
  'Rental Agreements',
  'Freelance Contracts',
  'Term Sheets',
  'Terms of Service',
];

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (step === 'processing') {
      setStageIndex(0);
      stageTimer.current = setInterval(() => {
        setStageIndex((index) => Math.min(index + 1, PROCESSING_STAGES.length - 1));
      }, 3200);
    }
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [step]);

  // Scroll-up reveal for the crystallized AI bar (hysteresis avoids flicker).
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) {
        setShowTopBar(true);
      } else if (y < lastScrollY.current - 6) {
        setShowTopBar(true);
      } else if (y > lastScrollY.current + 6) {
        setShowTopBar(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cursor spotlight over the hero (CSS vars only — no re-render).
  const handleHeroMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    hero.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, []);

  const handleFileSelect = useCallback((selected: File) => {
    setError(null);
    setFile(selected);
    setStep('profile');
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setStep('upload');
  }, []);

  const handleUseSample = useCallback(async () => {
    setSampleLoading(true);
    setError(null);
    try {
      const response = await fetch('/sample-offer-letter.pdf');
      if (!response.ok) throw new Error('sample-missing');
      const blob = await response.blob();
      const sample = new File([blob], 'sample-offer-letter.pdf', { type: 'application/pdf' });
      handleFileSelect(sample);
    } catch {
      setError('Could not load the sample document. Please upload your own PDF instead.');
    } finally {
      setSampleLoading(false);
    }
  }, [handleFileSelect]);

  async function handleAnalyze(profile: UserProfile): Promise<void> {
    if (!file) return;
    setStep('processing');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const parseResponse = await fetch('/api/parse', { method: 'POST', body: formData });
      const parseJson: ApiResponse<ParseResponse> = await parseResponse.json();
      if (!parseJson.success) throw new Error(parseJson.error);

      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: parseJson.data.pages, userProfile: profile }),
      });
      const analyzeJson: ApiResponse<AnalysisResult> = await analyzeResponse.json();
      if (!analyzeJson.success) throw new Error(analyzeJson.error);

      sessionStorage.setItem(SESSION_STORAGE_KEYS.PAGES, JSON.stringify(parseJson.data.pages));
      sessionStorage.setItem(SESSION_STORAGE_KEYS.ANALYSIS, JSON.stringify(analyzeJson.data));
      sessionStorage.setItem(SESSION_STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      sessionStorage.setItem(SESSION_STORAGE_KEYS.FILE_NAME, parseJson.data.fileName || file.name);
      router.push('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
      setStep('profile');
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="relative">
      {/* ====== FIXED background: never changes while scrolling ====== */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-slate-950">
        <AuroraBackground />
        {/* vignette keeps edges deep so glass content pops */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 120% 90% at 50% 0%, transparent 55%, rgba(2, 6, 23, 0.55))',
          }}
        />
      </div>

      {/* ====== Crystallized AI top bar — slides in on scroll-up ====== */}
      <div
        className={`fixed inset-x-0 top-14 z-30 flex justify-center px-4 transition-all duration-500 ease-out ${
          showTopBar ? 'translate-y-3 opacity-100' : 'pointer-events-none -translate-y-6 opacity-0'
        }`}
      >
        <div
          className="crystal-bar inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold text-slate-200"
          role="status"
          aria-label="AI Legal Document Intelligence"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse-soft" aria-hidden="true" />
          <span>
            <span className="text-crystal text-sm font-extrabold tracking-widest">AI</span>{' '}
            Legal Document Intelligence
          </span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-500" />
          <span className="hidden text-slate-400 sm:inline">Zero-hallucination contract analysis</span>
        </div>
      </div>

      {/* ====== All homepage content scrolls over the fixed background ====== */}
      <div className="relative z-10 text-white">
        {/* ------------------------------ HERO ------------------------------ */}
        <section
          ref={heroRef}
          onPointerMove={handleHeroMove}
          className="relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(620px circle at var(--mx, 50%) var(--my, 28%), rgba(99, 102, 241, 0.18), transparent 45%)',
            }}
          />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="glass inline-flex animate-fade-in-up items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-200">
              <Sparkles className="h-3.5 w-3.5 animate-pulse-soft text-indigo-300" aria-hidden="true" />
              AI Legal Document Intelligence · {APP_NAME_HINDI}
            </span>

            <h1
              className="mt-7 animate-fade-in-up text-6xl font-extrabold tracking-tight sm:text-7xl"
              style={{ animationDelay: '80ms', animationFillMode: 'both' }}
            >
              Nyay<GradientText>AI</GradientText>
            </h1>
            <p
              className="mt-3 animate-fade-in-up text-lg font-medium text-indigo-200/90 sm:text-2xl"
              style={{ animationDelay: '160ms', animationFillMode: 'both' }}
            >
              {APP_TAGLINE}
            </p>
            <p
              className="mt-5 max-w-2xl animate-fade-in-up text-sm leading-relaxed text-slate-400 sm:text-base"
              style={{ animationDelay: '240ms', animationFillMode: 'both' }}
            >
              Upload any offer letter, contract, NDA or rental agreement. NyayAI explains it in
              simple language, flags risky clauses for <em className="text-slate-200">your</em> role,
              and cites the exact clause and page — never inventing anything.
            </p>

            <div
              className="mt-8 flex animate-fade-in-up flex-wrap items-center justify-center gap-2.5"
              style={{ animationDelay: '320ms', animationFillMode: 'both' }}
            >
              {HERO_STATS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium text-slate-200"
                >
                  <Icon className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Wizard card — glowing animated border floating over the hero */}
          <div id="get-started" className="relative mx-auto w-full max-w-3xl scroll-mt-24 px-4 pb-20 sm:px-6">
            <div
              className="glow-border animate-fade-in-up"
              style={{ animationDelay: '380ms', animationFillMode: 'both' }}
            >
              <div className="rounded-[calc(1.5rem-1.5px)] bg-white p-6 text-ink shadow-pop sm:p-8">
                <ol className="mb-5 flex items-center gap-2 text-xs font-medium" aria-label="Progress">
                  {['Upload PDF', 'Your Profile', 'Analysis'].map((label, index) => {
                    const active =
                      (step === 'upload' && index === 0) ||
                      (step === 'profile' && index === 1) ||
                      (step === 'processing' && index === 2);
                    const done =
                      (step !== 'upload' && index === 0) || (step === 'processing' && index === 1);
                    return (
                      <li key={label} className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                            active
                              ? 'scale-110 bg-brand-600 text-white shadow-card'
                              : done
                                ? 'bg-risk-low text-white'
                                : 'bg-slate-200 text-slate-500'
                          }`}
                          aria-current={active ? 'step' : undefined}
                        >
                          {index + 1}
                        </span>
                        <span className={active ? 'text-ink' : 'text-slate-400'}>{label}</span>
                        {index < 2 && <span className="mx-1 h-px w-6 bg-slate-200" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ol>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-5 flex animate-fade-in-up items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{error}</p>
                  </div>
                )}

                {step === 'upload' && (
                  <div className="animate-fade-in-up">
                    <FileUploader selectedFile={file} onFileSelect={handleFileSelect} onClear={handleClearFile} />
                    <div className="mt-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
                      <span className="text-xs text-slate-400">no PDF handy?</span>
                      <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
                    </div>
                    <Magnetic className="mt-4 w-full">
                      <button
                        type="button"
                        onClick={handleUseSample}
                        disabled={sampleLoading}
                        aria-label="Try NyayAI with a sample offer letter"
                        className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                      >
                        {sampleLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        )}
                        Try a sample offer letter
                      </button>
                    </Magnetic>
                    <p className="mt-3 text-center text-xs text-slate-400">
                      Your document is processed in memory and never stored on our servers.
                    </p>
                  </div>
                )}

                {step === 'profile' && file && (
                  <div className="animate-fade-in-up">
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="mb-4 text-xs font-medium text-brand-600 hover:underline"
                      aria-label="Choose a different PDF"
                    >
                      ← Choose a different PDF
                    </button>
                    <UserProfileForm fileName={file.name} onSubmit={handleAnalyze} busy={false} />
                  </div>
                )}

                {step === 'processing' && (
                  <div className="flex animate-fade-in-up flex-col items-center py-10 text-center" aria-live="polite">
                    <div className="relative">
                      <span className="absolute inset-0 animate-ping rounded-full bg-brand-200" aria-hidden="true" />
                      <span
                        className="absolute -inset-3 rounded-full border-2 border-dashed border-indigo-200"
                        aria-hidden="true"
                        style={{ animation: 'border-spin 6s linear infinite' }}
                      />
                      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-pop">
                        <Wand2 className="h-7 w-7" aria-hidden="true" />
                      </span>
                    </div>
                    <h2 className="mt-6 text-lg font-semibold text-ink">{PROCESSING_STAGES[stageIndex]}</h2>
                    <p className="mt-1 text-sm text-slate-500">This usually takes 10–25 seconds.</p>
                    <ol className="mt-6 space-y-2 text-left">
                      {PROCESSING_STAGES.map((label, index) => (
                        <li key={label} className="flex items-center gap-2 text-xs">
                          {index < stageIndex ? (
                            <BadgeCheck className="h-4 w-4 text-risk-low" aria-hidden="true" />
                          ) : index === stageIndex ? (
                            <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-slate-200" aria-hidden="true" />
                          )}
                          <span className={index <= stageIndex ? 'text-ink' : 'text-slate-400'}>{label}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Doc-type marquee */}
          <div className="relative border-t border-white/10 py-5">
            <div className="marquee mx-auto max-w-6xl px-4 sm:px-6" aria-label="Supported document types">
              <div className="marquee-track">
                {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    aria-hidden={index >= MARQUEE_ITEMS.length}
                    className="glass whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------- TRUST CARDS --------------------------- */}
        <section className="px-4 pt-16 sm:px-6" aria-label="Why trust NyayAI">
          <div className="mx-auto w-full max-w-6xl">
            {step === 'upload' && (
              <>
                <Reveal>
                  <h2 className="text-center text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Built to earn your <span className="text-gradient-animated">trust</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
                    Legal AI is only useful if you can verify it. NyayAI shows its work — every time.
                  </p>
                </Reveal>

                <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {TRUST_POINTS.map(({ icon: Icon, title, blurb }, index) => (
                    <Reveal key={title} delay={index * 90}>
                      <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300/40 hover:shadow-pop">
                        <span
                          className="inline-flex animate-float rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 p-2.5 text-white shadow-card"
                          style={{ animationDelay: `${index * 0.7}s`, animationDuration: '7s' }}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{blurb}</p>
                      </SpotlightCard>
                    </Reveal>
                  ))}
                </div>

                <Reveal delay={120}>
                  <ol className="mt-16 grid gap-6 sm:grid-cols-3" aria-label="How it works">
                    {HOW_IT_WORKS.map(({ step: number, icon: Icon, title, blurb }, index) => (
                      <li key={number} className="relative">
                        {index < HOW_IT_WORKS.length - 1 && (
                          <span
                            className="absolute left-full top-6 hidden h-px w-6 -translate-x-3 border-t border-dashed border-white/15 sm:block"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex items-center gap-3">
                          <span className="glass flex h-12 w-12 items-center justify-center rounded-2xl text-indigo-300">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <span className="text-4xl font-black text-white/10">{number}</span>
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{blurb}</p>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              </>
            )}

            {/* ------------------------------ CTA band ------------------------------ */}
            {step === 'upload' && (
              <Reveal delay={140}>
                <div className="glow-border mt-16">
                  <div className="rounded-[calc(1.5rem-1.5px)] bg-slate-900/80 px-6 py-10 text-center backdrop-blur">
                    <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                      Ready to make your contract{' '}
                      <span className="text-gradient-animated">crystal clear?</span>
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                      Free during beta — from upload to clause-by-clause truth in under a minute.
                    </p>
                    <Magnetic className="mt-6">
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById('get-started')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          })
                        }
                        aria-label="Start analyzing your document now"
                        className="btn-shine inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-pop transition hover:from-brand-700 hover:to-indigo-700"
                      >
                        Start analyzing
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </Magnetic>
                  </div>
                </div>
              </Reveal>
            )}

            <Reveal delay={160}>
              <div className="mx-auto mt-14 max-w-3xl pb-16">
                <Disclaimer dark />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------- Footer ------------------------------- */}
        <footer className="relative border-t border-white/10 py-8 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            NyayAI · {APP_NAME_HINDI} — {APP_TAGLINE}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Powered by Google Gemini · Documents are processed in memory and never stored
          </p>
        </footer>
      </div>
    </main>
  );
}
