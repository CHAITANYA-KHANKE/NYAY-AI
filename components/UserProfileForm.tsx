'use client';

/**
 * components/UserProfileForm.tsx — User context profile (PRD F2).
 * Role cards + document-type dropdown + concern chips drive the
 * personalized risk analysis the AI performs (PRD F3).
 */

import { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  FileText,
  Home,
  Laptop,
  Loader2,
  Rocket,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { CONCERN_OPTIONS, DOC_TYPE_LABELS, ROLE_LABELS } from '@/lib/constants';
import Magnetic from '@/components/ui/Magnetic';
import type { DocType, UserProfile, UserRole } from '@/lib/types';

const ROLE_CARDS: { id: UserRole; icon: LucideIcon; blurb: string }[] = [
  { id: 'employee', icon: Briefcase, blurb: 'Offer letters & employment contracts' },
  { id: 'freelancer', icon: Laptop, blurb: 'Client & service agreements' },
  { id: 'tenant', icon: Home, blurb: 'Rental & lease agreements' },
  { id: 'founder', icon: Rocket, blurb: 'Term sheets & founder documents' },
  { id: 'other', icon: User, blurb: 'Any other legal document' },
];

interface UserProfileFormProps {
  fileName?: string;
  onSubmit: (profile: UserProfile) => void;
  busy?: boolean;
}

export default function UserProfileForm({ fileName, onSubmit, busy = false }: UserProfileFormProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [documentType, setDocumentType] = useState<DocType | ''>('');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleConcern(concern: string): void {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((item) => item !== concern) : [...prev, concern],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!role) {
      setError('Please choose who you are — risk analysis is personalized to your role.');
      return;
    }
    if (!documentType) {
      setError('Please select the type of document you uploaded.');
      return;
    }
    setError(null);
    onSubmit({ role, documentType, specificConcerns: concerns });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Your profile and concerns" className="space-y-7">
      {fileName && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <FileText className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          <span className="truncate">
            Analyzing: <span className="font-semibold text-ink">{fileName}</span>
          </span>
        </div>
      )}

      {/* Role cards */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          1. Who are you? <span className="font-normal text-slate-400">(risk is judged for you)</span>
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ROLE_CARDS.map(({ id, icon: Icon, blurb }) => {
            const selected = role === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                aria-pressed={selected}
                aria-label={`I am a ${ROLE_LABELS[id]}`}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? 'border-brand-500 bg-brand-50 shadow-card ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:border-brand-300'
                }`}
              >
                <Icon className={`h-5 w-5 ${selected ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden="true" />
                <span className="mt-2 block text-sm font-semibold text-ink">{ROLE_LABELS[id]}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Document type */}
      <div>
        <label htmlFor="doc-type" className="block text-sm font-semibold text-ink">
          2. What type of document is this?
        </label>
        <select
          id="doc-type"
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value as DocType)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink shadow-card focus:border-brand-400"
          aria-label="Document type"
        >
          <option value="" disabled>
            Select document type…
          </option>
          {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Concern chips */}
      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          3. Anything you are worried about?{' '}
          <span className="font-normal text-slate-400">(optional, pick any)</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONCERN_OPTIONS.map((concern) => {
            const selected = concerns.includes(concern);
            return (
              <button
                key={concern}
                type="button"
                onClick={() => toggleConcern(concern)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? 'border-brand-500 bg-brand-600 text-white shadow-card'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {concern}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      )}

      <Magnetic className="w-full">
        <button
          type="submit"
          disabled={busy}
          aria-label="Analyze my document with NyayAI"
          className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-pop transition hover:from-brand-700 hover:to-indigo-700 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? 'Analyzing…' : 'Analyze Now'}
        </button>
      </Magnetic>
    </form>
  );
}
