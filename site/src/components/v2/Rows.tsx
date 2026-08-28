import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { S } from '@/lib/lt';
import { eur, ltPlural } from '@/lib/format';

/** Live index — „Dar spėji": clickable ink-inverting rows, numbered from № 02. */
export function LiveIndex({ deals, startAt }: { deals: TicketView[]; startAt: number }) {
  if (deals.length === 0) return null;
  const n = deals.length + startAt - 1;
  const kicker = `Tik ${n} ${ltPlural(n, 'vertas', 'verti', 'vertų')} tavo pinigų šiandien · ${S.updatedMorning}`;
  return (
    <section className="wrap v2-sec">
      <div className="head">
        <h2 className="disp">{S.liveHeader}<span className="bead bead--live" aria-hidden="true" /></h2>
        <span className="kicker kicker--dim">{kicker}</span>
      </div>
      <div className="v2-rows">
        {deals.map((t, i) => (
          <Link key={t.id} href={`/deal/${t.id}`} className="v2-row">
            <span className="mono no">Nr. {String(startAt + i).padStart(2, '0')}</span>
            <span className="disp rname">{t.destination}</span>
            <span className={`mono rmeta${t.goingFast ? ' rmeta--flag' : ''}`}>
              {t.route} · {t.dates} · {t.catchChip}{t.goingFast ? ` · ${S.chipGoingFast}` : ''}
            </span>
            <span className="disp rprice">{eur(t.price)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Trophy case — „Buvo. Nebėra.": dead rows, muted price, the SAVING is the story. */
export function TrophyCase({ deals }: { deals: TicketView[] }) {
  if (deals.length === 0) return null;
  return (
    <section className="wrap v2-sec">
      <div className="head">
        <h2 className="disp">{S.trophyHeader}</h2>
        <span className="kicker kicker--dim">{S.trophyCaption}</span>
      </div>
      <div className="v2-rows">
        {deals.map((t) => {
          const saved = t.baseline != null && t.baseline > t.price
            ? Math.round(t.baseline - t.price) : null;
          return (
            <div key={t.id} className="v2-row v2-row--dead">
              <span className="mono no" aria-hidden="true" />
              <span className="disp rname">{t.destination}</span>
              <span className="mono rmeta">
                {t.route}{saved != null ? ` · ${S.savedWord} ${eur(saved)}` : ''} · {t.dates}
              </span>
              <span className="disp rprice">
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
