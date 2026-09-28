// Velvet Avalanche — memphis generative physics toy
// 3 colors + black/white. Canvas shapes avalanche with pointer fling.
const PINK = '#FF2E88', TEAL = '#00C2A8', YELLOW = '#FFC700';
const INK = '#111111', PAPER = '#FFFDF4', WHITE = '#ffffff';
const COLORS = [PINK, TEAL, YELLOW];

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const toast = $('toast');
let toastT = null;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove('show'), 2200);
}

// --- seeded RNG (mulberry32) + URL/localStorage state ---
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const params = new URLSearchParams(location.search);
let seed = parseInt(params.get('seed') || '', 10);
if (!Number.isFinite(seed)) {
  try {
    const saved = JSON.parse(localStorage.getItem('velvet-avalanche') || '{}');
    seed = saved.seed ?? Math.floor(Math.random() * 9000 + 1000);
  } catch { seed = Math.floor(Math.random() * 9000 + 1000); }
}
let rngState = seed >>> 0;
function rnd() {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

// --- settings ---
const settings = {
  flow: parseFloat(params.get('flow')) || 60,
  grav: (parseFloat(params.get('grav')) || 0.35),
  bounce: (parseFloat(params.get('bounce')) || 0.72),
  trail: (parseFloat(params.get('trail')) || 0.18),
};
if (params.get('grav') && parseFloat(params.get('grav')) > 3) settings.grav = parseFloat(params.get('grav')) / 100;
try {
  const saved = JSON.parse(localStorage.getItem('velvet-avalanche') || '{}');
  if (!params.get('flow') && saved.flow != null) Object.assign(settings, saved);
} catch {}
function persist() {
  try { localStorage.setItem('velvet-avalanche', JSON.stringify({ seed, ...settings })); } catch {}
}

// --- canvas sizing (crisp, responsive) ---
let W = 900, H = 560, DPR = 1;
function fit() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  W = Math.max(320, Math.round(r.width));
  H = Math.round(W * 0.62);
  H = Math.min(Math.max(H, 380), 640);
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  paintBackdrop(true);
}
window.addEventListener('resize', fit);

// --- particles: memphis shapes ---
const SHAPES = ['circle', 'donut', 'tri', 'bar', 'cross', 'squig', 'halfcircle'];
let parts = [];
let paused = false;
let tiltX = 0; // sideways gravity from wheel
let mouse = { x: 0, y: 0, px: 0, py: 0, down: false };

function spawn(n, opts = {}) {
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.12;
    parts.push({
      x: opts.x ?? rnd() * W,
      y: opts.y ?? (opts.top ? -20 - rnd() * 80 : rnd() * H * 0.4),
      vx: opts.vx ?? (rnd() - 0.5) * (opts.power ?? 4),
      vy: opts.vy ?? (rnd() * -2),
      s: big ? 22 + rnd() * 22 : 7 + rnd() * 15,
      rot: rnd() * Math.PI * 2,
      vr: (rnd() - 0.5) * 0.2,
      shape: pick(SHAPES),
      color: pick(COLORS),
      line: rnd() < 0.35, // black outline pop
      wob: rnd() * Math.PI * 2,
    });
  }
  if (parts.length > 700) parts.splice(0, parts.length - 700);
}

function paintBackdrop(hard = false) {
  if (hard) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    // memphis confetti floor printed faintly underneath
    ctx.save(); ctx.globalAlpha = 0.16;
    const r2 = hashSeed('floor' + seed);
    let s2 = r2;
    const r2f = () => { s2 = (s2 + 0x6D2B79F5) | 0; let t = Math.imul(s2 ^ (s2 >>> 15), 1 | s2); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = COLORS[i % 3];
      const x = r2f() * W, y = r2f() * H, rr = 3 + r2f() * 8;
      if (i % 2) { ctx.beginPath(); ctx.arc(x, y, rr / 2, 0, 7); ctx.fill(); }
      else ctx.fillRect(x, y, rr, 3);
    }
    ctx.restore();
    // thick memphis frame corners
    ctx.save(); ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
    ctx.restore();
  } else {
    ctx.fillStyle = `rgba(255,253,244,${settings.trail})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function draw(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot + Math.sin(p.wob) * 0.3);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  const s = p.s;
  const stroke = () => { if (p.line || p.shape === 'squig' || p.shape === 'cross') ctx.stroke(); };
  switch (p.shape) {
    case 'circle':
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); stroke(); break;
    case 'donut':
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill();
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(0, 0, s / 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); stroke(); break;
    case 'tri':
      ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, s / 2); ctx.closePath(); ctx.fill(); stroke(); break;
    case 'bar':
      ctx.fillRect(-s / 2, -s / 6, s, s / 3); if (p.line) ctx.strokeRect(-s / 2, -s / 6, s, s / 3); break;
    case 'cross': {
      ctx.lineWidth = 4; ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0);
      ctx.moveTo(0, -s / 2); ctx.lineTo(0, s / 2);
      ctx.stroke(); break;
    }
    case 'squig': {
      ctx.lineWidth = 4; ctx.strokeStyle = p.color; ctx.beginPath();
      for (let x = -s / 2; x <= s / 2; x += 4) ctx.lineTo(x, Math.sin(x / 4 + p.wob) * 5);
      ctx.stroke(); break;
    }
    case 'halfcircle':
      ctx.beginPath(); ctx.arc(0, 0, s / 2, Math.PI, 0); ctx.closePath(); ctx.fill(); stroke(); break;
  }
  // velvet highlight dot
  if (p.shape !== 'cross' && p.shape !== 'squig') {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(-s / 7, -s / 7, Math.max(1.2, s / 12), 0, 7); ctx.fill();
  }
  ctx.restore();
}

function step() {
  if (!paused) {
    // ambient snowfall rate from flow slider
    if (rnd() < settings.flow / 240) spawn(1, { top: true, power: 1.5 });
    paintBackdrop(false);
    for (const p of parts) {
      p.vy += settings.grav * 0.06;
      p.vx += tiltX * 0.02;
      p.vx *= 0.992; p.vy *= 0.998;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr; p.wob += 0.08;
      // walls + floor with bounce
      if (p.x < 8) { p.x = 8; p.vx = Math.abs(p.vx) * settings.bounce; }
      if (p.x > W - 8) { p.x = W - 8; p.vx = -Math.abs(p.vx) * settings.bounce; }
      if (p.y > H - 14) {
        p.y = H - 14; p.vy = -Math.abs(p.vy) * settings.bounce;
        p.vx *= 0.96;
        if (Math.abs(p.vy) < 0.4) p.vy = 0;
      }
      draw(p);
    }
    $('countLabel').textContent = `${parts.length} shapes tumbling`;
    tiltX *= 0.97;
  }
  requestAnimationFrame(step);
}

// --- pointer: fling + burst ---
function evPos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = W / r.width, sy = H / r.height;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = evPos(e);
  mouse = { x: p.x, y: p.y, px: p.x, py: p.y, down: true };
  spawn(10, { x: p.x, y: p.y, power: 7 });
});
canvas.addEventListener('pointermove', (e) => {
  const p = evPos(e);
  if (mouse.down) {
    const dx = p.x - mouse.x, dy = p.y - mouse.y;
    spawn(3, { x: p.x, y: p.y, vx: dx * 0.6 + (rnd() - .5) * 3, vy: dy * 0.6 + (rnd() - .5) * 3, power: 5 });
  }
  mouse.x = p.x; mouse.y = p.y;
});
window.addEventListener('pointerup', () => { mouse.down = false; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); tiltX += Math.sign(e.deltaX || e.deltaY) * 1.2; }, { passive: false });

// --- controls ---
function bindRange(id, key, fmt) {
  const el = $(id);
  const cur = () => (key === 'grav' ? settings.grav : key === 'trail' ? settings.trail : key === 'bounce' ? settings.bounce : settings[key]);
  const toSlider = (v) => (key === 'flow' ? Math.round(v) : Math.round(v * 100));
  const fromSlider = (v) => (key === 'flow' ? +v : +v / 100);
  el.value = toSlider(cur());
  const show = () => { $(id + 'Val').textContent = fmt(cur()); };
  show();
  el.addEventListener('input', () => { settings[key] = fromSlider(el.value); show(); persist(); });
}
bindRange('flow', 'flow', (v) => `${Math.round(v)}`);
bindRange('grav', 'grav', (v) => v.toFixed(2));
bindRange('bounce', 'bounce', (v) => v.toFixed(2));
bindRange('trail', 'trail', (v) => v.toFixed(2));

$('btnBurst').addEventListener('click', () => { spawn(120, { power: 11 }); say('★ avalanche!'); });
$('btnShake').addEventListener('click', () => {
  for (const p of parts) { p.vx += (rnd() - .5) * 14; p.vy -= 3 + rnd() * 7; }
  tiltX += (rnd() - .5) * 8; say('〜 shaken, not stirred');
});
$('btnClear').addEventListener('click', () => { parts = []; paintBackdrop(true); say('cleared. fresh velvet.'); });
$('btnPause').addEventListener('click', (e) => {
  paused = !paused;
  e.target.textContent = paused ? '▶ resume' : '❚❚ pause';
});
$('btnSeed').addEventListener('click', () => {
  seed = Math.floor(Math.random() * 9000 + 1000);
  rngState = seed >>> 0; parts = [];
  $('seedPill').textContent = `seed #${seed}`;
  paintBackdrop(true); spawn(60, { top: true, power: 3 });
  persist(); say(`new seed #${seed}`);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); $('btnPause').click(); }
  else if (e.key === 'b' || e.key === 'B') $('btnBurst').click();
  else if (e.key === 's' || e.key === 'S') $('btnShake').click();
});

// --- share / export ---
$('btnPng').addEventListener('click', () => {
  const out = document.createElement('canvas');
  const k = 2;
  out.width = W * k; out.height = H * k;
  const octx = out.getContext('2d');
  octx.scale(k, k);
  octx.fillStyle = PAPER; octx.fillRect(0, 0, W, H);
  // redraw current shapes at full res: draw the live canvas bitmap scaled up
  octx.imageSmoothingEnabled = true;
  octx.drawImage(canvas, 0, 0, W, H);
  const a = document.createElement('a');
  a.download = `velvet-avalanche-${seed}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  say('⤓ PNG exported at 2×');
});
$('btnLink').addEventListener('click', async () => {
  const u = new URL(location.href.split('?')[0]);
  // when opened via file:// keep it simple
  u.search = new URLSearchParams({ seed: String(seed), flow: String(Math.round(settings.flow)), grav: settings.grav.toFixed(2), bounce: settings.bounce.toFixed(2), trail: settings.trail.toFixed(2) }).toString();
  const link = u.toString();
  try { await navigator.clipboard.writeText(link); say('⧉ link copied — seed + settings inside'); }
  catch {
    prompt('Copy your avalanche link:', link);
  }
});

// --- init ---
$('seedPill').textContent = `seed #${seed}`;
fit();
paintBackdrop(true);
spawn(70, { top: true, power: 3 });
setTimeout(() => fit(), 60); // settle after fonts/layout
requestAnimationFrame(step);
persist();
console.log('velvet-avalanche ready', { seed, settings });
