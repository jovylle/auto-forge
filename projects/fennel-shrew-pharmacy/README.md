# 🐭 Fennel Shrew Pharmacy

A tiny glassmorphism apothecary. Dial in drops of six botanicals over three
base spirits, brew the flask, and watch your tincture bubble to life on canvas.

## How to open

No build, no server needed — just open the file:

- Double-click `index.html`, **or**
- `python3 -m http.server` in this folder, then visit `http://localhost:8000`
- Works from `file://` and any static host.

## What it does

- **Core interaction** — compounding bench: 3 base spirits (Spring Water /
  Honey Syrup / Moon Spirit) + per-ingredient drop steppers (0–12). Brewing
  mixes the color, names the potion ("Lunar Dreamy Elixir"), scores potency,
  and fires a fizzing canvas animation (wave surface, rising bubbles, shake).
- **Polished UI** — glassmorphism: frosted cards over drifting gradient blobs,
  sheen sweep, bobbing shrew, potency meter, toasts, pop-in shelf. Responsive
  down to 375px. System fonts only, zero external assets.
- **Share / export**
  - 🔗 Copy link — recipe encoded in the URL hash (`#r=…`); opening it re-brews.
  - 🖼️ PNG card — exports a labeled 720×880 potion card.
  - ⬇️ JSON — downloads the recipe + color + notes.
  - 📚 Shelf — persists up to 24 recipes in `localStorage`, re-brew or delete.

## Files

`index.html` · `style.css` · `app.js` — plain HTML/CSS/JS, no bundler, no npm.
