# Serif Storm ⛈

Falling letters form poems you steer with your cursor. A neo-brutalist kinetic-type toy: gravity rains serif glyphs from a poetry corpus, they pile into a poem bed at the bottom, and your cursor blows them around like wind.

## Open

No build, no server. Either:

- double-click `index.html`, or
- serve statically: `npx serve .` / `python3 -m http.server` and visit the page.

Works from `file://` (plain script, no modules, no fetch).

## What it does

- **Gravity-driven letter rain** — words from a built-in corpus fall continuously; gravity slider (0.1–3×) controls the pull. Landed letters stack into a poem bed above the red rule line.
- **Type words to spawn glyphs** — just type anywhere (or use the input box + Enter). Each keystroke bursts its glyph mid-air; Enter rains the whole buffered word. Space fires a gust.
- **Cursor wind blows letters** — moving the cursor pushes nearby glyphs with distance falloff; cursor velocity adds directional blow (live wind meter in the header). Press-drag = gale (2.2×). The **Gust!** button fires a shockwave ring.
- **Export poster PNG** — renders a 1080×1350 framed poster (masthead, live canvas snapshot, current poem, word/glyph counts, date) and downloads `serif-storm-poster.png`.
- Extras: rain-rate slider, pause/freeze, clear, copy-poem, live glyph/word/wind stats, settings persist to localStorage.

## Palette (3 colors + black/white)

- Red `#FF3D00` · Blue `#2545FF` · Yellow `#FFC900` · Ink `#131313` · Paper `#FFFDF4`
- Type: Playfair Display Black (glyphs + headlines) + Space Grotesk (UI), via Google Fonts `@import` with Georgia/system fallback offline.

## Files

- `index.html` — layout: header stats, ticker, canvas stage, spawn + weather cards, footer.
- `style.css` — neo-brutalism: 3px ink borders, hard offset shadows, badge/nugget motifs, responsive single-column under 640px.
- `app.js` — canvas particle engine (gravity, cursor-wind field, gust shockwave, per-column landing stacks), typing input, poster renderer.
