import { S } from '@/lib/lt';

/** Sticky V2 masthead — the amber pill is the page's persistent capture CTA. */
export function Masthead() {
  return (
    <header className="v2-masthead">
      <div className="wrap bar">
        <a href="/" className="disp logo" aria-label="Yip">yıp</a>
        <span className="kicker kicker--dim mid">{S.mastheadKicker}</span>
        <a href="#kapote" className="pill">
          <span className="bead bead--live" aria-hidden="true" />
          {S.ctaHeaderPill}
        </a>
      </div>
    </header>
  );
}
