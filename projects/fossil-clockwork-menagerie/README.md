# Fossil Clockwork Menagerie

Breed clockwork creatures that age, loop, and fossilize into generative history dioramas. Memphis-style, plain HTML/CSS/JS, no build.

## Open

Double-click `index.html`, or serve statically:

```sh
cd projects/fossil-clockwork-menagerie
python3 -m http.server 8123
# → http://localhost:8123/
```

Works from `file://`. No backend, no keys. Progress persists in `localStorage` (`fcm-v1`).

## What it does

- **Hatch ticking creatures (H / ⇧H)** — generative SVG beasts (body × palette × pattern × legs × chime note), each pulsing and ticking at its own rate.
- **Time-loop breeding (B)** — select 2 (click or `1`–`9`), breed to splice traits; parents grow younger, the loop counter advances with a flash + fanfare. `R` rewinds all ages.
- **Fossil timeline gallery (F)** — creatures age egg → hatchling → adult → elder, then fossilize into epoch-stamped diorama cards (motif, parents, loop/tick). `P` exports the fossil record as JSON.
- **Sampled chime soundscapes** — WebAudio-synthesized chimes (3-partial bell + echo), pentatonic pads (`Q W E R T`), tick/fossil motifs, toggleable drone (`D`), volume + echo sliders, master mute (`M`).

## Keyboard only

Every action has a key; everything is a real button/slider, Tab + Enter/Space works throughout. Press `?` for the field guide. Full list: `H ⇧H 1-9 0 B R F X C Q W E R T M D [ ] P ? Esc`.

## Easter egg

Type `ticktock` (anywhere, outside inputs) to hatch **Aurelius, the Chrono-Squid** — a golden six-legged legend with fanfare. Rumor of it hides in the `?` card and footer.
