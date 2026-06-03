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
  expect(s.percentile).toBeLessThanOrEqual(10); // 96 is near the bottom
});
