# Descender Dive — 潜水降下

Dive letters underwater; depth bends weight, width, and wobble in real time.
Japanese-cyberpunk generative type experiment. No build, no backend.

## Open

- Double-click `index.html`, **or** serve statically: `python3 -m http.server` → open the page.
- Works from `file://` (Google Fonts degrade gracefully offline).

## What it does

- **Depth slider 深度** — morphs the variable font live: `wght 200→950`, `wdth 130→40`, plus wobble, glow, background pressure and a metres/zone readout (表層 → 海溝).
- **Click to release bubble letters 泡** — click/tap the ocean; kana + headline glyphs float up on canvas. `Bubble Burst` spawns 14.
- **Tide mode 潮汐** — breathes depth 0→100 automatically and swims every letter in a kinetic sine wave.
- **Export poster PNG ポスター** — renders a 1080×1350 neon dive poster (headline, depth, stamp 潜降, bubbles) and downloads it.
- **Sound (WebAudio, zero assets)** — bubble blips, pops, slider ticks, tide whoosh, export shutter. Mutable via chip; starts on first gesture.
- Headline is editable two ways: the input box or clicking directly into the big type. State (text/depth/tide/sound) persists in `localStorage`.

## Stack

`index.html` + `style.css` + `app.js`. Fonts via Google Fonts `@import` (Roboto Flex variable + Zen Kaku Gothic New + Shippori Mincho). Canvas for bubbles, WebAudio for sound.
