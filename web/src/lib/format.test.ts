import { expect, test } from 'vitest';
import { eur, formatDates, formatLocalTs, parseEngineTs, pct } from './format';

test('formats one-way and round-trip date ranges', () => {
  expect(formatDates('2026-10-14', null)).toBe('14 Oct');
  expect(formatDates('2026-10-14', '2026-10-21')).toBe('14–21 Oct');
});
test('pct rounds to whole percent', () => {
  expect(pct(0.42)).toBe(42);
  expect(pct(null)).toBe(0);
});
test('parseEngineTs reads naive engine timestamps as UTC (B2 regression)', () => {
  // Engine writes naive UTC with microseconds and a space separator.
  expect(parseEngineTs('2026-08-22 05:42:11.910007').toISOString()).toBe(
    '2026-08-22T05:42:11.910Z',
  );
  // Already-zoned strings pass through unshifted.
  expect(parseEngineTs('2026-08-22T05:42:11Z').toISOString()).toBe(
    '2026-08-22T05:42:11.000Z',
  );
  expect(parseEngineTs('2026-08-22T08:42:11+03:00').toISOString()).toBe(
    '2026-08-22T05:42:11.000Z',
  );
  expect(parseEngineTs('2026-08-22T08:42:11+0300').toISOString()).toBe(
    '2026-08-22T05:42:11.000Z',
  );
});
test('parseEngineTs accepts the 2-digit offset Postgres prints for timestamptz text', () => {
  // `subscribers.paid_since` / `confirmed_at` are timestamptz; drizzle
  // `mode: 'string'` hands over `+00` (or `+03` on a zoned session), not `+00:00`.
  expect(parseEngineTs('2026-09-10 20:15:00+00').toISOString()).toBe('2026-09-10T20:15:00.000Z');
  expect(parseEngineTs('2026-09-10 23:15:00+03').toISOString()).toBe('2026-09-10T20:15:00.000Z');
  expect(parseEngineTs('2026-09-10 20:15:00.123456+00').toISOString()).toBe(
    '2026-09-10T20:15:00.123Z',
  );
  expect(parseEngineTs('2026-09-10 20:15:00-05').toISOString()).toBe('2026-09-11T01:15:00.000Z');
  // A naive value whose last field looks offset-ish is still read as UTC.
  expect(parseEngineTs('2026-09-10 20:15').toISOString()).toBe('2026-09-10T20:15:00.000Z');
});
test('eur renders „93 €" — symbol after, non-breaking space, same bytes as site/src/lib/format.ts', () => {
  expect(eur(93)).toBe('93 €');
  expect(eur(92.6)).toBe('93 €');
});

test('formatLocalTs renders engine/desk timestamps in the local zone, never raw UTC (Letters regression)', () => {
  // `issues.created_at` is written as new Date().toISOString() and comes back
  // naive; the Letters pages showed "07:35" for a 10:35 click in Vilnius.
  const d = parseEngineTs('2026-09-11 07:35:12.345');
  const expected = d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  expect(formatLocalTs('2026-09-11 07:35:12.345')).toBe(expected);
  expect(formatLocalTs('2026-09-11T07:35:12.345Z')).toBe(expected);
  // Only the timezone-shifted rendering is acceptable: under any zone east of UTC
  // the wall clock must not read 07:35 unless the zone IS UTC.
  const offsetMin = -d.getTimezoneOffset();
  if (offsetMin !== 0) expect(formatLocalTs('2026-09-11 07:35:12.345')).not.toContain('07:35');
  expect(formatLocalTs(null)).toBe('—');
});
