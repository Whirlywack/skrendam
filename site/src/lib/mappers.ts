import type { PublicDeal, TicketView } from './types';
import { qualityTag } from './quality';
import { bookingCta } from './booking';
import { city, country } from './airports';
import { formatDates, timeAgo } from './format';
import { sceneClass } from './photos';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];

function legs(snapshot: unknown): { stops: number; airline: string } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const legsArr = s.legs as Array<{ airline?: { code?: string } }> | undefined;
  const airline = legsArr?.[0]?.airline?.code ?? String(s.airline ?? '—');
  return { stops: Number(s.stops ?? 0), airline };
}

export function toTicket(r: Row, now: Date): TicketView {
  // now is accepted for signature consistency with toPublicDeal; reserved for relative-time use.
  void now;
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const s = (r.snapshot ?? {}) as Record<string, unknown>;
  const dur = s.duration ? `${Math.floor(Number(s.duration) / 60)}h` : '';
  const drop = Math.round(Number(pd.discountPct ?? 0));
  const score = Math.round(Number(r.score ?? 0) * 100);
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
    quality: qualityTag(score) ?? 'great',
    headline: pd.headline ?? `€${Math.round(Number(pd.price))} return to ${city(pd.destination)}`,
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
  const score = Math.round(Number(r.score ?? 0) * 100);
  const drop = Math.round(Number(pd.discountPct ?? 0));
  const fresh = pd.lastSeenAt ?? r.candLastSeen ?? null;
  const status = pd.goingFast
    ? { kind: 'going_fast' as const, label: 'Going fast' }
    : { kind: 'fresh' as const, label: fresh ? `Checked ${timeAgo(String(fresh))}` : 'Checked recently' };

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
    quality: qualityTag(score) ?? 'great',
    verdict: 'Book this — it rarely drops this low.',
    why: drop ? `${drop}% below typical` : 'Below typical',
    catchLine: stops >= 1 ? `Catch: ${stops} stop${stops > 1 ? 's' : ''}` : null,
    status,
    booking: bookingCta(pd.bookingUrl ?? null),
  };
}
