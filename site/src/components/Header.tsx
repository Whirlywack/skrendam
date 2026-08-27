export function Header() {
  return (
    <header className="hdr">
      <span className="wm">yıp</span>
      <nav aria-label="Site">
        <a href="/">Deals</a>
        <a href="/collections">Collections</a>
        {/* "Past fares" returns to the nav once real expired deals exist —
            a proof page with zero proof converts worse than no link (audit 08-28) */}
        <a href="/#how">How it works</a>
      </nav>
      <span className="sp" />
      <span className="frompill">From VNO · KUN · RIX</span>
    </header>
  );
}
