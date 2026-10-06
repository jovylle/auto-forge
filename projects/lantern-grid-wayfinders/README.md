# Lantern Grid Wayfinders

Chart glowing trails across shifting districts to reconnect 12 scattered lantern outposts. A retro-wave hex wayfinding rite.

## How to open

No build, no server needed. Either:

- Open `index.html` directly in a browser (`file://` works), or
- Serve statically, e.g. `python3 -m http.server` in this folder, then visit the URL.

## What it does

- **Drag routes across hex districts** — press + drag (mouse or touch) starting on a lit lantern, chain through adjacent hexes (max 14 charge), release on or next to a dim outpost to relight it. Chain outward from lit lanterns; backtrack along your draft to undo a step.
- **Dodge fog that rewrites tiles** — fog crawls every 5s (clearing old tiles and growing along its edges), eats in-progress drafts, blocks routing, and permanently rewrites a cleared tile's district. Committed lit rails repel fog forever. Districts visibly shift every 8s.
- **Relight 12 outposts to win** — HUD tracks lanterns lit / fog / night time / trail charge; the Night Log narrates each relighting; victory overlay records your fastest dawn. Progress autosaves to `localStorage` and resumes on reload.
- Extras: WebAudio bleeps (mutable, no assets), new-map reshuffle, best-night record, animated retro sun + scrolling floor grid + scanlines, full 375px-mobile layout.

## Easter egg

Click the retro sun 5 times — or type the old code `↑↑↓↓←→←→BA` — to engage **NIGHT DRIVE**. (The footer hums about both.)

## Constraints honored

- 3 colors max + black/white: neon magenta `#ff2e88`, electric cyan `#22e6ff`, sunset amber `#ffb02e` on night black `#0b0714` / signal white `#fff6ec` (all glows are alpha blends of these).
- Single-file-ish: `index.html` + `style.css` + `app.js` only (plus this README). Google Fonts `@import` for Orbitron + Space Mono.
