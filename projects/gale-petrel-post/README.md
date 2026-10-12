# Gale Petrel Post — 嵐の郵便

> Storm petrels deliver mail on the gale.

A japanese-cyberpunk storm-mail exchange. Chart gale corridors, keep the petrel logbook, and stamp every parcel down the sky-road. No backend — all state lives in `localStorage` (`gpp-state-v1`).

## Features

- **Gale routes (航路)** — corridor cards with wind (kt), risk meter, haul distance, status cycling OPEN → GUST → LOCKED; sort by wind/risk/haul; chart new routes; one-tap dispatch creates a parcel on that route.
- **Petrel log (海燕簿)** — roster cards with wing-span, flight count, status (roost/aloft/moult); send aloft / roost, stamp flights, band & release birds; timestamped flight ledger.
- **Post tracker (追跡)** — frank parcels (auto `GPP-####` IDs) onto a route + petrel with priority; pipeline nest → aloft → landfall → delivered (or lost to gale, re-fly, burn); live search + status filter pills; exchange totals; stamp-slam celebration.

## Run

```sh
npm run build    # copies index.html, style.css, app.js → dist/ (relative paths)
npm run preview  # serves dist/ on :8151 (PORT=xxxx to override)
```

## Design

Japanese-cyberpunk: vertical kanji rail, skewed neon masthead with glitch hover, gale-streak canvas, marquee gale wire, offset asymmetric panels, stamp-slam + toast micro-interactions.

Palette (3 + black/white, hard constraint): neon `#FF2E88` · denki cyan `#00E5CC` · amber `#FFB300` · ink `#0B0B10` · paper `#F7F1E3`. No other hues anywhere.

Type: `Zen Kaku Gothic New` + `Share Tech Mono` via Google Fonts.
