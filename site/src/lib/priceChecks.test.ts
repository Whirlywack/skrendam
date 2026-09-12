import { expect, test } from 'vitest';
import { canShowCheckLine, toCheckItems, type CheckItem } from './priceChecks';

test('toCheckItems: oldest first, eur values, up flag on a rise, gone label when unavailable', () => {
  const rows = [
    { checkedAt: '2026-09-12 04:02:00', price: 64, available: true },
    { checkedAt: '2026-09-11 04:01:00', price: 47, available: true },
    { checkedAt: '2026-09-10 04:00:00', price: 47, available: true },
  ];
  // eur() joins amount and symbol with U+00A0 (LT convention, see format.ts) — the literals below carry it.
  expect(toCheckItems(rows, '—')).toEqual([
    { date: 'rugs. 10', value: '47 €', up: false, kind: 'priced' },
    { date: 'rugs. 11', value: '47 €', up: false, kind: 'priced' },
    { date: 'rugs. 12', value: '64 €', up: true, kind: 'priced' },
  ]);
  expect(toCheckItems([{ checkedAt: '2026-09-11 04:00:00', price: null, available: false }], '—'))
    .toEqual([{ date: 'rugs. 11', value: '—', up: false, kind: 'gone' }]);
  expect(toCheckItems([], '—')).toEqual([]);
});

test('toCheckItems: a gone row between two priced ones — up compares to the last PRICED check', () => {
  const rows = [
    { checkedAt: '2026-09-10 04:00:00', price: 47, available: true },
    { checkedAt: '2026-09-11 04:00:00', price: null, available: false },
    { checkedAt: '2026-09-12 04:00:00', price: 64, available: true },
  ];
  const items = toCheckItems(rows, '—');
  expect(items.map((c) => c.kind)).toEqual(['priced', 'gone', 'priced']);
  expect(items[1].up).toBe(false);
  expect(items[2].up).toBe(true); // 47 → gone → 64
});

test('toCheckItems: available but unpriced (fares exist, exact itinerary not matched) is never gone', () => {
  const items = toCheckItems([{ checkedAt: '2026-09-11 04:00:00', price: null, available: true }], '—');
  expect(items).toEqual([{ date: 'rugs. 11', value: '', up: false, kind: 'unpriced' }]);
});

test('toCheckItems: the date is the Vilnius calendar day, not the UTC one', () => {
  // 21:30 UTC on Sep 11 is already 00:30 Sep 12 in Vilnius (UTC+3).
  const items = toCheckItems([{ checkedAt: '2026-09-11 21:30:00', price: 47, available: true }], '—');
  expect(items[0].date).toBe('rugs. 12');
});

test('canShowCheckLine: every check priced, or gone checks only with the copy key filled', () => {
  const priced = (date: string): CheckItem => ({ date, value: '47 €', up: false, kind: 'priced' });
  const gone = (date: string): CheckItem => ({ date, value: 'x', up: false, kind: 'gone' });
  const unpriced = (date: string): CheckItem => ({ date, value: '', up: false, kind: 'unpriced' });
  expect(canShowCheckLine([], 'x')).toBe(false);
  expect(canShowCheckLine([priced('a'), unpriced('b')], 'x')).toBe(false);
  expect(canShowCheckLine([priced('a'), gone('b')], '')).toBe(false);
  expect(canShowCheckLine([priced('a'), gone('b')], 'x')).toBe(true);
  expect(canShowCheckLine([priced('a'), priced('b')], '')).toBe(true);
});
