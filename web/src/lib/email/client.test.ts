import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import { FROM, emailEnabled, sendMail, type OutgoingMail } from './client';

const mail: OutgoingMail = {
  to: 'a@b.lt',
  subject: '93 € — Londonas',
  html: '<p>hi</p>',
  text: 'hi',
  unsubscribeUrl: 'https://yip.lt/atsisakyti?token=abc',
};

// Braces matter: a hook that *returns* the mock (chainable) would register it as
// a cleanup, and vitest would call send() after each test.
beforeEach(() => { send.mockClear(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('emailEnabled', () => {
  it('is false without RESEND_API_KEY and true with one', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(emailEnabled()).toBe(false);
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(emailEnabled()).toBe(true);
  });
});

describe('FROM', () => {
  it('defaults to the Yip sender', () => {
    expect(FROM).toBe('Yip <hello@yip.lt>');
  });

  // FROM is read once at module load, so the empty-env case needs a fresh import.
  it('treats an empty YIP_FROM_EMAIL (as .env.example ships it) as unset', async () => {
    vi.stubEnv('YIP_FROM_EMAIL', '');
    vi.resetModules();
    const fresh = await import('./client');
    expect(fresh.FROM).toBe('Yip <hello@yip.lt>');
  });

  it('uses YIP_FROM_EMAIL when set', async () => {
    vi.stubEnv('YIP_FROM_EMAIL', 'Yip <labas@yip.lt>');
    vi.resetModules();
    const fresh = await import('./client');
    expect(fresh.FROM).toBe('Yip <labas@yip.lt>');
  });
});

describe('sendMail', () => {
  it('returns ok:false and does not call Resend when email is disabled', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const r = await sendMail(mail);
    expect(r.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends with from/to/subject/html/text and the List-Unsubscribe header', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    send.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const r = await sendMail(mail);
    expect(r).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      {
        from: FROM,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: { 'List-Unsubscribe': `<${mail.unsubscribeUrl}>` },
      },
      { idempotencyKey: undefined },
    );
  });

  it('forwards idempotencyKey as the Resend request option so a retry is a no-op', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    send.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    await sendMail({ ...mail, idempotencyKey: 'issue-7-sub-5' });
    expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: 'issue-7-sub-5' });
  });

  it('returns ok:false with the message when Resend reports an error', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad to' } });
    const r = await sendMail(mail);
    expect(r).toEqual({ ok: false, error: 'bad to' });
  });

  it('never throws — a thrown transport error becomes ok:false', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    send.mockImplementation(async () => { throw new Error('ECONNRESET'); });
    const r = await sendMail(mail);
    expect(r).toEqual({ ok: false, error: 'ECONNRESET' });
  });
});
