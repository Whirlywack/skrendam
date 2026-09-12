import { ImageResponse } from 'next/og';
import { S } from '@/lib/lt';

// Site-wide OG card: paper ground, the wordmark with its amber bead, the LT
// promise. Generated at request time so it never drifts from lt.ts.
export const alt = S.ogTitle;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Bricolage Grotesque 800 — the same face as the wordmark lockup (logo.css).
// Full charset (no &text= subset): Satori falls back to any loaded font for
// missing glyphs, so a subset bleeds the wordmark face into the tagline.
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800';

async function wordmarkFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(FONT_CSS, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
    const url = css.match(/src: url\(([^)]+)\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null; // ponytail: system fallback beats a 500 on every share preview
  }
}

export default async function Image() {
  const font = await wordmarkFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: 72, background: '#FBF6EC', color: '#1C1813',
          fontFamily: font ? 'Bricolage' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 160, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>yıp</span>
          <span style={{ width: 28, height: 28, borderRadius: 14, background: '#E2820E', marginLeft: -104, marginTop: 6 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>
            Pigūs skrydžiai iš Vilniaus, Kauno ir Rygos — atrinkti žmogaus.
          </div>
          <div style={{ fontSize: 28, color: '#5C320F' }}>
            {`${S.humanStamp} · yip.lt`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Bricolage', data: font, weight: 800, style: 'normal' }] : [],
    },
  );
}
