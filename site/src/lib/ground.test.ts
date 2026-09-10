import { describe, it, expect } from 'vitest';
import { groundHint } from './ground';

describe('groundHint', () => {
  it('KUN → train hint from Vilnius', () => {
    expect(groundHint('KUN')).toBe('Iš Vilniaus: 59 min traukiniu');
  });
  it('RIX → train hint from Vilnius', () => {
    expect(groundHint('RIX')).toBe('Iš Vilniaus: traukinys nuo €9.60, ~4 val.');
  });
  it('anything else → null', () => {
    expect(groundHint('VNO')).toBeNull();
  });
});
