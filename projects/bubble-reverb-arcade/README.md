# Bubble Reverb Arcade

A dark-fantasy WebAudio toy: poke bouncing blobs to layer loops, delays, and wobbly pitch-shifted harmonies — then export your jam as WAV.

## How to open

No build, no server needed. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## What it does

- **Tap blobs to trigger samples** — 6 synthesized voices (lead, bass, shriek, pad, noise hat, wail), all generated with the Web Audio API. No audio files.
- **Stack loops with live delay** — press `L` on a focused blob (or `Shift+1…6`) to bind its loop; tempo, delay time, and feedback knobs shape the stack live.
- **Pitch-bend by dragging blobs** — drag a blob vertically (±12 semitones, shown on its badge); arrow keys do the same keyboard-only.
- **Export your jam as WAV** — `Begin rite` records every strike, `Seal & export WAV` re-renders offline and downloads `bubble-reverb-jam.wav`.

## Constraints

- **Reacts to scroll** — scroll depth drives the "Abyss" meter: low-pass filter, reverb wet, delay stretch, and blob gravity all deepen as you descend.
- **Keyboard only** — `Tab`+`Enter` strikes, arrows bend, `L` loops, `1–6` strike, `Shift+1–6` loops, `C` record, `X` export, `P` loops, `B/V` tempo, `[/]` delay, `;/'` feedback, `-/-=` reverb, `,/.` volume, `S` scale, `0` silence.

Bindings, bends, and knob settings persist in `localStorage`.
