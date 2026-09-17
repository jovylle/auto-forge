# ◉ Cinder Ledger — ash accounts

Burn every coin. A bauhaus ember-and-ash expense ledger: **ember in** (income),
**ash out** (expenses) — the balance is what survives the fire.

## Use it

- **Stoke the ledger** — name an entry, set an amount, pick ▲ ember or ▼ ash,
  choose an account shape, and burn it in. `Enter` in the amount field works too.
- **Filter** — ◉ all / ▲ ember / ▼ ash chips above the list.
- **Burn entire ledger** — two-step confirm, reduces everything to ash.
- **Carry the cinders** — export CSV or JSON, copy a text share card to the
  clipboard, or import a previously exported JSON file.
- **Demo** — empty grate? Hit “strike demo cinders” for sample entries.
- **♪ toggle** — every touch makes a WebAudio sound (no assets); mute persists.

Everything persists in `localStorage` (`cinder-ledger:*`). No backend, no keys.

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4. Sounds are raw WebAudio
(oscillators + filtered noise). Fonts: Archivo Black / Space Grotesk /
Space Mono via Google Fonts.

## Develop

```bash
npm run build    # tsc -b && vite build (base './' for /p/<slug>/ hosting)
npm run preview  # serve dist/
```
