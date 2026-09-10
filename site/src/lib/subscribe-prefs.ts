import { parseRefCode } from './refcode';

// ---------------------------------------------------------------------------
// Pure validation / normalisation helpers
// No DB or network deps — safe to import in tests.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254; // RFC 5321 ceiling; also bounds what we persist

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);
}

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

export const PREF_ORIGINS = [
  { code: 'VNO', label: 'Vilnius' },
  { code: 'KUN', label: 'Kaunas' },
  { code: 'RIX', label: 'Ryga' },
  { code: 'PLQ', label: 'Palanga' },
  { code: 'WAW', label: 'Varšuva' },
] as const;

export const PREF_MOMENTS = [
  { code: 'sun', label: 'Saulė' },
  { code: 'city', label: 'Miestai' },
  { code: 'family', label: 'Su šeima' },
  { code: 'weekend', label: 'Savaitgaliai' },
  { code: 'last_minute', label: 'Paskutinė minutė' },
] as const;

export const ORIGIN_CODES = PREF_ORIGINS.map((o) => o.code);
export const MOMENT_CODES = PREF_MOMENTS.map((m) => m.code);

export const SUBSCRIBE_SOURCES = [
  'home',
  'home-mid',
  'subscribe',
  'collection',
  'deal',
  'past',
  'early',
  'site',
  'tiktok',
] as const;

export type SubscribeSource = (typeof SUBSCRIBE_SOURCES)[number];

export function cleanSource(raw: string | null | undefined): SubscribeSource {
  if (raw && (SUBSCRIBE_SOURCES as readonly string[]).includes(raw)) {
    return raw as SubscribeSource;
  }
  return 'site';
}

export function cleanPrefs(
  origins: string[],
  moments: string[],
): { origins: string[]; moments: string[] } {
  return {
    origins: origins.filter((c) => (ORIGIN_CODES as readonly string[]).includes(c)),
    moments: moments.filter((c) => (MOMENT_CODES as readonly string[]).includes(c)),
  };
}

// ---------------------------------------------------------------------------
// Attribution — utm_* + ref, captured on signup for TikTok-driven traffic
// ---------------------------------------------------------------------------

/**
 * The single list of tracking field names — used to build hidden form inputs
 * (TrackingFields, subscribe/page.tsx) and to read them back out
 * of FormData in subscribeAction. Keep this the one source of truth instead
 * of hand-maintaining parallel lists.
 */
export const TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
] as const;

export type TrackingKey = (typeof TRACKING_KEYS)[number];

const UTM_KEYS = TRACKING_KEYS.filter((key) => key !== 'ref');
const UTM_MAX_LENGTH = 80;

const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

/**
 * Keeps only known `utm_*` keys from an arbitrary input bag (e.g. FormData
 * entries), strips control characters, the `utm_` prefix, trims and caps
 * values, and drops empty/non-string values. Unknown keys are ignored.
 */
export function cleanUtm(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = input[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.replace(CONTROL_CHARS_RE, '').trim();
    if (!trimmed) continue;
    out[key.slice(4)] = trimmed.slice(0, UTM_MAX_LENGTH);
  }
  return out;
}

/**
 * Validates a referral code by actually decoding it (`parseRefCode`), not by
 * shape: a code that fails its checksum names no subscriber, so storing it as
 * `referred_by` would be a broken attribution. Input is lowercased case-safe
 * — links get typed and shared — but nothing else is accepted.
 */
export function cleanRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  return parseRefCode(code) !== null ? code : null;
}

/**
 * Column values that turn a conflicting `subscribers` row back into a fresh
 * signup. Two rows qualify (see `subscribeAction`): one still waiting for its
 * confirm click, and one that unsubscribed and is now typing its address
 * again. The latter gets a full double opt-in (`confirmed` false) so rejoining
 * is an explicit click, never a silent flip, and `unsubscribedAt` is cleared
 * so the 30-day purge stops counting. Single opt-in (no Resend key) passes the
 * confirm time instead and the row is live at once.
 *
 * `unsubscribeToken` is deliberately absent: the link in the mails they
 * already have must keep working. Prefs are merged (jsonb `||`) by the caller,
 * never written here.
 */
export function resubscribeReset(confirmToken: string, confirmedAt: string | null) {
  return {
    confirmToken,
    confirmed: confirmedAt !== null,
    confirmedAt,
    unsubscribedAt: null,
  };
}

/**
 * Builds the `prefs` object written at signup: first-touch attribution plus,
 * for an early-alerts opt-in, `founding_interest: true` (the early-alerts
 * list is a waitlist for a paid plan, not a free product — the flag marks
 * who asked before the price existed).
 *
 * Returns null when there is nothing to store so the column stays NULL
 * instead of being filled with an empty object.
 */
export function signupPrefs(
  utm: Record<string, string>,
  ref: string | null,
  founding: boolean,
): Record<string, unknown> | null {
  const prefs: Record<string, unknown> = {
    ...(Object.keys(utm).length ? { utm } : {}),
    ...(ref ? { referred_by: ref } : {}),
    ...(founding ? { founding_interest: true } : {}),
  };
  return Object.keys(prefs).length ? prefs : null;
}

