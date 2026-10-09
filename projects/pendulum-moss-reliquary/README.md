# Pendulum Moss Reliquary

Grow mossy clock-trees where each branch loops yesterday's chimes into ambient melodies.

## Open

Just open `index.html` in a browser (double-click works — `file://` safe, no build, no deps).
Tip: click anywhere / press a button once to unlock sound (browsers require a gesture for WebAudio).

## What it does

- **Plant seed-clocks that chime hourly** — `✚ PLANT SEED-CLOCK` grows a mossy clock-tree with a live minute-hand and swinging pendulum. Every tree rings on the real hour; `◉ RING THE HOUR` strikes now for demo purposes.
- **Loop history into generative melodies** — first run is pre-seeded with "yesterday's chimes" (24 hourly strikes). `▶ LOOP HISTORY` plays all un-pruned branches low→high as an endless bell loop with tempo + mist (lowpass) controls and an optional drone.
- **Prune branches to remix time** — click any branch/bud on the canvas to snip it (its note drops out of the loop); click the stump to regrow. Shears section: snip random, regrow all, fell tree, reseed yesterday.
- **Share garden as ambient soundscape** — `⧉ COPY SOUNDSCAPE LINK` compresses trees + cuts + tempo into a `#garden=` URL hash; anyone opening it hears your hours. Also `DOWNLOAD SCORE (.json)`.

## Constraints

- 3 inks only: bone `#E4DCC8` · moss `#6F7D2C` · rust `#A83A26` (+ black/white).
- **Reacts to scroll**: the garden stage is sticky — scrolling drives wind (pendulum sway), day-night tint, melody filter drift, and lights up the chime strata as you dig.

## Notes

- Persists in `localStorage` (`pendulum-moss-reliquary-v1`). `✕ BURN GARDEN` wipes it.
- 375px-safe responsive layout; `prefers-reduced-motion` respected.
