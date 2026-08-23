import { describe, expect, it } from 'vitest';
import { parseBulkRoutes } from './bulk-routes';

const ZONES = ['MEDITERRANEAN', 'CITY_BREAKS'];

describe('parseBulkRoutes', () => {
  it('parses valid lines, uppercases, trims, optional core column', () => {
    const text = 'vno,bcn,MEDITERRANEAN\n KUN , STN , CITY_BREAKS , core \n';
    const r = parseBulkRoutes(text, ZONES);
    expect(r.issues).toEqual([]);
    expect(r.routes).toEqual([
      { origin: 'VNO', destination: 'BCN', zone: 'MEDITERRANEAN', core: false, line: 1 },
      { origin: 'KUN', destination: 'STN', zone: 'CITY_BREAKS', core: true, line: 2 },
    ]);
  });

  it('skips empty and #-comment lines', () => {
    const r = parseBulkRoutes('# header\n\nVNO,BCN,MEDITERRANEAN\n', ZONES);
    expect(r.routes).toHaveLength(1);
    expect(r.issues).toEqual([]);
  });

  it('flags bad IATA shape, unknown zone, wrong field count, in-paste dupes', () => {
    const text = [
      'VNOX,BCN,MEDITERRANEAN',
      'VNO,BCN,ATLANTIS',
      'VNO,BCN',
      'VNO,BCN,MEDITERRANEAN',
      'VNO,BCN,CITY_BREAKS',
    ].join('\n');
    const r = parseBulkRoutes(text, ZONES);
    expect(r.routes).toHaveLength(1);
    expect(r.issues.map((i) => i.line)).toEqual([1, 2, 3, 5]);
    expect(r.issues[3].problem).toMatch(/duplicate/i);
  });

  it('rejects unknown core markers', () => {
    const r = parseBulkRoutes('VNO,BCN,MEDITERRANEAN,sometimes', ZONES);
    expect(r.routes).toEqual([]);
    expect(r.issues[0].problem).toMatch(/unknown core marker/i);
  });

  it('accepts non-core markers: false, no, 0 → core=false, not an issue', () => {
    const text = [
      'VNO,BCN,MEDITERRANEAN,false',
      'KUN,BCN,MEDITERRANEAN,no',
      'RIX,BCN,MEDITERRANEAN,0',
    ].join('\n');
    const r = parseBulkRoutes(text, ZONES);
    expect(r.issues).toEqual([]);
    expect(r.routes).toHaveLength(3);
    expect(r.routes[0]).toMatchObject({ origin: 'VNO', destination: 'BCN', core: false });
    expect(r.routes[1]).toMatchObject({ origin: 'KUN', destination: 'BCN', core: false });
    expect(r.routes[2]).toMatchObject({ origin: 'RIX', destination: 'BCN', core: false });
  });

  it('keeps unknown markers (e.g. sometimes) as issues, not as non-core routes', () => {
    const r = parseBulkRoutes('VNO,BCN,MEDITERRANEAN,sometimes', ZONES);
    expect(r.routes).toEqual([]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].problem).toMatch(/unknown core marker.*sometimes/i);
  });
});
