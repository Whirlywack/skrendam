import { Resend } from 'resend';

/** True only when a Resend key is configured. Gates all sending, exactly as
 *  `site/src/lib/email.ts` does: every desk send path returns early (and still
 *  records its `issues` row with `stats.skipped_no_key`) when this is false, so
 *  the e2e journey keeps publishing without a key. */
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// `||`, not `??`: `.env.example` ships the key empty; empty means unset here.
export const FROM: string = process.env.YIP_FROM_EMAIL || 'Yip <hello@yip.lt>';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  /** Plain-text twin — every mail carries one; renderers build both. */
  text: string;
  /** This recipient's `unsubscribeUrl(token)`. Also goes out as the
   *  `List-Unsubscribe` header so mail clients can offer one-click leave. */
  unsubscribeUrl: string;
  /** Resend `Idempotency-Key` — `issue-<id>-sub-<subscriberId>` from the
   *  streams, so a retried loop (reload, second tab, crash + resend) is a
   *  no-op at Resend for 24 h instead of a duplicate in the inbox. */
  idempotencyKey?: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Send one mail through Resend. Never throws: a missing key, a Resend-side
 *  error or a transport failure all come back as `{ ok: false, error }` so a
 *  stream loop can count the failure and carry on with the next recipient. */
export async function sendMail(m: OutgoingMail): Promise<SendResult> {
  if (!emailEnabled()) return { ok: false, error: 'RESEND_API_KEY not set' };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error } = await resend.emails.send(
      {
        from: FROM,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>` },
      },
      { idempotencyKey: m.idempotencyKey },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
