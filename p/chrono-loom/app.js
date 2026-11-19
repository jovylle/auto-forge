const canvas = document.getElementById('loom');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const ROWH = 9;
const WARP = 48;
const WARPW = W / WARP;

const PALETTE = ['#ff2a9d','#00f5ff','#b026ff','#ffee32','#ff6ad5','#39ff14','#ff9e00','#7df9ff','#c77dff','#4cc9f0'];

const state = {
  rows: [],
  viewOffset: 0,
  auto: true,
  startHour: new Date().getHours(),
  weaving: null,
  windowScroll: 0,
};

const $ = (id) => document.getElementById(id);

function colorFor(i) {
  const p = PALETTE[i % PALETTE.length];
  // drift hue slightly per cycle for variety
  return p;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt * 255));
  g = Math.max(0, Math.min(255, g + amt * 255));
  b = Math.max(0, Math.min(255, b + amt * 255));
  return `rgb(${r|0},${g|0},${b|0})`;
}

function hourLabel(i) {
  const h = (state.startHour + i) % 24;
  return String(h).padStart(2, '0') + ':00';
}

function clampView() {
  const total = state.rows.length * ROWH;
  const max = Math.max(0, total - H);
  if (state.viewOffset < 0) state.viewOffset = 0;
  if (state.viewOffset > max) state.viewOffset = max;
}

function weaveOne() {
  if (state.weaving) return;
  const i = state.rows.length;
  const row = { color: colorFor(i), hour: (state.startHour + i) % 24, label: hourLabel(i), progress: 0 };
  state.rows.push(row);
  state.weaving = { idx: i, t0: performance.now() };
  // auto scroll to bottom
  requestAnimationFrame(() => { state.viewOffset = 1e9; clampView(); });
  renderRibbon();
  updateHud();
}

let autoTimer = null;
function setAuto(on) {
  state.auto = on;
  if (autoTimer) clearInterval(autoTimer);
  if (on) autoTimer = setInterval(() => { if (!state.weaving) weaveOne(); }, 2500);
  $('autoBtn').textContent = 'AUTO: ' + (on ? 'ON' : 'OFF');
  $('modeLabel').textContent = on ? 'AUTO' : 'MANUAL';
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function renderRibbon() {
  const ribbon = $('ribbon');
  ribbon.innerHTML = '';
  const centerRow = Math.round((state.viewOffset + H / 2) / ROWH);
  state.rows.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'swatch' + (i === centerRow ? ' active' : '');
    d.style.background = r.color;
    d.innerHTML = `<span class="hr">${r.label}</span>`;
    d.addEventListener('click', () => {
      state.viewOffset = i * ROWH - H / 2 + ROWH / 2;
      clampView();
    });
    ribbon.appendChild(d);
  });
  ribbon.scrollLeft = ribbon.scrollWidth;
  $('weftCount').textContent = state.rows.length;
  $('hourLabel').textContent = state.rows.length ? state.rows[state.rows.length - 1].label : '—';
}

function centerOnRow(i) {
  state.viewOffset = i * ROWH - H / 2 + ROWH / 2;
  clampView();
}

function updateHud() {
  $('weftCount').textContent = state.rows.length;
  $('hourLabel').textContent = state.rows.length ? state.rows[state.rows.length - 1].label : '—';
  $('modeLabel').textContent = state.auto ? 'AUTO' : 'MANUAL';
}

function render() {
  // background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a001a');
  g.addColorStop(1, '#000010');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.strokeStyle = 'rgba(0,245,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += WARPW) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  // rows
  const startIdx = Math.max(0, Math.floor(state.viewOffset / ROWH) - 1);
  const endIdx = Math.min(state.rows.length, Math.ceil((state.viewOffset + H) / ROWH) + 1);
  for (let i = startIdx; i < endIdx; i++) {
    const r = state.rows[i];
    if (!r) continue;
    const y = i * ROWH - state.viewOffset;
    const prog = (r.progress == null ? 1 : r.progress);
    const width = W * prog;
    // base band
    ctx.fillStyle = r.color;
    ctx.globalAlpha = 0.35 + 0.65 * prog;
    ctx.fillRect(0, y, width, ROWH);
    // weave strands
    for (let c = 0; c < WARP; c++) {
      const x = c * WARPW;
      if (x > width) break;
      const segW = Math.min(WARPW * 0.7, width - x);
      if (segW <= 0) continue;
      const over = (c + i) % 2 === 0;
      ctx.fillStyle = over ? shade(r.color, 0.22) : shade(r.color, -0.32);
      ctx.globalAlpha = 0.9 * prog;
      ctx.fillRect(x + (over ? 0 : WARPW * 0.3), y + 1, segW * 0.7, ROWH - 2);
    }
    ctx.globalAlpha = 1;
    // highlight line
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, y, width, 1);
    // shuttle while weaving
    if (state.weaving && state.weaving.idx === i && prog < 1) {
      const sx = width;
      ctx.save();
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, y + ROWH / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // warp overlay (vertical threads) subtle
  ctx.globalCompositeOperation = 'lighter';
  for (let c = 0; c < WARP; c++) {
    const x = c * WARPW + WARPW / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // vignette
  const v = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function tick(now) {
  if (state.weaving) {
    const p = Math.min(1, (now - state.weaving.t0) / 700);
    state.rows[state.weaving.idx].progress = p;
    if (p >= 1) {
      state.rows[state.weaving.idx].progress = 1;
      state.weaving = null;
      save();
      renderRibbon();
    }
  }
  render();
  requestAnimationFrame(tick);
}

function save() {
  try { localStorage.setItem('chrono-loom', JSON.stringify(state.rows)); } catch (e) {}
}

function load() {
  const hash = new URLSearchParams(location.hash.slice(1)).get('t');
  if (hash) {
    try {
      const rows = JSON.parse(atob(hash));
      state.rows = rows.map((r, i) => ({ color: r.c, hour: r.h, label: r.l, progress: 1 }));
      state.auto = false;
      setAuto(false);
      state.viewOffset = Math.max(0, state.rows.length * ROWH - H);
      return;
    } catch (e) {}
  }
  try {
    const raw = localStorage.getItem('chrono-loom');
    if (raw) {
      const rows = JSON.parse(raw);
      state.rows = rows.map((r) => ({ color: r.color, hour: r.hour, label: r.label, progress: 1 }));
    }
  } catch (e) {}
}

function encodeState() {
  return btoa(JSON.stringify(state.rows.map((r) => ({ c: r.color, h: r.hour, l: r.label }))));
}

// events
$('autoBtn').addEventListener('click', () => setAuto(!state.auto));
$('weaveBtn').addEventListener('click', () => weaveOne());
$('resetBtn').addEventListener('click', () => {
  state.rows = [];
  state.viewOffset = 0;
  state.weaving = null;
  localStorage.removeItem('chrono-loom');
  location.hash = '';
  renderRibbon(); updateHud();
  toast('tapestry cleared');
});
$('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'chrono-loom.png';
  a.click();
  toast('png exported');
});
$('shareBtn').addEventListener('click', () => {
  const url = location.href.split('#')[0] + '#t=' + encodeState();
  location.hash = 't=' + encodeState();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('link copied')).catch(() => { prompt('copy link', url); });
  } else {
    prompt('copy link', url);
  }
});

// scroll react
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.viewOffset += e.deltaY * 1.2;
  clampView();
  renderRibbon();
}, { passive: false });

// drag to pan
let dragging = false, lastY = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastY = e.clientY; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dy = e.clientY - lastY;
  lastY = e.clientY;
  state.viewOffset -= dy * 1.5;
  clampView();
});
canvas.addEventListener('pointerup', () => { dragging = false; canvas.style.cursor = 'grab'; });
canvas.addEventListener('pointercancel', () => { dragging = false; canvas.style.cursor = 'grab'; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); setAuto(!state.auto); }
});

// clock
function updateClock() {
  const d = new Date();
  $('clock').textContent = d.toTimeString().slice(0, 8);
}
setInterval(updateClock, 1000);
updateClock();

// init
load();
requestAnimationFrame(tick);
setAuto(state.auto);
// weave first quickly if empty
setTimeout(() => { if (state.rows.length === 0) weaveOne(); }, 400);
updateHud();
renderRibbon();

// react to page scroll too
window.addEventListener('scroll', () => {
  state.windowScroll = window.scrollY;
});
