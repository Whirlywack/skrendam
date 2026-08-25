import type { CandidateView, TemplateGroup } from './types';

/**
 * Route context — links a queue candidate to what the desk already knows about
 * its route, so the curator never re-evaluates blind (2026-08-25 design,
 * grounded in reference-price research: a drop against a known price is the
 * strongest message we can send, and duplicate live deals are the worst bug).
 *
 * - cheaper_than_live: a LIVE published deal exists on this route and this fare
 *   is meaningfully cheaper (≥ €5, the deal_group_key band) → offer a one-click
 *   "update live deal".
 * - live_on_route: a live deal exists but this fare isn't cheaper → informational.
 * - rejected_similar: the curator dismissed a similar-priced fare (±15%, same
 *   band as the desk's date-clone clustering) on this route recently → hint.
 */

export interface LiveDealLite {
  id: number;
  origin: string;
  destination: string;
  tripType: string;
  price: number;
  headline: string;
}

export interface RejectionLite {
  origin: string;
  destination: string;
  price: number;
  lastSeenAt: string | null;
}

export interface RouteSignals {
  live: LiveDealLite[];
  rejected: RejectionLite[];
}

export type RouteContext =
  | { kind: 'cheaper_than_live'; liveId: number; livePrice: number; saving: number }
  | { kind: 'live_on_route'; liveId: number; livePrice: number }
  | { kind: 'rejected_similar'; rejectedPrice: number; when: string | null };

export const MIN_SAVING_EUR = 5; // deal_group_key price band — smaller moves are the same fare
const REJECTED_SIMILAR_PCT = 0.15; // matches cluster.ts's date-clone price band

export function routeContextFor(
  c: Pick<CandidateView, 'from' | 'to' | 'tripType' | 'price' | 'status'>,
  signals: RouteSignals,
): RouteContext | undefined {
  // Only fares still being decided need context; published/rejected/expired
  // cards already carry their own state.
  if (c.status !== 'suggested' && c.status !== 'review') return undefined;

  // tripType must match too: a one-way fare superseding a roundtrip deal
  // would render “€89 return” on a one-way link (review 08-25).
  const liveHere = signals.live.filter(
    (d) => d.origin === c.from && d.destination === c.to && d.tripType === c.tripType,
  );
  if (liveHere.length > 0) {
    const cheapest = liveHere.reduce((a, b) => (b.price < a.price ? b : a));
    const saving = Math.round(cheapest.price - c.price);
    if (saving >= MIN_SAVING_EUR) {
      return {
        kind: 'cheaper_than_live',
        liveId: cheapest.id,
        livePrice: Math.round(cheapest.price),
        saving,
      };
    }
    return { kind: 'live_on_route', liveId: cheapest.id, livePrice: Math.round(cheapest.price) };
  }

  const similar = signals.rejected
    .filter(
      (r) =>
        r.origin === c.from &&
        r.destination === c.to &&
        Math.abs(r.price - c.price) / r.price <= REJECTED_SIMILAR_PCT,
    )
    .sort((a, b) => String(b.lastSeenAt ?? '').localeCompare(String(a.lastSeenAt ?? '')));
  if (similar.length > 0) {
    return {
      kind: 'rejected_similar',
      rejectedPrice: Math.round(similar[0].price),
      when: similar[0].lastSeenAt,
    };
  }
  return undefined;
}

export function attachRouteContext(
  groups: TemplateGroup[],
  signals: RouteSignals,
): TemplateGroup[] {
  return groups.map((g) => ({
    ...g,
    items: g.items.map((c) => ({ ...c, context: routeContextFor(c, signals) })),
  }));
}
