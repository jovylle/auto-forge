# ☀ SUNDIAL LOOP WORKSHOP

**Remix daylight hours into looping ambient soundscapes and visuals.**

A grunge-styled generative music toy: drag the sun around a sundial to scrub the
time of day. Every hour deterministically brews its own ambient loop (root note,
mode, tempo, waveform, and 8-step pattern all derived from the hour — same hour,
same loop, every visit). Stamp hours into a daily cycle, play the cycle back, and
share it as a link.

## How to open

No build, no server, no keys. Just open the file:

- Double-click `index.html`, **or**
- Serve statically: `python3 -m http.server` in this folder, then visit the page.

Works from `file://` and any static host. (Google Fonts degrade gracefully offline.)

## What it does (SPEC features)

- **Drag sun to scrub time** — drag the sun disc on the canvas dial; the gnomon
  shadow, sky wash, and loop DNA update live.
- **Generates loops from hour** — WebAudio generative engine: bass drone + plucked
  modal melody + tape-delay glue + day/night noise wash. Tempo, filter cutoff,
  and brightness follow the sun's elevation.
- **Shareable daily cycles** — STAMP hours into a cycle; COPY produces a URL hash
  (`#c=6.12.18&t=720`) that reloads the exact day. Named days persist in
  localStorage, plus a DEMO DAY preset.
- **Visual sundial playback** — canvas dial with orbit, hour ticks, rust rivets
  for stamped hours (active stamp glows), 8-step beat pips, and loop-pulse on
  the sun.

## Constraint: keyboard only ✓

Fully operable without a pointer: global shortcuts (`←/→` ±1h, `⇧←/→` ±5min,
`↑/↓` ±15min, `Home`/`End` dawn/dusk, `Space` play, `Enter` stamp, `⌫` drop,
`L` cycle, `M` mute, `C` copy), a native time slider, real buttons everywhere,
skip link, aria-live announcements, and a self-narrating canvas label.

## Files

- `index.html` — structure
- `style.css` — grunge identity (Anton + Special Elite, rust/bone/acid, grain, tape, stamps)
- `app.js` — recipes, WebAudio engine, canvas, share, keyboard (ES module, zero deps)
