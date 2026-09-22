# Static Bloom Choir

Neon lullaby console — loopable petal synths bloom into ambient choirs you conduct by dragging.

## Open

- Double-click `index.html`, or serve statically: `python3 -m http.server` in this folder.
- Works from `file://` (no bundler, no fetch, no assets). Best in Chrome/Edge/Safari.
- Narrow-friendly: usable at 375px width.

## What it does

- **Drag petals ↕ to pitch-shift voices** — 7 petal voices around the choir core; vertical drag = ±7 semitones, live-retuned with audition plucks. Keyboard: focus petal, ↑/↓.
- **Tap rhythm to seed bloom patterns** — hit TAP / the tap-zone orb 3+ times; inter-tap intervals seed a 16-step bloom sequence over the 8s loop. SCATTER randomizes, CLEAR wipes, steps are clickable.
- **Layer WebAudio choir pads** — ROOT / THIRD / FIFTH / SHIMMER detuned stacks over a 4-chord Cm lullaby loop (2s per chord), plus VOLUME / BLOOM / DRIFT sliders and 3 scales (PENTA / DORIAN / HIRA).
- **Export 8-second lullaby loops** — offline-renders exactly 8s at 44.1kHz and downloads `bloom-choir-loop.wav`. ∞ LOOP toggle for continuous vs one-shot playback.

## Constraints

- System fonts only, no external fonts.
- Sound on interaction via WebAudio, zero audio assets. AudioContext starts on first gesture.
- State (petal offsets, pattern, pads, sliders) persists in `localStorage`; "reset memory" clears it.
