# Woad Ibis Works

> Dye the river blue with ibis flight paths.

A neo-brutalist river viz: release ibis flocks, their flight paths deposit
pigment dye into a flowing river canvas, then export the result.

## How to open

No build, no server needed — works from `file://`:

1. Open `index.html` in any modern browser, **or**
2. Serve statically: `npx serve .` / `python3 -m http.server` and visit the page.

## What it does

- **Flight dye (02)** — pick one of 3 pigments (WOAD `#2447F9`, IBIS RUST
  `#FF4D00`, REED GOLD `#FFD02B`). Every ibis carries the selected dye and
  drops it while crossing the river. Live recipe bar shows the mix ratio.
- **River canvas (01)** — animated canvas river with flow streaks, banks,
  wind, gusts and flapping ibis. Click = release an ibis at that point,
  drag = gust that shoves birds and dye. Sliders for FLOW / WIND / DYE LOAD,
  toggles for flight paths and auto-flock. A "RIVER DYED ✓" stamp appears
  past 66% saturation. Settings, counts and flight totals persist in
  `localStorage` (`woad-ibis-works-v1`).
- **Pigment export (03)** — export PNG of the river, SVG of the flight
  paths, copy the palette, or copy the dye recipe as text. The dye ledger
  logs every completed crossing.

Keyboard: `1/2/3` pigment · `space` flock · `E` PNG.

## Constraint

3 colors max plus black/white: Woad `#2447F9`, Rust `#FF4D00`,
Reed `#FFD02B`, Ink `#111111`, Paper `#FFFEF7`. All translucency is
`rgba()` of those five — no other color literals in CSS, JS or canvas.

## Files

- `index.html` — structure
- `style.css` — neo-brutalist theme (Archivo Black + Space Grotesk)
- `app.js` — river sim, flock, dye advection, export (classic script, no modules, so `file://` works)
