# Honeycomb Switchboard — 蜂の交換台

A quiet hex-path puzzle in Japanese-minimal style. No images — pure CSS hexagons
(`clip-path`) + a canvas render used only for PNG export.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works from `file://` and any static host.

## How to play

- **Goal:** light a continuous circuit from the dark **entrance 繋** (top) to the
  **exit 巣** (bottom). Every green **relay ◆** must glow in the same circuit.
- **Tap** a hex to switch it on/off. Golden pulsing cells are *energized* —
  they touch the entrance through other lit cells. Cracked dark cells are broken.
- Beat **par** moves for up to ★★★. Levels grow 4×5 → 7×7 with more relays
  and more broken cells.
- Keyboard: `←↑↓→` move · `space` toggle · `n` new · `h` hint (+2 moves) · `r` reset.
- Sound is a tiny WebAudio koto-ish pluck, mutable with the ♪ button.

## Share / export

- **Copy link** — board (level + seed + lit cells) encoded in the URL hash
  (`#hcb1.level.seed.bits`); opening the link restores the board.
- **Board code** — same code as text; paste one into the box and hit Load.
- **Copy board** — ASCII-art rendering of the board + link.
- **Save PNG** — renders the board to an offscreen canvas and downloads it.
- Progress (best scores per level + unfinished board) persists in `localStorage`.

## Files

- `index.html` — structure
- `style.css` — washi-paper / sumi / vermillion theme, Google Fonts import
- `app.js` — seeded puzzle generator, hex-grid flow solver, share codec
