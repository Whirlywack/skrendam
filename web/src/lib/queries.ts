import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  candidates, candidateTemplateMatches, dealTemplates, contentDrafts,
  publishedDeals, scanRuns,
} from '@/db/generated/schema';

export async function getQueueRows() {
  return db
    .select({
      matchId: candidateTemplateMatches.id,
      score: candidateTemplateMatches.matchScore,
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
    .leftJoin(publishedDeals, eq(publishedDeals.candidateId, candidates.id))
    .orderBy(desc(candidateTemplateMatches.matchScore));
}

export async function getCandidateRow(matchId: number) {
  const rows = await getQueueRows();
  return rows.find((r) => r.matchId === matchId) ?? null;
}

export async function getLatestScanRun() {
  const [run] = await db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(1);
  return run ?? null;
}

export async function getPublishedDeals() {
  return db.select().from(publishedDeals).orderBy(desc(publishedDeals.publishedAt));
}
