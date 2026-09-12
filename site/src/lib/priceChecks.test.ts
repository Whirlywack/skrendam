import { expect, test } from 'vitest';
import { toCheckItems } from './priceChecks';

test('toCheckItems: oldest first, eur values, up flag on a rise, gone label when unavailable', () => {
  const rows = [
    { checkedAt: '2026-09-12 04:02:00', price: 64, available: true },
    { checkedAt: '2026-09-11 04:01:00', price: 47, available: true },
    { checkedAt: '2026-09-10 04:00:00', price: 47, available: true },
  ];
  // eur() joins amount and symbol with U+00A0 (LT convention, see format.ts).
  expect(toCheckItems(rows, '—')).toEqual([
    { date: 'rugs. 10', value: '47 €', up: false },
    { date: 'rugs. 11', value: '47 €', up: false },
    { date: 'rugs. 12', value: '64 €', up: true },
  ]);
  expect(toCheckItems([{ checkedAt: '2026-09-11 04:00:00', price: null, available: false }], '—'))
    .toEqual([{ date: 'rugs. 11', value: '—', up: false }]);
  expect(toCheckItems([], '—')).toEqual([]);
});
