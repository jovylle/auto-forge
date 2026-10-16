# Ochre Badger Bureau — Field Dossier Desk

A keyboard-first, Memphis-styled **case-file desk** for life's small mysteries.
File dossiers (vanishing biscuits, suspicious pigeons…), work the in-tray queue,
stamp verdicts **APPROVED / SHELVED / DENIED**, then share or export the ledger.

## How to open

No build, no server, no dependencies. Either:

- Double-click `index.html`, or
- Serve statically: `python3 -m http.server --directory .` then open `http://127.0.0.1:8000/`

Works from `file://` and any static host. State persists in `localStorage`.

## What it does

- **Core interaction** — file dossiers (title, department, priority, field notes);
  search (`/`), filter chips, 4 sort orders; navigate the queue with `J`/`K` or
  arrow keys; stamp verdicts with `1`/`2`/`3` (slam animation + fullscreen flash);
  shred with `X` (toast offers Undo).
- **Polished UI** — Memphis identity: ochre dot-grid, chunky 3px borders, hard
  offset shadows, rotated stickers, zigzag divider, inline-SVG badger badge,
  toasts, stamp-slam micro-animation, `prefers-reduced-motion` respected.
- **Share/export** — copy share link (whole ledger base64url-encoded in `#d=`
  hash; opening it prompts to load), copy Markdown summary, copy single case
  note, download JSON, download CSV, import JSON, print ledger stylesheet.

## Keyboard map

| Key | Action |
|-----|--------|
| `N` | New dossier |
| `/` | Jump to search (`Esc` clears) |
| `J`/`K`, `↑`/`↓` | Move in queue |
| `Enter` | Open focused dossier |
| `1` `2` `3` | Stamp Approved / Shelved / Denied |
| `X` | Shred dossier (Undo offered) |
| `?` | Shortcuts panel |
| `Esc` | Close dialog |

Every action is also a focusable button/field in the `Tab` order — shortcuts are
accelerators, never the only path. Skip link, `listbox` queue with
`aria-activedescendant`, native `<dialog>`s, visible focus rings throughout.

## Constraints

- **System fonts only** — no `@import`, no webfonts, no external URLs at all.
- **Keyboard only** — verified: all flows operable without a pointer.

## Files

- `index.html` — structure + dialogs
- `style.css` — Memphis theme, responsive (verified at 375px), print stylesheet
- `app.js` — desk logic, persistence, share/export (ES module, zero deps)
