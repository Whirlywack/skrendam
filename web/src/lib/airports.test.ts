import { describe, expect, it } from 'vitest';
import { originLabels } from './airports';

describe('originLabels', () => {
  it('carries the code when two origins share a city name', () => {
    const labels = originLabels(['VNO', 'STN', 'LTN']);
    expect(labels.get('VNO')).toBe('Vilnius');
    expect(labels.get('STN')).toBe('London STN');
    expect(labels.get('LTN')).toBe('London LTN');
  });

  it('leaves unique cities bare', () => {
    expect([...originLabels(['VNO', 'KUN'])]).toEqual([
      ['VNO', 'Vilnius'],
      ['KUN', 'Kaunas'],
    ]);
  });

  it('falls back to the code for unknown airports without doubling it', () => {
    expect(originLabels(['ZZZ', 'ZZZ']).get('ZZZ')).toBe('ZZZ');
  });
});
