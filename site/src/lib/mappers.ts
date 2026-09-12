import type { DealState, PublicDeal, TicketView } from './types';
import { qualityTag } from './quality';
import { bookingCta } from './booking';
import { ltCity } from './cities-lt';
import { ltDealHeadline, stopsChip } from './dealDetail';
import { clockLT, eur, formatDates, freshnessLabel, lasted, ltMonthNom, sameVilniusDay } from './format';
import { sceneClass } from './photos';
import { airlineName } from './airlines';
import { groundHint } from './ground';
import { S } from './lt';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];

// D6: quality_tier follows score_v2, so a NULL tier on a row that HAS a score_v2
// means "the demand layer scored it below great". A published deal keeps its
// 'great' floor (it was hand-approved), but the RARITY verdict must come from
// score_v2 — only legacy rows (score_v2 null) derive it from the headline score.
function tierScore(r: { scoreV2?: number | string | null }, score: number): number {
  return r.scoreV2 != null ? Number(r.scoreV2) : score;
}

// The engine's archetype vocabulary (skrendam/scanning/scoring/demand.py).
// The column is a bare varchar, so anything unknown is treated as absent
// rather than handed to copy that switches on it.
const ARCHETYPES = ['date', 'rare', 'destination'] as const;
export type DealArchetype = (typeof ARCHETYPES)[number];

/** Reads the demand layer off a row: archetype + the two signals the site
 *  will speak in (peak window, family saving). Every value is validated —
 *  demand_signals is free-form json written by the scan. */
function demand(r: { archetype?: string | null; demandSignals?: unknown }): {
  archetype: DealArchetype | null;
  windowSlug: string | null;
  savingFamily: number | null;
} {
  const signals = (r.demandSignals && typeof r.demandSignals === 'object'
    ? r.demandSignals
    : {}) as Record<string, unknown>;
  const slug = signals.window_slug;
  const saving = signals.saving_family;
  // `Number('')` is 0, so an empty string must not become a €0 saving claim.
  const savingNum = typeof saving === 'number'
    || (typeof saving === 'string' && saving.trim() !== '')
    ? Number(saving) : NaN;
  return {
    archetype: (ARCHETYPES as readonly string[]).includes(r.archetype ?? '')
      ? (r.archetype as DealArchetype)
      : null,
    windowSlug: typeof slug === 'string' && slug ? slug : null,
    savingFamily: Number.isFinite(savingNum) ? savingNum : null,
  };
}

/** WP9 price state. A `changed` row is still a deal, but the daily check found
 *  it above the published price: the site shows `current_price` and says what
 *  it was found at. `drop` is recomputed against the shown price so „−36 %"
 *  and „sutaupai X €" stay true numbers — and with no baseline to recompute
 *  against it is 0: the published discount_pct was measured at the found
 *  price, so quoting it at the higher current price would overstate (review
 *  round 1). Every „N % pigiau" consumer gates on drop > 0, so 0 = no claim.
 *  Anything that is not `changed` (or is
 *  changed without a verified current price — should not happen, but a stale
 *  row must never render a null €) reads as the published price. */
function priceState(pd: Row['pd']): {
  state: DealState;
  price: number;
  foundPrice: number;
  currentPrice: number | null;
  drop: number;
  priceLines: string[];
} {
  const foundPrice = Number(pd.price);
  const currentPrice = pd.currentPrice == null ? null : Number(pd.currentPrice);
  const publishedDrop = Math.round(Number(pd.discountPct ?? 0));
  if (pd.status !== 'changed' || currentPrice === null) {
    return { state: 'live', price: foundPrice, foundPrice, currentPrice, drop: publishedDrop, priceLines: [] };
  }
  const baseline = pd.baselinePrice == null ? null : Number(pd.baselinePrice);
  const drop = baseline != null && baseline > 0
    ? Math.max(0, Math.round((1 - currentPrice / baseline) * 100))
    : 0;
  return {
    state: 'changed',
    price: currentPrice,
    foundPrice,
    currentPrice,
    drop,
    priceLines: [`${S.nowFrom} ${eur(currentPrice)}`, `${S.foundAt} ${eur(foundPrice)}`],
  };
}

/** The index row's meta line (home, collection pages, similar-deals lists):
 *  route · dates · stops chip. A `changed` deal adds „radome už 93 €" right
 *  after — spec §5 wants the found-at context wherever the changed price
 *  appears, and the two full rows under the poster are the second-most-seen
 *  surface (final review N4). The going-fast chip closes the line. */
export function rowMeta(t: TicketView): string {
  const parts = [t.route, t.dates, t.catchChip];
  if (t.state === 'changed') parts.push(`${S.foundAt} ${eur(t.foundPrice)}`);
  if (t.goingFast) parts.push(S.chipGoingFast);
  return parts.join(' · ');
}

/** The timestamp the freshness label speaks about: the verification step's
 *  `verified_at` first (WP9), then the scan's `last_seen_at`, then the
 *  candidate's. Shared by the mapper and the two pages that label freshness
 *  outside it, so the three never drift. */
export function freshSource(r: Pick<Row, 'pd' | 'candLastSeen'>): string | null {
  const v = r.pd.verifiedAt ?? r.pd.lastSeenAt ?? r.candLastSeen ?? null;
  return v ? String(v) : null;
}

function legs(snapshot: unknown): { stops: number; airline: string } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const legsArr = s.legs as Array<{ airline?: { code?: string } }> | undefined;
  const code = legsArr?.[0]?.airline?.code ?? String(s.airline ?? '—');
  return { stops: Number(s.stops ?? 0), airline: airlineName(code) };
}

export function toTicket(r: Row, now: Date): TicketView {
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const s = (r.snapshot ?? {}) as Record<string, unknown>;
  // snapshot.duration is the WHOLE-itinerary total: on a round trip it sums
  // both legs, so presenting it as the flight time overstates ~2× ("5 val."
  // for a 2h50 hop — canvas review 08-28). Per-leg time can't be derived from
  // the naive local timestamps without an airport TZ table, so round trips
  // show no duration. Gate on tripType, not legs.length — legs flattens all
  // segments, so a one-way with a connection also has 2+ entries.
  const dur =
    s.duration && pd.tripType !== 'roundtrip' ? `${Math.round(Number(s.duration) / 60)} val.` : '';
  const ps = priceState(pd);
  // Prefer the engine-written normalized score + tier; fall back for un-backfilled rows.
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100);
  const quality = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? r.qualityTier : (qualityTag(tierScore(r, score)) ?? 'great');
  return {
    id: pd.id,
    destination: ltCity(pd.destination).nom,
    country: ltCity(pd.destination).country,
    origin: pd.origin,
    route: `${pd.origin} → ${pd.destination}`,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    month: ltMonthNom(String(pd.travelDate)),
    legs: `${stopsChip(stops)}${dur ? ` · ${dur}` : ''}`,
    price: ps.price,
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop: ps.drop,
    state: ps.state,
    foundPrice: ps.foundPrice,
    currentPrice: ps.currentPrice,
    priceLines: ps.priceLines,
    quality,
    headline: ltDealHeadline(pd.headline, ps.price, pd.destination),
    eyebrow: pd.publicLabel ?? S.foundByHand,
    catchChip: stopsChip(stops),
    scene: sceneClass(pd.destination),
    airline,
    goingFast: Boolean(pd.goingFast),
    // The clock is the deal's own WP9 stamp (not the candidate fallback `verifiedAt` uses) and shows only on the day it was taken.
    verifiedTime: sameVilniusDay(pd.verifiedAt ?? null, now) ? clockLT(pd.verifiedAt ?? null) : null,
    lasted: lasted(String(pd.publishedAt), pd.expiredAt ?? null),
  };
}

export function toPublicDeal(r: Row, now: Date): PublicDeal {
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100);
  const quality = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? r.qualityTier : (qualityTag(tierScore(r, score)) ?? 'great');
  const ps = priceState(pd);
  const drop = ps.drop;
  const status = pd.goingFast
    ? { kind: 'going_fast' as const, label: S.chipGoingFast }
    : { kind: 'fresh' as const, label: freshnessLabel(freshSource(r)) };

  return {
    id: pd.id,
    destination: ltCity(pd.destination).nom,
    origin: ltCity(pd.origin).nom,
    route: `${pd.origin} → ${pd.destination}`,
    tripType: pd.tripType,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    stops,
    airline,
    price: ps.price,
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop,
    state: ps.state,
    foundPrice: ps.foundPrice,
    currentPrice: ps.currentPrice,
    priceLines: ps.priceLines,
    quality,
    // The rarity claim is earned, not decoration: only 'rare'-tier deals say it
    // (review 08-28 — a 'great' deal beside a rarity line reads as fake urgency).
    verdict: quality === 'rare'
      ? 'Verta imti — taip pigiai būna retai.'
      : 'Gera kaina šiam maršrutui — pigiau nei įprastai.',
    why: drop ? `${drop} % pigiau nei įprastai` : 'Pigiau nei įprastai',
    catchLine: stops >= 1 ? `Kabliukas: ${stopsChip(stops)}` : null,
    status,
    booking: bookingCta(pd.bookingUrl ?? null),
    // The deal's own verification stamp (WP9) first; the candidate's recheck stamp as before.
    verifiedAt: pd.verifiedAt ? String(pd.verifiedAt) : r.verifiedAt ? String(r.verifiedAt) : null,
    groundHint: groundHint(pd.origin),
    ...demand(r),
    // The clock is the deal's own WP9 stamp (not the candidate fallback `verifiedAt` uses) and shows only on the day it was taken.
    verifiedTime: sameVilniusDay(pd.verifiedAt ?? null, now) ? clockLT(pd.verifiedAt ?? null) : null,
    lasted: lasted(String(pd.publishedAt), pd.expiredAt ?? null),
  };
}
