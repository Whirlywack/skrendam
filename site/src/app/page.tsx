import { getLiveDeals, getInspirationDeals, getEditionNumber } from '@/lib/queries';
import { splitFreeLocked } from '@/lib/scarcity';
import Link from 'next/link';
import { freshSource, toTicket, toPublicDeal } from '@/lib/mappers';
import { freshInfo } from '@/lib/format';
import { S } from '@/lib/lt';
import { Masthead } from '@/components/v2/Masthead';
import { Poster } from '@/components/v2/Poster';
import { CaptureRow } from '@/components/v2/CaptureRow';
import { LiveIndex, TrophyCase, TrophyRow } from '@/components/v2/Rows';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';

export const revalidate = 300; // ISR: refresh every 5 min

export default async function Home() {
  const now = new Date();
  const [rows, edition] = await Promise.all([getLiveDeals(), getEditionNumber()]);
  const { free, locked } = splitFreeLocked(rows.map((r) => toTicket(r, now)));
  const past = (await getInspirationDeals(3)).map((r) => toTicket(r, now));
  const [featured = null, ...rest] = free;
  // Real freshness + the tier-honest LT verdict line of the featured deal.
  const featuredRow = rows[0];
  const fresh = featuredRow ? freshInfo(freshSource(featuredRow)) : null;
  const hook = featuredRow ? toPublicDeal(featuredRow, now).verdict : '';
  // The stamp always leads with the human claim; the stale-price caveat lives
  // once, in the poster catch-line — never as the page's trust badge. A
  // going-fast deal's catch-line leads with that instead of a freshness claim.
  const stampFresh = fresh?.withinCap ? ` · ${fresh.label.toLowerCase()}` : '';
  // verifiedTime is not shown yet: the engine stamps verified_at with the run start time (PR #56 review); re-enable when it stamps per check.
  const catchFreshness = featured?.goingFast
    ? S.chipGoingFast
    : fresh?.label ?? '';

  return (
    <main className="v2">
      <Masthead />

      {/* Hero: issue kicker → poster headline → subhead + human stamp.
          Mobile (PR B): the poster IS the page — with a featured deal the hero
          is cut so the primary button sits inside the Safari fold. */}
      <section className={`wrap v2-hero${featured ? ' v2-hero--has-poster' : ''}`}>
        <div className="v2-kicker">{S.issueLabel} {edition}</div>
        <h1 className="v2-display">
          {S.heroH1.replace(/\.$/, '')}
          <span className="bead" aria-hidden="true" />
        </h1>
        <div className="sub-row">
          <p className="lead">{S.heroSub}</p>
          <span className="v2-stamp">
            <span className="bead" style={{ width: 7, height: 7 }} aria-hidden="true" />
            {S.humanStamp}{stampFresh}
          </span>
        </div>
      </section>

      {featured && <Poster t={featured} count={free.length + locked.length} freshness={catchFreshness} hook={hook} />}

      {/* Zero-live state: the hero's promise needs an honest counterpart
          (review 08-28 — the 0-deal case is a real data state too). */}
      {!featured && (
        <section className="wrap">
          <div className="mono v2-footnote" style={{ padding: '4px 0 0' }}>
            {S.emptyLive} <a href="#kapote">{S.ctaSubmit} →</a>
          </div>
        </section>
      )}
      {/* Empty home on mobile (HomeEmptyMobile board): one expired proof row (the
          trophy case's dead row, tappable) plus the „Buvę radiniai" tap — the trophy
          case itself is desktop-only. Nothing at all when the archive is empty too:
          an archive link that opens „Kol kas nėra ką rodyti" is not proof. */}
      {!featured && past.length > 0 && (
        <section className="wrap v2-sec m-only m-rows">
          <div className="v2-rows">
            <TrophyRow t={past[0]} href={`/deal/${past[0].id}`} />
            <Link href="/buvo" className="v2-row v2-row--more"><span className="no" /><span className="v2-row-name">{S.navPast}</span><span className="v2-row-meta">{S.pastEyebrow}</span><span className="v2-row-price" aria-hidden="true">→</span></Link>
          </div>
        </section>
      )}

      {/* The ask lives next to the desire — never a full viewport below it.
          Mobile cuts the mid-page capture and the trophy case (founder 09-12). */}
      <div className="d-only">
        <CaptureRow />
      </div>

      {/* Artboard order: what you missed → what's left → the email */}
      <div className="d-only">
        <TrophyCase deals={past} />
      </div>
      <LiveIndex deals={rest} locked={locked} startAt={2} />
      <InkBand />

      <V2Footer />
    </main>
  );
}
