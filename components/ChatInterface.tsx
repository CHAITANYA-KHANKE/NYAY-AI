'use client';

/**
 * components/ChatInterface.tsx — Grounded Q&A over the document (PRD F5).
 * Every assistant bubble carries verified citation badges, the
 * "information not available" honesty state, and the disclaimer footer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, Loader2, Send, ShieldCheck } from 'lucide-react';
import CitationBadge from '@/components/CitationBadge';
import { LEGAL_DISCLAIMER_SHORT } from '@/lib/constants';
import type { ApiResponse, ChatMessage, ChatResponse } from '@/lib/types';

type LocalMessage = ChatMessage & { isError?: boolean };

interface ChatInterfaceProps {
  documentContext: string;
  onCitationClick?: (page: number, quote?: string) => void;
}

const SUGGESTIONS = [
  'Summarize this document in 3 lines',
  'What are the riskiest clauses for me?',
  'Explain my notice period',
  'Is there any bond or penalty?',
];

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const WELCOME: LocalMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi! I am NyayAI. I have read your document end to end. Ask me anything about it — I will answer only from what is actually written, with exact clause and page citations.',
};

export default function ChatInterface({ documentContext, onCitationClick }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const send = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || sending) return;

      const userMessage: LocalMessage = { id: makeId(), role: 'user', content: question };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setSending(true);

      try {
        const history = [...messages, userMessage]
          .filter((message) => !message.isError && message.id !== 'welcome')
          .slice(-10)
          .map((message) => ({ ...message, isError: undefined }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, documentContext, chatHistory: history }),
        });
        const payload: ApiResponse<ChatResponse> = await response.json();

        if (!payload.success) {
          throw new Error(payload.error);
        }

        const assistantMessage: LocalMessage = {
          id: makeId(),
          role: 'assistant',
          content: payload.data.answer,
          citations: payload.data.citations,
          isMissingInfo: payload.data.isMissingInfo,
          disclaimer: payload.data.disclaimer,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (cause) {
        const errorMessage: LocalMessage = {
          id: makeId(),
          role: 'assistant',
          isError: true,
          content:
            cause instanceof Error
              ? cause.message
              : 'Something went wrong while answering. Please try again.',
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setSending(false);
      }
    },
    [documentContext, messages, sending],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void send(input);
  }

  return (
    <section aria-label="Ask questions about your document" className="flex h-full flex-col">
      {/* Message list */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex animate-fade-in-up ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'user' ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-card">
                {message.content}
              </p>
            ) : (
              <div
                className={`max-w-[92%] rounded-2xl rounded-bl-sm border px-4 py-3 shadow-card ${
                  message.isError
                    ? 'border-red-200 bg-red-50'
                    : message.isMissingInfo
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                {message.isMissingInfo && (
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    Not found in your document
                  </p>
                )}
                <p
                  className={`whitespace-pre-wrap text-sm leading-relaxed ${
                    message.isError ? 'text-red-700' : 'text-slate-700'
                  }`}
                >
                  {message.content}
                </p>

                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {message.citations.map((citation, index) => (
                      <CitationBadge
                        key={`${message.id}-cite-${index}`}
                        clauseNumber={citation.clauseNumber}
                        pageNumber={citation.pageNumber}
                        quote={citation.exactText}
                        onClick={onCitationClick}
                      />
                    ))}
                  </div>
                )}

                {!message.isError && (
                  <p className="mt-3 flex items-center gap-1 border-t border-slate-200/70 pt-2 text-[10px] font-medium text-slate-400">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {LEGAL_DISCLAIMER_SHORT}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400 shadow-card">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              NyayAI is checking the document…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only before the first real question) */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              disabled={sending}
              className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about your document
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about clauses, notice period, deposits…"
          maxLength={2000}
          disabled={sending}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={sending || input.trim().length < 3}
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card transition hover:bg-brand-700 disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
    </section>
  );
}
