import type { QualityTag } from './quality';
import type { BookingCta } from './booking';
import type { DealArchetype } from './mappers';
export type StatusKind = 'fresh' | 'going_fast' | 'gone';

export interface TicketView {
  id: number;
  destination: string; country: string; origin: string;
  route: string;          // "VNO → LCA"
  dates: string; legs: string;  // legs = "1 stop · 7h" summary
  month: string;          // "gruodis" — all a locked row reveals of the dates
  price: number; baseline: number | null; drop: number;
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
  price: number; baseline: number | null; drop: number;
  quality: QualityTag;      // floored to 'great' for published deals
  verdict: string;          // "Book this — it rarely drops this low."
  why: string;              // "−36% vs typical" (browse) / "−36% vs the 90-day median (€X)" (detail)
  catchLine: string | null; // "Catch: 3h Riga layover"
  status: { kind: StatusKind; label: string };
  booking: BookingCta;
  airline: string;
  verifiedAt: string | null;  // candidates.verified_at passthrough; not rendered yet
  groundHint: string | null;  // e.g. "Iš Vilniaus: 59 min traukiniu"; not rendered yet
  // Demand layer (0.4B). Passed through for the copy and collection work that
  // follows; nothing renders them yet, and every one is null on a legacy row
  // the demand scorer never touched.
  archetype: DealArchetype | null;  // why it looked interesting: date | rare | destination
  windowSlug: string | null;        // peak window it sits in, e.g. "xmas_markets"
  savingFamily: number | null;      // € saved for a family of four, when the window is a family one
}
