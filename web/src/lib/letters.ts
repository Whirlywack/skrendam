// Letter cadence constants — spec §6, module-level like the rest of the desk.
// There is no scheduler (decision D1: no always-on host); the digest labels are
// informational, shown on the Letters page next to the send button.

import type { Deal, MissedDeal } from './email/render';

/** Days between free nurture letters. */
export const FREE_LETTER_CADENCE_DAYS = 10;
/** Fresh (still live) deals in a free letter. */
export const FREE_LETTER_FRESH = 2;
/** Expired deals shown under „Ką praleidai" in a free letter. */
export const FREE_LETTER_MISSED = 3;

/** Paid digest send slot, Europe/Vilnius — a label, not a trigger. */
export const DIGEST_DAY = 'Thursday';
export const DIGEST_TIME = '07:00';

/** The two curator-assembled letters. The instant stream (`'instant'`) is
 *  sent from the publish action, not from the Letters page. */
export type IssueKind = 'paid_digest' | 'free_nurture';

export const ISSUE_LABEL: Record<IssueKind, string> = {
  paid_digest: 'Paid digest',
  free_nurture: 'Free nurture',
};

/** The slice of a `deal_events` row the pickers read. */
export interface DealEvent {
  dealId: number;
  kind: string;
}

// ---------------------------------------------------------------------------
// Assembly — pure. Timestamps are drizzle `mode: 'string'` values
// (`2026-09-01 10:00:00`, no zone); every comparison here is between two of
// them from the same column family, so parsing them the same way is enough.

function ts(s: string): number {
  return new Date(s.replace(' ', 'T')).getTime();
}

/** Paid Thursday digest: every live deal published after the last sent
 *  digest (all live deals when there was none), newest first. A deal
 *  published exactly at the cutoff already went out. */
export function pickDigest(deals: Deal[], lastDigestAt: string | null): Deal[] {
  const cutoff = lastDigestAt == null ? -Infinity : ts(lastDigestAt);
  return deals
    .filter((d) => d.status === 'live' && ts(d.publishedAt) > cutoff)
    .sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt));
}

/** Attach the two „Ką praleidai" facts to an expired deal: how many hours
 *  the fare stayed live (`published_at → expired_at`, whole hours) and the
 *  real booked count from `deal_events` — never estimated. */
export function withMissedFacts(deal: Deal & { expiredAt: string }, events: DealEvent[]): MissedDeal {
  const lastedHours = Math.max(0, Math.round((ts(deal.expiredAt) - ts(deal.publishedAt)) / 3_600_000));
  const bookedCount = events.filter((e) => e.kind === 'booked_claim' && e.dealId === deal.id).length;
  return { ...deal, lastedHours, bookedCount };
}

function hasExpiredAt(d: Deal): d is Deal & { expiredAt: string } {
  return d.expiredAt != null;
}

/** The „Ką praleidai" rows from a set of expired deals, in the given order:
 *  rows without `expired_at` are skipped (no honest "lasted" fact without
 *  it), and so are rows that lasted under an hour — migration 0014 backfilled
 *  `expired_at = published_at` for old curator-expired deals, and „išbuvo
 *  0 val." is a claim the letter must never make. Used at assembly
 *  (`pickNurture`), at send and by the preview, so all three agree. */
export function missedFacts(deals: Deal[], events: DealEvent[]): MissedDeal[] {
  return deals
    .filter(hasExpiredAt)
    .map((d) => withMissedFacts(d, events))
    .filter((d) => d.lastedHours >= 1);
}

/** Free 10-day nurture: the `FREE_LETTER_FRESH` newest live deals, and the
 *  `FREE_LETTER_MISSED` most recently expired ones (latest expiry first)
 *  that pass `missedFacts` — a zero-hour row never takes a slot. Rows whose
 *  expiry is after `now` are skipped too. */
export function pickNurture(
  deals: Deal[],
  events: DealEvent[],
  now: Date,
): { fresh: Deal[]; missed: MissedDeal[] } {
  const fresh = deals
    .filter((d) => d.status === 'live')
    .sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt))
    .slice(0, FREE_LETTER_FRESH);

  const expired = deals
    .filter((d): d is Deal & { expiredAt: string } => d.status === 'expired' && hasExpiredAt(d))
    .filter((d) => ts(d.expiredAt) <= now.getTime())
    .sort((a, b) => ts(b.expiredAt) - ts(a.expiredAt));
  const missed = missedFacts(expired, events).slice(0, FREE_LETTER_MISSED);

  return { fresh, missed };
}

/** Send tallies stored in `issues.stats`. `skipped_no_key` marks a Send
 *  attempted without `RESEND_API_KEY`: nothing went out, `sent_at` stays
 *  NULL, the issue can be sent later. */
export interface IssueStats {
  attempted: number;
  sent: number;
  failed: number;
  skipped_no_token: number;
  skipped_no_key?: boolean;
  /** Deals that had expired between assemble and send (digest only). */
  dropped_expired?: number;
  /** First few Resend errors, for the curator's eyes. */
  errors?: string[];
}

/** Why `sendIssue` refused — shown inline under the Send button. */
export type SendRefusal = 'already_sent' | 'no_fresh' | 'no_key' | 'not_found';

/** What `sendIssue` returns: the tallies, or a reason the curator can read
 *  without landing on the error boundary. */
export type SendOutcome = { ok: true; stats: IssueStats } | { ok: false; reason: SendRefusal };

export const SEND_REFUSAL_TEXT: Record<SendRefusal, string> = {
  already_sent: 'Already sent — this letter went out from another tab or an earlier click.',
  no_fresh: 'None of these deals are live any more — assemble a new letter.',
  no_key: 'Not sent: RESEND_API_KEY is not configured. The draft stays sendable.',
  not_found: 'This letter no longer exists.',
};

export function statsOf(v: unknown): IssueStats | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : 0);
  return {
    attempted: n('attempted'),
    sent: n('sent'),
    failed: n('failed'),
    skipped_no_token: n('skipped_no_token'),
    skipped_no_key: s.skipped_no_key === true,
    dropped_expired: n('dropped_expired'),
    errors: Array.isArray(s.errors) ? s.errors.filter((e): e is string => typeof e === 'string') : [],
  };
}

/** `deal_ids` / `expired_deal_ids` json → integer ids, in stored order. */
export function idList(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
}
