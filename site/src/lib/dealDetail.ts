/**
 * dealDetail.ts — pure helpers for the deal-detail enrichment layer.
 * No DB calls; all inputs are already-fetched row fields.
 */
import { GREAT_THRESHOLD, RARE_THRESHOLD } from './quality';

export interface WhyAndCatch {
  why: string[];
  catch: string[];
}

interface DealDetailInputs {
  /** Current deal price in € */
  price: number;
  /** Baseline / typical price in € (null if unknown) */
  baseline: number | null;
  /** Discount percentage 0–100 (null/0 if unknown) */
  drop: number;
  /** Number of stops */
  stops: number;
  /** Airline name or code */
  airline: string;
  /** match_score 0–100 (null if not available) */
  score: number | null;
  /** Whether the deal is marked "going fast" */
  goingFast: boolean;
  /** Human-readable dates string e.g. "12–19 Sep" */
  dates: string;
  /** Whether it's a basic-economy / restricted fare (optional) */
  basicEconomy?: boolean;
}

/**
 * Build the "Why it's good" and "The catch" bullet arrays from deal fields.
 * Pure function — no side-effects, no DB.
 */
export function dealWhyAndCatch(inputs: DealDetailInputs): WhyAndCatch {
  const why: string[] = [];
  const catchLines: string[] = [];

  // Why: price vs baseline
  if (inputs.drop > 0 && inputs.baseline) {
    why.push(`€${Math.round(inputs.price)} return — ${inputs.drop}% below typical (€${Math.round(inputs.baseline)})`);
  } else if (inputs.drop > 0) {
    why.push(`${inputs.drop}% below typical for this route`);
  }

  // Why: direct / non-stop
  if (inputs.stops === 0) {
    why.push('Direct — no layovers');
  }

  // Why: airline (only if non-empty and not a placeholder)
  if (inputs.airline && inputs.airline !== '—') {
    why.push(`Flies with ${inputs.airline}`);
  }

  // Why: quality phrase (words only — score stays internal)
  if (inputs.score !== null) {
    if (inputs.score >= RARE_THRESHOLD) {
      why.push('Rare price — we rarely see it this low');
    } else if (inputs.score >= GREAT_THRESHOLD) {
      why.push('Great price for this route');
    }
  }

  // Catch: stops
  if (inputs.stops >= 1) {
    catchLines.push(`${inputs.stops} stop${inputs.stops > 1 ? 's' : ''}`);
  }

  // Catch: basic economy
  if (inputs.basicEconomy) {
    catchLines.push('Basic economy — check bag rules before booking');
  }

  // Catch: fixed dates (always mention dates as context)
  if (inputs.dates) {
    catchLines.push(`Fixed dates: ${inputs.dates}`);
  }

  // Catch: going fast
  if (inputs.goingFast) {
    catchLines.push('Going fast — availability may drop soon');
  }

  return { why, catch: catchLines };
}
