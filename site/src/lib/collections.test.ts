import { describe, expect, it } from 'vitest';
import { COLLECTIONS, collectionBySlug } from './collections';

describe('collectionBySlug', () => {
  it('returns the correct filter for cheap-flights-from-vilnius', () => {
    expect(collectionBySlug('cheap-flights-from-vilnius')?.filter).toEqual({
      kind: 'origin',
      iata: 'VNO',
    });
  });

  it('returns the correct filter for cheap-flights-from-kaunas', () => {
    expect(collectionBySlug('cheap-flights-from-kaunas')?.filter).toEqual({
      kind: 'origin',
      iata: 'KUN',
    });
  });

  it('returns the correct filter for cheap-flights-from-riga', () => {
    expect(collectionBySlug('cheap-flights-from-riga')?.filter).toEqual({
      kind: 'origin',
      iata: 'RIX',
    });
  });

  it("returns kind 'moment' for september-sun-deals", () => {
    expect(collectionBySlug('september-sun-deals')?.filter.kind).toBe('moment');
  });

  it('uses the real DB slug for september-sun-deals', () => {
    expect(collectionBySlug('september-sun-deals')?.filter).toEqual({
      kind: 'moment',
      slug: 'sept_shoulder',
    });
  });

  it('uses the real DB slug for christmas-market-flights', () => {
    expect(collectionBySlug('christmas-market-flights')?.filter).toEqual({
      kind: 'moment',
      slug: 'xmas_markets',
    });
  });

  it('uses the real DB zone for cyprus-flight-deals-from-lithuania', () => {
    expect(collectionBySlug('cyprus-flight-deals-from-lithuania')?.filter).toEqual({
      kind: 'zone',
      zone: 'MEDITERRANEAN',
    });
  });

  it('returns undefined for an unknown slug', () => {
    expect(collectionBySlug('does-not-exist')).toBeUndefined();
  });
});

describe('COLLECTIONS', () => {
  it('has exactly 6 entries', () => {
    expect(COLLECTIONS).toHaveLength(6);
  });

  it('has all unique slugs', () => {
    const slugs = COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every collection has a filter', () => {
    for (const c of COLLECTIONS) {
      expect(c.filter).toBeDefined();
      expect(['origin', 'zone', 'moment']).toContain(c.filter.kind);
    }
  });
});
