import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfigShell } from '@/components/ConfigShell';
import { SendIssueButton } from '@/components/SendIssueButton';
import { renderDigest, renderNurture, type Deal, type MissedDeal } from '@/lib/email/render';
import {
  DIGEST_DAY,
  DIGEST_TIME,
  FREE_LETTER_CADENCE_DAYS,
  ISSUE_LABEL,
  idList,
  missedFacts,
  PREVIEW_PANE_PX,
  previewHeightPx,
  statsOf,
  type IssueKind,
} from '@/lib/letters';
import { bookedEvents, dealsById, getIssue, type Issue } from '@/lib/letters-queries';
import type { Recipient } from '@/lib/subscribers';
import { formatLocalTs } from '@/lib/format';

export const dynamic = 'force-dynamic';


const hint: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.04em',
  color: 'var(--fg-2)',
  margin: '0 0 12px',
};

function dealLine(d: Deal): string {
  return `${d.origin} → ${d.destination} · ${Math.round(Number(d.price))} € · ${d.headline}`;
}

// Next.js 16: params is a Promise — must be awaited.
export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const issue = await getIssue(id);
  if (!issue) notFound();
  if (issue.kind === 'instant') return <InstantSummary issue={issue} />;
  const kind = issue.kind as IssueKind;
  if (kind !== 'paid_digest' && kind !== 'free_nurture') notFound();

  const plan = kind === 'paid_digest' ? 'paid' : 'free';
  const deals = await dealsById(idList(issue.dealIds));
  let missed: MissedDeal[] = [];
  if (kind === 'free_nurture') {
    const expiredIds = idList(issue.expiredDealIds);
    const [rows, events] = await Promise.all([dealsById(expiredIds), bookedEvents(expiredIds)]);
    missed = missedFacts(rows, events);
  }

  // A stand-in reader: no moments (so the digest shows one block), a
  // placeholder unsubscribe token. Real sends render per subscriber.
  const sample: Recipient = { id: 0, email: 'preview@yip.lt', plan, prefs: null, unsubscribeToken: 'preview' };
  const rendered =
    kind === 'paid_digest' ? renderDigest(deals, sample, id) : renderNurture(deals, missed, sample, id);

  const stats = statsOf(issue.stats);
  const dead = deals.filter((d) => d.status !== 'live').length;

  return (
    <ConfigShell title={`${ISSUE_LABEL[kind]} #${id}`}>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        <Link href="/letters">← Letters</Link>
      </p>
      <p style={hint}>
        {kind === 'paid_digest'
          ? `goes to plan = paid · slot ${DIGEST_DAY} ${DIGEST_TIME}`
          : `goes to plan = free · every ${FREE_LETTER_CADENCE_DAYS} days`}{' '}
        · send by hand — no scheduler · assembled {formatLocalTs(issue.createdAt)}
      </p>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        {issue.sentAt ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sent {formatLocalTs(issue.sentAt)}</span>
            <Link href={`/letters/${id}/stats`} style={{ fontSize: 13 }}>
              stats →
            </Link>
          </>
        ) : (
          <SendIssueButton id={id} audience={`every ${plan} subscriber`} />
        )}
        {stats && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>
            {stats.skipped_no_key
              ? 'not sent — RESEND_API_KEY missing; the draft stays sendable'
              : `${stats.attempted} attempted · ${stats.sent} sent · ${stats.failed} failed · ${stats.skipped_no_token} skipped (no unsubscribe token)` +
                (stats.dropped_expired ? ` · ${stats.dropped_expired} dropped (expired)` : '')}
          </span>
        )}
      </div>
      {stats?.errors?.length ? (
        <ul style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--coral-600)', margin: '0 0 16px' }}>
          {stats.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
      {!issue.sentAt && dead > 0 && (
        <p style={{ fontSize: 13, color: 'var(--coral-600)', margin: '0 0 16px' }}>
          {dead} of these deals expired since assembly — Send drops them; assemble a fresh letter if
          you want replacements.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <p style={hint}>{kind === 'paid_digest' ? 'deals' : 'fresh'} · {deals.length}</p>
          <ol style={{ fontSize: 13, paddingLeft: 20, margin: '0 0 20px' }}>
            {deals.map((d) => (
              <li key={d.id} style={{ marginBottom: 6, color: d.status === 'live' ? 'inherit' : 'var(--fg-3)' }}>
                {dealLine(d)}
                {d.status !== 'live' && ' (expired)'}
              </li>
            ))}
          </ol>
          {kind === 'free_nurture' && (
            <>
              <p style={hint}>missed · {missed.length}</p>
              <ol style={{ fontSize: 13, paddingLeft: 20, margin: 0 }}>
                {missed.map((d) => (
                  <li key={d.id} style={{ marginBottom: 6 }}>
                    {dealLine(d)} · {d.lastedHours} h · {d.bookedCount} booked
                  </li>
                ))}
              </ol>
            </>
          )}
          <p style={{ ...hint, marginTop: 20 }}>subject</p>
          <p style={{ fontSize: 13, margin: 0 }}>{rendered.subject}</p>
        </div>
        {deals.length === 0 && missed.length === 0 ? (
          <div
            style={{
              height: PREVIEW_PANE_PX,
              border: '1px solid var(--line)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
              color: 'var(--fg-3)',
              fontSize: 13,
            }}
          >
            Nothing to preview — no eligible deals in this letter.
          </div>
        ) : (
          /* A scrollable pane around a tall iframe. The sandboxed (opaque-origin)
             srcdoc is an out-of-process frame in Chrome: wheel events over it
             stayed inside a 720px iframe whose own scrolling automation could
             not drive, so the footer was unreachable (review 2026-09-11,
             blocker 2). Sizing the iframe to the letter and scrolling the
             wrapper keeps the scroll in the desk's own document. `sandbox=""`
             stays: no allow-same-origin, no scripts. */
          <div
            style={{
              height: PREVIEW_PANE_PX,
              overflowY: 'auto',
              border: '1px solid var(--line)',
              background: '#FFFDF7',
            }}
          >
            <iframe
              title="Letter preview"
              srcDoc={rendered.html}
              sandbox=""
              style={{
                display: 'block',
                width: '100%',
                height: previewHeightPx(deals.length, missed.length),
                border: 0,
                background: '#FFFDF7',
              }}
            />
          </div>
        )}
      </div>
    </ConfigShell>
  );
}

/** An instant-stream issue: written by the publish action, already sent (or
 *  skipped for no key) — nothing to preview, nothing to send. Deal + stats. */
async function InstantSummary({ issue }: { issue: Issue }) {
  const deals = await dealsById(idList(issue.dealIds));
  const stats = statsOf(issue.stats);
  return (
    <ConfigShell title={`Instant #${issue.id}`}>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}>
        <Link href="/letters">← Letters</Link>
      </p>
      <p style={hint}>
        went to plan = paid the minute the deal was published · created {formatLocalTs(issue.createdAt)} ·{' '}
        {issue.sentAt ? `sent ${formatLocalTs(issue.sentAt)}` : 'not sent'}
        {issue.sentAt && (
          <>
            {' '}
            · <Link href={`/letters/${issue.id}/stats`}>stats →</Link>
          </>
        )}
      </p>
      <p style={hint}>deal · {deals.length}</p>
      <ol style={{ fontSize: 13, paddingLeft: 20, margin: '0 0 16px' }}>
        {deals.map((d) => (
          <li key={d.id} style={{ marginBottom: 6, color: d.status === 'live' ? 'inherit' : 'var(--fg-3)' }}>
            #{d.id} · {dealLine(d)}
            {d.status !== 'live' && ' (expired)'}
          </li>
        ))}
      </ol>
      {stats && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', margin: 0 }}>
          {stats.skipped_no_key
            ? 'not sent — RESEND_API_KEY missing at publish time'
            : `${stats.attempted} attempted · ${stats.sent} sent · ${stats.failed} failed · ${stats.skipped_no_token} skipped (no unsubscribe token) · ${stats.skipped_origin ?? 0} skipped (origin)`}
        </p>
      )}
    </ConfigShell>
  );
}
