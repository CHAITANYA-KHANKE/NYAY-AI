/**
 * POST /api/chat — JSON { question, documentContext, chatHistory }
 * Grounded Q&A: answers ONLY from the document, with verified citations,
 * the "Information not available" fallback and a server-forced disclaimer.
 *
 * Errors: 400 bad JSON | 422 schema mismatch | 429 rate limited |
 * 500 not configured/unknown | 502 bad AI response | 504 AI timeout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/constants';
import { chatWithDocument, GeminiError, geminiErrorStatus } from '@/lib/gemini';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { chatRequestSchema, firstZodIssue } from '@/lib/validators';
import type { ApiResponse, ChatResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = checkRateLimit(
    getClientKey(request, 'chat'),
    RATE_LIMITS.chat.limit,
    RATE_LIMITS.chat.windowMs,
  );
  if (!rate.allowed) {
    return respond(
      {
        success: false,
        error: `Too many questions. Please wait ${rate.retryAfterSeconds} seconds and try again.`,
        code: 'RATE_LIMITED',
      },
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(
      { success: false, error: 'Request body must be valid JSON.', code: 'BAD_JSON' },
      400,
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return respond({ success: false, error: firstZodIssue(parsed.error), code: 'VALIDATION' }, 422);
  }

  try {
    const { question, documentContext, chatHistory } = parsed.data;
    const result = await chatWithDocument(question, documentContext, chatHistory);
    return respond<ChatResponse>({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      const status = geminiErrorStatus(error);
      return respond({ success: false, error: error.message, code: error.code }, status);
    }
    console.error('[api/chat] unexpected error', error);
    return respond(
      { success: false, error: 'Something went wrong while answering. Please retry.', code: 'INTERNAL' },
      500,
    );
  }
}
