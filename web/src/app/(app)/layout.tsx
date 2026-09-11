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
import { attentionCount } from '@/lib/verification';

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
  // Changed deals + live deals due a manual recheck (WP9), same rule as Today.
  const attention = attentionCount(published, new Date());

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
