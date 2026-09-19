/**
 * POST /api/analyze — JSON { pages, userProfile }
 * Zod-validates the body, runs grounded Gemini analysis, post-processes
 * citations (brain/09) and returns { success, data: AnalysisResult }.
 *
 * Errors: 400 bad JSON | 422 schema mismatch | 429 rate limited |
 * 500 not configured/unknown | 502 bad AI response | 504 AI timeout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/constants';
import { analyzeDocument, GeminiError, geminiErrorStatus } from '@/lib/gemini';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { analyzeRequestSchema, firstZodIssue } from '@/lib/validators';
import type { AnalysisResult, ApiResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = checkRateLimit(
    getClientKey(request, 'analyze'),
    RATE_LIMITS.analyze.limit,
    RATE_LIMITS.analyze.windowMs,
  );
  if (!rate.allowed) {
    return respond(
      {
        success: false,
        error: `Too many analysis requests. Please wait ${rate.retryAfterSeconds} seconds and try again.`,
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

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return respond({ success: false, error: firstZodIssue(parsed.error), code: 'VALIDATION' }, 422);
  }

  try {
    const result = await analyzeDocument(parsed.data.pages, parsed.data.userProfile);
    return respond<AnalysisResult>({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      const status = geminiErrorStatus(error);
      return respond({ success: false, error: error.message, code: error.code }, status);
    }
    console.error('[api/analyze] unexpected error', error);
    return respond(
      { success: false, error: 'Something went wrong during analysis. Please retry.', code: 'INTERNAL' },
      500,
    );
  }
}
