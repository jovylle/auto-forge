# Kinetic Type Playground 🌴

Type words that explode into animated kinetic typography art you can remix. Vaporwave edition.

## How to open

No build, no install, no backend. Just open the file:

- Double-click `index.html`, **or**
- Serve it statically: `python3 -m http.server --directory .` then visit `http://127.0.0.1:8000/`

Works from `file://` and any static host. Google Fonts load when online, with system-font fallbacks offline.

## What it does

- **Live kinetic text animator** — every letter animates individually on a canvas stage (synthwave sun, scrolling grid floor, twinkling stars) at 60fps.
- **Font presets** — CHROME (Orbitron), PLAZA (Monoton), MALLSOFT (Pacifico), LASER (Bebas Neue), ARCADE (Press Start 2P), WIDE (Unbounded), plus weight (300–900) and size sliders.
- **Motion presets** — WAVE, BOUNCE, GLITCH (with chromatic aberration), SPIN, EXPLODE, CASCADE, FLOW (rainbow), plus speed control.
- **Palette & FX** — 4 vaporwave palettes, glow / outline / grid / letter-trail toggles.
- **🎲 Randomize style** — one click remixes font, motion, palette, and FX with a slot-machine shake.
- **⬇ Export as GIF** — renders 24 frames (480×270, 12fps, 2s loop) with a self-contained LZW GIF encoder (zero dependencies) and downloads `kinetic-type.gif`.
- **Autosave** — your deck persists to `localStorage` and restores on reload.

## Easter egg 🥚

Type the word **vaporwave** into the text box (or enter the Konami code ↑↑↓↓←→←→BA) to engage **ａｅｓｔｈｅｔｉｃ ｍｏｄｅ**: rainbow-flow chrome, a glowing ring around the sun, and a floating banner. Press `Esc` to leave the chrome zone.

## Files

- `index.html` — stage + control deck markup
- `style.css` — vaporwave identity (chrome gradient type, neon deck, scanlines)
- `app.js` — animation engine, GIF encoder, easter egg, persistence
