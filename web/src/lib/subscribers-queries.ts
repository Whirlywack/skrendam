import { desc } from 'drizzle-orm';
import { db, subscribers } from '@/db';

/** One row of the desk Subscribers table — the columns the curator reads,
 *  newest signup first. `prefs` is the raw json column (signup attribution
 *  and choices: `moments`, `origins`, `utm`, `referred_by`,
 *  `founding_interest`); readers go through `prefsOf` so a malformed value
 *  never breaks the page. */
export interface SubscriberRow {
  id: number;
  email: string;
  plan: string;
  confirmed: boolean;
  earlyAlerts: boolean;
  createdAt: string;
  paidSince: string | null;
  unsubscribedAt: string | null;
  prefs: unknown;
}

export async function listSubscribers(): Promise<SubscriberRow[]> {
  return db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      plan: subscribers.plan,
      confirmed: subscribers.confirmed,
      earlyAlerts: subscribers.earlyAlerts,
      createdAt: subscribers.createdAt,
      paidSince: subscribers.paidSince,
      unsubscribedAt: subscribers.unsubscribedAt,
      prefs: subscribers.prefs,
    })
    .from(subscribers)
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id));
}

/** `prefs` as a record, or `{}` when the column is NULL or not an object. */
export function prefsOf(row: { prefs: unknown }): Record<string, unknown> {
  const p = row.prefs;
  return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

/** Referrals per referral code: how many rows carry each `prefs.referred_by`.
 *  Look a subscriber up with `counts.get(refCode(id)) ?? 0`. Every row counts
 *  (confirmed or not, unsubscribed or not) — the number is "who typed this
 *  code at signup", not "who is still on the list". */
export function referralCounts(rows: { prefs: unknown }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const ref = prefsOf(row).referred_by;
    if (typeof ref !== 'string' || ref === '') continue;
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return counts;
}
