import Link from 'next/link';
import { Scale } from 'lucide-react';
import { APP_NAME_HINDI, APP_TAGLINE } from '@/lib/constants';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6"
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="NyayAI home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-card">
            <Scale className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-tight text-ink">
              Nyay<span className="text-brand-600">AI</span>
            </span>
            <span className="block text-[10px] font-medium text-slate-400">{APP_TAGLINE}</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] font-medium text-slate-400 sm:block">{APP_NAME_HINDI}</span>
          <span className="hidden text-[11px] font-medium text-slate-300 md:block" aria-hidden="true">
            AI Legal Document Intelligence
          </span>
        </div>
      </nav>
    </header>
  );
}
