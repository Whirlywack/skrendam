import { expect, test } from 'vitest';
import { ascii, clockLT, formatDates, freshnessLabel, lasted, ltPlural, eur, timeAgo } from './format';

test('ascii: strips Lithuanian diacritics to the typed form', () => {
  expect(ascii('Pigūs skrydžiai į Kiprą — atrinkti žmogaus')).toBe('Pigus skrydziai i Kipra — atrinkti zmogaus');
  expect(ascii('kur keliauti rugsėjo mėnesį')).toBe('kur keliauti rugsejo menesi');
});

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

test('lasted: hours under 48 h, days after, null when not expired', () => {
  expect(lasted('2026-08-29T00:00:00', '2026-08-29T06:36:40')).toBe('7 val.');
  expect(lasted('2026-08-28T10:00:00', '2026-09-11T10:21:49')).toBe('14 d.');
  expect(lasted('2026-08-28T10:00:00', null)).toBeNull();
  expect(lasted('2026-08-28T10:00:00', '2026-08-28T09:00:00')).toBeNull();
});

test('clockLT: HH:MM in Vilnius time from a naive-UTC DB stamp', () => {
  expect(clockLT('2026-09-12 03:41:00')).toBe('06:41');   // UTC+3 in September
  expect(clockLT('2026-01-12T03:41:00Z')).toBe('05:41');  // UTC+2 in January
  expect(clockLT(null)).toBeNull();
});
