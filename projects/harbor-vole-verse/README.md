# Harbor Vole Verse

Dock voles squeak out shipping forecasts. A steampunk single-page experiment: no build, no backend, works from `file://`.

## Open

Double-click `index.html`, or serve statically:

```sh
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

## What it does

- **Tide verses** — pick tide / cargo / mood, hit *Stoke & Versify*. A grammar engine writes a 3-line harbor telegram with typewriter effect, telegram number, omen line, and live gauge updates (tide, wind, boilers).
- **Vole choir** — 5 voles (Bosun, Gasket, Pippa, Rivets, Sump), each a WebAudio squeak voice. Click/keyboard to audition, mute per vole (persisted), tempo slider, parade vs sea-shanty mode, and *Conduct choir* sings the current verse syllable-by-syllable with boiler-pressure meter.
- **Forecast export** — copy to clipboard, download ship's log (`.txt`) or manifest (`.json`), plus a persistent logbook (localStorage, reload/delete entries, auto-kept on export, double-click telegram to keep).

## Craft notes

- Palette: brass `#c9a227`, rust `#8a3b1f`, harbor-teal `#2f6f6a` + ink `#14100a` / parchment `#f5ead0` (3 colors max + black/white; all translucent fills derive from these).
- Type: IM Fell English + IM Fell English SC + Special Elite via Google Fonts `@import`.
- Brass-plate masthead with rivets, spinning gears, steam-pipe divider, stamped telegram card; responsive down to 375px; `prefers-reduced-motion` respected.
