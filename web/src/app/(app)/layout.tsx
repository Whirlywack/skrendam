import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/Sidebar';
import { PulseBar } from '@/components/PulseBar';
import {
  getQueueRows,
  getLatestFinishedScanRun,
  getRunningScanRun,
  getPublishedDeals,
  getPendingScanRequests,
} from '@/lib/queries';
import { toCandidateView, toScanView } from '@/lib/mappers';
import { parseEngineTs } from '@/lib/format';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second auth layer behind proxy.ts: data-bearing pages must not depend on a
  // single middleware matcher staying correct.
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [rows, finished, running, published, pending] = await Promise.all([
    getQueueRows(),
    getLatestFinishedScanRun(),
    getRunningScanRun(),
    getPublishedDeals(),
    getPendingScanRequests(),
  ]);
  const scan = toScanView(finished, running);

  // Sidebar badges: distinct fresh candidates + live deals needing attention.
  const toReview = new Set(
    rows.map(toCandidateView).filter((v) => v.status === 'suggested').map((v) => v.candidateId),
  ).size;
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const attention = published.filter(
    (d) =>
      d.status === 'live' &&
      (d.unverifiedSince ||
        now.getTime() - parseEngineTs(d.lastSeenAt ?? d.publishedAt).getTime() > sevenDaysMs),
  ).length;

  return (
    <div className="app">
      <Sidebar toReview={toReview} attention={attention} />
      <main className="main" style={{ display: 'flex', flexDirection: 'column' }}>
        <PulseBar
          scanAgo={finished ? scan.ago : 'never'}
          scanHealthy={scan.status === 'completed'}
          runningSince={scan.runningSince}
          queued={pending.length}
        />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </main>
    </div>
  );
}
