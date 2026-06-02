function Composer({ c, onClose, onPublish }) {
  const [tab, setTab] = React.useState("headline");
  const [pick, setPick] = React.useState(0);
  const [hook, setHook] = React.useState(c.copy.hook);
  const [news, setNews] = React.useState(c.copy.news);
  const cls = c.score >= 80 ? "hi" : c.score >= 60 ? "mid" : "lo";

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="dh" style={{ background: c.grad }}>
          <div className="ov" />
          <div className={"score " + cls}>{c.score}<small>SCORE</small></div>
          <button className="x" onClick={onClose}><Icon name="x" size={18} /></button>
          <div className="cap">
            <div className="e">{c.template}</div>
            <div className="nm">{c.place}, {c.country}</div>
          </div>
        </div>

        <div className="dscroll">
          <div className="drow">
            <span className="pp">{c.from} → {c.to}</span>
            <span className="pp">{c.dates}</span>
            <span className="pp">{c.legs}</span>
            <span className="pp">{c.airline}</span>
            <span className="pp" style={{ color: "var(--sea-700)" }}>€{c.price} · −{c.drop}%</span>
          </div>

          <div className="sec">
            <h4>Why the scanner flagged it</h4>
            {c.signals.map((s, i) => (
              <div className="sig" key={i}><span className="ic"><Icon name="check" size={16} /></span>{s}</div>
            ))}
          </div>

          <div className="sec">
            <h4>Caveats to disclose</h4>
            {c.flags.map((f, i) => (
              <div className="flag" key={i}><span className="ic"><Icon name="alert-triangle" size={15} /></span>{f}</div>
            ))}
          </div>

          <div className="sec">
            <h4>Draft copy · AI-assisted, you approve</h4>
            <div className="drafter">
              <div className="dtabs">
                <button className={"dtab" + (tab === "headline" ? " on" : "")} onClick={() => setTab("headline")}><Icon name="type" size={15} /> Headline</button>
                <button className={"dtab" + (tab === "hook" ? " on" : "")} onClick={() => setTab("hook")}><Icon name="music" size={15} /> TikTok hook</button>
                <button className={"dtab" + (tab === "news" ? " on" : "")} onClick={() => setTab("news")}><Icon name="mail" size={15} /> Newsletter</button>
              </div>
              <div className="dcontent">
                {tab === "headline" && (
                  <div>
                    {c.copy.headline.map((h, i) => (
                      <div className={"opt" + (pick === i ? " sel" : "")} key={i} onClick={() => setPick(i)}>
                        <span className="radio" />
                        <span className="txt">{h}</span>
                      </div>
                    ))}
                    <button className="regen"><Icon name="sparkles" size={14} /> Suggest more options</button>
                  </div>
                )}
                {tab === "hook" && (
                  <div>
                    <textarea className="draftbox" value={hook} onChange={(e) => setHook(e.target.value)} />
                    <button className="regen"><Icon name="sparkles" size={14} /> Regenerate hook</button>
                    <span className="charcount">{hook.length} chars</span>
                  </div>
                )}
                {tab === "news" && (
                  <div>
                    <textarea className="draftbox" style={{ minHeight: 132 }} value={news} onChange={(e) => setNews(e.target.value)} />
                    <button className="regen"><Icon name="sparkles" size={14} /> Regenerate snippet</button>
                    <span className="charcount">{news.length} chars</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pubbar">
          <button className="btn btn-ghost" onClick={onClose}><Icon name="x" size={16} /> Reject</button>
          <span className="flex1" />
          <button className="btn btn-outline"><Icon name="clock" size={16} /> Schedule</button>
          <button className="btn btn-primary" onClick={() => onPublish(c)}><Icon name="check" size={16} /> Approve &amp; publish</button>
        </div>
      </div>
    </>
  );
}
Object.assign(window, { Composer });
