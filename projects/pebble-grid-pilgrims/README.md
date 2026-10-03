# Pebble Grid Pilgrims

Claim grid squares with pebbles and chart winding pilgrim routes. A glassmorphism territory game in one weekend-sized page.

## Open

Just open `index.html` in a browser (double-click works — no server, no build, no npm). Or serve statically: `python3 -m http.server` in this folder.

## What it does

- **Click-to-claim territory grid** — 9×9 map; tap meadow squares to drop 🪨 pebbles (tap again to lift). Water 🌊 and crag ⛰ can't be claimed. Shrines ⛩ score 2 pts.
- **Auto-routed pilgrim paths** — pebbles link in drop order via BFS routing around obstacles; the route draws as a glowing line. Press **▶ journey** to send 🚶 walking the path step-by-step with sounds.
- **Weekly seed reshuffles map** — map is deterministic from its seed; the official map is `year*100 + ISO week` and reshuffles every Monday (countdown shown). **This week's map** / **🎲 wander** / type any numeric seed to jump. Progress persists per-seed in localStorage.
- **Shareable route postcards** — **✉ postcard** renders a canvas postcard (map + route + score) with a share link like `#s=202640&c=1.4.9` encoding seed + claim order. Anyone opening the link sees your exact map and route. Copy link or download PNG.

## Constraints

- **Easter egg:** tap the 🌕 moon 5 times, or type `pilgrim` / `pebble` — summons the golden Moon Pilgrim + meteor shower.
- **Sound on interaction:** pure WebAudio (no assets) — claims rise in pitch, steps tick, fanfares, shutter click. Toggle with the sound pill.

## Files

`index.html` · `style.css` · `app.js`
