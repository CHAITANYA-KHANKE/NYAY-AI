import { Scale } from 'lucide-react';
import { LEGAL_DISCLAIMER } from '@/lib/constants';

/**
 * components/Disclaimer.tsx — Mandatory legal disclaimer (PRD F7).
 * Rendered under every AI surface: landing wizard, dashboard, chat.
 * `dark` variant suits the premium dark homepage sections.
 */
export default function Disclaimer({
  className = '',
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        dark
          ? 'border-white/15 bg-white/[0.06] backdrop-blur'
          : 'border-slate-200 bg-slate-100'
      } ${className}`}
    >
      <Scale
        className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? 'text-slate-400' : 'text-slate-500'}`}
        aria-hidden="true"
      />
      <p className={`text-xs leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
        {LEGAL_DISCLAIMER}
      </p>
    </div>
  );
}
