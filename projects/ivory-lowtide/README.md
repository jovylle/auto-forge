# Ivory Lowtide

> Read the tide in shades of ivory.

A Bauhaus tide instrument: harbour staff, ivory disc gauge, 24-hour chart and a lowtide alarm — on ivory paper with red/blue/yellow ink.

## Features

- **Tide reader** — live height (synthetic harmonic M2+S2+K1 model in feet), rising/falling/slack state, next high + next low with countdowns.
- **Ivory chart** — 24h ink curve with now dot, yellow threshold band, click curve or hour chips to inspect any hour; sticky scrub readout.
- **Lowtide alarm** — click-only threshold stepper (±0.1 ft) + LOW/MID/HIGH presets + arm toggle, persisted to `localStorage` (`ivory-lowtide`); disc ring pulses red and status panel flips to LOWTIDE when the tide drops below the line.

## Constraints

- **Must react to scroll** — global scroll progress drives the disc scrub mode, chart marker travel, staff parallax, shape drift, sticky readout and circle-wipe reveals.
- **One interaction type: click (+ scroll)** — every control is a `<button>`; no text inputs, no range sliders, no drag. Staff ticks scroll to chart hours on click; disc clicks toggle Now/Next-peak.

## Run

```sh
npm run dev      # vite dev
npm run build    # vite build (dist/ uses relative ./assets paths)
npm run preview  # serve dist
```

No backend, no keys. Tide is synthetic and local.
