import type { QualityTag } from './quality';
import type { BookingCta } from './booking';
import type { DealArchetype } from './mappers';
export type StatusKind = 'fresh' | 'going_fast' | 'gone';

/** published_deals.status as the site reads it (WP9): a `changed` deal is still
 *  a deal, but the daily check found it above the published price, so the site
 *  shows the current price and says what it was found at. Expired rows carry
 *  'live' here only nominally — they render from the archive paths. */
export type DealState = 'live' | 'changed';

export interface TicketView {
  id: number;
  destination: string; country: string; origin: string;
  route: string;          // "VNO → LCA"
  dates: string; legs: string;  // legs = "1 stop · 7h" summary
  month: string;          // "gruodis" — all a locked row reveals of the dates
  /** The price a reader can book at today: current_price when changed, else the published one. */
  price: number; baseline: number | null; drop: number;
  state: DealState;
  foundPrice: number;         // published_deals.price — what the letter said
  currentPrice: number | null; // published_deals.current_price — last verified price
  priceLines: string[];       // changed: [„Dabar nuo 124 €", „radome už 93 €"]; live: []
  quality: import('./quality').QualityTag;
  headline: string;       // pd.headline or a generated hook
  eyebrow: string;        // pd.publicLabel or "Found by hand"
  catchChip: string;      // "Direct" | "1 stop" | "2 stops"
  scene: string;          // sceneClass(destination)
  airline: string;
  goingFast: boolean;
}
export interface PublicDeal {
  id: number;               // published_deals.id
  destination: string; origin: string; route: string; tripType: string;
  dates: string; stops: number;
  /** The price a reader can book at today: current_price when changed, else the published one. */
  price: number; baseline: number | null; drop: number;
  state: DealState;
  foundPrice: number;         // published_deals.price — what the letter said
  currentPrice: number | null; // published_deals.current_price — last verified price
  priceLines: string[];       // changed: [„Dabar nuo 124 €", „radome už 93 €"]; live: []
  quality: QualityTag;      // floored to 'great' for published deals
  verdict: string;          // "Book this — it rarely drops this low."
  why: string;              // "−36% vs typical" (browse) / "−36% vs the 90-day median (€X)" (detail)
  catchLine: string | null; // "Catch: 3h Riga layover"
  status: { kind: StatusKind; label: string };
  booking: BookingCta;
  airline: string;
  verifiedAt: string | null;  // published_deals.verified_at, else candidates.verified_at; drives the freshness label
  groundHint: string | null;  // e.g. "Iš Vilniaus: 59 min traukiniu"; not rendered yet
  // Demand layer (0.4B). Passed through for the copy and collection work that
  // follows; nothing renders them yet, and every one is null on a legacy row
  // the demand scorer never touched.
  archetype: DealArchetype | null;  // why it looked interesting: date | rare | destination
  windowSlug: string | null;        // peak window it sits in, e.g. "xmas_markets"
  savingFamily: number | null;      // € saved for a family of four, when the window is a family one
}
