# Chrono Tide Conservatory

Tidal clocks breed looping soundscapes from lunar history and daily rhythms.
Generative single-page instrument — plain HTML + CSS + JS, no build, no network, no backend.

## How to open

Just open `index.html` in any modern browser (double-click works — `file://` is fine),
or serve the folder statically, e.g. `python3 -m http.server` then visit the page.

For sound, press **▶ flood the room** (browsers require a user gesture to start audio).

## What it does

- **01 · Live tidal clock dials** — three SVG dials computed in-browser from lunar age
  (synodic cycle from a reference new moon) plus a harmonic tide model (M2 + S2 + K1):
  tide height/flood-ebb/next high-low, moon phase/age/illumination, and 24h day dial
  with a loop-progress ring. Ticks every second.
- **02 · Loopable ambient tide audio** — a WebAudio generative loop at 72 BPM in
  4/8/16-bar lengths with four stems: **swell** (tide-breathing filtered noise),
  **undertow** (sub-bass tuned by lunar phase), **moon drone** (detuned chord rooted
  to moon age), **gull shimmer** (seeded pentatonic plucks). Per-stem volume + mute,
  master room level. Persists to `localStorage`.
- **03 · History scrub timeline** — 30-day tide-range canvas chart (○ new / ● full
  markers) with a day-scrub slider. **Breed** crosses today's tide with the scrubbed
  day into a new seeded pluck melody (`✦ x…` seed).
- **04 · Export loop stems** — each stem (or the full mix) renders offline via
  `OfflineAudioContext` to a 16-bit 44.1 kHz WAV download; `session.json` exports
  seed, moon/tide state, mixer, and loop config.

## Keyboard only (constraint)

Every control is a native button/slider — full Tab operability with visible focus —
plus shortcuts: `Space` play/stop · `1–4` mute stems · `L` loop length ·
`[`/`]` scrub history · `B` breed · `E` export mix · `?` key map · `Esc` close.
`aria-live` status line announces state changes. Respects
`prefers-reduced-motion`, works at 375 px width.
