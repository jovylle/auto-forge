# ≋ DRIFTLINE — Territory Looper

Vaporwave grid arcade. Draw closed loops to claim tiles, outmaneuver two drifting rival couriers, burn fog off the weekly-seed map — all in 60-second blitz rounds.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` → open the page.
- Works from `file://`. No build, no npm, no keys.

## How to play
1. Hit **▶ start 60s blitz** (countdown 3-2-1).
2. **Drag** across tiles (mouse/touch) or use **WASD/arrows** — your cyan route follows.
3. **Close a loop**: cross your own trail or return to your pink turf → everything inside is claimed. Tiny loops fizzle; go big.
4. **VEX** (orange) and **NULL** (mint) couriers drift with momentum + wobble and hunt your edges — they steal pink tiles and sever your route on contact. If you step onto them, your route breaks.
5. **Fog zones** (hatched) hide the map — claim next to/inside them to burn fog off for bonus tiles.
6. Timer hits 0 → score card with your %, rivals %, best. **↻ run it back** for another round.

## Systems
- **Weekly seed map**: ISO-week seed (`YYYY-Wnn`) → deterministic fog zones + rival drift via mulberry32. **🎲 daily dice** rolls a random map. Seed shown in header, footer, and shareable via **copy seed**.
- **Fog zones**: 3 seeded rects, revealed by claiming adjacent cells.
- **Blitz**: 60.0s countdown, urgent pulse under 10s, rivals speed up in the last 15s.
- **Best**: per-seed + global best in `localStorage` (`driftline-best`).
- **Sound**: pure WebAudio bleeps — draw ticks, claim arpeggio, steal/cut stingers, fog shimmer, countdown, win/lose jingle. ♪ toggles mute.
- **Visuals**: canvas only + CSS (chrome gradient type, retro sun, scanlines, glow). Zero images.

## Files
`index.html` · `style.css` · `app.js`
