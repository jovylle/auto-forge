# GLASS ORCHARD

A grow-light merge chamber in a glass greenhouse. Drop glowing seeds into a 5×8 board; equal fruits merge and glow, and the ripe ones pulse for harvest. Feed the lamps, brighten the aura, chase the best yield.

Stack: plain HTML + CSS + JS (ES modules). No build step, no dependencies, works from `file://` or any static host.

## Open it

Just open `index.html` in a browser. No server needed. (A quick `python3 -m http.server` works too if you prefer.)

## What it is

- **Merge board** — 5 columns × 8 rows. Drop a seed (one of 3 cultivar colors) into any column; it falls to the lowest free cell. Two equal fruits that touch — same color AND same stage — merge into one and glow brighter. Stages: **PITH → BUD → RIPE**.
- **Greenhouse glow** — each cultivar is a spectrum (SOL FIG amber, FROST PEAR cyan, NOVA PLUM magenta). Merging/picking charges that lamp and its ambient aura. The three lamps + room glow are the only colors in the piece (the constraint), everything else is black/white/terminal chrome.
- **Harvest score** — grow a fruit to **RIPE** and pick it to bank the harvest. Score climbs with every merge (+5 bud, +20 ripe) and pick (+40). Your best yield persists in `localStorage`.

## Controls

- **Click a column** to drop the current seed.
- **Click a pulsing (ripe) fruit** to pick it.
- Keyboard: **← / →** pick column, **SPACE / ↓ / Enter** drop, **R** reseed.

## Rules

- Drop to lowest free cell in the chosen column (gravity).
- Merge only same color + same stage fruits that are touching (side or below).
- When two **RIPE** fruits merge, they are harvested instantly for +130.
- Chamber is full → game over; press **RESEED** for a fresh bed.

## Files

- `index.html` — markup + HUD
- `style.css` — sci-fi-terminal theme, greenhouse frame, glow animations
- `app.js` — game logic: drop, gravity, merge, pick, score, persistence

Design constraint honored: 3 colors max (plus black/white) — three cultivar spectra over a monochrome terminal interface.