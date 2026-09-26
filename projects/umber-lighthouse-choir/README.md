# Umber Lighthouse Choir

> A lighthouse that sings ships home.

Single-file generative toy (`index.html` — CSS + JS inlined, no build, no assets).
Open it directly: double-click `index.html` or serve the folder statically.

## What it does

- **Beam choir** — a rotating lighthouse beam. Eight headings, eight chords
  (Cm9 → Dm11). Drag to aim; the chord re-sings on each heading change.
  Click a ship (or hold the beam on it) to charge its homecoming ring;
  a full ring guides it home with an arpeggio + particle burst.
- **Fog voices** — fog-density slider (0–100). Denser fog narrows/dims the beam
  and swells four detuned low voices (sine/triangle + slow LFOs) through a
  feedback-delay "harbor echo". `fog swell` button (or `F`) runs a 2.5s swell.
- **Harbor log** — every guided / lost ship is logged with name, chord, time;
  guided/lost counts + luckiest chord stats. Persisted in `localStorage`
  (`umber-choir`), survives reload. Clear button included.

## Sound

WebAudio only, zero assets. Created lazily on first interaction
(click "enable sound", drag the beam, or press any button).
Choir = stacked detuned saws through lowpass; horn = square-stack blast;
guide = triangle arpeggio. Master ducks slightly in heavy fog.

## Keys

- drag = aim beam · click ship = sing it home · `F` = fog swell · `S` = sweep toggle

Works at 375px wide (responsive grid + canvas).
