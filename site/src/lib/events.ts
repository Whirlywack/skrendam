import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { dealEvents } from '@/db/generated/schema';
import { parseRefCode } from '@/lib/refcode';

/**
 * deal_events writers behind the tracked links every WP6 email carries:
 *   /go/<dealId>?i=<issueId>&s=<refCode>          → 'click' + redirect
 *   /uzsisakiau/<dealId>?i=<issueId>&s=<refCode>  → 'booked_claim' (POST button)
 *
 * `i` and `s` are public URL parameters — anyone can type them. They are
 * parsed into ids but never trusted beyond that: a wrong `s` simply becomes an
 * anonymous event, and the FK constraints on deal_events reject ids that do
 * not exist (callers decide whether that failure is ignorable).
 */

export type EventKind = 'click' | 'booked_claim';

export interface DealEventInput {
  dealId: number;
  issueId: number | null;
  subscriberId: number | null;
  kind: EventKind;
  /** 'email' when the link carried an issue id, else null. */
  source: string | null;
}

// Postgres `serial` — positive int4. Nine digits keeps us well under 2**31.
const ID_RE = /^\d{1,9}$/;

function positiveInt(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string' || !ID_RE.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/** The `[dealId]` path segment → id, or null for anything that is not one. */
export function parseDealId(raw: string | null | undefined): number | null {
  return positiveInt(raw);
}

/** `i` → issue id (positive int) or null; `s` → subscriber id via the
 *  checksummed ref code or null. Malformed values never throw. */
export function parseTracking(sp: URLSearchParams): {
  issueId: number | null;
  subscriberId: number | null;
} {
  const s = sp.get('s');
  const decoded = s ? parseRefCode(s) : null;
  // refCode(0) round-trips but serial ids start at 1 — 0 is not a subscriber.
  const subscriberId = decoded !== null && decoded > 0 ? decoded : null;
  return { issueId: positiveInt(sp.get('i')), subscriberId };
}

/** Only a booked_claim from a known subscriber is one-per-(deal, subscriber). */
export function needsDedupe(e: Pick<DealEventInput, 'kind' | 'subscriberId'>): boolean {
  return e.kind === 'booked_claim' && e.subscriberId !== null;
}

/** Pure decision: insert this event given whether a matching claim already
 *  exists? Clicks and anonymous claims are always inserted. */
export function shouldInsert(
  e: Pick<DealEventInput, 'kind' | 'subscriberId'>,
  alreadyClaimed: boolean,
): boolean {
  return !(needsDedupe(e) && alreadyClaimed);
}

/** Insert one deal_events row. For a booked_claim with a subscriber id, a
 *  select-then-insert skips the insert when that subscriber already claimed
 *  this deal (two concurrent submits can still both land — acceptable noise
 *  for a "how many booked" count; no unique index exists to lean on).
 *  DB errors propagate; callers choose whether to swallow them. */
export async function recordEvent(e: DealEventInput): Promise<void> {
  if (needsDedupe(e)) {
    const prior = await db
      .select({ id: dealEvents.id })
      .from(dealEvents)
      .where(
        and(
          eq(dealEvents.dealId, e.dealId),
          eq(dealEvents.subscriberId, e.subscriberId as number),
          eq(dealEvents.kind, 'booked_claim'),
        ),
      )
      .limit(1);
    if (!shouldInsert(e, prior.length > 0)) return;
  }
  await db.insert(dealEvents).values({
    dealId: e.dealId,
    issueId: e.issueId,
    subscriberId: e.subscriberId,
    kind: e.kind,
    source: e.source,
    createdAt: new Date().toISOString(),
  });
}
