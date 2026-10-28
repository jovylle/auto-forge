# Cinder Quail Kinetic

Type words that explode into kinetic particle letterforms you can fling and remix. Extreme-minimal poster toy.

## Open

No build, no server needed. Either:

- Double-click `index.html` (works from `file://`), or
- Serve the folder: `python3 -m http.server` → http://127.0.0.1:8000

## What it does

- **Type-to-burst** — every keystroke explodes into a physics letter with an ember spark burst (mobile: use the `type` pill; desktop: just type).
- **Drag + fling** — grab any letter, throw it; velocity is preserved on release. Letters bounce off the floor and walls with gravity + air friction.
- **Font-morph slider** — one slider morphs the whole field: `sans light → serif italic → mono black` (weight 300→900, width + lean interpolate; system fonts only).
- **Settle / Scatter / Clear** — `Settle` flows letters into centered poster rows for a clean composition; `Scatter` re-bursts everything; double-click the canvas also remixes.
- **Export PNG** — renders a 1200×1500 poster (letter layout, ember accents, glyph count footer) and downloads it.
- Persists letters + morph setting in `localStorage`; reopens where you left off.

## Constraints

- 3 colors max (+black/white): paper `#FAFAF7`, ink `#141414`, ember `#E8442E` (alpha variants only).
- System fonts only, zero external requests. Works at 375px width.
