# 🏮 Lantern Minute Menagerie

Wind up glass minutes that hatch into glowing clock-creatures — every hour, like clockwork.

## How to open

No build, no server needed. Just open `index.html` in a browser (double-click works, `file://` safe), or serve statically:

```sh
cd lantern-minute-menagerie
python3 -m http.server 8080   # then http://localhost:8080
```

## What it does (all 4 SPEC features)

1. **Wind clock eggs alive** — pick one of 3 glass eggs and **hold** the WIND button (or Space/Enter on it). Each egg has a temperament: `eager` (fast), `sleepy` (slow), `tricky` (slips if you rush). At 60 ticks it hatches with a chime chord.
2. **Loop 60-second habitats** — the canvas habitat syncs to the wall-clock second (`:00 → :60 ∞`). The creature's clock-belly hands, legs, glow and the sun-arc all loop every minute.
3. **Crossbreed history echoes** — tap 2 creatures as parents → **Crossbreed**. The child mixes body/color/eyes/legs/tempo; every hatch/breed is stamped into the **history echoes** strip, and the last 3 echoes trail as ghosts behind the current creature.
4. **Mint midnight evolutions** — at **00:00** (or with the time-machine switch) you can mint one crowned 👑 Midnight Evolution per night, stamped with the date. Stored as collectible cards.

Plus: a **wild egg auto-lays every hour**, hourly chime (mutable), prev/next browser, localStorage persistence, and a release-all reset.

## Easter eggs (3!)

- **Rub the lantern 🏮 7×** → the Lantern Keeper parades your creatures.
- **Konami code** (`↑↑↓↓←→←→ B A`) → same parade.
- **Type `moon`** → secretly engages the midnight time-machine. (Hatching 10 creatures also wakes the Keeper.)

## Constraints

- **3 colors max (+black/white):** amber `#FFB000` · teal `#00C2A8` · coral `#FF4D2E` + ink `#111` & paper `#FFFDF5`. No other hues anywhere (CSS, canvas, emoji excluded as pictographs).
- **Aesthetic:** neo-brutalism — thick ink borders, hard offset shadows, sticker badges, Archivo Black + Space Mono.
- **Mobile:** responsive down to 375px (eggs stack, buttons go full-width); `prefers-reduced-motion` respected.

## Files

- `index.html` — structure (wind / habitat / crossbreed+echoes / midnight)
- `style.css` — neo-brutalist theme, Google Fonts @import
- `app.js` — game logic, canvas renderer, WebAudio chimes, persistence (ES module, no deps)
