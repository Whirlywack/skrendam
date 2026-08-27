import type { PublicDeal, TicketView } from './types';
import { qualityTag } from './quality';
import { bookingCta } from './booking';
import { city, country, dealHeadline } from './airports';
import { formatDates, freshnessLabel } from './format';
import { sceneClass } from './photos';
import { airlineName } from './airlines';

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
  const dur = s.duration ? `${Math.floor(Number(s.duration) / 60)}h` : '';
  const drop = Math.round(Number(pd.discountPct ?? 0));
  // Prefer the engine-written normalized score + tier; fall back for un-backfilled rows.
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100);
  const quality = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? r.qualityTier : (qualityTag(score) ?? 'great');
  return {
    id: pd.id,
    destination: city(pd.destination),
    country: country(pd.destination),
    origin: pd.origin,
    route: `${pd.origin} → ${pd.destination}`,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    legs: `${stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}${dur ? ` · ${dur}` : ''}`,
    price: Number(pd.price),
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop,
    quality,
    headline: dealHeadline(pd.headline, Number(pd.price), pd.destination),
    eyebrow: pd.publicLabel ?? 'Found by hand',
    catchChip: stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`,
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
    ? { kind: 'going_fast' as const, label: 'Going fast' }
    : { kind: 'fresh' as const, label: freshnessLabel(fresh ? String(fresh) : null) };

  // reserved for Task 8 — will be threaded into timeAgo() for the detail page's relative time
  void now;

  return {
    id: pd.id,
    destination: city(pd.destination),
    origin: city(pd.origin),
    route: `${pd.origin} → ${pd.destination}`,
    tripType: pd.tripType,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    stops,
    airline,
    price: Number(pd.price),
    baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice),
    drop,
    quality,
    verdict: 'Book this — it rarely drops this low.',
    why: drop ? `${drop}% below typical` : 'Below typical',
    catchLine: stops >= 1 ? `Catch: ${stops} stop${stops > 1 ? 's' : ''}` : null,
    status,
    booking: bookingCta(pd.bookingUrl ?? null),
  };
}
