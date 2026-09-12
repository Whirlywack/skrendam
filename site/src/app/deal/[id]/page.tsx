import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getDeal, getFreeWindowIds, getPriceChecks, getSimilarDeals } from '@/lib/queries';
import { freshSource, toPublicDeal, toTicket } from '@/lib/mappers';
import { priceContext } from '@/lib/priceContext';
import { bookingCta } from '@/lib/booking';
import { dealWhyAndCatch, ltDealHeadline } from '@/lib/dealDetail';
import { sceneClass } from '@/lib/photos';
import { ltCity } from '@/lib/cities-lt';
import { eur, formatDates, freshnessLabel } from '@/lib/format';
import { toCheckItems } from '@/lib/priceChecks';
import { WAS_PRICE_MIN_DROP_PCT, priceFreeBlurb } from '@/lib/format-rules';
import { destinationsCollection, originCollection, zoneCollection } from '@/lib/collections';
import { S, curator } from '@/lib/lt';
import { LIVE_STATUSES } from '@/lib/statuses';
import { Masthead } from '@/components/v2/Masthead';
import { Crumb } from '@/components/v2/Crumb';
import { POSTER } from '@/components/v2/Poster';
import { CaptureRow } from '@/components/v2/CaptureRow';
import { LinkBand } from '@/components/v2/LinkBand';
import { DealRow } from '@/components/v2/Rows';
import { InkBand } from '@/components/v2/InkBand';
import { V2Footer } from '@/components/v2/V2Footer';
import { PriceSparkline } from '@/components/PriceSparkline';
import { CheckLine } from '@/components/v2/CheckLine';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, dealArticleJsonLd } from '@/lib/seo';

export const revalidate = 300;

/** live OR changed (WP9) — never a literal 'live' comparison; a changed deal
 *  locks, ranks and indexes exactly like a live one. */
const isLive = (status: string) => (LIVE_STATUSES as readonly string[]).includes(status);

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) notFound();

  const row = await getDeal(numId);
  if (!row) notFound();

  // Locked deals (live but past the free window) exist only as homepage
  // teasers — their detail lives in the letter. Expired deals keep rendering.
  const freeIds = await getFreeWindowIds();
  if (isLive(row.pd.status) && !freeIds.has(row.pd.id)) redirect('/#kapote');

  const now = new Date();
  const pd = row.pd;
  const deal = toPublicDeal(row, now);
  const t = toTicket(row, now);
  // A changed deal's curator headline may quote the found price („€140 return…")
  // — that number is no longer the one on the poster, so the verdict line takes
  // the blurb slot (same guard as the home poster: priceFreeBlurb).
  const rawHeadline = ltDealHeadline(pd.headline, deal.price, pd.destination);
  const headline = deal.state === 'changed' ? priceFreeBlurb(rawHeadline, deal.verdict) : rawHeadline;

  // Free-window rank — the poster kicker's honest "Nr. 0X" (Set keeps order).
  const rank = isLive(pd.status) ? [...freeIds].indexOf(pd.id) + 1 : 0;

  // Price context (real data — no fake sparklines)
  const stats = await priceContext(pd.origin, pd.destination, pd.tripType, deal.price, now);

  // Slice 2: expired variant + the last daily checks (WP9 deal_price_checks)
  const expired = !isLive(pd.status);
  const checkRows = await getPriceChecks(pd.id);
  // With no copy for a gone check yet, a line containing one would show a bare
  // dash — hide the line until the key is filled (Global Constraints).
  const checkItems = toCheckItems(checkRows, S.checkGone);
  const showChecks = checkItems.length > 0 && (S.checkGone !== '' || checkRows.every((r) => r.available && r.price != null));

  // Why / catch columns
  const score = Math.round(Number(row.score ?? 0) * 100);
  const whyAndCatch = dealWhyAndCatch({
    price: deal.price,
    baseline: deal.baseline,
    drop: deal.drop,
    stops: deal.stops,
    airline: deal.airline,
    score: score > 0 ? score : null,
    goingFast: pd.goingFast,
    dates: deal.dates,
  });

  // Similar deals (zone → origin fallback, free-window only)
  const similarRows = await getSimilarDeals(
    { excludeId: numId, zone: pd.zone, origin: pd.origin },
    3,
  );
  const similarTickets = similarRows.map((r) => toTicket(r, now));

  // Validated booking CTA (re-uses booking lib — never unvalidated href)
  const booking = bookingCta(pd.bookingUrl ?? null);

  // Freshness label — verified_at first (WP9), then last_seen_at (see freshSource)
  const freshLabel = pd.goingFast
    ? S.chipGoingFast
    : freshnessLabel(freshSource(row));

  // Quality chip (words only — score stays internal)
  const qualityLabel = deal.quality === 'rare' ? S.badgeRare : S.badgeGreat;

  const dest = ltCity(pd.destination);
  const [o, , d] = t.route.split(' ');
  const save = t.baseline != null && t.baseline > t.price ? Math.round(t.baseline - t.price) : null;
  const showWas = t.baseline != null && t.drop >= WAS_PRICE_MIN_DROP_PCT;
  const posterField = POSTER[sceneClass(pd.destination)] ?? 'v2-poster--sun';

  // Interlinks: the collections this deal belongs to (visible twin of JSON-LD)
  const origColl = originCollection(pd.origin);
  const destColl = destinationsCollection(pd.destination);
  const zoneColl = zoneCollection(pd.zone);
  const bandLinks = [
    ...(origColl ? [{ label: origColl.label, href: `/${origColl.slug}` }] : []),
    ...(destColl ? [{ label: destColl.label, href: `/${destColl.slug}` }] : []),
    ...(zoneColl ? [{ label: zoneColl.label, href: `/${zoneColl.slug}` }] : []),
    { label: S.navAllDeals, href: '/rinkiniai' },
  ];

  // Article description (price-free: drop%, route, dates — no € figure)
  const articleDescription = deal.drop > 0
    ? `${deal.drop} % pigiau nei įprastai maršrute ${deal.route}. ${deal.dates}. ${S.checkedByHand}`
    : `${deal.route}. ${deal.dates}. ${S.checkedByHand}`;

  return (
    <main className="v2">
      <JsonLd data={breadcrumbJsonLd([
        { name: S.navDeals, path: '/' },
        ...(origColl ? [{ name: origColl.label, path: `/${origColl.slug}` }] : []),
        { name: deal.destination, path: `/deal/${pd.id}` },
      ])} />
      <JsonLd data={dealArticleJsonLd({
        id: pd.id,
        headline,
        description: articleDescription,
        datePublished: pd.publishedAt,
      })} />
      <Masthead />

      <Crumb items={[
        { label: S.navDeals, href: '/' },
        ...(origColl ? [{ label: origColl.label, href: `/${origColl.slug}` }] : []),
        { label: deal.destination },
      ]} />

      {/* Poster hero — the home poster atom; the CTA becomes the booking action */}
      <section className="wrap" style={{ paddingTop: 14 }}>
        <div className={`v2-poster ${posterField}`}>
          <div className="top">
            <span className="v2-kicker">
              {rank > 0
                ? `${S.dealNoWord} Nr. ${String(rank).padStart(2, '0')} · ${S.thisWeekOf}${deal.state === 'changed' && S.priceRoseFlag ? ` · ${S.priceRoseFlag}` : ''}`
                : expired
                  ? `${S.pastEyebrow}${S.lastedLabel && deal.lasted ? ` · ${S.lastedLabel} ${deal.lasted}` : ''}`
                  : pd.publicLabel ?? S.foundByHand}
            </span>
            <span className="v2-stamp v2-stamp--light">{qualityLabel}</span>
          </div>
          <div>
            <h1 className="v2-poster-name" style={{ margin: 0 }}>
              {dest.nom}
            </h1>
            <p className="blurb">{headline}</p>
          </div>
          <div className="foot">
            <div className="routebox" aria-hidden="true">
              <div className="mono ends"><span>{o}</span><span>{t.legs.toUpperCase()}</span><span>{d}</span></div>
              <div className="bead-route"><span className="track" /><span className="bead" /></div>
            </div>
            <div className="pricecell">
              <div>
                <div className="v2-price price">
                  {eur(t.price)}
                  {showWas && <s>{eur(t.baseline!)}</s>}
                </div>
                {/* Same depth gate as the strikethrough (see Poster.tsx) */}
                {showWas && save != null && (
                  <div className="mono save">{S.saveWord} {eur(save)} {S.youSaveVs}</div>
                )}
                {/* Changed deal (WP9): „Dabar nuo 124 €" / „radome už 93 €" */}
                {t.priceLines.map((line) => (
                  <div key={line} className="mono save">{line}</div>
                ))}
              </div>
              <a className="cta" href={booking.url} target="_blank" rel="noopener noreferrer">
                {booking.button} <span className="bead" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <div className="mono v2-catchline">
          <span>{t.catchChip}</span>
          <span>{t.dates}</span>
          <span>{t.airline} · {freshLabel.toLowerCase()}</span>
        </div>
      </section>

      {/* Why / catch — bead-bullet editorial columns */}
      <section className="wrap v2-cols">
        <div>
          <h3 className="good">Kodėl verta</h3>
          {whyAndCatch.why.map((line, i) => (
            <div key={i} className="v2-li">
              <span className="bead" aria-hidden="true" /><span>{line}</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="cav">Kabliukas</h3>
          {whyAndCatch.catch.map((line, i) => (
            <div key={i} className="v2-li cav">
              <span className="bead" aria-hidden="true" /><span>{line}</span>
            </div>
          ))}
          {/* Slice 2 (gated): the window's cheapest date — shown once the copy key is filled */}
          {S.windowMinLabel && pd.windowMinPrice != null && pd.windowMinDate && (
            <div className="v2-li cav"><span className="bead" aria-hidden="true" />
              <span>{S.windowMinLabel}: {formatDates(String(pd.windowMinDate), null)} · {eur(Number(pd.windowMinPrice))}</span></div>
          )}
          {whyAndCatch.catch.length === 0 && (
            <div className="v2-li">
              <span className="bead" aria-hidden="true" /><span>Kabliukų nėra — švarus radinys.</span>
            </div>
          )}
        </div>
      </section>

      {/* Curator's note */}
      {pd.body && (
        <section className="wrap">
          <div className="v2-curator">
            <div className="mark" aria-hidden="true" />
            <div className="txt">„{pd.body}“</div>
            <div className="sig">— {curator().sig}</div>
          </div>
        </section>
      )}

      {/* Price context — one plain-language claim + the real sparkline when history exists */}
      {/* One integrated price story: kicker → price-free claim → bars → method.
          The € figure already dominates the poster — never repeated here. */}
      {(stats.hasHistory || deal.drop > 0) && (
        <section className="wrap v2-context">
          <div className="v2-kicker v2-kicker--dim">{S.priceContextH}</div>
          <div className="big">
            {stats.hasHistory
              ? `Pigiausi ${stats.percentile} % per 90 dienų šiame maršrute.`
              : `${deal.drop} % pigiau nei įprastai šiame maršrute.`}
          </div>
          <PriceSparkline stats={stats} todayPrice={deal.price} dead={expired} />
          {showChecks && <CheckLine items={checkItems} />}
          <div className="v2-kicker v2-kicker--dim method">
            {S.priceContextMethod} · {S.updatedMorning}
          </div>
        </section>
      )}

      {/* No mid-page ask on an expired deal — the poster already says it is gone (reviewer finding 7) */}
      {!expired && <CaptureRow source="deal" />}

      {/* Similar deals — the home page's ink-inverting rows */}
      {similarTickets.length > 0 && (
        <section className="wrap v2-sec">
          <div className="head">
            <h2 className="v2-display">{S.similarHeader}<span className="bead bead--live" aria-hidden="true" /></h2>
          </div>
          <div className="v2-rows">
            {similarTickets.map((s, i) => (
              <DealRow key={s.id} t={s} no={`Nr. ${String(i + 1).padStart(2, '0')}`} />
            ))}
          </div>
        </section>
      )}

      <LinkBand links={bandLinks} />

      <InkBand />
      <V2Footer />
    </main>
  );
}

// ── Metadata (preserved + enriched) ─────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) return { title: 'Radinys — Yip' };
  const row = await getDeal(numId);
  if (!row) return { title: 'Radinys — Yip' };

  // Locked deals: the page 307s to signup, but metadata must not carry the
  // price either — mirror the page guard (review 08-28).
  if (isLive(row.pd.status)) {
    const freeIds = await getFreeWindowIds();
    if (!freeIds.has(row.pd.id)) {
      return { title: 'Radinys — Yip', robots: { index: false, follow: true } };
    }
  }

  const d = toPublicDeal(row, new Date());

  // Expired deals: preserved noindex logic from prior task (changed indexes like live)
  const noindex = !isLive(row.pd.status);

  const tripLabel = d.tripType === 'roundtrip' ? S.retRoundTrip : S.retOneWay;
  // Sentence position after „į" declines the destination (spec §4 — never nominative after „į").
  const destAcc = ltCity(row.pd.destination).acc;

  const title = `${d.destination} ${eur(d.price)} — ${d.route} · Yip`;
  const description = d.drop > 0
    ? `${eur(d.price)} ${tripLabel} į ${destAcc} — ${d.drop} % pigiau nei įprastai. ${d.dates}. ${S.checkedByHand}`
    : `${eur(d.price)} ${tripLabel} į ${destAcc}. ${d.dates}. ${S.checkedByHand}`;

  return {
    title,
    description,
    alternates: { canonical: `/deal/${id}` },
    openGraph: { title, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
