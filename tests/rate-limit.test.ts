/**
 * tests/rate-limit.test.ts — Rate limiter behaviour (brain/10 rule S4).
 * Uses fake timers so the sliding-window logic is tested deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '../lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit, then blocks', () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);

    const blocked = checkRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the allowance after the window passes', () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true);
  });

  it('tracks different keys independently', () => {
    const keyA = `test:${Math.random()}`;
    const keyB = `test:${Math.random()}`;
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  it('reports the remaining allowance', () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0);
  });
});
