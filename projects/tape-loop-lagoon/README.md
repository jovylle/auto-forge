# Tape Loop Lagoon

Loop tape snippets into dreamy lagoon layers with playful pitch and ripple effects. Grunge flyer aesthetic, zero assets — all audio synthesized live in Web Audio.

## Open

No build, no server. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `npx serve .` / `python3 -m http.server` then open the page.

Press **power on the lagoon** (or `P`) — browsers require a gesture before audio.

## What it does

- **Tap ripples to trigger tape loops** — click water or a tape buoy; each splash toggles one of 4 seamless 8s synthesized loops (silt drone, rust arp, choir reeds, heron static) with ~1.2s fader fades.
- **Drag to pitch-bend live** — drag a buoy up/down (0.5x–2x, shown as speed + semitones) with wow/flutter LFOs for tape wobble. Sliders do the same.
- **Layer 4 loops with fades** — 4 deck cards each with loop toggle, pitch slider, volume/fade slider, live waveform; master + echo + hiss bus.
- **Export lagoon mix as WAV** — renders 8s of the current mix offline (gains, rates, echo) and downloads `tape-loop-lagoon-mix.wav`.
- Settings persist in `localStorage`.

## Keyboard only (full support)

Every control is a native button/slider + a focusable lagoon (`Tab` reaches all):

| Key | Action |
|---|---|
| `P` | power on/off |
| `1`–`4` | toggle tapes I–IV |
| `←`/`→` | select tape |
| `[` / `]` (`-`/`=`, `Shift` = fine) | pitch-bend selected ∓1 semitone |
| `,` / `.` | selected deck volume |
| `0` / `9` | all on / all off |
| `C` | still the water |
| `E` | export WAV |
| `M` | mute master |
| `H` / `?` | help card |

Lagoon focused: arrows move the splash cursor, `Enter`/`Space` splashes + toggles nearest tape.

## Files

`index.html` · `style.css` · `app.js` — Google Fonts via `@import` only; everything else self-contained.
