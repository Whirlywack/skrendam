import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { candidateTemplateMatches, db, dealEvents, issues, publishedDeals, subscribers } from '@/db';
import type { Issue } from './letters-queries';
import { prefsOf } from './subscribers-queries';
import type { DealFacts, EventRow, SubFacts } from './stats';

/** Fetch side of WP8 — read-only selects shaped for `stats.ts`. Nothing here
 *  aggregates; the pure functions do, over the rows these return. */

const EVENT_KINDS: EventRow['kind'][] = ['click', 'booked_claim'];

/** Tracked-link events attributed to one issue (`deal_events.issue_id`).
 *  Only the two kinds the breakdowns know; anything else the site may log
 *  later is left out rather than miscounted. */
export async function eventsForIssue(issueId: number): Promise<EventRow[]> {
  const rows = await db
    .select({
      dealId: dealEvents.dealId,
      issueId: dealEvents.issueId,
      subscriberId: dealEvents.subscriberId,
      kind: dealEvents.kind,
      createdAt: dealEvents.createdAt,
    })
    .from(dealEvents)
    .where(and(eq(dealEvents.issueId, issueId), inArray(dealEvents.kind, EVENT_KINDS)));
  return rows.map((r) => ({ ...r, kind: r.kind as EventRow['kind'] }));
}

const ARCHETYPES = new Set<NonNullable<DealFacts['archetype']>>(['date', 'rare', 'destination']);

/** Origin, newsletter tag and archetype for the given deals, keyed by deal
 *  id. The archetype lives on `candidate_template_matches`, joined by the
 *  deal's `candidate_id` + `deal_template_id`; a value outside the known
 *  union (or no match row) maps to null, which `breakdown` files under
 *  „none". Ids that no longer exist are simply absent from the map. */
export async function dealFacts(ids: number[]): Promise<Map<number, DealFacts>> {
  const facts = new Map<number, DealFacts>();
  if (ids.length === 0) return facts;
  const rows = await db
    .select({
      id: publishedDeals.id,
      origin: publishedDeals.origin,
      newsletterTag: publishedDeals.newsletterTag,
      archetype: candidateTemplateMatches.archetype,
    })
    .from(publishedDeals)
    .leftJoin(
      candidateTemplateMatches,
      and(
        eq(candidateTemplateMatches.candidateId, publishedDeals.candidateId),
        eq(candidateTemplateMatches.dealTemplateId, publishedDeals.dealTemplateId),
      ),
    )
    .where(inArray(publishedDeals.id, ids));
  for (const r of rows) {
    const archetype = ARCHETYPES.has(r.archetype as NonNullable<DealFacts['archetype']>)
      ? (r.archetype as DealFacts['archetype'])
      : null;
    const prev = facts.get(r.id);
    // A candidate can carry more than one match row; keep the first one that
    // names an archetype rather than letting a later NULL overwrite it.
    if (prev && prev.archetype != null) continue;
    facts.set(r.id, { id: r.id, origin: r.origin, newsletterTag: r.newsletterTag, archetype });
  }
  return facts;
}

/** Every subscriber row, flattened to what the stats need. All rows — the
 *  TikTok table counts signups, and `conversionAfter` filters by dates and
 *  plan itself. Any `plan` other than `'paid'` is read as free. */
export async function subFacts(): Promise<SubFacts[]> {
  const rows = await db
    .select({
      id: subscribers.id,
      plan: subscribers.plan,
      prefs: subscribers.prefs,
      paidSince: subscribers.paidSince,
      createdAt: subscribers.createdAt,
    })
    .from(subscribers)
    .orderBy(asc(subscribers.id));
  return rows.map((r) => {
    const prefs = prefsOf(r);
    const utm = prefs.utm;
    const content =
      typeof utm === 'object' && utm !== null && !Array.isArray(utm)
        ? (utm as Record<string, unknown>).content
        : undefined;
    return {
      id: r.id,
      plan: r.plan === 'paid' ? 'paid' : 'free',
      moments: stringList(prefs.moments),
      origins: stringList(prefs.origins),
      utmContent: typeof content === 'string' && content !== '' ? content : null,
      paidSince: r.paidSince,
      createdAt: r.createdAt,
    };
  });
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Sent nurture issues, oldest first, so the caller can pair each with the
 *  next one's `sent_at` as its conversion window end. */
export async function nurtureIssuesOrdered(): Promise<Issue[]> {
  return db
    .select()
    .from(issues)
    .where(and(eq(issues.kind, 'free_nurture'), isNotNull(issues.sentAt)))
    .orderBy(asc(issues.sentAt), asc(issues.id));
}
