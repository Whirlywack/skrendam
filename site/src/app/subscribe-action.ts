'use server';
import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { cookies, headers } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { emailEnabled, sendConfirmEmail } from '@/lib/email';
import { subscribeEmailLimiter, subscribeIpLimiter } from '@/lib/rate-limit';
import {
  normalizeEmail,
  isValidEmail,
  cleanSource,
  cleanPrefs,
} from '@/lib/subscribe-prefs';
import { S } from '@/lib/lt';

// NOTE: this is a 'use server' module — every export MUST be an async server
// action. Do NOT re-export the pure helpers above (normalizeEmail/cleanPrefs/…);
// doing so corrupts the Server Action manifest and makes the <form action={…}>
// actions (subscribePageAction/savePreferences/joinEarlyAlerts) 404 on POST.
// Import those helpers from '@/lib/subscribe-prefs' directly instead.

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'yip_pt';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 3600,
  path: '/subscribe',
};

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
    return { ok: false, error: S.emailInvalid };
  }

  const token = randomBytes(24).toString('hex');
  const enabled = emailEnabled();

  // Abuse guard: this is an unauthenticated public endpoint whose success path
  // sends an email. Over-limit requests are answered exactly like successes
  // (no oracle for bots) but do nothing — no row write, no Resend send.
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (!subscribeIpLimiter.allow(`ip:${ip}`) || !subscribeEmailLimiter.allow(`em:${email}`)) {
    console.warn(`subscribe rate-limited (ip=${ip})`);
    if (mode === 'page') {
      redirect(enabled ? '/subscribe?state=check-email' : '/subscribe?state=confirmed');
    }
    return { ok: true, state: enabled ? 'check-email' : 'subscribed' };
  }
  const nowIso = new Date().toISOString();

  let touched = false;

  try {
    if (enabled) {
      // Double opt-in: insert unconfirmed row; on conflict update token + OR earlyAlerts
      // ONLY for rows still unconfirmed (setWhere). Confirmed rows are fully immutable
      // from this public endpoint — 0 rows returned means conflict hit a confirmed row.
      const inserted = await db
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
          setWhere: eq(subscribers.confirmed, false),
        })
        .returning({ id: subscribers.id });
      touched = inserted.length > 0;
      if (touched) await sendConfirmEmail(email, token);
    } else {
      // Single opt-in (dev / no Resend key): confirm immediately.
      // Also gated by setWhere so confirmed rows stay immutable.
      const inserted = await db
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
            confirmed: sql`true`,
            confirmedAt: nowIso,
            earlyAlerts: sql`${subscribers.earlyAlerts} OR ${earlyAlerts}`,
          },
          setWhere: eq(subscribers.confirmed, false),
        })
        .returning({ id: subscribers.id });
      touched = inserted.length > 0;
    }
    // Confirmed rows are immutable to the upserts above, but the early-alerts
    // flag alone is safe to OR on: no token change, no email, and the response
    // stays uniform — so a confirmed subscriber re-entering their email on
    // /early-alerts actually joins the waitlist instead of hitting a silent no-op.
    if (earlyAlerts) {
      await db
        .update(subscribers)
        .set({ earlyAlerts: true })
        .where(and(eq(subscribers.email, email), eq(subscribers.confirmed, true)));
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (mode === 'page') {
      redirect('/subscribe?state=error');
    }
    return { ok: false, error: S.genericError };
  }

  // Same state regardless of touched — no enumeration of confirmed addresses.
  const state = enabled ? 'check-email' : 'subscribed';

  if (mode === 'page') {
    if (state === 'subscribed') {
      // Single opt-in: set httpOnly cookie so prefs/early-alerts steps can read it.
      // Only set when touched (new/unconfirmed row); already-confirmed = no cookie needed.
      if (touched) {
        const c = await cookies();
        c.set(COOKIE_NAME, token, COOKIE_OPTS);
      }
      redirect('/subscribe?state=confirmed');
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
  // Read token from httpOnly cookie, NOT formData (token must not appear in URL/form).
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value ?? '';
  if (token.length < 16) {
    redirect('/subscribe?state=confirmed');
  }

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
    redirect('/subscribe?state=confirmed');
  }

  redirect('/subscribe?state=prefs-saved');
}

// ---------------------------------------------------------------------------
// joinEarlyAlertsAction — opt subscriber into early alerts by token
// ---------------------------------------------------------------------------

export async function joinEarlyAlertsAction(): Promise<void> {
  // Read token from httpOnly cookie, NOT formData (token must not appear in URL/form).
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value ?? '';
  if (token.length < 16) {
    redirect('/subscribe?state=confirmed');
  }

  try {
    // Null the token at flow end — single-use closure.
    await db
      .update(subscribers)
      .set({ earlyAlerts: true, confirmToken: null })
      .where(eq(subscribers.confirmToken, token));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/subscribe?state=confirmed');
  }

  // Clear the cookie now that the flow is complete.
  c.delete(COOKIE_NAME);

  redirect('/subscribe?state=early-joined');
}
