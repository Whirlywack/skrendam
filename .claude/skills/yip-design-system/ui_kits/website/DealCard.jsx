function DealCard({ deal, onOpen }) {
  return (
    <article className="deal" onClick={() => onOpen(deal)}>
      <div className="ph">
        <div className="img" style={{ background: deal.grad }} />
        <div className="ov" />
        <div className="eyebrow">{deal.eyebrow}</div>
        <div className="place">{deal.place}<small>{deal.country} · from {deal.origin}</small></div>
        {deal.hot && <span className="hot-tag"><Icon name="flame" size={12} /> Going fast</span>}
      </div>
      <div className="body">
        <div className="meta">{deal.from} → {deal.to} · {deal.dates} · {deal.legs}</div>
        <h3>{deal.headline}</h3>
        <div className="chips">
          <span className="chip chip-good"><Icon name="trending-down" size={13} /> {Math.round((1 - deal.price / deal.usual) * 100)}% under</span>
          <span className="chip chip-good"><Icon name={deal.why[1] ? deal.why[1][0] : "plane"} size={13} /> {deal.why[1] ? deal.why[1][1].split(" ").slice(0, 2).join(" ") : "Direct"}</span>
        </div>
        <div className="ticket-foot">
          <div className="price">€{deal.price}<s>€{deal.usual}</s><span className="ret">return · {deal.airline}</span></div>
          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onOpen(deal); }}>See deal <Icon name="arrow-right" size={15} /></button>
        </div>
      </div>
    </article>
  );
}

function DealGrid({ deals, onOpen }) {
  return (
    <div className="wrap">
      {deals.length === 0 ? (
        <div style={{ padding: "60px 0 80px", textAlign: "center", color: "var(--fg-2)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: "var(--fg-1)", marginBottom: 8 }}>
            Nothing live for that combo right now.
          </div>
          We're always hunting — get the next one by email.
        </div>
      ) : (
        <div className="grid">
          {deals.map((d) => <DealCard key={d.id} deal={d} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DealCard, DealGrid });
