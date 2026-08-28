import { getLiveDeals, getInspirationDeals } from '@/lib/queries';
import { toTicket } from '@/lib/mappers';
import { freshnessLabel } from '@/lib/format';
import { S } from '@/lib/lt';
import { Masthead } from '@/components/v2/Masthead';
import { Poster } from '@/components/v2/Poster';
import { LiveIndex, TrophyCase } from '@/components/v2/Rows';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';
import { ProcessBand } from '@/components/ProcessBand';
import { Faq, HOME_FAQ } from '@/components/Faq';

export const revalidate = 300; // ISR: refresh every 5 min

export default async function Home() {
  const now = new Date();
  const rows = await getLiveDeals();
  const live = rows.map((r) => toTicket(r, now));
  const past = (await getInspirationDeals(3)).map((r) => toTicket(r, now));
  const [featured = null, ...rest] = live;
  // Real freshness of the featured deal — the stamp never lies (spec §2).
  const featuredRow = rows[0];
  const fresh = featuredRow
    ? freshnessLabel(String(featuredRow.pd.lastSeenAt ?? featuredRow.candLastSeen ?? '') || null)
    : null;

  return (
    <main className="v2">
      <Masthead />

      {/* Hero: issue kicker → poster headline → subhead + human stamp */}
      <section className="wrap v2-hero">
        <div className="kicker">{S.issueLabel}</div>
        <h1 className="disp">
          {S.heroH1.replace(/\.$/, '')}
          <span className="bead" aria-hidden="true" />
        </h1>
        <div className="sub-row">
          <p className="lead">{S.heroSub}</p>
          <span className="stamp">
            <span className="bead" style={{ width: 7, height: 7 }} aria-hidden="true" />
            {/* A recent check reads "patikrino žmogus · tikrinta prieš 2 val.";
                past the freshness cap the cap message stands alone. */}
            {fresh && !fresh.startsWith('Tikrinta') ? fresh : `${S.humanStamp}${fresh ? ` · ${fresh.toLowerCase()}` : ''}`}
          </span>
        </div>
      </section>

      {featured && <Poster t={featured} count={live.length} freshness={fresh ?? ''} />}

      {/* Approved order (audit): live index → trophy case → capture band */}
      <LiveIndex deals={rest} startAt={2} />
      <TrophyCase deals={past} />
      <InkBand />

      {/* How-it-works + FAQ keep their V1 dress until PR C reflows them */}
      <div id="kaip">
        <ProcessBand />
        <Faq items={HOME_FAQ} />
      </div>

      <V2Footer />
    </main>
  );
}
