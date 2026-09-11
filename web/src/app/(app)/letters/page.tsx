import Link from 'next/link';
import { ConfigShell } from '@/components/ConfigShell';
import { assembleIssue } from '@/app/letters-actions';
import {
  DIGEST_DAY,
  DIGEST_TIME,
  FREE_LETTER_CADENCE_DAYS,
  FREE_LETTER_FRESH,
  FREE_LETTER_MISSED,
  ISSUE_LABEL,
  idList,
  statsOf,
  type IssueKind,
} from '@/lib/letters';
import { countInstantIssues, listLetters } from '@/lib/letters-queries';
import { formatLocalTs } from '@/lib/format';

export const dynamic = 'force-dynamic';


const EMPTY_MESSAGE: Record<IssueKind, string> = {
  paid_digest: 'Nothing to assemble: no live deals published since the last digest went out.',
  free_nurture: 'Nothing to assemble: no live deals to lead the letter with.',
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

function statsLine(v: unknown, sentAt: string | null): string {
  const s = statsOf(v);
  if (!s) return sentAt ? 'sent' : 'draft';
  if (s.skipped_no_key) return 'not sent — RESEND_API_KEY missing';
  const parts = [`${s.sent} sent`];
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.skipped_no_token) parts.push(`${s.skipped_no_token} no token`);
  if (s.dropped_expired) parts.push(`${s.dropped_expired} dropped (expired)`);
  return parts.join(' · ');
}

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const { empty } = await searchParams;
  const [rows, instantCount] = await Promise.all([listLetters(), countInstantIssues()]);
  const emptyMessage =
    empty === 'paid_digest' || empty === 'free_nurture' ? EMPTY_MESSAGE[empty] : null;

  return (
    <ConfigShell title="Letters">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 4, maxWidth: 720 }}>
        The two letters you send by hand — there is no scheduler. Assemble picks the deals, saves
        a draft and opens its preview; Send goes out from the preview, to the plan the letter is for.
      </p>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '.04em',
          color: 'var(--fg-2)',
          margin: '0 0 16px',
        }}
      >
        paid digest · {DIGEST_DAY} {DIGEST_TIME} · every live deal since the last digest
        &nbsp;&nbsp;|&nbsp;&nbsp; free nurture · every {FREE_LETTER_CADENCE_DAYS} days · {FREE_LETTER_FRESH}{' '}
        fresh + {FREE_LETTER_MISSED} missed
        &nbsp;&nbsp;|&nbsp;&nbsp; <Link href="/letters/stats">Stats overview →</Link>
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <form action={assembleIssue.bind(null, 'paid_digest')}>
          <button type="submit" className="btn btn-outline" style={{ cursor: 'pointer' }}>
            Assemble paid digest
          </button>
        </form>
        <form action={assembleIssue.bind(null, 'free_nurture')}>
          <button type="submit" className="btn btn-outline" style={{ cursor: 'pointer' }}>
            Assemble free nurture
          </button>
        </form>
      </div>

      {emptyMessage && (
        <p style={{ fontSize: 13, color: 'var(--coral-600)', margin: '0 0 16px' }}>{emptyMessage}</p>
      )}

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', margin: '0 0 8px' }}>
        {instantCount} instant {instantCount === 1 ? 'send' : 'sends'} · one per published deal, to plan = paid
        — not listed here
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Letter</th>
              <th style={th}>Deals</th>
              <th style={th}>Missed</th>
              <th style={th}>Assembled</th>
              <th style={th}>Sent</th>
              <th style={th}>Result</th>
              <th style={th}>Stats</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--fg-3)' }} colSpan={8}>
                  No letters yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const label = ISSUE_LABEL[r.kind as IssueKind] ?? r.kind;
              return (
                <tr key={r.id}>
                  <td style={mono}>
                    <Link href={`/letters/${r.id}`}>#{r.id}</Link>
                  </td>
                  <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <Link href={`/letters/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {label}
                    </Link>
                  </td>
                  <td style={mono}>{idList(r.dealIds).length}</td>
                  <td style={mono}>{idList(r.expiredDealIds).length}</td>
                  <td style={mono}>{formatLocalTs(r.createdAt)}</td>
                  <td style={mono}>{formatLocalTs(r.sentAt)}</td>
                  <td style={{ ...td, color: r.sentAt ? 'var(--fg-1)' : 'var(--fg-3)' }}>
                    {statsLine(r.stats, r.sentAt)}
                  </td>
                  <td style={{ ...mono, color: 'var(--fg-3)' }}>
                    {r.sentAt ? <Link href={`/letters/${r.id}/stats`}>stats →</Link> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ConfigShell>
  );
}
