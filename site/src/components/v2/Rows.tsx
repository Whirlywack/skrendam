import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { eur, ltPlural } from '@/lib/format';

/** One live-deal index row — the single source for home, collection pages and
 *  similar-deals lists (review 08-28: three drifting copies collapsed here). */
export function DealRow({ t, no }: { t: TicketView; no: string }) {
  return (
    <Link href={`/deal/${t.id}`} className="v2-row">
      <span className="no">{no}</span>
      <span className="v2-row-name">{t.destination}</span>
      <span className={`v2-row-meta${t.goingFast ? ' v2-row-meta--flag' : ''}`}>
        {t.route} · {t.dates} · {t.catchChip}{t.goingFast ? ` · ${S.chipGoingFast}` : ''}
      </span>
      <span className="v2-row-price">{eur(t.price)}</span>
      <span className="go" aria-hidden="true" />
    </Link>
  );
}

/** Live index — „Dar spėji": the design system's ink-inverting rows, from № 02.
 *  Deals past the free window render locked: destination + month, price in the letter. */
export function LiveIndex({ deals, locked = [], startAt }: {
  deals: TicketView[]; locked?: TicketView[]; startAt: number;
}) {
  if (deals.length === 0 && locked.length === 0) return null;
  const shown = deals.length + startAt - 1;
  const total = shown + locked.length;
  // With a locked tail the kicker states the honest split; otherwise the count claim.
  const kicker = locked.length > 0
    ? `${S.foundToday} ${total} · ${S.shownHere} ${shown} · ${S.updatedMorning}`
    : `Tik ${shown} ${ltPlural(shown, 'vertas', 'verti', 'vertų')} tavo pinigų šiandien · ${S.updatedMorning}`;
  return (
    <section className="wrap v2-sec">
      <div className="head">
        <h2 className="v2-display">{S.liveHeader}<span className="bead bead--live" aria-hidden="true" /></h2>
        <span className="v2-kicker v2-kicker--dim">{kicker}</span>
      </div>
      <div className="v2-rows">
        {deals.map((t, i) => (
          <DealRow key={t.id} t={t} no={`Nr. ${String(startAt + i).padStart(2, '0')}`} />
        ))}
        {locked.map((t, i) => (
          <a key={t.id} href="#kapote" className="v2-row v2-row--locked">
            <span className="no">Nr. {String(startAt + deals.length + i).padStart(2, '0')}</span>
            <span className="v2-row-name">{t.destination}</span>
            <span className="v2-row-meta">{t.route} · {t.month} · {t.catchChip}</span>
            <span className="v2-row-price">
              <span className="bead" aria-hidden="true" />{S.lockedChip}
            </span>
            <span className="go" aria-hidden="true" />
          </a>
        ))}
      </div>
      {locked.length > 0 && (
        <div className="mono v2-footnote">
          {S.lockedFootnote} <a href="#kapote">{S.lockedFootnoteCta} →</a>
        </div>
      )}
    </section>
  );
}

/** Trophy case — „Buvo. Nebėra.": dead rows, muted price, the SAVING is the story. */
export function TrophyCase({ deals }: { deals: TicketView[] }) {
  if (deals.length === 0) return null;
  return (
    <section className="wrap v2-sec">
      <div className="head">
        <h2 className="v2-display">{S.trophyHeader}</h2>
        <span className="v2-kicker v2-kicker--dim">{S.trophyCaption}</span>
      </div>
      <div className="v2-rows">
        {deals.map((t) => {
          const saved = t.baseline != null && t.baseline > t.price
            ? Math.round(t.baseline - t.price) : null;
          // artboard: the № slot carries the month tag (dates open "rugs. 30 …")
          const month = t.dates.split(' ')[0]?.replace('.', '') ?? '';
          return (
            <div key={t.id} className="v2-row v2-row--dead">
              <span className="no">{month.toUpperCase()}</span>
              <span className="v2-row-name">{t.destination}</span>
              <span className="v2-row-meta">
                {t.route}{saved != null ? ` · ${S.savedWord} ${eur(saved)}` : ''} · {t.dates}
              </span>
              <span className="v2-row-price">
                {eur(t.price)}{t.baseline != null && <s>{eur(t.baseline)}</s>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mono v2-footnote">{S.trophyFootnote}</div>
    </section>
  );
}
