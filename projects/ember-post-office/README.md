# Ember Post Office

A retro-wave night-shift sorting game. You are the clerk of the Ember Post Office:
glowing ember-mail parcels drift down with live physics — drag each one into its
district chute (**SOL ▲**, **VOLT ●**, **MAGMA ◆**) before its fuse ring burns out.

- **Core interaction:** 90-second shift, pointer drag + keyboard (`1/2/3` dispatch,
  clickable chute buttons), gravity/sway physics on canvas, fuse timers, combo
  multiplier, quota (12 sorts), mis-sort and burn-out penalties.
- **Polished UI:** retro-wave identity (deep violet ink, ember/magenta/cyan neon,
  Righteous display + Special Elite typewriter), self-typing dispatch ledger,
  combo rail, CRT scanlines, CSS-only sun, canvas particles (pooled, DPR-capped),
  WebAudio bleeps (no assets), `prefers-reduced-motion` support, responsive layout.
- **Share/export:** shift report panel — copy to clipboard, download `.txt`,
  Web Share API with clipboard fallback; best score + last-10 shift log in
  `localStorage`.

## Run

```sh
npm run build    # copies index.html/style.css/app.js → dist/ (relative paths)
npm run preview  # serves dist/ on :8137
```

No dependencies, no backend, no images (CSS/canvas only).
