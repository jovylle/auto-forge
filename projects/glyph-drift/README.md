# Glyph Drift — Bauhaus Kinetic Poetry

Kinetic letterforms swirl into poems you steer with your cursor.

## Open

No build, no server. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works from `file://`. Google Fonts needs network; offline it falls back to system sans.

## What it does

- **Cursor-reactive kinetic letters** — the cursor is a red vortex ring: glyphs orbit, repel, and swell near it. Hold / press to invert the swirl and pull letters in.
- **Type-to-spawn word particles** — every keystroke bursts a letter from the cursor; `Space`/`Enter` commits the whole word with an outward flourish. The poem strip gathers committed words.
- **Font-morph art exporter** — MORPH slider blends Space Grotesk → Archivo Black (weight, slant, wobble, shape backdrops), AUTO-MORPH oscillates it, and **↓ PNG / ↓ SVG** freeze the current field to a downloadable artwork.
- **Ambient poetry presets** — MANIFESTO / NIGHT DRIFT / CONCRETE / DADA word-banks auto-emit drifting words on a timer (FLOW toggle). Preset + morph + trail persist in localStorage.

Extras: SWIRL toggle, TRAIL (fade length) slider, CLEAR, COPY POEM, ✳ burst button, touch support, 375px layout.

## Constraint check

3 colours max + black/white: Bauhaus red `#E30613`, blue `#1A56CC`, yellow `#F2B705`, ink `#111111`, paper `#F4F1EA`/`#FBFAF6` (whites). No other hues anywhere, including canvas and SVG export.
