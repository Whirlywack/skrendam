// Strikethrough was-prices only help on deep deals (reference-price research,
// deal-detection synthesis 2026-08-22). Keep in sync with web/src/lib/format.ts
// and skrendam/scanning/content.py.
export const WAS_PRICE_MIN_DROP_PCT = 30;

// A € amount in copy, either order: „140 €" (LT) or „€140" (curator-written
// English headlines). One regex for every "does this line quote a price" gate.
export const EURO_AMOUNT = /\d+\s?€|€\s?\d+/;

/** The poster blurb: the price already dominates the poster, so a headline
 *  that quotes one would say it twice — and on a changed deal it would quote
 *  the FOUND price beside „Dabar nuo …". Those fall back to the verdict line. */
export function priceFreeBlurb(headline: string, hook: string): string {
  return EURO_AMOUNT.test(headline) ? hook : headline;
}
