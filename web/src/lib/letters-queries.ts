import { and, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { db, dealEvents, issues, publishedDeals } from '@/db';
import type { Deal } from './email/render';
import type { DealEvent, IssueKind } from './letters';
import { LIVE_STATUSES } from './statuses';

export type Issue = typeof issues.$inferSelect;

/** The curator letters (digest, nurture), newest first. Instant issues are
 *  one row per publish and would push the letters off the page within
 *  weeks — they are counted by `countInstantIssues` instead. */
export async function listLetters(): Promise<Issue[]> {
  return db
    .select()
    .from(issues)
    .where(ne(issues.kind, 'instant'))
    .orderBy(desc(issues.createdAt), desc(issues.id))
    .limit(100);
}

/** How many instant-stream issues exist (sent or skipped for no key). */
export async function countInstantIssues(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(issues).where(eq(issues.kind, 'instant'));
  return row?.n ?? 0;
}

export async function getIssue(id: number): Promise<Issue | null> {
  const rows = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  return rows[0] ?? null;
}

/** The most recent *sent* issue of a kind — the digest cutoff is the last
 *  time paid subscribers actually received deals, not the last draft. */
export async function lastIssueOf(kind: IssueKind): Promise<Issue | null> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.kind, kind), isNotNull(issues.sentAt)))
    .orderBy(desc(issues.sentAt), desc(issues.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Deals on the site (`LIVE_STATUSES`: live or changed), newest first. */
export async function liveDeals(): Promise<Deal[]> {
  return db
    .select()
    .from(publishedDeals)
    .where(inArray(publishedDeals.status, [...LIVE_STATUSES]))
    .orderBy(desc(publishedDeals.publishedAt), desc(publishedDeals.id));
}

/** Expired deals that carry an `expired_at`, latest expiry first. */
export async function expiredDeals(limit: number): Promise<Deal[]> {
  return db
    .select()
    .from(publishedDeals)
    .where(and(eq(publishedDeals.status, 'expired'), isNotNull(publishedDeals.expiredAt)))
    .orderBy(desc(publishedDeals.expiredAt), desc(publishedDeals.id))
    .limit(limit);
}

/** Deals by id, returned in the order of `ids` (an issue's stored order).
 *  Ids that no longer exist are dropped. */
export async function dealsById(ids: number[]): Promise<Deal[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(publishedDeals).where(inArray(publishedDeals.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((d): d is Deal => d != null);
}

/** `booked_claim` events for the given deals — the only source of the
 *  „{n} prenumeratorių užsisakė" count. Identified subscribers only: the site
 *  records anonymous claims too (a forwarded mail, a link without `s=`), but
 *  those are unbounded per IP and the label says *subscribers*. */
export async function bookedEvents(dealIds: number[]): Promise<DealEvent[]> {
  if (dealIds.length === 0) return [];
  return db
    .select({ dealId: dealEvents.dealId, kind: dealEvents.kind })
    .from(dealEvents)
    .where(
      and(
        inArray(dealEvents.dealId, dealIds),
        eq(dealEvents.kind, 'booked_claim'),
        isNotNull(dealEvents.subscriberId),
      ),
    );
}
