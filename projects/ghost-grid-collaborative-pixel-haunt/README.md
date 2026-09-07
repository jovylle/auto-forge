# GHOST GRID — collaborative pixel haunt

A swiss-styled collaborative pixel canvas. Paint pixels on a shared 48×36 grid, then export your haunt as a PNG or share it via a self-contained URL that encodes every pixel.

## Open it

Just open `index.html` in a browser — no build, no server, no dependencies. Works from `file://` and any static host. Google-Fonts-free (system Helvetica/Arial) so it runs offline too.

## What it does

- **Paint & erase** — drag across the grid to draw with the selected ink (red / black / white / blue). Smooth line interpolation on drag, high-DPI rendering.
- **Undo / Clear** — step back through the last 60 strokes or wipe the board.
- **PNG export** — downloads a crisp hi-res render of the canvas.
- **Copy link** — packs the entire grid into a run-length-encoded URL fragment (`?g=...&r=ROOM`) and copies it to the clipboard. Anyone who opens the link sees your exact haunt. Paste it anywhere.
- **Live stats** — pixel counter and your 4-letter room tag in the masthead.

## Scroll reactivity

Scroll anywhere on the page: a red rail indicator tracks your scroll depth, the canvas subtly skews and the background warms toward red as you go deeper, and at maximum depth the page shifts into a "zoom" atmosphere.

## Easter egg 🥚

Type the classic Konami code (**↑ ↑ ↓ ↓ ← → ← → B A**) to wake the ghost — the canvas starts to flicker with phantom red pixels and the grid becomes haunted.

## Design

Swiss identity: hard grid, heavy Helvetica/Arial typography, black-and-paper palette with a single screaming red accent, generous negative space, and strict 2px hairlines. Layout splits a full-bleed canvas from a compact control rail that collapses into a stacked mobile sheet under 760px.

## Files

- `index.html` — markup
- `style.css` — swiss styling + responsive collapse
- `app.js` — all logic (grid, paint, export, share, scroll, easter egg)

Verified clean: zero console errors, no horizontal overflow at 375px and desktop.
