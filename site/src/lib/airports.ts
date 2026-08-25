// IATA → {city, country}. Copy of skrendam/airports.json (canonical; tests/skrendam/test_shared_data.py
// fails if this drifts). Falls back to the IATA code.
import A from './airports.json';

const MAP = A as Record<string, { city: string; country: string }>;
export function city(iata: string): string { return MAP[iata]?.city ?? iata; }
export function country(iata: string): string { return MAP[iata]?.country ?? ''; }

/** Public headline: the curator's copy, unless it is an un-edited machine string
 *  ("VNO->LCA just EUR140 …" from pre-0011 scans) — then a plain brand-voice fallback. */
export function dealHeadline(
  headline: string | null | undefined,
  price: number,
  destination: string,
): string {
  if (headline && !/^[A-Z]{3}->[A-Z]{3}/.test(headline)) return headline;
  return `€${Math.round(price)} return to ${city(destination)}`;
}
