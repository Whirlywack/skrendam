import { afterEach, describe, expect, test } from 'vitest';
import { isUnsubscribeToken, unsubscribeUrl } from '@/lib/unsubscribe';

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe('unsubscribeUrl', () => {
  test('builds the /atsisakyti link from NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.yip.lt';
    expect(unsubscribeUrl('abc123')).toBe('https://staging.yip.lt/atsisakyti?token=abc123');
  });

  test('falls back to the live site, never to localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(unsubscribeUrl('abc123')).toBe('https://yip.lt/atsisakyti?token=abc123');
  });

  test('tolerates a trailing slash on the base', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://yip.lt/';
    expect(unsubscribeUrl('abc123')).toBe('https://yip.lt/atsisakyti?token=abc123');
  });

  test('encodes the token', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://yip.lt';
    expect(unsubscribeUrl('a b&c')).toBe('https://yip.lt/atsisakyti?token=a%20b%26c');
  });
});

describe('isUnsubscribeToken', () => {
  test('accepts the 32-hex token an insert mints', () => {
    expect(isUnsubscribeToken('0123456789abcdef0123456789abcdef')).toBe(true);
  });

  test('rejects a missing, short or non-string token before any DB lookup', () => {
    expect(isUnsubscribeToken(null)).toBe(false);
    expect(isUnsubscribeToken(undefined)).toBe(false);
    expect(isUnsubscribeToken('')).toBe(false);
    expect(isUnsubscribeToken('deadbeef')).toBe(false);
    expect(isUnsubscribeToken(42)).toBe(false);
    expect(isUnsubscribeToken(['0123456789abcdef0123456789abcdef'])).toBe(false);
  });
});
