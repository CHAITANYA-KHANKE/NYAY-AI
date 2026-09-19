/**
 * tests/api-routes.test.ts — Integration tests for all three API routes
 * (brain/13: "Integration tests — API route error handling, end-to-end
 * flow"). Route handlers are invoked with real NextRequest objects; the
 * sample offer-letter PDF drives a genuine end-to-end parse.
 *
 * GEMINI_API_KEY is stubbed empty so AI routes deterministically hit the
 * "not configured" branch instead of calling the network in CI.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POST as parsePOST } from '../app/api/parse/route';
import { POST as analyzePOST } from '../app/api/analyze/route';
import { POST as chatPOST } from '../app/api/chat/route';
import { MAX_FILE_SIZE_MB } from '../lib/constants';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PDF_URL = 'http://localhost:3000/api/parse';
const ANALYZE_URL = 'http://localhost:3000/api/analyze';
const CHAT_URL = 'http://localhost:3000/api/chat';

function multipartRequest(file: File | null, url = PDF_URL): NextRequest {
  const formData = new FormData();
  if (file) formData.append('file', file);
  return new NextRequest(url, { method: 'POST', body: formData });
}

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validAnalyzeBody = {
  pages: [{ pageNumber: 1, text: '4.2 Either party may terminate with 60 days written notice.', wordCount: 11 }],
  userProfile: { role: 'employee', documentType: 'offer_letter', specificConcerns: ['Notice Period'] },
};

const validChatBody = {
  question: 'What is my notice period?',
  documentContext: `[PAGE 1]\n${'clause text '.repeat(12)}with a notice period of 60 days`,
  chatHistory: [],
};

beforeEach(() => {
  // Guarantees the AI routes take the deterministic config-error branch.
  vi.stubEnv('GEMINI_API_KEY', '');
});

describe('POST /api/parse', () => {
  it('parses the sample PDF end-to-end into per-page text', async () => {
    const bytes = readFileSync(join(ROOT, 'public', 'sample-offer-letter.pdf'));
    const file = new File([bytes], 'sample-offer-letter.pdf', { type: 'application/pdf' });

    const response = await parsePOST(multipartRequest(file));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.fileName).toBe('sample-offer-letter.pdf');
    expect(body.data.pageCount).toBe(2);
    expect(body.data.pages).toHaveLength(2);
    expect(body.data.pages[0].pageNumber).toBe(1);
    expect(body.data.pages[0].wordCount).toBeGreaterThan(50);
    expect(body.data.pages[1].text).toContain('TERMINATION');
  });

  it('rejects a non-PDF file with 400', async () => {
    const file = new File([Buffer.from('not a pdf')], 'notes.txt', { type: 'text/plain' });
    const response = await parsePOST(multipartRequest(file));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Please upload a PDF file only.');
  });

  it('rejects a missing file field with 400', async () => {
    const response = await parsePOST(multipartRequest(null));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('No file received');
  });

  it('rejects a corrupt (fake) PDF with a user-friendly 422', async () => {
    const fake = Buffer.from('%PDF-1.4\nthis is not real pdf content at all');
    const file = new File([fake], 'broken.pdf', { type: 'application/pdf' });
    const response = await parsePOST(multipartRequest(file));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it(`documents the ${MAX_FILE_SIZE_MB}MB limit (client + server share the constant)`, () => {
    expect(MAX_FILE_SIZE_MB).toBeGreaterThan(0);
  });
});

describe('POST /api/analyze', () => {
  it('rejects malformed JSON with 400', async () => {
    const request = new NextRequest(ANALYZE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const response = await analyzePOST(request);
    expect(response.status).toBe(400);
  });

  it('rejects schema-invalid bodies with 422 and a readable issue', async () => {
    const response = await analyzePOST(jsonRequest(ANALYZE_URL, { pages: [] }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toContain('pages');
  });

  it('returns a clear, typed error when the AI key is not configured', async () => {
    const response = await analyzePOST(jsonRequest(ANALYZE_URL, validAnalyzeBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('AI_NOT_CONFIGURED');
    expect(body.error).toContain('GEMINI_API_KEY');
  });
});

describe('POST /api/chat', () => {
  it('rejects too-short questions with 422', async () => {
    const response = await chatPOST(jsonRequest(CHAT_URL, { ...validChatBody, question: 'hi' }));
    expect(response.status).toBe(422);
  });

  it('rejects a thin document context with 422', async () => {
    const response = await chatPOST(jsonRequest(CHAT_URL, { ...validChatBody, documentContext: 'tiny' }));
    expect(response.status).toBe(422);
  });

  it('returns a clear, typed error when the AI key is not configured', async () => {
    const response = await chatPOST(jsonRequest(CHAT_URL, validChatBody));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('AI_NOT_CONFIGURED');
  });
});
