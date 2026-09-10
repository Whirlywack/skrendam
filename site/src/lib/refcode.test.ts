import { describe, expect, it } from 'vitest';
import { parseRefCode, refCode } from './refcode';

describe('refCode / parseRefCode round-trip', () => {
  it.each([1, 35, 36, 1295, 123456])('round-trips id %i', (id) => {
    const code = refCode(id);
    expect(parseRefCode(code)).toBe(id);
  });

  // NOTE: 'zz' is NOT usable as a bad-checksum example here — under this exact
  // formula every single-char body's checksum equals that same char (sum of
  // one char's own index, mod 36, indexes back to itself), so 'zz' actually
  // decodes to id 35 (see the round-trip case above). 'ab' has a genuine
  // checksum mismatch (body 'a' → id 10 → real code 'aa', not 'ab').
  it('rejects a code with a bad checksum', () => {
    expect(parseRefCode('ab')).toBeNull();
  });

  it('rejects malformed input (wrong charset / length)', () => {
    expect(parseRefCode('')).toBeNull();
    expect(parseRefCode('A1')).toBeNull();
    expect(parseRefCode('1')).toBeNull();
  });

  it('rejects a transposed body under the same checksum digit', () => {
    // Position-weighted checksum: transposing two characters of a valid
    // body must change the checksum, so reusing the original code's
    // checksum digit on the transposed body must not validate.
    const id = parseInt('abl', 36);
    const code = refCode(id); // body 'abl' + its checksum
    expect(code.startsWith('abl')).toBe(true);
    const checksum = code.slice(-1);
    const transposed = 'bal' + checksum;
    expect(parseRefCode(code)).toBe(id);
    expect(parseRefCode(transposed)).toBeNull();
  });

  it('id 0 round-trips to "00" without a truthy-check pitfall', () => {
    expect(refCode(0)).toBe('00');
    expect(parseRefCode('00')).toBe(0);
  });

  it('throws RangeError for ids above the safe-integer ceiling', () => {
    expect(() => refCode(2 ** 53)).toThrow(RangeError);
  });

  it('round-trips the largest safe id', () => {
    const id = Number.MAX_SAFE_INTEGER;
    expect(parseRefCode(refCode(id))).toBe(id);
  });

  it('returns null for an out-of-range body instead of throwing', () => {
    // 'zzzzzzzzzzz' parses to ~1.3e17 — past Number.MAX_SAFE_INTEGER, where
    // float rounding makes the re-derivation meaningless. Public input:
    // it must come back null, never a RangeError out of parseRefCode.
    expect(() => parseRefCode('zzzzzzzzzzzz')).not.toThrow();
    expect(parseRefCode('zzzzzzzzzzzz')).toBeNull();
  });

  it('throws RangeError for negative ids', () => {
    expect(() => refCode(-1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Drift guard — the site and the Deal Desk must decode the same codes
// ---------------------------------------------------------------------------

describe('refcode.ts is byte-identical in site/ and web/', () => {
  it('has no drift between the two copies', async () => {
    const { readFile } = await import('node:fs/promises');
    const here = new URL('./refcode.ts', import.meta.url);
    const there = new URL('../../../web/src/lib/refcode.ts', import.meta.url);
    const [site, web] = await Promise.all([
      readFile(here, 'utf8'),
      readFile(there, 'utf8'),
    ]);
    expect(web).toBe(site);
  });
});
