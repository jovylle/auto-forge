# Weight Parade — 行列

Letters march, swell and shrink to your typing rhythm, live.
A japanese-minimal variable-font playground: washi paper, sumi ink,
a vermillion hanko, and a parade route your keystrokes march along.

## How to open

No build, no npm, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- `python3 -m http.server` in this folder, then open the printed URL.

Google Fonts load if you're online; offline it falls back to
Georgia / system serif and everything still works.

## What it does

- **Live variable-font playground** — type in the black 打ち込み box;
  inter-key speed becomes `wght` per letter (fast = black, slow = hairline),
  with sliders for weight, width, optical size, slant, and trail decay.
- **Type-along rhythm mode** — press `R`: a metronome (WebAudio, no files)
  and a prompt line appear; keystrokes landing within ±90 ms of the beat
  score 的 on-beat and marchers flash vermillion at weight 900.
- **Export animated GIF** — press `Ctrl/⌘+Enter`: 24 frames render to an
  offscreen canvas and encode locally via an inline GIF89a + LZW encoder
  (zero dependencies, nothing uploaded); a Download link appears.
- **Curated font pairings** — keys `1–4`: Matsuri, Sumi, Ai, Washi.

State (sliders, pairing, text) persists in `localStorage`.

## Keyboard-only

Everything is reachable by `Tab`; sliders respond to arrows natively.
Shortcuts (outside text fields): `B` metronome · `R` rhythm walk ·
`1–4` pairings · `[`/`]` base weight · `Ctrl+K` clear ·
`Ctrl+Enter` export GIF · `?` shortcut panel · `Esc` blur field.

## Files

`index.html` · `style.css` · `app.js` · `README.md` · `.factory/result.json`
