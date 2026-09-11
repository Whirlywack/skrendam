import { describe, expect, test, vi } from 'vitest';
import { refCode } from '@/lib/refcode';

// The pure helpers under test never touch the DB; `@/db` is mocked only so
// importing the module does not construct a neon client (which throws without
// DATABASE_URL in the test environment).
vi.mock('@/db', () => ({ db: {} }));

import { needsDedupe, parseDealId, parseTracking, shouldInsert } from '@/lib/events';

const sp = (q: string) => new URLSearchParams(q);

describe('parseTracking', () => {
  test('both present and valid', () => {
    expect(parseTracking(sp(`i=12&s=${refCode(7)}`))).toEqual({ issueId: 12, subscriberId: 7 });
  });

  test('both missing → nulls', () => {
    expect(parseTracking(sp(''))).toEqual({ issueId: null, subscriberId: null });
  });

  test('bad s (checksum mismatch, wrong shape, empty) → null subscriber', () => {
    const good = refCode(7);
    const tampered = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    expect(parseTracking(sp(`i=3&s=${tampered}`))).toEqual({ issueId: 3, subscriberId: null });
    expect(parseTracking(sp('s=ABC-DEF')).subscriberId).toBeNull();
    expect(parseTracking(sp('s=')).subscriberId).toBeNull();
  });

  test('s decoding to id 0 is not a subscriber', () => {
    // refCode(0) === '00' round-trips, but serial ids start at 1.
    expect(parseTracking(sp(`s=${refCode(0)}`)).subscriberId).toBeNull();
  });

  test('bad i (non-numeric, negative, zero, float, huge) → null issue', () => {
    for (const bad of ['abc', '-1', '0', '1.5', '12abc', '', '99999999999999999999']) {
      expect(parseTracking(sp(`i=${bad}`)).issueId, `i=${bad}`).toBeNull();
    }
  });

  test('i is parsed as an integer without leading junk', () => {
    expect(parseTracking(sp('i=042')).issueId).toBe(42);
  });
});

describe('parseDealId', () => {
  test('accepts a positive integer path segment', () => {
    expect(parseDealId('187')).toBe(187);
  });
  test('rejects non-numeric, zero, negative, float, oversized, null', () => {
    for (const bad of ['abc', '0', '-3', '1.0', '1e3', '1234567890123', '', null, undefined]) {
      expect(parseDealId(bad), String(bad)).toBeNull();
    }
  });
});

describe('booked_claim dedupe decision', () => {
  test('a claim from a known subscriber needs the prior-existence check', () => {
    expect(needsDedupe({ kind: 'booked_claim', subscriberId: 7 })).toBe(true);
  });

  test('an anonymous claim (no valid s) is recorded without dedupe', () => {
    expect(needsDedupe({ kind: 'booked_claim', subscriberId: null })).toBe(false);
    expect(shouldInsert({ kind: 'booked_claim', subscriberId: null }, true)).toBe(true);
  });

  test('clicks are never deduped, even from a known subscriber', () => {
    expect(needsDedupe({ kind: 'click', subscriberId: 7 })).toBe(false);
    expect(shouldInsert({ kind: 'click', subscriberId: 7 }, true)).toBe(true);
  });

  test('a second claim from the same subscriber for the same deal is skipped', () => {
    expect(shouldInsert({ kind: 'booked_claim', subscriberId: 7 }, true)).toBe(false);
    expect(shouldInsert({ kind: 'booked_claim', subscriberId: 7 }, false)).toBe(true);
  });
});

describe('price_changed dedupe decision (WP9)', () => {
  test('a price report from a known subscriber is one per (deal, subscriber)', () => {
    expect(needsDedupe({ kind: 'price_changed', subscriberId: 7 })).toBe(true);
    expect(shouldInsert({ kind: 'price_changed', subscriberId: 7 }, true)).toBe(false);
    expect(shouldInsert({ kind: 'price_changed', subscriberId: 7 }, false)).toBe(true);
  });

  test('an anonymous price report is recorded every time', () => {
    expect(needsDedupe({ kind: 'price_changed', subscriberId: null })).toBe(false);
    expect(shouldInsert({ kind: 'price_changed', subscriberId: null }, true)).toBe(true);
  });
});
