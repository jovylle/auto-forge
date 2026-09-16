# Slab Serif Speedway 🏁🌴

Race **variable slab-serif fonts** around a vaporwave drag strip — speed warps `wght` and width **live**.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` then open `http://localhost:8000/`.
- Works from `file://`. Google Fonts `@import` needs network for the full variable axes; falls back to serif offline.

## What it does
- **Font-fueled racing controls** — pick a driver (MEGA / CHROME / TURBO / NEON), set throttle, hit BOOST (Space), and **type-to-fuel**: keystrokes refill ink and spike your racer's weight.
- **Live variable weight morphing** — each racer's `font-variation-settings: "wght"` follows speed (thin cruise → black 900 at full send); width morphs via `font-stretch` + `scaleX` skew, with a live `wght/wd/km-h` readout per lane.
- **Photo-finish type posters** — canvas-rendered vaporwave poster (sun, grid, chrome title, final standings with baked-in weights). Render toggles, download PNG, copy results.
- **Shareable race replays** — every finish mints a `#r=` link encoding seed + driver + order; opening it ghost-replays the exact race. Archive persists in `localStorage`.

## Scroll constraint
Scrolling **charges the slipstream meter** (scroll velocity → boost for all racers), parallaxes the sun, and — with `SCROLL = THROTTLE` on — overdrives your racer. Scrolling hard even auto-starts the grid.

## Files
`index.html` · `style.css` · `app.js` — no build, no backend, no npm.
