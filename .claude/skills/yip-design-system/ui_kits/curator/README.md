# Yip — Curator Tool UI Kit (internal)

A high-fidelity, click-through recreation of the **internal curation tool**: the scanner surfaces
candidate deals, the curator reviews them, drafts copy (with AI assistance), and **approves before
anything goes public**. Original proposed design built from the brief.

## Run it
Open `index.html`. Single-page React app (React 18 + Babel via CDN), Lucide icons.

## What it demonstrates
- **Sidebar** — wordmark + "Curator" tag, nav (Queue has an unread badge), curator profile.
- **Scan banner** — live status: when the scanner last ran, fares checked, airports, new candidates. "Re-scan now".
- **Deal queue** — candidate rows with a **confidence score** badge (sea = strong, amber = medium, sand = weak), thumbnail, route, suggested **template** chip, price drop, price, and **status** (Suggested / In review / Rejected / Published). Tabs filter by status.
- **Composer drawer** (click any row):
  - Deal facts as ticket pills.
  - **Why the scanner flagged it** — the signals that earned the score.
  - **Caveats to disclose** — honesty is a feature; flags surface here.
  - **Copy drafter** — tabbed **Headline / TikTok hook / Newsletter**. Headlines are pickable AI suggestions; hook & newsletter are editable drafts with char counts and "regenerate". (Emoji are intentionally allowed here — per brand rules they're fine in TikTok/newsletter copy only.)
  - **Publish bar** — Reject · Schedule · **Approve & publish** (the required human approval step).
- **Approve flow** — publishing moves the deal to *Published* and fires a confirmation toast.

## Files
| File | Role |
|---|---|
| `index.html` | Shell + script loading |
| `data.js` | `window.YIP_CANDIDATES` + `YIP_SCAN` |
| `Icon.jsx` | `Icon` (Lucide) + `Wordmark` |
| `Sidebar.jsx` | Left nav |
| `Queue.jsx` | `Topbar`, `Queue`, `QueueRow`, `ScoreBadge` |
| `Composer.jsx` | Review + copy-drafter drawer |
| `App.jsx` | State, filtering, publish/toast |
| `curator.css` | Kit styles (tokens from `/colors_and_type.css`) |

## Notes
- Denser than the public site (it's a working tool), but same warm palette + ticket motifs.
- "AI" suggestions are canned strings — the kit shows the *interaction*, not a real model.
- Component code is cosmetic/simplified; it's a kit, not production.
