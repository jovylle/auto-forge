# Pebble Moth Orbitbox

Slingshot moths around gravity wells to collect stardust in **60 seconds**. Pop-art physics arcade, zero deps.

## How to open
- Double-click `index.html`, or serve statically: `npx serve .` / `python3 -m http.server`
- Works from `file://` (Google Fonts needs network; game works offline regardless).

## What it does
- **Drag-to-launch slingshot**: drag back from the yellow NEST (bottom-left), dotted line previews the gravity-bent orbit, release to fling. Moths live 12s — chain many at once.
- **Movable gravity wells**: two wells (pink + blue). Drag them anywhere mid-flight; moths screaming past make them pulse. Shuffle button re-scatters them.
- **60-second stardust run**: white stars = 1★, golden comets drift and = 5★. Timer, score, best (localStorage), end-of-run POW! panel with relaunch.
- **Springy particle trails**: every moth drags a 26-link spring chain (pink/cyan ribbon) + square confetti bursts, floating "+5 COMET!" / "GULP!" comic captions, WebAudio blips with mute.
- **Must react to scroll**: page scroll drives gravity 0.6×→2.1× (HUD "ORBIT PRESSURE" meter, top progress bar, canvas hue shift + starfield parallax). Scroll down = heavy wells, up = floaty.

## Files
`index.html` · `style.css` · `app.js`
