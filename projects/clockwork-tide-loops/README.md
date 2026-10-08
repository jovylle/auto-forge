# Clockwork Tide Loops 🌊🕰️

A vaporwave **tidal clock garden**: plant looping chimes that bloom on each hour, synced to a rising/falling tide. All audio is synthesized live in WebAudio — no samples, no backend, works from `file://`.

## How to open

Open `index.html` in any modern browser (double-click works), or serve statically:

```
npx serve .
```

## What it does (all SPEC features)

- **Plant time-looped chimes** — pick a pentatonic seed note (always consonant), click an empty plot to plant. Each of the 12 plots owns one hour (`00:00`…`11:00`). Tap a bloom to ring it; `↻` cycles its loop length (2/4/8 beats); `✕` uproots it.
- **Tide-synced hourly blooms** — a tide engine rises/falls (60s true tide, 12s ⚡demo tide ON by default). High tide blooms **all** chimes in a staggered arpeggio with petal bursts; the top of every real hour blooms that hour's chime. `✺ BLOOM NOW` triggers one instantly — playable in under 30 seconds.
- **Shareable garden snapshots** — 📸 snapshot encodes the garden into a `#g=…` link (auto-copied), restores on open, saves to a localStorage gallery (click to regrow, right-click to delete), plus `.json` download.
- **Ambient loop mixer** — `▶ start the tide` launches a generated loop: detuned saw pad + gliding bass pulse + tide-breathing surf noise + your planted chimes as the arp. Per-channel volume/mute, master tempo (60–140 BPM).

## Notes

- Starter garden of 3 chimes is pre-planted so the first paint already sings.
- Garden autosaves to `localStorage`; shared `#g=` links override on load.
- Fonts load from Google Fonts with system fallbacks if offline.
