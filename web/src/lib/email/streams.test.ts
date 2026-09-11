import { beforeEach, describe, expect, it, vi } from 'vitest';

// `streams.ts` imports the real db for `defaultDeps`; the pure `sendInstant`
// must run without a Neon connection, so the db module is replaced before
// import, exactly as `render.test.ts` and `subscribers.test.ts` do.
vi.mock('@/db', () => ({ db: {}, issues: {}, subscribers: {} }));

import { unsubscribeUrl } from '../links';
import type { Recipient } from '../subscribers';
import type { OutgoingMail } from './client';
import type { Deal } from './render';
import type { DealEvent, IssueStats } from '../letters';
import {
  recordSkippedNoKey,
  sendInstant,
  sendLetter,
  zeroStats,
  type LetterDeps,
  type SendDeps,
  type SendStats,
} from './streams';

function deal(over: Partial<Deal> = {}): Deal {
  return {
    id: 42,
    candidateId: 1,
    dealTemplateId: 1,
    contentDraftId: null,
    currentPrice: null,
    currentPriceAt: null,
    windowMinPrice: null,
    windowMinDate: null,
    verifiedAt: null,
    missedChecks: 0,
    publicLabel: null,
    newsletterTag: 'xmas',
    headline: 'Kalėdos Londone už 93 €',
    body: 'Kalėdų atostogos — €93, įprastai apie €275',
    tiktokHook: null,
    origin: 'VNO',
    destination: 'STN',
    zone: null,
    tripType: 'roundtrip',
    travelDate: '2026-12-22',
    returnDate: '2026-12-28',
    price: 93,
    baselinePrice: 275,
    discountPct: 66,
    bookingUrl: null,
    validUntil: null,
    lastSeenAt: null,
    tier: 'great',
    status: 'live',
    publishedAt: '2026-09-10 07:00:00',
    goingFast: false,
    unverifiedSince: null,
    postedTiktokAt: null,
    postedInstagramAt: null,
    expiredAt: null,
    ...over,
  };
}

function recipient(over: Partial<Recipient> = {}): Recipient {
  return { id: 5, email: 'a@b.lt', plan: 'paid', prefs: null, unsubscribeToken: 'tok-123', ...over };
}

const NOW = new Date('2026-09-10T07:00:00Z');

const recipients = vi.fn<SendDeps['recipients']>();
const send = vi.fn<SendDeps['send']>();
const insertIssue = vi.fn<SendDeps['insertIssue']>();
const finishIssue = vi.fn<SendDeps['finishIssue']>();
const pace = vi.fn<SendDeps['pace']>();

function deps(): SendDeps {
  return { recipients, send, insertIssue, finishIssue, now: () => NOW, pace };
}

// Braces matter: a hook that *returns* the mock (chainable) would register it
// as a cleanup, and vitest would call it after each test.
beforeEach(() => {
  recipients.mockReset();
  send.mockReset();
  insertIssue.mockReset();
  finishIssue.mockReset();
  recipients.mockResolvedValue([]);
  send.mockResolvedValue({ ok: true });
  insertIssue.mockResolvedValue(7);
  finishIssue.mockResolvedValue(undefined);
  pace.mockReset();
  pace.mockResolvedValue(undefined);
});

describe('zeroStats', () => {
  it('has every counter at 0 and no skipped_no_key flag', () => {
    const z: SendStats = zeroStats();
    expect(z).toEqual({ attempted: 0, sent: 0, failed: 0, skipped_no_token: 0, skipped_origin: 0 });
  });
});

describe('sendInstant', () => {
  it('draws recipients from the paid list exactly once, never the free one', async () => {
    recipients.mockResolvedValue([recipient()]);
    await sendInstant(deal(), deps());
    expect(recipients).toHaveBeenCalledTimes(1);
    expect(recipients).toHaveBeenCalledWith('paid');
    expect(recipients).not.toHaveBeenCalledWith('free');
  });

  it('records an instant issue for the deal before sending and returns its id', async () => {
    recipients.mockResolvedValue([recipient()]);
    const { issueId } = await sendInstant(deal({ id: 99 }), deps());
    expect(insertIssue).toHaveBeenCalledTimes(1);
    expect(insertIssue).toHaveBeenCalledWith('instant', [99], []);
    expect(issueId).toBe(7);
    expect(insertIssue.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });

  it('sends one rendered mail per recipient with their own unsubscribe link', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'a@b.lt', unsubscribeToken: 'tok-a' }),
      recipient({ id: 2, email: 'c@d.lt', unsubscribeToken: 'tok-c' }),
    ]);
    const { stats } = await sendInstant(deal(), deps());
    expect(send).toHaveBeenCalledTimes(2);
    const mails = send.mock.calls.map(([m]) => m as OutgoingMail);
    expect(mails.map((m) => m.to)).toEqual(['a@b.lt', 'c@d.lt']);
    expect(mails[0].unsubscribeUrl).toBe(unsubscribeUrl('tok-a'));
    expect(mails[1].unsubscribeUrl).toBe(unsubscribeUrl('tok-c'));
    for (const m of mails) {
      expect(m.subject).toBeTruthy();
      expect(m.html).toContain('Kalėdos Londone');
      expect(m.text).toContain('Kalėdos Londone');
      expect(m.html).toContain(m.unsubscribeUrl);
    }
    expect(stats).toEqual({ attempted: 2, sent: 2, failed: 0, skipped_no_token: 0, skipped_origin: 0 });
  });

  it('skips a recipient whose origins do not include the deal origin', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'kaunas@b.lt', prefs: { origins: ['KUN'] } }),
      recipient({ id: 2, email: 'vilnius@b.lt', prefs: { origins: ['VNO'] } }),
      recipient({ id: 3, email: 'any@b.lt', prefs: null }),
    ]);
    const { stats } = await sendInstant(deal({ origin: 'VNO' }), deps());
    expect(send.mock.calls.map(([m]) => (m as OutgoingMail).to)).toEqual(['vilnius@b.lt', 'any@b.lt']);
    expect(stats).toEqual({ attempted: 2, sent: 2, failed: 0, skipped_no_token: 0, skipped_origin: 1 });
  });

  it('never mails a recipient without an unsubscribe token', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'notoken@b.lt', unsubscribeToken: null }),
      recipient({ id: 2, email: 'empty@b.lt', unsubscribeToken: '' }),
      recipient({ id: 3, email: 'ok@b.lt', unsubscribeToken: 'tok' }),
    ]);
    const { stats } = await sendInstant(deal(), deps());
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as OutgoingMail).to).toBe('ok@b.lt');
    expect(stats).toEqual({ attempted: 1, sent: 1, failed: 0, skipped_no_token: 2, skipped_origin: 0 });
  });

  it('counts a failed send and carries on with the next recipient', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'fail@b.lt' }),
      recipient({ id: 2, email: 'ok@b.lt' }),
    ]);
    send
      .mockResolvedValueOnce({ ok: false, error: 'boom' })
      .mockResolvedValueOnce({ ok: true });
    const { stats } = await sendInstant(deal(), deps());
    expect(send).toHaveBeenCalledTimes(2);
    expect(stats).toEqual({ attempted: 2, sent: 1, failed: 1, skipped_no_token: 0, skipped_origin: 0 });
    err.mockRestore();
  });

  it('treats a throwing send as a failure rather than aborting the stream', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'throw@b.lt' }),
      recipient({ id: 2, email: 'ok@b.lt' }),
    ]);
    send.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true });
    await expect(sendInstant(deal(), deps())).resolves.toMatchObject({
      stats: { attempted: 2, sent: 1, failed: 1 },
    });
    err.mockRestore();
  });

  it('finishes the issue with the final stats', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1, email: 'kaunas@b.lt', prefs: { origins: ['KUN'] } }),
      recipient({ id: 2, email: 'notoken@b.lt', unsubscribeToken: null }),
      recipient({ id: 3, email: 'ok@b.lt' }),
    ]);
    const { issueId, stats } = await sendInstant(deal(), deps());
    expect(finishIssue).toHaveBeenCalledTimes(1);
    expect(finishIssue).toHaveBeenCalledWith(
      7,
      { attempted: 1, sent: 1, failed: 0, skipped_no_token: 1, skipped_origin: 1 },
      NOW.toISOString(),
    );
    expect(finishIssue).toHaveBeenCalledWith(issueId, stats, NOW.toISOString());
    expect(finishIssue.mock.invocationCallOrder[0]).toBeGreaterThan(send.mock.invocationCallOrder[0]);
  });

  it('still records and finishes the issue when there is nobody to mail', async () => {
    recipients.mockResolvedValue([]);
    const { issueId, stats } = await sendInstant(deal(), deps());
    expect(issueId).toBe(7);
    expect(send).not.toHaveBeenCalled();
    expect(finishIssue).toHaveBeenCalledWith(7, zeroStats(), NOW.toISOString());
    expect(stats).toEqual(zeroStats());
  });

  it('stamps sent_at with a non-null ISO string after a real send', async () => {
    recipients.mockResolvedValue([recipient()]);
    await sendInstant(deal(), deps());
    const sentAt = finishIssue.mock.calls[0][2];
    expect(sentAt).toBe('2026-09-10T07:00:00.000Z');
    expect(new Date(sentAt!).toISOString()).toBe(sentAt);
  });

  it('gives every mail an idempotency key of issue + subscriber so a retry cannot double-send', async () => {
    recipients.mockResolvedValue([recipient({ id: 5 }), recipient({ id: 6, email: 'c@d.lt' })]);
    await sendInstant(deal(), deps());
    const keys = send.mock.calls.map(([m]) => (m as OutgoingMail).idempotencyKey);
    expect(keys).toEqual(['issue-7-sub-5', 'issue-7-sub-6']);
  });

  it('paces between sends (Resend 10 req/s): once per gap, never before the first or after the last', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1 }),
      recipient({ id: 2, email: 'notoken@b.lt', unsubscribeToken: null }),
      recipient({ id: 3, email: 'c@d.lt' }),
      recipient({ id: 4, email: 'e@f.lt' }),
    ]);
    await sendInstant(deal(), deps());
    expect(send).toHaveBeenCalledTimes(3);
    expect(pace).toHaveBeenCalledTimes(2);
    expect(pace.mock.invocationCallOrder[0]).toBeGreaterThan(send.mock.invocationCallOrder[0]);
    expect(pace.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[1]);
  });

  it('does not pace a single send', async () => {
    recipients.mockResolvedValue([recipient()]);
    await sendInstant(deal(), deps());
    expect(pace).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sendLetter — the curator-sent digest / nurture behind `sendIssue`.

const claimIssue = vi.fn<LetterDeps['claimIssue']>();
const dealsById = vi.fn<LetterDeps['dealsById']>();
const bookedEvents = vi.fn<LetterDeps['bookedEvents']>();
const writeStats = vi.fn<LetterDeps['writeStats']>();

function letterDeps(): LetterDeps {
  return { claimIssue, dealsById, bookedEvents, recipients, send, writeStats, now: () => NOW, pace };
}

beforeEach(() => {
  claimIssue.mockReset();
  dealsById.mockReset();
  bookedEvents.mockReset();
  writeStats.mockReset();
  claimIssue.mockResolvedValue(true);
  dealsById.mockImplementation(async (ids) => ids.map((id) => deal({ id })));
  bookedEvents.mockResolvedValue([]);
  writeStats.mockResolvedValue(undefined);
});

const digest = { id: 7, kind: 'paid_digest' as const, dealIds: [1, 2], expiredDealIds: [] as number[] };
const nurture = { id: 8, kind: 'free_nurture' as const, dealIds: [1, 2], expiredDealIds: [10] };

describe('sendLetter', () => {
  it('claims the issue atomically before the first send and writes the stats after the last', async () => {
    recipients.mockResolvedValue([recipient()]);
    const out = await sendLetter(digest, letterDeps());
    expect(claimIssue).toHaveBeenCalledTimes(1);
    expect(claimIssue).toHaveBeenCalledWith(7, NOW.toISOString());
    expect(claimIssue.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
    expect(writeStats.mock.invocationCallOrder[0]).toBeGreaterThan(send.mock.invocationCallOrder[0]);
    const stats: IssueStats = { attempted: 1, sent: 1, failed: 0, skipped_no_token: 0, dropped_expired: 0 };
    expect(writeStats).toHaveBeenCalledWith(7, stats);
    expect(out).toEqual({ ok: true, stats });
  });

  it('refuses with already_sent when the claim wins no row — no sends, no stats overwrite', async () => {
    claimIssue.mockResolvedValue(false);
    recipients.mockResolvedValue([recipient()]);
    const out = await sendLetter(digest, letterDeps());
    expect(out).toEqual({ ok: false, reason: 'already_sent' });
    expect(send).not.toHaveBeenCalled();
    expect(writeStats).not.toHaveBeenCalled();
  });

  it('refuses with no_fresh before claiming when none of its deals are live any more', async () => {
    dealsById.mockImplementation(async (ids) => ids.map((id) => deal({ id, status: 'expired' })));
    const out = await sendLetter(digest, letterDeps());
    expect(out).toEqual({ ok: false, reason: 'no_fresh' });
    expect(claimIssue).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(writeStats).not.toHaveBeenCalled();
  });

  it('drops deals that expired since assembly and counts them as dropped_expired', async () => {
    dealsById.mockImplementation(async (ids) =>
      ids.map((id) => deal({ id, status: id === 2 ? 'expired' : 'live' })),
    );
    recipients.mockResolvedValue([recipient()]);
    const out = await sendLetter(digest, letterDeps());
    expect(out).toMatchObject({ ok: true, stats: { sent: 1, dropped_expired: 1 } });
    expect((send.mock.calls[0][0] as OutgoingMail).html).not.toContain('/go/2?');
  });

  it('mails the paid list for a digest and the free list for a nurture', async () => {
    recipients.mockResolvedValue([]);
    await sendLetter(digest, letterDeps());
    expect(recipients).toHaveBeenLastCalledWith('paid');
    await sendLetter(nurture, letterDeps());
    expect(recipients).toHaveBeenLastCalledWith('free');
  });

  it('keys every mail by issue + subscriber and skips rows without an unsubscribe token', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 5 }),
      recipient({ id: 6, email: 'notoken@b.lt', unsubscribeToken: null }),
    ]);
    const out = await sendLetter(digest, letterDeps());
    expect(send.mock.calls.map(([m]) => (m as OutgoingMail).idempotencyKey)).toEqual(['issue-7-sub-5']);
    expect(out).toMatchObject({ ok: true, stats: { attempted: 1, sent: 1, skipped_no_token: 1 } });
  });

  it('counts a failed send, keeps its error for the curator and carries on', async () => {
    recipients.mockResolvedValue([recipient({ id: 1, email: 'fail@b.lt' }), recipient({ id: 2, email: 'ok@b.lt' })]);
    send.mockResolvedValueOnce({ ok: false, error: 'boom' }).mockRejectedValueOnce(new Error('network'));
    const out = await sendLetter(digest, letterDeps());
    expect(out).toMatchObject({
      ok: true,
      stats: { attempted: 2, sent: 0, failed: 2, errors: ['fail@b.lt: boom', 'ok@b.lt: network'] },
    });
  });

  it('paces between sends, skipped rows excluded', async () => {
    recipients.mockResolvedValue([
      recipient({ id: 1 }),
      recipient({ id: 2, email: 'notoken@b.lt', unsubscribeToken: null }),
      recipient({ id: 3, email: 'c@d.lt' }),
    ]);
    await sendLetter(digest, letterDeps());
    expect(send).toHaveBeenCalledTimes(2);
    expect(pace).toHaveBeenCalledTimes(1);
    expect(pace.mock.invocationCallOrder[0]).toBeGreaterThan(send.mock.invocationCallOrder[0]);
    expect(pace.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[1]);
  });

  it('nurture: renders the missed block from the stored expired ids with real booked counts', async () => {
    dealsById.mockImplementation(async (ids) =>
      ids.map((id) =>
        id === 10
          ? deal({ id, status: 'expired', publishedAt: '2026-09-01 10:00:00', expiredAt: '2026-09-02 22:00:00' })
          : deal({ id }),
      ),
    );
    const events: DealEvent[] = [{ dealId: 10, kind: 'booked_claim' }, { dealId: 10, kind: 'booked_claim' }];
    bookedEvents.mockResolvedValue(events);
    recipients.mockResolvedValue([recipient({ plan: 'free' })]);
    await sendLetter(nurture, letterDeps());
    expect(bookedEvents).toHaveBeenCalledWith([10]);
    const m = send.mock.calls[0][0] as OutgoingMail;
    expect(m.html).toContain('išbuvo 36 val.');
    expect(m.html).toContain('2 prenumeratorių užsisakė');
  });
});

describe('recordSkippedNoKey (publishDeal without RESEND_API_KEY)', () => {
  it('records the issue with skipped_no_key and leaves sent_at NULL', async () => {
    const { issueId, stats } = await recordSkippedNoKey('instant', [42], deps());
    expect(issueId).toBe(7);
    expect(stats).toEqual({ ...zeroStats(), skipped_no_key: true });
    expect(insertIssue).toHaveBeenCalledWith('instant', [42], []);
    expect(finishIssue).toHaveBeenCalledTimes(1);
    expect(finishIssue).toHaveBeenCalledWith(7, { ...zeroStats(), skipped_no_key: true }, null);
    expect(finishIssue.mock.calls[0][2]).toBeNull();
  });

  it('never touches recipients or the sender', async () => {
    await recordSkippedNoKey('instant', [42], deps());
    expect(recipients).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
