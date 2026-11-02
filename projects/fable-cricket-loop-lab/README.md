# Fable Cricket Loop Lab

A meadow of lo-fi loops. Tap sixteen velocity-sensitive spore-pads to layer beats across four looping tracks, dub them through delay + filter, and keep time with a tap-tempo cricket click.

## Run

```sh
npm run dev      # local dev server
npm run build    # typecheck + production build (dist/ uses relative ./assets paths)
npm run preview  # serve the production build
```

## Features → SPEC

- **16 velocity-sensitive drum pads** — synthesized kick, sub, snare, clap, hats, rim, shaker, toms, conga, cricket chirp, keys, bass, swell. Velocity from pen/touch pressure, strike position (lower = louder), or keys `1–4 / QWER / ASDF / ZXCV` (space = wake/rest).
- **4-track loop recorder** — per-track record / overdub / mute / clear, event dots on a soil-strata lane with a sweeping playhead, 1/2/4-bar loop lengths. Loops and settings persist in `localStorage`.
- **Delay plus filter effects** — dub delay (time + feedback) fed from a resonant lowpass; vinyl-crackle bed and soft-limiter glue.
- **Tap tempo metronome** — tap the firefly, nudge ±, slide 60–180 BPM, bar-accented click, beat-synced tempo pulse.

## Architecture

- `src/audio.ts` — `LoopLabEngine`: lazy `AudioContext` graph (voices → lowpass → dry + delay-send → compressor), lookahead scheduler (25 ms tick, 150 ms horizon), tap-tempo estimator, `localStorage` persistence. Zero audio assets.
- `src/App.tsx` — pads field, tempo cell, FX stalk, track lanes; engine subscription via listener set, playheads + tempo pulse driven by `requestAnimationFrame` refs (no re-render churn).
- `src/index.css` — Tailwind v4 `@theme` tokens, blob radii, membrane sheens, lichen grain, blob faders, reduced-motion support.

## Constraints

- **3 colors max (+ black/white):** spore `#B8E356`, fern `#57A05B`, firefly `#E89A4C` on ink `#0C140D` + bone `#EDF3DE`. Track tints reuse the same three.
- **Sound on interaction:** every hit, tap, toggle and transport action emits synthesized WebAudio (no samples, no assets).
