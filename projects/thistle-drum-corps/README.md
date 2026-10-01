# Thistle Drum Corps

March a thistledown drum line down the parade field — a pixel-art rhythm game in plain HTML/CSS/JS.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the printed URL.

Works from `file://` and any static host. Best score persists via `localStorage`.

## What it does

- **Drum march** — 4-lane rhythm gameplay (snare / tenor / bass / crash). Notes march in from the right; strike them on the gold strike-line with keys **D F J K** (or tap the pads, or `Space` to start). WebAudio-synthesized drums, no audio files.
- **Parade field** — a live pixel canvas: bouncing crowd, scrolling yard lines, drum major with twirling baton, 4 marching drummers who step on every hit, floating thistledown, hit puffs, screen shake on misses.
- **Corps score** — combo multiplier, PERFECT/GOOD/MISS judgments, accuracy + parade-progress meters, ranks from CADET to DRUM MAJOR with S/A/B/C/D grades. 8 misses halts the line; surviving the 52-second, 112 BPM parade completes it.

## Constraints

- Palette: exactly 3 hues (thistle purple `#b678f0`, moss `#3ddc84`, gold `#ffc233`) plus near-black `#14091f`/black and off-white `#fff6e3`.
- No images — all visuals are canvas rectangles + CSS. Only external request is a Google Fonts `@import` (Press Start 2P + VT323), which degrades gracefully offline.
