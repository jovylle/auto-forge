# Yarrow Yodel Yard

> Yodel herbs into harmony.

An organic-brutalist yodeling game. A 5-herb choir (Yarrow, Sage, Thyme, Nettle, Mugwort) each holds a pentatonic note (C–D–E–G–A). Sing the 8-note phrase in order to wake the herbs, grow your **yard score**, and fill the **choir harmony** meter.

## How to open

No build, no backend. Either:

- Double-click `index.html` (works from `file://`), or
- Serve statically: `python3 -m http.server` in this folder, then open the page.

Google Fonts load via `@import` when online; the game works offline with system-font fallback.

## How to play

- **No mic:** hold **HOLD TO YODEL** and drag ↑/↓ to bend pitch, move the **yodel pitch** slider, or tap herb keys / keyboard `A S D F G`.
- **Mic:** press **🎙 enable mic**, then hum or yodel (needs https or localhost in Chrome/Edge).
- Land inside the glowing zone on the meter. Gold burst = perfect (±25¢).
- Wobble your pitch wide (or hold `Space` for the yodel break) while hitting for **YODEL ×2**.
- `↻ new phrase` replants the melody; **freestyle** mode scores any herb you wake.
- Best score persists in `localStorage`.

## Stack

Plain `index.html` + `style.css` + `app.js` (ES module, Web Audio + autocorrelation pitch detection). 3 colors (paper, moss, clay) + black/white.
