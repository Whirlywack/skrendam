/**
 * Ground-link hints for origins reachable from Vilnius by train/bus — surfaced
 * so a future site redo can tell a Vilnius reader "you don't need to be at
 * this airport" for nearby alternate origins. Data exposure only; no
 * rendering here (see task 0.4A brief).
 */
const GROUND_HINTS: Record<string, string> = {
  KUN: 'Iš Vilniaus: 59 min traukiniu',
  RIX: 'Iš Vilniaus: traukinys nuo €9.60, ~4 val.',
};

export function groundHint(origin: string): string | null {
  return GROUND_HINTS[origin] ?? null;
}
