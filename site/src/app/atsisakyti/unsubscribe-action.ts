'use server';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { isUnsubscribeToken } from '@/lib/unsubscribe';

/** The POST behind the button on /atsisakyti?token=… — the only code that
 *  ever sets `unsubscribed_at` (the page's GET is read-only, see there).
 *
 *  Idempotent by construction: a second submit matches no row (the mark is
 *  already set), so it lands on /klaida rather than moving the purge clock.
 *  Unknown token → /klaida too. A DB failure is left to throw: the /klaida
 *  copy says "maybe you already left", which would be a lie on an outage. */
export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = formData.get('token');
  if (!isUnsubscribeToken(token)) redirect('/atsisakyti/klaida');

  const left = await db
    .update(subscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)))
    .returning({ id: subscribers.id });

  redirect(left.length > 0 ? '/atsisakyti/ok' : '/atsisakyti/klaida');
}
