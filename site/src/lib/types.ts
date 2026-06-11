import type { QualityTag } from './quality';
import type { BookingCta } from './booking';
export type StatusKind = 'fresh' | 'going_fast' | 'gone';

export interface TicketView {
  id: number;
  destination: string; country: string; origin: string;
  route: string;          // "VNO → LCA"
  dates: string; legs: string;  // legs = "1 stop · 7h" summary
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
}
