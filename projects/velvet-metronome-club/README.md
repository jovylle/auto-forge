# Velvet Metronome Club

Layer humming loops into an evolving choir. A pop-art WebAudio toy — no build, no backend, no images (CSS + canvas only).

## How to open

Just open `index.html` in a browser (double-click works — runs from `file://`), or serve it statically:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Mic layers need mic permission, which browsers only grant on `localhost`/HTTPS — serve it locally for the full experience. The built-in hum synth sings even with no mic.

## What it does

- **4-track hum looper** — each track is a hum synth (saw + triangle through vowel formants + lowpass filter) or a mic-recorded loop, quantized to the loop length. Per track: note, vowel (ah/oh/oo/eh/ee), filter cutoff (live-tweakable while playing), level, drop-in beat, mute/solo, audition, and canvas mini-waveform.
- **Tap tempo + swing** — big TAP pad (or `T` key), BPM readout, beat dots, swing slider (0–60%) that delays off-beat 8ths, 1–4 bar loops, optional metronome click. `Space` toggles play.
- **One-click choir chords** — Velvet Major, Blue Minor, Sunset 7, Cosmic Sus, Neon Cry. Each tunes all four synths (with staggered drop-ins so the chord evolves).
- **Export loop as WAV** — offline-renders one full loop (synths + mic layers, no click) to a 16-bit WAV download.
- Settings persist in `localStorage`. Pop-art look: Bangers + Space Grotesk, halftone dots, marquee, comic burst, beat-pulsed canvas scope.

## Files

`index.html` · `style.css` · `app.js` — that's the whole app.
