'use client';
import { useSyncExternalStore } from 'react';
import { TRACKING_KEYS } from '@/lib/subscribe-prefs';

const STORAGE_KEY = 'yip_attr';

type Tracking = Partial<Record<(typeof TRACKING_KEYS)[number], string>>;

const EMPTY: Tracking = {};

function readFromSearch(search: string): Tracking {
  const params = new URLSearchParams(search);
  const out: Tracking = {};
  for (const key of TRACKING_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

function readStored(): Tracking {
  try {
    if (!window.sessionStorage) return EMPTY;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Tracking) : EMPTY;
  } catch {
    // Private mode / blocked storage — non-fatal, just no fallback.
    return EMPTY;
  }
}

function computeTracking(search: string): Tracking {
  const fromUrl = readFromSearch(search);
  if (Object.keys(fromUrl).length === 0) return readStored();
  try {
    // First-touch: don't clobber an entry from an earlier pageview this session.
    if (window.sessionStorage && !window.sessionStorage.getItem(STORAGE_KEY)) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
    }
  } catch {
    // sessionStorage unavailable (private mode, blocked) — non-fatal.
  }
  return fromUrl;
}

// Cache keyed by the raw search string so repeated getSnapshot() calls during
// the same pageview return a referentially stable value (required by
// useSyncExternalStore), while a client-side navigation to a URL with a
// different query string still recomputes.
let lastSearch: string | null = null;
let lastSnapshot: Tracking = EMPTY;

function getSnapshot(): Tracking {
  const search = window.location.search;
  if (search === lastSearch) return lastSnapshot;
  lastSearch = search;
  lastSnapshot = computeTracking(search);
  return lastSnapshot;
}

function getServerSnapshot(): Tracking {
  return EMPTY;
}

function subscribe(): () => void {
  // window.location.search never changes for a mounted instance without a
  // remount, so there's nothing to subscribe to — no-op.
  return () => {};
}

/**
 * Renders hidden utm_ / ref inputs for the enclosing <form> on the live
 * signup forms (InkBand, CaptureRow). First-touch: the first pageview that
 * carries tracking params wins for the session (stashed in sessionStorage),
 * so a later pageview without them doesn't erase the attribution.
 *
 * Deliberately does NOT use next/navigation's useSearchParams() — that forces
 * a Suspense boundary and opts the page out of static rendering. Reads
 * window.location only on the client via useSyncExternalStore, which renders
 * `getServerSnapshot()` (empty) during SSR and hydration, then automatically
 * re-renders with the real client value right after hydration completes —
 * the built-in replacement for the old "useEffect + setState on mount"
 * pattern, which trips this repo's `react-hooks/set-state-in-effect` lint
 * rule (bundled in eslint-config-next 16.2.7).
 */
export function TrackingFields() {
  const tracking = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      {TRACKING_KEYS.map((key) =>
        tracking[key] ? <input key={key} type="hidden" name={key} value={tracking[key]} /> : null,
      )}
    </>
  );
}
