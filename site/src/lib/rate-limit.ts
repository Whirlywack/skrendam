// ---------------------------------------------------------------------------
// Fixed-window in-memory rate limiter.
//
// Good enough on purpose: the site runs as a single always-on instance, so a
// process-local Map covers the real abuse case (bot loops hammering the public
// subscribe form -> Resend cost burn + domain-reputation damage). If the site
// ever scales past one replica, swap the backing store for something shared.
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
    // Pathological case: MAX_TRACKED_KEYS live keys inside one window. Drop the
    // map rather than let an attacker with unlimited IPs grow it unboundedly.
    if (this.buckets.size >= MAX_TRACKED_KEYS) this.buckets.clear();
  }
}

// Shared instances for the public subscribe actions.
export const subscribeIpLimiter = new FixedWindowLimiter(8, 10 * 60_000); // 8 / 10 min / IP
export const subscribeEmailLimiter = new FixedWindowLimiter(3, 60 * 60_000); // 3 / hour / email
