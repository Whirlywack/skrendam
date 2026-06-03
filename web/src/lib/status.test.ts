import { expect, test } from 'vitest';
import { toDisplayStatus } from './status';

test('maps engine status + publish state to display status', () => {
  expect(toDisplayStatus('new', false)).toBe('suggested');
  expect(toDisplayStatus('seen', false)).toBe('review');
  expect(toDisplayStatus('maybe', false)).toBe('review');
  expect(toDisplayStatus('rejected', false)).toBe('rejected');
  expect(toDisplayStatus('approved', false)).toBe('published');
  expect(toDisplayStatus('new', true)).toBe('published'); // published_deal exists
  expect(toDisplayStatus('expired', false)).toBe('expired');
});
