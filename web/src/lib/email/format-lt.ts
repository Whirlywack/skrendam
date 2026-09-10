// Lithuanian formatting for letters — mirrors `site/src/lib/format.ts:14-26`
// (formatDates) and `site/src/lib/cities-lt.ts` (ltCity) so a deal reads the
// same in the inbox as on yip.lt. The desk UI stays English (`../format.ts`);
// only mail goes through here. Keep both files in step with the site copies.
import { city } from '../airports';
import raw from './cities-lt.json';

// VLKK month abbreviations, month-first genitive order („rugs. 12–19").
const MONTHS = [
  'saus.', 'vas.', 'kov.', 'bal.', 'geg.', 'birž.',
  'liep.', 'rugpj.', 'rugs.', 'spal.', 'lapkr.', 'gruod.',
];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }

export function formatDatesLt(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.mon} ${a.day}`;
  const b = d(ret);
  // Same month: „rugs. 12–19"; cross-month: „rugs. 29 – spal. 2" (spaced en dash).
  return a.mon === b.mon ? `${a.mon} ${a.day}–${b.day}` : `${a.mon} ${a.day} – ${b.mon} ${b.day}`;
}

export type LtCity = { nom: string; acc: string; loc: string; country: string };

const MAP = raw as Record<string, LtCity>;

/** Lithuanian city grammar for an IATA code (`cities-lt.json`, byte-identical
 *  to the site's). Unknown codes fall back to the English `airports.json` name
 *  (or the code itself) in every case, as `site/src/lib/cities-lt.ts` does. */
export function ltCity(iata: string): LtCity {
  const hit = MAP[iata];
  if (hit) return hit;
  const n = city(iata);
  return { nom: n, acc: n, loc: n, country: '' };
}
