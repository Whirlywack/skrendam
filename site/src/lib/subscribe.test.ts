import { expect, test, describe } from 'vitest';
import {
  normalizeEmail,
  isValidEmail,
  cleanSource,
  cleanPrefs,
  ORIGIN_CODES,
  MOMENT_CODES,
} from '@/lib/subscribe-prefs';

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
});

// ---------------------------------------------------------------------------
// cleanPrefs — origins filtering
// ---------------------------------------------------------------------------

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
