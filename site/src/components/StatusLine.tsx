import type { PublicDeal } from '@/lib/types';

export function StatusLine({ status }: { status: PublicDeal['status'] }) {
  return (
    <div className={`st${status.kind === 'going_fast' ? ' st-fast' : ''}`}>
      {status.kind === 'going_fast' ? '▲ ' : ''}{status.label}
    </div>
  );
}
