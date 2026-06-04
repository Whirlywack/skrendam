/**
 * EarlyAlertsBand — amber ".early" band nudging users to get early alerts.
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 238)
 */
import Link from 'next/link';

export function EarlyAlertsBand() {
  return (
    <div className="early">
      <div>
        <h3>Some fares are gone by the weekly email.</h3>
        <p>
          Early alerts get you the rare ones first — the moment Yip finds them,
          before they sell out.
        </p>
      </div>
      <Link href="/early-alerts" className="btn-out">
        Get early alerts →
      </Link>
    </div>
  );
}
