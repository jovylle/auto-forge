# ◈ QUARTZ CANTINA

A sci-fi-terminal social board. Dock at a sector on the deep-field chart,
pick a house, and hail the cantina with 140-character transmissions.
Buy rounds (🥂 cheers), filter the live wire, and share your wire with anyone.

## How to open

No build, no backend. Either:

- double-click `index.html` (works from `file://`), or
- serve statically: `python3 -m http.server` in this folder, then open the URL.

## What it does

- **Core interaction** — click any of the 64 sectors to dock; set a callsign +
  house (Voidrunners / Solaris / Rouge Signal); broadcast transmissions with a
  tone (toast / rumor / request / signal); cheer others with "buy a round".
- **Polished UI** — CRT scanlines + flicker, boot typing sequence, phosphor
  palette, blip-pulsing sector chart, scrolling relay ticker, station clock,
  WebAudio synth blips (no audio files) with mute toggle, toasts, `ctrl+↵` to
  send, responsive down to 375px, `prefers-reduced-motion` respected.
- **Share / export** — `⧉ SHARE` copies a link carrying your wire in the URL
  hash (`#c=…`, auto-merges on open); `.TXT` downloads a cantina log;
  `.JSON` exports the wire; per-message `⧉ quote` copies a pull-quote;
  `✕ BURN` (two-step) torches your own transmissions.

Persistence: everything lives in `localStorage` (`quartz-cantina-v1`).
Ships with 5 seeded NPC transmissions so the wire is alive on first load.

## Files

`index.html` · `style.css` · `app.js` — plus `SPEC.md` and this README.
Palette: phosphor green `#3df2a6`, amber `#ffb000`, signal rose `#ff5470`
on black `#04060a` / white `#eafff4`. Type: Orbitron + Share Tech Mono.
