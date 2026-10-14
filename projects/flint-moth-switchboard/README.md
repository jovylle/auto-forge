# Flint Moth Switchboard

> Patch night calls through moth operators. A retro-wave telephone switchboard toy — no backend, everything lives in `localStorage`.

## Run it

Static files, no build step. Serve the folder and open `index.html`:

```sh
python3 -m http.server 8000
# → http://127.0.0.1:8000/index.html
```

## How to work the board

- **Night lines (01)** — five incoming lines. They ring on their own (two-tone WebAudio ring). Tap a **ringing** line to select it. Missed after ~25s → logged as missed.
- **Moth plugs (02)** — six moth operators (Luna, Atlas, Cecropia, Polyphemus, Io, Sphinx) on a diagonal jack cascade over a canvas sun-and-grid scene. Tap a **free amber jack** to patch the selected line → cord snaps across (cyan = talking), a CSS moth perches on the jack and flaps while patched.
- Active calls support **HOLD** (amber cord, moth hums) / **RESUME** / **DROP**. Drops log duration; very long calls (>2 min) time out so the board keeps breathing.
- **Call log (03)** — terminal-style history, newest first, persisted in `localStorage` (`flintmoth.log.v1`, max 50). Clearable.

Extras: live night clock, patched-call + talk-time stats, sound toggle (persisted), full keyboard operability (Enter/Space), `prefers-reduced-motion` support, responsive down to phones.

## Easter egg

There is an **unlabeled dead jack** in the bottom corner of the plug board. Click it three times: six moths orbit the sun for 8 seconds, the title flickers *"MOTHS TAKE THE SHIFT"*, and the log records `23:57 OPERATOR ACK`. Sets `flintmoth.deadjack` — on return visits every moth flaps a greeting on load.

## Palette (constraint: 3 colors + black/white)

| Token | Hex | Slot |
|---|---|---|
| Soot | `#0D0B08` | black |
| Moth cream | `#F4E8D0` | white |
| Tungsten amber | `#FFB454` | hue 1 — operators/hold |
| Ring magenta | `#FF3D6E` | hue 2 — ringing/log |
| Line cyan | `#29E0D8` | hue 3 — active/focus |

One hue per call state; cream-on-soot for all reading surfaces. Type: Monoton (vertical title rail + numerals) + Space Mono (everything else), via Google Fonts `@import`.

## Files

- `index.html` — asymmetric 12-col shell: title rail / lines / board / overlapping log
- `style.css` — all styling, animations, responsive breakpoints
- `app.js` — simulation, patching, cords (SVG), canvas scene, WebAudio, log persistence, egg
- `src/index.css` — scaffold leftover (unused)
