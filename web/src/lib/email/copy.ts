import { city } from '../airports';
import { eur } from '../format';

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
  instantSubject: (deal: { price: number | string; destination: string }) =>
    `${eur(Number(deal.price))} — ${city(deal.destination)}`,
  digestSubject: (n: number) => `Savaitės radiniai: ${n}`,
  nurtureSubject: 'Ką praleidai — ir du nauji radiniai',
  lasted: (h: number) => (h < 48 ? `išbuvo ${h} val.` : `išbuvo ${Math.round(h / 24)} d.`),
  usually: (b: number) => `įprastai ${eur(b)}`,
  unsub: 'Atsisakyti laiškų',
  bookDirect: 'Į bilietus →',
} as const;
