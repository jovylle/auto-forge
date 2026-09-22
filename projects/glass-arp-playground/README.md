# Glass Arp Playground — 硝子アルペジオ

Tap glass tiles to weave pentatonic arps with shimmering delay trails.

## Open

No build, no server needed. Either:

- double-click `index.html`, or
- serve statically: `cd projects/glass-arp-playground && python3 -m http.server 8000`

Works from `file://` and any static host. Google Fonts `@import` needs network for the ideal type, but the toy works fully offline with serif/sans fallbacks.

## What it does

- **16-tile tap arpeggiator** — tap a tile to light it (auditions its note immediately). Press play and a gold-ringed playhead steps through all 16 in order; lit tiles sound their scale degree. 4×4 grid, keyboard `1–8` / `Q–I`, spacebar toggles play.
- **Drag tempo + feedback sliders** — tempo 60–180 bpm (eighth-note steps; delay time auto-tracks as a dotted-eighth-ish trail), feedback 0–85% into a damped (lowpassed) delay loop for shimmer without harsh buildup.
- **One-tap scale randomizer** — 🎲 picks a new root + Japanese-flavored pentatonic (Yo 陽, In 陰, Hirajoshi 平調, Iwato 岩戸, Kumoi 雲井, Minor 羽), relabels all tiles, and sparkles the new scale ascending.
- **Record 8s loop export** — captures the master bus (tiles + echo) via `MediaRecorder`, shows a live 8s progress bar, then gives you an `<audio>` preview + downloadable `glass-arp-loop.webm` file.

Also: demo pattern + clear buttons, pattern/tempo/scale autosaved to `localStorage`, falling-petal ink-wash canvas (respects `prefers-reduced-motion`), responsive down to 375px.

## Sound design

100% WebAudio, zero assets: each pluck is sine + quiet octave-up triangle through an exponential decay envelope, into a master bus with compressor, a lowpass-damped feedback delay (3200 Hz), and a `MediaStreamDestination` for recording. `AudioContext` is created lazily on first tap (autoplay-policy safe).
