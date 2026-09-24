/**
 * lib/pdf-parser.ts — Server-side PDF text extraction (brain/06).
 *
 * Uses pdf-parse with a custom `pagerender` that appends a form-feed (\f)
 * after every page. This makes page splitting deterministic, which is what
 * makes exact "Page Z" citations possible (brain/00 rule R2).
 *
 * The deep import `pdf-parse/lib/pdf-parse.js` is required — the package
 * root performs a debug fs read that crashes serverless bundles (ADR-006).
 */

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { MAX_PAGES } from './constants';
import { countWords } from './context';
import type { ParsedPage } from './types';

// Re-export countWords for backwards compatibility
export { countWords } from './context';

export class PdfParseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EMPTY_FILE'
      | 'INVALID_PDF'
      | 'PASSWORD_PROTECTED'
      | 'CORRUPT_PDF'
      | 'NO_TEXT'
      | 'TOO_MANY_PAGES',
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PdfParseError';
  }
}

/** Minimal structural view of a pdf.js page (avoids `any`, brain/14). */
interface PdfTextItem {
  str: string;
  transform: number[];
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPageData {
  getTextContent(options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<PdfTextContent>;
}

/**
 * Default pdf-parse page renderer + a trailing form-feed so the final
 * text cleanly splits into pages with `text.split('\f')`.
 */
async function renderPageWithFormFeed(pageData: unknown): Promise<string> {
  const page = pageData as PdfPageData;
  const textContent = await page.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });

  let lastY: number | undefined;
  let text = '';
  for (const item of textContent.items) {
    if (lastY === undefined || lastY === item.transform[5]) {
      text += item.str;
    } else {
      text += `\n${item.str}`;
    }
    lastY = item.transform[5];
  }
  return `${text}\f`;
}

/**
 * Extract per-page text from a PDF buffer.
 * Throws PdfParseError with a user-friendly message on every edge case
 * listed in brain/06_SCRAPING_SPEC.md.
 */
export async function extractPages(buffer: Buffer): Promise<ParsedPage[]> {
  if (!buffer || buffer.length === 0) {
    throw new PdfParseError('This PDF appears to be empty.', 'EMPTY_FILE', 422);
  }

  // S3 — magic-byte check before doing any real work.
  const header = buffer.subarray(0, 5).toString('latin1');
  if (!header.startsWith('%PDF')) {
    throw new PdfParseError(
      'Unable to read this PDF. The file may be corrupt or not a real PDF.',
      'INVALID_PDF',
      422,
    );
  }

  let rawText: string;
  try {
    const result = await pdfParse(buffer, {
      pagerender: renderPageWithFormFeed,
      max: MAX_PAGES + 1,
    });
    rawText = result.text ?? '';
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('password') || message.includes('encrypted')) {
      throw new PdfParseError(
        'This PDF is password-protected. Please remove the password and try again.',
        'PASSWORD_PROTECTED',
        422,
      );
    }
    throw new PdfParseError(
      'Unable to read this PDF. The file may be corrupt.',
      'CORRUPT_PDF',
      422,
    );
  }

  if (!rawText.trim()) {
    throw new PdfParseError(
      'No extractable text found. Scanned PDFs (image-only) are not supported yet.',
      'NO_TEXT',
      422,
    );
  }

  const pages: ParsedPage[] = [];
  for (const rawPage of rawText.split('\f')) {
    const text = rawPage.replace(/[ \t]+\n/g, '\n').trim();
    if (text.length === 0) continue; // skip blank/trailing form-feed pages
    pages.push({
      pageNumber: pages.length + 1,
      text,
      wordCount: countWords(text),
    });
  }

  if (pages.length === 0) {
    throw new PdfParseError(
      'No extractable text found. Scanned PDFs (image-only) are not supported yet.',
      'NO_TEXT',
      422,
    );
  }

  if (pages.length > MAX_PAGES) {
    throw new PdfParseError(
      `This PDF has ${pages.length} pages. NyayAI currently supports up to ${MAX_PAGES} pages.`,
      'TOO_MANY_PAGES',
      422,
    );
  }

  return pages;
}
