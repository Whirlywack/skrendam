import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  publishedDeals,
  candidates,
  candidateTemplateMatches,
  dealTemplates,
  travelMoments,
} from '@/db/generated/schema';
import type { CollectionFilter } from './collections';

// Dedup guard: candidate_template_matches has no composite unique constraint on
// (candidate_id, deal_template_id) yet — proper fix is a deferred migration (out-of-scope §2).
const INSPIRATION_LIMIT = 12;

function dealBase() {
  return db.select({
    pd: publishedDeals,
    score: candidateTemplateMatches.matchScore,
    snapshot: candidates.itinerarySnapshot,
    candLastSeen: candidates.lastSeenAt,
  })
    .from(publishedDeals)
    .leftJoin(candidates, eq(publishedDeals.candidateId, candidates.id))
    .leftJoin(candidateTemplateMatches, and(
      eq(candidateTemplateMatches.candidateId, publishedDeals.candidateId),
      eq(candidateTemplateMatches.dealTemplateId, publishedDeals.dealTemplateId)));
}

function dedupeById<T extends { pd: { id: number } }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter((r) => {
    if (seen.has(r.pd.id)) return false;
    seen.add(r.pd.id);
    return true;
  });
}

export async function getLiveDeals() {
  return dedupeById(await dealBase().where(eq(publishedDeals.status, 'live')).orderBy(desc(publishedDeals.publishedAt)));
}

export async function getInspirationDeals(limit = INSPIRATION_LIMIT) {
  // Dedupe BEFORE limiting: the candidate_template_matches join can fan out (no
  // composite unique constraint yet), so .limit() at the SQL level could return
  // fewer than `limit` distinct deals. Fetch-then-slice (mirrors getSimilarDeals).
  return dedupeById(
    await dealBase().where(eq(publishedDeals.status, 'expired')).orderBy(desc(publishedDeals.publishedAt)),
  ).slice(0, limit);
}

export async function getDeal(id: number) {
  const rows = await dealBase().where(eq(publishedDeals.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSimilarDeals(
  opts: { excludeId: number | string; zone?: string | null; origin?: string | null },
  limit = 3,
) {
  const excludeId = Number(opts.excludeId);

  // Fetch zone-matched live deals (excluding self)
  const zoneRows: Awaited<ReturnType<typeof dealBase>> = opts.zone
    ? await dealBase()
      .where(and(eq(publishedDeals.status, 'live'), eq(publishedDeals.zone, opts.zone)))
      .orderBy(desc(publishedDeals.publishedAt))
    : [];

  const zoneDeduped = dedupeById(zoneRows).filter((r) => r.pd.id !== excludeId);

  if (zoneDeduped.length >= limit) return zoneDeduped.slice(0, limit);

  // Top-up with same-origin live deals
  const originRows: Awaited<ReturnType<typeof dealBase>> = opts.origin
    ? await dealBase()
      .where(and(eq(publishedDeals.status, 'live'), eq(publishedDeals.origin, opts.origin)))
      .orderBy(desc(publishedDeals.publishedAt))
    : [];

  const merged = dedupeById([
    ...zoneDeduped,
    ...originRows.filter((r) => r.pd.id !== excludeId),
  ]);

  return merged.slice(0, limit);
}

export async function getCollectionDeals(filter: CollectionFilter) {
  if (filter.kind === 'origin') {
    return dedupeById(
      await dealBase()
        .where(and(eq(publishedDeals.status, 'live'), eq(publishedDeals.origin, filter.iata)))
        .orderBy(desc(publishedDeals.publishedAt)),
    );
  }

  if (filter.kind === 'zone') {
    return dedupeById(
      await dealBase()
        .where(and(eq(publishedDeals.status, 'live'), eq(publishedDeals.zone, filter.zone)))
        .orderBy(desc(publishedDeals.publishedAt)),
    );
  }

  // kind === 'moment': resolve travel moment → template ids → deals
  const tms = await db
    .select({ id: travelMoments.id })
    .from(travelMoments)
    .where(eq(travelMoments.slug, filter.slug));

  if (tms.length === 0) return [];

  const tpls = await db
    .select({ id: dealTemplates.id })
    .from(dealTemplates)
    .where(inArray(dealTemplates.travelMomentId, tms.map((t) => t.id)));

  if (tpls.length === 0) return [];

  return dedupeById(
    await dealBase()
      .where(
        and(
          eq(publishedDeals.status, 'live'),
          inArray(
            publishedDeals.dealTemplateId,
            tpls.map((t) => t.id),
          ),
        ),
      )
      .orderBy(desc(publishedDeals.publishedAt)),
  );
}
