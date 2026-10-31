# Reed Fox Registry

A cottagecore field ledger for the foxes of the reed beds. Press every fox you meet into the book — coat, den, temperament, marks & a synthesized call.

## Open

- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`
- Works from `file://` — no network, no build, no keys.

## What it does

- **Core interaction:** add foxes (name, coat, reed-bed, call, shyness, traits, field note); `+ sighting` tallies repeat visits; `▶ call` plays a WebAudio-synthesized fox call (yip / trill / huff / yowl); release foxes back to the reeds.
- **Polished UI:** stitched ledger cards, wax-seal press animation, CSS fox sigils, fireflies, live tally (foxes / sightings / dens), search + coat filter + 3 sorts, deep-link highlight, print stylesheet, 375px-friendly.
- **Share/export:** copy per-fox card, copy whole-ledger tale, copy per-fox `#fox-id` link, export JSON + CSV downloads, import JSON file, localStorage persistence.

## Constraints

- 3 inks only: paper `#f6f1e3`, moss `#5a7247`, russet `#b4552d` (+ ink black / paper white).
- System fonts only (Georgia/Palatino serif + system-ui). No external fonts, no images.
