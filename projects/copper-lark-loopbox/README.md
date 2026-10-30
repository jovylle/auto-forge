# Copper Lark Loopbox

Pocket loop station — layer mic samples into hypnotic rhythms. Grunge edition.

## What it does

- **Live mic sampling** — `ENABLE MIC`, then hit `● REC` on any track. Captures exactly one loop, auto-quantized (time-stretched) to the loop length so it stays in sync.
- **4-track loop layering** — four looped tracks with per-track volume, mute, clear, editable names, waveform display, and live progress. All voices start on the same clock; every take is fitted to the loop.
- **Tap tempo control** — smash the big `TAP` pad 3+ times; median interval sets BPM (50–220). Loop length selector (2/4/8 beats) + click metronome with downbeat accent.
- **One-click export** — `EXPORT MIX` renders 2 loops of the live mix offline and downloads a 16-bit WAV.
- **No-mic fallback** — `STAMP` synthesizes a grunge groove per track (kick-dirt, snare-rust, hiss wash, detuned drone) so the box is fully playable without a microphone.

Settings (tempo, loop length, volumes, mutes, metronome) persist in `localStorage`. Audio lives in memory — export before leaving.

## Shortcuts

`space` play/stop · `T` tap · `1–4` record track · `M` metronome · `E` export

## Stack

Vite + TypeScript + Tailwind CSS v4. Web Audio only, no backend.

## Run

```sh
npm run build    # exits 0, emits dist/ with relative ./assets paths
npm run preview  # serves dist/ (subpath-safe: base './')
```

## Palette (3 accents + black/white, hard constraint)

rust `#c1501f` · gold `#d9a419` · moss `#6e7f24` · ink `#12100c` · paper `#f2ecdc`
