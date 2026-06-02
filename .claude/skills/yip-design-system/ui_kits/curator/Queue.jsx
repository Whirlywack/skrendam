function ScoreBadge({ score }) {
  const cls = score >= 80 ? "hi" : score >= 60 ? "mid" : "lo";
  return <div className={"score " + cls}>{score}<small>SCORE</small></div>;
}

function QueueRow({ c, onOpen }) {
  return (
    <div className="qrow" onClick={() => onOpen(c)}>
      <ScoreBadge score={c.score} />
      <div className="qdeal">
        <span className="qthumb" style={{ background: c.grad }} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{c.place}, {c.country}</div>
          <div className="mt">{c.from} → {c.to} · {c.dates} · {c.legs}</div>
        </div>
      </div>
      <div className="qtmpl"><span className="chip">{c.template}</span></div>
      <div className="qdrop">−{c.drop}%</div>
      <div className="qprice">€{c.price}<s>was €{c.usual}</s></div>
      <div className={"stat " + c.status}>{c.status[0].toUpperCase() + c.status.slice(1)}</div>
    </div>
  );
}

function Topbar({ tab, setTab }) {
  const s = window.YIP_SCAN;
  return (
    <div className="topbar">
      <div className="scan">
        <span className="dot" />
        <span>Scanner ran <b>{s.ago}</b> · checked <b>{s.fares}</b> fares across <b>{s.airports}</b> airports · <b>{s.newToday}</b> new candidates today</span>
        <button className="rescan"><Icon name="refresh-cw" size={14} /> Re-scan now</button>
      </div>
      <div className="pagehead">
        <div>
          <h1>Deal queue</h1>
          <div className="sub">Candidates the scanner surfaced — review, draft, and approve before they go public.</div>
        </div>
        <div className="tabs">
          {["All", "Suggested", "In review", "Rejected"].map((t) => (
            <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Queue({ candidates, onOpen }) {
  return (
    <div className="queue">
      <div className="qhead">
        <span>Score</span><span>Deal</span><span>Template</span><span>Drop</span><span>Price</span><span>Status</span>
      </div>
      {candidates.map((c) => <QueueRow key={c.id} c={c} onOpen={onOpen} />)}
    </div>
  );
}

Object.assign(window, { ScoreBadge, QueueRow, Topbar, Queue });
