/**
 * ProcessBand — ".how" teal band with 4-step process.
 *
 * Uses raw inline SVG icons matching the mockup exactly (no Lucide
 * dependency required — the mockup uses simple path/circle SVGs).
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 226–235)
 */
export function ProcessBand() {
  return (
    <div className="how" id="how">
      <div className="eyebrow">How Yip works</div>
      <div className="sec-h">No search engine. Just the good ones.</div>

      <div className="proc">
        {/* Step 1: Find */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
          </div>
          <h4>Find</h4>
          <p>We track every fare from VNO/KUN/RIX for real anomalies.</p>
        </div>

        {/* Step 2: Check */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h4>Check</h4>
          <p>A human verifies it&apos;s real and still bookable.</p>
        </div>

        {/* Step 3: Explain the catch */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
          </div>
          <h4>Explain the catch</h4>
          <p>Layovers, self-transfer — honestly.</p>
        </div>

        {/* Step 4: Send */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </div>
          <h4>Send</h4>
          <p>To your inbox — you book direct.</p>
        </div>
      </div>
    </div>
  );
}
