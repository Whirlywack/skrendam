import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeal, getSimilarDeals } from '@/lib/queries';
import { toPublicDeal, toTicket } from '@/lib/mappers';
import { priceContext } from '@/lib/priceContext';
import { bookingCta } from '@/lib/booking';
import { dealWhyAndCatch } from '@/lib/dealDetail';
import { sceneClass } from '@/lib/photos';
import { city, country, dealHeadline } from '@/lib/airports';
import { timeAgo } from '@/lib/format';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Photo } from '@/components/Photo';
import { PriceSparkline } from '@/components/PriceSparkline';
import { DealTicket } from '@/components/DealTicket';
import { SignupCard } from '@/components/SignupCard';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, dealArticleJsonLd } from '@/lib/seo';

export const revalidate = 300;

// ── SVG icons ────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg className="ic" width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="ic" width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) notFound();

  const row = await getDeal(numId);
  if (!row) notFound();

  const now = new Date();
  const pd = row.pd;
  const deal = toPublicDeal(row, now);
  const headline = dealHeadline(pd.headline, Number(pd.price), pd.destination);

  // Price context (real data — no fake sparklines)
  const stats = await priceContext(pd.origin, pd.destination, pd.tripType, deal.price, now);

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

  // Similar deals (zone → origin fallback, up to 3)
  const similarRows = await getSimilarDeals(
    { excludeId: numId, zone: pd.zone, origin: pd.origin },
    3,
  );
  const similarTickets = similarRows.map((r) => toTicket(r, now));

  // Validated booking CTA (re-uses booking lib — never unvalidated href)
  const booking = bookingCta(pd.bookingUrl ?? null);

  // Freshness label
  const fresh = pd.lastSeenAt ?? row.candLastSeen ?? null;
  const freshLabel = pd.goingFast
    ? 'Going fast'
    : fresh ? `Checked ${timeAgo(String(fresh))}` : 'Checked recently';

  // Quality chip (words only — score stays internal)
  const qualityLabel = deal.quality === 'rare' ? 'Rare deal' : 'Great deal';

  // Hero photo scene
  const scene = sceneClass(pd.destination);
  const destCity = city(pd.destination);
  const destCountry = country(pd.destination);

  // Article description (price-free: drop%, route, dates — no € figure)
  const articleDescription = deal.drop > 0
    ? `${deal.drop}% below typical ${deal.route} flight. ${deal.dates}. Found and checked by hand.`
    : `${deal.route}. ${deal.dates}. Found and checked by hand.`;

  return (
    <div className="yip-site">
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', path: '/' },
        { name: 'Deals', path: '/' },
        { name: deal.destination, path: `/deal/${pd.id}` },
      ])} />
      <JsonLd data={dealArticleJsonLd({
        id: pd.id,
        headline,
        description: articleDescription,
        datePublished: pd.publishedAt,
      })} />
      <Header />

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 26px 0' }}>
        <Link className="back" href="/">&larr; All deals</Link>
      </div>

      {/* ── Boarding-pass hero ────────────────────────────────────────────── */}
      {/* .himg is the positioned container; Photo fills it; caption overlays on top */}
      <div className="himg" style={{ margin: '12px 26px 0', position: 'relative' }}>
        {/* Photo fills the full .himg height — borderRadius 0 so the parent clips */}
        <Photo scene={scene} className="himg-fill" />
        {/* Gradient overlay */}
        <div className="ov" />
        {/* Caption overlaid on the photo */}
        <div className="himg-cap">
          <span className="eyebrow himg-eyebrow">
            {pd.publicLabel ?? 'Found by hand'} &middot; {freshLabel}
          </span>
          <h1 className="himg-h1">
            {destCity}{destCountry ? `, ${destCountry}` : ''}
          </h1>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="deal-body" style={{ padding: '22px 26px 8px' }}>

        {/* Meta row */}
        <div className="dmeta">
          <span>{deal.route} &middot; {deal.dates} &middot; {deal.stops === 0 ? 'Direct' : `${deal.stops} stop${deal.stops > 1 ? 's' : ''}`} &middot; {deal.airline}</span>
          <span className={`chip ${deal.quality === 'rare' ? 'chip-rare' : 'chip-great'}`}>{qualityLabel}</span>
          <span className="chip chip-fresh">&#x25CF; {freshLabel}</span>
        </div>

        {/* Headline */}
        <div className="dh">{headline}</div>

        {/* ── Book row ──────────────────────────────────────────────────── */}
        <div className="dbook">
          <div className="price">
            &euro;{Math.round(deal.price)}
            {deal.baseline ? <s>&euro;{Math.round(deal.baseline)}</s> : null}
            <span className="ret">{pd.tripType === 'roundtrip' ? 'return' : 'one-way'} &middot; per person</span>
          </div>
          <div className="dbook-cta">
            <a className="bookbtn" href={booking.url} target="_blank" rel="noopener noreferrer">
              {booking.button} &rarr;
            </a>
            <div className="booksub">{booking.sub}</div>
          </div>
        </div>

        {/* ── Why it's good | The catch ─────────────────────────────────── */}
        <div className="dcols">
          <div>
            <h5 className="good">Why it&apos;s good</h5>
            <div className="dlist">
              {whyAndCatch.why.map((line, i) => (
                <div key={i} className="li good">
                  <IconCheck />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h5 className="cav">The catch</h5>
            <div className="dlist">
              {whyAndCatch.catch.map((line, i) => (
                <div key={i} className="li cav">
                  <IconClock />
                  <span>{line}</span>
                </div>
              ))}
              {whyAndCatch.catch.length === 0 && (
                <div className="li good">
                  <IconCheck />
                  <span>No catches — this one&apos;s clean.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Curator's note ────────────────────────────────────────────── */}
        {pd.body && (
          <div className="curator">
            <div className="av" />
            <div>
              <div className="txt">{pd.body}</div>
              <div className="sig">— Your Yip curator</div>
            </div>
          </div>
        )}

        {/* ── Price context ─────────────────────────────────────────────── */}
        {/* PriceSparkline renders null when hasHistory=false — no fake chart */}
        <PriceSparkline stats={stats} todayPrice={deal.price} />

        {/* Price context fallback — point stats when no sparkline history */}
        {!stats.hasHistory && deal.baseline && deal.drop > 0 && (
          <div className="sec">
            <h3>Why it&apos;s a good price</h3>
            <div className="bignote">{deal.drop}% below typical for this route.</div>
            <div className="rangelbl">
              <span>this deal <b>&euro;{Math.round(deal.price)}</b></span>
              <span>typical <b>&euro;{Math.round(deal.baseline)}</b></span>
            </div>
          </div>
        )}

        {/* ── Similar deals ─────────────────────────────────────────────── */}
        {similarTickets.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="sec-h">More deals like this</div>
            <div className="grid3">
              {similarTickets.map((t) => (
                <DealTicket key={t.id} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* ── Email nudge ───────────────────────────────────────────────── */}
        {/* SignupCard is a client component; source="deal" tags the signup origin */}
        <div style={{ marginTop: 24 }}>
          <SignupCard source="deal" />
        </div>

        {/* ── Booking CTA (repeat at bottom) ────────────────────────────── */}
        <div className="dbook" style={{ marginTop: 16 }}>
          <div className="price">
            &euro;{Math.round(deal.price)}
            <span className="ret">{pd.tripType === 'roundtrip' ? 'return' : 'one-way'} &middot; per person</span>
          </div>
          <div className="dbook-cta">
            <a className="bookbtn" href={booking.url} target="_blank" rel="noopener noreferrer">
              {booking.button} &rarr;
            </a>
            <div className="booksub">{booking.sub}</div>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}

// ── Metadata (preserved + enriched) ─────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (Number.isNaN(numId)) return { title: 'Deal — Yip' };
  const row = await getDeal(numId);
  if (!row) return { title: 'Deal — Yip' };
  const d = toPublicDeal(row, new Date());

  // Expired deals: preserved noindex logic from prior task
  const noindex = row.pd.status !== 'live';

  const title = `${d.destination} €${Math.round(d.price)} — ${d.route} · Yip`;
  const description = d.drop > 0
    ? `€${Math.round(d.price)} ${d.tripType === 'roundtrip' ? 'return' : 'one-way'} to ${d.destination} — ${d.drop}% below typical. ${d.dates}. Found and checked by hand.`
    : `€${Math.round(d.price)} ${d.tripType === 'roundtrip' ? 'return' : 'one-way'} to ${d.destination}. ${d.dates}. Found and checked by hand.`;

  return {
    title,
    description,
    alternates: { canonical: `/deal/${id}` },
    openGraph: { title, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
