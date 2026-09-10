import { describe, expect, it } from 'vitest';
import type { Deal } from './email/render';
import {
  FREE_LETTER_FRESH,
  FREE_LETTER_MISSED,
  missedFacts,
  pickDigest,
  pickNurture,
  statsOf,
  type DealEvent,
} from './letters';

function deal(over: Partial<Deal> & { id: number }): Deal {
  return {
    candidateId: 1,
    dealTemplateId: 1,
    contentDraftId: null,
    publicLabel: null,
    newsletterTag: null,
    headline: `Deal ${over.id}`,
    body: null,
    tiktokHook: null,
    origin: 'VNO',
    destination: 'LHR',
    zone: null,
    tripType: 'roundtrip',
    travelDate: null,
    returnDate: null,
    price: 99,
    baselinePrice: null,
    discountPct: null,
    bookingUrl: null,
    validUntil: null,
    lastSeenAt: null,
    tier: 'good',
    status: 'live',
    publishedAt: '2026-09-01 10:00:00',
    goingFast: false,
    unverifiedSince: null,
    postedTiktokAt: null,
    postedInstagramAt: null,
    expiredAt: null,
    ...over,
  };
}

function booked(dealId: number): DealEvent {
  return { dealId, kind: 'booked_claim' };
}

describe('pickDigest', () => {
  const live = [
    deal({ id: 1, publishedAt: '2026-09-01 10:00:00' }),
    deal({ id: 2, publishedAt: '2026-09-05 10:00:00' }),
    deal({ id: 3, publishedAt: '2026-09-03 10:00:00' }),
  ];

  it('returns every live deal, newest first, when there was no digest yet', () => {
    expect(pickDigest(live, null).map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it('keeps only deals published after the last digest', () => {
    expect(pickDigest(live, '2026-09-02 07:00:00').map((d) => d.id)).toEqual([2, 3]);
  });

  it('excludes a deal published exactly at the cutoff (already went out)', () => {
    expect(pickDigest(live, '2026-09-03 10:00:00').map((d) => d.id)).toEqual([2]);
  });

  it('never picks a deal that is not live', () => {
    const mixed = [...live, deal({ id: 4, status: 'expired', publishedAt: '2026-09-09 10:00:00' })];
    expect(pickDigest(mixed, null).map((d) => d.id)).toEqual([2, 3, 1]);
  });
});

describe('pickNurture', () => {
  const now = new Date('2026-09-10T12:00:00');
  const live = [
    deal({ id: 1, publishedAt: '2026-09-01 10:00:00' }),
    deal({ id: 2, publishedAt: '2026-09-05 10:00:00' }),
    deal({ id: 3, publishedAt: '2026-09-03 10:00:00' }),
  ];
  const expired = [
    deal({ id: 10, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-21 22:00:00' }),
    deal({ id: 11, status: 'expired', publishedAt: '2026-08-25 10:00:00', expiredAt: '2026-08-30 10:00:00' }),
    deal({ id: 12, status: 'expired', publishedAt: '2026-08-26 10:00:00', expiredAt: '2026-08-28 10:00:00' }),
    deal({ id: 13, status: 'expired', publishedAt: '2026-08-27 10:00:00', expiredAt: '2026-09-01 10:00:00' }),
  ];

  it('takes the newest FREE_LETTER_FRESH live deals', () => {
    const { fresh } = pickNurture([...live, ...expired], [], now);
    expect(fresh).toHaveLength(FREE_LETTER_FRESH);
    expect(fresh.map((d) => d.id)).toEqual([2, 3]);
  });

  it('takes the FREE_LETTER_MISSED most recently expired deals, latest expiry first', () => {
    const { missed } = pickNurture([...live, ...expired], [], now);
    expect(missed).toHaveLength(FREE_LETTER_MISSED);
    expect(missed.map((d) => d.id)).toEqual([13, 11, 12]);
  });

  it('computes lastedHours as rounded hours between publish and expiry (1.5 days → 36)', () => {
    const { missed } = pickNurture([expired[0]], [], now);
    expect(missed.map((d) => d.lastedHours)).toEqual([36]);
  });

  it('counts bookedCount from booked_claim events for that deal only', () => {
    const events: DealEvent[] = [
      booked(13),
      booked(13),
      booked(11),
      { dealId: 13, kind: 'click' },
      booked(999),
    ];
    const { missed } = pickNurture(expired, events, now);
    expect(missed.find((d) => d.id === 13)?.bookedCount).toBe(2);
    expect(missed.find((d) => d.id === 11)?.bookedCount).toBe(1);
    expect(missed.find((d) => d.id === 12)?.bookedCount).toBe(0);
  });

  it('excludes expired deals without expiredAt (no honest "lasted" fact)', () => {
    const rows = [
      deal({ id: 20, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: null }),
      deal({ id: 21, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-22 10:00:00' }),
    ];
    expect(pickNurture(rows, [], now).missed.map((d) => d.id)).toEqual([21]);
  });

  it('does not show a deal that expired the hour it was published as missed (no „išbuvo 0 val.")', () => {
    const rows = [
      // expired_at backfilled from published_at (migration 0014 fallback)
      deal({ id: 40, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-20 10:00:00' }),
      // curator-expired 20 minutes after publish — rounds to 0 h
      deal({ id: 41, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-20 10:20:00' }),
      deal({ id: 42, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-20 11:00:00' }),
    ];
    const { missed } = pickNurture(rows, [], now);
    expect(missed.map((d) => d.id)).toEqual([42]);
    expect(missed[0].lastedHours).toBe(1);
  });

  it('a zero-hour row does not use up a FREE_LETTER_MISSED slot', () => {
    const zero = deal({ id: 50, status: 'expired', publishedAt: '2026-09-05 10:00:00', expiredAt: '2026-09-05 10:00:00' });
    const { missed } = pickNurture([zero, ...expired], [], now);
    expect(missed).toHaveLength(FREE_LETTER_MISSED);
    expect(missed.map((d) => d.id)).toEqual([13, 11, 12]);
  });

  it('excludes deals whose expiry is still in the future relative to now', () => {
    const rows = [
      deal({ id: 30, status: 'expired', publishedAt: '2026-09-01 10:00:00', expiredAt: '2026-09-20 10:00:00' }),
    ];
    expect(pickNurture(rows, [], now).missed).toEqual([]);
  });

  it('never lists a live deal under missed, nor an expired one under fresh', () => {
    const { fresh, missed } = pickNurture([...live, ...expired], [], now);
    expect(fresh.every((d) => d.status === 'live')).toBe(true);
    expect(missed.every((d) => d.status === 'expired')).toBe(true);
  });
});

describe('missedFacts (send-time re-read of an issue\'s expired ids)', () => {
  it('keeps stored order, drops rows without expiredAt and zero-hour rows, attaches real facts', () => {
    const rows = [
      deal({ id: 3, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-21 10:00:00' }),
      deal({ id: 2, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: null }),
      deal({ id: 1, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-20 10:00:00' }),
      deal({ id: 4, status: 'expired', publishedAt: '2026-08-20 10:00:00', expiredAt: '2026-08-23 10:00:00' }),
    ];
    const missed = missedFacts(rows, [booked(4), booked(4), booked(3)]);
    expect(missed.map((d) => [d.id, d.lastedHours, d.bookedCount])).toEqual([
      [3, 24, 1],
      [4, 72, 2],
    ]);
  });
});

describe('statsOf', () => {
  it('reads every counter incl. the instant stream\'s skipped_origin, zero when absent', () => {
    expect(statsOf({ attempted: 3, sent: 2, failed: 1, skipped_no_token: 1, skipped_origin: 4 })).toEqual({
      attempted: 3,
      sent: 2,
      failed: 1,
      skipped_no_token: 1,
      skipped_no_key: false,
      skipped_origin: 4,
      dropped_expired: 0,
      errors: [],
    });
    expect(statsOf(null)).toBeNull();
    expect(statsOf([1])).toBeNull();
  });
});
