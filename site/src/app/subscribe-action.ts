'use server';
import { z } from 'zod';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';

export async function subscribe(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = z.string().email().safeParse((form.get('email') ?? '').toString().trim());
  if (!email.success) return { ok: false, error: 'Enter a valid email.' };
  try {
    await db.insert(subscribers).values({ email: email.data, source: 'homepage' })
      .onConflictDoNothing({ target: subscribers.email });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save — please try again.' };
  }
}
