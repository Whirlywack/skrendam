import { and, eq, isNull } from 'drizzle-orm';
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
