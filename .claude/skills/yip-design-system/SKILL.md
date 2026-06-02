---
name: yip-design-system
description: The brand and UI design system for Yip / Skrendam — the curated Baltic flight-deals platform. Use this skill whenever building, designing, styling, or writing copy for ANY user-facing surface of this project: the internal curator / Deal Desk tool, the public deals website, deal cards, email & newsletter templates, TikTok/landing visuals, React or Next.js components, HTML mockups and prototypes, or any frontend. It supplies the colors, typography, spacing, components (the signature boarding-pass deal card), iconography, imagery treatment, brand voice/copy rules, and ready-made React UI kits for both surfaces. Invoke it proactively for any UI, component, layout, styling, theming, branding, or product-copy task on this project — even if the user doesn't say "design" or "brand." Do not hand-roll styles or invent visuals/voice for Yip without consulting this skill first.
user-invocable: true
---

# Yip / Skrendam Design System

Yip is a **curated flight-deals platform for Lithuania and the nearby Baltics** — *"we find the best cheap flights from Vilnius, Kaunas, Riga and nearby airports, so you don't have to."* It is **not** a search engine: a human curator (helped by the internal tool) finds and checks deals, then publishes the best to the website and newsletter. The feeling is a **smart local travel club**, not a booking engine.

This skill is the single source of truth for how everything Yip should look, feel, and read. Use it for production code *and* throwaway mocks.

## Read these, in this order

1. **`README.md`** — read this first, always. Brand idea (Baltic amber + boarding-pass motif), full **content fundamentals** (voice, casing, examples), **visual foundations** (color/type/spacing/cards/shadows/motion/layout), **iconography**, and **imagery** rules. Everything below is a summary of it.
2. **`colors_and_type.css`** — every design token: color scales + semantic vars, type families/scale/roles, spacing, radii, shadows, motion. **Link or copy this into any artifact** rather than redefining values.
3. **`assets/`** — `logo.css` (the wordmark lockup, font-based), `yip-logo.svg` (inline mark), `imagery.css` (the `.yip-photo` photo-treatment classes).
4. **`preview/`** — small specimen cards illustrating each part of the system (colors, type, spacing, components, brand). Open these when you need to see a part rendered.
5. **`ui_kits/`** — production-shaped React components you should reuse/adapt rather than build from scratch:
   - **`ui_kits/curator/`** — the **internal curator / Deal Desk tool** (sidebar, deal queue, composer/approve flow). This is the UI for the curator admin (Plan 2).
   - **`ui_kits/website/`** — the **public deal-browsing site** (header, deal cards, deal detail, signup, sections).
6. **`Imagery - drop a photo.html`** — interactive demo of the imagery treatments.

## How to apply it

- **Production code (e.g. the Next.js curator admin / website):** copy `colors_and_type.css` and `assets/` into the app, then design fluently in the brand — reuse the matching `ui_kits/` components as the starting point. Match the existing tokens; don't invent new colors, fonts, radii, or shadows.
- **Mocks / prototypes / slides:** create static HTML that links `colors_and_type.css` + `assets/logo.css`, use the wordmark lockup `<span class="yip-logo">yıp</span>` (note the dotless **ı**), and pull components from the UI kits.

## Quick brand reminders

- **Color:** warm **amber** primary (`--brand`) on **cream** paper (`--bg-page`); **sea-teal** (`--accent`) for trust/links/success/quality; **coral** only for genuine urgency ("going fast"). Neutrals are *warm* sand greys, never cold blue. Reach for **semantic tokens**, not raw scale values.
- **Type:** **Bricolage Grotesque** (display/headlines/prices), **Hanken Grotesk** (body/UI), **Space Mono** (ticket metadata — routes, dates, deal codes, eyebrows). All three fully support Lithuanian diacritics, so copy ships in LT or EN with no font change.
- **Signature component:** the **boarding-pass / ticket deal card** — perforated divider, a notch where the stub tears off, mono "ticket metadata." Use it for deals; don't resort to airplane clip-art.
- **Icons:** **Lucide** stroke icons (`currentColor`, ~1.75–2px, sizes 16/20/24). Tint sea-teal for "why good," amber for warnings, coral for urgency. **Emoji only** in newsletter subjects / TikTok hooks — never in product UI or as icon substitutes.
- **Imagery:** pick **warm** photos (golden hour, sun, sea), then apply one `.yip-photo` treatment — `--protect` (default, for any photo carrying text), `--warm` (unify temperature), or `--duotone` (editorial headers). Text/CTA always sits on a protection gradient, never raw photo.
- **Voice:** a clued-in local friend who just texted you a deal. **Sentence case** everywhere (mono eyebrows/labels may be UPPERCASE). **Numbers are the hero** ("€59 return" beats "amazing fares"). Always show *why* it's good **and** the catch — trust > hype. Short, skimmable lines.

## When invoked without specifics

Ask what surface they're building (curator tool, website, deal card, email, mock…), read `README.md` + the relevant `ui_kits/` folder, then act as an expert Yip designer — output brand-faithful production code or HTML artifacts as appropriate.
