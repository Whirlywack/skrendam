import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ATTR_STORAGE_KEY,
  computeTracking,
  readFromSearch,
  readStored,
  trackingFromSearchParams,
} from '@/lib/tracking';

// The module reads `window.sessionStorage` behind a try/catch, so a node run
// with no window is itself a case under test (private mode / blocked storage).
function withStorage(initial: string | null) {
  const store = new Map<string, string>();
  if (initial !== null) store.set(ATTR_STORAGE_KEY, initial);
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  vi.stubGlobal('window', { sessionStorage });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readFromSearch', () => {
  test('keeps only the known tracking keys', () => {
    expect(readFromSearch('?utm_source=tiktok&utm_medium=bio&nope=x')).toEqual({
      utm_source: 'tiktok',
      utm_medium: 'bio',
    });
  });

  test('drops empty values', () => {
    expect(readFromSearch('?utm_source=&ref=')).toEqual({});
  });

  test('handles a search string with no query at all', () => {
    expect(readFromSearch('')).toEqual({});
  });
});

describe('readStored', () => {
  test('returns empty when there is no window (SSR / node)', () => {
    expect(readStored()).toEqual({});
  });

  test('returns empty on unparseable JSON', () => {
    withStorage('{not json');
    expect(readStored()).toEqual({});
  });

  test('keeps only known keys from a tampered payload', () => {
    withStorage(JSON.stringify({ utm_source: 'tiktok', evil: '<script>', ref: 5 }));
    expect(readStored()).toEqual({ utm_source: 'tiktok' });
  });
});

describe('computeTracking', () => {
  test('merges stored under the URL — {...stored, ...fromUrl}', () => {
    withStorage(JSON.stringify({ utm_source: 'tiktok', utm_campaign: 'launch' }));
    // The URL wins on a key it carries; the stored first touch fills the rest.
    expect(computeTracking('?utm_source=instagram')).toEqual({
      utm_source: 'instagram',
      utm_campaign: 'launch',
    });
  });

  test('falls back to the stored bag when the URL carries nothing', () => {
    withStorage(JSON.stringify({ utm_source: 'tiktok' }));
    expect(computeTracking('')).toEqual({ utm_source: 'tiktok' });
  });

  test('stores the first touch and never overwrites it', () => {
    const store = withStorage(null);
    computeTracking('?utm_source=tiktok');
    expect(JSON.parse(store.get(ATTR_STORAGE_KEY) as string)).toEqual({ utm_source: 'tiktok' });
    computeTracking('?utm_source=instagram');
    expect(JSON.parse(store.get(ATTR_STORAGE_KEY) as string)).toEqual({ utm_source: 'tiktok' });
  });

  test('works with no storage available at all', () => {
    expect(computeTracking('?ref=ab35')).toEqual({ ref: 'ab35' });
  });
});

describe('trackingFromSearchParams', () => {
  test('keeps known keys and drops everything else', () => {
    expect(trackingFromSearchParams({ utm_source: 'tiktok', state: 'confirmed' })).toEqual({
      utm_source: 'tiktok',
    });
  });

  test('takes the first value of a repeated param', () => {
    expect(trackingFromSearchParams({ utm_source: ['tiktok', 'instagram'] })).toEqual({
      utm_source: 'tiktok',
    });
  });

  test('drops undefined, empty and empty-array values', () => {
    expect(
      trackingFromSearchParams({ utm_source: undefined, utm_medium: '', ref: [] }),
    ).toEqual({});
  });
});
