/**
 * lib/cache.ts — Bounded, in-memory TTL+LRU cache and fast hash utilities.
 *
 * Designed to work across Node.js and Edge runtimes without node:crypto.
 * Used for AI analysis memoization and normalized document search caching.
 */

/**
 * FNV-1a 32-bit hash run twice with different initial offsets to produce
 * a deterministic 16-character hexadecimal hash string.
 */
export function hashKey(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const len = value.length;

  for (let i = 0; i < len; i += 1) {
    const code = value.charCodeAt(i);
    // Lower byte
    h1 ^= code & 0xff;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    // Upper byte (handles full UTF-16 code units)
    h1 ^= (code >> 8) & 0xff;
    h1 = Math.imul(h1, 0x01000193) >>> 0;

    h2 ^= code & 0xff;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
    h2 ^= (code >> 8) & 0xff;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return hex1 + hex2;
}

interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  expirations: number;
}

/**
 * Map-based LRU cache with TTL expiration and collision detection.
 * Map naturally maintains insertion order; re-inserting on access
 * implements O(1) LRU updates without extra linked-list overhead.
 */
export class TtlCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(
    public readonly maxEntries: number,
    public readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    const currentTime = this.now();
    if (entry.expiresAt <= currentTime) {
      this.map.delete(key);
      this.expirations += 1;
      this.misses += 1;
      return undefined;
    }

    // Full key comparison guard against potential hash collisions
    if (entry.key !== key) {
      this.misses += 1;
      return undefined;
    }

    // Refresh recency for LRU
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.ttlMs): void {
    if (this.maxEntries <= 0) return;
    const currentTime = this.now();

    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
        this.evictions += 1;
      }
    }

    this.map.set(key, {
      key,
      value,
      expiresAt: currentTime + ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  prune(now: number = this.now()): number {
    let pruned = 0;
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
        this.expirations += 1;
        pruned += 1;
      }
    }
    return pruned;
  }

  get size(): number {
    return this.map.size;
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.map.size,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }
}
