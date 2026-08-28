import { describe, expect, it } from 'vitest';
import { FREE_WINDOW, splitFreeLocked } from './scarcity';

describe('splitFreeLocked', () => {
  it('locks nothing at or under the free window', () => {
    expect(splitFreeLocked([1, 2, 3])).toEqual({ free: [1, 2, 3], locked: [] });
    expect(splitFreeLocked([])).toEqual({ free: [], locked: [] });
  });

  it('locks everything past the free window, preserving order', () => {
    const { free, locked } = splitFreeLocked([1, 2, 3, 4, 5]);
    expect(free).toEqual([1, 2, 3]);
    expect(locked).toEqual([4, 5]);
    expect(free.length).toBe(FREE_WINDOW);
  });
});
