# Ascender Arcade

Catch rising letters to build words before they escape the screen. A pixel-art arcade cabinet in plain HTML/CSS/JS — no build, no backend.

## How to open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Works from `file://` and any static host. Google Fonts `@import` needs internet; the game is fully playable offline with fallback fonts.

## How to play

- **Gravity-flipped catching:** letters bubble UP from the bottom. Slide the NET along the top (mouse / touch / `◀ ▶` / `A D`) to catch them on the dashed CATCH ZONE line before they escape.
- **Build words:** caught letters land in the tray (max 8). Click tray letters (or just type A–Z) to spell a 3+ letter word, then `WORD ▸` to score. Score = length² × 10, plus combo multiplier.
- **60-second runs:** `START ▸` begins the clock. Best score persists in `localStorage`.
- **Variable-font power-ups:** golden tiles drop ❄ SLOW-MO (8s), ⇔ WIDE NET (10s), ×2 DOUBLE SCORE (10s) — caught letters pulse through Roboto Flex `wght`/`wdth` axes as they rise.
- **Daily kinetic seed:** DAILY RUN seeds spawn speed, wobble, letter mix, and the ★ TARGET word from the date (`YYYY-MM-DD` in the footer). PRACTICE uses a random `P-XXXX` seed. Daily best is tracked per date.

## Easter eggs

- **Konami code** (`↑↑↓↓←→←→BA`) triggers an 👾 invader rain + 100 pts.
- Type **ASCEND** mid-run to reveal the target word + 50 pts.

## Palette (3 colors + black/white)

Pink `#FF2E88` · Cyan `#22D3EE` · Gold `#FFD22E` on Black `#0B0B10` / White `#FFF8E8`. Type: Press Start 2P + Roboto Flex (variable).
