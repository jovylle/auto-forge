# Marble Murmuration

Retro-wave generative flock: hundreds of marble-textured boids stream over a
synthwave map (striped sun, contour lines, perspective grid).

## Open

Just open `index.html` in a browser — works from `file://`, no build, no deps.
(Google Fonts `@import` is optional; offline it falls back to monospace.)

## What it does

- **Core interaction** — pointer bends the flock (attract/repel toggle), click fires a shockwave burst; mixing desk sliders for birds / speed / swirl / trail, 3 palettes, shuffle seed.
- **Scroll-reactive (constraint)** — page is a sticky full-viewport canvas + 5 chapters. Scroll depth drives sun altitude, wind, turbulence and grid warp; scroll velocity whips up extra turbulence. Side meter shows depth.
- **Share/export** — ⬇ PNG snapshot download, ⧉ COPY LINK (URL hash replays exact seed + mix), ★ SAVE persists to localStorage, auto-save on every change.

## Files

- `index.html` — the whole piece, self-contained (single-file constraint)
- `style.css` / `app.js` — extracted mirrors of the inline CSS/JS for reference
