import { and, eq, isNull } from 'drizzle-orm';
import { db, issues } from '@/db';
import {
  missedFacts,
  type DealEvent,
  type IssueKind as LetterKind,
  type IssueStats,
  type SendOutcome,
} from '../letters';
import { bookedEvents, dealsById } from '../letters-queries';
import { unsubscribeUrl } from '../links';
import { activeSubscribers, sendable, wantsOrigin, type Plan, type Recipient } from '../subscribers';
import { sendMail, type OutgoingMail } from './client';
import { renderDigest, renderInstant, renderNurture, type Deal, type MissedDeal } from './render';

export type IssueKind = 'paid_digest' | 'free_nurture' | 'instant';

/** Everything a stream touches outside pure code, so `sendInstant` can be
 *  exercised with fakes. `defaultDeps` wires the real db and Resend. */
export interface SendDeps {
  recipients: (plan: Plan) => Promise<Recipient[]>;
  send: (m: OutgoingMail) => Promise<{ ok: boolean; error?: string }>;
  insertIssue: (kind: IssueKind, dealIds: number[], expiredIds: number[]) => Promise<number>;
  /** `sentAt` null = nothing went out (no key); a timestamp = the stream ran. */
  finishIssue: (id: number, stats: SendStats, sentAt: string | null) => Promise<void>;
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
      idempotencyKey: idempotencyKey(issueId, r),
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
  await deps.finishIssue(issueId, stats, deps.now().toISOString());
  return { issueId, stats };
}

/** One key per (issue, subscriber): a re-run of the same loop cannot put a
 *  second copy in an inbox — Resend drops repeats for 24 h. */
function idempotencyKey(issueId: number, r: Recipient): string {
  return `issue-${issueId}-sub-${r.id}`;
}

// ---------------------------------------------------------------------------
// Curator-sent letters (paid digest, free nurture) — the pure half of
// `sendIssue` in `app/letters-actions.ts`.

export interface LetterDeps {
  /** The atomic claim: `UPDATE issues SET sent_at = $sentAt WHERE id = $id
   *  AND sent_at IS NULL`. True when this call won the row; false when a
   *  reload, a second tab or an earlier click already did — then nothing is
   *  sent and the stored stats are left alone. */
  claimIssue: (id: number, sentAt: string) => Promise<boolean>;
  dealsById: (ids: number[]) => Promise<Deal[]>;
  bookedEvents: (dealIds: number[]) => Promise<DealEvent[]>;
  recipients: (plan: Plan) => Promise<Recipient[]>;
  send: (m: OutgoingMail) => Promise<{ ok: boolean; error?: string }>;
  writeStats: (id: number, stats: IssueStats) => Promise<void>;
  now: () => Date;
}

/** The slice of an `issues` row `sendLetter` needs. */
export interface LetterIssue {
  id: number;
  kind: LetterKind;
  dealIds: number[];
  expiredDealIds: number[];
}

/** Send one assembled letter. Order matters: re-read the deals (a fare that
 *  died since assembly must not reach an inbox as live — and with none left
 *  the draft is refused untouched), claim `sent_at` atomically, then one
 *  render per recipient (the digest orders deals by each reader's moments),
 *  sequential sends, stats at the end. A crash mid-loop therefore shows as
 *  "sent, no stats" — honest, since mail did go out. */
export async function sendLetter(issue: LetterIssue, deps: LetterDeps): Promise<SendOutcome> {
  const picked = await deps.dealsById(issue.dealIds);
  const deals = picked.filter((d) => d.status === 'live');
  if (deals.length === 0) return { ok: false, reason: 'no_fresh' };

  const claimed = await deps.claimIssue(issue.id, deps.now().toISOString());
  if (!claimed) return { ok: false, reason: 'already_sent' };

  const stats: IssueStats = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped_no_token: 0,
    dropped_expired: picked.length - deals.length,
  };

  let missed: MissedDeal[] = [];
  if (issue.kind === 'free_nurture') {
    const [rows, events] = await Promise.all([
      deps.dealsById(issue.expiredDealIds),
      deps.bookedEvents(issue.expiredDealIds),
    ]);
    missed = missedFacts(rows, events);
  }

  const plan: Plan = issue.kind === 'paid_digest' ? 'paid' : 'free';
  const recipients = await deps.recipients(plan);
  const errors: string[] = [];

  for (const r of recipients) {
    if (!sendable(r)) {
      stats.skipped_no_token += 1;
      continue;
    }
    stats.attempted += 1;
    const rendered =
      issue.kind === 'paid_digest'
        ? renderDigest(deals, r, issue.id)
        : renderNurture(deals, missed, r, issue.id);
    const mail: OutgoingMail = {
      to: r.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: unsubscribeUrl(r.unsubscribeToken!),
      idempotencyKey: idempotencyKey(issue.id, r),
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
      if (errors.length < 5) errors.push(`${r.email}: ${result.error ?? 'unknown'}`);
    }
  }
  if (errors.length) stats.errors = errors;

  await deps.writeStats(issue.id, stats);
  return { ok: true, stats };
}

/** The stream when `RESEND_API_KEY` is unset: the `issues` row is still
 *  recorded so the Letters page shows what would have gone out, with
 *  `stats.skipped_no_key` and `sent_at` left NULL — nothing was sent. */
export async function recordSkippedNoKey(
  kind: IssueKind,
  dealIds: number[],
  deps: SendDeps,
): Promise<{ issueId: number; stats: SendStats }> {
  const issueId = await deps.insertIssue(kind, dealIds, []);
  const stats: SendStats = { ...zeroStats(), skipped_no_key: true };
  await deps.finishIssue(issueId, stats, null);
  return { issueId, stats };
}

/** Real db + Resend. `insertIssue` leaves `sent_at` null; `finishIssue`
 *  writes the stats and stamps `sent_at` only when the stream really ran —
 *  the no-key path passes null so the Letters page shows it as skipped, and
 *  a crash mid-stream shows as an unfinished issue, never a silent success. */
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
  async finishIssue(id, stats, sentAt) {
    await db
      .update(issues)
      .set({ sentAt, stats })
      .where(eq(issues.id, id));
  },
  now: () => new Date(),
};

/** Real db + Resend for the curator letters. */
export const defaultLetterDeps: LetterDeps = {
  async claimIssue(id, sentAt) {
    const rows = await db
      .update(issues)
      .set({ sentAt })
      .where(and(eq(issues.id, id), isNull(issues.sentAt)))
      .returning({ id: issues.id });
    return rows.length > 0;
  },
  dealsById,
  bookedEvents,
  recipients: activeSubscribers,
  send: sendMail,
  async writeStats(id, stats) {
    await db.update(issues).set({ stats }).where(eq(issues.id, id));
  },
  now: () => new Date(),
};
