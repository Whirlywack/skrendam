import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db, dealEvents, issues, publishedDeals } from '@/db';
import type { Deal } from './email/render';
import type { DealEvent, IssueKind } from './letters';

export type Issue = typeof issues.$inferSelect;

/** Every assembled letter, newest first. */
export async function listIssues(): Promise<Issue[]> {
  return db.select().from(issues).orderBy(desc(issues.createdAt), desc(issues.id)).limit(100);
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

/** Live deals, newest first. */
export async function liveDeals(): Promise<Deal[]> {
  return db
    .select()
    .from(publishedDeals)
    .where(eq(publishedDeals.status, 'live'))
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
 *  „{n} prenumeratorių užsisakė" count. */
export async function bookedEvents(dealIds: number[]): Promise<DealEvent[]> {
  if (dealIds.length === 0) return [];
  return db
    .select({ dealId: dealEvents.dealId, kind: dealEvents.kind })
    .from(dealEvents)
    .where(and(inArray(dealEvents.dealId, dealIds), eq(dealEvents.kind, 'booked_claim')));
}
