import Link from 'next/link';
import { ConfigShell } from '@/components/ConfigShell';
import { FREE_LETTER_CADENCE_DAYS, statsOf } from '@/lib/letters';
import { conversionAfter, tiktokSignups } from '@/lib/stats';
import { nurtureIssuesOrdered, subFacts } from '@/lib/stats-queries';
import { formatLocalTs } from '@/lib/format';

export const dynamic = 'force-dynamic';


const hint: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.04em',
  color: 'var(--fg-2)',
  margin: '0 0 12px',
};

const th: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  textAlign: 'left',
  padding: '8px 14px 8px 0',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '9px 14px 9px 0',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top',
};

const mono: React.CSSProperties = { ...td, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' };
const num: React.CSSProperties = { ...mono, textAlign: 'right' };
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };

/** `12.5%`, or „—" when there is nothing to divide by. */
function rate(n: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${Math.round((n / denom) * 1000) / 10}%`;
}

export default async function LettersStatsPage() {
  const [nurture, subs] = await Promise.all([nurtureIssuesOrdered(), subFacts()]);
  const paidNow = subs.filter((s) => s.plan === 'paid').length;

  // Oldest first from the query; each issue's window ends at the next one's
  // send (the last one runs to now). Newest first on the page.
  const conversion = nurture
    .map((issue, i) => {
      const nextSentAt = nurture[i + 1]?.sentAt ?? null;
      const conv = conversionAfter({ id: issue.id, sentAt: issue.sentAt }, nextSentAt, subs);
      const sent = statsOf(issue.stats)?.sent ?? 0;
      return { id: issue.id, sentAt: issue.sentAt, nextSentAt, sent, ...conv };
    })
    .reverse();

  const tiktok = tiktokSignups(subs);

  return (
    <ConfigShell title="Letter stats — overview">
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        <Link href="/letters">← Letters</Link>
      </p>
      <p style={hint}>
        {subs.length} {subs.length === 1 ? 'subscriber' : 'subscribers'} · {paidNow} paid · read-only, no writes
      </p>

      <p style={{ ...hint, marginTop: 20, marginBottom: 2 }}>Free → paid per nurture letter</p>
      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 8px', maxWidth: 760 }}>
        Each sent free nurture letter and who paid before the next one went out (the latest runs
        to now). <strong>Rate</strong> = paid in window ÷ recipients actually mailed
        (<code>stats.sent</code>). <strong>Free at send</strong> is the pool the letter could have
        converted (free subscribers who existed when it went out) — shown for context, not the
        denominator. Every {FREE_LETTER_CADENCE_DAYS} days a new row; judge the numbers after a
        handful, not one.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Sent</th>
              <th style={th}>Window until</th>
              <th style={thNum}>Recipients</th>
              <th style={thNum}>Free at send</th>
              <th style={thNum}>Paid in window</th>
              <th style={thNum}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {conversion.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--fg-3)' }} colSpan={7}>
                  No free nurture letter has been sent yet.
                </td>
              </tr>
            )}
            {conversion.map((r) => (
              <tr key={r.id}>
                <td style={mono}>
                  <Link href={`/letters/${r.id}/stats`}>#{r.id}</Link>
                </td>
                <td style={mono}>{formatLocalTs(r.sentAt)}</td>
                <td style={{ ...mono, color: r.nextSentAt ? 'inherit' : 'var(--fg-3)' }}>
                  {r.nextSentAt ? formatLocalTs(r.nextSentAt) : 'now'}
                </td>
                <td style={{ ...num, color: r.sent > 0 ? 'inherit' : 'var(--fg-3)' }}>
                  {r.sent > 0 ? r.sent : '—'}
                </td>
                <td style={num}>{r.freeAtSend}</td>
                <td style={num}>{r.paidBetween}</td>
                <td style={{ ...num, fontWeight: 700 }}>{rate(r.paidBetween, r.sent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ ...hint, marginTop: 28, marginBottom: 2 }}>TikTok signups by video</p>
      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 8px', maxWidth: 760 }}>
        Every subscriber row grouped by <code>prefs.utm.content</code> (the video id the signup
        link carried), confirmed or not. <strong>Paid</strong> is how many of them are on the
        paid plan today. <code>unknown</code> = no content id on the signup (organic, typed URL,
        or a link without UTM).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={th}>Content</th>
              <th style={thNum}>Signups</th>
              <th style={thNum}>Paid</th>
              <th style={thNum}>Paid rate</th>
            </tr>
          </thead>
          <tbody>
            {tiktok.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--fg-3)' }} colSpan={4}>
                  No subscribers yet.
                </td>
              </tr>
            )}
            {tiktok.map((r) => (
              <tr key={r.content}>
                <td style={{ ...mono, color: r.content === 'unknown' ? 'var(--fg-3)' : 'inherit' }}>
                  {r.content}
                </td>
                <td style={num}>{r.signups}</td>
                <td style={num}>{r.paid}</td>
                <td style={num}>{rate(r.paid, r.signups)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConfigShell>
  );
}
