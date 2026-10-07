# Foghorn Library 📯

A biomorphic archive of six mythical foghorns from the misted coast. Every tone is **synthesized live with Web Audio** — no recordings, no backend, no build step.

## How to open

Just open `index.html` in any modern browser (double-click works — runs from `file://`), or serve the folder statically:

```sh
npx serve .
# or
python3 -m http.server
```

## What it does

- **Chart + collection** — pick a horn specimen from the SVG coastal chart or the pebble-shaped cards (fundamental, waveform, character shown per horn).
- **Sounding chamber** — press-and-hold the morphing BLOW bulb (or tap `Space` for a timed blast). Blast length, fog density, and distance sliders shape the tone (detuned oscillators + fog-breath noise through a distance-muffled lowpass) and the canvas mist.
- **Sounding log** — every blast is logged to localStorage with its settings; replay any entry with "Sound again". Favourites (♥) persist too.
- **Share/export**
  - `Share this horn` (or `C`) copies a URL hash link that replays the exact horn + settings on open.
  - `Export .wav` (or `W`) renders the current horn offline and downloads a real WAV file.
  - `Copy specimen card` copies a text card + replay link; `Log .json` downloads the sounding ledger.

Keyboard: `Space` blast · `C` share · `W` wav. Responsive down to 375px; honors `prefers-reduced-motion`.
