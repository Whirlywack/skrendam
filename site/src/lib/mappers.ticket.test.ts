import { describe, it, expect } from 'vitest';
import { rowMeta, toTicket } from './mappers';
type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];
const row = (o: Record<string, unknown> = {}): Row => ({
  pd: { id: 1, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 140, baselinePrice: 301,
    discountPct: 53, travelDate: '2026-09-12', returnDate: '2026-09-19', headline: "€140 return to Cyprus — sea's still 27°C.",
    publicLabel: 'September sun', bookingUrl: 'https://www.google.com/travel/flights?tfs=X',
    lastSeenAt: '2026-06-04T10:00:00', goingFast: false, status: 'live', ...(o.pd as object ?? {}) },
  score: o.score ?? 0.96, score100: o.score100 ?? null, scoreV2: o.scoreV2 ?? null,
  snapshot: o.snapshot ?? { stops: 1, duration: 440, legs: [{ airline: { code: 'BT' } }] },
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
  it('score_v2 below GREAT keeps the published floor on the ticket', () => {
    const t = toTicket(row({ score: 0.96, score100: 96, scoreV2: 64 }), new Date());
    expect(t.quality).toBe('great');
  });
  it('direct flight → „Tiesioginis" chip', () => {
    const t = toTicket(row({ snapshot: { stops: 0, duration: 120, legs: [{ airline: { code: 'FR' } }] } }), new Date());
    expect(t.catchChip).toBe('Tiesioginis');
  });
  it('round-trip duration (whole-itinerary total) is not shown as flight time', () => {
    // 330 min = both legs summed — showing "5 val." would overstate the hop ~2×
    const rt = toTicket(row({ snapshot: { stops: 0, duration: 330, legs: [
      { airline: { code: 'FR' } }, { airline: { code: 'FR' } },
    ] } }), new Date());
    expect(rt.legs).toBe('Tiesioginis');
    // ...even when the snapshot carries no legs array at all
    const legless = toTicket(row({ snapshot: { stops: 0, duration: 330, airline: 'FR' } }), new Date());
    expect(legless.legs).toBe('Tiesioginis');
  });
  it('one-way duration IS shown, even with a connection (legs holds 2 flattened segments)', () => {
    const ow = toTicket(row({
      pd: { tripType: 'oneway', returnDate: null },
      snapshot: { stops: 1, duration: 170, legs: [{ airline: { code: 'FR' } }, { airline: { code: 'FR' } }] },
    }), new Date());
    expect(ow.legs).toBe('1 persėdimas · 3 val.');
  });
  it('a changed deal (WP9) tickets the current price, keeps the found one, carries both lines', () => {
    const t = toTicket(row({ pd: { status: 'changed', price: 140, currentPrice: 186, headline: null } }), new Date());
    expect(t.state).toBe('changed');
    expect(t.price).toBe(186);
    expect(t.foundPrice).toBe(140);
    expect(t.currentPrice).toBe(186);
    expect(t.priceLines).toEqual(['Dabar nuo 186\u00a0€', 'radome už 140\u00a0€']);
    // baseline 301: 1 − 186/301 → 38 % (published 53 % would overstate)
    expect(t.drop).toBe(38);
    // the generated headline quotes the price a reader can actually book at
    expect(t.headline).toContain('186');
    expect(t.headline).not.toContain('140');
  });
  it('a live deal tickets the published price with no lines', () => {
    const t = toTicket(row(), new Date());
    expect(t.state).toBe('live');
    expect(t.price).toBe(140);
    expect(t.priceLines).toEqual([]);
  });
});

describe('rowMeta — the index row line under the destination', () => {
  it('a live deal: route · dates · stops chip', () => {
    expect(rowMeta(toTicket(row(), new Date()))).toBe('VNO → LCA · rugs. 12–19 · 1 persėdimas');
  });
  it('a changed deal (WP9 N4) says what it was found at right after the stops chip', () => {
    const t = toTicket(row({ pd: { status: 'changed', price: 140, currentPrice: 186 } }), new Date());
    expect(rowMeta(t)).toBe('VNO → LCA · rugs. 12–19 · 1 persėdimas · radome už 140\u00a0€');
  });
  it('the going-fast chip closes the line, after the found-at note', () => {
    const t = toTicket(row({ pd: { status: 'changed', price: 140, currentPrice: 186, goingFast: true } }), new Date());
    expect(rowMeta(t).endsWith(' · radome už 140\u00a0€ · Tirpsta')).toBe(true);
    expect(rowMeta(toTicket(row({ pd: { goingFast: true } }), new Date()))).toBe('VNO → LCA · rugs. 12–19 · 1 persėdimas · Tirpsta');
  });
  it('a changed row without a verified current price carries no found-at note', () => {
    const t = toTicket(row({ pd: { status: 'changed', currentPrice: null } }), new Date());
    expect(rowMeta(t)).not.toContain('radome už');
  });
});

describe('slice 2 fields', () => {
  it('verifiedTime comes from pd.verifiedAt in Vilnius time, null otherwise', () => {
    expect(toTicket(row({ pd: { verifiedAt: '2026-09-12 03:41:00' } }), new Date()).verifiedTime).toBe('06:41');
    expect(toTicket(row(), new Date()).verifiedTime).toBeNull();
  });
  it('lasted is set only for expired rows with expiredAt after publishedAt', () => {
    const t = toTicket(row({ pd: { status: 'expired', publishedAt: '2026-08-28T10:00:00', expiredAt: '2026-09-11T10:21:49' } }), new Date());
    expect(t.lasted).toBe('14 d.');
    expect(toTicket(row({ pd: { publishedAt: '2026-08-28T10:00:00', expiredAt: null } }), new Date()).lasted).toBeNull();
  });
});
