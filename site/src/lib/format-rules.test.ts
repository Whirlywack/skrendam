import { describe, expect, test } from 'vitest';
import { EURO_AMOUNT, priceFreeBlurb } from './format-rules';

describe('EURO_AMOUNT / priceFreeBlurb', () => {
  test('catches both „140 €" and „€140" (with or without a space)', () => {
    for (const s of ['140 €', '140\u00a0€', '140€', '€140', '€ 140', '€140 return to Cyprus']) {
      expect(EURO_AMOUNT.test(s), s).toBe(true);
    }
    expect(EURO_AMOUNT.test('Larnaka rugsėjį — jūra dar šilta')).toBe(false);
  });

  test('a changed deal whose curator headline quotes the found price renders the verdict, not the headline', () => {
    const verdict = 'Gera kaina šiam maršrutui — pigiau nei įprastai.';
    expect(priceFreeBlurb('€140 return to Cyprus — sea is still 27°C.', verdict)).toBe(verdict);
    expect(priceFreeBlurb('€93 į Lisaboną', verdict)).toBe(verdict);
    expect(priceFreeBlurb('140 € į Larnaką', verdict)).toBe(verdict);
    expect(priceFreeBlurb('Larnaka rugsėjį — jūra dar šilta', verdict)).toBe('Larnaka rugsėjį — jūra dar šilta');
  });
});
