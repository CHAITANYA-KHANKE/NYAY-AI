/**
 * tests/cache.test.ts — Unit tests for lib/cache.ts (hashKey + TtlCache).
 */

import { describe, expect, it, vi } from 'vitest';
import { hashKey, TtlCache } from '../lib/cache';

describe('hashKey', () => {
  it('is deterministic for the same input', () => {
    const input = 'sample-document-content-for-testing';
    expect(hashKey(input)).toBe(hashKey(input));
    expect(hashKey(input)).toHaveLength(16);
  });

  it('generates distinct hashes for distinct inputs', () => {
    const hash1 = hashKey('Notice Period: 60 days');
    const hash2 = hashKey('Notice Period: 90 days');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty and unicode strings cleanly', () => {
    expect(hashKey('')).toHaveLength(16);
    expect(hashKey('न्याय AI · Legal Document Intelligence')).toHaveLength(16);
  });
});

describe('TtlCache', () => {
  it('stores and retrieves values within TTL', () => {
    const cache = new TtlCache<string>(10, 5_000);
    cache.set('k1', 'v1');
    expect(cache.get('k1')).toBe('v1');
    expect(cache.size).toBe(1);
  });

  it('expires entries after TTL elapses', () => {
    let now = 1_000;
    const cache = new TtlCache<string>(10, 500, () => now);

    cache.set('k1', 'v1');
    expect(cache.get('k1')).toBe('v1');

    now = 1_600; // 600ms later (>500ms TTL)
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.size).toBe(0);

    const stats = cache.stats();
    expect(stats.expirations).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('evicts oldest entries when reaching maxEntries (LRU order)', () => {
    const cache = new TtlCache<number>(3, 10_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to refresh recency
    expect(cache.get('a')).toBe(1);

    // Add 'd' -> should evict 'b' (oldest unaccessed entry)
    cache.set('d', 4);

    expect(cache.size).toBe(3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.stats().evictions).toBe(1);
  });

  it('guards against key mismatch on collision', () => {
    const cache = new TtlCache<string>(5, 10_000);
    cache.set('key-A', 'value-A');

    // Manipulate internal map to simulate same hash slot but different stored key
    // @ts-expect-error accessing private map for collision test
    cache.map.set('key-B', { key: 'key-A', value: 'value-A', expiresAt: Date.now() + 10_000 });

    expect(cache.get('key-B')).toBeUndefined();
  });

  it('prunes expired entries proactively', () => {
    let now = 100;
    const cache = new TtlCache<string>(10, 200, () => now);
    cache.set('k1', 'v1');
    cache.set('k2', 'v2', 500); // longer TTL

    now = 350; // k1 expired, k2 valid
    const pruned = cache.prune();
    expect(pruned).toBe(1);
    expect(cache.size).toBe(1);
    expect(cache.get('k2')).toBe('v2');
  });

  it('supports delete and clear operations', () => {
    const cache = new TtlCache<string>(5, 10_000);
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');

    expect(cache.delete('k1')).toBe(true);
    expect(cache.delete('non-existent')).toBe(false);
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('accurately tracks hits, misses, and stats', () => {
    const cache = new TtlCache<string>(5, 10_000);
    cache.set('k1', 'v1');

    cache.get('k1'); // hit 1
    cache.get('k1'); // hit 2
    cache.get('k2'); // miss 1

    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });
});
