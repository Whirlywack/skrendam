import { cache } from 'react';
import { and, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidates, candidateTemplateMatches, dealTemplates, contentDrafts,
  publishedDeals, routes, scanRuns, scanRequests,
} from '@/db/generated/schema';

// ---------------------------------------------------------------------------
// Private base builder — select + joins shared by queue and point-lookup.
// ---------------------------------------------------------------------------
function queueBase() {
  return db
    .select({
      matchId: candidateTemplateMatches.id,
      score: candidateTemplateMatches.matchScore,
      score100: candidateTemplateMatches.score0100,
      qualityTier: candidateTemplateMatches.qualityTier,
      reason: candidateTemplateMatches.reasonText,
      gates: candidateTemplateMatches.gateResults,
      templateId: dealTemplates.id,
      templateLabel: dealTemplates.publicLabel,
      templateName: dealTemplates.name,
      headline: contentDrafts.headline,
      hook: contentDrafts.tiktokHook,
      news: contentDrafts.newsletterSnippet,
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

export const getLatestScanRun = cache(async () => {
  const [run] = await db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(1);
  return run ?? null;
})

export const getPublishedDeals = cache(async () => {
  return db.select().from(publishedDeals).orderBy(desc(publishedDeals.publishedAt));
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
        price: publishedDeals.price,
        headline: publishedDeals.headline,
      })
      .from(publishedDeals)
      .where(eq(publishedDeals.status, 'live')),
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
