import type { PublicDeal, TicketView } from './types';
import { qualityTag } from './quality';
import { bookingCta } from './booking';
import { ltCity } from './cities-lt';
import { ltDealHeadline, stopsChip } from './dealDetail';
import { formatDates, freshnessLabel, ltMonthNom } from './format';
import { sceneClass } from './photos';
import { airlineName } from './airlines';
import { S } from './lt';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];

function legs(snapshot: unknown): { stops: number; airline: string } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const legsArr = s.legs as Array<{ airline?: { code?: string } }> | undefined;
  const code = legsArr?.[0]?.airline?.code ?? String(s.airline ?? '—');
  return { stops: Number(s.stops ?? 0), airline: airlineName(code) };
}

export function toTicket(r: Row, now: Date): TicketView {
  // now is accepted for signature consistency with toPublicDeal; reserved for relative-time use.
  void now;
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const s = (r.snapshot ?? {}) as Record<string, unknown>;
  const dur = s.duration ? `${Math.floor(Number(s.duration) / 60)} val.` : '';
  const drop = Math.round(Number(pd.discountPct ?? 0));
  // Prefer the engine-written normalized score + tier; fall back for un-backfilled rows.
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100);
  const quality = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? r.qualityTier : (qualityTag(score) ?? 'great');
  return {
    id: pd.id,
    destination: ltCity(pd.destination).nom,
    country: ltCity(pd.destination).country,
    origin: pd.origin,
    route: `${pd.origin} → ${pd.destination}`,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    month: ltMonthNom(String(pd.travelDate)),
    legs: `${stopsChip(stops)}${dur ? ` · ${dur}` : ''}`,
    price: Number(pd.price),
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop,
    quality,
    headline: ltDealHeadline(pd.headline, Number(pd.price), pd.destination),
    eyebrow: pd.publicLabel ?? S.foundByHand,
    catchChip: stopsChip(stops),
    scene: sceneClass(pd.destination),
    airline,
    goingFast: Boolean(pd.goingFast),
  };
}

export function toPublicDeal(r: Row, now: Date): PublicDeal {
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100);
  const quality = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? r.qualityTier : (qualityTag(score) ?? 'great');
  const drop = Math.round(Number(pd.discountPct ?? 0));
  const fresh = pd.lastSeenAt ?? r.candLastSeen ?? null;
  const status = pd.goingFast
    ? { kind: 'going_fast' as const, label: S.chipGoingFast }
    : { kind: 'fresh' as const, label: freshnessLabel(fresh ? String(fresh) : null) };

  // reserved for Task 8 — will be threaded into timeAgo() for the detail page's relative time
  void now;

  return {
    id: pd.id,
    destination: ltCity(pd.destination).nom,
    origin: ltCity(pd.origin).nom,
    route: `${pd.origin} → ${pd.destination}`,
    tripType: pd.tripType,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    stops,
    airline,
    price: Number(pd.price),
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop,
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
  };
}
