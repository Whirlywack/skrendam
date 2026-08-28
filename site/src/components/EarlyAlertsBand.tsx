/**
 * EarlyAlertsBand — amber ".early" band nudging users to get early alerts.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 238)
 */
import Link from 'next/link';
import { S } from '@/lib/lt';

export function EarlyAlertsBand() {
  return (
    <div className="early">
      <div>
        <h3>{S.earlyBandTitle}</h3>
        <p>{S.earlyBandBody}</p>
      </div>
      <Link href="/early-alerts" className="btn-out">
        {S.earlyBandCta} →
      </Link>
    </div>
  );
}
