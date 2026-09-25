# Orbit Spring Atelier ✦

A dark-fantasy gravity loom. Pluck the veil's springs to loose singing motes, then bend their hymns with living gravity wells.

## How to open

Just open `index.html` in a browser (double-click works — no server, no build). Or serve statically: `python3 -m http.server` in this folder.

## What it does

- **Drag-and-fling slingshot** — drag on empty dark, aim with the dotted prophecy-arc, release to fling a mote.
- **Tunable gravity wells** — two stars by default (up to 5). Drag the ◎ glyphs to move them; per-well mass sliders + global star-pull in the side panel. Persisted to localStorage.
- **Spring-mesh collisions** — a verlet "veil" net sags across the lower sky. Motes bounce off its threads (restitution + mesh excitation + impact tones). Drag the veil to pluck it; flick-release births a mote with your flick's velocity.
- **Singing** — every mote is a pentatonic voice (Web Audio, no files): pitch bends with gravitational curvature and speed. Mesh impacts pluck notes. A feedback-delay chapel adds the cathedral.
- **One-click loop export** — ❖ EXPORT LOOP records 8s of canvas video + live audio via MediaRecorder and downloads `orbit-spring-loop.webm`.

## Controls

- `space` — pause the stars · side panel — G, veil tension, trail length, choir/glow toggles
- Works at 375px wide (panel stacks below canvas, sparser veil mesh).

## Constraint

Single self-contained `index.html` (only external ref is a Google Fonts `@import`).
