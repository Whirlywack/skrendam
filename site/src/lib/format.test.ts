import { expect, test } from 'vitest';
import { formatDates, freshnessLabel, ltPlural, eur, timeAgo } from './format';

test('dates: month-first LT chips', () => {
  expect(formatDates('2026-09-12', '2026-09-19')).toBe('rugs. 12–19');
  expect(formatDates('2026-09-29', '2026-10-02')).toBe('rugs. 29 – spal. 2');
  expect(formatDates('2026-01-05', null)).toBe('saus. 5');
});

test('plural: three Lithuanian forms', () => {
  const r = (n: number) => ltPlural(n, 'radinys', 'radiniai', 'radinių');
  expect(r(1)).toBe('radinys');
  expect(r(3)).toBe('radiniai');
  expect(r(10)).toBe('radinių');
  expect(r(11)).toBe('radinių');
  expect(r(21)).toBe('radinys');
  expect(r(102)).toBe('radiniai');
});

test('price: symbol after with non-breaking space', () => {
  expect(eur(102)).toBe('102 €');
});

test('relative time: word precedes number', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  expect(timeAgo(twoHoursAgo)).toBe('prieš 2 val.');
});

test('freshness: recent keeps the claim, stale stops advertising age', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
  expect(freshnessLabel(twoHoursAgo)).toBe('Tikrinta prieš 2 val.');
  const days86 = new Date(Date.now() - 86 * 86_400_000).toISOString();
  expect(freshnessLabel(days86)).toBe('Kaina galėjo pasikeisti — patikrink');
  expect(freshnessLabel(null)).toBe('Patikrinta neseniai');
});
