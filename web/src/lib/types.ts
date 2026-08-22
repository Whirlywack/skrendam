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
  from: string; to: string;
  price: number; usual: number | null; drop: number;
  dates: string; travelDate: string; legs: string; airline: string;
  template: string;
  signals: string[]; flags: string[];
  grad: string;
  verifiedAt: string | null;
  copy: { headline: string; hook: string; news: string };
}

export interface ScanView { fares: string; airports: number; ago: string; newToday: number; status: string; healthReasons: string[]; }
export interface TemplateGroup { templateId: number; templateLabel: string; items: CandidateView[]; }
