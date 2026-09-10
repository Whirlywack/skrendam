import { TRACKING_KEYS, type TrackingKey } from './subscribe-prefs';

/** The utm_* / ref bag carried from the landing URL into the signup form. */
export type Tracking = Partial<Record<TrackingKey, string>>;

export const ATTR_STORAGE_KEY = 'yip_attr';

const EMPTY: Tracking = {};

const isTrackingKey = (k: string): k is TrackingKey =>
  (TRACKING_KEYS as readonly string[]).includes(k);

/** Reads the tracking bag out of a `?…` query string. Unknown keys ignored. */
export function readFromSearch(search: string): Tracking {
  const params = new URLSearchParams(search);
  const out: Tracking = {};
  for (const key of TRACKING_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Reads the first-touch bag stashed in sessionStorage. Values are filtered
 * through TRACKING_KEYS and a string check — the payload is user-writable
 * (it is their own sessionStorage), so nothing else gets to become a hidden
 * form field.
 */
export function readStored(): Tracking {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return EMPTY;
    const raw = window.sessionStorage.getItem(ATTR_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    const out: Tracking = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isTrackingKey(key) && typeof value === 'string' && value) out[key] = value;
    }
    return out;
  } catch {
    // Private mode / blocked storage / bad JSON — non-fatal, just no fallback.
    return EMPTY;
  }
}

/**
 * The tracking bag for this pageview: `{...readStored(), ...fromUrl}`.
 *
 * The stored first touch is the base — a later pageview without params must
 * not erase the attribution that brought the visitor in — and the current
 * URL is layered on top, so a key the URL carries wins for that key and the
 * stored bag fills every key the URL leaves out.
 *
 * Storage itself stays strictly first-touch: the first pageview that carries
 * params writes it, and nothing overwrites it for the rest of the session.
 */
export function computeTracking(search: string): Tracking {
  const fromUrl = readFromSearch(search);
  const stored = readStored();
  if (Object.keys(fromUrl).length > 0) {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage
        && !window.sessionStorage.getItem(ATTR_STORAGE_KEY)) {
        window.sessionStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(fromUrl));
      }
    } catch {
      // sessionStorage unavailable (private mode, blocked) — non-fatal.
    }
  }
  return { ...stored, ...fromUrl };
}

/**
 * Server-side counterpart: the tracking bag from a page's `searchParams`.
 * A repeated param arrives as an array — take the first value, the same one
 * `URLSearchParams.get()` would return on the client.
 */
export function trackingFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Tracking {
  const out: Tracking = {};
  for (const key of TRACKING_KEYS) {
    const raw = sp[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value) out[key] = value;
  }
  return out;
}
