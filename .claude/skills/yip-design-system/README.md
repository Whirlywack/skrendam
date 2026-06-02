# Yip — Design System

> **Yip** is a curated flight-deals platform for Lithuania and the nearby Baltics.
> *"We find the best cheap flights from Lithuania and nearby airports, so you don't have to."*

Yip is **not** a flight search engine. Users don't pick routes and dates. A human curator (helped by an internal tool) finds genuinely good deals from **Vilnius, Kaunas, Riga** and nearby airports, checks them, and publishes the best ones to the website and email newsletter. The feeling is a **smart local travel club**, not a booking engine.

---

## ⚠️ Provenance & status

This system was built **from a written product brief only** — no codebase, Figma file, or existing brand assets were provided. Everything here (palette, type pairing, wordmark, motifs, UI kits) is an **original proposed identity** for Yip, not a recreation of an existing product.

**Substitutions / things to confirm with the team:**
- **Fonts** are linked from Google Fonts (Bricolage Grotesque, Hanken Grotesk, Space Mono) — free/open licence. No brand fonts were supplied. Swap if Yip has licensed fonts. Offline `.ttf` files are *not* bundled (CDN only). ✅ **Lithuanian-ready** — all three fonts render the full diacritic set (ą č ę ė į š ų ū ž); see `preview/type-lithuanian.html`.
- **Logo / wordmark** is a proposed typographic mark — there is no existing Yip logo to copy.
- **Destination photography** is represented with warm duotone placeholder treatments. Real, warm-toned travel photography should replace these. ✅ A full **imagery treatment system** now exists — see the IMAGERY section, `assets/imagery.css`, and the live demo `Imagery — drop a photo.html`.
- **Icons** use [Lucide](https://lucide.dev) via CDN — a clean, friendly stroke set. No proprietary icon set existed to copy.

---

## The products

Yip is two surfaces sharing one brand:

| Surface | Who | What | UI kit |
|---|---|---|---|
| **Public website + newsletter** | Travelers | Browse curated deals, understand *why* each is good + its caveats, click out to book, subscribe by email | `ui_kits/website/` |
| **Curator tool (internal)** | The Yip curator | Scans prices, groups potential deals into templates, suggests what's worth publishing, drafts headlines / TikTok hooks / newsletter snippets — human approves before publish | `ui_kits/curator/` |

**Primary user goal:** *"Show me a good trip idea I'd never have found myself, and make it easy to subscribe for more."*
**Primary business goal:** grow an email audience around curated Baltic flight deals; later add premium alerts, segmentation, and paid membership.

---

## Brand idea

**Baltic amber.** Amber is the golden gem of the Baltic coast — warm, treasured, *found rather than searched for*. That's exactly Yip's promise: we comb through the noise and surface the gems. The palette is built on warm amber + cream, grounded by a trustworthy Baltic **sea-teal**, with **coral** reserved for genuine deal heat.

The recurring structural motif is the **boarding pass / ticket stub**: deal cards carry a perforated edge, a notch, and mono-set "ticket metadata" (route legs, dates, deal codes). It signals *travel* and *a real, checked deal* without resorting to airplane clip-art.

---

## CONTENT FUNDAMENTALS

**Voice:** a clued-in local friend who travels a lot and just texted you a deal. Warm, plain-spoken, a little excited — never salesy, never corporate, never breathless "BOOK NOW!!!" energy.

- **Person:** "We" find deals; "you" travel. ("We dug this up so you don't have to.")
- **Casing:** Sentence case everywhere — headlines, buttons, nav. **No Title Case, no ALL CAPS** except short mono eyebrows/labels (e.g. `SEPTEMBER SUN`, `DEAL #VNO-CY-204`) and tags.
- **Tone:** confident and honest. We always say *why* a deal is good **and** the catch. Trust > hype.
- **Numbers are the hero.** Lead with the price and the saving. "€59 return" beats "amazing low fares."
- **Concrete over generic.** Real moments: "Last warm week in Cyprus," "Christmas-market weekend in Vienna," "September sun, fewer crowds." Not "Explore the world."
- **Sentences are short.** Skimmable for busy people. One idea per line.
- **Emoji:** sparingly and purposefully in newsletter/TikTok-hook contexts (☀️ 🏖️ ✈️ are fine as accents). Avoid in core product UI and never as bullet points or as a substitute for icons. The brand leans on warm illustration/photography and the amber dot, not emoji.
- **Honesty markers:** caveats are a feature, shown plainly with a clear icon — "Hand luggage only," "Bus to airport," "1 stop, 2h layover."

**Examples**
- Headline: *"€59 return to Cyprus — last warm week of the year."*
- Subhead: *"Direct from Vilnius, mid-October. Sun's still 27°C and the crowds have gone home."*
- Why-good chip: *"42% under the usual fare for these dates."*
- Caveat chip: *"Hand luggage only · return lands 23:40."*
- CTA: *"See the deal"* / *"Get deals by email"*
- Newsletter subject: *"☀️ Cyprus for €59 (this won't last)"*
- Empty state: *"Nothing live right now — but we're hunting. Get the next one by email."*

---

## VISUAL FOUNDATIONS

**Colors.** Warm amber primary (`--brand` #E2820E) on a cream **paper** canvas (`--bg-page` #FBF6EC). Trust comes from Baltic **sea-teal** (`--accent` #0F7C68) used for links, the club/quality accent, and success. **Coral** (#D63E22) is rationed for genuine urgency ("going fast"). Neutrals are *warm* sand greys — never cold/blue. Text is a warm near-black ink (#1C1813). Full scales + semantic tokens live in `colors_and_type.css`.

**Type.** Display is **Bricolage Grotesque** — friendly, slightly idiosyncratic, great for headlines, prices, and hooks. Body/UI is **Hanken Grotesk** — warm humanist sans, highly readable at small sizes. **Space Mono** carries "ticket metadata": route legs, dates, deal codes, eyebrows — reinforcing the boarding-pass motif and rendering numbers with character. Headlines run tight (`-0.02em`, line-height ~1.05); body is relaxed (1.65). Eyebrows are mono, uppercase, wide-tracked, usually sea-teal. **All three fonts fully support Lithuanian** (ą č ę ė į š ų ū ž) — copy can ship in Lithuanian or English without a font change.

**Spacing.** 4px base grid. Generous, airy layouts — this is a relaxed travel club, not a dense dashboard. Cards breathe (24–32px internal padding). The internal curator tool is denser than the public site.

**Backgrounds.** Default is flat warm **cream** — no busy gradients. Dark sections use ink (#1C1813) for footers and high-contrast moments. Imagery is **warm-toned** (golden hour, sun, sea) and may be lightly **duotone'd toward amber** for cohesion. A subtle dotted **route-line** motif (origin ● ·········· ● destination) and faint perforation edges add texture — used as structure, not decoration. No noise/grain overlays, no glassmorphism walls.

**Cards.** The signature is the **deal card / ticket**: rounded (`--radius-lg` 20px), white surface, soft warm shadow (`--shadow-md`), often with a **perforated divider** and a small **notch** where the "stub" tears off (price/CTA side). Standard content cards are plain: white, 1px warm border (`--line`) *or* soft shadow (not both), 14–20px radius. **Never** the AI-slop pattern of rounded box + colored left-border-only.

**Borders & radii.** Hairline warm borders (`--line` #E0D2BA). Radii are soft and consistent: inputs/buttons ~10–14px, cards 20px, pills 999px, hero panels up to 28–36px. Tags and price badges are pills.

**Shadows.** Warm and soft, tinted with ink (never pure black). Layered scale `--shadow-xs → xl`. Amber CTAs get a faint amber glow (`--shadow-amber`) on rest, lifting on hover. Elevation = importance; most surfaces sit at sm/md.

**Hover / press.** Buttons: hover lightens/raises slightly + shadow grows; **press darkens to `*-press` token and nudges down 1px (no harsh scale)**. Cards: hover raises 2–4px with a softly larger shadow and the image gently zooms (scale 1.03). Links: sea-teal, underline on hover. Transitions use `--ease-out` at 120–200ms. Page/section reveals are gentle fades + 8–12px rise; nothing bouncy or attention-seeking on content. The amber "Yip" dot may do a tiny playful pulse on key moments only.

**Transparency & blur.** Used lightly: a translucent cream sticky header with backdrop-blur on scroll; image overlays use a bottom-up ink **protection gradient** so white text stays legible. No frosted-glass everywhere.

**Layout rules.** Sticky translucent header on the public site. Content max-width ~1200px, centered, comfortable gutters. Mobile-first deal cards (this audience skims on phones). Hit targets ≥44px. Tabular-num prices align in lists.

---

## ICONOGRAPHY

- **Library:** [**Lucide**](https://lucide.dev) (CDN: `https://unpkg.com/lucide@latest`). Clean, rounded-cap, ~2px stroke — matches the friendly-but-trustworthy tone. Used for UI affordances and for the **caveat/why-good system** (e.g. `luggage`, `plane`, `clock`, `bus`, `sun`, `snowflake`, `bell`, `mail`, `check`, `info`, `arrow-right`, `map-pin`).
- **Style rules:** stroke icons only (no filled/duotone mixing), default 1.75–2px stroke, sized 16/20/24. Icons inherit `currentColor`; tint sea-teal for "why good," amber for warnings, coral for urgency, `--fg-2` for neutral UI.
- **Emoji:** allowed *only* in newsletter subject lines and TikTok hooks as warm accents (☀️🏖️✈️🎄). Never inside product UI, never as bullets or icon substitutes.
- **Unicode as icons:** avoid, except the route motif's middle dot `·` and the amber bullet `●` in the wordmark.
- **Logo:** proposed typographic wordmark **`yip`** in Bricolage Grotesque with an amber dot on the "i". See `assets/`. No existing mark to copy — confirm with team.

---

## IMAGERY

Photography is central to the FOMO promise — palm trees, crystal water, golden-hour city breaks. The job of the system is to make **mixed sources (stock, generated, partner, user) feel like one brand** and keep text legible on top. Rules + classes live in `assets/imagery.css`; the live demo is `Imagery — drop a photo.html`.

**1. Select warm.** Before any treatment, choose warm imagery: golden hour, sun, sea, warm stone, blue water under a warm sky. Avoid grey, flat, or cold-blue-cast photos. This single habit does most of the cohesion work.

**2. Apply one treatment** (`.yip-photo` container + a modifier):
- **`--protect` · Natural + protection** — the *default* for any photo carrying text. An ink protection gradient rises from the bottom so white display headlines + the amber CTA stay legible. This is the deal-card and hero recipe.
- **`--warm` · Warm wash** — a ~14% amber multiply that nudges cooler photos toward the brand temperature, so a grey Vienna sky and a turquoise Cyprus sea feel related in the same feed. Should be barely perceptible.
- **`--duotone` · Amber duotone** — maps *any* photo to a warm amber→coral monochrome (grayscale + sepia/hue-rotate + a multiply overlay). The editorial option for section headers, category tiles, and dark sections — it makes even off-brand stock unmistakably Yip. Use sparingly; never on the primary deal photo (people want to see the real place).

**3. Pairing rules.** White display type and the amber CTA always sit *on top of* a protection gradient — never directly on raw photo. Corner radius matches the surface (`--radius-lg` 20px for cards/heroes). No grain, no heavy filters beyond the three above, no glassmorphism over photos. Generated images follow the same rules: prompt for warm light + the destination, then run it through a treatment.

**Generation guidance (if producing images):** ask for *warm, sunny, golden-hour* scenes of the specific destination (e.g. "late-afternoon sun over Larnaca seafront, warm light, inviting, no text"), landscape framing with breathing room at the bottom for the protection gradient + caption. Keep people aspirational but real, not stocky.

---

## INDEX — what's in this system

**Root**
- `README.md` — this file: context, content + visual foundations, iconography, index.
- `SKILL.md` — Agent-Skill manifest (works in Claude Code).
- `colors_and_type.css` — all color scales, semantic tokens, type, spacing, radii, shadows, motion.

**`assets/`** — `logo.css` (canonical wordmark lockup, font-based, scales via `font-size`), `yip-logo.svg` (inline-use mark), and `imagery.css` (photo treatment classes). Use `<span class="yip-logo">yıp</span>` — note the dotless ı.

**Root demo** — `Imagery — drop a photo.html`: interactive: drop a real destination photo and see it as a Yip hero with live treatment toggles.

**`preview/`** — small specimen cards that populate the Design System tab (colors, type, spacing, components, brand).

**`ui_kits/`**
- `website/` — public deal-browsing site: `index.html` + JSX components (header, deal cards, deal detail, signup, footer).
- `curator/` — internal curation tool: `index.html` + JSX components (deal queue, suggestion cards, copy drafter, approve flow).

*(No slide template was provided, so no `slides/` were created.)*
