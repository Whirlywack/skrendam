import { describe, expect, it } from 'vitest';
import { city, country, dealHeadline } from './airports';

describe('airports map', () => {
  it('resolves the full scanned network, not just the old 14-entry stub', () => {
    expect(city('FCO')).toBe('Rome');
    expect(country('DXB')).toBe('United Arab Emirates');
    expect(city('FNC')).toBe('Madeira');
    expect(city('ZZZ')).toBe('ZZZ');
  });
});

describe('dealHeadline', () => {
  it('keeps curator copy', () => {
    expect(dealHeadline("€140 return to Cyprus — sea's still 27°C.", 140, 'LCA'))
      .toBe("€140 return to Cyprus — sea's still 27°C.");
  });
  it('replaces un-edited machine strings and missing headlines', () => {
    expect(dealHeadline('VNO->LCA just EUR140 (usually EUR285)', 140, 'LCA'))
      .toBe('€140 return to Larnaca');
    expect(dealHeadline(null, 89.6, 'FCO')).toBe('€90 return to Rome');
  });
});
