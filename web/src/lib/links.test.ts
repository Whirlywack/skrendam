import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimUrl, siteUrl, trackedDealUrl, unsubscribeUrl, upgradeUrl } from './links';
import { refCode } from './refcode';

afterEach(() => { vi.unstubAllEnvs(); });

describe('siteUrl', () => {
  it('falls back to the live domain when NEXT_PUBLIC_SITE_URL is unset (links are read in inboxes)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl()).toBe('https://yip.lt');
  });
  it('strips a trailing slash from the configured base', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.yip.lt/');
    expect(siteUrl()).toBe('https://preview.yip.lt');
  });
});

describe('unsubscribeUrl', () => {
  it('matches site/src/lib/unsubscribe.ts byte for byte with env unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(unsubscribeUrl('abc')).toBe('https://yip.lt/atsisakyti?token=abc');
  });
  it('URL-encodes the token', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(unsubscribeUrl('a b&c')).toBe('https://yip.lt/atsisakyti?token=a%20b%26c');
  });
});

describe('trackedDealUrl', () => {
  it('carries deal id, issue id and the subscriber ref code', () => {
    expect(trackedDealUrl(42, 7, 5)).toMatch(new RegExp(`/go/42\\?i=7&s=${refCode(5)}$`));
  });
  it('leaves i= empty for an instant send with no issue', () => {
    expect(trackedDealUrl(42, null, 5)).toMatch(new RegExp(`/go/42\\?i=&s=${refCode(5)}$`));
  });
  it('is rooted at siteUrl()', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.yip.lt');
    expect(trackedDealUrl(1, 2, 3)).toBe(`https://preview.yip.lt/go/1?i=2&s=${refCode(3)}`);
  });
});

describe('claimUrl', () => {
  it('uses the /uzsisakiau path with the same query shape as trackedDealUrl', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(claimUrl(42, 7, 5)).toBe(`https://yip.lt/uzsisakiau/42?i=7&s=${refCode(5)}`);
    expect(claimUrl(42, null, 5)).toBe(`https://yip.lt/uzsisakiau/42?i=&s=${refCode(5)}`);
  });
});

describe('upgradeUrl', () => {
  it("returns '' when PAYMENT_LINK_URL is unset so renderers can omit the upgrade block", () => {
    vi.stubEnv('PAYMENT_LINK_URL', '');
    expect(upgradeUrl(5)).toBe('');
  });
  it('appends client_reference_id=<refCode> when the payment link is configured', () => {
    vi.stubEnv('PAYMENT_LINK_URL', 'https://buy.stripe.com/test_abc');
    expect(upgradeUrl(5)).toBe(`https://buy.stripe.com/test_abc?client_reference_id=${refCode(5)}`);
  });
});
