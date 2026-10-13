# Yew Sparrow Seminary — 雀の寺

Train sparrows in an ancient yew seminary, high on the mountain.

## How to open

No build, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder, then open the shown URL.

## What it does

A japanese-minimal folk game in three chapters, climbed by scrolling:

1. **Perch classes** (`#perches`) — Four novice sparrows (expandable to six) each sit in one of three halls: 暁 Dawn Chant (Voice), 静 Stillness Zazen (Stillness), 翔 Wing Liturgy (Wing). Perched sparrows grow every temple tick; **attend** gives a personal lesson (25s rest after); **feed** spends grain for +2 everywhere; **recruit** spends grain to welcome waiting sparrows.
2. **Sermon trials** (`#trials`) — Pick a champion and ring the bell: a 3-round timing game where you strike as the brush sweeps through the golden moment (the light narrows each round; `Space` works). Score = devotion × Voice power. Earns grain + score, recorded in the Book of Honors.
3. **Seminary score** (`#score`) — Training + sermons weighed into one score with seven ranks from 雛 Hatchling to 国宝 Living Treasure, sealed with a hanko stamp, plus a ledger and reset.

Progress persists in `localStorage`.

## Scroll reactions (constraint)

Scrolling *is* the climb: the sky shifts dawn→dusk via `--sp`, petals thicken with depth, torii/enso parallax in opposite directions, the ink pilgrim rail fills with lit chapter dots, sections reveal, the trial bell sways with scroll velocity, and the header names your station on the path (麓 → 山門 → 庭 → 奥の院).

## Files

`index.html` · `style.css` · `app.js` · `SPEC.md`
