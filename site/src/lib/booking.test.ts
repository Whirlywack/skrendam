import { expect, test } from 'vitest';
import { bookingCta } from './booking';
test('google fallback (v1 default — stored tfs link)', () => {
  const c = bookingCta('https://www.google.com/travel/flights?tfs=ABC');
  expect(c.kind).toBe('google');
  expect(c.button).toBe('Open in Google Flights');
});
test('airline-direct upgrade (fast-follow data)', () => {
  const c = bookingCta('https://airbaltic.com/x', 'airBaltic', 'airline');
  expect(c.button).toBe('Book with airBaltic');
  expect(c.sub).toMatch(/Airline-direct/);
});
test('ota', () => {
  expect(bookingCta('https://ota/x', null, 'ota').button).toBe('Open booking partner');
});
test('airline kind + null vendor → google fallback (v1 spec)', () => {
  const c = bookingCta('https://airline.com/x', null, 'airline');
  expect(c.kind).toBe('google');
});
test('rejects javascript: url → google fallback', () => {
  const c = bookingCta('javascript:alert(document.cookie)');
  expect(c.url).toBe('https://www.google.com/travel/flights');
});
