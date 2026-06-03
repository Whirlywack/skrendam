import type { DisplayStatus } from '@/lib/types';

export function StatusPill({ status }: { status: DisplayStatus }) {
  // .stat.expired reuses .rejected styling; no separate curator.css rule needed
  const cls = status === 'expired' ? 'stat rejected' : `stat ${status}`;
  return (
    <div className={cls}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}
