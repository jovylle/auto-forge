# Ghost Antenna

> Leave messages for strangers' radios.

Tune across the FM band and pull ghost transmissions out of the static. Lock onto a
signal to decode its message, then broadcast your own words onto the ether for some
other lonely listener to find. No accounts. No backend. Your signal lives in `localStorage`.

## Play (30 seconds)

1. **Drag the dial** — or tap the ruler, or use `←`/`→` — to scan the band.
2. When you land within a station's channel the static clears and the message **decodes**.
3. Open **your channel** and hit **broadcast** to put a message on the air (101.3 MHz).
4. It shows up on the **signal board** stamped "you", and stays until you replace it.

## Features

- **Message tuner** — a rotatable knob, a tick-ruled frequency ruler, and a glowing
  needle. Pointer drag, tap-to-position, and keyboard stepping all work; haptic buzz on mobile.
- **Static viz** — a canvas CRT full of animated white noise that thins out as you lock a
  frequency, with a roll bar and scanline overlays for the tube feel.
- **Signal board** — a torn-paper receipt sheet of signals you've heard, each with
  callsign, frequency, message, and a strength meter.

## How it works

- Ether stations are **seeded per day** (`lib/stations.ts`) so the band is stable for 24h —
  same stations, same messages, same callsigns for everyone who opens the app.
- Locked signals are decoded character-by-character with garbled noise (`Decode.tsx`).
- Your broadcast is persisted to `localStorage` (`lib/storage.ts`); the received-log is
  persisted too, capped at 30 entries.
- Fully client-side: React 19 + Vite + Tailwind v4, no network calls, no API keys.

## Aesthetic

Grunge radio: near-black chassis (`soot`), cream paper (`bone`), three signal hues —
phosphor green, ember orange, ether purple — plus black/white. CRT wobble, torn-paper
panels, film grain, a marquee ticker, and stamped "BROADCAST" feedback. Respects
`prefers-reduced-motion`.

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build (tsc -b && vite build)
npm run preview  # serve the built output
```

The app is deployed from `dist/` (relative asset paths, so it works from any subpath).