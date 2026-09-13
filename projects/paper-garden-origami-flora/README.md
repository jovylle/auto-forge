# Paper Garden — origami flora

A grunge generative garden. Fold paper flowers, **scroll to raise the sun** and bloom them.

## How to open

No build, no server needed — open `index.html` in a browser (double-click works;
plain `<script>` is used so it runs from `file://`). Or serve statically:

```sh
python3 -m http.server 8000
# → http://127.0.0.1:8000/index.html
```

## What it does

- **Core interaction** — click the dirt to plant the selected seed; pick 1 of
  4 species (crane lily, shuriken, lotus bomb, weed star), 5 paper stocks
  (kraft, newsprint, rust, moss, xerox), folds (5–12 petals), wind, size.
  Gust button kicks up a ripped-page storm; night toggle forces darkness.
- **Scroll = sunshine (constraint)** — the garden canvas is sticky while five
  zine chapters (dawn → noon → storm → dusk → night) scroll past. Scroll
  position drives the sun arc, sky/soil palette, bloom speed, and sows a
  themed wave of flowers per chapter via IntersectionObserver. HUD shows
  sun phase, bloom count, scroll %.
- **Share/export** — `save PNG` downloads the canvas; `share` copies a link
  with the whole garden encoded in `#g=` (opens as a shared garden).
  Auto-persists to localStorage; `raze` (two-click confirm) clears the bed.
- Canvas 2D, seeded RNG per flower, DPR-aware, `prefers-reduced-motion`
  respected, no horizontal scroll at 375px, zero console errors.
