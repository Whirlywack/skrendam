// match_score on the 0–100 scale. Mirrors web/src/lib/tiers.ts (GREAT_THRESHOLD=88, engine analyze 0.88).
export const GREAT_THRESHOLD = 88;
export const RARE_THRESHOLD = 94; // top band — "rare deal"
export type QualityTag = 'rare' | 'great';
export function qualityTag(score: number): QualityTag | null {
  if (score >= RARE_THRESHOLD) return 'rare';
  if (score >= GREAT_THRESHOLD) return 'great';
  return null;
}
