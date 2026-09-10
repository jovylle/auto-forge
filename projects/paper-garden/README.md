# Paper Garden — 折り紙の庭

Fold origami flora that blooms on click. A quiet, generative paper garden rendered as hand-folded paper with crease lines, lit by a single wash of color per bloom.

## How to open

No build step. Open `index.html` directly in a browser (works from `file://` and any static host), or serve the folder:

```bash
cd projects/paper-garden
python3 -m http.server 8000   # then visit http://localhost:8000
```

## What it does

Three features, one calm interaction model — tap the paper.

- **Fold engine** — every bloom is folded live on a canvas. Petals start as folded-down crease lines, then unfold open (an ease-out-back bloom) when tapped, with paper-rustle + plucked koto sound. Stems, leaves, washi-paper color, fold shading, and a soft cast shadow are all computed per-face from the fold geometry.
- **Bloom garden** — click open ground to plant a flower (each plant grows from a unique random seed; seeds are deterministic, so the same seed always folds the same flower). Click a bloom to re-bloom it. A swaying stem, petal drift, and a ground bed sit under a hand-drawn ensō circle.
- **Seed sharing** — the whole garden (seed + position per bloom) is encoded into a shareable `#g=...` link, or you can paste a single seed code to plant one flower. `#s=<seed>` also grows a specific bloom. Everything persists to `localStorage`, and `New` rolls a fresh seed.

## Controls

| Action | Mouse / touch | Keys |
|---|---|---|
| Plant a flower | tap the paper | `Space` / `Enter` |
| Unfold a bloom | tap a bloom | — |
| New seed | toolbar · 新 | `N` |
| Share garden | toolbar · 共 | `S` |
| Plant from seed | toolbar · 植 | `P` |
| Sweep garden | toolbar · 消 | `C` |
| Day / night | toolbar link / seal | `D` |
| Sound | toolbar · 音 | `M` |

**Easter egg:** type `sakura` — a petal storm sweeps the garden.

## Design

Japanese-minimal: an off-white washi ground, a hand-brushed ensō, a vermilion hanko seal (紙), Shippori Mincho + Zen Kaku Gothic type, vertical-rail marginalia, restrained accent color per bloom, and a day/night inversion that brings fireflies out at night.

Everything is plain HTML/CSS/ES-module-free JS with zero dependencies.