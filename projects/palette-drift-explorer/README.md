# Palette Drift Explorer

Explore drifting color palettes and gradients with live controls and exportable swatches.

## How to open
Open `index.html` in any modern browser (works from `file://` or a static host). No build step, no dependencies.

## What it does
- **Live palette slider** — drag the Base Hue slider; the whole palette (swatches + gradient) re-rolls instantly.
- **Gradient drift animation** — the hero canvas continuously drifts through the palette; speed slider + pause toggle.
- **Copyable hex codes** — click any swatch to copy its hex (with a chime).
- **Contrast checker** — pick foreground/background swatches, see WCAG ratio + AA/AAA/Large badges with live preview.
- **Export PNG** — downloads a 1000×600 PNG of the current palette + contrast readout.

Sound on every interaction via WebAudio (no assets).

## Files
`index.html`, `style.css`, `app.js`.
