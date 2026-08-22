import { expect, test } from 'vitest';
import { formatDates, parseEngineTs, pct } from './format';

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
});
