import { expect, test } from 'vitest';
import { freshnessLabel } from './format';

test('recent checks keep the freshness claim', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  expect(freshnessLabel(twoHoursAgo)).toBe('Checked 2h ago');
});

test('stale checks stop advertising their age', () => {
  const days86 = new Date(Date.now() - 86 * 86_400_000).toISOString();
  expect(freshnessLabel(days86)).toBe('Price may have moved — check live');
  expect(freshnessLabel(null)).toBe('Checked recently');
});
