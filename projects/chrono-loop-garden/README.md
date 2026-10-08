# Chrono Loop Garden

Grow looping melodies where each planted clock blooms into generative sound.

## Open

Open `index.html` directly in a browser (works from `file://`), or serve the folder statically. No build, no dependencies, no keys. Sound wakes on your first drag (browsers require a gesture for audio).

## The one gesture: drag

This garden uses **exactly one interaction type — drag** (pointerdown + pointermove + pointerup; zero tap/click/type handlers). Everything flows from it:

- **Plant time-seeds** — drag across the 8×8 soil; each cell you enter sows a clock. Row sets pitch (A-minor pentatonic, high rows sing higher), column sets loop length, pan, and phase.
- **Loops evolve every minute** — automatically. Each generation drifts pitches ± scale steps, breathes loop periods, and deepens blooms. The masthead counts down to the next evolution.
- **Rewind blooms** — start a drag *on* a planted bloom and move sideways: its hand spins backwards, its bloom shrinks. Rewind past zero and you uproot it.
- **Export garden as chime** — release a drag over the hairline rail at the bottom. The garden renders 8 seconds of itself to a `chrono-garden-chime-g<N>.wav` download and prints a `CLG·g…` garden code in the footer.

A starter constellation of three seeds is planted on first visit. The garden persists to `localStorage`.

## Stack

Plain `index.html` + `style.css` + `app.js`. WebAudio (sine/triangle plucks through a dub-echo bus) for live play, `OfflineAudioContext` + hand-rolled 16-bit WAV encoder for export. Extreme-minimal: paper background, one ink rule, one vermillion accent, hairline soil grid, mono data readouts.
