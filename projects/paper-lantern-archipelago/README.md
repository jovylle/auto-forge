# Paper Lantern Archipelago

> Chart drifting islands, trade lantern-light, and map shifting shoals before tide erases routes.

A pop-art 30-second sailing sprint. Plain HTML + CSS + JS, no build, no backend.

## How to open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder → open `http://localhost:8000`

Works from `file://` and any static host. Google Fonts `@import` needs internet; the game plays fine offline with fallback fonts.

## What it does

- **Procedural island grid** — fresh 6×6 chart every round (seeded RNG): home 🏮 island, 3 trade islands (rose/azure/gold), palm isles, reefs, and tide-gated shoals.
- **Lantern trade routes** — sail onto each 🏮 island to light it; a glowing animated route (home → island) is drawn on the chart. Light all 3 to win.
- **Tide-shifted navigation** — tide cycles LOW → RISING → HIGH → EBB every 9s. Pale shoals are passable only at RISING/HIGH tide; reefs never. Plan shortcuts around the tide clock.
- **Hand-drawn fog reveal** — dark sketch cover with wobbly hand-drawn reveal rings; sailing reveals nearby waters, tracked as "% charted".

## Controls

- Tap/click a glowing neighbor cell to sail (orthogonal moves only).
- Keyboard: WASD / arrows, Enter to restart.
- 🎲 NEW CHART reshuffles, 🔊 toggles blips. Best time persists in `localStorage`.

A round lasts 45s on the tide-clock but is winnable in ~20–30s — playable in 30 seconds.
