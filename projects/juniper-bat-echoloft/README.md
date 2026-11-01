# Juniper Bat Echoloft

Loop bat chirps into echoing rhythms with a tiny 16-step pitch sequencer. Organic-brutalist edition.

## What it does

- **16-step pitch sequencer** — stalactite steps hang at heights matching their pitch (−12…+12 semitones). Click toggles a step on/off (new steps take the loaded chirp brush); drag ↕ or use ↑↓ to bend pitch; ←→ moves between steps. Playhead glows amber; every trigger fires a sonar ring on the cave canvas.
- **Live echo and reverb knobs** — three rotary cave-FX dials (ECHO mix, REPEATS feedback, SPACE reverb) wired straight to the WebAudio graph. Echo time auto-syncs to a dotted-8th of the current tempo. Drag, scroll, or arrow-key them mid-flight.
- **Built-in bat chirps** — four synthesized night-hunters (PIP, SWEEP, TRILL, THOCK), generated live with oscillators + filtered noise. No audio files, works offline. Pick a brush, then stamp steps.
- **Tap tempo and randomize** — smash the TAP pad 3× (median of taps, 50–220 bpm) or drag the tempo slider; SEED grows a fresh pentatonic flock, ROOST/SWARM/MOTH stamp curated patterns, CLEAR sweeps the loft.

Pattern, tempo, FX, and brush persist in `localStorage`. All audio synthesized in-browser — no backend, no assets.

## Shortcuts

`space` fly/roost · `T` tap · `R` seed · `←→↑↓` edit hanging step (when a step is focused)

## Stack

Vite + TypeScript + Tailwind CSS v4. Web Audio only, no backend.

## Run

```sh
npm run build    # exits 0, emits dist/ with relative ./assets paths
npm run preview  # serves dist/ (subpath-safe: base './')
```

## Palette (3 accents + black/white, hard constraint)

juniper `#57a773` · amber `#e0912f` · bark `#8a5a3b` · ink `#101208` · paper `#f4f1e4`
