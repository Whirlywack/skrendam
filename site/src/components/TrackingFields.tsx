'use client';
import { useSyncExternalStore } from 'react';
import { TRACKING_KEYS } from '@/lib/subscribe-prefs';
import { computeTracking, type Tracking } from '@/lib/tracking';

const EMPTY: Tracking = {};

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
 * `present` lists the keys the server already rendered as hidden inputs on
 * this page (see trackingFromSearchParams) — those are skipped here, or the
 * form would POST the key twice and `formData.get()` would take whichever
 * came first. Pages that render no server-side inputs pass nothing.
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
export function TrackingFields({ present = [] }: { present?: string[] }) {
  const tracking = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      {TRACKING_KEYS.map((key) =>
        tracking[key] && !present.includes(key)
          ? <input key={key} type="hidden" name={key} value={tracking[key]} />
          : null,
      )}
    </>
  );
}

/**
 * The server half of the same job: hidden inputs rendered from the page's own
 * `searchParams`, so a submit that beats hydration still carries attribution.
 * TrackingFields fills in whatever only sessionStorage knows.
 */
export function ServerTrackingFields({ tracking }: { tracking: Tracking }) {
  return (
    <>
      {Object.entries(tracking).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <TrackingFields present={Object.keys(tracking)} />
    </>
  );
}
