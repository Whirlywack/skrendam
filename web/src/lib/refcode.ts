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
 * A code is at most 12 characters (an 11-char base36 body + 1 checksum
 * digit), so `refCode` only accepts `0 <= id < 36 ** 11` and throws
 * `RangeError` outside that range. Note `refCode(0)` is `'00'`, which
 * decodes back to id `0` — callers must check `parseRefCode(...) !== null`,
 * not truthy-check the returned id.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const MAX_ID = 36 ** 11;

export function refCode(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id >= MAX_ID) {
    throw new RangeError(`refCode: id ${id} out of range (0 <= id < 36 ** 11)`);
  }
  const body = id.toString(36);
  const sum = [...body].reduce((a, ch, i) => a + (i + 1) * ALPHABET.indexOf(ch), 0);
  return body + ALPHABET[sum % 36];
}

export function parseRefCode(code: string): number | null {
  if (!/^[0-9a-z]{2,12}$/.test(code)) return null;
  const body = code.slice(0, -1);
  const id = parseInt(body, 36);
  return refCode(id) === code ? id : null;
}
