# Fogline Courier Atlas — 霧線飛脚図

Plot courier routes across shifting fog grids to claim territories. A keyboard-only hex strategy game in one Japanese-minimal HTML file.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `python3 -m http.server` in this folder → http://localhost:8000/

Works from `file://` and any static host. Google Fonts `@import` needs network; the game is fully playable offline (falls back to system serif/sans).

## Play (keyboard only)

- **Q W E** — step north-west / north-east / east
- **A S D** — step west / south-west / south-east
- **Arrow keys** — also move (←=A, →=E, ↑=W, ↓=S; Q/E cover the diagonals)
- **U / Backspace** — undo one step · **R** — restart fog · **?** — help
- **[ / ]** — previous / next day seed · **T** — today · **N** — random wander seed · **Enter** (on win) — new run

Every step draws your ink route and parts the fog (radius 2). Grey dashed hexes are unrevealed fog. Step onto a red **○** checkpoint to stamp it (判) — claims all land within 2 hexes and refunds +12 ink. Plains cost 1 ink, pine 🌲 and shallows 〜 cost 2. Claim all 4 checkpoints to complete the atlas.

## Daily seed

Map layout, terrain, and checkpoint names derive from a seeded RNG (`xmur3`+`mulberry32`) keyed on `YYYY-MM-DD` (or `?seed=...`, or a `wander-xxxx` key from **N**). Same seed → same fog, every day and every device. Best score per seed persists in `localStorage`.

## Files

- `index.html` — the entire game (inline CSS + JS, zero deps)
- `SPEC.md` — spec
