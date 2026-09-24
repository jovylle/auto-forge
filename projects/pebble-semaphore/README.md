# Pebble Semaphore ｡･:*:･ﾟ★

A vaporwave flag-signal transmitter. Type a message, and a pebble golem on a
neon lagoon spells it out in semaphore — each letter dropping a pebble with
a ripple. Pose the arms by hand to compose signals one at a time.

## How to open

No build, no server needed. Either:

- Double-click `index.html`, or
- `npx serve .` / `python3 -m http.server` in this folder and visit the URL.

Works from `file://` (Google Fonts degrades gracefully offline).

## What it does

- **Transmit mode** — type A–Z / 0–9 in the Lagoon Scribe, hit Transmit, watch
  the figure flag each letter while pebbles pile up in the lagoon.
- **Manual signal deck** — rotate each arm through 8 compass positions and
  drop pebbles one by one; poses decode live against the signal chart.
- **Signal chart** — all 26 poses at a glance; focus/hover previews the pose.
- **Share / export** — copy a `#msg=…` link, copy the position-code
  transcript, export the figure as PNG, or download the transcript as `.txt`.
- Persists message + tempo to `localStorage`; loads messages from link hashes.

## Keyboard only (constraint)

Every action is keyboard reachable — all controls are native buttons/inputs
with visible focus rings, plus shortcuts:

| Key | Action |
|---|---|
| A–Z 0–9 | preview signal |
| Ctrl+Enter | transmit |
| → / Space | step / hold-resume |
| Z/X · N/M | rotate left / right arm |
| Enter | drop pebble |
| 1–4 | copy link · copy codes · PNG · .txt |
| Shift+Backspace | reset · Esc hold |

A live `role="status"` region announces every signal for screen-reader users.
