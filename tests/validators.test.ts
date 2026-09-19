/**
 * tests/validators.test.ts — Unit tests for input validation (brain/13).
 * Covers file upload rules (type/size/empty) and every Zod boundary.
 */

import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, MAX_PAGES } from '../lib/constants';
import {
  analyzeRequestSchema,
  chatRequestSchema,
  firstZodIssue,
  validateFileUpload,
} from '../lib/validators';
import type { ParsedPage } from '../lib/types';

const validPage: ParsedPage = { pageNumber: 1, text: 'Clause 1.1 Some legal text.', wordCount: 6 };

describe('validateFileUpload', () => {
  it('accepts a valid PDF', () => {
    expect(validateFileUpload({ type: 'application/pdf', size: 1024, name: 'doc.pdf' })).toEqual({
      valid: true,
    });
  });

  it('accepts a .pdf filename even with a wrong MIME type', () => {
    expect(validateFileUpload({ type: 'application/octet-stream', size: 1024, name: 'DOC.PDF' }).valid).toBe(true);
  });

  it('rejects non-PDF files with a 400', () => {
    const result = validateFileUpload({ type: 'text/plain', size: 1024, name: 'notes.txt' });
    expect(result).toEqual({ valid: false, error: 'Please upload a PDF file only.', status: 400 });
  });

  it('rejects empty files with a 422', () => {
    const result = validateFileUpload({ type: 'application/pdf', size: 0, name: 'doc.pdf' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('empty');
      expect(result.status).toBe(422);
    }
  });

  it(`rejects files above the ${MAX_FILE_SIZE_MB}MB limit with a 413`, () => {
    const result = validateFileUpload({
      type: 'application/pdf',
      size: MAX_FILE_SIZE_BYTES + 1,
      name: 'huge.pdf',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain(`${MAX_FILE_SIZE_MB}MB`);
      expect(result.status).toBe(413);
    }
  });
});

describe('analyzeRequestSchema', () => {
  const validProfile = { role: 'employee', documentType: 'offer_letter', specificConcerns: ['Notice Period'] };

  it('accepts a valid request', () => {
    const parsed = analyzeRequestSchema.safeParse({ pages: [validPage], userProfile: validProfile });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty pages array', () => {
    const parsed = analyzeRequestSchema.safeParse({ pages: [], userProfile: validProfile });
    expect(parsed.success).toBe(false);
  });

  it(`rejects more than ${MAX_PAGES} pages`, () => {
    const pages = Array.from({ length: MAX_PAGES + 1 }, (_, i) => ({ ...validPage, pageNumber: i + 1 }));
    const parsed = analyzeRequestSchema.safeParse({ pages, userProfile: validProfile });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown role', () => {
    const parsed = analyzeRequestSchema.safeParse({
      pages: [validPage],
      userProfile: { ...validProfile, role: 'wizard' },
    });
    expect(parsed.success).toBe(false);
  });

  it('defaults specificConcerns to an empty array', () => {
    const parsed = analyzeRequestSchema.safeParse({
      pages: [validPage],
      userProfile: { role: 'tenant', documentType: 'rental_agreement' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.userProfile.specificConcerns).toEqual([]);
  });
});

describe('chatRequestSchema', () => {
  const context = `[PAGE 1]\n${'word '.repeat(30)}end of page`;

  it('accepts a valid question', () => {
    const parsed = chatRequestSchema.safeParse({
      question: 'What is my notice period?',
      documentContext: context,
      chatHistory: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects questions shorter than 3 characters', () => {
    const parsed = chatRequestSchema.safeParse({ question: 'hi', documentContext: context });
    expect(parsed.success).toBe(false);
  });

  it('rejects a suspiciously short document context', () => {
    const parsed = chatRequestSchema.safeParse({ question: 'Notice period?', documentContext: 'short' });
    expect(parsed.success).toBe(false);
  });

  it('caps chat history length', () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      id: `m${i}`,
      role: 'user' as const,
      content: `message ${i}`,
    }));
    const parsed = chatRequestSchema.safeParse({
      question: 'Notice period?',
      documentContext: context,
      chatHistory: history,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('firstZodIssue', () => {
  it('produces a human-readable first error', () => {
    const parsed = analyzeRequestSchema.safeParse({ pages: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = firstZodIssue(parsed.error);
      expect(message).toContain('Invalid request');
      expect(message).toContain('pages');
    }
  });
});
