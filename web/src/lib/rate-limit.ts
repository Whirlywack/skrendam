// ---------------------------------------------------------------------------
// Fixed-window in-memory rate limiter (single-instance deployment).
// Duplicated from site/src/lib/rate-limit.ts until a shared workspace package
// exists — keep the two in sync.
// ---------------------------------------------------------------------------

type Window = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;

export class FixedWindowLimiter {
  private buckets = new Map<string, Window>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Record one hit for `key`; false when the key is over budget this window. */
  allow(key: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.gc(now);
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.max;
  }

  private gc(now: number) {
    if (this.buckets.size < MAX_TRACKED_KEYS) return;
    for (const [k, w] of this.buckets) {
      if (now >= w.resetAt) this.buckets.delete(k);
    }
    if (this.buckets.size >= MAX_TRACKED_KEYS) this.buckets.clear();
  }
}

// Sign-in attempts: the Deal Desk has exactly one credentials account, so
// slow guessing down hard. 8 attempts / 15 min per (ip, username).
export const loginLimiter = new FixedWindowLimiter(8, 15 * 60_000);
