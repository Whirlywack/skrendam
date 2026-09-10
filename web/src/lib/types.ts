import type { Tier } from './tiers';
export type { Tier };

export type DisplayStatus = 'suggested' | 'review' | 'rejected' | 'published' | 'expired';

export interface CandidateView {
  id: string;
  candidateId: number;
  templateId: number;
  matchId: number;
  score: number;            // 0–100
  tier: Tier;
  status: DisplayStatus;
  place: string; country: string; origin: string;
  from: string; to: string; tripType: string;
  price: number; usual: number | null; drop: number;
  dates: string; travelDate: string; legs: string; airline: string;
  template: string;
  signals: string[]; flags: string[];
  grad: string;
  verifiedAt: string | null;
  copy: { headline: string; hook: string; news: string };
  context?: import('./routeContext').RouteContext;
  scoreV2: number | null;            // engine demand score, null on legacy rows
  archetype: 'date' | 'rare' | 'destination' | null;
  commodityShare: number | null;     // 0..1
  savingFamily: number | null;       // € for 4 seats, families templates only
  windowSlug: string | null;
  personas: string[];                // pref codes from personas.json[newsletterTag]
  priority: number;                  // dealTemplates.priority
}

export interface ScanView { fares: string; airports: number; ago: string; newToday: number; status: string; healthReasons: string[]; }
export interface TemplateGroup { templateId: number; templateLabel: string; items: CandidateView[]; }
