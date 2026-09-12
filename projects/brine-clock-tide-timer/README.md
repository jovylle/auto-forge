# BRINE CLOCK — 潮汐時計

A living **tide timer** with a japanese-cyberpunk identity. The ocean keeps time in its own language — a neon dial sweeps once per tide cycle while a synthetic harmonic tide model (M2 + S2 + K1) drives the water level, countdowns, and the spring/neap rhythm.

## Open it

Just open `index.html` — no build, no server, no dependencies. Works from `file://` and any static host. Fonts load from Google Fonts (network needed for the full look; the page still renders with system fallbacks offline).

## What it does

- **Tide dial (canvas)** — a glowing circular dial: the pink hand rotates on the dominant M2 lunar tide (~12h25m per revolution), an inner water disc rises and falls with the combined M2+S2+K1 tide, and a 24-hour-tide sparkline wraps the ring. Amber/cyan markers show where the next high (満潮) and low (干潮) tide land. The dial is live — watch the hand creep and the water breathe.
- **Readouts** — current tide level as % of range, rising/falling trend (満ち/引き), phase label, and live countdowns to the next high and low tide.
- **TIME WARP** — scrub the tide slider (−12h … +48h) to preview future tides, hit **▶ WARP** to fast-forward at 60× or 3600×, or **◉ LIVE** to snap back to real time. Speed choice persists in `localStorage`.
- **Share / export** —
  - **⧉ COPY SNAPSHOT** — copies a formatted tide snapshot (level, phase, next high/low, spring/neap position) to the clipboard.
  - **▤ CHART PNG** — renders and downloads a neon 24-hour tide chart (high/low markers, mean line, NOW cursor) as `brine-tide-chart.png`.
  - **⬇ FORECAST JSON** — downloads the next 24h of tide data (30-min points + upcoming highs/lows) as `brine-tide-forecast.json`.
- **Tide model** — pure math, no API: `h(t) = M2·cos(ω_M2 t) + S2·cos(ω_S2 t) + K1·cos(ω_K1 t)`, normalized to [0,1]. The M2/S2 beat produces the real ~14.77-day spring/neap cycle.

## Easter egg — 海神目覚め (KRAKEN AWAKENS)

The tide seal 潮汐 in the header is hiding something. Give it **5 clicks** (it starts to flicker pink after 3), **or just type `kraken`** anywhere on the page. A neon sea-god rises: glowing tentacles and an unblinking eye surface in the dial, the whole page shivers, and the screen flashes 海神目覚め. It calms on its own after ~12s — or click the seal once to dismiss it.

## Controls

| Input | Action |
|-------|--------|
| Tide seal 潮汐 | ×5 → Kraken mode (×1 while active → dismiss) |
| Type `kraken` | Kraken mode |
| Time slider | Scrub simulated tide time |
| ▶ WARP / ⏸ PAUSE | Toggle fast-forward |
| ◉ LIVE | Reset to real time |
| SPEED select | 1×, 60×, 3600× warp rate |

## Files

- `index.html` — structure + Google Fonts (Zen Tokyo Zoo · Noto Sans JP · Share Tech Mono)
- `style.css` — japanese-cyberpunk identity: ink/neon palette, cut-corner panels, scanlines, CRT vignette, drifting aura, responsive to 375px
- `app.js` — tide math, canvas dial renderer, warp clock, exports, easter egg

No images anywhere — the dial, water, waves, markers, and tentacles are all canvas; everything else is pure CSS.