# Echo Hour Carousel 電響回転時計

Spinning clock rings brew ambient loops from hours, minutes and history echoes. Japanese-cyberpunk generative toy: three draggable neon time-rings compose an endless tick melody in WebAudio.

## How to open

No build, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder → open `http://localhost:8000`

## Play in 30 seconds

1. Press **▶ 起動 PLAY** (audio starts — required by browsers).
2. **Drag a ring** on the dial: outer 外 = hour/root pitch, middle 中 = minute/density, inner 内 = echo/delay ghosts. Sound remixes instantly.
3. That's it — the tick melody auto-generates forever.

## Features

- **Drag time rings to remix** — pointer/touch drag on canvas rings (hit-tested by radius); keyboard `←/→` nudges the selected ring tab. Hour stamps to history on release.
- **Auto-generating tick melodies** — lookahead scheduler plays 8th-note Insen-scale motifs (root from hour, rhythm density + filter brightness from minute, sub pad every bar, square tick-ghost offbeats) through a feedback delay set by the echo ring.
- **History mode replays past hours** — `＋ stamp hour 刻印` (auto-stamps on play + hour change), up to 24 snapshots in `localStorage`; `⏪ history` toggle walks through them 4s each; click any chip to jump.
- **One-click loop export** — `⤓ EXPORT 8s LOOP` records 8s via `MediaRecorder` on a `MediaStreamDestination` and downloads `echo-hour-HHMM-echo.webm`.

## Constraints

- No images — CSS gradients + canvas only (Google Fonts `@import` for type).
- Playable in 30s: one PLAY tap with live defaults seeded from the real clock.

## Files

`index.html` · `style.css` · `app.js`
