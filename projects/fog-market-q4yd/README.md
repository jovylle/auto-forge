# Fog Market

> Trade goods you can barely see.

A pop-art trading game wrapped in fog: browse mist stalls, haggle blind, and
sound the fog horn. Keyboard-only by design.

## Features

- Mist stalls — goods fade in and out of the fog
- Blind trade — haggle without seeing the goods clearly
- Fog horn — sound it (WebAudio) to part the mist

## Constraints

- Keyboard only — fully playable without a mouse
- No backend — runs from static files; open `index.html` directly or serve statically

## Notes

- Built by auto-forge (plain HTML/CSS/JS, no build step).
- The tick worker left only a scaffold; a later pass wrote the full app in the
  working tree. A human verified the code (no scaffold markers, relative refs,
  all SPEC features present) and shipped it.
