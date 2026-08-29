import Link from 'next/link';
import { S } from '@/lib/lt';

/** Mono breadcrumb — the visible twin of the JSON-LD breadcrumb (SEO interlink). */
export function Crumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="wrap v2-crumb" aria-label={S.crumbAria}>
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && ' › '}
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
