import { getQueueRows, getLatestScanRun } from '@/lib/queries';
import { groupByTemplate, toScanView } from '@/lib/mappers';
import { QueueBoard } from '@/components/QueueBoard';

export default async function QueuePage() {
  // includeExpired: the "History" scope shows engine history; default scopes hide it.
  const [rows, run] = await Promise.all([getQueueRows(true), getLatestScanRun()]);
  return <QueueBoard groups={groupByTemplate(rows)} scan={toScanView(run)} />;
}
