import { Resend } from 'resend';

/** True only when a Resend key is configured. Gates all sending so the
 *  signup flow can fall back to single opt-in in dev / before email is set up. */
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const FROM = process.env.YIP_FROM_EMAIL ?? 'Yip <hello@yip.lt>';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

/** Send the double-opt-in confirmation email. No-op when email is disabled. */
export async function sendConfirmEmail(email: string, token: string): Promise<void> {
  if (!emailEnabled()) return;
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const url = `${siteUrl()}/confirm?token=${encodeURIComponent(token)}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Patvirtink el. paštą — Yip',
    text: `Liko vienas žingsnis — patvirtink, ir žmogaus patikrinti pigūs skrydžiai keliaus tiesiai tau:\n\n${url}\n\nJei neprenumeravai — tiesiog ignoruok šį laišką.`,
    html: `<!DOCTYPE html>
<html lang="lt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFFDF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
    <p style="margin:0 0 32px;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#1C1813;">yıp</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#1C1813;">
      Liko vienas žingsnis — paspausk, ir gausi žmogaus patikrintus pigius skrydžius iš Vilniaus, Kauno ir Rygos.
    </p>
    <a href="${url}"
       style="display:inline-block;background:#E2820E;color:#FFFDF7;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;letter-spacing:0.01em;">
      Patvirtinti el. paštą
    </a>
    <p style="margin:32px 0 0;font-size:13px;color:#6B6560;line-height:1.5;">
      Jei Yip neprenumeravai — tiesiog ignoruok šį laišką.
    </p>
  </div>
</body>
</html>`,
  });
}
