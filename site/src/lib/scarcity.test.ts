import { describe, expect, it } from 'vitest';
import { FREE_WINDOW, LOCKED_SHOWN, splitFreeLocked, splitLockedRows } from './scarcity';

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

describe('splitLockedRows', () => {
  it('first 4 shown, the rest collapsed into one row', () => {
    const ids = [4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(splitLockedRows(ids)).toEqual({ shown: [4, 5, 6, 7], collapsed: [8, 9, 10, 11, 12] });
    expect(splitLockedRows([4, 5])).toEqual({ shown: [4, 5], collapsed: [] });
  });

  it('exposes the desktop count and honours an explicit width', () => {
    expect(LOCKED_SHOWN).toBe(4);
    expect(splitLockedRows([])).toEqual({ shown: [], collapsed: [] });
    expect(splitLockedRows([1, 2, 3], 0)).toEqual({ shown: [], collapsed: [1, 2, 3] });
  });
});
