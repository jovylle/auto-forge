# 🐝 Neon Apiary — Hive Rush

A 60-second neo-brutalist arcade game. You are the neon bee: grab glowing pollen,
ferry it to the hive hex, dodge wasps, chain combos, bank honey.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` and visit the page.

Works from `file://` (plain `<script>`, no modules, no fetches — Google Fonts
`@import` degrades gracefully offline).

## How to play

- **Move:** mouse / touch-drag on the hive, or `WASD` / arrow keys.
- **🌸 Pink pollen:** touch to grab (carry max 5, big blooms worth 2).
- **⬢ Hive (top):** fly in to bank carried pollen as honey.
- **🐝‍⬛ Wasps (cyan):** chase you. A sting = −1 life, drop pollen, combo reset.
- **🔥 Combo:** chain pickups within 4s to raise ×2…×5.
- **⏱ End:** 60s timeout or 0 lives (3 lives). Best score persists in `localStorage`.

## Share / export

- **⧉ Copy run card** — one-line score text to clipboard (with manual fallback).
- **⬇ PNG snapshot** — downloads the live canvas frame.
- **⬇ JSON log** — run stats + timestamped event log.
- **🔗 Share link** — copies a `?honey=N&best=M` URL; opening it shows a challenge overlay.

## Palette (3 colors + black/white)

`#FFD02F` honey · `#FF3EA5` pink · `#22E6FF` cyan · `#0A0A0A` black · `#FFFDF5` paper white.

## Files

`index.html` · `style.css` · `app.js` (all synthesized Web Audio, no assets).
