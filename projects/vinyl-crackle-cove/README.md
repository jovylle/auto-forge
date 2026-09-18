# Vinyl Crackle Cove

A pop-art lo-fi beat machine. Dig through crates of dusty wax, dial in vinyl
crackle & wow, chop the loop with tap tempo, then press your beat to `.wav` —
all in one page, all synthesized live with WebAudio. No samples, no images.

## How to open

No build, no server needed. Just open `index.html` in any modern browser
(Chrome / Edge / Firefox / Safari):

- Double-click `index.html`, or
- serve it statically, e.g. `python3 -m http.server` in this folder.

Works from `file://` — zero network calls except the optional Google Fonts
import (falls back to system fonts offline).

## What it does

1. **① Dig the crates** — 6 records (Misty Rhodes, Blue Break, Sunset Loop,
   Night Bus, Peach Fuzz, Coral Reef). Each is a live synth recipe: chord
   progression, drum style, tempo, brightness. Click to drop the needle;
   🎲 Surprise Me shuffles. Keys `1–6` work too.
2. **② Dust the wax** — Crackle (looped hiss + needle pops), Wow (pitch
   wobble via modulated micro-delay + slow volume seasickness), Dust Filter
   (mellow low-pass), Swing (drunk-drummer shuffle).
3. **③ Chop the loop** — Smash TAP! (or press `T`) in rhythm to steal the
   tempo; pick SMOOTH / BOUNCE / TRAP / STUTTER gate patterns + chop depth
   to slice the 16-step loop.
4. **④ Press your wax** — Name your banger, hit Export: renders 2 bars of
   your exact mix (drums, chords, crackle bed, echo, chop gates) offline to
   a stereo 44.1 kHz `.wav` download.

Extras: spinning CSS turntable with tonearm, live waveform scope + VU meter,
16-step position lights, POW! bursts, `Space` to play/stop, `E` to export,
and localStorage persistence of your whole mix.

## Files

- `index.html` — layout (turntable, crates, dust, chopper, export)
- `style.css` — pop-art theme: halftone dots, comic panels, hard shadows
  (CSS gradients only — zero image files)
- `app.js` — WebAudio engine: lookahead 16-step sequencer, synth voices,
  vinyl FX chain, tap tempo, offline WAV bounce
