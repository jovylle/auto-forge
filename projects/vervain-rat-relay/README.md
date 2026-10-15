# Vervain Rat Relay 🐀🌿

A vaporwave one-button timing game. Relay herb batons through rat-run tunnels.

## How to open

No build, no server needed — just open the file:

- **File:** double-click `index.html`, or
- **Static host:** serve this folder (`npx serve .`, `python3 -m http.server`, Cloudflare Pages, …)

Works from `file://` and any static host. No dependencies, no network calls.

## What it does

- **Tunnel legs (4):** NEON BURROW → CHROME SEWER → MIST ARCADE → PALM FINALE. Each leg's rat auto-runs its tunnel.
- **Herb batons (3):** VERVAIN (balanced), MOONMINT (fast, wilts fast), SAGESHADE (slow, barely wilts). Pick before each run.
- **Relay score:** tap **PASS** (or `Space`) inside the glowing gate. `PERFECT` / `GOOD` / `EARLY` ratings + remaining-freshness bonus + time bonus + all-perfect bonus. Fumbles bruise the herbs (−freshness, −50 pts). Best score persists in `localStorage`.

If the rat reaches the gate end without a pass, it waits and freshness drains — pass fast!

## Constraints

- 3 colors + black/white: `#ff71ce` `#01cdfe` `#b967ff` + `#0d0221` + white
- System fonts only, no external requests
- Playable at 375px width, `prefers-reduced-motion` respected
