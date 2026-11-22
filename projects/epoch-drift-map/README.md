# Epoch Drift Map

Visualize how time zones drift across a world map in real time. Vite + React + TypeScript + Tailwind, extreme-minimal aesthetic.

## Features

- Live timezone offset overlay across a world map
- Daylight saving transition markers (click to focus a zone)
- Historical zone boundary playback (1970–2030, play/pause or scrub)
- Shareable snapshot link (encodes year + selected zone in the URL)

## Constraints

- Playable in 30 seconds
- 3 colors max, plus black/white (ink / bone / lag / lead / signal)

## Run

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build
npm run preview  # preview production build
```
