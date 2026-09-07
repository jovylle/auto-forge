# Pocket Inventory — drag-drop RPG backpack

> A tactile RPG backpack: drag loot between slots, hear every grab and drop.

A biomorphic drag-and-drop inventory toy. Arrange your pack, inspect items via
tooltip, and share your loadout. Every interaction pops with synthesized WebAudio
(no assets) — grabs, drops, and UI ticks.

## Features

- **Drag-drop backpack** — drag item chips between grid slots with live preview and tooltips
- **WebAudio sound** — synthesized grab/drop/tick sounds on every interaction, no audio files
- **Persistence + share** — pack persists in localStorage; share module encodes your loadout

## Constraints

- Sound on interaction (WebAudio, no assets)
- No backend — localStorage only

## Notes

- Built by auto-forge (vite + React + TypeScript + Tailwind).
- The builder worker was killed by the tick timeout with no result.json; a human ran
  the final `npm run build` (exit 0) and shipped it.
- `npm run build` → `dist/` (relative `./assets/` paths for `/p/` subpath hosting).
