// Looping Clock Garden
const canvas = document.getElementById("garden");
const ctx = canvas.getContext("2d");
const countEl = document.getElementById("count");
const speedVal = document.getElementById("speedVal");
const toastEl = document.getElementById("toast");

const PALETTE = ["#e30613", "#0055a4", "#ffed00", "#111111"];
const BG = "#f5f1e8";

let W = 0, H = 0, dpr = 1;
const COLS = 14, ROWS = 9;
let cellW = 0, cellH = 0;

let flowers = []; // {gx, gy, period, phase, colorIdx, born}
let speed = 1;
const SPEEDS = [0.5, 1, 2, 4, 8];
let speedIndex = 1;
let time = 0; // seconds (scaled)
let lastTs = null;
let cursor = { gx: Math.floor(COLS/2), gy: Math.floor(ROWS/2) };
let scrollFactor = 0;

// parallax decor
const decor = [];
for (let i = 0; i < 18; i++) {
  decor.push({
    x: Math.random(), y: Math.random(),
    r: 20 + Math.random() * 60,
    color: PALETTE[i % PALETTE.length],
    shape: i % 3,
    speed: 0.02 + Math.random() * 0.06
  });
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(rect.width);
  H = Math.floor(rect.height);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cellW = W / COLS;
  cellH = H / ROWS;
}
window.addEventListener("resize", resize);

function cellCenter(gx, gy) {
  return { x: (gx + 0.5) * cellW, y: (gy + 0.5) * cellH };
}

function plant(gx, gy) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
  // avoid duplicate at same cell
  const exists = flowers.some(f => f.gx === gx && f.gy === gy);
  if (exists) return;
  flowers.push({
    gx, gy,
    period: 2 + Math.random() * 6,
    phase: Math.random() * Math.PI * 2,
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    born: time
  });
  updateCount();
  saveLocal();
}

function clearGarden() {
  flowers = [];
  updateCount();
  saveLocal();
  toast("cleared");
}

function updateCount() {
  countEl.textContent = flowers.length;
}

// seed encoding
function encodeSeed() {
  const data = flowers.map(f => ({ g: [f.gx, f.gy], p: +f.period.toFixed(2), ph: +f.phase.toFixed(3), c: f.colorIdx }));
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function decodeSeed(str) {
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(str))));
    if (!Array.isArray(data)) return null;
    return data;
  } catch (e) { return null; }
}
function applySeed(data) {
  clearGarden();
  for (const d of data) {
    if (!d || !Array.isArray(d.g)) continue;
    const [gx, gy] = d.g;
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
    flowers.push({
      gx, gy,
      period: Math.max(0.5, Number(d.p) || 3),
      phase: Number(d.ph) || 0,
      colorIdx: Math.max(0, Math.min(PALETTE.length-1, Number(d.c) || 0)),
      born: time
    });
  }
  updateCount();
  saveLocal();
}

function saveLocal() {
  try { localStorage.setItem("lcgarden", encodeSeed()); } catch (e) {}
}

function loadLocal() {
  try {
    const s = localStorage.getItem("lcgarden");
    if (s) applySeed(decodeSeed(s));
  } catch (e) {}
}

async function shareSeed() {
  const seed = encodeSeed();
  const url = location.origin + location.pathname + "#" + seed;
  try {
    await navigator.clipboard.writeText(url);
    toast("seed copied to clipboard");
  } catch (e) {
    // fallback: show
    toast("seed: " + seed.slice(0, 24) + "…");
  }
  location.hash = seed;
}

function toast(msg) {
  toastEl.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.textContent = ""; }, 2200);
}

// rendering
function draw() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // parallax decor (reacts to scroll)
  const sf = scrollFactor;
  for (const d of decor) {
    const x = ((d.x * W) + sf * d.speed * 80) % (W + d.r*2) - d.r;
    const y = d.y * H + Math.sin(time * 0.3 + d.x*10) * 6 + sf * 0.05 * H;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = d.color;
    if (d.shape === 0) {
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI*2); ctx.fill();
    } else if (d.shape === 1) {
      ctx.fillRect(x - d.r, y - d.r, d.r*2, d.r*2);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - d.r);
      ctx.lineTo(x + d.r, y);
      ctx.lineTo(x, y + d.r);
      ctx.lineTo(x - d.r, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // grid
  ctx.strokeStyle = "rgba(17,17,17,0.12)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c*cellW, 0); ctx.lineTo(c*cellW, H); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r*cellH); ctx.lineTo(W, r*cellH); ctx.stroke();
  }

  // cursor highlight
  const cc = cellCenter(cursor.gx, cursor.gy);
  ctx.strokeStyle = "#0055a4";
  ctx.lineWidth = 2;
  ctx.strokeRect(cursor.gx*cellW + 2, cursor.gy*cellH + 2, cellW - 4, cellH - 4);

  // flowers
  for (const f of flowers) {
    const { x, y } = cellCenter(f.gx, f.gy);
    const age = time - f.born;
    const t = (time / f.period + f.phase / (Math.PI*2)) % 1;
    // bloom: 0..1 ramp then fade
    const bloom = 0.5 + 0.5 * Math.sin(t * Math.PI * 2); // 0..1
    const size = Math.min(cellW, cellH) * 0.38;
    const stemH = size * 1.6;
    const color = PALETTE[f.colorIdx];

    // stem
    ctx.strokeStyle = "#2a6b3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + stemH*0.5);
    ctx.quadraticCurveTo(x + 4, y, x, y - stemH*0.5);
    ctx.stroke();

    // petals
    const petals = 6;
    const petalR = size * (0.4 + 0.6 * bloom);
    ctx.fillStyle = color;
    for (let i = 0; i < petals; i++) {
      const ang = (i / petals) * Math.PI * 2 + time * 0.4;
      const px = x + Math.cos(ang) * petalR * 0.6;
      const py = y - stemH*0.5 + Math.sin(ang) * petalR * 0.6;
      ctx.beginPath();
      ctx.ellipse(px, py, petalR*0.5, petalR*0.25, ang, 0, Math.PI*2);
      ctx.fill();
    }
    // center
    ctx.fillStyle = "#ffed00";
    ctx.beginPath();
    ctx.arc(x, y - stemH*0.5, size * 0.18 * (0.6 + 0.4*bloom), 0, Math.PI*2);
    ctx.fill();

    // clock hand overlay (small)
    const handAng = t * Math.PI * 2 - Math.PI/2;
    ctx.strokeStyle = "rgba(17,17,17,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - stemH*0.5);
    ctx.lineTo(x + Math.cos(handAng)*size*0.9, y - stemH*0.5 + Math.sin(handAng)*size*0.9);
    ctx.stroke();
  }

  // speed badge in corner
  ctx.fillStyle = "rgba(17,17,17,0.06)";
}

function loop(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  time += dt * speed;
  draw();
  requestAnimationFrame(loop);
}

// input
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gx = Math.floor(x / cellW);
  const gy = Math.floor(y / cellH);
  plant(gx, gy);
  canvas.focus();
});

canvas.addEventListener("keydown", (e) => {
  let handled = true;
  switch (e.key) {
    case "ArrowUp": cursor.gy = Math.max(0, cursor.gy - 1); break;
    case "ArrowDown": cursor.gy = Math.min(ROWS - 1, cursor.gy + 1); break;
    case "ArrowLeft": cursor.gx = Math.max(0, cursor.gx - 1); break;
    case "ArrowRight": cursor.gx = Math.min(COLS - 1, cursor.gx + 1); break;
    case "Enter":
    case " ": plant(cursor.gx, cursor.gy); break;
    case "+":
    case "=": speedUp(); break;
    case "-":
    case "_": speedDown(); break;
    case "s":
    case "S": shareSeed(); break;
    case "c":
    case "C": clearGarden(); break;
    case "Escape": canvas.blur(); break;
    default: handled = false;
  }
  if (handled) e.preventDefault();
});

document.getElementById("speedUp").addEventListener("click", speedUp);
document.getElementById("speedDown").addEventListener("click", speedDown);
document.getElementById("share").addEventListener("click", shareSeed);
document.getElementById("clear").addEventListener("click", clearGarden);

function speedUp() {
  speedIndex = Math.min(SPEEDS.length - 1, speedIndex + 1);
  speed = SPEEDS[speedIndex];
  speedVal.textContent = speed + "×";
  toast("speed " + speed + "×");
}
function speedDown() {
  speedIndex = Math.max(0, speedIndex - 1);
  speed = SPEEDS[speedIndex];
  speedVal.textContent = speed + "×";
  toast("speed " + speed + "×");
}

// scroll reactivity
window.addEventListener("scroll", () => {
  scrollFactor = window.scrollY || 0;
}, { passive: true });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  scrollFactor += e.deltaY * 0.5;
}, { passive: false });

// load seed from hash
function loadFromHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return;
  const data = decodeSeed(h);
  if (data) applySeed(data);
}
window.addEventListener("hashchange", loadFromHash);

// init
resize();
loadLocal();
loadFromHash();
if (flowers.length === 0) {
  // starter
  plant(3, 3); plant(7, 4); plant(10, 2);
}
updateCount();
speedVal.textContent = speed + "×";
requestAnimationFrame(loop);

// expose for debugging
window.__garden = { flowers, plant, clearGarden };
