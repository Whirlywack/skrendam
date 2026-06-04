import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic'; // never cache a state-changing route

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = req.nextUrl.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (!token || token.length < 16) return to('/subscribe?state=invalid');

  // Keep confirmToken so the prefs / early-alerts steps can still use it.
  // Re-confirming is harmless (idempotent confirmed=true / confirmedAt update).
  const updated = await db
    .update(subscribers)
    .set({ confirmed: true, confirmedAt: new Date().toISOString() })
    .where(eq(subscribers.confirmToken, token))
    .returning({ id: subscribers.id });

  if (updated.length === 0) return to('/subscribe?state=invalid');

  return to(`/subscribe?state=confirmed&t=${encodeURIComponent(token)}`);
}
