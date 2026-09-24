/**
 * tests/rate-limit.test.ts — Rate limiter behaviour (brain/10 rule S4).
 * Uses fake timers so the sliding-window logic is tested deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, clearRateLimiter, rateLimiterSize } from '../lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    clearRateLimiter();
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

  it('flooding 5_050 keys keeps size <= 5_000', () => {
    for (let i = 0; i < 5_050; i += 1) {
      checkRateLimit(`flood-key-${i}`, 10, 60_000);
    }
    expect(rateLimiterSize()).toBeLessThanOrEqual(5_000);
  });

  it('reclaims expired buckets after the 30s sweep interval', () => {
    const key = 'sweep-test-key';
    checkRateLimit(key, 5, 10_000); // expires at t + 10s
    expect(rateLimiterSize()).toBe(1);

    // Advance 15s (expired, but sweep interval of 30s not reached yet)
    vi.advanceTimersByTime(15_000);
    expect(rateLimiterSize()).toBe(1);

    // Advance past 30s and trigger another request to trigger sweep
    vi.advanceTimersByTime(16_000);
    checkRateLimit('new-key', 5, 60_000);

    // The old expired bucket should have been swept
    expect(rateLimiterSize()).toBe(1);
  });
});
