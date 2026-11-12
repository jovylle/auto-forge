# Drift Grid Cartographer

Draw, label, and share tiny hand-drawn grid maps in seconds.

## Features

- Drag to paint terrain (void, road, water, grass, sand, forest, peak)
- Drop labeled pins with custom names
- Export the map as PNG
- Undo/redo strokes, plus clear
- Easter egg: Konami code or seven clicks on the title

## Run

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Stack

Vite + React + TypeScript + Tailwind CSS (v4). No backend; all state in memory (export PNG to share).