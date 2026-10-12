# Tallow Moth Terminal

> Moths gather at the candlewax terminal.

A click-only pixel-art social terminal. A candle burns at the top of the page;
moths drift in to perch, visitors drip wax seals onto the board, and everyone
talks over a click-to-send moth radio. No keyboards. No dragging. Every act is
a tap.

## Features

- **Wax board** — stamp new wax-seal notes in three wax colors (blood-red,
  ember, plum) with a stepped drip animation + screen shake; tap any seal to
  melt it open and read the missive, tap again to reseal. MELT ALL / RESEAL ALL
  included. Seals land staggered and rotated in 90° steps — no perfect grid.
- **Moth arrivals** — light/dim the lamp; while it burns a new pixel moth
  flutters in every ~7s (2-frame `steps()` sprite animation, 6 species with
  generated names). CALL A MOTH for an instant arrival. Tap any moth to greet
  it: hop animation, spark ping, a wave in the chat, and a personal reply.
- **Terminal chat** — click-only radio: tap one of 8 phrase chips to broadcast;
  a perched moth answers a beat later. Scrolling log, CLEAR STATIC, unread
  chip flash on greet.

## Constraint compliance

- **One interaction type: CLICK.** There are zero text inputs, textareas,
  selects, draggable elements, or keyboard handlers — every feature (posting,
  greeting, chatting, resetting) is a `<button>`.
- **Easter egg:** tap the candle flame **5 times** (within ~2.5s windows) to
  summon **THE GREAT LUNA MOTH** — green dither wash, stepped descent, four
  secret lines in the chat, and a permanent LUNA: BLESSED badge. After
  unlocking, Luna perches in the arrivals rail forever.

## Pixel-art system

- Palette: soot `#1C0E0B`, plum `#3B2447`, seal red `#8C2B2B`, tallow gold
  `#D9A441`, moth cream `#E8D5A3`, flame butter `#FFE9A8`, luna green
  `#8FD18C` (reserved for the egg). No indigo/gray/white defaults.
- Type: **Press Start 2P** (labels/buttons) + **VT323** (chat/body) via Google
  Fonts `@import`.
- Techniques: octagon-clipped wax seals, CSS `box-shadow` pixel sprites,
  checkerboard dither instead of gradients, scanline overlay, `steps()`
  keyframes everywhere, zero `border-radius`.
- Asymmetric skyline layout: arrivals rail left, dominant staggered board
  center, chat column right pushed down ~120px; live event ticker under the
  header; `prefers-reduced-motion` support.

## Run it

```bash
npm run build    # tsc + vite build -> dist/
npm run preview  # serve the production build
```

State (seals, moths, chat, lamp, Luna blessing) persists in `localStorage`
under `tallow-moth-terminal:v1`. SNUFF ALL (RESET) in the footer clears it.

Base path is `./` so the build can be hosted under any subpath.
