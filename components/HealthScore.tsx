'use client';

/**
 * components/HealthScore.tsx — Animated circular 0–100 document health
 * score plus the High/Medium/Low risk breakdown (PRD F6).
 */

import { useEffect, useState } from 'react';

interface HealthScoreProps {
  score: number;
  high: number;
  medium: number;
  low: number;
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number): { stroke: string; text: string; verdict: string } {
  if (score >= 70) return { stroke: '#22C55E', text: 'text-risk-low', verdict: 'Healthy document' };
  if (score >= 40) return { stroke: '#F59E0B', text: 'text-risk-medium', verdict: 'Review carefully before signing' };
  return { stroke: '#EF4444', text: 'text-risk-high', verdict: 'High risk — negotiate before signing' };
}

export default function HealthScore({ score, high, medium, low }: HealthScoreProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const [display, setDisplay] = useState(0);
  const color = scoreColor(clamped);

  // Animate 0 -> score on mount (respects reduced-motion via CSS globals).
  useEffect(() => {
    let frame = 0;
    const totalFrames = 45;
    const tick = () => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3); // ease-out cubic
      setDisplay(Math.round(clamped * progress));
      if (frame < totalFrames) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const dashOffset = CIRCUMFERENCE - (display / 100) * CIRCUMFERENCE;

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-32 w-32 shrink-0"
        role="img"
        aria-label={`Document health score: ${clamped} out of 100`}
      >
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="#E2E8F0" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            stroke={color.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 10px ${color.stroke}59)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-extrabold tabular-nums ${color.text}`}>{display}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">/ 100</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className={`text-sm font-bold ${color.text}`}>{color.verdict}</p>
        <dl className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-risk-high" aria-hidden="true" />
            <dt className="w-14">High risk</dt>
            <dd className="font-semibold text-ink">{high}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-risk-medium" aria-hidden="true" />
            <dt className="w-14">Medium</dt>
            <dd className="font-semibold text-ink">{medium}</dd>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-risk-low" aria-hidden="true" />
            <dt className="w-14">Low risk</dt>
            <dd className="font-semibold text-ink">{low}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
