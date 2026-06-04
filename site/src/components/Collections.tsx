/**
 * Collections — "Where do you want to go?" duotone tile grid.
 *
 * Maps COLLECTIONS to .ctile cards using the Photo component with
 * treatment="duotone".  Each tile links to its collection page.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 212–223)
 */
import Link from 'next/link';
import { COLLECTIONS } from '@/lib/collections';
import { Photo } from './Photo';

export function Collections({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <div className="pad" style={{ background: 'var(--sunken)' }}>
      {showHeading && (
        <>
          <div className="eyebrow">Browse by</div>
          <div className="sec-h">Where do you want to go?</div>
        </>
      )}

      <div className="coll">
        {COLLECTIONS.map((c) => (
          <Link key={c.slug} href={`/${c.slug}`} aria-label={c.label}>
            <Photo scene={c.scene} treatment="duotone" className="ctile">
              <div className="ov" />
              <div className="ov2" />
              <span className="nm">{c.label}</span>
            </Photo>
          </Link>
        ))}
      </div>
    </div>
  );
}
