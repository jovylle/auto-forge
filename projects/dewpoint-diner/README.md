# Dewpoint Diner

A 4 AM roadside diner that only opens when the air hits dewpoint. A single-page
glassmorphism sim in plain HTML/CSS/JS — no build, no backend.

## How to open

- Double-click `index.html`, or
- serve statically: `python3 -m http.server` in this folder, then open `http://localhost:8000/`

Works from `file://` and any static host. Google Fonts `@import` needs internet;
the diner is fully playable offline with fallback fonts.

## The three features

- **Dew menu** — 8 condensed-nightly dishes (Mist Stack, Foggy Joe, Puddle Pie…).
  Each dish tracks ❋ popularity that climbs every time a guest is served it.
- **Diner sim** — a live climate model: air temp falls through the night while the
  dewpoint drifts with humidity. Pump **mist** to cool the air toward dew, or run
  **patio heaters** to dry it out. When the spread hits ≤ 0.5°, the neon OPEN sign
  flickers on and guests arrive at 4 stools + 2 booths. Tap a guest to serve their
  order: you bank the price plus a patience-based tip in the jar. Walkouts leave
  thirsty. **Close up** starts a fresh night (day counter++).
- **Regulars board** — locals auto-pin themselves on their first visit (visits,
  favorite dish tracked). ♥ to pin a fave, add newcomers + notes via the form.
  Sorts faves first, then by visits.

## Sound

100% synthesized WebAudio, zero assets: two-sine order-up chime, triangle tip
chirp, filtered-noise seat thump, detuned-saw doors-open swell. Created on first
pointerdown (autoplay-safe); ♪ toggle in the header mutes. Persisted.

## Persistence

Coins, tips, night, mute, menu popularity, and the full regulars board live in
`localStorage` under `dewpoint-diner-v1`.

## Layout

Asymmetric tri-column (`96px 1.6fr 1fr`): vertical dewpoint tube → L-shaped
counter floor → stacked menu-over-regulars with mirrored irregular radii.
Collapses to a single column under 900px; honors `prefers-reduced-motion`.
