'use server';
import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { emailEnabled, sendConfirmEmail } from '@/lib/email';
import {
  normalizeEmail,
  isValidEmail,
  cleanSource,
  cleanPrefs,
} from '@/lib/subscribe-prefs';

// Re-export so tests and components can import from a single action module.
export { normalizeEmail, isValidEmail, cleanSource, cleanPrefs };

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

export type SubscribeResult =
  | { ok: true; state: 'check-email' | 'subscribed' }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// subscribeAction — main entry point (inline card + /subscribe page)
// ---------------------------------------------------------------------------

export async function subscribeAction(
  formData: FormData,
): Promise<SubscribeResult | void> {
  const raw = (formData.get('email') ?? '').toString();
  const email = normalizeEmail(raw);
  const source = cleanSource(formData.get('source')?.toString());
  const earlyAlerts =
    formData.get('early_alerts') === 'on' || formData.get('early_alerts') === '1';
  const mode = formData.get('mode') === 'page' ? 'page' : 'inline';

  if (!isValidEmail(email)) {
    if (mode === 'page') {
      redirect('/subscribe?state=invalid');
    }
    return { ok: false, error: 'Enter a valid email.' };
  }

  const token = randomBytes(24).toString('hex');
  const enabled = emailEnabled();
  const nowIso = new Date().toISOString();

  try {
    if (enabled) {
      // Double opt-in: insert unconfirmed row; on conflict bump token + OR earlyAlerts.
      // Never downgrade confirmed=true or reset confirmedAt.
      await db
        .insert(subscribers)
        .values({
          email,
          source,
          earlyAlerts,
          confirmToken: token,
          confirmed: false,
        })
        .onConflictDoUpdate({
          target: subscribers.email,
          set: {
            confirmToken: token,
            earlyAlerts: sql`${subscribers.earlyAlerts} OR ${earlyAlerts}`,
          },
        });
      await sendConfirmEmail(email, token);
    } else {
      // Single opt-in (dev / no Resend key): confirm immediately.
      await db
        .insert(subscribers)
        .values({
          email,
          source,
          earlyAlerts,
          confirmToken: token,
          confirmed: true,
          confirmedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: subscribers.email,
          set: {
            confirmToken: token,
            confirmed: true,
            confirmedAt: nowIso,
            earlyAlerts: sql`${subscribers.earlyAlerts} OR ${earlyAlerts}`,
          },
        });
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (mode === 'page') {
      redirect('/subscribe?state=error');
    }
    return { ok: false, error: 'Something went wrong — try again.' };
  }

  const state = enabled ? 'check-email' : 'subscribed';

  if (mode === 'page') {
    if (state === 'subscribed') {
      redirect(`/subscribe?state=confirmed&t=${token}`);
    } else {
      redirect('/subscribe?state=check-email');
    }
  }

  return { ok: true, state };
}

// ---------------------------------------------------------------------------
// subscribePageAction — void wrapper for use as a native <form action>
// on the /subscribe page. The page-mode branch always redirects, so the
// return value is never used by a form element, but TS requires void.
// ---------------------------------------------------------------------------

export async function subscribePageAction(formData: FormData): Promise<void> {
  await subscribeAction(formData);
}

// ---------------------------------------------------------------------------
// savePreferencesAction — store optional origin + moment prefs by token
// ---------------------------------------------------------------------------

export async function savePreferencesAction(formData: FormData): Promise<void> {
  const token = (formData.get('t') ?? '').toString();
  if (token.length < 16) return;

  const rawOrigins = formData.getAll('origins').map(String);
  const rawMoments = formData.getAll('moments').map(String);
  const { origins, moments } = cleanPrefs(rawOrigins, rawMoments);

  try {
    await db
      .update(subscribers)
      .set({ prefs: { origins, moments } })
      .where(eq(subscribers.confirmToken, token));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`/subscribe?state=confirmed&t=${token}`);
  }

  redirect(`/subscribe?state=prefs-saved&t=${token}`);
}

// ---------------------------------------------------------------------------
// joinEarlyAlertsAction — opt subscriber into early alerts by token
// ---------------------------------------------------------------------------

export async function joinEarlyAlertsAction(formData: FormData): Promise<void> {
  const token = (formData.get('t') ?? '').toString();
  if (token.length < 16) return;

  try {
    await db
      .update(subscribers)
      .set({ earlyAlerts: true })
      .where(eq(subscribers.confirmToken, token));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`/subscribe?state=confirmed&t=${token}`);
  }

  redirect(`/subscribe?state=early-joined`);
}
