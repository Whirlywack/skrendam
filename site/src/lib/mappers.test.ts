import { describe, it, expect } from 'vitest';
import { toPublicDeal } from './mappers';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];
function row(over: Partial<Record<string, unknown>> = {}): Row {
  return {
    pd: { id: 1, origin: 'VNO', destination: 'BCN', tripType: 'oneway', price: 96,
          baselinePrice: 150, discountPct: 36, travelDate: '2026-09-12', returnDate: '2026-09-19',
          bookingUrl: 'https://www.google.com/travel/flights?tfs=X', lastSeenAt: '2026-06-03T10:00:00',
          goingFast: false, status: 'live', ...((over.pd as object) ?? {}) },
    score: over.score ?? 0.96,
    score100: over.score100 ?? null,
    qualityTier: over.qualityTier ?? null,
    snapshot: over.snapshot ?? { stops: 1, legs: [{ airline: { code: 'BT' } }], duration: 440, self_transfer: false },
    candLastSeen: '2026-06-03T10:00:00',
  } as unknown as Row;
}

describe('toPublicDeal', () => {
  it('maps quality, drop, route, booking', () => {
    const d = toPublicDeal(row(), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');           // score 0.96 → 96 → rare
    expect(d.drop).toBe(36);
    expect(d.route).toBe('VNO → BCN');
    expect(d.booking.button).toBe('Open in Google Flights');
    expect(d.status.kind).toBe('fresh');
    expect(d.airline).toBe('BT');             // airline read from legs[0].airline.code
  });
  it('going_fast flag wins the status', () => {
    const d = toPublicDeal(row({ pd: { goingFast: true } }), new Date('2026-06-03T12:00:00Z'));
    expect(d.status.kind).toBe('going_fast');
    expect(d.status.label).toBe('Going fast');
  });
  it('non-stop → no catch line', () => {
    const d = toPublicDeal(row({ snapshot: { stops: 0, legs: [{ airline: { code: 'FR' } }], duration: 120 } }), new Date('2026-06-03T12:00:00Z'));
    expect(d.catchLine).toBeNull();
  });
  it('engine quality_tier wins over the raw score', () => {
    // raw score 0.50 would derive no tier, but the engine tagged it "rare".
    const d = toPublicDeal(row({ score: 0.5, qualityTier: 'rare' }), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');
  });
  it('engine score_0_100 drives the derived tier when quality_tier is absent', () => {
    // raw score 0.50 → 50 → no tier; stored score_0_100 95 → "rare".
    const d = toPublicDeal(row({ score: 0.5, score100: 95 }), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');
  });
});
