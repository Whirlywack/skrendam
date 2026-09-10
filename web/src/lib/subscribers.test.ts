import { describe, expect, it, vi } from 'vitest';

// `activeSubscribers` needs a live Neon connection; the pure helpers must be
// testable without one, so the db module is replaced before import.
vi.mock('@/db', () => ({ db: {}, subscribers: {} }));

import { momentCodes, sendable, wantsOrigin, type Recipient } from './subscribers';
import { referralCounts } from './subscribers-queries';
import { refCode } from './refcode';

function recipient(over: Partial<Recipient> = {}): Recipient {
  return { id: 1, email: 'a@b.lt', plan: 'paid', prefs: null, unsubscribeToken: 'tok', ...over };
}

describe('wantsOrigin', () => {
  it('is true when prefs are null (no origin preference recorded)', () => {
    expect(wantsOrigin(recipient({ prefs: null }), 'VNO')).toBe(true);
  });
  it('is true when origins is an empty list', () => {
    expect(wantsOrigin(recipient({ prefs: { origins: [] } }), 'VNO')).toBe(true);
  });
  it('is true when origins is absent from prefs', () => {
    expect(wantsOrigin(recipient({ prefs: { utm: { source: 'tiktok' } } }), 'VNO')).toBe(true);
  });
  it('matches only the listed origins otherwise', () => {
    const r = recipient({ prefs: { origins: ['VNO'] } });
    expect(wantsOrigin(r, 'VNO')).toBe(true);
    expect(wantsOrigin(r, 'KUN')).toBe(false);
  });
  it('treats a malformed origins value as no preference', () => {
    expect(wantsOrigin(recipient({ prefs: { origins: 'VNO' } }), 'KUN')).toBe(true);
  });
});

describe('momentCodes', () => {
  it('returns [] when prefs are null or moments is absent', () => {
    expect(momentCodes(recipient({ prefs: null }))).toEqual([]);
    expect(momentCodes(recipient({ prefs: {} }))).toEqual([]);
  });
  it('returns the stored moment codes', () => {
    expect(momentCodes(recipient({ prefs: { moments: ['family', 'sun'] } }))).toEqual(['family', 'sun']);
  });
  it('drops non-string entries from a malformed list', () => {
    expect(momentCodes(recipient({ prefs: { moments: ['family', 3, null] } }))).toEqual(['family']);
  });
});

describe('sendable', () => {
  it('is false for a null unsubscribe token (no mail without an unsubscribe link)', () => {
    expect(sendable(recipient({ unsubscribeToken: null }))).toBe(false);
  });
  it('is false for a missing email', () => {
    expect(sendable(recipient({ email: '' }))).toBe(false);
  });
  it('is true when both are present', () => {
    expect(sendable(recipient())).toBe(true);
  });
});

describe('referralCounts', () => {
  it('counts rows per referred_by code', () => {
    const a = refCode(1);
    const b = refCode(2);
    const counts = referralCounts([
      { prefs: { referred_by: a } },
      { prefs: { referred_by: a } },
      { prefs: { referred_by: b } },
    ]);
    expect(counts.get(a)).toBe(2);
    expect(counts.get(b)).toBe(1);
    expect(counts.size).toBe(2);
  });
  it('is empty when no row carries a referral', () => {
    expect(referralCounts([]).size).toBe(0);
    expect(referralCounts([{ prefs: null }, { prefs: {} }]).size).toBe(0);
  });
  it('ignores null prefs and non-string referred_by values', () => {
    const a = refCode(1);
    const counts = referralCounts([
      { prefs: null },
      { prefs: { referred_by: 7 } },
      { prefs: { referred_by: '' } },
      { prefs: 'garbage' },
      { prefs: { referred_by: a } },
    ]);
    expect([...counts.entries()]).toEqual([[a, 1]]);
  });
});
