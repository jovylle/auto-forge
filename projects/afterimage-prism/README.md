# Afterimage Prism

Explore color afterimages and complementary hues on an interactive canvas.

## Features

- Drag to mix hues (hue wheel + lightness/chroma sliders).
- Afterimage preview — hold Space to stare, then see the complementary hue.
- Perceptual contrast meter (APCA Lc, thresholds 60/75).
- Export palette PNG (1600×1000, mix + afterimage + committed swatches + Lc).

## Keyboard-only

Fully operable without a pointer:

- `Tab` focus the hue wheel (slider role).
- `←`/`→` hue ±1 (Shift ±10); `↑`/`↓` lightness ±0.01 (Shift ±0.05).
- `Enter` commit current swatch; `Esc` reset mix.
- `Space` (hold) stare to trigger the afterimage.
- Hue/chroma/lightness sliders and buttons are keyboard-focusable.

## Usage

1. Run `npm run dev` and open the printed URL.
2. Drag or adjust hue/lightness/chroma to mix a color.
3. Hold Space (or click stare) for ~4s to reveal the afterimage.
4. `Enter` to commit swatches to the palette (max 12).
5. "export palette PNG" downloads the palette with contrast readouts.

## Dev / build / preview

```sh
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build -> dist/
npm run preview    # preview the production build
```

Stack: Vite + React 19 + TypeScript + Tailwind CSS v4. No backend.
