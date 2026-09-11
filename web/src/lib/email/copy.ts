import { eur } from '../format';
import { ltCity } from './format-lt';

/** Letter copy — spec §7 verbatim (launch spec, "7. Copy"). Lithuanian, `tu`
 *  voice, lowercase spoken verbs, „radinys". Banned anywhere in a mail:
 *  akcija, superkaina, nepraleisk progos!, „skenuoti"/"scan". Numbers are the
 *  hero, so subjects lead with the price. Anything not listed here (intro
 *  lines, link labels) lives in `render.ts` next to the markup it belongs to. */
export const L = {
  headline: 'Savaitės radinys',
  family: 'Atostogų radaras',
  missed: 'Ką praleidai',
  upgrade: 'Gauk kiekvieną radinį tą pačią minutę',
  booked: 'Užsisakiau',
  /** Real counts only — the caller reads `n` from `deal_events`, never estimates. */
  bookedN: (n: number) => `${n} prenumeratorių užsisakė`,
  /** „93 € — Londonas" — the price leads, the city in LT nominative. */
  instantSubject: (deal: { price: number | string; destination: string }) =>
    `${eur(Number(deal.price))} — ${ltCity(deal.destination).nom}`,
  digestSubject: (n: number) => `Savaitės radiniai: ${n}`,
  /** Real count of fresh finds in the letter — one, several, or (only if a
   *  caller ever allows it) none; the subject must never promise more than
   *  the body carries. */
  nurtureSubject: (n: number) =>
    n === 1
      ? 'Ką praleidai — ir vienas naujas radinys'
      : n > 1
        ? `Ką praleidai — ir ${n} nauji radiniai`
        : 'Ką praleidai',
  lasted: (h: number) => (h < 48 ? `išbuvo ${h} val.` : `išbuvo ${Math.round(h / 24)} d.`),
  usually: (b: number) => `įprastai ${eur(b)}`,
  /** A `changed` deal: the fare is still there, above the published price —
   *  the card reads „nuo 124 € · radome už 93 €". Real numbers, both of them. */
  from: (current: number) => `nuo ${eur(current)}`,
  foundAt: (published: number) => `radome už ${eur(published)}`,
  unsub: 'Atsisakyti laiškų',
  bookDirect: 'Į bilietus →',
} as const;
