# LANTERN//LEDGER — night journal

A sci-fi-terminal night journal. Write down what kept you awake, rate the night by
flame intensity, and keep a private history — all in your browser, no server.

## Open it

- Double-click `index.html` (works from `file://`), or serve the folder:
  `npx serve .` — then visit the printed URL.
- No build step, no dependencies, no network calls. Your entries live in
  `localStorage` on your own machine.

## What it does

**Core interaction**
- Write a night entry in a terminal-style editor (monospace, amber caret).
- Set **flame intensity** 1–5 (dim → blaze) — the mood of the entry.
- Autosaves your draft as you type; reloads it if you come back.
- Save entries into the journal; click any entry to read it back in a modal.
- Delete with a two-step "really burn?" confirm.
- Keyboard: `Ctrl/Cmd+Enter` or `Ctrl/Cmd+S` to save · `Esc` closes modals · `n` starts a new entry.

**Polish**
- CRT boot sequence, scanlines, vignette, flickering lantern glow, blinking cursor.
- Three-color palette (amber, green, ember) + black/white. System mono fonts only.

**Share / export**
- `export .txt` — download the current draft or an entry as a timestamped text file.
- `copy` — put an entry on your clipboard.
- `json` — export the whole journal as JSON.
- `share link` — builds a self-contained link with the entry encoded in the URL
  (`#ll=...`). Anyone who opens it sees a read-only shared view. No server involved.

## Files

- `index.html` — markup
- `style.css` — all styling (palette, CRT effects, responsive at 375px)
- `app.js` — storage, rendering, export/share, keyboard handling

## Design

- Aesthetic: **sci-fi-terminal**. Near-black CRT, warm amber light, green status chips.
- Colors: `#ffb84d` amber · `#5fd08a` green · `#ff6b4a` ember, on black/white.
- Type: system monospace stack (`ui-monospace`, SF Mono, Menlo, Consolas, ...).

---

*Built by auto-forge. Data stays in your browser.*