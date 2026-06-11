import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic'; // never cache a state-changing route

const COOKIE_NAME = 'yip_pt';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = req.nextUrl.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (!token || token.length < 16) return to('/subscribe?state=invalid');

  // Confirm the subscriber. Keep confirmToken in the row — the cookie needs it
  // for the prefs / early-alerts steps (joinEarlyAlertsAction nulls it at end).
  const updated = await db
    .update(subscribers)
    .set({ confirmed: true, confirmedAt: new Date().toISOString() })
    .where(eq(subscribers.confirmToken, token))
    .returning({ id: subscribers.id });

  if (updated.length === 0) return to('/subscribe?state=invalid');

  // Set the post-confirm token in an httpOnly cookie — NOT in the URL —
  // so the prefs / early-alerts steps can read it without it leaking to
  // browser history, referrers, or shareable links.
  const res = NextResponse.redirect(new URL('/subscribe?state=confirmed', base));
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
    path: '/subscribe',
  });
  return res;
}
