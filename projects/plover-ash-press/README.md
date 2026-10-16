# Plover Ash Press

> Shorebirds print poems in volcanic ash. A retro-wave letterpress experiment.

## Open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works from `file://` and any static host. Google Fonts load via `@import` when online; system-font fallbacks apply offline.

## What it does

- **Ash press** — Pull the lever (or hit `Space`). The platen slams, ash bursts across the sky canvas, a plover walks the beachline pecking lines onto the sheet, and the poem typewriter-reveals with a WebAudio clunk + surf. Ash-fall slider controls ambient ash + printed grain; uncheck "dust the sheet" for clean type.
- **Plover poems** — Generative poems from 4 compositor plovers (Piping/wistful, Snowy/spare, Kentish/rust-red, Wilson's/brash) × 4 tide-moods × 1–5 stanzas. Edition numbers persist; "Set new type" re-rolls.
- **Print export** — "Print broadside" opens a clean ink-on-paper `@media print` layout (paper/PDF); plus **PNG poster** (1080×1350 sunset canvas render), **.txt** download, and copy-to-clipboard. Kept prints hang on the **drying line** (localStorage, reprint/remove).

## Easter egg 👻

The press hides a **Ghost Edition**: Konami code (`↑↑↓↓←→←→BA`), typing `ash`, or tapping the striped Ash Sun **5 times**. The whole press goes phosphor-violet and a Ghost Plover sets type. (There's also a console note.)

## Files

`index.html` · `style.css` · `app.js` · `README.md`
