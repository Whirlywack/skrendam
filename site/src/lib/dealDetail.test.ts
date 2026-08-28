import { expect, test } from 'vitest';
import { dealWhyAndCatch, ltDealHeadline, stopsChip } from './dealDetail';
import { GREAT_THRESHOLD, RARE_THRESHOLD } from './quality';
import { eur } from './format';

const base = {
  price: 140,
  baseline: 301,
  drop: 53,
  stops: 1,
  airline: 'airBaltic',
  score: 96,
  goingFast: false,
  dates: 'rugs. 12–19',
};

test('direct flight — „Tiesioginis" in why, no stops catch', () => {
  const r = dealWhyAndCatch({ ...base, stops: 0 });
  expect(r.why.some((s) => s.toLowerCase().includes('tiesiogin'))).toBe(true);
  expect(r.catch.some((s) => s.toLowerCase().includes('persėdim'))).toBe(false);
});

test('1-stop — catch contains LT stop count, not in why', () => {
  const r = dealWhyAndCatch({ ...base, stops: 1 });
  expect(r.catch.some((s) => /1 persėdimas/.test(s))).toBe(true);
  expect(r.why.some((s) => /tiesiogin/i.test(s))).toBe(false);
});

test('rare score → „Reta kaina" phrase in why (no number)', () => {
  const r = dealWhyAndCatch({ ...base, score: RARE_THRESHOLD });
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/reta kaina/i);
  // Score must NOT appear as a raw number
  expect(whyText).not.toMatch(String(RARE_THRESHOLD));
});

test('great score → „Gera kaina" phrase in why (no number)', () => {
  const r = dealWhyAndCatch({ ...base, score: GREAT_THRESHOLD });
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/gera kaina/i);
  expect(whyText).not.toMatch(String(GREAT_THRESHOLD));
});

test('score below great → no quality phrase', () => {
  const r = dealWhyAndCatch({ ...base, score: GREAT_THRESHOLD - 1 });
  const whyText = r.why.join(' ');
  expect(whyText).not.toMatch(/reta kaina|gera kaina/i);
});

test('goingFast = true → „Tirpsta" in catch', () => {
  const r = dealWhyAndCatch({ ...base, goingFast: true });
  expect(r.catch.some((s) => /tirpsta/i.test(s))).toBe(true);
});

test('goingFast = false → no „Tirpsta" in catch', () => {
  const r = dealWhyAndCatch({ ...base, goingFast: false });
  expect(r.catch.some((s) => /tirpsta/i.test(s))).toBe(false);
});

test('missing baseline → price why falls back to pct-only', () => {
  const r = dealWhyAndCatch({ ...base, baseline: null });
  // Should still mention the drop percent, not crash
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/53 %/);
  expect(whyText).not.toMatch(/€undefined|NaN/);
});

test('zero drop + no baseline → no price line in why', () => {
  const r = dealWhyAndCatch({ ...base, drop: 0, baseline: null });
  expect(r.why.some((s) => s.includes('pigiau nei įprastai'))).toBe(false);
});

test('airline "—" placeholder → airline omitted from why', () => {
  const r = dealWhyAndCatch({ ...base, airline: '—' });
  expect(r.why.some((s) => s === '—')).toBe(false);
});

test('basicEconomy = true → bag-rules catch', () => {
  const r = dealWhyAndCatch({ ...base, basicEconomy: true });
  expect(r.catch.some((s) => /bagaž/i.test(s))).toBe(true);
});

test('fixed dates catch uses the LT deck form', () => {
  const r = dealWhyAndCatch(base);
  expect(r.catch.some((s) => s === 'Tikslios datos: rugs. 12–19')).toBe(true);
});

test('price why formats prices via eur() (symbol after, NBSP)', () => {
  const r = dealWhyAndCatch(base);
  expect(r.why[0]).toBe(`${eur(140)} — 53 % pigiau nei įprastai (${eur(301)})`);
});

// ── stopsChip — CLDR lt plural forms, never string-concat ────────────────────

test('stopsChip declines persėdimas correctly', () => {
  expect(stopsChip(0)).toBe('Tiesioginis');
  expect(stopsChip(1)).toBe('1 persėdimas');
  expect(stopsChip(2)).toBe('2 persėdimai');
  expect(stopsChip(10)).toBe('10 persėdimų');
});

// ── ltDealHeadline — accusative after „į" ────────────────────────────────────

test('ltDealHeadline passes through curator copy', () => {
  expect(ltDealHeadline('Kipras už ačiū', 140, 'LCA')).toBe('Kipras už ačiū');
});

test('ltDealHeadline falls back to „140 € į Larnaką" for machine strings', () => {
  expect(ltDealHeadline('VNO->LCA just EUR140', 140, 'LCA')).toBe(`${eur(140)} į Larnaką`);
  expect(ltDealHeadline(null, 140, 'LCA')).toBe(`${eur(140)} į Larnaką`);
});
