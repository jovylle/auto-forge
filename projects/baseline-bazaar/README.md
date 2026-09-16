# BASELINE BAZAAR — kinetic type terminal

Type phrases, watch words drop into a physics tank as live variable-font bodies —
they morph weight, bounce, collide and rearrange. Tune the glyph deck, then export
a seamless GIF loop. Playable in 30 seconds.

## Open

No build, no backend. Either:

- double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder → http://localhost:8000

Works from `file://` (Google Fonts `@import` needs network; offline it falls back
to system sans — everything else still works).

## How to play (30s)

1. Type a phrase in the `>` prompt + **ENTER** — words fall into the tank.
2. Or tap a preset chip: `gravity` `neon` `orbit` `loop`.
3. Drag sliders: **WEIGHT / WIDTH / SIZE / GRAVITY / BOUNCE**.
4. Pick an arrange mode: **CHAOS · GRID · ORBIT · RAIN**.
5. Hover to repel, **drag words to throw**, click empty tank to **blast**.
6. **◉ EXPORT GIF LOOP** → 24f · 12fps · 2s seamless `baseline-bazaar-loop.gif`.
   **PNG SNAP** for a still. Settings + phrase persist in `localStorage`.

Keys: `Enter` drop · `/` focus prompt.

## Features

- **live kinetic type canvas** — `<canvas>` sim, per-word weight wobble + collision pop
- **variable font weight sliders** — weight (100–900), width (62–125), size + gravity/bounce
- **word physics collisions** — pairwise elastic collisions, wall bounce, mouse forces, drag-throw
- **export as GIF loop** — self-contained LZW GIF89a encoder (no deps), fixed 5-ink
  palette, `NETSCAPE2.0` infinite loop, loop-locked wobble phase so frame 24 wraps to frame 0

## Constraints

- 3 colors max (+black/white): phosphor `#00FF9C` · amber `#FFB000` · signal `#FF3B5C`
  on `#040805` black / `#E9FFF3` white. The GIF palette is exactly these inks.
- Sci-fi-terminal aesthetic: tty chrome, boot log, scanlines, glow, JetBrains Mono + Archivo.

## Files

`index.html` · `style.css` · `app.js` (all logic + GIF encoder inline, zero deps)
