import { describe, it, expect } from 'vitest';
import { toTicket } from './mappers';
type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];
const row = (o: Record<string, unknown> = {}): Row => ({
  pd: { id: 1, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 140, baselinePrice: 301,
    discountPct: 53, travelDate: '2026-09-12', returnDate: '2026-09-19', headline: "€140 return to Cyprus — sea's still 27°C.",
    publicLabel: 'September sun', bookingUrl: 'https://www.google.com/travel/flights?tfs=X',
    lastSeenAt: '2026-06-04T10:00:00', goingFast: false, status: 'live', ...(o.pd as object ?? {}) },
  score: o.score ?? 0.96, snapshot: o.snapshot ?? { stops: 1, duration: 440, legs: [{ airline: { code: 'BT' } }] },
  candLastSeen: '2026-06-04T10:00:00',
} as unknown as Row);
describe('toTicket', () => {
  it('maps the ticket fields', () => {
    const t = toTicket(row(), new Date('2026-06-04T12:00:00Z'));
    expect(t.id).toBe(1);
    // LT exonym in nominative for list rows (spec §4); country in LT
    expect(t.destination).toBe('Larnaka'); expect(t.country).toBe('Kipras'); expect(t.origin).toBe('VNO');
    expect(t.route).toBe('VNO → LCA'); expect(t.drop).toBe(53); expect(t.airline).toBe('airBaltic');
    expect(t.headline).toContain('€140'); expect(t.scene).toBe('ph-coast'); expect(t.quality).toBe('rare');
    expect(t.baseline).toBe(301); expect(t.catchChip).toBe('1 persėdimas');
  });
  it('generates an LT headline (accusative after „į") when pd.headline is absent', () => {
    const t = toTicket(row({ pd: { headline: null } }), new Date('2026-06-04T12:00:00Z'));
    expect(t.headline).toContain('į Larnaką');
    expect(t.headline).toContain('140');
  });
  it('direct flight → „Tiesioginis" chip', () => {
    const t = toTicket(row({ snapshot: { stops: 0, duration: 120, legs: [{ airline: { code: 'FR' } }] } }), new Date());
    expect(t.catchChip).toBe('Tiesioginis');
  });
});
