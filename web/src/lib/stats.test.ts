import { describe, expect, it } from 'vitest';
import {
  breakdown,
  conversionAfter,
  tiktokSignups,
  tsMs,
  type DealFacts,
  type EventRow,
  type SubFacts,
} from './stats';

// Three deals: date/rare/null archetype, tags family_sun/winter_sun/null.
const deals = new Map<number, DealFacts>([
  [1, { id: 1, origin: 'VNO', newsletterTag: 'family_sun', archetype: 'date' }],
  [2, { id: 2, origin: 'RIX', newsletterTag: 'winter_sun', archetype: 'rare' }],
  [3, { id: 3, origin: 'VNO', newsletterTag: null, archetype: null }],
]);

function sub(over: Partial<SubFacts> & { id: number }): SubFacts {
  return {
    plan: 'free',
    moments: [],
    origins: [],
    utmContent: null,
    paidSince: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

// Four subscribers: two paid, two free; anonymous events carry subscriberId null.
const subList: SubFacts[] = [
  sub({ id: 10, plan: 'paid', moments: ['family'], paidSince: '2026-08-15T00:00:00Z' }),
  sub({ id: 11, plan: 'free', moments: ['sun'] }),
  sub({ id: 12, plan: 'free', moments: ['weekend'], origins: ['RIX'] }),
  sub({ id: 13, plan: 'paid', moments: [], paidSince: '2026-08-20T00:00:00Z' }),
];
const subs = new Map(subList.map((s) => [s.id, s]));

function ev(over: Partial<EventRow> & { dealId: number }): EventRow {
  return { issueId: 7, subscriberId: null, kind: 'click', createdAt: '2026-09-02T09:00:00Z', ...over };
}

// Six events across the three deals.
const events: EventRow[] = [
  ev({ dealId: 1, subscriberId: 10, kind: 'click' }),
  ev({ dealId: 1, subscriberId: 11, kind: 'booked_claim' }),
  ev({ dealId: 2, subscriberId: null, kind: 'click' }),
  ev({ dealId: 2, subscriberId: 10, kind: 'click' }),
  ev({ dealId: 3, subscriberId: 11, kind: 'click' }),
  ev({ dealId: 3, subscriberId: null, kind: 'booked_claim' }),
];

describe('breakdown', () => {
  it('archetype — null archetype lands in "none"; rows sorted by clicks, claims, key', () => {
    expect(breakdown(events, deals, subs, 'archetype')).toEqual([
      { key: 'rare', clicks: 2, claims: 0 },
      { key: 'date', clicks: 1, claims: 1 },
      { key: 'none', clicks: 1, claims: 1 },
    ]);
  });

  it('pref — persona codes of the deal tag; a null tag is "none"', () => {
    expect(breakdown(events, deals, subs, 'pref')).toEqual([
      { key: 'sun', clicks: 2, claims: 0 },
      { key: 'family', clicks: 1, claims: 1 },
      { key: 'none', clicks: 1, claims: 1 },
    ]);
  });

  it('pref — a tag with several persona codes counts the event once per code', () => {
    const d = new Map<number, DealFacts>([
      [5, { id: 5, origin: 'VNO', newsletterTag: 'last_minute', archetype: 'date' }],
    ]);
    const rows = breakdown([ev({ dealId: 5, kind: 'booked_claim' })], d, subs, 'pref');
    expect(rows).toEqual([
      { key: 'last_minute', clicks: 0, claims: 1 },
      { key: 'weekend', clicks: 0, claims: 1 },
    ]);
  });

  it('origin — deal origin', () => {
    expect(breakdown(events, deals, subs, 'origin')).toEqual([
      { key: 'VNO', clicks: 2, claims: 2 },
      { key: 'RIX', clicks: 2, claims: 0 },
    ]);
  });

  it('plan — subscriber plan; null subscriber is "anon"', () => {
    expect(breakdown(events, deals, subs, 'plan')).toEqual([
      { key: 'paid', clicks: 2, claims: 0 },
      { key: 'anon', clicks: 1, claims: 1 },
      { key: 'free', clicks: 1, claims: 1 },
    ]);
  });

  it('unknown deal ids count under "none" for deal dims; unknown subscribers are "anon"', () => {
    const stray = [ev({ dealId: 99, subscriberId: 404, kind: 'click' })];
    expect(breakdown(stray, deals, subs, 'archetype')).toEqual([{ key: 'none', clicks: 1, claims: 0 }]);
    expect(breakdown(stray, deals, subs, 'pref')).toEqual([{ key: 'none', clicks: 1, claims: 0 }]);
    expect(breakdown(stray, deals, subs, 'origin')).toEqual([{ key: 'none', clicks: 1, claims: 0 }]);
    expect(breakdown(stray, deals, subs, 'plan')).toEqual([{ key: 'anon', clicks: 1, claims: 0 }]);
  });

  it('no events → no rows', () => {
    expect(breakdown([], deals, subs, 'origin')).toEqual([]);
  });
});

describe('conversionAfter', () => {
  const issue = { id: 3, sentAt: '2026-09-01T10:00:00Z' };
  const next = '2026-09-08T10:00:00Z';
  const cohort: SubFacts[] = [
    // paid inside the window, was free at send
    sub({ id: 1, plan: 'paid', createdAt: '2026-08-20T00:00:00Z', paidSince: '2026-09-03T12:00:00Z' }),
    // paid after the next issue went out — outside this window, still free at send
    sub({ id: 2, plan: 'paid', createdAt: '2026-08-21T00:00:00Z', paidSince: '2026-09-09T12:00:00Z' }),
    // still free
    sub({ id: 3, plan: 'free', createdAt: '2026-08-22T00:00:00Z' }),
    // signed up after the send — not in the cohort
    sub({ id: 4, plan: 'free', createdAt: '2026-09-02T00:00:00Z' }),
    // paid long before the send — never free at send
    sub({ id: 5, plan: 'paid', createdAt: '2026-08-01T00:00:00Z', paidSince: '2026-08-15T00:00:00Z' }),
  ];

  it('one paid_since inside the window, one outside', () => {
    expect(conversionAfter(issue, next, cohort)).toEqual({ paidBetween: 1, freeAtSend: 3 });
  });

  it('no next issue → window runs to now', () => {
    expect(conversionAfter(issue, null, cohort, '2026-09-20T00:00:00Z')).toEqual({
      paidBetween: 2,
      freeAtSend: 3,
    });
  });

  it('window is [sentAt, nextSentAt): start inclusive, end exclusive', () => {
    const edge: SubFacts[] = [
      sub({ id: 1, plan: 'paid', createdAt: '2026-08-01T00:00:00Z', paidSince: issue.sentAt }),
      sub({ id: 2, plan: 'paid', createdAt: '2026-08-01T00:00:00Z', paidSince: next }),
    ];
    expect(conversionAfter(issue, next, edge)).toEqual({ paidBetween: 1, freeAtSend: 2 });
  });

  it('unsent issue → zeros (the page shows „—")', () => {
    expect(conversionAfter({ id: 9, sentAt: null }, next, cohort)).toEqual({ paidBetween: 0, freeAtSend: 0 });
  });

  it('reads Postgres text timestamps: naive UTC created_at, "+00" paid_since', () => {
    const pg: SubFacts[] = [
      sub({ id: 1, plan: 'paid', createdAt: '2026-08-20 00:00:00', paidSince: '2026-09-03 12:00:00.123456+00' }),
    ];
    expect(conversionAfter({ id: 3, sentAt: '2026-09-01 10:00:00' }, '2026-09-08 10:00:00', pg)).toEqual({
      paidBetween: 1,
      freeAtSend: 1,
    });
  });
});

describe('tiktokSignups', () => {
  it('groups by utm content, null → "unknown", sorted by signups desc', () => {
    const rows: SubFacts[] = [
      sub({ id: 1, utmContent: 'vid1', plan: 'paid' }),
      sub({ id: 2, utmContent: 'vid1' }),
      sub({ id: 3, utmContent: 'vid1' }),
      sub({ id: 4, utmContent: 'vid2' }),
      sub({ id: 5, utmContent: null, plan: 'paid' }),
      sub({ id: 6, utmContent: null }),
    ];
    expect(tiktokSignups(rows)).toEqual([
      { content: 'vid1', signups: 3, paid: 1 },
      { content: 'unknown', signups: 2, paid: 1 },
      { content: 'vid2', signups: 1, paid: 0 },
    ]);
  });

  it('empty list → no rows', () => {
    expect(tiktokSignups([])).toEqual([]);
  });
});

describe('tsMs', () => {
  it('treats naive strings as UTC and honours 2-digit, 4-digit and Z offsets', () => {
    const want = Date.UTC(2026, 8, 10, 12, 0, 0);
    expect(tsMs('2026-09-10 12:00:00')).toBe(want);
    expect(tsMs('2026-09-10 12:00:00.123456')).toBe(want + 123);
    expect(tsMs('2026-09-10 12:00:00+00')).toBe(want);
    expect(tsMs('2026-09-10 14:00:00+02')).toBe(want);
    expect(tsMs('2026-09-10 12:00:00.5+00:00')).toBe(want + 500);
    expect(tsMs('2026-09-10T12:00:00Z')).toBe(want);
  });
});
