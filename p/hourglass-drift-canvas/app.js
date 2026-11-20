// Hourglass Drift Canvas
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('.stage');
const timeEl = document.getElementById('time');
const ring = document.getElementById('ring');
const shapeLabel = document.getElementById('shapeLabel');
const statusEl = document.getElementById('status');
const themesEl = document.getElementById('themes');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

const THEMES = [
  { name: 'Amber Dune', colors: ['#f5c97a', '#e879a8', '#5eead4'] },
  { name: 'Aurora Ice', colors: ['#93c5fd', '#a78bfa', '#67e8f9'] },
  { name: 'Ember Mono', colors: ['#fca5a5', '#fdba74', '#fde68a'] },
];

let themeIndex = Number(localStorage.getItem('hg-theme') || 0);
if (isNaN(themeIndex) || themeIndex < 0 || themeIndex >= THEMES.length) themeIndex = 0;

const N = 720;
const px = new Float32Array(N);
const py = new Float32Array(N);
const vx = new Float32Array(N);
const vy = new Float32Array(N);
let tx = new Float32Array(N);
let ty = new Float32Array(N);

const SHAPES = ['circle', 'triangle', 'square', 'star', 'heart'];
let shapeIndex = 0;

let W = 0, H = 0, dpr = 1;
let cx = 0, cy = 0, scale = 0;
let verts = [];
let edges = [];

let phase = 'flow'; // flow | morph | scatter
let timer = 10;
let paused = false;
let morphT = 0;
const FLOW_DUR = 10;
const MORPH_DUR = 2.2;
const SCATTER_DUR = 0.6;
let phaseTime = 0;

let colors = THEMES[themeIndex].colors.slice();

function hexToRgb(h) {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const rgbColors = () => colors.map(hexToRgb);

function applyTheme(i) {
  themeIndex = i;
  localStorage.setItem('hg-theme', String(i));
  colors = THEMES[i].colors.slice();
  const root = document.documentElement;
  root.style.setProperty('--c1', colors[0]);
  root.style.setProperty('--c2', colors[1]);
  root.style.setProperty('--c3', colors[2]);
  document.querySelectorAll('.theme-btn').forEach((b, idx) => {
    b.classList.toggle('active', idx === i);
  });
}

function buildHourglass() {
  // polygon vertices (clockwise), normalized coords
  const v = [
    [-0.85, -1.0],
    [0.85, -1.0],
    [0.22, 0.0],
    [0.85, 1.0],
    [-0.85, 1.0],
    [-0.22, 0.0],
  ];
  verts = v.map(([x, y]) => [cx + x * scale, cy + y * scale]);
  edges = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    // inward normal
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    // rotate edge clockwise? interior is left of edge for CCW? Our verts are clockwise, so interior is right -> normal = (ey,-ex)/len
    const nx = ey / len;
    const ny = -ex / len;
    edges.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], nx, ny, len });
  }
}

function resize() {
  const rect = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2;
  cy = H / 2;
  scale = Math.min(W, H) * 0.42;
  buildHourglass();
  // keep particles in bounds roughly
}

const ro = new ResizeObserver(resize);
ro.observe(stage);
resize();

// ---------- sand init ----------
function inTopChamber(x, y) {
  // top triangle region: y < cy, within polygon
  return y < cy && pointInPoly(x, y, verts);
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const cond = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (cond) inside = !inside;
  }
  return inside;
}

function scatterToTop() {
  let placed = 0;
  let attempts = 0;
  while (placed < N && attempts < N * 40) {
    attempts++;
    const x = cx + (Math.random() - 0.5) * scale * 1.5;
    const y = cy - scale * 0.9 + Math.random() * scale * 0.7;
    if (pointInPoly(x, y, verts)) {
      px[placed] = x;
      py[placed] = y;
      vx[placed] = (Math.random() - 0.5) * 40;
      vy[placed] = Math.random() * 20;
      placed++;
    }
  }
  for (let i = placed; i < N; i++) {
    px[i] = cx; py[i] = cy - scale * 0.5;
    vx[i] = 0; vy[i] = 0;
  }
}

// ---------- shapes ----------
function shapePoints(name, count) {
  const R = scale * 0.26;
  const outX = new Float32Array(count);
  const outY = new Float32Array(count);
  if (name === 'circle') {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.02;
      outX[i] = cx + Math.cos(a) * R;
      outY[i] = cy + Math.sin(a) * R;
    }
  } else if (name === 'square') {
    const half = R * 0.85;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { outX[i] = cx - half + t * 2 * half; outY[i] = cy - half; }
      else if (side === 1) { outX[i] = cx + half; outY[i] = cy - half + t * 2 * half; }
      else if (side === 2) { outX[i] = cx + half - t * 2 * half; outY[i] = cy + half; }
      else { outX[i] = cx - half; outY[i] = cy + half - t * 2 * half; }
    }
  } else if (name === 'triangle') {
    // equilateral perimeter sampling
    const pts = [
      [cx, cy - R],
      [cx - R * 0.866, cy + R * 0.5],
      [cx + R * 0.866, cy + R * 0.5],
    ];
    samplePolyPerimeter(pts, outX, outY, count);
  } else if (name === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 === 0) ? R : R * 0.42;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    samplePolyPerimeter(pts, outX, outY, count);
  } else if (name === 'heart') {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const s = R / 17;
      outX[i] = cx + x * s;
      outY[i] = cy - y * s;
    }
  }
  return { x: outX, y: outY };
}

function samplePolyPerimeter(pts, outX, outY, count) {
  // compute cumulative lengths
  const n = pts.length;
  const lens = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lens.push(l); total += l;
  }
  const cum = [];
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += lens[i]; cum.push(acc); }
  for (let k = 0; k < count; k++) {
    const d = Math.random() * total;
    let ei = 0;
    while (ei < n - 1 && d > cum[ei]) ei++;
    const prevCum = ei === 0 ? 0 : cum[ei - 1];
    const segLen = lens[ei];
    const t = segLen > 0 ? (d - prevCum) / segLen : 0;
    const a = pts[ei], b = pts[(ei + 1) % n];
    outX[k] = a[0] + (b[0] - a[0]) * t;
    outY[k] = a[1] + (b[1] - a[1]) * t;
  }
}

function startMorph() {
  const sh = SHAPES[shapeIndex];
  shapeLabel.textContent = sh;
  const t = shapePoints(sh, N);
  // assign by angle sort
  const orderP = Array.from({ length: N }, (_, i) => i).sort((a, b) =>
    Math.atan2(py[a] - cy, px[a] - cx) - Math.atan2(py[b] - cy, px[b] - cx));
  const orderT = Array.from({ length: N }, (_, i) => i).sort((a, b) =>
    Math.atan2(t.y[a] - cy, t.x[a] - cx) - Math.atan2(t.y[b] - cy, t.x[b] - cx));
  for (let k = 0; k < N; k++) {
    tx[orderP[k]] = t.x[orderT[k]];
    ty[orderP[k]] = t.y[orderT[k]];
  }
  morphT = 0;
  phase = 'morph';
  phaseTime = 0;
  statusEl.textContent = 'Rebuilding…';
}

function startScatter() {
  phase = 'scatter';
  phaseTime = 0;
  statusEl.textContent = 'Resetting…';
}

function startFlow() {
  scatterToTop();
  timer = FLOW_DUR;
  phase = 'flow';
  phaseTime = 0;
  statusEl.textContent = 'Flowing…';
}

// ---------- physics ----------
const R = 2.3; // particle radius
function step(dt) {
  if (paused) return;
  // clamp dt
  if (dt > 0.05) dt = 0.05;

  if (phase === 'flow') {
    phaseTime += dt;
    timer -= dt;
    if (timer <= 0) { timer = 0; startMorph(); return; }

    const g = 520;
    // gravity + integrate
    for (let i = 0; i < N; i++) {
      vy[i] += g * dt;
      vx[i] *= 0.996;
      vy[i] *= 0.999;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
    // boundary collisions
    for (let i = 0; i < N; i++) {
      for (let e = 0; e < edges.length; e++) {
        const ed = edges[e];
        // signed distance to edge (interior positive)
        const d = (px[i] - ed.ax) * ed.nx + (py[i] - ed.ay) * ed.ny;
        if (d < R) {
          // push in
          const push = R - d;
          px[i] += ed.nx * push;
          py[i] += ed.ny * push;
          const vn = vx[i] * ed.nx + vy[i] * ed.ny;
          if (vn < 0) {
            vx[i] -= (1 + 0.35) * vn * ed.nx;
            vy[i] -= (1 + 0.35) * vn * ed.ny;
            vx[i] *= 0.6;
            vy[i] *= 0.6;
          }
        }
      }
    }
    // inter-particle repulsion via grid
    const cellSize = R * 2.6;
    const grid = new Map();
    for (let i = 0; i < N; i++) {
      const cxg = Math.floor(px[i] / cellSize);
      const cyg = Math.floor(py[i] / cellSize);
      const key = cxg * 73856093 ^ cyg * 19349663;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    for (let i = 0; i < N; i++) {
      const cxg = Math.floor(px[i] / cellSize);
      const cyg = Math.floor(py[i] / cellSize);
      for (let gx = cxg - 1; gx <= cxg + 1; gx++) {
        for (let gy = cyg - 1; gy <= cyg + 1; gy++) {
          const key = gx * 73856093 ^ gy * 19349663;
          const cell = grid.get(key);
          if (!cell) continue;
          for (let j of cell) {
            if (j <= i) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const dist = Math.hypot(dx, dy);
            const minD = R * 2;
            if (dist > 0 && dist < minD) {
              const overlap = (minD - dist) * 0.5;
              const ux = dx / dist, uy = dy / dist;
              px[i] -= ux * overlap;
              py[i] -= uy * overlap;
              px[j] += ux * overlap;
              py[j] += uy * overlap;
              // damp
              vx[i] *= 0.9; vy[i] *= 0.9;
              vx[j] *= 0.9; vy[j] *= 0.9;
            }
          }
        }
      }
    }
  } else if (phase === 'morph') {
    phaseTime += dt;
    morphT = Math.min(1, phaseTime / MORPH_DUR);
    const ease = morphT < 0.5 ? 2 * morphT * morphT : 1 - Math.pow(-2 * morphT + 2, 2) / 2;
    for (let i = 0; i < N; i++) {
      // lerp from current? use stored start? We'll lerp px toward tx each frame with ease factor delta
      px[i] += (tx[i] - px[i]) * (0.12 + ease * 0.18);
      py[i] += (ty[i] - py[i]) * (0.12 + ease * 0.18);
      vx[i] *= 0.8; vy[i] *= 0.8;
    }
    if (morphT >= 1) {
      // hold then scatter
      if (phaseTime >= MORPH_DUR + 1.4) {
        shapeIndex = (shapeIndex + 1) % SHAPES.length;
        startScatter();
      }
    }
  } else if (phase === 'scatter') {
    phaseTime += dt;
    const t = phaseTime / SCATTER_DUR;
    // move particles toward top with easing; then start flow
    for (let i = 0; i < N; i++) {
      const targetY = cy - scale * 0.5 - Math.random() * scale * 0.3; // not per-particle stable, but ok
      // simpler: apply upward velocity
      vy[i] -= 900 * dt;
      vx[i] += (Math.random() - 0.5) * 60 * dt;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      vx[i] *= 0.92; vy[i] *= 0.92;
    }
    if (phaseTime >= SCATTER_DUR) {
      startFlow();
    }
  }
}

// ---------- render ----------
function render() {
  ctx.clearRect(0, 0, W, H);

  // hourglass outline (glass)
  ctx.save();
  ctx.beginPath();
  verts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // inner subtle fill
  const grad = ctx.createLinearGradient(cx, cy - scale, cx, cy + scale);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // neck highlight
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 0.22 * scale, cy);
  ctx.lineTo(cx + 0.22 * scale, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const rgs = rgbColors();
  // particles
  for (let i = 0; i < N; i++) {
    const yNorm = Math.max(0, Math.min(1, (py[i] - (cy - scale)) / (2 * scale)));
    // color mix c1 (top) -> c2 (bottom), c3 sparkle if fast
    const speed = Math.hypot(vx[i], vy[i]);
    let cr, cg, cb;
    if (speed > 120) {
      const c = rgs[2];
      cr = c[0]; cg = c[1]; cb = c[2];
    } else {
      const a = rgs[0], b = rgs[1];
      cr = a[0] + (b[0] - a[0]) * yNorm;
      cg = a[1] + (b[1] - a[1]) * yNorm;
      cb = a[2] + (b[2] - a[2]) * yNorm;
    }
    const alpha = phase === 'morph' ? 0.85 : 0.78;
    ctx.fillStyle = `rgba(${cr|0},${cg|0},${cb|0},${alpha})`;
    ctx.beginPath();
    ctx.arc(px[i], py[i], R, 0, Math.PI * 2);
    ctx.fill();
  }

  // timer ring update
  let progress = 1;
  if (phase === 'flow') progress = timer / FLOW_DUR;
  else if (phase === 'morph') progress = 0;
  else progress = 0;
  const circ = 2 * Math.PI * 28;
  ring.style.strokeDasharray = String(circ);
  ring.style.strokeDashoffset = String(circ * (1 - progress));
  timeEl.textContent = phase === 'flow' ? Math.ceil(timer) : (phase === 'morph' ? '0' : '…');
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  step(dt);
  render();
  requestAnimationFrame(loop);
}

// ---------- ui ----------
function buildThemes() {
  themesEl.innerHTML = '';
  THEMES.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'theme-btn' + (i === themeIndex ? ' active' : '');
    b.textContent = t.name;
    b.addEventListener('click', () => applyTheme(i));
    themesEl.appendChild(b);
  });
}
buildThemes();
applyTheme(themeIndex);

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  statusEl.textContent = paused ? 'Paused' : (phase === 'flow' ? 'Flowing…' : phase === 'morph' ? 'Rebuilding…' : 'Resetting…');
});
resetBtn.addEventListener('click', () => {
  shapeIndex = 0;
  shapeLabel.textContent = SHAPES[0];
  startFlow();
});

// init
scatterToTop();
// start in flow
startFlow();
// but startFlow calls scatterToTop again; fine

requestAnimationFrame((t) => { last = t; loop(t); });

// handle visibility
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now();
});