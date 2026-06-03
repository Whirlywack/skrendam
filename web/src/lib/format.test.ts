import { expect, test } from 'vitest';
import { formatDates, pct } from './format';

test('formats one-way and round-trip date ranges', () => {
  expect(formatDates('2026-10-14', null)).toBe('14 Oct');
  expect(formatDates('2026-10-14', '2026-10-21')).toBe('14–21 Oct');
});
test('pct rounds to whole percent', () => {
  expect(pct(0.42)).toBe(42);
  expect(pct(null)).toBe(0);
});
