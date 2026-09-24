import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords, extractPages, PdfParseError } from '../lib/pdf-parser';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('lib/pdf-parser', () => {
  describe('countWords', () => {
    it('handles empty and whitespace-only strings', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   \n\t  ')).toBe(0);
    });

    it('counts words accurately across whitespace boundaries', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('  hello   world  \n next  line  ')).toBe(4);
    });
  });

  describe('PdfParseError', () => {
    it('sets correct properties', () => {
      const err = new PdfParseError('test error', 'INVALID_PDF', 422);
      expect(err.name).toBe('PdfParseError');
      expect(err.message).toBe('test error');
      expect(err.code).toBe('INVALID_PDF');
      expect(err.statusCode).toBe(422);
    });
  });

  describe('extractPages validation', () => {
    it('rejects empty buffer', async () => {
      await expect(extractPages(Buffer.alloc(0))).rejects.toThrow('This PDF appears to be empty.');
    });

    it('rejects invalid magic header', async () => {
      await expect(extractPages(Buffer.from('NOT A PDF'))).rejects.toThrow('Unable to read this PDF.');
    });

    it('parses real sample PDF buffer', async () => {
      const bytes = readFileSync(join(ROOT, 'public', 'sample-offer-letter.pdf'));
      const pages = await extractPages(Buffer.from(bytes));
      expect(pages.length).toBeGreaterThanOrEqual(1);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].wordCount).toBeGreaterThan(10);
      expect(pages[0].text).toContain('OFFER');
    });

    it('rejects fake/corrupt PDF header content', async () => {
      const fakePdf = Buffer.from('%PDF-1.4\ncorrupt gibberish not a real pdf');
      await expect(extractPages(fakePdf)).rejects.toThrow('Unable to read this PDF.');
    });
  });
});
