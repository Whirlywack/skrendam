'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import {
  candidates,
  contentDrafts,
  dealTemplates,
  publishedDeals,
  scanRequests,
} from '@/db/generated/schema';

// ---------------------------------------------------------------------------
// Auth guard — re-checked inside EVERY action (proxy can skip middleware on
// action POSTs, so we must not rely solely on the proxy matcher).
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}

// ---------------------------------------------------------------------------
// Task 14 — Candidate status
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = new Set([
  'new', 'seen', 'maybe', 'approved', 'edited', 'rejected', 'expired',
]);

export async function setCandidateStatus(
  candidateId: number,
  status: string,
): Promise<void> {
  await requireAdmin();
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error(`invalid status: ${status}`);
  }
  await db
    .update(candidates)
    .set({ status })
    .where(eq(candidates.id, candidateId));
  revalidatePath('/queue');
  revalidatePath('/candidates/[id]', 'page');
}

// ---------------------------------------------------------------------------
// Task 14 — Content draft save (upsert)
// ---------------------------------------------------------------------------

export async function saveContentDraft(input: {
  candidateId: number;
  templateId: number;
  headline: string;
  hook: string;
  news: string;
}): Promise<void> {
  await requireAdmin();
  const now = new Date().toISOString();

  const res = await db
    .update(contentDrafts)
    .set({
      headline: input.headline,
      tiktokHook: input.hook,
      newsletterSnippet: input.news,
      status: 'edited',
      updatedAt: now,
    })
    .where(
      and(
        eq(contentDrafts.candidateId, input.candidateId),
        eq(contentDrafts.dealTemplateId, input.templateId),
      ),
    )
    .returning({ id: contentDrafts.id });

  if (res.length === 0) {
    // No existing draft — insert one.
    await db.insert(contentDrafts).values({
      candidateId: input.candidateId,
      dealTemplateId: input.templateId,
      headline: input.headline,
      tiktokHook: input.hook,
      newsletterSnippet: input.news,
      status: 'edited',
      createdBy: 'curator',
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/candidates/[id]', 'page');
}

// ---------------------------------------------------------------------------
// Task 15 — Publish deal → published_deals row
// ---------------------------------------------------------------------------

export async function publishDeal(input: {
  candidateId: number;
  templateId: number;
  headline: string;
  body?: string;
  tiktokHook?: string;
  validUntil?: string | null;
}): Promise<void> {
  await requireAdmin();

  const [cand] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!cand) throw new Error(`candidate ${input.candidateId} not found`);

  const [tmpl] = await db
    .select()
    .from(dealTemplates)
    .where(eq(dealTemplates.id, input.templateId));

  const now = new Date().toISOString();

  await db.insert(publishedDeals).values({
    candidateId: cand.id,
    dealTemplateId: input.templateId,
    publicLabel: tmpl?.publicLabel ?? null,
    newsletterTag: tmpl?.newsletterTag ?? null,
    headline: input.headline,
    body: input.body ?? null,
    tiktokHook: input.tiktokHook ?? null,
    origin: cand.origin,
    destination: cand.destination,
    zone: cand.zone,
    tripType: cand.tripType,
    travelDate: cand.travelDate,
    returnDate: cand.returnDate ?? null,
    price: cand.price,
    baselinePrice: cand.baselinePrice ?? null,
    discountPct: cand.discountPct ?? null,
    bookingUrl: (cand.itinerarySnapshot as Record<string, unknown> | null)?.booking_url as string | null ?? null,
    validUntil: input.validUntil ?? null,
    tier: 'free',
    status: 'live',
    publishedAt: now,
  });

  await db
    .update(candidates)
    .set({ status: 'approved' })
    .where(eq(candidates.id, cand.id));

  revalidatePath('/queue');
  revalidatePath('/published');
}

// ---------------------------------------------------------------------------
// Task 16 — Expire / republish a published deal
// ---------------------------------------------------------------------------

export async function expireDeal(id: number): Promise<void> {
  await requireAdmin();
  await db
    .update(publishedDeals)
    .set({ status: 'expired' })
    .where(eq(publishedDeals.id, id));
  revalidatePath('/published');
}

export async function republishDeal(id: number): Promise<void> {
  await requireAdmin();
  await db
    .update(publishedDeals)
    .set({ status: 'live', unverifiedSince: null })
    .where(eq(publishedDeals.id, id));
  revalidatePath('/published');
}

// ---------------------------------------------------------------------------
// Task 17 — Enqueue scan requests
// ---------------------------------------------------------------------------

export async function enqueueRecheck(candidateId: number): Promise<void> {
  await requireAdmin();
  await db.insert(scanRequests).values({
    kind: 'recheck',
    candidateId,
    status: 'queued',
    requestedBy: 'curator',
  });
  revalidatePath('/candidates/[id]', 'page');
  revalidatePath('/scans');
}

export async function enqueueScan(): Promise<void> {
  await requireAdmin();
  await db.insert(scanRequests).values({
    kind: 'full_scan',
    status: 'queued',
    requestedBy: 'curator',
  });
  revalidatePath('/scans');
}

export async function enqueueRecheckLive(): Promise<void> {
  await requireAdmin();
  const live = await db
    .select({ candidateId: publishedDeals.candidateId })
    .from(publishedDeals)
    .where(eq(publishedDeals.status, 'live'));
  if (live.length > 0) {
    await db.insert(scanRequests).values(
      live.map((d) => ({ kind: 'recheck', candidateId: d.candidateId, status: 'queued', requestedBy: 'curator' })),
    );
  }
  revalidatePath('/scans');
}
