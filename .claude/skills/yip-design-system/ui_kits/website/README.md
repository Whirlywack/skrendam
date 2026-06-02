# Yip — Public Website UI Kit

A high-fidelity, click-through recreation of the **public deal-browsing experience**. This is an
original proposed design (built from the brief), not a recreation of an existing site.

## Run it
Open `index.html`. It's a single-page React app (React 18 + Babel, loaded from CDN). Lucide for icons.

## What it demonstrates
- **Header** — sticky, translucent (cream + backdrop-blur), wordmark, nav, departure pill, primary CTA.
- **Hero** — the core promise + inline email signup (submits to an inline confirmation state).
- **Filter bar** — departure airport + "mood" chips; filtering is live and drives the grid (try Christmas / Last-minute, or Vilnius / Kaunas / Riga).
- **Deal grid** — the signature **boarding-pass deal cards** (warm placeholder, eyebrow, route meta, why-good chips, perforated ticket foot with notches, price + saving). Hover lifts the card and zooms the image.
- **Deal detail** — click any card: full overlay with route, **Why it's good** vs **The catch** columns, a **curator's note**, and an external **Book on {airline}** CTA. Esc or scrim closes it.
- **Signup band** + **ink footer** with the reversed wordmark.

## Files
| File | Role |
|---|---|
| `index.html` | App shell + script loading |
| `data.js` | `window.YIP_DEALS` sample deals + filter taxonomies |
| `Icon.jsx` | `Icon` (Lucide wrapper, renders SVG imperatively) + `Wordmark` |
| `Header.jsx` | Sticky header |
| `Sections.jsx` | `SignupForm`, `Hero`, `FilterBar`, `SignupBand`, `Footer` |
| `DealCard.jsx` | `DealCard` + `DealGrid` (incl. empty state) |
| `DealDetail.jsx` | Deal detail overlay |
| `App.jsx` | State + composition |
| `website.css` | Kit styles (tokens come from `/colors_and_type.css`) |

## Notes / placeholders
- Destination imagery uses **warm duotone gradient placeholders**. Replace with real warm-toned travel photography (these are where photos go).
- Component code is intentionally cosmetic/simplified — it's a kit, not production.
- Cross-file components share scope via `Object.assign(window, {...})` (required by the Babel multi-file setup).
