import Link from 'next/link';
import { getQueueRows, getLatestScanRun, getPublishedDeals } from '@/lib/queries';
import { toCandidateView, toScanView } from '@/lib/mappers';
import { DashboardCards } from '@/components/DashboardCards';

export default async function Dashboard() {
  const [rows, run, published] = await Promise.all([
    getQueueRows(),
    getLatestScanRun(),
    getPublishedDeals(),
  ]);

  const views = rows.map(toCandidateView);
  const scan = toScanView(run);

  // New high-score candidates: status 'suggested' AND score >= 80
  const highScore = views.filter((v) => v.status === 'suggested' && v.score >= 80).length;

  // Needs recheck: verifiedAt is null
  const needsRecheck = views.filter((v) => !v.verifiedAt).length;

  // Live deals
  const liveDeals = published.filter((d) => d.status === 'live');
  const liveCount = liveDeals.length;

  // Expiring soon: live deals with validUntil within 7 days
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiringSoon = liveDeals.filter((d) => {
    if (!d.validUntil) return false;
    const exp = new Date(d.validUntil);
    const diff = exp.getTime() - now.getTime();
    return diff > 0 && diff <= sevenDaysMs;
  }).length;

  return (
    <div className="topbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: '-0.02em',
          margin: '0 0 24px',
          color: 'var(--fg-1)',
        }}
      >
        Today
      </h1>

      <DashboardCards
        highScore={highScore}
        needsRecheck={needsRecheck}
        liveCount={liveCount}
        expiringSoon={expiringSoon}
        scan={scan}
      />

      {/* Shortcuts */}
      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        <Link
          href="/queue"
          className="btn btn-primary"
          style={{ textDecoration: 'none' }}
        >
          Review top deals
        </Link>

        {/* TODO Task 17: wire enqueueScan/enqueueRecheck */}
        <button
          className="btn btn-outline"
          disabled
          title="Available in Task 17"
          style={{ opacity: 0.55, cursor: 'not-allowed', position: 'relative' }}
        >
          Run scan
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--fg-3)',
              marginLeft: 4,
            }}
          >
            soon
          </span>
        </button>

        {/* TODO Task 17: wire enqueueScan/enqueueRecheck */}
        <button
          className="btn btn-outline"
          disabled
          title="Available in Task 17"
          style={{ opacity: 0.55, cursor: 'not-allowed' }}
        >
          Recheck live deals
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--fg-3)',
              marginLeft: 4,
            }}
          >
            soon
          </span>
        </button>
      </div>
    </div>
  );
}
