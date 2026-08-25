import { describe, expect, it } from 'vitest';
import { routeContextFor, type RouteSignals } from './routeContext';

const base = { from: 'VNO', to: 'LCA', tripType: 'roundtrip', price: 118, status: 'suggested' } as const;
const none: RouteSignals = { live: [], rejected: [] };
const live140: RouteSignals = {
  live: [{ id: 7, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 140, headline: 'x' }],
  rejected: [],
};

describe('routeContextFor', () => {
  it('flags a meaningfully cheaper fare against the live deal', () => {
    expect(routeContextFor(base, live140)).toEqual({
      kind: 'cheaper_than_live',
      liveId: 7,
      livePrice: 140,
      saving: 22,
    });
  });

  it('within the €5 band it is the same fare — informational only', () => {
    expect(routeContextFor({ ...base, price: 137 }, live140)).toEqual({
      kind: 'live_on_route',
      liveId: 7,
      livePrice: 140,
    });
  });

  it('a pricier fare than the live deal is informational, never an update prompt', () => {
    expect(routeContextFor({ ...base, price: 165 }, live140)?.kind).toBe('live_on_route');
  });

  it('picks the cheapest live deal when several exist on the route', () => {
    const two: RouteSignals = {
      live: [
        { id: 7, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 140, headline: 'x' },
        { id: 9, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 120, headline: 'y' },
      ],
      rejected: [],
    };
    expect(routeContextFor({ ...base, price: 100 }, two)).toMatchObject({ liveId: 9, saving: 20 });
  });

  it('hints at a recent similar-priced rejection (±15%)', () => {
    const sig: RouteSignals = {
      live: [],
      rejected: [
        { origin: 'VNO', destination: 'LCA', price: 125, lastSeenAt: '2026-08-22T06:00:00' },
      ],
    };
    expect(routeContextFor(base, sig)).toEqual({
      kind: 'rejected_similar',
      rejectedPrice: 125,
      when: '2026-08-22T06:00:00',
    });
    // 30% cheaper than the rejection → a different deal, no hint
    expect(routeContextFor({ ...base, price: 87 }, sig)).toBeUndefined();
  });

  it('live deal beats rejection hint; other routes and decided cards get nothing', () => {
    const sig: RouteSignals = {
      live: live140.live,
      rejected: [
        { origin: 'VNO', destination: 'LCA', price: 120, lastSeenAt: null },
        { origin: 'KUN', destination: 'AGP', price: 118, lastSeenAt: null },
      ],
    };
    expect(routeContextFor(base, sig)?.kind).toBe('cheaper_than_live');
    expect(routeContextFor({ ...base, from: 'RIX' }, sig)).toBeUndefined();
    // review 08-25: one-way candidate must NOT supersede a roundtrip live deal
    expect(routeContextFor({ ...base, tripType: 'oneway' }, live140)).toBeUndefined();
    expect(routeContextFor({ ...base, status: 'published' }, none)).toBeUndefined();
  });
});
