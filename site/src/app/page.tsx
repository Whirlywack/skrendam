import { getLiveDeals, getInspirationDeals } from '@/lib/queries';
import { toTicket, toPublicDeal } from '@/lib/mappers';
import { freshnessLabel } from '@/lib/format';
import { S } from '@/lib/lt';
import { Masthead } from '@/components/v2/Masthead';
import { Poster } from '@/components/v2/Poster';
import { CaptureRow } from '@/components/v2/CaptureRow';
import { LiveIndex, TrophyCase } from '@/components/v2/Rows';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';

export const revalidate = 300; // ISR: refresh every 5 min

export default async function Home() {
  const now = new Date();
  const rows = await getLiveDeals();
  const live = rows.map((r) => toTicket(r, now));
  const past = (await getInspirationDeals(3)).map((r) => toTicket(r, now));
  const [featured = null, ...rest] = live;
  // Real freshness + the LT verdict line of the featured deal (never hardcoded).
  const featuredRow = rows[0];
  const fresh = featuredRow
    ? freshnessLabel(String(featuredRow.pd.lastSeenAt ?? featuredRow.candLastSeen ?? '') || null)
    : null;
  const hook = featuredRow ? toPublicDeal(featuredRow, now).verdict : '';
  // The stamp always leads with the human claim; a stale-price caveat lives
  // once, in the poster catch-line — never as the page's trust badge.
  const stampFresh = fresh && fresh.startsWith('Tikrinta') ? ` · ${fresh.toLowerCase()}` : '';

  return (
    <main className="v2">
      <Masthead />

      {/* Hero: issue kicker → poster headline → subhead + human stamp */}
      <section className="wrap v2-hero">
        <div className="v2-kicker">{S.issueLabel}</div>
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

      {featured && <Poster t={featured} count={live.length} freshness={fresh ?? ''} hook={hook} />}

      {/* The ask lives next to the desire — never a full viewport below it */}
      <CaptureRow />

      {/* Artboard order: what you missed → what's left → the email */}
      <TrophyCase deals={past} />
      <LiveIndex deals={rest} startAt={2} />
      <InkBand />

      <V2Footer />
    </main>
  );
}
