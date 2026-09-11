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
    scoreV2: over.scoreV2 ?? null,
    archetype: over.archetype ?? null,
    demandSignals: over.demandSignals ?? null,
    qualityTier: over.qualityTier ?? null,
    snapshot: over.snapshot ?? { stops: 1, legs: [{ airline: { code: 'BT' } }], duration: 440, self_transfer: false },
    candLastSeen: '2026-06-03T10:00:00',
    verifiedAt: over.verifiedAt ?? null,
  } as unknown as Row;
}

describe('toPublicDeal', () => {
  it('maps quality, drop, route, booking', () => {
    const d = toPublicDeal(row(), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');           // score 0.96 → 96 → rare
    expect(d.drop).toBe(36);
    expect(d.route).toBe('VNO → BCN');
    expect(d.booking.button).toContain('Google Flights'); // „Atidaryti „Google Flights“"
    expect(d.status.kind).toBe('fresh');
    expect(d.airline).toBe('airBaltic');      // legs[0].airline.code → display name
  });
  it('passes the demand layer through: archetype, window slug, family saving', () => {
    const d = toPublicDeal(
      row({
        archetype: 'date',
        demandSignals: { window_slug: 'xmas_markets', saving_family: 128.5, demand_tier: 'A' },
      }),
      new Date('2026-06-03T12:00:00Z'),
    );
    expect(d.archetype).toBe('date');
    expect(d.windowSlug).toBe('xmas_markets');
    expect(d.savingFamily).toBe(128.5);
  });

  it('a legacy row with no demand data reads as nulls, not undefined', () => {
    const d = toPublicDeal(row(), new Date('2026-06-03T12:00:00Z'));
    expect(d.archetype).toBeNull();
    expect(d.windowSlug).toBeNull();
    expect(d.savingFamily).toBeNull();
  });

  it('rejects an archetype the site does not know', () => {
    // The column is a bare varchar — anything the engine writes lands here,
    // and an unknown value must not reach copy that switches on it.
    const d = toPublicDeal(row({ archetype: 'commodity' }), new Date('2026-06-03T12:00:00Z'));
    expect(d.archetype).toBeNull();
  });

  it('drops junk demand_signals instead of leaking it', () => {
    const d = toPublicDeal(
      row({ demandSignals: { window_slug: 42, saving_family: 'nope' } }),
      new Date('2026-06-03T12:00:00Z'),
    );
    expect(d.windowSlug).toBeNull();
    expect(d.savingFamily).toBeNull();
  });

  it('survives demand_signals that is not an object', () => {
    const d = toPublicDeal(row({ demandSignals: 'x' }), new Date('2026-06-03T12:00:00Z'));
    expect(d.windowSlug).toBeNull();
    expect(d.savingFamily).toBeNull();
  });

  it('an empty saving_family never becomes a €0 claim', () => {
    const d = toPublicDeal(row({ demandSignals: { saving_family: '' } }), new Date());
    expect(d.savingFamily).toBeNull();
  });

  it('null saving_family (not a family window) stays null', () => {
    const d = toPublicDeal(
      row({ demandSignals: { window_slug: 'sept_shoulder', saving_family: null } }),
      new Date('2026-06-03T12:00:00Z'),
    );
    expect(d.windowSlug).toBe('sept_shoulder');
    expect(d.savingFamily).toBeNull();
  });

  it('going_fast flag wins the status', () => {
    const d = toPublicDeal(row({ pd: { goingFast: true } }), new Date('2026-06-03T12:00:00Z'));
    expect(d.status.kind).toBe('going_fast');
    expect(d.status.label).toBe('Tirpsta');
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
  it('score_v2 below GREAT keeps the published floor but drops the rarity claim', () => {
    // D6: quality_tier follows score_v2. A published deal never falls below
    // 'great' (a curator approved it), but "taip pigiai būna retai" must be
    // earned by score_v2, not by the headline score the demand layer overruled.
    const d = toPublicDeal(row({ score: 0.92, score100: 92, scoreV2: 64 }), new Date());
    expect(d.quality).toBe('great');
    expect(d.verdict).not.toContain('retai');
    // ...even when the headline score alone would have said "rare".
    const r2 = toPublicDeal(row({ score: 0.96, score100: 96, scoreV2: 64 }), new Date());
    expect(r2.quality).toBe('great');
    expect(r2.verdict).not.toContain('retai');
  });
  it('engine score_0_100 drives the derived tier when quality_tier is absent', () => {
    // raw score 0.50 → 50 → no tier; stored score_0_100 95 → "rare".
    const d = toPublicDeal(row({ score: 0.5, score100: 95 }), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');
  });
  it('verifiedAt + KUN origin → verifiedAt passthrough and ground hint', () => {
    const d = toPublicDeal(
      row({ verifiedAt: '2026-09-10T05:00:00', pd: { origin: 'KUN' } }),
      new Date('2026-06-03T12:00:00Z'),
    );
    expect(d.verifiedAt).toBe('2026-09-10T05:00:00');
    expect(d.groundHint).toBe('Iš Vilniaus: 59 min traukiniu');
  });
  it('VNO origin → no ground hint', () => {
    const d = toPublicDeal(row({ pd: { origin: 'VNO' } }), new Date('2026-06-03T12:00:00Z'));
    expect(d.groundHint).toBeNull();
  });
  it('no verifiedAt on the row → null', () => {
    const d = toPublicDeal(row(), new Date('2026-06-03T12:00:00Z'));
    expect(d.verifiedAt).toBeNull();
  });
  it("the deal's own verified_at (WP9) beats the candidate's", () => {
    const d = toPublicDeal(
      row({ verifiedAt: '2026-09-10T05:00:00', pd: { verifiedAt: '2026-09-11T05:00:00' } }),
      new Date('2026-09-11T06:00:00Z'),
    );
    expect(d.verifiedAt).toBe('2026-09-11T05:00:00');
  });
});

describe('toPublicDeal — WP9 price state', () => {
  const now = new Date('2026-06-03T12:00:00Z');

  it('a live deal shows the published price and no change lines', () => {
    const d = toPublicDeal(row(), now);
    expect(d.state).toBe('live');
    expect(d.price).toBe(96);
    expect(d.foundPrice).toBe(96);
    expect(d.currentPrice).toBeNull();
    expect(d.priceLines).toEqual([]);
    expect(d.drop).toBe(36);
  });

  it('a live deal with a verified current price (within tolerance) still shows the published price', () => {
    const d = toPublicDeal(row({ pd: { currentPrice: 99 } }), now);
    expect(d.state).toBe('live');
    expect(d.price).toBe(96);
    expect(d.currentPrice).toBe(99);
    expect(d.priceLines).toEqual([]);
  });

  it('a changed deal shows the current price and says what it was found at', () => {
    const d = toPublicDeal(row({ pd: { status: 'changed', price: 93, currentPrice: 124 } }), now);
    expect(d.state).toBe('changed');
    expect(d.price).toBe(124);
    expect(d.foundPrice).toBe(93);
    expect(d.currentPrice).toBe(124);
    expect(d.priceLines).toEqual(['Dabar nuo 124\u00a0€', 'radome už 93\u00a0€']);
    // drop is recomputed against the shown price (baseline 150): 1 − 124/150 → 17 %
    expect(d.drop).toBe(17);
    expect(d.why).toBe('17 % pigiau nei įprastai');
  });

  it('a changed deal without a current price never renders a null € — falls back to published', () => {
    const d = toPublicDeal(row({ pd: { status: 'changed', currentPrice: null } }), now);
    expect(d.state).toBe('live');
    expect(d.price).toBe(96);
    expect(d.priceLines).toEqual([]);
  });

  it('a changed deal above its baseline never claims a negative discount', () => {
    const d = toPublicDeal(row({ pd: { status: 'changed', currentPrice: 180 } }), now);
    expect(d.drop).toBe(0);
    expect(d.why).toBe('Pigiau nei įprastai');
  });

  it('the freshness label speaks about verified_at first, then last_seen_at', () => {
    const at = new Date('2026-09-11T08:00:00Z');
    const stale = toPublicDeal(row({ pd: { lastSeenAt: '2026-09-01T06:00:00', verifiedAt: null } }), at);
    expect(stale.status.label).toBe('Kaina galėjo pasikeisti — patikrink');
    const verified = toPublicDeal(
      row({ pd: { lastSeenAt: '2026-09-01T06:00:00', verifiedAt: new Date(Date.now() - 3 * 3600_000).toISOString() } }),
      at,
    );
    expect(verified.status.label).toBe('Tikrinta prieš 3 val.');
  });
});
