import { describe, expect, it } from 'vitest';
import { canPublish, localToday, publishBlock, PUBLISH_BLOCK_TEXT, republishBlock } from './publishGuard';

const today = '2026-09-11';

describe('publishBlock', () => {
  it('lets a live candidate with a future travel date through', () => {
    expect(publishBlock({ status: 'new', travelDate: '2026-12-04' }, today)).toBeNull();
    expect(canPublish({ status: 'suggested', travelDate: '2026-09-11' }, today)).toBe(true);
  });

  it('blocks an expired candidate — engine status or display status', () => {
    expect(publishBlock({ status: 'expired', travelDate: '2026-12-04' }, today)).toBe('expired');
    expect(canPublish({ status: 'expired', travelDate: '2026-12-04' }, today)).toBe(false);
  });

  it('blocks a travel date in the past, even for a fresh candidate', () => {
    expect(publishBlock({ status: 'new', travelDate: '2026-09-10' }, today)).toBe('travel_past');
    expect(publishBlock({ status: 'new', travelDate: '2026-09-11' }, today)).toBeNull();
  });

  it('reports expiry before the date when both apply', () => {
    expect(publishBlock({ status: 'expired', travelDate: '2026-09-01' }, today)).toBe('expired');
  });

  it('ignores a missing travel date (dateless deals stay curator-managed)', () => {
    expect(publishBlock({ status: 'new', travelDate: null }, today)).toBeNull();
  });

  it('has curator-readable text for every block', () => {
    expect(PUBLISH_BLOCK_TEXT.expired).toBe('Expired — cannot publish');
    expect(PUBLISH_BLOCK_TEXT.travel_past).toMatch(/travel date/i);
  });
});

describe('republishBlock', () => {
  it('blocks only a past travel date — expired is the normal state of a republish candidate', () => {
    expect(republishBlock({ travelDate: '2026-09-09' }, today)).toBe('travel_past');
    expect(republishBlock({ travelDate: '2026-12-23' }, today)).toBeNull();
    expect(republishBlock({ travelDate: null }, today)).toBeNull();
  });
});

describe('localToday', () => {
  it('renders the local calendar date as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
    expect(localToday(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
