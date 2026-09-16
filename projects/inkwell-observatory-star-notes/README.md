# Inkwell Observatory — star notes

A grungy field journal of the night sky. Every note you write becomes a **star**;
every tag becomes a **constellation** (dashed lines join kin stars on the canvas).

Open `index.html` directly in a browser (works from `file://`, no build, no npm).
Google Fonts loads via `@import` when online; offline it falls back to monospace.

## Use it

- **Pin a star:** press `N`, write title + note + tag + magnitude, `Ctrl+Enter`.
  Or click anywhere on the dark sky to choose the landing site first.
- **Wander:** click a star, or focus the sky and use `←→↑↓` (nearest-star navigation).
  `Enter` reads, `E` edits, `D` twice burns.
- **Logbook:** every star is also a keyboard-focusable list item (screen-reader friendly).
- **Search / filter:** `/` focuses search, dropdown filters by constellation tag.
- **Drift (`R`):** charts a random stray star when you're stuck.

## Share / export

- **Share (`S`):** copies a link with your whole sky base64-encoded in the URL hash.
  Opening the link rebuilds the sky.
- **PNG (`P`):** snapshots the canvas. **MD button:** downloads the logbook as Markdown.
- **Persist:** sky auto-saves to `localStorage`. Purge button burns everything (with confirm).

## Constraints

- **Sound on interaction:** all tones are synthesized WebAudio (pin chime, select blip,
  burn descend, share arpeggio). No audio files. `M` mutes.
- **Keyboard only:** full operation without a mouse — skip links, focusable canvas
  (`role=application`), real buttons/list, `?` help dialog, `Esc` always backs out,
  `aria-live` toast announces every action.

## Files

`index.html` · `style.css` · `app.js` — plus this README. That's the whole observatory.
