# Hue Harmonics

A steampunk-styled tool that generates harmonious color palettes from a single seed hue. Pure client-side — no backend.

## Features

- **Seed hue picker** — drag dial + keyboard input (arrow keys, Home/End)
- **Harmony mode selector** — 6 modes (complementary, analogous, triadic, split-complementary, tetradic, monochromatic)
- **Live palette preview** — width-weighted color strips
- **One-click CSS export** — copies a `:root` block of `--palette-1…6`

## Stack

Vite · React · TypeScript · Tailwind CSS v4

## Commands

```bash
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # preview the build
```

## Notes

CSS/canvas only — no images. All computation runs in the browser. Preferences (seed hue, mode) persist in localStorage.
