# Atlas Moth Wayfinder

A foggy-grid exploration game. Wander, uncover territories, reach the beacon.

## How to open
- Double-click `index.html`, or serve statically: `python3 -m http.server` then open the page.
- Works from `file://`. No build, no npm, no keys.

## How to play
1. You start at the top-left; the beacon waits at the bottom-right.
2. The map is shrouded in fog. Walking reveals tiles around you.
3. **Tap a lit tile** to walk there (pathfinding over revealed ground).
4. Every tile you step on is claimed — marked with a moss dot.
5. Reach the beacon before the 30-second timer runs out.
6. **Mini-map** (right) shows revealed/claimed ground; the **compass** needle points to the beacon.

## Easter egg
A hidden tile somewhere in the fog. Find it for a secret toast.

## Files
`index.html` · `style.css` · `app.js`
