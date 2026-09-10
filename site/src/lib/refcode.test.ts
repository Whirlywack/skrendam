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
});
