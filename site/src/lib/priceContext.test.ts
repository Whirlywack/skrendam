import { expect, test } from 'vitest';
import { priceStats } from './priceContext';
test('thin history → no claim', () => {
  expect(priceStats([100, 110], 96).hasHistory).toBe(false);
});
test('full history → percentile + range', () => {
  const prices = Array.from({ length: 20 }, (_, i) => 90 + i * 10); // 90..280
  const s = priceStats(prices, 96);
  expect(s.hasHistory).toBe(true);
  expect(s.low).toBe(90); expect(s.high).toBe(280);
  expect(s.percentile).toBe(5);
});
test('exact MIN_SAMPLES boundary (14) → hasHistory', () => {
  const prices = Array.from({ length: 14 }, (_, i) => 100 + i * 5);
  expect(priceStats(prices, 110).hasHistory).toBe(true);
});
test('one below boundary (13) → no claim', () => {
  const prices = Array.from({ length: 13 }, (_, i) => 100 + i * 5);
  expect(priceStats(prices, 110).hasHistory).toBe(false);
});
