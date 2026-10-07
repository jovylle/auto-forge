# Saffron Circuit

Wire a glowing spice-route circuit board. Place settlements, solder traces, ride the monsoon pulses.

## Use

- **Place (1)** — click the board to drop a source / relay / sink node.
- **Trace (2)** — click node A, then node B to solder a trace.
- **Drag (3)** — reposition nodes live; traces follow.
- **Lift (4)** — click a node or trace to remove it.
- **Space** toggles power; **Del** removes the selected node; **Esc** cancels.

Sources emit pulses that travel every trace; arrival flashes the destination node and
increments the delivered counter. Tune **Flow** (pulse speed) and **Glow** (bloom),
fire a **Surge**, or load the Triangle / Grid / Loop preset boards.

## Share / export

- **Copy link** — board state is encoded into the URL hash; opening the link restores it.
- **PNG** — snapshots the live canvas.
- **JSON** — full export / import of nodes + edges.

Boards also persist in `localStorage` automatically.

## Stack

Vite + React + TypeScript + Tailwind CSS v4. Canvas 2D rendering, no backend.
System fonts only; palette is saffron `#f5a623`, signal `#2dd4bf`, alert `#ff5a5f`
on near-black `#0a0d12` plus white — glassmorphism panels throughout.
