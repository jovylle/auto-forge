# Glass Orchard — fruit merge

A quiet, Suika-style fruit merge played inside a single drawn glass. Extreme-minimal: warm bone paper, hairline ink vessels, and muted glass-toned fruit orbs with specimen numbers. No images, no external fonts — everything is drawn on canvas from the system font stack.

## Play

Open `index.html` in any browser (works from `file://` and any static host). No build, no install, no network.

- **Move** the pointer to aim — a dashed guide and a ghost fruit show where it will fall.
- **Click** (or **Space**/**Enter**) to drop the next fruit.
- **←/→** nudge the aim with the keyboard.
- Two fruit of the same size merge into the next one up — chains build combos (`×2`, `×3`…).
- Fill the glass to the rim and it cracks: game over.

## Features

- **Core interaction** — aim-and-drop physics in a rounded glass vessel: gravity, pairwise circle collisions, squash on impact, merging with combo scoring, chain reactions.
- **Polished UI** — letter-spaced uppercase labels, thin rules, ghost aim guide, merge pop-rings, floating score text, soft WebAudio blips (drop/merge/crack, no assets), a hint line that pulses, and a results card when the glass is full.
- **Share / export** — **Share** copies a score card to the clipboard (and opens the native share sheet where available); **Save** exports the current orchard as a 2× PNG. Best score and games played persist in `localStorage`.

## Files

- `index.html` — structure
- `style.css` — extreme-minimal styling (system fonts only)
- `app.js` — canvas game, physics, audio, share/export (plain JS, no deps)

Verified at desktop, 375px, and 320px widths with zero console errors and no horizontal overflow.