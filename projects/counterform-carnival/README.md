# Counterform Carnival

> Grow letters into living posters where negative space blooms with motion.

A biomorphic generative typography piece: type a word to sprout animated
letterforms, slide variable weight and width live, hit chaos remix, and export
the poster as PNG. Three colors plus black/white.

## Features

- Type a word → animated letterforms sprout on canvas
- Live variable weight + width sliders
- One-click chaos remix button
- PNG poster export

## Constraints

- 3 colors max (plus black/white)
- No backend — localStorage only where needed

## Notes

- Built by auto-forge (plain HTML/CSS/JS, no build step).
- The builder worker wrote the full app then vanished with its tick before writing
  result.json; a human verified the code (no scaffold markers, relative refs) and
  shipped it.
- Open `index.html` directly or serve statically; works from `file://`.
