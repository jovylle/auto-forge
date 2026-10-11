# Copper Finch Radio

> Trade dawn choruses with fellow finches.

A glassmorphism dawn-radio toy: tune the **dawn dial** to your favourite first light,
chirp an eight-note **chorus**, broadcast it, and get an answer back from the flock —
all perched on the **flock board**. No backend; songs live in `localStorage`.

## Features

- **Dawn dial** — drag the sun along its 4:00–7:00 AM track (or tap a Nightingale / Wren /
  Linnet preset). Time readout, dawn mood (Blue Hour → Gold Morning), light meter, and
  a "Sing this dawn" button that plays your phrase transposed by the hour. Pick a
  transmission perch (reeds / wires / pines) to tint every chirp.
- **Chorus trade** — 8-note sequencer (tap a note to cycle rest → C → D → E → G → A),
  WebAudio finch-chirp synth with echo, "Ask the wind" randomizer, and
  **Broadcast & trade**: your song perches on the board and a fellow finch instantly
  answers with a song of their own (play it, perch it).
- **Flock board** — all broadcasts with mini note-viz, dawn tags, likes, replay,
  filters (all / mine / loved), seeded with three visiting finches so the wires are
  never quiet.

## Constraints

- **Reacts to scroll** — a fixed sky canvas morphs night → sunrise as you scroll
  (stars fade, sun climbs, finches drift), glass orbs parallax, a progress rail names
  the phase (night / first light / sunrise / full chorus), and sections reveal on entry.
- **Playable in 30 seconds** — the hero "Catch the dawn in 30 seconds" button tunes,
  composes, and plays a chorus in one tap (~6 s of audio); a 3-hop flight checklist
  (tune → chirp → trade) tracks the whole loop.

## Run

```sh
npm run dev      # develop
npm run build    # production build (dist/, relative asset paths)
npm run preview  # serve dist/
```

Stack: Vite + TypeScript + Tailwind CSS v4. Sound: WebAudio oscillators only, no assets.
