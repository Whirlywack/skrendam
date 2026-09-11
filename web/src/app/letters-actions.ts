'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { issues } from '@/db/generated/schema';
import { emailEnabled } from '@/lib/email/client';
import { defaultLetterDeps, sendLetter } from '@/lib/email/streams';
import {
  FREE_LETTER_MISSED,
  idList,
  pickDigest,
  pickNurture,
  type IssueKind,
  type IssueStats,
  type SendOutcome,
} from '@/lib/letters';
import { bookedEvents, expiredDeals, getIssue, lastIssueOf, liveDeals } from '@/lib/letters-queries';

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

  // Nothing to put in the letter: no draft, back to the list with a banner
  // (`EMPTY_ASSEMBLY[kind]`) so the click is never a silent no-op.
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
// Send: `sendLetter` does the work (re-read deals, atomic `sent_at` claim,
// one render per recipient, stats). Without a Resend key nothing goes out and
// `sent_at` stays NULL — the row records `skipped_no_key` and can be sent
// later, once the key is configured. Every refusal comes back as a reason the
// button shows inline; only bad arguments throw.
// ---------------------------------------------------------------------------
export async function sendIssue(id: number): Promise<SendOutcome> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) throw new Error(`invalid issue id: ${id}`);

  const outcome = await trySend(id);
  revalidatePath('/letters');
  revalidatePath(`/letters/${id}`);
  return outcome;
}

async function trySend(id: number): Promise<SendOutcome> {
  const issue = await getIssue(id);
  if (!issue) return { ok: false, reason: 'not_found' };
  if (issue.sentAt != null) return { ok: false, reason: 'already_sent' };
  const kind = issue.kind;
  assertKind(kind);

  if (!emailEnabled()) {
    const stats: IssueStats = { attempted: 0, sent: 0, failed: 0, skipped_no_token: 0, skipped_no_key: true };
    await db.update(issues).set({ stats }).where(eq(issues.id, id));
    return { ok: false, reason: 'no_key' };
  }

  return sendLetter(
    { id, kind, dealIds: idList(issue.dealIds), expiredDealIds: idList(issue.expiredDealIds) },
    defaultLetterDeps,
  );
}
