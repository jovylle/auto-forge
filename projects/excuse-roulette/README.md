# EXCUSE ROULETTE — 言い訳ルーレット

Spin for a plausibly deniable excuse. A Japanese-cyberpunk spin-wheel game that runs on pure denial & neon.

## What it does

- **Spin wheel** — hit the glowing 回 hub (or the SPIN AGAIN button, or press Space/Enter) to throw the wheel. It decelerates with a back-ease wobble, ticking through segments, then locks onto a category.
- **Believability meter** — a 10-LED gauge fills to your excuse's believability score (0–99%). Scores are seeded by category (a train delay is far more deniable than "the cat ate my meeting") plus luck — and repeating the same excuse sinks your credibility by 14% each time.
- **Copy excuse** — one click copies the formatted alibi (category + quote + score) to your clipboard.
- **Denial Archive** — every spin is logged to a local terminal-styled history (persisted in localStorage, capped at 12 rows).

## Open it

Just open `index.html` in a browser. No build step, no server, no dependencies — works from `file://` and any static host.

## How it reacts to scroll

The page is one long neon scroll. Scrolling drives a global `--sc` (0→1) signal that:
- tilts the wheel arena in 3D (perspective `rotateX`),
- lifts the synthwave grid floor and parallaxes the sun + kanji layers,
- shifts the hero out of frame,
- fills the vertical SIG meter in the corner.

## Files

- `index.html` — structure, background layers, terminal, log
- `style.css` — japanese-cyberpunk theme, scanlines, LED meter, scroll wiring
- `app.js` — canvas wheel, spin physics + WebAudio ticks, believability scoring, clipboard, localStorage archive

## Notes

- System fonts only (no webfonts) — heavy system sans for display, mono for the terminal.
- Play with sound on for the spin ticks; audio is optional and fails silently.
- Aesthetic: neon pink `#ff2a6d`, cyan `#05d9e8`, violet `#7b2ff7`, lime `#d6ff3f` on void navy.
