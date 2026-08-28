/**
 * dealDetail.ts — pure helpers for the deal-detail enrichment layer.
 * No DB calls; all inputs are already-fetched row fields.
 * All generated copy is Lithuanian (V2 spec §3 voice, §4 mechanics).
 */
import { GREAT_THRESHOLD, RARE_THRESHOLD } from './quality';
import { eur, ltPlural } from './format';
import { ltCity } from './cities-lt';

export interface WhyAndCatch {
  why: string[];
  catch: string[];
}

/** „Tiesioginis" | „1 persėdimas" | „2 persėdimai" | „10 persėdimų" — never string-concat plurals. */
export function stopsChip(stops: number): string {
  if (stops === 0) return 'Tiesioginis';
  return `${stops} ${ltPlural(stops, 'persėdimas', 'persėdimai', 'persėdimų')}`;
}

/**
 * Public headline: the curator's copy, unless it is an un-edited machine string
 * ("VNO->LCA just EUR140 …" from pre-0011 scans) — then a brand-voice LT fallback
 * with the destination declined into accusative after „į" („140 € į Larnaką").
 */
export function ltDealHeadline(
  headline: string | null | undefined,
  price: number,
  destination: string,
): string {
  if (headline && !/^[A-Z]{3}->[A-Z]{3}/.test(headline)) return headline;
  return `${eur(price)} į ${ltCity(destination).acc}`;
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
  /** Human-readable dates string e.g. "rugs. 12–19" */
  dates: string;
  /** Whether it's a basic-economy / restricted fare (optional) */
  basicEconomy?: boolean;
}

/**
 * Build the „Kodėl verta" and „Kabliukas" bullet arrays from deal fields.
 * Pure function — no side-effects, no DB.
 */
export function dealWhyAndCatch(inputs: DealDetailInputs): WhyAndCatch {
  const why: string[] = [];
  const catchLines: string[] = [];

  // Why: price vs baseline
  if (inputs.drop > 0 && inputs.baseline) {
    why.push(`${eur(inputs.price)} — ${inputs.drop} % pigiau nei įprastai (${eur(inputs.baseline)})`);
  } else if (inputs.drop > 0) {
    why.push(`${inputs.drop} % pigiau nei įprastai šiame maršrute`);
  }

  // Why: direct / non-stop
  if (inputs.stops === 0) {
    why.push('Tiesioginis — be persėdimų');
  }

  // Why: quality phrase (words only — score stays internal)
  if (inputs.score !== null) {
    if (inputs.score >= RARE_THRESHOLD) {
      why.push('Reta kaina — taip pigiai matom retai');
    } else if (inputs.score >= GREAT_THRESHOLD) {
      why.push('Gera kaina šiam maršrutui');
    }
  }

  // Catch: stops
  if (inputs.stops >= 1) {
    catchLines.push(stopsChip(inputs.stops));
  }

  // Catch: basic economy
  if (inputs.basicEconomy) {
    catchLines.push('Pigiausias tarifas — pasitikrink bagažo taisykles prieš pirkdamas');
  }

  // Catch: fixed dates (always mention dates as context)
  if (inputs.dates) {
    catchLines.push(`Tikslios datos: ${inputs.dates}`);
  }

  // Catch: going fast
  if (inputs.goingFast) {
    catchLines.push('Tirpsta — pigiausios vietos gali greit dingti');
  }

  return { why, catch: catchLines };
}
