'use server';
import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { cookies, headers } from 'next/headers';
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
import { emailEnabled, sendConfirmEmail, sendEarlyConfirmEmail } from '@/lib/email';
import { mergePrefsSql } from '@/lib/subscribers';
import { subscribeEmailLimiter, subscribeIpLimiter } from '@/lib/rate-limit';
import {
  normalizeEmail,
  isValidEmail,
  cleanSource,
  cleanPrefs,
  cleanUtm,
  cleanRef,
  signupPrefs,
  resubscribeReset,
  TRACKING_KEYS,
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

// Marks a subscriber who joined the early-alerts list while it was still a
// waitlist — the list is a paid plan in the making, so this records who asked
// before a price existed. Merged into prefs, never written over it.
const FOUNDING_INTEREST = { founding_interest: true };
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
  // Only the /early-alerts form opts into early alerts: it posts source='early'
  // plus the hidden early_alerts field. This is a shape check on public form
  // input, not a trust boundary — anything can POST these fields, so what
  // actually protects an address is the double opt-in below.
  const earlyAlerts =
    source === 'early' &&
    (formData.get('early_alerts') === 'on' || formData.get('early_alerts') === '1');
  const mode = formData.get('mode') === 'page' ? 'page' : 'inline';

  // Attribution captured on signup (TikTok launch): utm_* + ref, stored on
  // prefs. Never overwritten on conflict — see onConflictDoUpdate below.
  // An early-alerts opt-in also lands `founding_interest: true` there: the
  // early list is a waitlist for a paid plan, so we record who asked before
  // the price existed.
  const trackingBag: Record<string, unknown> = {};
  for (const key of TRACKING_KEYS) trackingBag[key] = formData.get(key);
  const utm = cleanUtm(trackingBag);
  const ref = cleanRef(trackingBag.ref);
  const prefs = signupPrefs(utm, ref, earlyAlerts);
  const founding = earlyAlerts ? FOUNDING_INTEREST : {};
  // prefs on conflict: coalesce fills the column ONCE (attribution is
  // first-touch and must never be overwritten), then the founding-interest
  // patch is merged on top with jsonb `||`, so an existing subscriber joining
  // the early list keeps every key they already had. Omitted entirely when
  // there is nothing to write, so a NULL prefs is not replaced by '{}'.
  const prefsOnConflict = prefs ? { prefs: mergePrefsSql(founding, prefs) } : {};

  if (!isValidEmail(email)) {
    if (mode === 'page') {
      redirect('/subscribe?state=invalid');
    }
    return { ok: false, error: S.emailInvalid };
  }

  const token = randomBytes(24).toString('hex');
  // Minted on every insert so a row is never sendable-without-an-unsubscribe-link.
  // Deliberately NOT touched in the onConflictDoUpdate branches: an existing
  // (or rejoining) subscriber keeps the token their old emails already carry.
  const unsubscribeToken = randomBytes(16).toString('hex');
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

  // Which conflicting rows this public form may rewrite: a row still waiting
  // for its confirm click (re-submit → fresh token) and a row that has
  // unsubscribed (re-subscribe → fresh double opt-in, see resubscribeReset).
  // A confirmed, still-subscribed row is immutable here — 0 rows returned.
  const rewritable = or(eq(subscribers.confirmed, false), isNotNull(subscribers.unsubscribedAt));

  let touched = false;

  try {
    if (enabled) {
      // Double opt-in: insert an unconfirmed row; on conflict reset the row to
      // a fresh signup (new token, confirmed=false, unsubscribed_at cleared)
      // and OR earlyAlerts — ONLY for `rewritable` rows. An unsubscribed
      // address gets the same confirm mail a new one does, so rejoining is an
      // explicit click, and because the reset clears `unsubscribed_at` before
      // that mail goes out, /confirm needs no unsubscribe logic of its own and
      // the 30-day purge no longer has the row in sight.
      const inserted = await db
        .insert(subscribers)
        .values({
          email,
          source,
          earlyAlerts,
          confirmToken: token,
          confirmed: false,
          prefs,
          unsubscribeToken,
        })
        .onConflictDoUpdate({
          target: subscribers.email,
          set: {
            ...resubscribeReset(token, null),
            earlyAlerts: sql`${subscribers.earlyAlerts} OR ${earlyAlerts}`,
            ...prefsOnConflict,
          },
          setWhere: rewritable,
        })
        .returning({ id: subscribers.id });
      touched = inserted.length > 0;
      if (touched) await sendConfirmEmail(email, token);
    } else {
      // Single opt-in (dev / no Resend key): confirm immediately — a rejoining
      // (unsubscribed) row too. Same `rewritable` gate keeps confirmed,
      // still-subscribed rows immutable.
      const inserted = await db
        .insert(subscribers)
        .values({
          email,
          source,
          earlyAlerts,
          confirmToken: token,
          confirmed: true,
          confirmedAt: nowIso,
          prefs,
          unsubscribeToken,
        })
        .onConflictDoUpdate({
          target: subscribers.email,
          set: {
            ...resubscribeReset(token, nowIso),
            earlyAlerts: sql`${subscribers.earlyAlerts} OR ${earlyAlerts}`,
            ...prefsOnConflict,
          },
          setWhere: rewritable,
        })
        .returning({ id: subscribers.id });
      touched = inserted.length > 0;
    }
    // A confirmed subscriber can join early alerts by re-entering their email,
    // but ONLY via a click in a fresh confirmation email — a third party typing
    // someone else's address must not flip the flag silently (review 08-28).
    // Response stays uniform; the email goes to the address owner alone.
    // An unsubscribed row never gets here untouched (it is `rewritable`, so it
    // took the reset path above); the isNull guards make sure that even if
    // that changes, an address that asked to be left alone is never mailed or
    // mutated from this branch — the upgrade mail must not re-opt anyone in.
    if (earlyAlerts && !touched) {
      if (enabled) {
        const upgraded = await db
          .update(subscribers)
          .set({ confirmToken: token })
          .where(and(
            eq(subscribers.email, email),
            eq(subscribers.confirmed, true),
            eq(subscribers.earlyAlerts, false),
            isNull(subscribers.unsubscribedAt),
          ))
          .returning({ id: subscribers.id });
        if (upgraded.length > 0) await sendEarlyConfirmEmail(email, token);
      } else {
        // Single opt-in (dev / no Resend): no email channel exists — flip directly.
        await db
          .update(subscribers)
          .set({ earlyAlerts: true, prefs: mergePrefsSql(FOUNDING_INTEREST) })
          .where(and(
            eq(subscribers.email, email),
            eq(subscribers.confirmed, true),
            isNull(subscribers.unsubscribedAt),
          ));
      }
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
      // Only set when touched (new / unconfirmed / rejoining row); already-confirmed = no cookie needed.
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
    // One atomic statement: merge, don't replace (prefs already carries
    // {utm, referred_by, founding_interest} and this step must not destroy
    // them), and no read-modify-write — the old SELECT-then-UPDATE lost a
    // concurrent write landing between the two.
    const updated = await db
      .update(subscribers)
      .set({ prefs: mergePrefsSql({ origins, moments }) })
      .where(eq(subscribers.confirmToken, token))
      .returning({ id: subscribers.id });
    // No row for this token (expired, already closed, forged) — say nothing,
    // just put them back on the confirmed screen.
    if (updated.length === 0) redirect('/subscribe?state=confirmed');
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

  let joined = 0;
  try {
    // Null the token at flow end — single-use closure. founding_interest is
    // merged (not written over prefs): the row already carries signup
    // attribution and, often, saved origin/moment prefs.
    const rows = await db
      .update(subscribers)
      .set({ earlyAlerts: true, confirmToken: null, prefs: mergePrefsSql(FOUNDING_INTEREST) })
      .where(eq(subscribers.confirmToken, token))
      .returning({ id: subscribers.id });
    joined = rows.length;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/subscribe?state=confirmed');
  }

  // Clear the cookie either way — the flow is over, and a token that matched
  // no row is no use to the next attempt.
  c.delete(COOKIE_NAME);

  // No row for this token (expired, already closed in another tab, forged):
  // say so instead of telling them they joined — same shape as savePreferencesAction.
  redirect(joined > 0 ? '/subscribe?state=early-joined' : '/subscribe?state=invalid');
}
