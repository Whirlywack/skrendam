import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfigShell } from '@/components/ConfigShell';
import { ISSUE_LABEL, idList, statsOf, type IssueKind } from '@/lib/letters';
import { getIssue } from '@/lib/letters-queries';
import { ANON, NONE, breakdown, type Dim } from '@/lib/stats';
import { dealFacts, eventsForIssue, subFacts } from '@/lib/stats-queries';

export const dynamic = 'force-dynamic';

/** `2026-09-10 07:02` from an ISO or space-separated timestamp; '—' for null. */
const when = (ts: string | null) => (ts ? ts.replace('T', ' ').slice(0, 16) : '—');

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

/** The four tables, in reading order, each with the one-line caveat the
 *  curator needs to read its rows honestly. */
const DIMS: Array<{ dim: Dim; title: string; note: string }> = [
  {
    dim: 'archetype',
    title: 'By archetype',
    note: `date / rare / destination from the deal's template match · ${NONE} = no match row`,
  },
  {
    dim: 'pref',
    title: 'By pref code',
    note: `persona codes of the deal's newsletter tag · an event counts once per code, so rows do not sum to the total · ${NONE} = tag without codes`,
  },
  { dim: 'origin', title: 'By origin', note: 'departure airport of the deal' },
  {
    dim: 'plan',
    title: 'By plan',
    note: `subscriber plan today, not at click time · ${ANON} = no subscriber on the event (forwarded mail, link without s=)`,
  },
];

function sendLine(v: unknown, sentAt: string | null): string {
  const s = statsOf(v);
  if (!s) return sentAt ? 'sent' : 'draft — not sent';
  if (s.skipped_no_key) return 'not sent — RESEND_API_KEY missing';
  const parts = [`${s.attempted} attempted`, `${s.sent} sent`, `${s.failed} failed`];
  if (s.skipped_no_token) parts.push(`${s.skipped_no_token} no token`);
  if (s.skipped_origin) parts.push(`${s.skipped_origin} skipped (origin)`);
  if (s.dropped_expired) parts.push(`${s.dropped_expired} dropped (expired)`);
  return parts.join(' · ');
}

// Next.js 16: params is a Promise — must be awaited.
export default async function LetterStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const issue = await getIssue(id);
  if (!issue) notFound();
  const label = ISSUE_LABEL[issue.kind as IssueKind] ?? (issue.kind === 'instant' ? 'Instant' : issue.kind);

  const [events, subs] = await Promise.all([eventsForIssue(id), subFacts()]);
  // Facts for every deal the issue carried plus any the events name — the
  // second set is normally a subset of the first, but a stats page must not
  // lose an event because the issue's deal list was edited after the send.
  const dealIds = [
    ...new Set([
      ...idList(issue.dealIds),
      ...idList(issue.expiredDealIds),
      ...events.map((e) => e.dealId),
    ]),
  ];
  const deals = await dealFacts(dealIds);
  const subsById = new Map(subs.map((s) => [s.id, s]));

  // Totals come from the raw events, never from summing a dim (pref rows
  // count an event once per code).
  const clicks = events.filter((e) => e.kind === 'click').length;
  const claims = events.filter((e) => e.kind === 'booked_claim').length;
  const identified = events.filter((e) => e.subscriberId != null).length;

  return (
    <ConfigShell title={`Stats — ${label} #${id}`}>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        <Link href="/letters">← Letters</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href={`/letters/${id}`}>Letter #{id}</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/letters/stats">Overview</Link>
      </p>
      <p style={hint}>
        {label} · assembled {when(issue.createdAt)} ·{' '}
        {issue.sentAt ? `sent ${when(issue.sentAt)}` : 'not sent'} · {sendLine(issue.stats, issue.sentAt)}
      </p>
      {issue.stats != null && (
        <p style={{ ...hint, color: 'var(--fg-3)', wordBreak: 'break-all' }}>
          stats · {JSON.stringify(issue.stats)}
        </p>
      )}
      <p style={{ fontSize: 13, margin: '0 0 20px' }}>
        <strong>{clicks}</strong> {clicks === 1 ? 'click' : 'clicks'} ·{' '}
        <strong>{claims}</strong> {claims === 1 ? 'claim' : 'claims'} {'(„Užsisakiau")'} ·{' '}
        {identified} of {events.length} events carry a subscriber · {dealIds.length}{' '}
        {dealIds.length === 1 ? 'deal' : 'deals'}
        {!issue.sentAt && (
          <span style={{ color: 'var(--fg-3)' }}>
            {' '}
            — a draft has no tracked links out yet; numbers appear after Send.
          </span>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '8px 32px',
          alignItems: 'start',
        }}
      >
        {DIMS.map(({ dim, title, note }) => {
          const rows = breakdown(events, deals, subsById, dim);
          return (
            <div key={dim} style={{ marginBottom: 20 }}>
              <p style={{ ...hint, marginBottom: 2 }}>{title}</p>
              <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 6px' }}>{note}</p>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={th}>{dim}</th>
                    <th style={thNum}>Clicks</th>
                    <th style={thNum}>Claims</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td style={{ ...td, color: 'var(--fg-3)' }} colSpan={3}>
                        —
                      </td>
                    </tr>
                  ) : (
                    <>
                      {rows.map((r) => (
                        <tr key={r.key}>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.key}</td>
                          <td style={num}>{r.clicks}</td>
                          <td style={num}>{r.claims}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...td, fontWeight: 600 }}>total</td>
                        <td style={{ ...num, fontWeight: 700 }}>{clicks}</td>
                        <td style={{ ...num, fontWeight: 700 }}>{claims}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </ConfigShell>
  );
}
