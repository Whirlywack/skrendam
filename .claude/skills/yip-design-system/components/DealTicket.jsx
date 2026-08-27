// DealTicket — the signature Yip boarding-pass deal card, exported for consumers.
// Self-contained: inline styles + tokens from styles.css (link it on the page).
export function DealTicket({
  place = "Larnaca", country = "Cyprus", origin = "Vilnius",
  from = "VNO", to = "LCA", dates = "14–21 Oct", legs = "Direct · 4h",
  airline = "Wizz Air", price = 59, usual = 102,
  headline = "Sun's still out — and the crowds have gone",
  eyebrow = "Last warm week",
  gradient = "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
  hot = false, ctaLabel = "See deal", onSee,
}) {
  const pct = usual > price ? Math.round((1 - price / usual) * 100) : 0;
  const mono = { fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase" };
  const disp = { fontFamily: "var(--font-display, sans-serif)" };
  return (
    <article style={{ background: "var(--bg-surface, #fff)", borderRadius: 20, boxShadow: "var(--shadow-sm, 0 2px 6px rgba(28,24,19,.07))", overflow: "hidden", fontFamily: "var(--font-body, sans-serif)", color: "var(--fg-1, #1C1813)", maxWidth: 420 }}>
      <div style={{ height: 150, position: "relative", background: gradient }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,24,19,.55), transparent 58%)" }}></div>
        {hot && <span style={{ position: "absolute", top: 11, right: 11, background: "var(--coral-500, #D63E22)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999 }}>Going fast</span>}
        <div style={{ position: "absolute", left: 15, right: 15, bottom: 12, color: "#fff" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: ".1em", textShadow: "0 1px 4px rgba(0,0,0,.4)" }}>{eyebrow}</div>
          <div style={{ ...disp, fontWeight: 700, fontSize: 24, lineHeight: 1, marginTop: 4, textShadow: "0 1px 8px rgba(0,0,0,.45)" }}>
            {place}
            <span style={{ display: "block", fontFamily: "var(--font-body, sans-serif)", fontWeight: 500, fontSize: 13, opacity: .92, marginTop: 4 }}>{country} · from {origin}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ ...mono, fontSize: 11.5, color: "var(--fg-2, #685B47)" }}>{from} → {to} · {dates} · {legs}</div>
        <div style={{ ...disp, fontWeight: 700, fontSize: 17, lineHeight: 1.2, margin: "8px 0 12px" }}>{headline}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: "1.5px dashed var(--perforation, #C8B79C)", paddingTop: 13 }}>
          <div>
            <span style={{ ...disp, fontWeight: 800, fontSize: 27, letterSpacing: "-.03em" }}>€{price}</span>
            {usual > price && <s style={{ fontWeight: 500, fontSize: 14, color: "var(--fg-3, #877860)", marginLeft: 6 }}>€{usual}</s>}
            <span style={{ display: "block", fontSize: 11, color: "var(--fg-3, #877860)", marginTop: 3 }}>return · {airline}{pct ? ` · −${pct}%` : ""}</span>
          </div>
          <button onClick={onSee} style={{ background: "var(--amber-500, #E2820E)", color: "var(--fg-on-amber, #1C1813)", border: "none", borderRadius: 12, fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 15px", cursor: "pointer", boxShadow: "var(--shadow-amber, 0 10px 28px rgba(226,130,14,.28))" }}>{ctaLabel} →</button>
        </div>
      </div>
    </article>
  );
}
