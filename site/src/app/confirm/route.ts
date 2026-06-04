import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic'; // never cache a state-changing route

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = req.nextUrl.origin;
  const to = (state: string) => NextResponse.redirect(new URL(`/subscribe?state=${state}`, base));

  if (!token || token.length < 16) return to('invalid');

  const updated = await db
    .update(subscribers)
    .set({ confirmed: true, confirmedAt: new Date().toISOString(), confirmToken: null })
    .where(eq(subscribers.confirmToken, token))
    .returning({ id: subscribers.id });

  return to(updated.length > 0 ? 'confirmed' : 'expired');
}
