---
name: yip-design-system
description: Use this skill to generate well-branded interfaces and assets for Yip, the curated Baltic flight-deals platform — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file in this skill first — it holds the brand context, content fundamentals,
visual foundations, and iconography. Then explore the other files:

**Two design directions live here.** Default to **V2 — "Poster & Bead"** (the newer, award-level direction) unless the user asks for the v1 product look:
- V2 foundations: `v2/poster-bead.css` (loads on top of `colors_and_type.css`) — travel-poster duotones, fluid display scale (--d-hero … --d-quote), the amber-bead atom (.bead, .bead--live, .bead-route, .bead-loader), the human-checked stamp (.v2-stamp), ink-inverting index rows (.v2-row).
- V2 canonical example: `screens/v2-home.html` — copy its patterns (poster hero, issue kickers, editorial index, curator pull-quote, ink signup band).
- V2 rules: destinations as duotone posters (no photos needed), huge condensed uppercase names, editorial “Issue №” rhythm, the bead as the ONLY accent atom (bullet, loader, route dot, hover cue), tasteful micro-interactions only.

- `styles.css` — link this ONE file to get the whole system (tokens + logo + imagery + v2). Individual sheets: `colors_and_type.css`, `assets/logo.css`, `assets/imagery.css`, `v2/poster-bead.css`.
- `assets/` — wordmark (`logo.css` lockup + `yip-logo.svg`), brand motifs, and `imagery.css` (photo treatment classes).
- `preview/` — small specimen cards illustrating each part of the system.
- `ui_kits/website/` — public deal-browsing site (React components + `index.html`).
- `ui_kits/curator/` — internal curation tool (React components + `index.html`).

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static
HTML files for the user to view — link `colors_and_type.css` and `assets/logo.css`, use the Wordmark
lockup (`<span class="yip-logo">yıp</span>`, note the dotless ı), and pull components from the UI kits.
If working on production code, copy assets and apply the rules here to design fluently in the brand.

Quick brand reminders:
- Warm **amber** primary on **cream** paper; **sea-teal** for trust/links/success; **coral** only for urgency.
- Type: Bricolage Grotesque (display), Hanken Grotesk (body), Space Mono (ticket metadata). Google Fonts.
- Icons: **Lucide** (stroke). Emoji only in newsletter/TikTok copy.
- Signature motif: **boarding-pass / ticket** deal cards (perforation, notch, mono metadata).
- **Imagery:** select warm photos, then apply one `.yip-photo` treatment (`--protect` default for text, `--warm` to unify temperature, `--duotone` for editorial headers). Text/CTA always over a protection gradient. See `assets/imagery.css`.
- **Lithuanian:** all three fonts support the full diacritic set — copy ships in LT or EN, no font change.
- Voice: a clued-in local friend. Sentence case, numbers first, always show the catch. Trust > hype.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask a
few focused questions, and act as an expert Yip designer who outputs HTML artifacts or production code,
depending on the need.
