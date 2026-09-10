import { describe, expect, it, vi } from 'vitest';

// `activeSubscribers` needs a live Neon connection; the pure helpers must be
// testable without one, so the db module is replaced before import.
vi.mock('@/db', () => ({ db: {}, subscribers: {} }));

import { momentCodes, sendable, wantsOrigin, type Recipient } from './subscribers';

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
