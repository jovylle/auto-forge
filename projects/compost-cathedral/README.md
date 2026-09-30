# Compost Cathedral

> Raise a cathedral from compost.

Single-file vaporwave builder game — one `index.html`, no build, no backend. Open it from `file://` or any static host.

## Open

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` then visit the URL.

## What it does

- **Rot piles** — 3 piles (αlpha / βeta / γamma). Toss scraps (+mass), turn the heap (+heat). Hotter piles rot faster into **humus**. Live kg / rot% / +/s meters, steam puffs, feast-all + turn-all buttons.
- **Spire builder** — spend humus on 5 tiers: Foundation Crypt → Nave Arch → Rose Window → Twin Spires → Golden Cupola. The cathedral stacks visually in the nave; completing all five consecrates it (+100 humus bonus).
- **Humus choir** — each raised tier awakens a voice (Bass → Seraph). Begin chant starts a generative WebAudio drone (oscillator + lowpass + LFO per voice); chanting blesses rot (+50% yield). Hymn burst plays an arpeggio and grants bonus humus. Volume slider, floating verses, bouncing choristers.

Game loop ticks every frame (~0.55·mass·rot humus/sec), autosaves to `localStorage` (`compost-cathedral-v1`), responsive down to 375px, vaporwave chrome title / striped sun / perspective grid / scanlines.
