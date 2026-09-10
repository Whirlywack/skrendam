'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals } from '@/db/generated/schema';
import { parseDealId, parseTracking, recordEvent } from '@/lib/events';
import { clickLimiter } from '@/lib/rate-limit';

/** The POST behind the „Užsisakiau" button — the only writer of
 *  `booked_claim` rows (the page's GET is read-only, see there).
 *
 *  One claim per subscriber per deal: `recordEvent` skips the insert when a
 *  known subscriber already claimed this deal, so a second submit still lands
 *  on the thank-you state without moving the count. An anonymous claim (no
 *  valid `s`) is recorded every time — there is nothing to dedupe on.
 *
 *  Lands on `?done=1` after a write (or a deduped no-op), on `?error=1` when
 *  the DB refused the row — never on a "thanks" the row does not back. */
export async function claimAction(formData: FormData): Promise<void> {
  const dealId = parseDealId(formData.get('dealId') as string | null);
  if (dealId === null) redirect('/');

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!clickLimiter.allow(`ip:${ip}`)) redirect(`/uzsisakiau/${dealId}?error=1`);

  const found = await db
    .select({ id: publishedDeals.id })
    .from(publishedDeals)
    .where(eq(publishedDeals.id, dealId))
    .limit(1);
  if (found.length === 0) redirect(`/uzsisakiau/${dealId}`);

  const sp = new URLSearchParams();
  for (const key of ['i', 's'] as const) {
    const v = formData.get(key);
    if (typeof v === 'string' && v) sp.set(key, v);
  }
  const { issueId, subscriberId } = parseTracking(sp);

  // redirect() throws to unwind — keep it outside the try so the catch only
  // sees real DB failures.
  let recorded = false;
  try {
    await recordEvent({
      dealId,
      issueId,
      subscriberId,
      kind: 'booked_claim',
      source: issueId !== null ? 'email' : null,
    });
    recorded = true;
  } catch (err) {
    console.error('[uzsisakiau] claim not recorded', { dealId, issueId, subscriberId }, err);
  }
  redirect(`/uzsisakiau/${dealId}?${recorded ? 'done' : 'error'}=1`);
}
