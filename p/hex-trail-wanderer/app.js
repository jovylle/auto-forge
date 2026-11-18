// Hex Trail Wanderer — retro-wave hex trail game
const SQRT3 = Math.sqrt(3);
const R = 6;
const COLORS = ['#ff2d95','#00f0ff','#ffe600','#9d4edd','#ff6b35','#7cff6b'];
const STORAGE_KEY = 'hextrail-map-v1';

// ---------- hex math (flat-top) ----------
function hexToPixel(q, r, size) {
  return { x: size * 1.5 * q, y: size * (SQRT3 / 2 * q + SQRT3 * r) };
}
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function isNeighbor(a, b) {
  return DIRS.some(([dq, dr]) => a[0] + dq === b[0] && a[1] + dr === b[1]);
}
function axialRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const xdiff = Math.abs(rx - x), ydiff = Math.abs(ry - y), zdiff = Math.abs(rz - z);
  if (xdiff > ydiff && xdiff > zdiff) rx = -ry - rz;
  else if (ydiff > zdiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}
function pixelToHex(x, y, size) {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + SQRT3 / 3 * y) / size;
  return axialRound(q, r);
}
function hexKey(q, r) { return q + ',' + r; }
function axialDist(a, b) {
  const dq = a[0]-b[0], dr = a[1]-b[1];
  const ds = -dq - dr - (-b[0]-b[1] + a[0]+a[1]); // not needed
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
// ---------- grid ----------
const hexes = new Map(); // key -> {q,r}
for (let q = -R; q <= R; q++) {
  const r1 = Math.max(-R, -q - R);
  const r2 = Math.min(R, -q + R);
  for (let r = r1; r <= r2; r++) hexes.set(hexKey(q, r), { q, r });
}
// ---------- state ----------
let trails = []; // {points:[[q,r]...], color, territory: Set(keys)|null}
let currentPath = []; // [[q,r]]
let colorIdx = 0;
let soundOn = true;
let audioCtx = null;
let hoverHex = null;
let drawing = false;
let lastAddedKey = null;
let mapSize = 0; // hex size in px

// canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('.stage');
const hint = document.getElementById('hint');
const toast = document.getElementById('toast');

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type = 'sine', gain = 0.07) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  const t = audioCtx.currentTime;
  o.start(t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.stop(t + dur);
}
const sounds = {
  click: () => beep(520, 0.08, 'square', 0.06),
  extend: () => beep(660, 0.06, 'triangle', 0.05),
  err: () => beep(180, 0.12, 'sawtooth', 0.05),
  fill: () => { beep(440, 0.1, 'sine', 0.07); setTimeout(() => beep(660, 0.1, 'sine', 0.07), 90); setTimeout(() => beep(880, 0.15, 'sine', 0.07), 180); },
  save: () => { beep(700, 0.08, 'triangle', 0.06); setTimeout(() => beep(900, 0.1, 'triangle', 0.06), 100); },
  share: () => beep(800, 0.12, 'sine', 0.06),
};

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---------- resize ----------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = stage.getBoundingClientRect();
  const w = Math.max(200, rect.width);
  const h = Math.max(200, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // compute hex size to fit grid
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const h of hexes.values()) {
    const p = hexToPixel(h.q, h.r, 1);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const pad = 24;
  const availW = w - pad * 2;
  const availH = h - pad * 2;
  const gx = maxX - minX + 2; // +2 for hex radius in unit size? approximate
  const gy = maxY - minY + SQRT3;
  mapSize = Math.min(availW / gx, availH / gy);
  mapSize = Math.max(14, Math.min(46, mapSize));
  draw();
}
window.addEventListener('resize', resize);

// ---------- point in polygon ----------
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------- draw hex path ----------
// flat-top hex corners (30° start)
function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 3 * i + Math.PI / 6;
    pts.push({ x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) });
  }
  return pts;
}

function drawHexOutline(cx, cy, size, stroke, fill, glow) {
  const pts = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    if (glow) { ctx.shadowColor = stroke; ctx.shadowBlur = 10; }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function draw() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  // bg
  const grad = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, Math.max(w,h)/1.2);
  grad.addColorStop(0, '#0d0028');
  grad.addColorStop(1, '#050012');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // subtle grid dots
  ctx.fillStyle = 'rgba(42,26,74,0.35)';
  for (let x = 0; x < w; x += 40) for (let y = 0; y < h; y += 40) {
    ctx.fillRect(x, y, 1, 1);
  }

  const size = mapSize;
  // center offset
  let minX = Infinity, minY = Infinity;
  for (const hh of hexes.values()) {
    const p = hexToPixel(hh.q, hh.r, 1);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
  }
  // compute center of grid in pixel (unit) then scale
  let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
  for (const hh of hexes.values()) {
    const p = hexToPixel(hh.q, hh.r, size);
    cMinX = Math.min(cMinX, p.x); cMaxX = Math.max(cMaxX, p.x);
    cMinY = Math.min(cMinY, p.y); cMaxY = Math.max(cMaxY, p.y);
  }
  const offX = (w - (cMaxX - cMinX)) / 2 - cMinX;
  const offY = (h - (cMaxY - cMinY)) / 2 - cMinY;

  function toPx(q, r) { const p = hexToPixel(q, r, size); return { x: p.x + offX, y: p.y + offY }; }

  // territories fill
  for (const t of trails) {
    if (!t.territory) continue;
    for (const key of t.territory) {
      const [q, r] = key.split(',').map(Number);
      const p = toPx(q, r);
      drawHexOutline(p.x, p.y, size * 0.92, null, t.color + '55', false);
    }
    // glow outline of territory? skip
  }
  // territory glow border: draw hex outlines brighter
  for (const t of trails) {
    if (!t.territory) continue;
    for (const key of t.territory) {
      const [q, r] = key.split(',').map(Number);
      const p = toPx(q, r);
      drawHexOutline(p.x, p.y, size * 0.92, t.color + '99', null, true);
    }
  }

  // grid outlines
  for (const hh of hexes.values()) {
    const p = toPx(hh.q, hh.r);
    const isHov = hoverHex && hoverHex.q === hh.q && hoverHex.r === hh.r;
    drawHexOutline(p.x, p.y, size * 0.92, isHov ? '#00f0ff' : 'rgba(42,26,74,0.9)', null, isHov);
  }

  // trails (completed)
  for (const t of trails) {
    ctx.save();
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    t.points.forEach((pt, i) => {
      const p = toPx(pt[0], pt[1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    // core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    t.points.forEach((pt, i) => {
      const p = toPx(pt[0], pt[1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // current path
  if (currentPath.length) {
    ctx.save();
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    currentPath.forEach((pt, i) => {
      const p = toPx(pt[0], pt[1]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // nodes
    for (const pt of currentPath) {
      const p = toPx(pt[0], pt[1]);
      ctx.fillStyle = '#ff2d95';
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // start node highlight
    const sp = toPx(currentPath[0][0], currentPath[0][1]);
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2); ctx.stroke();
  }

  // hover hex label
  if (hoverHex && hexes.has(hexKey(hoverHex.q, hoverHex.r))) {
    const p = toPx(hoverHex.q, hoverHex.r);
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    drawHexOutline(p.x, p.y, size * 0.92, '#00f0ff', 'rgba(0,240,255,0.12)', true);
  }

  // store transform for hit testing
  window.__toPx = toPx;
  window.__off = { offX, offY, size };
}

// ---------- interaction ----------
function canvasHexFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const { size, offX, offY } = window.__off || { size: mapSize, offX: 0, offY: 0 };
  // reverse: pixel -> hex with offset
  const px = x - offX;
  const py = y - offY;
  const h = pixelToHex(px, py, size);
  if (!hexes.has(hexKey(h.q, h.r))) return null;
  return h;
}

function tryAddHex(h) {
  if (!h) return false;
  const key = hexKey(h.q, h.r);
  if (!hexes.has(key)) return false;
  if (currentPath.length === 0) {
    currentPath.push([h.q, h.r]);
    lastAddedKey = key;
    sounds.click();
    updateHint('extend the trail to an adjacent hex');
    draw();
    updateStats();
    return true;
  }
  const last = currentPath[currentPath.length - 1];
  if (last[0] === h.q && last[1] === h.r) return false;
  const first = currentPath[0];
  // close loop?
  if (currentPath.length >= 3 && h.q === first[0] && h.r === first[1]) {
    if (isNeighbor(last, first)) {
      closeLoop();
      return true;
    }
  }
  if (currentPath.some(p => p[0] === h.q && p[1] === h.r)) {
    sounds.err();
    return false;
  }
  if (!isNeighbor(last, [h.q, h.r])) {
    sounds.err();
    return false;
  }
  currentPath.push([h.q, h.r]);
  lastAddedKey = key;
  sounds.extend();
  draw();
  updateStats();
  return true;
}

function closeLoop() {
  const color = COLORS[colorIdx % COLORS.length];
  colorIdx++;
  const pts = currentPath.map(p => [p[0], p[1]]);
  const poly = pts.map(([q, r]) => {
    const p = window.__toPx(q, r); return { x: p.x, y: p.y };
  });
  const hexSet = new Set();
  for (const [k, hh] of hexes) {
    const p = window.__toPx(hh.q, hh.r);
    if (pointInPolygon(p.x, p.y, poly)) hexSet.add(k);
  }
  trails.push({ points: pts, color, territory: hexSet.size > 0 ? hexSet : null });
  currentPath = [];
  lastAddedKey = null;
  sounds.fill();
  updateHint(hexSet.size > 0 ? 'territory claimed!' : 'loop closed');
  updateStats();
  save();
  draw();
}

function updateHint(msg) {
  hint.textContent = msg;
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  const h = canvasHexFromEvent(e);
  tryAddHex(h);
});
canvas.addEventListener('pointermove', (e) => {
  const h = canvasHexFromEvent(e);
  hoverHex = h;
  if (drawing && h) {
    const key = hexKey(h.q, h.r);
    if (key !== lastAddedKey) tryAddHex(h);
  }
  draw();
});
canvas.addEventListener('pointerup', (e) => { drawing = false; lastAddedKey = null; });
canvas.addEventListener('pointerleave', () => { hoverHex = null; drawing = false; draw(); });
canvas.addEventListener('pointercancel', () => { drawing = false; });

// ---------- buttons ----------
document.getElementById('btnUndo').addEventListener('click', () => {
  if (currentPath.length > 0) {
    currentPath.pop();
    sounds.click();
    updateHint('point undone');
  } else if (trails.length > 0) {
    trails.pop();
    sounds.click();
    updateHint('trail removed');
  } else {
    sounds.err();
  }
  updateStats();
  save();
  draw();
});
document.getElementById('btnClearPath').addEventListener('click', () => {
  if (currentPath.length) {
    currentPath = [];
    sounds.click();
    updateHint('path cleared');
    updateStats();
    draw();
  } else sounds.err();
});
document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('Start a new map? This clears everything.')) return;
  trails = []; currentPath = []; colorIdx = 0;
  sounds.err();
  updateHint('new map');
  updateStats();
  save();
  draw();
});
document.getElementById('btnSave').addEventListener('click', () => {
  save();
  sounds.save();
  showToast('map saved');
});
document.getElementById('btnShare').addEventListener('click', () => {
  const data = serialize();
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const url = location.origin + location.pathname + '#m=' + enc;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => { sounds.share(); showToast('share link copied'); }).catch(() => fallbackCopy(url));
  } else fallbackCopy(url);
});
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); showToast('share link copied'); sounds.share(); } catch (e) { showToast('copy failed'); }
  document.body.removeChild(ta);
}
document.getElementById('btnExport').addEventListener('click', () => {
  // export current canvas
  const link = document.createElement('a');
  link.download = 'hex-trail-map.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  sounds.save();
  showToast('png exported');
});
document.getElementById('btnSound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  e.target.textContent = 'Sound: ' + (soundOn ? 'on' : 'off');
  if (soundOn) sounds.click();
});

// ---------- persistence ----------
function serialize() {
  return {
    trails: trails.map(t => ({
      points: t.points,
      color: t.color,
      territory: t.territory ? [...t.territory] : null
    })),
    colorIdx
  };
}
function deserialize(data) {
  if (!data) return;
  trails = (data.trails || []).map(t => ({
    points: t.points,
    color: t.color,
    territory: t.territory ? new Set(t.territory) : null
  }));
  colorIdx = data.colorIdx || 0;
  currentPath = [];
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (e) {}
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) deserialize(JSON.parse(raw));
  } catch (e) {}
}
function loadFromHash() {
  const m = location.hash.match(/#m=([^&]+)/);
  if (!m) return false;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    deserialize(JSON.parse(json));
    showToast('map loaded from link');
    return true;
  } catch (e) { return false; }
}

function updateStats() {
  document.getElementById('sTrails').textContent = trails.length;
  document.getElementById('sTerr').textContent = trails.filter(t => t.territory).length;
}

// ---------- init ----------
if (!loadFromHash()) loadFromStorage();
resize();
updateStats();
if (trails.length) updateHint('map loaded — keep exploring');
else updateHint('click a hex to begin a trail');