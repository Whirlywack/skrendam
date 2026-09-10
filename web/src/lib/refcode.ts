/**
 * Referral code — no migration needed. Derived purely from the subscriber id:
 * base36(id) + a 1-char checksum digit, decoded back by re-deriving and
 * comparing. Short, URL-safe, and reversible without any DB lookup.
 *
 * The checksum is position-weighted (`(i + 1) * value`, summed left to
 * right) rather than a plain sum, so transposing two characters in the
 * body changes the checksum and is caught — a plain order-independent sum
 * would let `'abl'` and `'bal'` (or any anagram) validate under the same
 * checksum digit.
 *
 * The ceiling is `Number.MAX_SAFE_INTEGER`, not `36 ** 11`: past 2**53 the
 * base36 round-trip runs on rounded floats and stops meaning anything. That
 * caps the body at 11 base36 characters (10 for any id below 36**10, which
 * is every subscriber id this list will ever have) and the whole code at 12,
 * matching the accepted-shape regex below. `refCode` throws `RangeError`
 * outside the range; `parseRefCode` catches it and returns null, because its
 * input is a public URL parameter. Note `refCode(0)` is `'00'`, which decodes
 * back to id `0` — callers must check `parseRefCode(...) !== null`, not
 * truthy-check the returned id.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const MAX_ID = Number.MAX_SAFE_INTEGER;

export function refCode(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id > MAX_ID) {
    throw new RangeError(`refCode: id ${id} out of range (0 <= id <= Number.MAX_SAFE_INTEGER)`);
  }
  const body = id.toString(36);
  const sum = [...body].reduce((a, ch, i) => a + (i + 1) * ALPHABET.indexOf(ch), 0);
  return body + ALPHABET[sum % 36];
}

export function parseRefCode(code: string): number | null {
  if (!/^[0-9a-z]{2,12}$/.test(code)) return null;
  const body = code.slice(0, -1);
  const id = parseInt(body, 36);
  try {
    return refCode(id) === code ? id : null;
  } catch {
    // Out of range (a 12-char body decodes past 2**53) — not a valid code.
    return null;
  }
}
