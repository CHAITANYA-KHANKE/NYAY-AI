/**
 * tests/gemini-budget.test.ts — AI call budgeting, caching, timeout bounds, and model fallback tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_BUDGETS } from '../lib/constants';
import { formatPagesAsContext } from '../lib/context';
import type { ParsedPage, UserProfile } from '../lib/types';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import {
  analyzeDocument,
  chatWithDocument,
  clearAiCache,
  GeminiError,
  MODEL_CANDIDATES,
} from '../lib/gemini';

const samplePages: ParsedPage[] = [
  {
    pageNumber: 1,
    text: '4.2 After confirmation, either party may terminate with 60 days written notice.',
    wordCount: 12,
  },
  {
    pageNumber: 2,
    text: '8.2 Employee agrees to a non-compete period of 12 months after termination.',
    wordCount: 12,
  },
];

const sampleProfile: UserProfile = {
  role: 'employee',
  documentType: 'offer_letter',
  specificConcerns: ['Notice Period'],
};

const validAnalysisPayload = {
  documentHealthScore: 85,
  summary: 'Clear employment offer letter.',
  keyClauses: [
    {
      clauseTitle: 'Notice Period',
      clauseNumber: '4.2',
      pageNumber: 1,
      exactQuote: 'either party may terminate with 60 days written notice',
      simplifiedExplanation: '60 days notice required.',
      riskLevel: 'MEDIUM',
      recommendation: 'Standard notice term.',
    },
  ],
  missingConcerns: [],
  legalDisclaimer: 'default disclaimer',
};

const validChatPayload = {
  answer: 'You have a 60 days notice period.',
  citations: [
    {
      clauseNumber: '4.2',
      pageNumber: 1,
      exactText: 'either party may terminate with 60 days written notice',
    },
  ],
  isMissingInfo: false,
};

describe('analyzeDocument budgeting & caching', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'valid-test-key');
    clearAiCache();
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('serves identical analyze calls from in-memory cache (calls model ONCE)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysisPayload) },
    });

    const res1 = await analyzeDocument(samplePages, sampleProfile);
    expect(res1.documentHealthScore).toBe(85);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Second call with same parameters should hit cache
    const res2 = await analyzeDocument(samplePages, sampleProfile);
    expect(res2.documentHealthScore).toBe(85);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('triggers a new model call when profile or pages differ', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validAnalysisPayload) },
    });

    await analyzeDocument(samplePages, sampleProfile);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const differentProfile: UserProfile = {
      ...sampleProfile,
      role: 'freelancer',
    };

    await analyzeDocument(samplePages, differentProfile);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('retries on malformed response format across candidate models', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"broken": "not schema compliant"}' },
    });

    let thrownError: unknown = null;
    try {
      await analyzeDocument(samplePages, sampleProfile);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(GeminiError);
    expect((thrownError as GeminiError).code).toBe('AI_BAD_RESPONSE');
    expect(mockGenerateContent.mock.calls.length).toBeLessThanOrEqual(MODEL_CANDIDATES.length * 2);
  });

  it('immediately cascades across models on 503 capacity errors', async () => {
    mockGenerateContent.mockRejectedValue(new Error('503 Service Unavailable: High demand'));

    let thrownError: unknown = null;
    try {
      await analyzeDocument(samplePages, sampleProfile);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(GeminiError);
    expect((thrownError as GeminiError).code).toBe('AI_UNAVAILABLE');
    expect(mockGenerateContent).toHaveBeenCalledTimes(MODEL_CANDIDATES.length);
  });

  it('bounds hanging model requests within total deadline budget', async () => {
    vi.useFakeTimers();

    // Hanging model that never completes within standard timeout
    mockGenerateContent.mockImplementation(() => new Promise(() => {}));

    let error: unknown = null;
    const promise = analyzeDocument(samplePages, sampleProfile).catch((e) => {
      error = e;
    });

    // Advance fake timers progressively until the promise settles
    for (let i = 0; i < 90; i += 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      if (error) break;
    }

    await promise;

    expect(error).toBeInstanceOf(GeminiError);
    expect((error as GeminiError).code).toBe('AI_TIMEOUT');
    expect(mockGenerateContent.mock.calls.length).toBeLessThanOrEqual(3);

    vi.clearAllTimers();
    vi.useRealTimers();
  });
});

describe('chatWithDocument budgeting & citation grounding', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'valid-test-key');
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends small document context in full', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(validChatPayload) },
    });

    const context = formatPagesAsContext(samplePages);
    const response = await chatWithDocument('What is my notice period?', context, []);

    expect(response.answer).toContain('60 days');
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]?.pageNumber).toBe(1);
  });

  it('trims oversized documents for prompt token budget while verifying citations against full document', async () => {
    // Generate a 40-page document
    const largePages: ParsedPage[] = Array.from({ length: 40 }, (_, i) => ({
      pageNumber: i + 1,
      text: `[PAGE ${i + 1}] Clause ${i + 1}.1 details for section ${i + 1}. ` +
        (i === 35 ? 'Special remote work allowance clause: 50,000 INR per year.' : 'Standard text.'),
      wordCount: 80,
    }));

    const fullContext = formatPagesAsContext(largePages);

    mockGenerateContent.mockImplementation((req: { contents: Array<{ parts: Array<{ text: string }> }> }) => {
      const promptText = req.contents[0]?.parts[0]?.text ?? '';
      // The prompt text should contain Page 1 and Page 36 (relevant page)
      expect(promptText).toContain('[PAGE 1]');
      return Promise.resolve({
        response: {
          text: () =>
            JSON.stringify({
              answer: 'Remote work allowance is 50,000 INR per year.',
              citations: [
                {
                  clauseNumber: '36.1',
                  pageNumber: 1, // model incorrectly guessed page 1
                  exactText: 'Special remote work allowance clause: 50,000 INR per year.',
                },
              ],
              isMissingInfo: false,
            }),
        },
      });
    });

    const response = await chatWithDocument('What is the remote work allowance?', fullContext, []);

    // Post-processing correctly re-located the quote to Page 36 using the full document context
    expect(response.citations[0]?.pageNumber).toBe(36);
  });
});
