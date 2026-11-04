# Birch Finch Fizzbox ◉

Tap bubbles to layer **chirps, kicks, and fizz** into tiny looping songs. Memphis-style generative groove toy — plain HTML/CSS/JS, no build, no backend.

## Open

Any static way works (double-click works too):

```sh
open index.html            # macOS
# or
python3 -m http.server 8080  # then http://localhost:8080
```

Works from `file://` — the script is a plain `<script>`, no modules, no fetch, no assets except Google Fonts (graceful offline fallback).

## Play

- **Tap a bubble** in the pond → chirp / kick / fizz / pluck synth fires (WebAudio, synthesized live).
- **Hold + drag ↕** on a bubble → pitch-bends ±7 semitones with a live preview badge; the bent pitch is what gets taped.
- **▶ PLAY** starts the 4-bar loop rolling; taps while rolling are taped automatically (toggle OVERDUB to play along silently).
- **● REC 4-BAR TAKE** wipes the tape and records exactly one 4-bar lap, then auto-loops it forever.
- **🎲 GROOVE** one-click random groove: new tempo (96–126 BPM), four-on-floor kicks, bass plucks, pentatonic chirp walk, offbeat fizz — with a generated name ("FIZZY WREN"…).
- **↩ UNDO / ✕ CLEAR**, tempo slider 84–140 BPM, mixer knobs (filter / echo / loud), keys `1–7` pop bubbles, `space` toggles play.
- Tape, tempo, and knobs persist to `localStorage`.

## Scroll constraint

The page **must react to scroll**, so it does three audible-visible things:

1. A rainbow scroll-progress bar up top.
2. Scroll position sweeps the master lowpass filter ("SCROLL WASH → x.x kHz" readout) — scroll down and the loop gets brighter.
3. Memphis background shapes parallax, the pond squashes slightly with scroll velocity, and sections reveal on entry.

At 375 px wide the console stacks to one column and bubbles shrink — all tap targets stay finger-size.
