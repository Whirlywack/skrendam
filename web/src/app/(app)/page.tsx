import Link from 'next/link';
import { getQueueRows, getLatestFinishedScanRun, getRunningScanRun, getPublishedDeals } from '@/lib/queries';
import { toCandidateView, toScanView } from '@/lib/mappers';
import { timeAgo } from '@/lib/format';
import {
  isLiveStatus,
  needsRecheck,
  RECHECK_AFTER_DAYS,
  verificationSummary,
  verificationSummaryLine,
} from '@/lib/verification';
import { ScanButtons } from '@/components/ScanButtons';
import { ScanHealthBanner } from '@/components/ScanHealthBanner';
import { RecheckButton } from '@/components/RecheckButton';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };

export default async function Dashboard() {
  // `run` is the latest FINISHED scan — counts and health never come from a
  // row that is still (or was left) "running" (review 2026-09-11, blocker 1).
  const [rows, run, running, published] = await Promise.all([
    getQueueRows(),
    getLatestFinishedScanRun(),
    getRunningScanRun(),
    getPublishedDeals(),
  ]);
  const scan = toScanView(run, running);

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
  const runningClause = scan.runningSince ? ` A new scan is running since ${scan.runningSince}.` : '';
  const scanLine =
    (!run
      ? 'No scan has finished yet.'
      : `Scan ran ${scan.ago} — ${healthy ? 'healthy' : run.status}.` +
        (answeredPct != null ? ` Google answered ${answeredPct}% of searches` : '') +
        (priceRows != null ? ` · ${priceRows.toLocaleString('en-GB')} prices logged.` : '.')) +
    runningClause;

  const healthReasons =
    ((run?.health as { reasons?: string[] } | null)?.reasons ?? []).map(String);

  // WP9: the daily scan verifies every visible deal and moves it to `changed`
  // or `expired` itself, so Today only summarises what it did („N changed ·
  // M expired since yesterday") and keeps the manual Recheck for deals whose
  // last REAL answer (`verified_at`, falling back to last_seen_at/published_at)
  // is older than RECHECK_AFTER_DAYS — an empty answer never counts.
  const now = new Date();
  const liveDeals = published.filter((d) => isLiveStatus(d.status));
  const summary = verificationSummary(published, now);
  const stale = liveDeals.filter((d) => needsRecheck(d, now));

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

      {/* Degraded/failed scans surface their reasons here — the banner was
          orphaned by the Phase 2 rebuild (review 2026-08-22). */}
      <ScanHealthBanner status={run?.status ?? 'unknown'} reasons={healthReasons} />

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

      {/* Verification summary — what the scan did to the live set */}
      {published.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--fg-2)', margin: '0 0 14px' }}>
          <span style={{ ...MONO, fontWeight: 700, color: summary.changed + summary.expired > 0 ? 'var(--amber-700)' : 'var(--fg-2)' }}>
            {verificationSummaryLine(summary)}
          </span>
          {' · '}
          <Link href="/published" style={{ color: 'inherit' }}>
            {liveDeals.length} on the site
          </Link>
        </p>
      )}

      {/* Deals the scan has not really answered for in RECHECK_AFTER_DAYS */}
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
              €{Math.round(d.price)} · {d.status} on the site
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
              Published {timeAgo(d.publishedAt)} — no real price answer in {RECHECK_AFTER_DAYS}+ days
              {d.verifiedAt ? ` (last ${timeAgo(d.verifiedAt)})` : ' (never checked by the scan)'}
              {d.missedChecks > 0 && ` · ${d.missedChecks} empty ${d.missedChecks === 1 ? 'answer' : 'answers'} in a row`}
              .
            </div>
          </div>
          <RecheckButton candidateId={d.candidateId} />
        </div>
      ))}
      <p style={{ ...MONO, fontSize: 11, color: 'var(--fg-3)', marginTop: 18 }}>
        Next scan {now.getHours() < 6 ? 'today' : 'tomorrow'} 06:00 · {liveDeals.length} live ·{' '}
        <Link href="/machine/scan-health" style={{ color: 'inherit' }}>
          scan history
        </Link>
      </p>
    </div>
  );
}
