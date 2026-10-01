# Zephyr Zine Machine

Print zines on the west wind. A cyberpunk wind-powered zine press — catch a gust, load a template, slam the press.

## Open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000`

Works from `file://` — no build, no backend. Google Fonts `@import` needs internet; the app works offline with fallback monospace.

## What it does

- **01 · Wind press** — click **CATCH GUST** to harvest a gust (speed in knots, west-sector direction, named storm). The needle gauge, pressure bar, and masthead readout update. Last 5 gusts become chips — click one to reload it.
- **02 · Zine templates** — 4 click-to-load templates: `NEON PROPHECY` (manifesto), `SECTOR-7 MAP` (smuggler grid), `STATIC VERSE` (cut-up poem), `WANTED: SIGNAL` (bounty poster). Every print is generated from a seeded RNG, so each issue is unique.
- **03 · Gust print** — click **SLAM THE PRESS** for a press-slam animation and a freshly composed issue. Wind strength warps the ink (clean → light static → total whiteout). `re-roll ink` reshuffles the text; `paper print` opens the OS print dialog (print CSS isolates the zine page).
- **Print shelf** — issues auto-archive to `localStorage` (click any entry to re-hang it). Two-click pulp button clears the shelf.

## Constraint

**Click-only.** There are no text fields, no draggable elements, no keyboard shortcuts — every interaction is a `click` event on a `<button>`. Ambient animation (ticker, wind lines, clock) is non-interactive.

## Files

`index.html` · `style.css` · `app.js`
