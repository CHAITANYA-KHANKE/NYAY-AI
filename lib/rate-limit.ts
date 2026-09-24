/**
 * lib/rate-limit.ts — In-memory sliding-window rate limiter (brain/10 S4).
 *
 * Suitable for a single-instance deployment (Vercel serverless keeps one
 * warm instance per region; swap for Upstash Redis for strict guarantees).
 */

import type { NextRequest } from 'next/server';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 30_000;
const MAX_BUCKETS = 5_000;

function sweepIfDue(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function evictOldest(): void {
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepIfDue(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (existing) buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    evictOldest();
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/** Rate-limit key: route name + client IP (first x-forwarded-for hop). */
export function getClientKey(request: NextRequest, route: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]?.trim() ?? 'unknown'
    : (request as unknown as { ip?: string }).ip ?? 'local';
  return `${route}:${ip}`;
}

export function rateLimiterSize(): number {
  return buckets.size;
}

export function clearRateLimiter(): void {
  buckets.clear();
  lastSweep = 0;
}
