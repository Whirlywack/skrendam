import { describe, expect, it } from 'vitest';
import { LIVE_STATUSES } from './statuses';
import {
  attentionCount,
  dealState,
  isLiveStatus,
  needsRecheck,
  priceDriftPct,
  RECHECK_AFTER_DAYS,
  STATE_LABEL,
  verificationSummary,
  verificationSummaryLine,
} from './verification';

const NOW = new Date('2026-09-11T08:00:00Z');

function row(over: { status?: string; verifiedAt?: string | null; lastSeenAt?: string | null; publishedAt?: string; expiredAt?: string | null } = {}) {
  return {
    status: 'live',
    verifiedAt: null,
    lastSeenAt: null,
    publishedAt: '2026-09-10 07:00:00',
    expiredAt: null,
    ...over,
  };
}

describe('LIVE_STATUSES (byte-identical to site/src/lib/statuses.ts)', () => {
  it('is exactly live + changed', () => {
    expect([...LIVE_STATUSES]).toEqual(['live', 'changed']);
  });

  it('isLiveStatus follows it and nothing else', () => {
    expect(isLiveStatus('live')).toBe(true);
    expect(isLiveStatus('changed')).toBe(true);
    expect(isLiveStatus('expired')).toBe(false);
    expect(isLiveStatus('draft')).toBe(false);
  });
});

describe('dealState / STATE_LABEL', () => {
  it('names the three verification states and folds the rest into other', () => {
    expect(dealState('live')).toBe('live');
    expect(dealState('changed')).toBe('changed');
    expect(dealState('expired')).toBe('expired');
    expect(dealState('draft')).toBe('other');
    expect(STATE_LABEL.changed).toBe('changed');
    expect(STATE_LABEL.other).toBe('');
  });
});

describe('priceDriftPct', () => {
  it('rounds the drift against the published price, signed', () => {
    expect(priceDriftPct(93, 124)).toBe(33);
    expect(priceDriftPct(100, 95)).toBe(-5);
    expect(priceDriftPct(100, 100)).toBe(0);
  });

  it('is null without a current price or with a zero published price', () => {
    expect(priceDriftPct(93, null)).toBeNull();
    expect(priceDriftPct(0, 50)).toBeNull();
  });
});

describe('needsRecheck', () => {
  it('flags a live deal whose verified_at is older than RECHECK_AFTER_DAYS (= the scan\'s EXACT_CHECK_MAX_AGE_DAYS)', () => {
    expect(RECHECK_AFTER_DAYS).toBe(3);
    expect(needsRecheck(row({ verifiedAt: '2026-09-08 07:00:00' }), NOW)).toBe(true);
    // Two days old is the scan's business (it rechecks at three), not Today's.
    expect(needsRecheck(row({ verifiedAt: '2026-09-09 07:00:00' }), NOW)).toBe(false);
    expect(needsRecheck(row({ verifiedAt: '2026-09-10 07:00:00' }), NOW)).toBe(false);
  });

  it('falls back to last_seen_at, then published_at, when never verified', () => {
    expect(needsRecheck(row({ lastSeenAt: '2026-09-10 20:00:00', publishedAt: '2026-09-01 07:00:00' }), NOW)).toBe(false);
    expect(needsRecheck(row({ publishedAt: '2026-09-01 07:00:00' }), NOW)).toBe(true);
    expect(needsRecheck(row({ publishedAt: '2026-09-10 07:00:00' }), NOW)).toBe(false);
  });

  it('applies to changed deals too, never to expired ones', () => {
    expect(needsRecheck(row({ status: 'changed', verifiedAt: '2026-09-01 07:00:00' }), NOW)).toBe(true);
    expect(needsRecheck(row({ status: 'expired', verifiedAt: '2026-09-01 07:00:00' }), NOW)).toBe(false);
  });
});

describe('verificationSummary (Today, „since yesterday")', () => {
  const deals = [
    row({ status: 'live' }),
    row({ status: 'changed' }),
    row({ status: 'changed' }),
    row({ status: 'expired', expiredAt: '2026-09-11 06:30:00' }), // 1.5 h ago
    row({ status: 'expired', expiredAt: '2026-09-10 09:00:00' }), // 23 h ago
    row({ status: 'expired', expiredAt: '2026-09-10 07:59:00' }), // 24 h + 1 min ago
    row({ status: 'expired', expiredAt: null }), // curator-expired before 0014, no timestamp
  ];

  it('counts every changed deal and only expiries inside the last 24 h', () => {
    expect(verificationSummary(deals, NOW)).toEqual({ changed: 2, expired: 2 });
  });

  it('ignores an expiry timestamp in the future', () => {
    expect(verificationSummary([row({ status: 'expired', expiredAt: '2026-09-12 07:00:00' })], NOW)).toEqual({ changed: 0, expired: 0 });
  });

  it('renders one honest line', () => {
    expect(verificationSummaryLine({ changed: 2, expired: 1 })).toBe('2 changed · 1 expired since yesterday');
    expect(verificationSummaryLine({ changed: 0, expired: 0 })).toBe('0 changed · 0 expired since yesterday');
  });
});

describe('attentionCount (sidebar badge)', () => {
  it('is changed deals plus live deals due a recheck, each deal once', () => {
    const deals = [
      row({ status: 'changed', verifiedAt: '2026-09-01 07:00:00' }), // both → 1
      row({ status: 'changed', verifiedAt: '2026-09-11 07:00:00' }), // changed → 1
      row({ status: 'live', verifiedAt: '2026-09-01 07:00:00' }), // stale → 1
      row({ status: 'live', verifiedAt: '2026-09-11 07:00:00' }), // fresh → 0
      row({ status: 'expired', expiredAt: '2026-09-11 07:00:00' }), // expired → 0
    ];
    expect(attentionCount(deals, NOW)).toBe(3);
  });
});
