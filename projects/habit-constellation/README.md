# Habit Constellation

> Your habits as a star map.

A cyberpunk-themed single-page app where every habit you track becomes a star in
an interactive constellation. Log a habit each day and its star ignites with a
streak-driven neon glow; break the streak and the star gutters down to an ember.

Built as a **single React component** (`src/App.tsx`) with a custom cyberpunk
visual system in `src/index.css`.

## Features

- **Habit input** — terminal-style `> ` prompt row. Press Enter or `[ Log ]` to
  add a habit to the sky. Duplicate names are rejected; empty input is rejected.
- **Constellation viz** — a canvas night-sky maps each habit to a deterministic
  star position (stable across reloads), connected by dashed neon constellation
  lines. Background starfield twinkles; a synthwave perspective grid sits at the
  horizon.
- **Streak glow** — the signature bloom. A habit's node pulses with a layered
  corona (starlight core → cyan halo → violet corona) whose radius, hue, and
  intensity scale with streak length (cyan → violet as it grows). Broken streaks
  flicker ember and cool to gray cinders; never-logged habits stay dim starlight.
- **Stats strip** — total stars, stars currently lit, longest streak, total logs.
- **Keyboard only** — every interaction is a native `<input>`, `<button>`, or
  form submit: add habits with Enter, log today with Space/Enter on any row,
  delete with a dedicated button. Visible focus glow on all controls.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`), used for the `sr-only` utility; the
  visual system lives in custom CSS.
- Google Fonts: **Orbitron** (display) + **Space Mono** (body/mono).
- **No backend, no API keys.** All data persists to `localStorage` under
  `habit-constellation:v1`.

## Run

```bash
npm run dev      # local dev server
npm run build    # typecheck + production build → dist/
npm run preview  # serve the production build
```

`vite.config.ts` sets `base: './'` so the build works when hosted under a
subpath (e.g. `/p/habit-constellation/`). All asset references in `dist/` are
relative.

## Palette

| Token          | Hex       | Role                                   |
| -------------- | --------- | -------------------------------------- |
| `--void`       | `#05060F` | Deep space base                        |
| `--neon-cyan`  | `#00F0FF` | Primary neon — lines, focus, grid      |
| `--neon-magenta`| `#FF2BD6` | Secondary neon — prompt, accents       |
| `--violet`     | `#9D4EFF` | Nebula accent, streak hue target       |
| `--ember`      | `#FF6B35` | Streak break / warning flicker         |
| `--streak-green`| `#00FF9D` | Logged-today success state             |
| `--starlight`  | `#E8F7FF` | Star cores, brightest nodes            |