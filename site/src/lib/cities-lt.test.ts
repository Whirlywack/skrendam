import { describe, expect, it } from 'vitest';
import airports from './airports.json';
import cities from './cities-lt.json';
import { ltCity } from './cities-lt';

describe('cities-lt map', () => {
  it('covers every airports.json IATA code with no extra keys (drift guard)', () => {
    expect(Object.keys(cities).sort()).toEqual(Object.keys(airports).sort());
  });

  it('has all four fields non-empty for every entry', () => {
    for (const [iata, entry] of Object.entries(cities)) {
      for (const field of ['nom', 'acc', 'loc', 'country'] as const) {
        expect(entry[field], `${iata}.${field}`).toBeTruthy();
      }
    }
  });

  it('declines established exonyms', () => {
    expect(ltCity('ATH'))
      .toEqual({ nom: 'Atėnai', acc: 'Atėnus', loc: 'Atėnuose', country: 'Graikija' });
    expect(ltCity('VNO').nom).toBe('Vilnius');
    expect(ltCity('LCA').nom).toBe('Larnaka');
    expect(ltCity('LCA').country).toBe('Kipras');
  });

  it('falls back to the English map, then the code itself', () => {
    expect(ltCity('ZZZ')).toEqual({ nom: 'ZZZ', acc: 'ZZZ', loc: 'ZZZ', country: '' });
  });
});
