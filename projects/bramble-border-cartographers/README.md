# Bramble Border Cartographers

Claim hex territories by drawing routes before rivals encircle you — a retro-wave hex strategy duel for 1 player vs 2 AI rivals (VOLT + THORN).

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000`

Works from `file://` and any static host. Progress autosaves to `localStorage`.

## What it does

- **Paint territory on hex grid** — 61-hex pointy-top board on canvas. Click/drag the pulsing frontier hexes (1 ink each, wild hexes cost 2). 3 ink per turn.
- **Plot winding trade routes** — ROUTE tool: tap your hexes in an adjacent chain, then SEAL ROUTE (3+ links). Coins = length² + fertile/crystal bonuses + bending bonus (windier pays more). Routes glow on the board.
- **Block rivals with brambles** — BRAMBLE tool: spend 2 ink to grow an impassable thorn wall on any open hex (5 per game). Rivals path around it; behind-rivals bramble *your* frontier back.
- **Weekly seed maps** — deterministic maps from `BRMBL-YYYY-Www` seeds (ISO week). THIS WEEK / ◀ / ▶ buttons, custom seeds, random wild maps, copy-seed to challenge a friend. Same seed = same map for everyone. Best score per seed is remembered.
- **Full game loop** — 14 turns, END TURN refills ink and moves rivals, encircled-ring bonus (+15/hex), game-over verdict with rematch / next-seed.

Keys: `1/2/3` tools, `Enter` end turn, `Esc` cancel. Retro-wave look: chrome title, striped sun, perspective grid floor, scanlines, neon glows — all CSS + canvas, zero images.
