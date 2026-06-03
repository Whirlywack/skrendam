import { expect, test } from 'vitest';
import { tierForScore, GREAT_THRESHOLD } from './tiers';

test('great at/above threshold, maybe below', () => {
  expect(tierForScore(GREAT_THRESHOLD)).toBe('great');
  expect(tierForScore(GREAT_THRESHOLD - 1)).toBe('maybe');
  expect(tierForScore(95)).toBe('great');
  expect(tierForScore(60)).toBe('maybe');
});
