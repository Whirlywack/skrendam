import { beforeEach, describe, expect, it, vi } from 'vitest';

// `streams.ts` imports the real db for `defaultDeps`; the pure `sendInstant`
// must run without a Neon connection, so the db module is replaced before
// import, exactly as `render.test.ts` and `subscribers.test.ts` do.
vi.mock('@/db', () => ({ db: {}, issues: {}, subscribers: {} }));

import { unsubscribeUrl } from '../links';
import type { Recipient } from '../subscribers';
import type { OutgoingMail } from './client';
import type { Deal } from './render';
import { sendInstant, zeroStats, type SendDeps, type SendStats } from './streams';

function deal(over: Partial<Deal> = {}): Deal {
  return {
    id: 42,
    candidateId: 1,
    dealTemplateId: 1,
    contentDraftId: null,
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

function deps(): SendDeps {
  return { recipients, send, insertIssue, finishIssue, now: () => NOW };
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
    expect(finishIssue).toHaveBeenCalledWith(7, {
      attempted: 1, sent: 1, failed: 0, skipped_no_token: 1, skipped_origin: 1,
    });
    expect(finishIssue).toHaveBeenCalledWith(issueId, stats);
    expect(finishIssue.mock.invocationCallOrder[0]).toBeGreaterThan(send.mock.invocationCallOrder[0]);
  });

  it('still records and finishes the issue when there is nobody to mail', async () => {
    recipients.mockResolvedValue([]);
    const { issueId, stats } = await sendInstant(deal(), deps());
    expect(issueId).toBe(7);
    expect(send).not.toHaveBeenCalled();
    expect(finishIssue).toHaveBeenCalledWith(7, zeroStats());
    expect(stats).toEqual(zeroStats());
  });
});
