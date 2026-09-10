import { afterEach, describe, expect, test } from 'vitest';
import { unsubscribeUrl } from '@/lib/unsubscribe';

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
