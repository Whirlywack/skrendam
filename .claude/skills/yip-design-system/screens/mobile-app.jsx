/* Yip Deal Desk — mobile app (interactive). Renders inside <IOSDevice>. */

function MIcon({ name, size = 20, color, sw = 2, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current; if (!el || !window.lucide) return;
    el.innerHTML = `<i data-lucide="${name}"></i>`;
    window.lucide.createIcons();
    const svg = el.querySelector("svg");
    if (svg) { svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("stroke-width", sw); }
  }, [name, size, sw]);
  return <span ref={ref} style={{ display: "inline-flex", width: size, height: size, color, flex: "none", ...style }} />;
}

const DEALS = [
  { id: "lca", place: "Larnaca", country: "Cyprus", from: "VNO", to: "LCA", origin: "Vilnius",
    price: 59, usual: 102, drop: 42, dates: "14–21 Oct", legs: "Direct · 4h", airline: "Wizz Air",
    template: "Last warm days", score: 92, hot: true, grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
    why: [["trending-down", "42% below the 90-day median"], ["plane", "Direct both ways — no self-transfer"], ["sun", "Still 27°C, warm sea, quiet beaches"]],
    caveats: [["luggage", "Hand luggage only (+€25 for a bag)"], ["clock", "Return lands 23:40"]],
    headline: "€59 return to Cyprus — last warm week of the year",
    hook: "POV: it's 6°C in Vilnius but you found €59 returns to 27°C Cyprus 🌴" },
  { id: "vie", place: "Vienna", country: "Austria", from: "VNO", to: "VIE", origin: "Vilnius",
    price: 45, usual: 88, drop: 49, dates: "5–8 Dec", legs: "Direct · 1h45", airline: "Ryanair",
    template: "Christmas markets", score: 88, hot: true, grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
    why: [["trending-down", "49% below median"], ["snowflake", "Peak Christmas-market season"], ["plane", "Direct, short hop"]],
    caveats: [["luggage", "Hand luggage only"], ["bus", "Bus from airport ~25 min"]],
    headline: "Vienna Christmas-market weekend for €45",
    hook: "€45 return to Vienna for the Christmas markets?? sending to the group chat 🎄" },
  { id: "agp", place: "Málaga", country: "Spain", from: "KUN", to: "AGP", origin: "Kaunas",
    price: 52, usual: 110, drop: 53, dates: "This Fri–Mon", legs: "Direct · 4h30", airline: "Ryanair",
    template: "Last-minute weekends", score: 76, hot: true, grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
    why: [["trending-down", "53% below median"], ["plane", "Direct from Kaunas"], ["sun", "25°C — last beach days"]],
    caveats: [["clock", "Return lands 00:35"], ["alert-triangle", "Limited seats left"]],
    headline: "Costa del Sol escape — leaving this Friday, €52",
    hook: "leaving for málaga friday for €52 and telling my boss monday 😎" },
];

const C = {
  page: "var(--bg-page)", surface: "var(--bg-surface)", ink: "var(--fg-1)", fg2: "var(--fg-2)", fg3: "var(--fg-3)",
  amber: "var(--amber-500)", amber700: "var(--amber-700)", sea: "var(--sea-500)", sea700: "var(--sea-700)",
  line: "var(--line)", lineSoft: "var(--line-soft)", coral: "var(--coral-500)",
  fmono: "var(--font-mono)", fdisp: "var(--font-display)",
};
const STATUS_PAD = 56; // clear the status bar / island
const TAB_H = 84;      // bottom tab bar incl. home indicator

function ScoreDot({ s, size = 44 }) {
  const tone = s >= 80 ? ["var(--sea-50)", "var(--sea-700)"] : s >= 60 ? ["var(--amber-50)", "var(--amber-700)"] : ["var(--sand-100)", "var(--sand-500)"];
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: tone[0], color: tone[1], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: "none", fontFamily: C.fdisp, fontWeight: 800, fontSize: size * 0.38, lineHeight: 1 }}>
      {s}<span style={{ fontFamily: C.fmono, fontSize: 7, fontWeight: 700, letterSpacing: ".06em", opacity: .8, marginTop: 1 }}>SCORE</span>
    </span>
  );
}

function Chip({ icon, children, tone = "sand" }) {
  const map = { sea: ["var(--sea-50)", "var(--sea-700)"], sand: ["var(--sand-100)", "var(--sand-700)"], amber: ["var(--amber-100)", "var(--amber-800)"] };
  const [bg, fg] = map[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {icon && <MIcon name={icon} size={13} />}{children}
    </span>
  );
}

function AppHeader({ title, sub, right }) {
  return (
    <div style={{ paddingTop: STATUS_PAD, padding: `${STATUS_PAD}px 20px 12px`, background: C.page }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          {sub && <div style={{ fontFamily: C.fmono, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.sea700, marginBottom: 4 }}>{sub}</div>}
          <div style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 30, letterSpacing: "-.02em", color: C.ink, lineHeight: 1.05 }}>{title}</div>
        </div>
        {right}
      </div>
    </div>
  );
}

function DealTile({ d, onClick, compact }) {
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", border: "none", padding: 0, background: C.surface, borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-sm)", marginBottom: 13, cursor: "pointer" }}>
      <div style={{ height: compact ? 96 : 132, position: "relative", background: d.grad }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,24,19,.55), transparent 60%)" }} />
        {d.hot && <span style={{ position: "absolute", top: 11, right: 11, background: C.coral, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4 }}><MIcon name="flame" size={12} /> Going fast</span>}
        <div style={{ position: "absolute", left: 14, bottom: 11, color: "#fff" }}>
          <div style={{ fontFamily: C.fmono, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", textShadow: "0 1px 4px rgba(0,0,0,.4)" }}>{d.template}</div>
          <div style={{ fontFamily: C.fdisp, fontWeight: 700, fontSize: 22, lineHeight: 1, marginTop: 3, textShadow: "0 1px 8px rgba(0,0,0,.45)" }}>{d.place}, {d.country}</div>
        </div>
      </div>
      <div style={{ padding: "13px 15px 15px" }}>
        <div style={{ fontFamily: C.fmono, fontSize: 11, textTransform: "uppercase", color: C.fg2 }}>{d.from} → {d.to} · {d.dates} · {d.legs}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <ScoreDot s={d.score} size={40} />
            <div>
              <div style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 24, letterSpacing: "-.03em", color: C.ink }}>€{d.price}<span style={{ fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 13, color: C.fg3, textDecoration: "line-through", marginLeft: 5 }}>€{d.usual}</span></div>
              <div style={{ fontFamily: C.fmono, fontSize: 10, color: C.sea700, fontWeight: 700 }}>−{d.drop}% vs usual</div>
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.amber, color: "var(--fg-on-amber)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 12 }}>Review <MIcon name="arrow-right" size={15} /></span>
        </div>
      </div>
    </button>
  );
}

/* ---------------- Screens ---------------- */
function ScrollArea({ children }) {
  return <div style={{ flex: 1, overflowY: "auto", background: C.page, paddingBottom: TAB_H + 8 }}>{children}</div>;
}

function TodayScreen({ onOpen }) {
  return (
    <React.Fragment>
      <AppHeader sub="Tuesday, 2 June" title="Good afternoon" right={<span style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,var(--sea-400),var(--sea-600))", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>TK</span>} />
      <ScrollArea>
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sea-50)", border: "1px solid var(--sea-100)", color: C.sea700, padding: "11px 14px", borderRadius: 14, fontSize: 13, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.sea, boxShadow: "0 0 0 3px rgba(15,124,104,.2)", flex: "none" }} />
            <span>Scanned <b>4 min ago</b> · <b>2,143</b> fares · <b>3</b> new</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
            {[["3", "New top", "var(--amber-50)", "var(--amber-700)"], ["2", "Expiring", "var(--coral-50)", "var(--coral-600)"], ["14", "Live", "var(--bg-surface)", "var(--fg-1)"]].map(([n, l, bg, fg], i) => (
              <div key={i} style={{ background: bg, border: "1px solid var(--line)", borderRadius: 16, padding: "13px 12px" }}>
                <div style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 26, color: fg, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 12, color: C.fg2, marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: C.fdisp, fontWeight: 700, fontSize: 20, color: C.ink }}>New top deals</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sea700 }}>Review all</span>
          </div>
          {DEALS.map(d => <DealTile key={d.id} d={d} onClick={() => onOpen(d)} />)}
        </div>
      </ScrollArea>
    </React.Fragment>
  );
}

function QueueScreen({ onOpen }) {
  const groups = [["sun", "Last warm days", DEALS.filter(d => d.template === "Last warm days")],
    ["snowflake", "Christmas markets", DEALS.filter(d => d.template === "Christmas markets")],
    ["zap", "Last-minute weekends", DEALS.filter(d => d.template === "Last-minute weekends")]];
  return (
    <React.Fragment>
      <AppHeader sub="7 candidates" title="Deal queue" />
      <ScrollArea>
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 7, marginBottom: 18, overflowX: "auto" }}>
            {["All", "Suggested", "Maybe", "Rejected"].map((t, i) => (
              <span key={t} style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 999, whiteSpace: "nowrap", background: i === 0 ? "var(--sand-900)" : C.surface, color: i === 0 ? "var(--sand-50)" : C.fg2, border: i === 0 ? "none" : "1.5px solid var(--line)" }}>{t}</span>
            ))}
          </div>
          {groups.map(([ic, name, items]) => (
            <div key={name} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--amber-50)", color: C.amber700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><MIcon name={ic} size={16} /></span>
                <span style={{ fontFamily: C.fdisp, fontWeight: 700, fontSize: 17 }}>{name}</span>
                <span style={{ fontSize: 12, color: C.fg3, fontWeight: 700 }}>{items.length}</span>
              </div>
              {items.map(d => <DealTile key={d.id} d={d} onClick={() => onOpen(d)} compact />)}
            </div>
          ))}
        </div>
      </ScrollArea>
    </React.Fragment>
  );
}

function PublishedScreen() {
  const tabs = ["Live 14", "Draft 3", "Expired 52"];
  const rows = [["Larnaca, Cyprus", "VNO → LCA", "€59", "+218", "Public"], ["Vienna, Austria", "VNO → VIE", "€45", "+341", "Public"], ["Athens, Greece", "RIX → ATH", "€68", "+154", "Public"], ["Málaga, Spain", "KUN → AGP", "€52", "+402", "Public"]];
  const grads = ["linear-gradient(150deg,#EFA227,#D63E22)", "linear-gradient(150deg,#ED7660,#B53017)", "linear-gradient(150deg,#F3B84E,#C56A07)", "linear-gradient(150deg,#EFA227,#E55438)"];
  return (
    <React.Fragment>
      <AppHeader sub="Manage" title="Published" />
      <ScrollArea>
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--line)", marginBottom: 14 }}>
            {tabs.map((t, i) => (
              <span key={t} style={{ fontSize: 14, fontWeight: 600, padding: "8px 0", color: i === 0 ? C.ink : C.fg2, boxShadow: i === 0 ? "inset 0 -2px 0 var(--amber-500)" : "none" }}>{t}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, border: "1px solid var(--line)", borderRadius: 16, padding: 12, marginBottom: 10 }}>
              <span style={{ width: 46, height: 46, borderRadius: 11, background: grads[i], flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.fdisp, fontWeight: 700, fontSize: 15 }}>{r[0]}</div>
                <div style={{ fontFamily: C.fmono, fontSize: 11, color: C.fg2, marginTop: 2 }}>{r[1]} · {r[2]}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.sea700 }}>{r[3]}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: C.sea, padding: "2px 8px", borderRadius: 999 }}>{r[4]}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </React.Fragment>
  );
}

function ProfileScreen() {
  const items = [["bell", "Alert preferences"], ["map", "Routes & zones"], ["activity", "Scan health"], ["users", "Audience segments"], ["settings", "Settings"]];
  return (
    <React.Fragment>
      <AppHeader sub="Founder · Vilnius" title="Tomas K." right={<span style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,var(--sea-400),var(--sea-600))", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>TK</span>} />
      <ScrollArea>
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: C.surface, border: "1px solid var(--line)", borderRadius: 18, overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                <span style={{ color: C.fg2 }}><MIcon name={it[0]} size={19} /></span>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 500 }}>{it[1]}</span>
                <MIcon name="chevron-right" size={18} color="var(--fg-3)" />
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </React.Fragment>
  );
}

function ReviewScreen({ d, onBack, onApprove }) {
  const pct = d.drop;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.page }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* hero */}
        <div style={{ height: 230, position: "relative", background: d.grad }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,24,19,.6), transparent 60%)" }} />
          <button onClick={onBack} style={{ position: "absolute", top: STATUS_PAD, left: 16, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.92)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.ink }}><MIcon name="arrow-left" size={20} /></button>
          <span style={{ position: "absolute", top: STATUS_PAD, right: 16 }}><ScoreDot s={d.score} size={44} /></span>
          <div style={{ position: "absolute", left: 20, bottom: 16, color: "#fff" }}>
            <div style={{ fontFamily: C.fmono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", opacity: .92 }}>{d.template}</div>
            <div style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 30, marginTop: 4, textShadow: "0 1px 8px rgba(0,0,0,.4)" }}>{d.place}, {d.country}</div>
          </div>
        </div>

        <div style={{ padding: "18px 20px 24px" }}>
          {/* meta */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
            {[`${d.from} → ${d.to}`, d.dates, d.legs, d.airline].map((m, i) => (
              <span key={i} style={{ fontFamily: C.fmono, fontSize: 11, textTransform: "uppercase", color: C.fg2, background: "var(--bg-sunken)", padding: "5px 9px", borderRadius: 6 }}>{m}</span>
            ))}
          </div>

          {/* price vs baseline */}
          <div style={{ background: C.surface, border: "1px solid var(--line)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><b>Price vs baseline</b><span style={{ color: C.fg2 }}>median €{d.usual}</span></div>
            <div style={{ height: 12, borderRadius: 999, background: "var(--sand-150)", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, background: C.sea, width: `${100 - pct}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 28, letterSpacing: "-.03em" }}>€{d.price}</span>
              <span style={{ fontFamily: C.fmono, fontSize: 12, color: C.sea700, fontWeight: 700, alignSelf: "flex-end" }}>{pct}% below usual</span>
            </div>
          </div>

          {/* why */}
          <div style={{ fontFamily: C.fmono, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: C.sea700, marginBottom: 11 }}>Why Yip suggests it</div>
          {d.why.map(([ic, t], i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 11, fontSize: 15, lineHeight: 1.4 }}><MIcon name={ic} size={18} color={C.sea} style={{ marginTop: 1 }} />{t}</div>
          ))}

          {/* caveats */}
          <div style={{ fontFamily: C.fmono, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sand-500)", margin: "20px 0 11px" }}>Caveats to disclose</div>
          {d.caveats.map(([ic, t], i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 11, fontSize: 15, lineHeight: 1.4 }}><MIcon name={ic} size={17} color="var(--amber-600)" style={{ marginTop: 1 }} />{t}</div>
          ))}

          {/* suggested headline */}
          <div style={{ background: "var(--amber-50)", borderRadius: 14, padding: "14px 16px", marginTop: 18, display: "flex", gap: 11 }}>
            <MIcon name="sparkles" size={18} color="var(--amber-600)" style={{ marginTop: 2 }} />
            <div><div style={{ fontSize: 12, fontWeight: 700, color: C.amber700, marginBottom: 3 }}>SUGGESTED HEADLINE</div><div style={{ fontSize: 15, lineHeight: 1.4, color: "var(--sand-800)" }}>{d.headline}</div></div>
          </div>
        </div>
      </div>

      {/* sticky action bar */}
      <div style={{ flex: "none", borderTop: "1px solid var(--line)", background: C.surface, padding: "12px 16px", paddingBottom: 28, display: "flex", gap: 10, alignItems: "center" }}>
        <button title="Reject" style={{ width: 54, height: 54, flex: "none", borderRadius: 16, border: "none", background: "var(--coral-50)", color: C.coral, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><MIcon name="x" size={22} /></button>
        <button title="Recheck" style={{ width: 54, height: 54, flex: "none", borderRadius: 16, border: "none", background: "var(--bg-sunken)", color: C.fg2, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><MIcon name="rotate-cw" size={21} /></button>
        <button onClick={onApprove} style={{ flex: 1, height: 54, borderRadius: 16, border: "none", background: C.amber, color: "var(--fg-on-amber)", fontWeight: 700, fontSize: 16.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "var(--shadow-amber)", cursor: "pointer" }}><MIcon name="check" size={20} /> Approve &amp; publish</button>
      </div>
    </div>
  );
}

function ApproveSheet({ d, onClose, onPublish }) {
  const [vis, setVis] = React.useState(0);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(28,24,19,.45)" }} />
      <div style={{ position: "relative", background: C.surface, borderRadius: "26px 26px 0 0", padding: "10px 20px 30px", animation: "sheetUp .28s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: "var(--sand-300)", margin: "0 auto 16px" }} />
        <div style={{ fontFamily: C.fdisp, fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", marginBottom: 4 }}>Publish this deal?</div>
        <div style={{ fontSize: 14, color: C.fg2, marginBottom: 18 }}>{d.place}, {d.country} · €{d.price} return · matched {d.template}.</div>

        <div style={{ fontFamily: C.fmono, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: C.fg3, marginBottom: 8 }}>Visibility</div>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-sunken)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {["Public", "Newsletter", "Premium"].map((v, i) => (
            <button key={v} onClick={() => setVis(i)} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", background: vis === i ? C.surface : "transparent", color: vis === i ? C.ink : C.fg2, boxShadow: vis === i ? "var(--shadow-xs)" : "none" }}>{v}</button>
          ))}
        </div>

        <button onClick={onPublish} style={{ width: "100%", borderRadius: 14, border: "none", background: C.amber, color: "var(--fg-on-amber)", fontWeight: 700, fontSize: 17, padding: "15px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "var(--shadow-amber)" }}><MIcon name="send" size={18} /> Publish now</button>
        <button onClick={onClose} style={{ width: "100%", borderRadius: 14, border: "none", background: "transparent", color: C.fg2, fontWeight: 600, fontSize: 15, padding: "12px 0", marginTop: 4 }}>Save as draft instead</button>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [["today", "home", "Today"], ["queue", "inbox", "Queue", 7], ["published", "send", "Live"], ["profile", "user", "You"]];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30, paddingBottom: 22, paddingTop: 8, background: "rgba(251,246,236,.92)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--line-soft)", display: "flex" }}>
      {tabs.map(([key, icon, label, badge]) => {
        const on = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, border: "none", background: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: on ? C.amber700 : C.fg3, position: "relative" }}>
            <span style={{ position: "relative" }}>
              <MIcon name={icon} size={23} sw={on ? 2.4 : 2} />
              {badge && <span style={{ position: "absolute", top: -5, right: -9, background: C.coral, color: "#fff", fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badge}</span>}
            </span>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function App() {
  const [tab, setTab] = React.useState("today");
  const [review, setReview] = React.useState(null);
  const [sheet, setSheet] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const publish = () => {
    setSheet(false); const d = review; setReview(null); setTab("published");
    setToast(`“${d.place}, ${d.country}” is live`);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <IOSDevice>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: C.page }}>
        {review ? (
          <ReviewScreen d={review} onBack={() => setReview(null)} onApprove={() => setSheet(true)} />
        ) : (
          <React.Fragment>
            {tab === "today" && <TodayScreen onOpen={setReview} />}
            {tab === "queue" && <QueueScreen onOpen={setReview} />}
            {tab === "published" && <PublishedScreen />}
            {tab === "profile" && <ProfileScreen />}
            <TabBar tab={tab} setTab={setTab} />
          </React.Fragment>
        )}
        {sheet && review && <ApproveSheet d={review} onClose={() => setSheet(false)} onPublish={publish} />}
        {toast && (
          <div style={{ position: "absolute", left: 20, right: 20, bottom: 104, zIndex: 55, background: "var(--sand-900)", color: "var(--sand-50)", padding: "13px 18px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-lg)" }}>
            <MIcon name="check-circle" size={18} color="var(--sea-300)" /> {toast}
          </div>
        )}
      </div>
    </IOSDevice>
  );
}

const style = document.createElement("style");
style.textContent = "@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}";
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
