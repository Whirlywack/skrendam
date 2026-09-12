import { cache } from 'react';
import { and, desc, eq, inArray, isNotNull, count } from 'drizzle-orm';
import { db } from '@/db';
import {
  publishedDeals,
  candidates,
  candidateTemplateMatches,
  dealPriceChecks,
  dealTemplates,
  issues,
  travelMoments,
} from '@/db/generated/schema';
import type { CollectionFilter } from './collections';
import { FREE_WINDOW } from './scarcity';
import { LIVE_STATUSES } from './statuses';

// Dedup guard: candidate_template_matches has no composite unique constraint on
// (candidate_id, deal_template_id) yet — proper fix is a deferred migration (out-of-scope §2).
const INSPIRATION_LIMIT = 12;

function dealBase() {
  return db.select({
    pd: publishedDeals,
    score: candidateTemplateMatches.matchScore,
    score100: candidateTemplateMatches.score0100,
    scoreV2: candidateTemplateMatches.scoreV2,
    archetype: candidateTemplateMatches.archetype,
    demandSignals: candidateTemplateMatches.demandSignals,
    qualityTier: candidateTemplateMatches.qualityTier,
    snapshot: candidates.itinerarySnapshot,
    candLastSeen: candidates.lastSeenAt,
    verifiedAt: candidates.verifiedAt,
  })
    .from(publishedDeals)
    .leftJoin(candidates, eq(publishedDeals.candidateId, candidates.id))
    .leftJoin(candidateTemplateMatches, and(
      eq(candidateTemplateMatches.candidateId, publishedDeals.candidateId),
      eq(candidateTemplateMatches.dealTemplateId, publishedDeals.dealTemplateId)));
}

/** "Visible on the site" = live OR changed (WP9). Never compare status to a
 *  literal 'live' — a changed deal is still a deal, shown at its current price. */
function isLive() {
  return inArray(publishedDeals.status, [...LIVE_STATUSES]);
}

function dedupeById<T extends { pd: { id: number } }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter((r) => {
    if (seen.has(r.pd.id)) return false;
    seen.add(r.pd.id);
    return true;
  });
}

// publishedAt ties (batch publishes, seeds) need the id tiebreaker so every
// free/locked boundary derivation orders identically (review 08-28).
const LIVE_ORDER = [desc(publishedDeals.publishedAt), desc(publishedDeals.id)];

/** The edition the home page is assembling = sent letters + 1. Instant paid
 *  mails are per-deal, not editions, so they never bump the number. */
export async function getEditionNumber(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(issues)
    .where(and(isNotNull(issues.sentAt), inArray(issues.kind, ['paid_digest', 'free_nurture'])));
  return Number(row?.n ?? 0) + 1;
}

export async function getLiveDeals() {
  return dedupeById(await dealBase().where(isLive()).orderBy(...LIVE_ORDER));
}

/**
 * Ids of the free-window deals (newest FREE_WINDOW live/changed). Everything live
 * outside this set is "locked" — shown price-free on the homepage, excluded
 * from similar/collection lists, and its detail page redirects to signup.
 * cache(): one consistent snapshot per request (deal page asks twice).
 */
export const getFreeWindowIds = cache(async (): Promise<Set<number>> => {
  const rows = await db
    .select({ id: publishedDeals.id })
    .from(publishedDeals)
    .where(isLive())
    .orderBy(...LIVE_ORDER)
    .limit(FREE_WINDOW);
  return new Set(rows.map((r) => r.id));
});

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

/** Newest N verification checks for one deal (WP9). */
export async function getPriceChecks(dealId: number, limit = 3) {
  return db
    .select({ checkedAt: dealPriceChecks.checkedAt, price: dealPriceChecks.price, available: dealPriceChecks.available })
    .from(dealPriceChecks)
    .where(eq(dealPriceChecks.dealId, dealId))
    .orderBy(desc(dealPriceChecks.checkedAt))
    .limit(limit);
}

export async function getSimilarDeals(
  opts: { excludeId: number | string; zone?: string | null; origin?: string | null },
  limit = 3,
) {
  const excludeId = Number(opts.excludeId);
  // Locked deals never appear with prices outside the homepage teaser rows.
  const freeIds = await getFreeWindowIds();

  // Fetch zone-matched live deals (excluding self)
  const zoneRows: Awaited<ReturnType<typeof dealBase>> = opts.zone
    ? await dealBase()
      .where(and(isLive(), eq(publishedDeals.zone, opts.zone)))
      .orderBy(...LIVE_ORDER)
    : [];

  const zoneDeduped = dedupeById(zoneRows)
    .filter((r) => r.pd.id !== excludeId && freeIds.has(r.pd.id));

  if (zoneDeduped.length >= limit) return zoneDeduped.slice(0, limit);

  // Top-up with same-origin live deals
  const originRows: Awaited<ReturnType<typeof dealBase>> = opts.origin
    ? await dealBase()
      .where(and(isLive(), eq(publishedDeals.origin, opts.origin)))
      .orderBy(...LIVE_ORDER)
    : [];

  const merged = dedupeById([
    ...zoneDeduped,
    ...originRows.filter((r) => r.pd.id !== excludeId && freeIds.has(r.pd.id)),
  ]);

  return merged.slice(0, limit);
}

export async function getCollectionDeals(filter: CollectionFilter) {
  // Collection pages still wear V1 dress (no locked-row rendering yet), so
  // locked deals are excluded rather than leaked with full prices — but their
  // COUNT is returned so the page never claims emptiness while deals exist
  // in the letter (review 08-28).
  const freeIds = await getFreeWindowIds();
  const split = <T extends { pd: { id: number } }>(rows: T[]) => ({
    deals: rows.filter((r) => freeIds.has(r.pd.id)),
    lockedCount: rows.filter((r) => !freeIds.has(r.pd.id)).length,
  });

  switch (filter.kind) {
    case 'origin':
      return split(dedupeById(
        await dealBase()
          .where(and(isLive(), eq(publishedDeals.origin, filter.iata)))
          .orderBy(...LIVE_ORDER),
      ));

    case 'zone':
      return split(dedupeById(
        await dealBase()
          .where(and(isLive(), eq(publishedDeals.zone, filter.zone)))
          .orderBy(...LIVE_ORDER),
      ));

    case 'destinations':
      return split(dedupeById(
        await dealBase()
          .where(and(isLive(), inArray(publishedDeals.destination, filter.iatas)))
          .orderBy(...LIVE_ORDER),
      ));

    case 'moment': {
      // Resolve travel moment → template ids → deals
      const tms = await db
        .select({ id: travelMoments.id })
        .from(travelMoments)
        .where(eq(travelMoments.slug, filter.slug));

      if (tms.length === 0) return { deals: [], lockedCount: 0 };

      const tpls = await db
        .select({ id: dealTemplates.id })
        .from(dealTemplates)
        .where(inArray(dealTemplates.travelMomentId, tms.map((t) => t.id)));

      if (tpls.length === 0) return { deals: [], lockedCount: 0 };

      return split(dedupeById(
        await dealBase()
          .where(
            and(
              isLive(),
              inArray(
                publishedDeals.dealTemplateId,
                tpls.map((t) => t.id),
              ),
            ),
          )
          .orderBy(...LIVE_ORDER),
      ));
    }

    default: {
      // Exhaustiveness guard — a new CollectionFilter kind must be handled
      // above; without this a future kind would silently fall through to
      // whichever case happened to be last (review finding, WP0).
      const _exhaustive: never = filter;
      throw new Error(`getCollectionDeals: unhandled filter kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
