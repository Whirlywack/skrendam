import { eq } from 'drizzle-orm';
import { db, issues } from '@/db';
import { unsubscribeUrl } from '../links';
import { activeSubscribers, sendable, wantsOrigin, type Plan, type Recipient } from '../subscribers';
import { sendMail, type OutgoingMail } from './client';
import { renderInstant, type Deal } from './render';

export type IssueKind = 'paid_digest' | 'free_nurture' | 'instant';

/** Everything a stream touches outside pure code, so `sendInstant` can be
 *  exercised with fakes. `defaultDeps` wires the real db and Resend. */
export interface SendDeps {
  recipients: (plan: Plan) => Promise<Recipient[]>;
  send: (m: OutgoingMail) => Promise<{ ok: boolean; error?: string }>;
  insertIssue: (kind: IssueKind, dealIds: number[], expiredIds: number[]) => Promise<number>;
  finishIssue: (id: number, stats: SendStats) => Promise<void>;
  now: () => Date;
}

/** Stored as `issues.stats`. Counters only — real numbers, never estimates. */
export interface SendStats {
  attempted: number;
  sent: number;
  failed: number;
  /** Rows with no unsubscribe token: no link, no mail (spec §9). */
  skipped_no_token: number;
  /** Rows whose `prefs.origins` exclude the deal's origin. */
  skipped_origin: number;
  /** Set when the whole stream was skipped because `RESEND_API_KEY` is unset. */
  skipped_no_key?: boolean;
}

export function zeroStats(): SendStats {
  return { attempted: 0, sent: 0, failed: 0, skipped_no_token: 0, skipped_origin: 0 };
}

/** Paid instant stream: one deal, the minute it is published. Paid
 *  subscribers only; a single deal is always immediate, so the rare
 *  archetype changes nothing here. The `issues` row is written first so
 *  every tracked link carries its id, and finished with the stats whatever
 *  happened per recipient — a failed send is counted, never thrown. */
export async function sendInstant(
  deal: Deal,
  deps: SendDeps,
): Promise<{ issueId: number; stats: SendStats }> {
  const issueId = await deps.insertIssue('instant', [deal.id], []);
  const stats = zeroStats();
  const recipients = await deps.recipients('paid');
  for (const r of recipients) {
    if (!sendable(r)) {
      stats.skipped_no_token += 1;
      continue;
    }
    if (!wantsOrigin(r, deal.origin)) {
      stats.skipped_origin += 1;
      continue;
    }
    stats.attempted += 1;
    const { subject, html, text } = renderInstant(deal, r, issueId);
    const mail: OutgoingMail = {
      to: r.email,
      subject,
      html,
      text,
      unsubscribeUrl: unsubscribeUrl(r.unsubscribeToken!),
    };
    let result: { ok: boolean; error?: string };
    try {
      result = await deps.send(mail);
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (result.ok) {
      stats.sent += 1;
    } else {
      stats.failed += 1;
      console.error(`[email] instant issue ${issueId}: send to subscriber ${r.id} failed: ${result.error ?? 'unknown'}`);
    }
  }
  await deps.finishIssue(issueId, stats);
  return { issueId, stats };
}

/** Real db + Resend. `insertIssue` leaves `sent_at` null until `finishIssue`
 *  stamps it together with the stats, so a crash mid-stream shows on the
 *  Letters page as an unfinished issue rather than a silent success. */
export const defaultDeps: SendDeps = {
  recipients: activeSubscribers,
  send: sendMail,
  async insertIssue(kind, dealIds, expiredIds) {
    const [row] = await db
      .insert(issues)
      .values({
        kind,
        dealIds,
        expiredDealIds: expiredIds,
        sentAt: null,
        stats: null,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: issues.id });
    return row.id;
  },
  async finishIssue(id, stats) {
    await db
      .update(issues)
      .set({ sentAt: new Date().toISOString(), stats })
      .where(eq(issues.id, id));
  },
  now: () => new Date(),
};
