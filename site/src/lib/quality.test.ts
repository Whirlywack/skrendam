import { expect, test } from 'vitest';
import { qualityTag, RARE_THRESHOLD, GREAT_THRESHOLD } from './quality';
test('bands', () => {
  expect(qualityTag(RARE_THRESHOLD)).toBe('rare');   // 94
  expect(qualityTag(GREAT_THRESHOLD)).toBe('great'); // 88
  expect(qualityTag(GREAT_THRESHOLD - 1)).toBeNull();
  expect(qualityTag(100)).toBe('rare');
});
