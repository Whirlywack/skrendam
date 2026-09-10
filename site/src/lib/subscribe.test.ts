import { expect, test, describe } from 'vitest';
import {
  normalizeEmail,
  isValidEmail,
  cleanSource,
  cleanPrefs,
  cleanUtm,
  cleanRef,
  signupPrefs,
  resubscribeReset,
  SUBSCRIBE_SOURCES,
  TRACKING_KEYS,
  ORIGIN_CODES,
  MOMENT_CODES,
} from '@/lib/subscribe-prefs';
import { refCode } from '@/lib/refcode';

// ---------------------------------------------------------------------------
// normalizeEmail
// ---------------------------------------------------------------------------

describe('normalizeEmail', () => {
  test('trims whitespace', () => {
    expect(normalizeEmail('  hello@example.com  ')).toBe('hello@example.com');
  });

  test('lowercases', () => {
    expect(normalizeEmail('Hello@EXAMPLE.COM')).toBe('hello@example.com');
  });

  test('trims + lowercases together', () => {
    expect(normalizeEmail('  FOO@Bar.io  ')).toBe('foo@bar.io');
  });
});

// ---------------------------------------------------------------------------
// isValidEmail
// ---------------------------------------------------------------------------

describe('isValidEmail — accept', () => {
  test.each([
    'a@b.com',
    'user+tag@sub.domain.org',
    'foo.bar@example.co.uk',
    'hello@yip.lt',
  ])('%s is valid', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });
});

describe('isValidEmail — reject', () => {
  test.each([
    '',
    'notanemail',
    '@nodomain.com',
    'missingat.com',
    'two@@at.com',
    'space in@email.com',
    'foo@',
    'foo@bar',
  ])('%s is invalid', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  test('over-length email is rejected (254-char RFC ceiling)', () => {
    const oversized = `${'a'.repeat(250)}@example.com`;
    expect(oversized.length).toBeGreaterThan(254);
    expect(isValidEmail(oversized)).toBe(false);
  });

  test('a 254-char email still passes', () => {
    const local = 'a'.repeat(254 - '@example.com'.length);
    const email = `${local}@example.com`;
    expect(email.length).toBe(254);
    expect(isValidEmail(email)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cleanSource
// ---------------------------------------------------------------------------

describe('cleanSource', () => {
  test('returns allowed source as-is', () => {
    expect(cleanSource('home')).toBe('home');
    expect(cleanSource('subscribe')).toBe('subscribe');
    expect(cleanSource('deal')).toBe('deal');
    expect(cleanSource('collection')).toBe('collection');
    expect(cleanSource('past')).toBe('past');
    expect(cleanSource('early')).toBe('early');
    expect(cleanSource('site')).toBe('site');
  });

  test('falls back to "site" for unknown values', () => {
    expect(cleanSource('admin')).toBe('site');
    expect(cleanSource('__proto__')).toBe('site');
    expect(cleanSource('constructor')).toBe('site');
    expect(cleanSource('DROP TABLE')).toBe('site');
  });

  test('falls back to "site" for null/undefined', () => {
    expect(cleanSource(null)).toBe('site');
    expect(cleanSource(undefined)).toBe('site');
  });

  test('tiktok is an allowed source', () => {
    expect(SUBSCRIBE_SOURCES).toContain('tiktok');
    expect(cleanSource('tiktok')).toBe('tiktok');
  });
});

// ---------------------------------------------------------------------------
// cleanUtm
// ---------------------------------------------------------------------------

describe('cleanUtm', () => {
  test('keeps known utm_* keys, strips prefix, trims, drops junk keys', () => {
    expect(cleanUtm({ utm_source: ' tiktok ', utm_content: 'v123', junk: 'x' })).toEqual({
      source: 'tiktok',
      content: 'v123',
    });
  });

  test('maps all five utm keys', () => {
    expect(
      cleanUtm({
        utm_source: 'a',
        utm_medium: 'b',
        utm_campaign: 'c',
        utm_content: 'd',
        utm_term: 'e',
      }),
    ).toEqual({ source: 'a', medium: 'b', campaign: 'c', content: 'd', term: 'e' });
  });

  test('drops empty strings and non-string values', () => {
    expect(
      cleanUtm({ utm_source: '', utm_medium: '   ', utm_campaign: 42, utm_term: null }),
    ).toEqual({});
  });

  test('caps values at 80 chars', () => {
    const long = 'a'.repeat(100);
    const result = cleanUtm({ utm_campaign: long });
    expect(result.campaign).toBe('a'.repeat(80));
  });

  test('empty input returns empty object', () => {
    expect(cleanUtm({})).toEqual({});
  });

  test('strips control characters before trimming/capping', () => {
    expect(cleanUtm({ utm_source: 'tik\x00tok\x1f\x7f' })).toEqual({ source: 'tiktok' });
  });

  test('drops a value that is nothing but control characters', () => {
    expect(cleanUtm({ utm_source: '\x00\x01\x1f' })).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// cleanRef
// ---------------------------------------------------------------------------

describe('cleanRef', () => {
  const VALID = refCode(13359); // 'ab35'

  test('accepts a real referral code', () => {
    expect(cleanRef(VALID)).toBe(VALID);
  });

  test('accepts an uppercased code by lowercasing it', () => {
    expect(cleanRef(VALID.toUpperCase())).toBe(VALID);
  });

  test('rejects a well-shaped code that fails its checksum', () => {
    // The old shape-only check let any [a-z0-9]{2,12} through, so a typo or a
    // made-up code was stored as an attribution that decodes to nobody.
    expect(cleanRef('ab3x')).toBeNull();
  });

  test('rejects disallowed characters', () => {
    expect(cleanRef('<script>')).toBeNull();
  });

  test('rejects undefined', () => {
    expect(cleanRef(undefined)).toBeNull();
  });

  test('rejects too short or too long', () => {
    expect(cleanRef('a')).toBeNull();
    expect(cleanRef('a'.repeat(13))).toBeNull();
  });

  test('rejects non-string input', () => {
    expect(cleanRef(123)).toBeNull();
    expect(cleanRef(null)).toBeNull();
  });

  test('round-trips every code refCode mints', () => {
    for (const id of [0, 1, 42, 13359, 999999]) {
      expect(cleanRef(refCode(id))).toBe(refCode(id));
    }
  });
});

// ---------------------------------------------------------------------------
// TRACKING_KEYS
// ---------------------------------------------------------------------------

describe('TRACKING_KEYS', () => {
  test('lists the five utm keys plus ref', () => {
    expect(TRACKING_KEYS).toEqual([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ref',
    ]);
  });
});

describe('cleanPrefs — origins', () => {
  test('accepts valid origin codes', () => {
    const { origins } = cleanPrefs(['VNO', 'KUN'], []);
    expect(origins).toEqual(['VNO', 'KUN']);
  });

  test('drops unknown origin codes', () => {
    const { origins } = cleanPrefs(['VNO', 'EVIL', 'SQL_INJECTION'], []);
    expect(origins).toEqual(['VNO']);
  });

  test('empty input returns empty array', () => {
    const { origins } = cleanPrefs([], []);
    expect(origins).toEqual([]);
  });

  test('all known origins pass through', () => {
    const { origins } = cleanPrefs([...ORIGIN_CODES], []);
    expect(origins).toHaveLength(ORIGIN_CODES.length);
  });

  test('de-duplicates by filter (keeps first occurrence in order)', () => {
    const { origins } = cleanPrefs(['VNO', 'VNO', 'RIX'], []);
    // Both VNO instances pass the allowlist, so we get both (filter doesn't dedup)
    expect(origins.filter((c) => c === 'VNO')).toHaveLength(2);
    expect(origins).toContain('RIX');
  });
});

// ---------------------------------------------------------------------------
// cleanPrefs — moments filtering
// ---------------------------------------------------------------------------

describe('cleanPrefs — moments', () => {
  test('accepts valid moment codes', () => {
    const { moments } = cleanPrefs([], ['sun', 'city']);
    expect(moments).toEqual(['sun', 'city']);
  });

  test('drops unknown moment codes', () => {
    const { moments } = cleanPrefs([], ['sun', 'HACKED', '<script>']);
    expect(moments).toEqual(['sun']);
  });

  test('all known moments pass through', () => {
    const { moments } = cleanPrefs([], [...MOMENT_CODES]);
    expect(moments).toHaveLength(MOMENT_CODES.length);
  });

  test('offers the home moment (WP7 — Lithuanians abroad flying home)', () => {
    expect(MOMENT_CODES).toContain('home');
    const { moments } = cleanPrefs([], ['home']);
    expect(moments).toEqual(['home']);
  });

  test('empty input returns empty array', () => {
    const { moments } = cleanPrefs([], []);
    expect(moments).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// cleanPrefs — combined
// ---------------------------------------------------------------------------

describe('cleanPrefs — combined', () => {
  test('filters both in one call', () => {
    const result = cleanPrefs(
      ['VNO', 'BADCODE', 'WAW'],
      ['sun', 'HACK', 'last_minute'],
    );
    expect(result.origins).toEqual(['VNO', 'WAW']);
    expect(result.moments).toEqual(['sun', 'last_minute']);
  });
});

// ---------------------------------------------------------------------------
// signupPrefs
// ---------------------------------------------------------------------------

describe('signupPrefs', () => {
  test('returns null when there is nothing to store', () => {
    expect(signupPrefs({}, null, false)).toBeNull();
  });

  test('keeps utm under a utm key', () => {
    expect(signupPrefs({ source: 'tiktok' }, null, false)).toEqual({
      utm: { source: 'tiktok' },
    });
  });

  test('stores a referral code as referred_by', () => {
    expect(signupPrefs({}, 'ab3', false)).toEqual({ referred_by: 'ab3' });
  });

  test('marks an early opt-in as founding interest', () => {
    expect(signupPrefs({}, null, true)).toEqual({ founding_interest: true });
  });

  test('combines attribution and founding interest', () => {
    expect(signupPrefs({ source: 'tiktok' }, 'ab3', true)).toEqual({
      utm: { source: 'tiktok' },
      referred_by: 'ab3',
      founding_interest: true,
    });
  });

  test('never sets founding_interest to false — the key is absent instead', () => {
    expect(Object.keys(signupPrefs({}, 'ab3', false) ?? {})).toEqual(['referred_by']);
  });
});

// ---------------------------------------------------------------------------
// resubscribeReset — the on-conflict SET for unconfirmed / unsubscribed rows
// ---------------------------------------------------------------------------

describe('resubscribeReset', () => {
  test('double opt-in: back to an unconfirmed row with a fresh token, purge clock stopped', () => {
    expect(resubscribeReset('tok', null)).toEqual({
      confirmToken: 'tok',
      confirmed: false,
      confirmedAt: null,
      unsubscribedAt: null,
    });
  });

  test('single opt-in: confirmed on the spot, unsubscribe mark still cleared', () => {
    const at = '2026-09-10T08:00:00.000Z';
    expect(resubscribeReset('tok', at)).toEqual({
      confirmToken: 'tok',
      confirmed: true,
      confirmedAt: at,
      unsubscribedAt: null,
    });
  });

  test('never touches the unsubscribe token, email, prefs or the early flag', () => {
    // The link in mails a rejoining subscriber already has must keep working,
    // and prefs are merged (jsonb ||) by the caller, never written here.
    expect(Object.keys(resubscribeReset('tok', null)).sort()).toEqual([
      'confirmToken',
      'confirmed',
      'confirmedAt',
      'unsubscribedAt',
    ]);
  });
});
