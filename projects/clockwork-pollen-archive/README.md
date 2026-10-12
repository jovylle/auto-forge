# ⚙ Clockwork Pollen Archive

Breed clockwork bees that pollinate looping hours into blooming timelines. A pop-art generative garden.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` then open `http://localhost:8000/index.html`.
- Works from `file://` — no build, no backend. Google Fonts `@import` needs internet but degrades gracefully offline.

## What it does
- **Hatch clockwork bees** — Hatch 1 or ×5 (max 12). Each bee rolls a genome: ink, speed, wobble, appetite, gear teeth. Cards show stats + pollen meter; ✕ releases a bee.
- **Pollinate hour blooms** — 12 blooms on a clock dial. Bees auto-pollinate on proximity (POW! bursts, pollen particles); click any bloom card (or the canvas flower) to hand-pollinate +4.
- **Loop evolving garden** — The hand sweeps a loop (~26s at 1×, speed 1–5×, pause, or FORCE LOOP). On seal: honey banks, a timeline column etches, top-4 blooms seed the next generation with petal/ink/ring mutations, slowest bee retires, wild bees join.
- **Export time honeycomb** — Live hex preview (1 hex = 1 hour, fill = pollen). PNG exports a poster (header + garden + honeycomb); JSON exports genomes/archive. Reset rewinds. State persists in `localStorage`.

## Palette (3 inks + black/white)
`#FF2E88` MAGENTA · `#FFC700` VOLT · `#2B50E0` ULTRA · `#0A0A0A` + `#FFFDF5`. No other hues anywhere (CSS + canvas verified).
