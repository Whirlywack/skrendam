import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';

export const dynamic = 'force-dynamic'; // never cache a state-changing route

/** One-click unsubscribe from an email footer (see @/lib/unsubscribe).
 *  A GET with no confirmation step is deliberate: mail clients and humans both
 *  expect a single click to work, and the worst case is a subscriber leaving a
 *  list they can rejoin. The token is the long random `unsubscribe_token`. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = req.nextUrl.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (!token || token.length < 16) return to('/atsisakyti/klaida');

  // Idempotent by construction: the second click matches no row (unsubscribedAt
  // is already set), so it lands on /klaida rather than moving the purge clock.
  const left = await db
    .update(subscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)))
    .returning({ id: subscribers.id });

  return to(left.length > 0 ? '/atsisakyti/ok' : '/atsisakyti/klaida');
}
