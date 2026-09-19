/**
 * POST /api/parse — multipart/form-data { file: File }
 * Validates the upload (S2/S3), extracts per-page text with pdf-parse
 * and returns { success, data: { pageCount, pages, fileName } }.
 *
 * Errors: 400 no/wrong file | 413 too large | 422 unprocessable PDF |
 * 429 rate limited | 500 unexpected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/constants';
import { extractPages, PdfParseError } from '@/lib/pdf-parser';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { validateFileUpload } from '@/lib/validators';
import type { ApiResponse, ParseResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond<T>(body: ApiResponse<T>, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = checkRateLimit(
    getClientKey(request, 'parse'),
    RATE_LIMITS.parse.limit,
    RATE_LIMITS.parse.windowMs,
  );
  if (!rate.allowed) {
    return respond(
      {
        success: false,
        error: `Too many uploads. Please wait ${rate.retryAfterSeconds} seconds and try again.`,
        code: 'RATE_LIMITED',
      },
      429,
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const candidate = formData.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return respond(
      { success: false, error: 'Could not read the uploaded file. Please try again.', code: 'BAD_FORM_DATA' },
      400,
    );
  }

  if (!file) {
    return respond(
      {
        success: false,
        error: 'No file received. Attach a PDF using the form field named "file".',
        code: 'FILE_MISSING',
      },
      400,
    );
  }

  const verdict = validateFileUpload(file);
  if (!verdict.valid) {
    return respond({ success: false, error: verdict.error, code: 'FILE_INVALID' }, verdict.status);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pages = await extractPages(buffer);
    return respond<ParseResponse>(
      { success: true, data: { pageCount: pages.length, pages, fileName: file.name } },
      200,
    );
  } catch (error) {
    if (error instanceof PdfParseError) {
      return respond({ success: false, error: error.message, code: error.code }, error.statusCode);
    }
    console.error('[api/parse] unexpected error', error);
    return respond(
      { success: false, error: 'Something went wrong while parsing your PDF. Please try again.', code: 'INTERNAL' },
      500,
    );
  }
}
