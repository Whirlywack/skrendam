'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { issues } from '@/db/generated/schema';
import { emailEnabled, sendMail } from '@/lib/email/client';
import { renderDigest, renderNurture, type MissedDeal } from '@/lib/email/render';
import {
  FREE_LETTER_MISSED,
  idList,
  pickDigest,
  pickNurture,
  withMissedFacts,
  type IssueKind,
  type IssueStats,
} from '@/lib/letters';
import {
  bookedEvents,
  dealsById,
  expiredDeals,
  getIssue,
  lastIssueOf,
  liveDeals,
} from '@/lib/letters-queries';
import { unsubscribeUrl } from '@/lib/links';
import { activeSubscribers, sendable, type Plan } from '@/lib/subscribers';

// ---------------------------------------------------------------------------
// Auth guard — re-checked inside EVERY action.
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}

function assertKind(kind: string): asserts kind is IssueKind {
  if (kind !== 'paid_digest' && kind !== 'free_nurture') throw new Error(`invalid issue kind: ${kind}`);
}

/** How many expired rows to consider for the nurture's „Ką praleidai" —
 *  more than the letter shows, so a row we later drop still leaves a pick. */
const EXPIRED_POOL = FREE_LETTER_MISSED * 4;

// ---------------------------------------------------------------------------
// Assemble: pick the deals by the rules in `lib/letters.ts`, save an unsent
// `issues` row, land on its preview. An empty pick is refused — an empty
// letter must never exist to be sent. No scheduler anywhere (decision D1).
// ---------------------------------------------------------------------------
export async function assembleIssue(kind: IssueKind): Promise<void> {
  await requireAdmin();
  assertKind(kind);

  let dealIds: number[];
  let expiredDealIds: number[] = [];
  if (kind === 'paid_digest') {
    const last = await lastIssueOf('paid_digest');
    dealIds = pickDigest(await liveDeals(), last?.sentAt ?? null).map((d) => d.id);
  } else {
    const [live, expired] = await Promise.all([liveDeals(), expiredDeals(EXPIRED_POOL)]);
    const events = await bookedEvents(expired.map((d) => d.id));
    const { fresh, missed } = pickNurture([...live, ...expired], events, new Date());
    // The nurture subject promises new finds; without any there is no letter.
    dealIds = fresh.map((d) => d.id);
    expiredDealIds = missed.map((d) => d.id);
  }

  if (dealIds.length === 0) redirect(`/letters?empty=${kind}`);

  const [row] = await db
    .insert(issues)
    .values({
      kind,
      sentAt: null,
      dealIds,
      expiredDealIds,
      stats: null,
      createdAt: new Date().toISOString(),
    })
    .returning({ id: issues.id });

  revalidatePath('/letters');
  redirect(`/letters/${row.id}`);
}

// ---------------------------------------------------------------------------
// Send: one render per recipient (the digest orders deals by each reader's
// moments), sequential sends, tallies into `stats`, then `sent_at`. Without a
// Resend key nothing goes out and `sent_at` stays NULL — the row records
// `skipped_no_key` and can be sent later, once the key is configured.
// ---------------------------------------------------------------------------
export async function sendIssue(id: number): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) throw new Error(`invalid issue id: ${id}`);

  const issue = await getIssue(id);
  if (!issue) throw new Error(`issue ${id} not found`);
  if (issue.sentAt != null) throw new Error(`issue ${id} was already sent at ${issue.sentAt}`);
  const kind = issue.kind;
  assertKind(kind);

  const stats: IssueStats = { attempted: 0, sent: 0, failed: 0, skipped_no_token: 0 };

  if (!emailEnabled()) {
    await db
      .update(issues)
      .set({ stats: { ...stats, skipped_no_key: true } })
      .where(eq(issues.id, id));
    revalidatePath('/letters');
    revalidatePath(`/letters/${id}`);
    return;
  }

  // Re-read the deals at send time: a fare that died since assembly must not
  // reach a paid inbox as a live find.
  const picked = await dealsById(idList(issue.dealIds));
  const deals = picked.filter((d) => d.status === 'live');
  stats.dropped_expired = picked.length - deals.length;
  if (deals.length === 0) throw new Error(`issue ${id}: none of its deals are live any more — assemble a new one`);

  let missed: MissedDeal[] = [];
  if (kind === 'free_nurture') {
    const expiredIds = idList(issue.expiredDealIds);
    const [rows, events] = await Promise.all([dealsById(expiredIds), bookedEvents(expiredIds)]);
    missed = rows
      .filter((d): d is typeof d & { expiredAt: string } => d.expiredAt != null)
      .map((d) => withMissedFacts(d, events));
  }

  const plan: Plan = kind === 'paid_digest' ? 'paid' : 'free';
  const recipients = await activeSubscribers(plan);
  const errors: string[] = [];

  for (const r of recipients) {
    if (!sendable(r)) {
      stats.skipped_no_token += 1;
      continue;
    }
    stats.attempted += 1;
    const rendered =
      kind === 'paid_digest' ? renderDigest(deals, r, id) : renderNurture(deals, missed, r, id);
    const res = await sendMail({
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: unsubscribeUrl(r.unsubscribeToken!),
    });
    if (res.ok) {
      stats.sent += 1;
    } else {
      stats.failed += 1;
      if (errors.length < 5) errors.push(`${r.email}: ${res.error}`);
    }
  }
  if (errors.length) stats.errors = errors;

  await db
    .update(issues)
    .set({ sentAt: new Date().toISOString(), stats })
    .where(eq(issues.id, id));

  revalidatePath('/letters');
  revalidatePath(`/letters/${id}`);
}
