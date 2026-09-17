# Reverb Reef — Steampunk Tide-Pool Groove Engine

Tap glowing polyps to layer loops into a tide-pool groove.

## How to open
No build, no server needed. Just open `index.html` in a browser (double-click works — `file://` safe, no fetched assets except an optional Google Fonts `@import` with serif fallbacks).

## What it does
- **Tap reef creatures to trigger samples** — six brass-bound beasties (Iron Puffer = kick, Gear Crab = snare, Brass Jelly = hats, Clockwork Eel = bass, Steam Nautilus = arp, Copper Anemone = bubble). All sounds are synthesized live with WebAudio — zero audio files.
- **Layer loops with tide-cycle sequencer** — each creature has a LOOP valve; armed tracks play their row on a 16-step moon-dial sequencer with tide phases (FLOOD/HIGH/EBB/LOW), tempo 70–140 BPM, tap-to-carve steps. Patterns persist in `localStorage`.
- **Twist reverb and delay tentacles** — REVERB ABYSS (generated-impulse convolver), DELAY KELP (feedback delay), plus a BOILER DRIVE saturator bonus. Styled as brass tentacle dials.
- **Export your reef jam as WAV** — renders 4 tide-cycles through an `OfflineAudioContext` that mirrors the live FX chain, encodes 16-bit PCM, downloads `reef-jam.wav`.

## Constraints
- **3 colors max (+black/white):** brass `#c9a227`, verdigris teal `#2f9e8f`, oxide rust `#b5542d`, on ink `#14100b` / parchment `#f6eed6`. All shading is opacity, never new hues.
- **Easter egg:** press the third boiler-gauge rivet ("DO NOT PRESS") five times, or type `k r a k e n` — the Kraken awakens with a foghorn swell and remixes your tide.

## Files
`index.html` · `style.css` · `app.js` — responsive down to 375px, `prefers-reduced-motion` respected.
