import type { CheckItem } from '@/lib/priceChecks';
import { S } from '@/lib/lt';

/** One baseline mono line of the last checks: „rugs. 10 · 47 € | rugs. 11 · 47 € | rugs. 12 · 64 € ↑".
 *  A rise is coral; the value is data, the heading reuses the existing method line. */
export function CheckLine({ items }: { items: CheckItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="v2-checkline" aria-label={S.priceContextMethod}>
      {items.map((c) => (
        <span key={c.date} className={c.up ? 'up' : undefined}>
          {c.date} · <b>{c.value}{c.up ? ' ↑' : ''}</b>
        </span>
      ))}
    </div>
  );
}
