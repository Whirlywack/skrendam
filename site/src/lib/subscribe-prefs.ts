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
const REF_RE = /^[a-z0-9]{2,12}$/;

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

/** Validates a referral code: lowercase alphanumeric, 2-12 chars. */
export function cleanRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return REF_RE.test(raw) ? raw : null;
}

/**
 * Merges a prefs patch onto an existing prefs object without dropping
 * unrelated keys — e.g. `savePreferencesAction` writing `{origins, moments}`
 * must not clobber `{utm, referred_by}` written at signup. `patch` keys win
 * on conflict.
 */
export function mergePrefs(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...patch };
}
