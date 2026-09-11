# Static Picnic

A **radio potluck for passing strangers.** Tune a band of strange dishes, lay them out on a shared picnic rug, and grab a signal seat around the broadcast. All pop-art, all keyboard-friendly, all in your browser.

![aesthetic](pop-art)

## Features

- **Dish Tuner** — a radio dial (87.5–108 MHz) scanning a band of dishes left by passing strangers. Arrow keys tune (Shift-free, `Home`/`End` jump to band ends), `Enter` locks a station and brings its dish to the rug, `Esc` homes the dial. A live signal meter, static flicker, and onomatopoeia crackle sell the broadcast.
- **Picnic Board** — the potluck table. Locking a dish automatically lays out a plate; each stranger's dish gets a card (randomly tilted, like scattered dishes) and you can pin a note for the host. Persisted in `localStorage`.
- **Signal Seats** — a row of seats encircling the transmitter. Claim one with your name (or let a passing stranger sit), see your connection strength. Seats persist in `localStorage`.

## Easter egg

Tune **past the edge of the band** — way past 108 MHz, into the void — to find the hidden station **66.6 FM "THE VOID"**. The palette inverts and the screen fills with warm static. Keyboard-reachable via repeated → past the band end. `Esc` or the button returns you to the picnic.

## Keyboard-only

The entire app works without a mouse:

| Area | Controls |
|------|----------|
| Dish Tuner | `←`/`→` tune · `Home`/`End` jump · `Enter` lock · `Esc` home |
| Picnic Board | `Tab` to select/input, type a note, `Enter` to pin |
| Signal Seats | `Tab` to a seat, `Enter`/`Space` to claim · name field + "Claim a seat" button |

Visible `:focus-visible` rings on every control; `prefers-reduced-motion` is respected.

## Stack

- Vite 8 + React 19 + TypeScript (strict)
- Tailwind CSS v4 (`@import "tailwindcss"`)
- Google Fonts: **Bungee** (display), **Space Grotesk** (body), **Space Mono** (broadcast labels)
- No backend, no API keys — `localStorage` only

## Pop-art design system

- **Palette:** bone `#FFF4DC`, ink `#16130F`, hot pink `#FF2E88`, canary `#FFD23F`, acid green `#9CFF2E`, cobalt `#2B4CFF`
- Halftone/ben-day dots, sunburst rays, hard 3px ink outlines with offset (never blurred) shadows, speech-bubble crackles, tilted panels
- Asymmetric layout: dominant rotated tuner panel beside a tilting board, seats arcing below

## Commands

```bash
npm run dev       # local dev server
npm run build     # type-check + production build → dist/
npm run preview   # preview the production build
```

## Build note

`vite.config.ts` uses `base: './'` so `dist/` is deployable under any subpath.