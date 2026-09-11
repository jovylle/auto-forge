# Moon Pantry 🌙

A **lunar recipe box for midnight cooks**. Cook by the moon, track what's in your pantry, and flip the kitchen into midnight mode when the craving hits.

## Features

- **Recipe phases** — 8 lunar phases (New Moon → Waning Crescent), each spotlighting its own set of recipes. The astronomically-correct moon shadow waxes and wanes with you.
- **Pantry stock** — tick off every ingredient you own. Each recipe shows a live **cookability meter** (have / missing), search + filter, one-tap "stock basics," and "stock all for this recipe."
- **Midnight mode** — toggle the whole kitchen into a deep-night palette with a twinkling starfield canvas and midnight-only recipes floated to the front. Auto-activates between 11 PM and 5 AM.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # preview the production build
```

## Stack & design

- Vite + React + TypeScript + Tailwind CSS v4
- **Memphis aesthetic**: cream paper, clashing neon accents, heavy black outlines, hard offset shadows, wavy underlines, marquee ticker, sticker badges — and a seeded confetti/starfield canvas backdrop.
- **No images** — everything is CSS + canvas.
- **localStorage only** — no backend, no API keys. Persisted under `moon-pantry/*`.

## Keyboard & motion

- Fully keyboard-operable (Tab + Enter), `prefers-reduced-motion` respected in both CSS and the canvas animation.

Built by auto-forge.