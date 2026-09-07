// GHOST GRID — collaborative pixel haunt
// swiss aesthetic · plain JS · no build

const canvas = document.getElementById("grid");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const status = document.getElementById("status");
const toast = document.getElementById("toast");
const statPx = document.getElementById("statPx");
const statId = document.getElementById("statId");

// ---- grid config ----
const CELL = 14;            // px per cell
const COLS = 48;            // logical grid columns
const ROWS = 36;            // logical grid rows
const CELLS = COLS * ROWS;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

// ---- state ----
let ink = "#e6392e";
let tool = "paint";
let drawing = false;
let last = null;
let grid = new Uint32Array(CELLS).fill(0x0b0b0d); // 0xRRGGBB packed
let history = [];
let roomId = Date.now().toString(36).slice(-4).toUpperCase();
let scrollP = 0;            // 0..1 driven by wheel
let haunted = false;

const INKS = { "#e6392e": "RED", "#0b0b0d": "BLACK", "#f4f1ea": "WHITE", "#1d4ed8": "BLUE" };

// ---- sizing ----
function resize() {
  const stage = document.getElementById("stage");
  const availW = stage.clientWidth;
  const availH = stage.clientHeight;
  const cellW = Math.max(6, Math.floor(availW / COLS));
  const cellH = Math.max(6, Math.floor(availH / ROWS));
  const cell = Math.min(cellW, cellH);
  const W = COLS * cell;
  const H = ROWS * cell;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas._cell = cell;
  canvas.style.left = Math.floor((availW - W) / 2) + "px";
  canvas.style.top = Math.floor((availH - H) / 2) + "px";
  draw();
}
window.addEventListener("resize", resize);

// ---- drawing ----
function cellToPx(cx, cy, cell) { return [cx * cell, cy * cell]; }

function paintCell(cx, cy, color) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
  const idx = cy * COLS + cx;
  if (grid[idx] === color) return false;
  grid[idx] = color;
  return true;
}

function draw() {
  const cell = canvas._cell;
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
  // background paper
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, W / DPR, H / DPR);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y * COLS + x];
      ctx.fillStyle = "rgb(" + ((c >> 16) & 255) + "," + ((c >> 8) & 255) + "," + (c & 255) + ")";
      ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
    }
  }
}

function snapshot() {
  history.push(grid.slice());
  if (history.length > 60) history.shift();
}

function countPainted() {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] !== 0x0b0b0d) n++;
  return n;
}

// ---- pointer input ----
function posToCell(e) {
  const rect = canvas.getBoundingClientRect();
  const cell = canvas._cell;
  const x = (e.clientX - rect.left) / rect.width * (canvas.width / DPR);
  const y = (e.clientY - rect.top) / rect.height * (canvas.height / DPR);
  return [Math.floor(x / cell), Math.floor(y / cell)];
}

function strokeTo(cx, cy) {
  const target = tool === "erase" ? 0x0b0b0d : hexToInt(ink);
  let changed = false;
  if (last && (last[0] !== cx || last[1] !== cy)) {
    // draw a line between last and current for smooth drags
    const steps = lineCells(last[0], last[1], cx, cy);
    for (const [lx, ly] of steps) if (paintCell(lx, ly, target)) changed = true;
  } else {
    if (paintCell(cx, cy, target)) changed = true;
  }
  last = [cx, cy];
  if (changed) { draw(); statPx.textContent = countPainted(); }
}

function lineCells(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  for (;;) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  last = null;
  snapshot();
  strokeTo(...posToCell(e));
});
canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  strokeTo(...posToCell(e));
});
["pointerup", "pointercancel"].forEach((ev) => {
  canvas.addEventListener(ev, () => { drawing = false; last = null; });
});

// ---- palette ----
document.getElementById("swatches").addEventListener("click", (e) => {
  const sw = e.target.closest(".sw");
  if (!sw) return;
  document.querySelectorAll(".sw").forEach((s) => s.classList.remove("on"));
  sw.classList.add("on");
  ink = sw.dataset.ink;
  document.getElementById("inkRead").textContent = "INK · " + INKS[ink];
});

// ---- tools ----
document.querySelectorAll(".tool").forEach((btn) => {
  btn.addEventListener("click", () => {
    tool = btn.dataset.tool;
    document.querySelectorAll(".tool").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    status.textContent = tool === "erase" ? "ERASER · scrub pixels" : "PAINT · drag to haunt";
  });
});

// ---- undo / clear ----
document.getElementById("undoBtn").addEventListener("click", () => {
  if (!history.length) { flash("nothing to undo"); return; }
  grid = history.pop();
  draw();
  statPx.textContent = countPainted();
  flash("undo");
});
document.getElementById("clearBtn").addEventListener("click", () => {
  grid.fill(0x0b0b0d);
  history.length = 0;
  draw();
  statPx.textContent = 0;
  flash("grid cleared");
});

// ---- PNG export ----
document.getElementById("pngBtn").addEventListener("click", () => {
  const cell = 8;
  const W = COLS * cell, H = ROWS * cell;
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.fillStyle = "#0b0b0d";
  o.fillRect(0, 0, W, H);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const c = grid[y * COLS + x];
      o.fillStyle = "rgb(" + ((c >> 16) & 255) + "," + ((c >> 8) & 255) + "," + (c & 255) + ")";
      o.fillRect(x * cell, y * cell, cell, cell);
    }
  off.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ghost-grid-" + roomId + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    flash("png saved");
  });
});

// ---- share link ----
function packGrid() {
  const parts = [];
  let run = 0, runColor = null;
  for (let i = 0; i < CELLS; i++) {
    const c = grid[i];
    if (c === runColor) { run++; continue; }
    if (runColor !== null) parts.push(run + ":" + runColor.toString(16));
    runColor = c; run = 1;
  }
  parts.push(run + ":" + runColor.toString(16));
  return parts.join(".");
}
function unpackGrid(data) {
  const fresh = new Uint32Array(CELLS).fill(0x0b0b0d);
  let i = 0;
  for (const seg of data.split(".")) {
    const m = seg.split(":");
    const run = parseInt(m[0], 10);
    const color = parseInt(m[1], 16);
    for (let k = 0; k < run && i < CELLS; k++) fresh[i++] = color;
  }
  return fresh;
}
document.getElementById("copyBtn").addEventListener("click", async () => {
  const data = packGrid();
  const url = location.href.split("?")[0] + "?g=" + data + "&r=" + roomId;
  try {
    await navigator.clipboard.writeText(url);
    flash("link copied to clipboard");
  } catch {
    flash("copy blocked by browser");
  }
});

function hexToInt(hex) {
  return parseInt(hex.slice(1), 16);
}

// ---- load from URL ----
function loadFromUrl() {
  const p = new URLSearchParams(location.search);
  const g = p.get("g");
  const r = p.get("r");
  if (r) roomId = r.slice(0, 4).toUpperCase();
  if (g) {
    try { grid = unpackGrid(g); } catch {}
    statPx.textContent = countPainted();
    status.textContent = "loaded shared haunt";
  }
  statId.textContent = roomId;
}

// ---- scroll reactivity ----
let scrollTarget = 0;
window.addEventListener(
  "wheel",
  (e) => {
    scrollTarget = Math.max(0, Math.min(1, scrollTarget + Math.sign(e.deltaY) * 0.06));
    applyScroll();
  },
  { passive: true }
);
function applyScroll() {
  scrollP += (scrollTarget - scrollP) * 0.12;
  if (Math.abs(scrollTarget - scrollP) < 0.001) scrollP = scrollTarget;
  // move the scroll thumb down the rail
  const rail = document.querySelector(".scrollbar");
  const thumb = document.getElementById("scrollThumb");
  const max = rail.clientHeight - thumb.clientHeight - 58;
  thumb.style.top = 58 + scrollP * max + "px";
  // red intensity of the grid background pulse
  const redBoost = Math.round(scrollP * 40);
  document.body.style.setProperty("--bg", "rgb(" + (11 + redBoost) + "," + 11 + "," + 13 + ")");
  // subtle vertical skew on the canvas as you scroll deep
  canvas.style.transform = "skewY(" + (scrollP * 3) + "deg)";
  document.body.classList.toggle("scrolling", scrollP > 0.02);
  document.body.classList.toggle("zoom", scrollP > 0.6);
  if (scrollP > 0.9 && !haunted) summonGhost();
}
// smooth loop
(function raf() {
  if (Math.abs(scrollTarget - scrollP) > 0.001) applyScroll();
  requestAnimationFrame(raf);
})();

// ---- easter egg: KONAMI + ghost ----
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
let seq = [];
window.addEventListener("keydown", (e) => {
  seq.push(e.key);
  if (seq.length > KONAMI.length) seq.shift();
  if (seq.join(",") === KONAMI.join(",")) { seq = []; summonGhost(); }
});
function summonGhost() {
  if (haunted) return;
  haunted = true;
  document.body.classList.add("haunt");
  // scatter ghost haunts across random cells
  const ghost = document.getElementById("ghost");
  flash("you woke the ghost");
  status.textContent = "the grid is haunted";
  // make the red pulse on random pixels fade in/out
  const ghostTimer = setInterval(() => {
    if (!haunted) { clearInterval(ghostTimer); return; }
    const n = Math.floor(Math.random() * 8) + 4;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * CELLS);
      const old = grid[idx];
      grid[idx] = 0xe6392e;
      setTimeout(() => { if (haunted) { grid[idx] = old; draw(); } }, 260);
    }
    draw();
  }, 700);
}

// ---- toast ----
let toastTimer;
function flash(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
}

// ---- init ----
resize();
loadFromUrl();
status.textContent = "ready · drag on grid to haunt";
