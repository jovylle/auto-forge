# Foghorn Funeral

A cyberpunk mourning ritual for ships the mist never gave back. Raise the
drones, say the words, sound the horn, and watch the eulogy sink into the fog.

Generative · HTML/CSS/JS (no build, no deps) · Web Audio + `<canvas>`.

## Open it

```bash
# works from file:// too, but a tiny server is nicer:
python3 -m http.server 8000 --directory .
# then visit http://localhost:8000
```

No backend, no API keys. Fader levels, mute state and your eulogy persist in
`localStorage`.

## The ceremony

1. **Enter the mist** — press `SPACE` (audio begins here, so allow it).
2. **Drone mixer** — three mourners: `HULL` (55 Hz keel ache), `SWELL`
   (110 Hz tide tremor), `THRENODY` (98 Hz beating-grief pair). They drive the
   fog: louder drones, thicker mist.
3. **Sound the horn** — `SPACE`/`H` for a full foghorn blast; a distant
   cry also answers on its own every ~30 s.
4. **Eulogy typer** — `T` to focus, write the words. `E` (or `CTRL+⏎`)
   commits them to the deep: the eulogy types itself out over the fog, the
   horn sounds, the ship slips under, and the screen gives way to
   **REST IN THE DEEP**. `R` lights a new beacon.

## Controls (keyboard only — no mouse required)

| Key | Action |
|-----|--------|
| `SPACE` / `H` | sound the horn |
| `1` / `2` / `3` | focus a drone fader (then `↑`/`↓`) |
| `M` | mute the last-focused drone |
| `T` / `F` | focus the eulogy |
| `E` / `CTRL+⏎` | commit eulogy to the deep |
| `R` | light a new beacon (after a submersion) |
| `ESC` | release focus |
| `TAB` | move through every control, as usual |

Every control is a native focusable element, so plain tabbing + arrows always
work.

## Files

- `index.html` — structure (curtain, mixer, eulogy, submersion veil)
- `style.css` — palette (`#04060b` abyss / fog teal / warning amber / signal
  red), Chakra Petch + IBM Plex Mono + Cormorant Garamond italic, scanlines,
  vignette, ticker
- `app.js` — Web Audio drone engine (oscillators → lowpass → reverb,
  convolution reverb impulse), layered fog + sinking ship canvas, typewriter
  submersion, keyboard shortcuts, localStorage
- `SPEC.md` — the brief this was built from