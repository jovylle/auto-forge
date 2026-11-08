# Springy Particle Field

A Bauhaus-styled interactive canvas of spring-connected particles reacting to gravity and mouse pulls.

## Open
Open `index.html` in any modern browser (works from `file://` and static hosts). No build step, no dependencies.

## Controls
- **Drag** on the canvas to pull particles toward the cursor.
- **Spring stiffness** slider adjusts spring stiffness (affects neighbor and home springs).
- **Gravity** button cycles gravity direction (Down / Up / Left / Right).
- **Reset Calm** restores the grid and zeroes velocity.
- Keyboard: `g` flips gravity, `r` or `Space` resets.

## Easter egg
Type `bauhaus` on the keyboard to trigger a 4-second Bauhaus Mode where particles morph into circle / square / triangle clusters.

## Files
- `index.html` — markup
- `style.css` — Bauhaus palette and layout
- `app.js` — physics + rendering