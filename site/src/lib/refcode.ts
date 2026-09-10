/**
 * Referral code — no migration needed. Derived purely from the subscriber id:
 * base36(id) + a 1-char checksum digit, decoded back by re-deriving and
 * comparing. Short, URL-safe, and reversible without any DB lookup.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function refCode(id: number): string {
  const body = id.toString(36);
  const sum = [...body].reduce((a, ch) => a + ALPHABET.indexOf(ch), 0);
  return body + ALPHABET[sum % 36];
}

export function parseRefCode(code: string): number | null {
  if (!/^[0-9a-z]{2,12}$/.test(code)) return null;
  const body = code.slice(0, -1);
  return refCode(parseInt(body, 36)) === code ? parseInt(body, 36) : null;
}
