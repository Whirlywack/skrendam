'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import type { Plan } from '@/lib/subscribers';

// ---------------------------------------------------------------------------
// Auth guard — re-checked inside EVERY action.
// ---------------------------------------------------------------------------
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}

// ---------------------------------------------------------------------------
// Manual plan flip. The Payment Link phase has no webhook: the curator sees
// the payment land and flips the row here (`paid_source = 'manual'`).
// Going paid also turns early alerts on — a paying subscriber gets the
// instant stream. Going free leaves `early_alerts` alone: the flag records
// what they asked for, not what they get.
// ---------------------------------------------------------------------------
export async function setPlan(id: number, plan: Plan): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) throw new Error(`invalid subscriber id: ${id}`);
  if (plan !== 'paid' && plan !== 'free') throw new Error(`invalid plan: ${plan}`);

  const values =
    plan === 'paid'
      ? { plan, paidSince: new Date().toISOString(), paidSource: 'manual', earlyAlerts: true }
      : { plan, paidSince: null, paidSource: null };

  await db.update(subscribers).set(values).where(eq(subscribers.id, id));

  revalidatePath('/subscribers');
}
