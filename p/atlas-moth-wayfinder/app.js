// Atlas Moth Wayfinder
const SIZE = 9;
const REVEAL = 2;
const MOVE_MS = 115;
const TOTAL = 30;
const EASTER = { x: 4, y: 6 };

const map = document.getElementById('map');
const mini = document.getElementById('mini');
const ctx = map.getContext('2d');
const mctx = mini.getContext('2d');
const timeEl = document.getElementById('time');
const claimedEl = document.getElementById('claimed');
const toastEl = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg = document.getElementById('ovMsg');
const ovBtn = document.getElementById('ovBtn');
const needle = document.getElementById('needle');

let revealed = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
let claimed = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
let player = { x: 0, y: 0 };
const beacon = { x: SIZE - 1, y: SIZE - 1 };
let claimedCount = 0;
let remaining = TOTAL;
let running = false;
let animating = false;
let timerId = null;
let audioCtx = null;
let foundEaster = false;

// high-DPI canvas sizing
function sizeCanvas(canvas, cssSize) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.width = cssSize + 'px';
  canvas.style.height = cssSize + 'px';
  return dpr;
}

let mapCss = 420;
let dpr = 1;
function layout() {
  const stage = map.parentElement;
  const avail = Math.min(stage.clientWidth - 36, 420);
  mapCss = Math.max(260, avail);
  dpr = sizeCanvas(map, mapCss);
  // mini fixed
  const mdpr = sizeCanvas(mini, 144);
  mini._dpr = mdpr;
  draw();
  drawMini();
}
window.addEventListener('resize', layout);

function idx(x, y) { return y * SIZE + x; }
function inBounds(x, y) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }
function cheb(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

function reveal(cx, cy) {
  for (let dy = -REVEAL; dy <= REVEAL; dy++) {
    for (let dx = -REVEAL; dx <= REVEAL; dx++) {
      const x = cx + dx, y = cy + dy;
      if (inBounds(x, y) && Math.max(Math.abs(dx), Math.abs(dy)) <= REVEAL) {
        if (!revealed[y][x]) {
          revealed[y][x] = true;
          if (x === EASTER.x && y === EASTER.y && !foundEaster) {
            foundEaster = true;
            toast('you found the atlas moth');
            chime(660, 0.18);
          }
        }
      }
    }
  }
}

function bfs(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  const q = [[sx, sy]];
  const prev = new Map();
  const seen = new Set([idx(sx, sy)]);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (!inBounds(nx, ny)) continue;
      if (!revealed[ny][nx]) continue;
      const k = idx(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, idx(x, y));
      if (nx === tx && ny === ty) {
        // reconstruct
        const path = [];
        let cur = k;
        while (cur !== idx(sx, sy)) {
          const cx = cur % SIZE, cy = Math.floor(cur / SIZE);
          path.unshift({ x: cx, y: cy });
          cur = prev.get(cur);
        }
        path.unshift({ x: sx, y: sy });
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function claim(x, y) {
  if (claimed[y][x]) return;
  claimed[y][x] = true;
  claimedCount++;
  claimedEl.textContent = claimedCount;
  chime(440, 0.08);
}

async function moveTo(tx, ty) {
  if (!running || animating) return;
  if (!revealed[ty][tx]) return;
  const path = bfs(player.x, player.y, tx, ty);
  if (!path || path.length < 2) return;
  animating = true;
  for (let i = 1; i < path.length; i++) {
    const step = path[i];
    player.x = step.x;
    player.y = step.y;
    reveal(player.x, player.y);
    claim(player.x, player.y);
    updateCompass();
    draw();
    drawMini();
    await sleep(MOVE_MS);
    if (!running) { animating = false; return; }
  }
  animating = false;
  if (player.x === beacon.x && player.y === beacon.y) {
    win();
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function start() {
  // reset
  revealed = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  claimed = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  player = { x: 0, y: 0 };
  claimedCount = 0;
  claimedEl.textContent = '0';
  remaining = TOTAL;
  running = true;
  animating = false;
  foundEaster = false;
  overlay.hidden = true;
  reveal(0, 0);
  claim(0, 0);
  updateCompass();
  draw();
  drawMini();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(tick, 100);
  chime(520, 0.1);
}

function tick() {
  if (!running) return;
  remaining = Math.max(0, remaining - 0.1);
  timeEl.textContent = remaining.toFixed(1);
  if (remaining <= 5) timeEl.classList.add('urgent');
  else timeEl.classList.remove('urgent');
  if (remaining <= 0) {
    lose();
  }
}

function win() {
  running = false;
  if (timerId) clearInterval(timerId);
  ovTitle.textContent = 'Reached';
  ovMsg.textContent = `claimed ${claimedCount} of ${SIZE * SIZE} tiles`;
  overlay.hidden = false;
  chime(784, 0.25);
  setTimeout(() => chime(1046, 0.2), 120);
}

function lose() {
  running = false;
  if (timerId) clearInterval(timerId);
  ovTitle.textContent = 'Fog remains';
  ovMsg.textContent = `claimed ${claimedCount} tiles — try again`;
  overlay.hidden = false;
  chime(220, 0.25);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  // restart animation
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  setTimeout(() => { toastEl.hidden = true; }, 2300);
}

function updateCompass() {
  const ang = Math.atan2(beacon.y - player.y, beacon.x - player.x) * 180 / Math.PI + 90;
  needle.style.transform = `rotate(${ang}deg)`;
}

// drawing
function draw() {
  const size = map.width;
  const tile = size / SIZE;
  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x * tile, py = y * tile;
      if (!revealed[y][x]) {
        ctx.fillStyle = '#1a1f28';
        ctx.fillRect(px, py, tile, tile);
        // fog hatch
        ctx.strokeStyle = 'rgba(232,226,214,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + tile);
        ctx.lineTo(px + tile, py);
        ctx.stroke();
      } else {
        ctx.fillStyle = claimed[y][x] ? 'rgba(107,138,107,0.18)' : '#12161d';
        ctx.fillRect(px, py, tile, tile);
        if (claimed[y][x]) {
          ctx.fillStyle = 'rgba(107,138,107,0.55)';
          ctx.beginPath();
          ctx.arc(px + tile/2, py + tile/2, tile * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
        if (x === EASTER.x && y === EASTER.y && revealed[y][x]) {
          ctx.fillStyle = 'rgba(212,162,76,0.85)';
          ctx.font = `${Math.round(tile * 0.45)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('moth', px + tile/2, py + tile/2);
        }
      }
      // grid
      ctx.strokeStyle = 'rgba(232,226,214,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
    }
  }
  // beacon
  if (revealed[beacon.y][beacon.x]) {
    const bx = beacon.x * tile + tile/2, by = beacon.y * tile + tile/2;
    const g = ctx.createRadialGradient(bx, by, 2, bx, by, tile * 0.6);
    g.addColorStop(0, 'rgba(212,162,76,0.9)');
    g.addColorStop(1, 'rgba(212,162,76,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, tile * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4a24c';
    ctx.beginPath();
    ctx.arc(bx, by, tile * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  // player
  const px = player.x * tile + tile/2, py = player.y * tile + tile/2;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(px, py, tile * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(192,57,43,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, tile * 0.34, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMini() {
  const size = mini.width;
  const tile = size / SIZE;
  const d = mini._dpr || 1;
  mctx.setTransform(1,0,0,1,0,0);
  mctx.fillStyle = '#0e1116';
  mctx.fillRect(0, 0, size, size);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x * tile, py = y * tile;
      if (!revealed[y][x]) {
        mctx.fillStyle = '#1a1f28';
      } else if (claimed[y][x]) {
        mctx.fillStyle = '#6b8a6b';
      } else {
        mctx.fillStyle = '#161b23';
      }
      mctx.fillRect(px, py, tile, tile);
    }
  }
  // beacon
  mctx.fillStyle = '#d4a24c';
  mctx.fillRect(beacon.x * tile + tile*0.25, beacon.y * tile + tile*0.25, tile*0.5, tile*0.5);
  // player
  mctx.fillStyle = '#c0392b';
  mctx.beginPath();
  mctx.arc(player.x * tile + tile/2, player.y * tile + tile/2, Math.max(2, tile * 0.3), 0, Math.PI * 2);
  mctx.fill();
}

// input
map.addEventListener('pointerdown', (e) => {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  if (!running) { start(); return; }
  const rect = map.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const tx = Math.floor(x * SIZE);
  const ty = Math.floor(y * SIZE);
  if (!inBounds(tx, ty)) return;
  moveTo(tx, ty);
});

ovBtn.addEventListener('click', start);

function chime(freq, dur) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur + 0.05);
  } catch {}
}

// init
layout();
start();
// easter: konami-ish secret via title double click
document.querySelector('.mark').addEventListener('dblclick', () => {
  toast('moth remembers');
  chime(330, 0.2);
});
