function DealDetail({ deal, onClose }) {
  const pct = Math.round((1 - deal.price / deal.usual) * 100);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="detail-scrim" onClick={onClose}>
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <div className="hero-img" style={{ background: deal.grad }}>
          <div className="ov" />
          <button className="close" onClick={onClose}><Icon name="x" size={20} /></button>
          <div className="cap">
            <div className="eyebrow">{deal.eyebrow} · {deal.moment}</div>
            <h2>{deal.place}, {deal.country}</h2>
          </div>
        </div>
        <div className="dbody">
          <div className="dmeta">
            <span><Icon name="plane" size={15} style={{ marginRight: 6, verticalAlign: "-3px" }} />{deal.from} → {deal.to}</span>
            <span>{deal.dates}</span>
            <span>{deal.legs}</span>
            <span>{deal.airline}</span>
          </div>
          <h3 className="dh">{deal.headline}</h3>

          <div className="dcols">
            <div>
              <h5 className="good">Why it's good</h5>
              <div className="dlist">
                {deal.why.map(([ic, t], i) => (
                  <div className="li good" key={i}><span className="ic"><Icon name={ic} size={18} /></span>{t}</div>
                ))}
              </div>
            </div>
            <div>
              <h5 className="cav">The catch</h5>
              <div className="dlist">
                {deal.caveats.map(([ic, t], i) => (
                  <div className="li cav" key={i}><span className="ic"><Icon name={ic} size={18} /></span>{t}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="curator-note">
            <span className="ic"><Icon name="quote" size={18} /></span>
            <div className="txt"><b>From the curator —</b> {deal.note}</div>
          </div>

          <div className="dbook">
            <div className="price">€{deal.price}<s>€{deal.usual}</s><span className="ret">return · {pct}% under usual</span></div>
            <button className="btn btn-primary" onClick={(e) => e.preventDefault()}>
              Book on {deal.airline} <Icon name="external-link" size={16} />
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 14, textAlign: "center" }}>
            Yip links you out to book directly with the airline. Prices change fast — confirm before paying.
          </p>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { DealDetail });
