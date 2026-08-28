/**
 * ProcessBand — ".how" teal band with 4-step process.
 *
 * Uses raw inline SVG icons matching the mockup exactly (no Lucide
 * dependency required — the mockup uses simple path/circle SVGs).
 *
 * Source of truth: site/design-reference/homepage-v2.html (line 226–235)
 */
import { S } from '@/lib/lt';

export function ProcessBand() {
  return (
    <div className="how" id="how">
      <div className="eyebrow">{S.howEyebrow}</div>
      <div className="sec-h">{S.howHeader}</div>

      <div className="proc">
        {/* Step 1: Randam */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
          </div>
          <h4>{S.howFindTitle}</h4>
          <p>{S.howFindBody}</p>
        </div>

        {/* Step 2: Tikrinam */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h4>{S.howCheckTitle}</h4>
          <p>{S.howCheckBody}</p>
        </div>

        {/* Step 3: Pasakom kabliuką */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
          </div>
          <h4>{S.howCatchTitle}</h4>
          <p>{S.howCatchBody}</p>
        </div>

        {/* Step 4: Siunčiam */}
        <div className="pstep">
          <div className="ic">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </div>
          <h4>{S.howSendTitle}</h4>
          <p>{S.howSendBody}</p>
        </div>
      </div>
    </div>
  );
}
