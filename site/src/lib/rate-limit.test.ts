import { describe, expect, test } from 'vitest';
import { FixedWindowLimiter } from './rate-limit';

describe('FixedWindowLimiter', () => {
  test('allows up to max hits inside one window, then blocks', () => {
    const limiter = new FixedWindowLimiter(3, 60_000);
    const t = 1_000_000;
    expect(limiter.allow('k', t)).toBe(true);
    expect(limiter.allow('k', t + 1)).toBe(true);
    expect(limiter.allow('k', t + 2)).toBe(true);
    expect(limiter.allow('k', t + 3)).toBe(false);
    expect(limiter.allow('k', t + 4)).toBe(false);
  });

  test('window expiry resets the budget', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    const t = 1_000_000;
    expect(limiter.allow('k', t)).toBe(true);
    expect(limiter.allow('k', t + 1)).toBe(false);
    expect(limiter.allow('k', t + 60_000)).toBe(true);
  });

  test('keys are independent', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    const t = 1_000_000;
    expect(limiter.allow('a', t)).toBe(true);
    expect(limiter.allow('b', t)).toBe(true);
    expect(limiter.allow('a', t + 1)).toBe(false);
    expect(limiter.allow('b', t + 1)).toBe(false);
  });
});
