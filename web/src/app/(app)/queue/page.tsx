import { getQueueRows, getLatestScanRun } from '@/lib/queries';
import { groupByTemplate, toScanView } from '@/lib/mappers';
import { QueueBoard } from '@/components/QueueBoard';

export default async function QueuePage() {
  const [rows, run] = await Promise.all([getQueueRows(), getLatestScanRun()]);
  return <QueueBoard groups={groupByTemplate(rows)} scan={toScanView(run as Parameters<typeof toScanView>[0])} />;
}
