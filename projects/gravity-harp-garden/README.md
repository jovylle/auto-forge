# Gravity Harp Garden

A cyberpunk generative instrument. Seven neon gravity strings hang in a rain
of particles — bend a string, let the rain strike it, and grow the performance
into tiny shareable **seed loops**.

## Open

No build, no server, no keys. Either:

- double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open the URL.

Works from `file://`. Google Fonts load when online, system fonts when not.

## Play

- **Drag a string** sideways to bend it; release and the spring snaps back with a pluck.
- **Particles** fall on their own and pluck whatever string they strike.
  `∴ PARTICLE SHOWER` (or `space`) drops a burst.
- Each string is tuned to a scale (`A-MINOR PENTA`, `D-DORIAN NEON`,
  `HIRA-JOSHI GRID`). Bend amount detunes the pluck ± for expression.
- Sound: pre-rendered Karplus-Strong pluck samples through a dub delay.
  Press `⏻ POWER AUDIO` first (browsers require a gesture).

## Seed loops

1. Press `● REC` (`R`), play for a few seconds, press `R` again.
2. The loop lands in the active seed slot (`Z X C V` switch slots, 4 total).
3. Press `▶ LOOP` (`P`) to replay it. Loops + slots persist in `localStorage`.
4. `COPY` (`S`) puts the seed code in the box + clipboard — send it to a
   friend. `PLANT` (`L`) grows pasted seed code into the active slot.

## Keyboard only

Full map in the `KEYBOARD MANUAL` panel (`H`):

`1`–`7` pluck · `←`/`→` select · hold `↑`/`↓` or `A`/`D` to bend, release to
snap · `space` shower · `R` record · `P` play · `Z X C V` slots ·
`S` copy seed · `L` plant seed · `M` mute. Everything is a real button, so
`Tab` reaches it all, and a live region narrates plucks/saves.

## Easter egg

There is a rumor about an old netrunner code (`↑↑↓↓←→←→BA`)… and a small
`▚` node in the footer that hums if you click it five times.

## Files

- `index.html` — HUD, stage, control deck
- `style.css` — cyberpunk theme (Orbitron + Share Tech Mono, scanlines, neon)
- `app.js` — spring physics, particles, WebAudio plucks, loop engine
