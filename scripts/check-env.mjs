#!/usr/bin/env node
/**
 * scripts/check-env.mjs — Runtime environment verification.
 * Mirrors the check:runtime-env gate: validates that required/optional
 * env vars are present AND well-formed before the app starts.
 *
 * Exit 1 = invalid configuration (blocks startup).
 * Exit 0 = valid (warnings may be printed, e.g. missing AI key in CI).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Parse .env.local (if present) without extra dependencies. */
function loadEnvFile() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (match && !line.trim().startsWith('#')) {
      vars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return vars;
}

const fileEnv = loadEnvFile();
const get = (key) => (process.env[key] ?? fileEnv[key] ?? '').trim();

let errors = 0;
const fail = (msg) => {
  errors += 1;
  console.error(`  ✗ ${msg}`);
};
const warn = (msg) => console.warn(`  ! ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);

console.log('NyayAI environment check');

/* GEMINI_API_KEY — required at runtime for AI features.
   Missing is a warning (CI/evaluator may not have one), but a
   PLACEHOLDER value is an error because it looks configured. */
const apiKey = get('GEMINI_API_KEY');
if (!apiKey) {
  warn('GEMINI_API_KEY is not set — /api/analyze and /api/chat will return a clear configuration error.');
} else if (/your_gemini_api_key_here/i.test(apiKey)) {
  fail('GEMINI_API_KEY still contains the placeholder from .env.local.example — paste a real key.');
} else if (apiKey.length < 20) {
  fail(`GEMINI_API_KEY looks too short (${apiKey.length} chars) — check for truncation.`);
} else {
  ok('GEMINI_API_KEY is set (hidden)');
}

/* NEXT_PUBLIC numeric limits must be positive integers when set. */
for (const [key, fallback] of [
  ['NEXT_PUBLIC_MAX_FILE_SIZE_MB', '20'],
  ['NEXT_PUBLIC_MAX_PAGES', '50'],
]) {
  const value = get(key) || fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    fail(`${key}="${value}" is not a positive integer.`);
  } else {
    ok(`${key}=${parsed}`);
  }
}

/* A leaked .env.local must never be committed — .gitignore must cover it. */
const gitignore = existsSync(join(ROOT, '.gitignore'))
  ? readFileSync(join(ROOT, '.gitignore'), 'utf8')
  : '';
if (gitignore.includes('.env*.local')) {
  ok('.env*.local is git-ignored');
} else {
  fail('.gitignore is missing the .env*.local rule — secrets could be committed.');
}

if (errors > 0) {
  console.error(`\n${errors} environment problem(s) found. Fix them before starting the app.\n`);
  process.exit(1);
}
console.log('\nEnvironment configuration is valid.\n');
