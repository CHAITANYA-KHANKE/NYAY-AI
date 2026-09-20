/**
 * tests/secrets-scan.test.ts — Repository secret scanner (brain/10 rule S1).
 * Fails the build if anything resembling a real API key / private key
 * is committed, and verifies env files are properly git-ignored.
 * Runs locally via `npm run test` and in CI on every push.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', 'out', 'dist', 'public']);
const EXCLUDED_FILES = new Set(['package-lock.json']);
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.css']);
const MAX_FILE_BYTES = 1_000_000;

/** Well-known credential formats. */
const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Google/Gemini API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'OpenAI-style key', regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'GitHub personal access token', regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub fine-grained token', regex: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Slack token', regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'PEM private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function collectFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry) && !entry.startsWith('.')) found.push(...collectFiles(fullPath));
      continue;
    }
    const extension = entry.includes('.') ? `.${entry.split('.').pop()?.toLowerCase()}` : '';
    if (EXCLUDED_FILES.has(entry) || !SCANNED_EXTENSIONS.has(extension)) continue;
    if (stats.size > MAX_FILE_BYTES || stats.size === 0) continue;
    found.push(fullPath);
  }
  return found;
}

describe('repository secret scan (S1)', () => {
  it('finds no hardcoded credentials in tracked source files', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(ROOT)) {
      const content = readFileSync(file, 'utf8');
      for (const { name, regex } of SECRET_PATTERNS) {
        if (regex.test(content)) offenders.push(`${file} -> ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is never present in a clean checkout (CI gate)', () => {
    // Locally .env.local may exist (developer's own key) — it is git-ignored
    // and excluded from every scan. In CI it must never exist, which proves
    // no real env file was committed.
    if (process.env.CI) {
      expect(existsSync(join(ROOT, '.env.local'))).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it('git-ignores every local env variant', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.env.local');
    expect(gitignore).toContain('.env*.local');
  });

  it('ships only placeholder values in env.template', () => {
    const example = readFileSync(join(ROOT, 'env.template'), 'utf8');
    expect(example).toContain('your_gemini_api_key_here');
    for (const { regex } of SECRET_PATTERNS) {
      expect(regex.test(example)).toBe(false);
    }
  });

  it('reads the Gemini key exclusively from process.env', () => {
    const gemini = readFileSync(join(ROOT, 'lib', 'gemini.ts'), 'utf8');
    expect(gemini).toContain('process.env.GEMINI_API_KEY');
    for (const { regex } of SECRET_PATTERNS) {
      expect(regex.test(gemini)).toBe(false);
    }
  });
});
