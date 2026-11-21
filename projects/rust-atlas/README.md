# Rust Atlas

**Log slow decay as a beautiful oxidation map.**

A retro-wave oxidation observatory. Every entry in the rust log is a corrosion site: name it, set how aggressively it corrodes, and watch a patina bloom grow on the live canvas atlas. Older, faster sites swell into crusty teal patina; fresh ones glow orange at the edges of the map.

Built with plain HTML, CSS and JavaScript — no build step, no dependencies, no backend.

## Open it

Double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works from `file://` as well as any static host. Everything is self-contained apart from the optional Google Fonts (Orbitron + Space Mono); without a network it falls back to system monospace/display faces.

## What it does

- **Rust log** — add a site with a name and a corrosion rate (1–10). Each entry shows its stage (Fresh → Blooming → Oxidized → Patina), age, and patina percentage. Five seeded sites are pre-aged so the atlas starts alive. Sites persist in `localStorage`.
- **Patina viz** — a live canvas map: retro sun, perspective grid, drifting stars, and lumpy, speckled oxidation blooms that grow with age and corrosion rate. The selected site gets a rotating amber ring. The map breathes gently unless `prefers-reduced-motion` is set.
- **Decay export** — `Export decay.json` downloads the full archive (position, rate, age in days, patina score, stage, timestamps). `Export map.png` downloads the current canvas at pixel density.

## Keyboard only

Every action is reachable without a mouse:

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Move between map, composer, log entries, exports |
| `↑` `↓` `←` `→` (on the map) | Move the placement crosshair (hold `Shift` for fine steps) |
| `Enter` / `Space` (on the map) | Anchor a new site at the crosshair, jump to the name field |
| `Enter` (in the composer) | Oxidize the site (drop the anchored position with `Esc`) |
| `Enter` (on a log entry) | Select that site and highlight its bloom |
| `Delete` / `Backspace` (on a focused entry) | Erase the site (asks for confirmation) |
| `Enter` (on an export button) | Download the archive or the map PNG |

Focus rings are visible throughout, and the status line is a polite live region for screen readers.

## Files

- `index.html` — layout and semantics
- `style.css` — retro-wave palette, chrome type, scanlines, responsive layout
- `app.js` — data model, canvas renderer, keyboard interactions, exports
- `.factory/result.json` — build result for the factory

## Notes

- Patina is calculated as `rate × age^0.62`, so decay is slow but compounding. Demo entries are backdated 12–340 days.
- Deleting every site leaves an empty atlas rather than re-seeding it; refresh won't bring the demo sites back unless storage is cleared.
- Canvas rendering caps at 2× device pixel ratio and animates at ~30 fps.
