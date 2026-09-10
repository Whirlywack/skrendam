import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';

/** The only list a marketing send may draw from: confirmed AND still subscribed.
 *
 *  Every sender (WP6) MUST select recipients through this helper — a raw
 *  `where(confirmed)` would keep mailing people who have unsubscribed but whose
 *  row has not yet been purged by the scan's 30-day sweep. Returns the token
 *  too, because each send has to carry that recipient's `unsubscribeUrl`.
 */
export async function activeSubscribers() {
  return db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      prefs: subscribers.prefs,
      unsubscribeToken: subscribers.unsubscribeToken,
    })
    .from(subscribers)
    .where(and(eq(subscribers.confirmed, true), isNull(subscribers.unsubscribedAt)));
}

/** SQL that merges `patch` into `subscribers.prefs` in a single statement.
 *
 *  jsonb `||` is a shallow merge, so unrelated top-level keys survive — the
 *  column carries first-touch attribution (`utm`, `referred_by`) written at
 *  signup that no later write may destroy. `fill` seeds the column when it is
 *  still NULL (defaults to `{}`); `patch` always wins on conflicting keys.
 *
 *  Read-modify-write in JS was the old shape and lost concurrent writes
 *  between the SELECT and the UPDATE — do it in one statement instead.
 */
export function mergePrefsSql(
  patch: Record<string, unknown>,
  fill: Record<string, unknown> = {},
) {
  return sql`(coalesce(${subscribers.prefs}::jsonb, ${JSON.stringify(fill)}::jsonb) || ${JSON.stringify(patch)}::jsonb)::json`;
}
