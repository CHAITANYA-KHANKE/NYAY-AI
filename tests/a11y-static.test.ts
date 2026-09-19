/**
 * tests/a11y-static.test.ts — Accessibility guarantees (WCAG 2.1 AA,
 * brain/08). Static assertions that keep the a11y contract from
 * regressing: landmarks, skip link, aria labels on icon-only controls,
 * non-color risk affordances and reduced-motion support.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string): string => readFileSync(join(ROOT, relativePath), 'utf8');

describe('landmarks and document structure', () => {
  it('declares the document language', () => {
    expect(read('app/layout.tsx')).toContain('lang="en"');
  });

  it('ships a skip-to-content link targeting #main-content', () => {
    expect(read('app/layout.tsx')).toContain('Skip to content');
    expect(read('app/layout.tsx')).toContain('#main-content');
  });

  it('marks primary landmarks on both pages', () => {
    expect(read('app/page.tsx')).toContain('id="main-content"');
    expect(read('app/dashboard/page.tsx')).toContain('id="main-content"');
    expect(read('components/Navbar.tsx')).toContain('aria-label="Main navigation"');
  });
});

describe('icon-only controls are labelled', () => {
  const filesWithIconButtons = [
    'components/FileUploader.tsx',
    'components/ChatInterface.tsx',
    'components/PDFViewer.tsx',
    'components/ClauseCard.tsx',
    'app/dashboard/page.tsx',
  ];

  it.each(filesWithIconButtons)('%s exposes aria-labels', (file) => {
    const source = read(file);
    const ariaCount = (source.match(/aria-label/g) ?? []).length;
    expect(ariaCount).toBeGreaterThanOrEqual(2);
  });
});

describe('risk communication never relies on color alone', () => {
  it('pairs every risk level with a distinct icon and text label', () => {
    const source = read('components/RiskBadge.tsx');
    for (const level of ['HIGH', 'MEDIUM', 'LOW']) {
      expect(source).toContain(level);
    }
    for (const icon of ['AlertTriangle', 'AlertCircle', 'CheckCircle']) {
      expect(source).toContain(icon);
    }
    expect(source).toContain('aria-label={`Risk level: ${level}`}');
  });
});

describe('live regions and motion', () => {
  it('announces chat and status updates politely', () => {
    expect(read('components/ChatInterface.tsx')).toContain('aria-live="polite"');
    expect(read('app/page.tsx')).toContain('aria-live="polite"');
  });

  it('respects prefers-reduced-motion', () => {
    expect(read('app/globals.css')).toContain('prefers-reduced-motion');
  });

  it('keeps visible focus styling', () => {
    expect(read('app/globals.css')).toContain(':focus-visible');
  });
});
