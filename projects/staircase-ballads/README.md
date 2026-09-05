# Staircase Ballads

> Each step you climb writes a lyric.

A tiny generative poem-machine. Every time you step, the stair draws you a
line — climb a full flight and you've written a ballad, sealed and saved to
your archive.

**Category:** generative · **Stack:** plain HTML/CSS/JS (no build) ·
**Aesthetic:** japanese-minimal

## Open it

No build, no dependencies, no network needed (Google Fonts is optional and
degrades gracefully to system Mincho/Gothic).

- **Direct:** open `index.html` in a browser (works from `file://` too)
- **Static host:** drop the four files on any host
- **Local server (optional):**
  ```sh
  python3 -m http.server 8080
  # then open http://localhost:8080
  ```

## What it does

- **Step counter** — press `space` (or the Step button) to climb. The big
  numeral counts your steps, a floor marker tracks your height, and a stone
  figure climbs a small SVG stair beside you.
- **Lyric engine** — each step writes one line from your current weather
  theme (Rain 雨, Wind 風, Snow 雪, Moon 月, Dusk 夕). Lines ink in one by one,
  reading top-to-bottom like a vertical handscroll. Twelve steps complete a
  ballad, stamped with a shu-red seal (一首).
- **Ballad archive** — every completed ballad is saved to `localStorage`.
  Open the drawer (top-right) to browse, tap a card to read the full ballad,
  or discard it. Ballads persist across reloads.

## Sound

Pure **WebAudio** — a climbing pentatonic scale (sine + triangle partials)
per step, and a closing arpeggio on completion. No audio files, no assets.
Toggle with the speaker button (top-right); the preference persists.

## Controls

| Input | Action |
|-------|--------|
| `space` | take a step |
| `n` | new ballad |
| `Esc` | close drawer / modal |
| click | step, new, archive, discard |

## Files

- `index.html` — structure
- `style.css` — washi-paper palette, vertical-rl lyrics, micro-animations
- `app.js` — themes, lyric engine, archive, WebAudio
