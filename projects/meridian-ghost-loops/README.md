# Meridian Ghost Loops

Loop tiny histories into layered clockwork melodies that decay with each passing hour.

A steampunk generative-music toy: record 8-second chime loops, stack them as
echoes on a canvas spiral timeline, share tick-synced mixes via link, and seal
everything each midnight in a reset ritual. Plain HTML + CSS + JS, no build,
no backend. Persistence via `localStorage`.

## How to open

Open `index.html` directly in a browser (`file://` works), or serve the folder
with any static host, e.g. `python3 -m http.server` and visit the shown URL.

Sound starts only after you press a button (browsers require a gesture for audio).

## What it does

- **Record 8-second time loops** — press *Record 8s loop* (or `R`); capture
  starts on the next loop downbeat. Strike the five chime keys (`A S D F G`,
  clickable/touchable) to inscribe notes, quantized to a 125 ms tick grid.
  Press *Start works* (or `Space`) to play; everything snaps to the 120 bpm
  escapement tick.
- **Stack echoes on a spiral timeline** — up to 6 loops turn as glowing arcs
  on a clockwork spiral (canvas only, no images). Each loop loses strength
  hourly (×0.8 per hour, shown as an echo meter); *Polish brass* restores a
  loop, *Muffle* mutes it, *Dissolve* erases it.
- **Share tick-synced mixes** — *Copy synced link* encodes all loops into the
  URL hash (`#m=…`). Opening the link docks the mix; pressing play snaps it to
  the next downbeat. *Mix scroll (.json)* downloads the mix incl. its link.
- **Midnight reset ritual** — live countdown to local midnight. The *Midnight
  ritual* button (or actual midnight, auto-detected) plays a sealing ceremony,
  archives loops into the *Vault of Midnights*, and starts the new day empty.

## Constraints honored

- 3 colors (brass `#d2a24c`, rust `#a85b2a`, parchment `#ead9ac`) plus black
  (`#120d06`) and white (`#fffdf4`); CSS/canvas only, zero images.
- Responsive down to 360 px wide; keyboard accessible; no console errors.

## Files

- `index.html` — structure
- `style.css` — steampunk theme (Cinzel + IM Fell English via Google Fonts)
- `app.js` — WebAudio engine, scheduler, spiral renderer, share + ritual logic
