# Hourglass Loop Atelier

Remix history snippets into looping clockwork visuals that tick with your cursor.

Swiss-poster generative instrument. Plain HTML + CSS + JS, no deps, no webfonts, works from `file://`.

## Open

- Double-click `index.html`, or
- `python3 -m http.server 8000` in this folder → http://localhost:8000/

## What it does

- **Clockwork loop (01)** — canvas gears, hourglass lemniscate, crosshair cursor. Mouse moves time-warp; focus the frame and use `←→↑↓` (with `Shift` for fine steps).
- **Time sliders (02)** — Tempo, Rings, Warp, Divisions, Trail, Cursor X/Y. All native `<input type=range>`, fully keyboard operable. Cursor X/Y mirror the mouse so keyboard-only players get the same warp.
- **History ticks (03)** — 8 snippets (1582 Gregorian skip → 2016 leap smear). `Sample` ORs its 16-step tick pattern into the beat grid. Keys `1–8`.
- **Beat sampler (04)** — 16-step grid of toggle buttons, BPM slider, WebAudio square-wave ticks, red playhead pulses the gears. `Space` plays/pauses, `Clear` / `Fill 4/4`.
- **Daily clock seed remix** — seed defaults to today (`YYYY-MM-DD`), hashed to a mulberry32 stream that phases the gears. `⟳ Daily remix [R]` jumps to a `REMIX-XXXXXXXX` seed; `← Day / Day →` step the calendar; `Today` resets. Persisted to `localStorage`.
- **Export looping GIF cards** — `Export GIF card [E]` renders 12 frames @ ~12fps with the seed + clock baked into the footer strip, encodes GIF89a in-page (fixed 16-color Swiss palette, LZW, NETSCAPE loop), shows preview + download. Bonus PNG still button.

## Keyboard only

Everything is a button / range / link. Focus rings are red. Shortcuts: `Tab`, `←→↑↓`, `Space`, `R`, `E`, `1–8`. Reduced-motion users get a static frame.

## Files

`index.html` · `style.css` · `app.js` · `SPEC.md`
