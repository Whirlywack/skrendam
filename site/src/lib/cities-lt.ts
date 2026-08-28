// IATA → Lithuanian city grammar: nominative (posters/index), accusative („skrydis į Malagą“),
// locative („Malagoje dar šilta“) + Lithuanian country name. VLKK exonyms; plural-only cities
// decline as plurals (Atėnai → Atėnus → Atėnuose); indeclinable names repeat the nominative.
// Unknown codes fall back to the English airports.json name (or the code itself).
import raw from './cities-lt.json';
import A from './airports.json';

export type LtCity = { nom: string; acc: string; loc: string; country: string };

const MAP = raw as Record<string, LtCity>;
const EN = A as Record<string, { city: string; country: string }>;

export function ltCity(iata: string): LtCity {
  const hit = MAP[iata];
  if (hit) return hit;
  const a = EN[iata];
  const n = a?.city ?? iata;
  return { nom: n, acc: n, loc: n, country: a?.country ?? '' };
}
