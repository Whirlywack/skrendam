import { expect, test } from 'vitest';
import { dealWhyAndCatch } from './dealDetail';
import { GREAT_THRESHOLD, RARE_THRESHOLD } from './quality';

const base = {
  price: 140,
  baseline: 301,
  drop: 53,
  stops: 1,
  airline: 'airBaltic',
  score: 96,
  goingFast: false,
  dates: '12–19 Sep',
};

test('direct flight — "Direct" in why, no stops catch', () => {
  const r = dealWhyAndCatch({ ...base, stops: 0 });
  expect(r.why.some((s) => s.toLowerCase().includes('direct'))).toBe(true);
  expect(r.catch.some((s) => s.toLowerCase().includes('stop'))).toBe(false);
});

test('1-stop — catch contains stop count, not in why', () => {
  const r = dealWhyAndCatch({ ...base, stops: 1 });
  expect(r.catch.some((s) => /1 stop/i.test(s))).toBe(true);
  expect(r.why.some((s) => /direct/i.test(s))).toBe(false);
});

test('rare score → "Rare price" phrase in why (no number)', () => {
  const r = dealWhyAndCatch({ ...base, score: RARE_THRESHOLD });
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/rare/i);
  // Score must NOT appear as a raw number
  expect(whyText).not.toMatch(String(RARE_THRESHOLD));
});

test('great score → "Great price" phrase in why (no number)', () => {
  const r = dealWhyAndCatch({ ...base, score: GREAT_THRESHOLD });
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/great/i);
  expect(whyText).not.toMatch(String(GREAT_THRESHOLD));
});

test('score below great → no quality phrase', () => {
  const r = dealWhyAndCatch({ ...base, score: GREAT_THRESHOLD - 1 });
  const whyText = r.why.join(' ');
  expect(whyText).not.toMatch(/rare|great price/i);
});

test('goingFast = true → "Going fast" in catch', () => {
  const r = dealWhyAndCatch({ ...base, goingFast: true });
  expect(r.catch.some((s) => /going fast/i.test(s))).toBe(true);
});

test('goingFast = false → no "Going fast" in catch', () => {
  const r = dealWhyAndCatch({ ...base, goingFast: false });
  expect(r.catch.some((s) => /going fast/i.test(s))).toBe(false);
});

test('missing baseline → price why falls back to pct-only', () => {
  const r = dealWhyAndCatch({ ...base, baseline: null });
  // Should still mention the drop percent, not crash
  const whyText = r.why.join(' ');
  expect(whyText).toMatch(/53%/);
  expect(whyText).not.toMatch(/€undefined|NaN/);
});

test('zero drop + no baseline → no price line in why', () => {
  const r = dealWhyAndCatch({ ...base, drop: 0, baseline: null });
  expect(r.why.some((s) => s.includes('below typical'))).toBe(false);
});

test('airline "—" placeholder → airline omitted from why', () => {
  const r = dealWhyAndCatch({ ...base, airline: '—' });
  expect(r.why.some((s) => s === '—')).toBe(false);
});

test('basicEconomy = true → bag-rules catch', () => {
  const r = dealWhyAndCatch({ ...base, basicEconomy: true });
  expect(r.catch.some((s) => /bag/i.test(s))).toBe(true);
});
