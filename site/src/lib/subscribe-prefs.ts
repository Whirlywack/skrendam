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
