import Link from 'next/link';
import { getQueueRows, getLatestScanRun, getPublishedDeals } from '@/lib/queries';
import { toCandidateView } from '@/lib/mappers';
import { parseEngineTs, timeAgo } from '@/lib/format';
import { ScanButtons } from '@/components/ScanButtons';
import { RecheckButton } from '@/components/RecheckButton';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };

export default async function Dashboard() {
  const [rows, run, published] = await Promise.all([
    getQueueRows(),
    getLatestScanRun(),
    getPublishedDeals(),
  ]);

  const views = rows.map(toCandidateView);

  // Count distinct CANDIDATES, not candidate×template match rows — one fare matching
  // three templates is still one deal to review (B1 in the redesign plan).
  const toReview = new Set(
    views.filter((v) => v.status === 'suggested').map((v) => v.candidateId),
  ).size;
  const highScore = new Set(
    views
      .filter((v) => v.status === 'suggested' && v.tier === 'great')
      .map((v) => v.candidateId),
  ).size;

  // Scan verdict, in plain language.
  const metrics = (run?.health as { metrics?: Record<string, number> } | null)?.metrics;
  const calCalls = metrics?.calendar_calls ?? 0;
  const answeredPct =
    calCalls > 0 ? Math.round(((calCalls - (metrics?.calendar_empty ?? 0)) / calCalls) * 100) : null;
  const priceRows = metrics?.price_rows;
  const healthy = run?.status === 'completed';
  const scanLine = !run
    ? 'No scan has run yet.'
    : `Scan ran ${timeAgo(String(run.startedAt))} — ${healthy ? 'healthy' : run.status}.` +
      (answeredPct != null ? ` Google answered ${answeredPct}% of searches` : '') +
      (priceRows != null ? ` · ${priceRows.toLocaleString('en-GB')} prices logged.` : '.');

  // Live deals whose price nobody has re-checked (B4) — the real emergencies.
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const liveDeals = published.filter((d) => d.status === 'live');
  const stale = liveDeals.filter(
    (d) =>
      d.unverifiedSince ||
      now.getTime() - parseEngineTs(d.publishedAt).getTime() > sevenDaysMs,
  );

  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const asOf = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="topbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32,
          letterSpacing: '-0.02em', margin: '0 0 2px', color: 'var(--fg-1)',
        }}
      >
        Today
      </h1>
      <p style={{ ...MONO, fontSize: 11, color: 'var(--fg-3)', margin: '0 0 20px' }}>
        {today} · as of {asOf}
      </p>

      {/* Verdict */}
      <div
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
          padding: '22px 24px', marginBottom: 14,
        }}
      >
        <p style={{ ...MONO, color: healthy ? 'var(--sea-600)' : 'var(--coral-600)', margin: '0 0 10px' }}>
          {scanLine}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40,
            letterSpacing: '-0.03em', margin: 0,
          }}
        >
          {toReview} fresh {toReview === 1 ? 'deal' : 'deals'}
          <span
            style={{
              fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 17,
              color: 'var(--fg-2)', letterSpacing: 0, marginLeft: 12,
            }}
          >
            {highScore} of them high-score
          </span>
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/queue" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Start reviewing →
          </Link>
          <ScanButtons />
        </div>
      </div>

      {/* Live-deal attention blocks — real emergencies, not fake metrics */}
      {stale.map((d) => (
        <div
          key={d.id}
          style={{
            background: 'var(--coral-50)', border: '1px solid var(--coral-100)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div>
              <span style={{ ...MONO, fontWeight: 700, fontSize: 14 }}>
                {d.origin} → {d.destination}
              </span>{' '}
              €{Math.round(d.price)} · live on the site
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
              Published {timeAgo(d.publishedAt)}
              {d.unverifiedSince
                ? ` — last recheck found no fare (${timeAgo(String(d.unverifiedSince))}).`
                : ' and not re-checked since — the price may no longer exist.'}
            </div>
          </div>
          <RecheckButton candidateId={d.candidateId} />
        </div>
      ))}
      {liveDeals.length > 0 && stale.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--fg-2)', margin: '0 0 14px' }}>
          {liveDeals.length} live {liveDeals.length === 1 ? 'deal' : 'deals'} on the site — all
          prices fresh.
        </p>
      )}

      <p style={{ ...MONO, fontSize: 11, color: 'var(--fg-3)', marginTop: 18 }}>
        Next scan {now.getHours() < 6 ? 'today' : 'tomorrow'} 06:00 · {liveDeals.length} live ·{' '}
        <Link href="/machine/scan-health" style={{ color: 'inherit' }}>
          scan history
        </Link>
      </p>
    </div>
  );
}
