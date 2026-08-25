import { getQueueRows, getLatestScanRun, getRouteOrigins, getRouteSignals } from '@/lib/queries';
import { groupByTemplate, toScanView } from '@/lib/mappers';
import { attachRouteContext } from '@/lib/routeContext';
import { QueueBoard } from '@/components/QueueBoard';
import { city } from '@/lib/airports';

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const { origin } = await searchParams;
  // includeExpired: the "History" scope shows engine history; default scopes hide it.
  const [rows, run, originCodes, signals] = await Promise.all([
    getQueueRows(true),
    getLatestScanRun(),
    getRouteOrigins(),
    getRouteSignals(),
  ]);

  // Each departure city is its own server-rendered sub-page (?origin=VNO) so
  // one city's finds never clutter another's (founder request 2026-08-22).
  const active = origin && originCodes.includes(origin) ? origin : null;

  const counts = new Map<string, number>();
  for (const code of originCodes) {
    counts.set(
      code,
      new Set(
        rows
          .filter((r) => r.c.origin === code && r.c.status === 'new')
          .map((r) => r.c.id),
      ).size,
    );
  }

  const visible = active ? rows.filter((r) => r.c.origin === active) : rows;

  return (
    <QueueBoard
      groups={attachRouteContext(groupByTemplate(visible), signals)}
      scan={toScanView(run)}
      origins={originCodes.map((code) => ({
        code,
        label: city(code),
        count: counts.get(code) ?? 0,
      }))}
      activeOrigin={active}
    />
  );
}
