import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals, candidates, candidateTemplateMatches } from '@/db/generated/schema';

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

export async function getLiveDeals() {
  return dealBase().where(eq(publishedDeals.status, 'live')).orderBy(desc(publishedDeals.publishedAt));
}

export async function getInspirationDeals(limit = 12) {
  return dealBase().where(eq(publishedDeals.status, 'expired')).orderBy(desc(publishedDeals.publishedAt)).limit(limit);
}

export async function getDeal(id: number) {
  const rows = await dealBase().where(eq(publishedDeals.id, id)).limit(1);
  return rows[0] ?? null;
}
