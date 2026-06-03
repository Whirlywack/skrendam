import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals, candidates, candidateTemplateMatches } from '@/db/generated/schema';

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
  return dedupeById(await dealBase().where(eq(publishedDeals.status, 'expired')).orderBy(desc(publishedDeals.publishedAt)).limit(limit));
}

export async function getDeal(id: number) {
  const rows = await dealBase().where(eq(publishedDeals.id, id)).limit(1);
  return rows[0] ?? null;
}
