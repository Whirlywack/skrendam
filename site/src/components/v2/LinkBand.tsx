import Link from 'next/link';
import { S } from '@/lib/lt';

/** "Daugiau:" mono link band — every content page links its collections (SEO interlink). */
export function LinkBand({ links }: { links: { label: string; href: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="wrap v2-linkband">
      {S.moreLabel}{' '}
      {links.map((l) => (
        <Link key={l.href} href={l.href}>{l.label}</Link>
      ))}
    </div>
  );
}
