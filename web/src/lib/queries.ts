import { cache } from 'react';
import { and, count, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidates, candidateTemplateMatches, dealPriceChecks, dealTemplates, contentDrafts,
  publishedDeals, routes, scanRuns, scanRequests,
} from '@/db/generated/schema';
import { LIVE_STATUSES } from './statuses';

// ---------------------------------------------------------------------------
// Private base builder — select + joins shared by queue and point-lookup.
// ---------------------------------------------------------------------------
function queueBase() {
  return db
    .select({
      matchId: candidateTemplateMatches.id,
      score: candidateTemplateMatches.matchScore,
      score100: candidateTemplateMatches.score0100,
      scoreV2: candidateTemplateMatches.scoreV2,
      qualityTier: candidateTemplateMatches.qualityTier,
      archetype: candidateTemplateMatches.archetype,
      demandSignals: candidateTemplateMatches.demandSignals,
      reason: candidateTemplateMatches.reasonText,
      gates: candidateTemplateMatches.gateResults,
      templateId: dealTemplates.id,
      templateLabel: dealTemplates.publicLabel,
      templateName: dealTemplates.name,
      templatePriority: dealTemplates.priority,
      newsletterTag: dealTemplates.newsletterTag,
      headline: contentDrafts.headline,
      hook: contentDrafts.tiktokHook,
      news: contentDrafts.newsletterSnippet,
      body: contentDrafts.body,
      publishedId: publishedDeals.id,
      c: candidates,
    })
    .from(candidateTemplateMatches)
    .innerJoin(candidates, eq(candidateTemplateMatches.candidateId, candidates.id))
    .innerJoin(dealTemplates, eq(candidateTemplateMatches.dealTemplateId, dealTemplates.id))
    .leftJoin(contentDrafts, and(
      eq(contentDrafts.candidateId, candidates.id),
      eq(contentDrafts.dealTemplateId, dealTemplates.id),
    ))
    .leftJoin(publishedDeals, eq(publishedDeals.candidateId, candidates.id));
}

// cache(): the app layout and the page it wraps both need these on every
// navigation — per-request memoization halves the DB round-trips
// (review 2026-08-22).
export const getQueueRows = cache(async (includeExpired = false) => {
  // Expired candidates are engine history, not review work — they polluted every
  // count and queue group (B3). The Review page's "History" scope opts back in.
  const base = includeExpired
    ? queueBase()
    : queueBase().where(ne(candidates.status, 'expired'));
  const rows = await base.orderBy(desc(candidateTemplateMatches.matchScore));
  // A candidate with multiple published_deals rows fans out the same matchId.
  // Keep only the first occurrence per matchId.
  const seen = new Set<number>();
  return rows.filter((r) => {
    if (seen.has(r.matchId)) return false;
    seen.add(r.matchId);
    return true;
  });
});

export async function getCandidateRow(matchId: number) {
  const rows = await queueBase()
    .where(eq(candidateTemplateMatches.id, matchId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRouteOrigins(): Promise<string[]> {
  // Origin tabs come from the routes table, not from today's candidates, so a
  // city with zero finds still shows (with a 0) and TLL appears the day its
  // routes are seeded.
  const rows = await db
    .selectDistinct({ origin: routes.origin })
    .from(routes)
    .where(eq(routes.enabled, true))
    .orderBy(routes.origin);
  return rows.map((r) => r.origin);
}

// Two readers, never one: the newest row regardless of status turned every
// orphaned "running" row into a phantom scan on Today, Review and Scan health
// (desk journey review 2026-09-11, blocker 1). Counts and health come from the
// latest FINISHED run; the running row only says "since HH:MM".
export const getLatestFinishedScanRun = cache(async () => {
  const [run] = await db
    .select()
    .from(scanRuns)
    .where(ne(scanRuns.status, 'running'))
    .orderBy(desc(scanRuns.startedAt))
    .limit(1);
  return run ?? null;
})

export const getRunningScanRun = cache(async () => {
  const [run] = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.status, 'running'))
    .orderBy(desc(scanRuns.startedAt))
    .limit(1);
  return run ?? null;
})

export const getPublishedDeals = cache(async () => {
  return db.select().from(publishedDeals).orderBy(desc(publishedDeals.publishedAt));
})

/** How many `deal_price_checks` rows each deal has — one grouped query for
 *  the Live board's "N checks" fact. Deals with no row are simply absent. */
export const getDealCheckCounts = cache(async (): Promise<Record<number, number>> => {
  const rows = await db
    .select({ dealId: dealPriceChecks.dealId, n: count() })
    .from(dealPriceChecks)
    .groupBy(dealPriceChecks.dealId);
  return Object.fromEntries(rows.map((r) => [r.dealId, r.n]));
})

export async function getRecentScanRuns(limit = 20) {
  return db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(limit);
}

export const getPendingScanRequests = cache(async () => {
  return db
    .select()
    .from(scanRequests)
    .where(inArray(scanRequests.status, ['queued', 'running']))
    .orderBy(desc(scanRequests.createdAt));
})

// ---------------------------------------------------------------------------
// Route signals for the queue's context chips (routeContext.ts): what is LIVE
// per route, and what the curator recently dismissed. One cached pair of
// queries per request, matched in memory.
// ---------------------------------------------------------------------------
export const getRouteSignals = cache(async () => {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [live, rejected] = await Promise.all([
    db
      .select({
        id: publishedDeals.id,
        origin: publishedDeals.origin,
        destination: publishedDeals.destination,
        tripType: publishedDeals.tripType,
        price: publishedDeals.price,
        headline: publishedDeals.headline,
      })
      .from(publishedDeals)
      .where(inArray(publishedDeals.status, [...LIVE_STATUSES])),
    db
      .select({
        origin: candidates.origin,
        destination: candidates.destination,
        price: candidates.price,
        lastSeenAt: candidates.lastSeenAt,
      })
      .from(candidates)
      .where(and(eq(candidates.status, 'rejected'), gte(candidates.lastSeenAt, cutoff))),
  ]);
  return { live, rejected };
});
