// Myrtle Vole Vault — a click-only retro-wave physics cache.
// One interaction: click. Physics is a tiny custom circle solver (pegs, walls, bins).

const $ = (sel) => document.querySelector(sel);
const canvas = $('#vault');
const ctx = canvas.getContext('2d');
const screenEl = $('#screen');
const machineEl = $('#machine');

const TARGET = 300;
const MAX_SEEDS = 120;
const KEY = 'mvv.v1';
const FIXED = 1 / 120;
const TAU = Math.PI * 2;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RARITIES = [
  { name: 'VOLT',  val: 5,   color: '#63f7ff', r: 7.0,  w: 0.58 },
  { name: 'EMBER', val: 12,  color: '#ff5fce', r: 8.0,  w: 0.27 },
  { name: 'MOON',  val: 40,  color: '#ffd166', r: 9.5,  w: 0.12 },
  { name: 'PRISM', val: 100, color: '#c6ff8a', r: 11.0, w: 0.03 },
];

const state = {
  score: 0, drops: 0, chain: 1, best: 1, lastBin: -1,
  seeds: [], sealed: false, next: rollRarity(),
};

const geo = {
  w: 0, h: 0, dpr: 1, pad: 16, floorY: 0, binTop: 0,
  dividers: [], pegs: [], bg: null, binFlash: [0, 0, 0],
};

const sprites = [];
const particles = [];
const floaters = [];
let pointerX = null;
let lastT = performance.now();
let acc = 0;
let lastScore = -1;
let lastCounts = [0, 0, 0];
let saveTimer = 0;
let toastTimer = 0;
let purgeTimer = 0;
let purgeArmed = false;

const ui = {
  score: $('#score'), drops: $('#drops'), chainTop: $('#chainTop'),
  nextDot: $('#nextDot'), nextName: $('#nextName'), nextVal: $('#nextVal'),
  sealText: $('#sealText'), sealFill: $('#sealFill'), sealBar: $('#sealBar'),
  bin0: $('#bin0'), bin1: $('#bin1'), bin2: $('#bin2'),
  bestLine: $('#bestLine'), empty: $('#emptyState'), sealedBanner: $('#sealedBanner'),
  hintAlt: $('#hintAlt'), exportBtn: $('#exportBtn'), shareBtn: $('#shareBtn'),
  purgeBtn: $('#purgeBtn'), shareOut: $('#shareOut'), toast: $('#toast'),
};
const binEls = [ui.bin0, ui.bin1, ui.bin2];

/* ── tiny helpers ───────────────────────────────────── */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function rollRarity() {
  let roll = Math.random();
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= RARITIES[i].w;
    if (roll <= 0) return i;
  }
  return 0;
}

function seedRadius(vi) {
  return RARITIES[vi].r * (geo.w < 400 ? 0.92 : 1);
}

function binIndex(x) {
  const inner = geo.w - geo.pad * 2;
  return clamp(Math.floor((x - geo.pad) / (inner / 3)), 0, 2);
}

function dateLabel() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

/* ── geometry ───────────────────────────────────────── */
function resize() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return;

  const prevW = geo.w, prevH = geo.h;
  geo.w = Math.round(rect.width * 100) / 100;
  geo.h = Math.round(rect.height * 100) / 100;
  geo.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(geo.w * geo.dpr);
  canvas.height = Math.round(geo.h * geo.dpr);
  ctx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);

  geo.pad = geo.w < 420 ? 10 : 16;
  geo.floorY = geo.h - geo.pad - 4;
  geo.binTop = geo.h * 0.61;

  const inner = geo.w - geo.pad * 2;
  geo.dividers = [1, 2].map((i) => ({ x: geo.pad + (inner * i) / 3, w: 7 }));

  if (prevW && prevH && (prevW !== geo.w || prevH !== geo.h)) {
    const sx = geo.w / prevW, sy = geo.h / prevH;
    for (const s of state.seeds) {
      s.r = seedRadius(s.vi);
      s.x = clamp(s.x * sx, geo.pad + s.r, geo.w - geo.pad - s.r);
      s.y = clamp(s.y * sy, s.r + 10, geo.floorY - s.r);
    }
  }

  buildPegs();
  buildSprites();
  geo.bg = buildBackground();
  geo.binFlash = [0, 0, 0];
  if (pointerX === null) pointerX = null;
}

function buildPegs() {
  const { w, pad, binTop, dividers } = geo;
  const top = geo.h * 0.15;
  const bottom = binTop - 30;
  const rows = clamp(Math.round((bottom - top) / 52), 4, 6);
  const cols = Math.max(4, Math.min(8, Math.floor((w - pad * 2) / 50)));
  const gap = (w - pad * 2) / cols;
  geo.pegs = [];

  for (let r = 0; r < rows; r++) {
    const y = top + ((bottom - top) * r) / Math.max(1, rows - 1);
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) {
        geo.pegs.push({ x: pad + gap * (c + 0.5), y, r: 5, flash: 0, fin: false });
      }
    } else {
      for (let c = 0; c < cols - 1; c++) {
        geo.pegs.push({ x: pad + gap * (c + 1), y, r: 5, flash: 0, fin: false });
      }
    }
  }

  for (const d of dividers) {
    geo.pegs.push({ x: d.x, y: binTop, r: 8, flash: 0, fin: true });
  }
}

function buildSprites() {
  sprites.length = 0;
  for (let i = 0; i < RARITIES.length; i++) {
    sprites.push(makeSprite(RARITIES[i].color, seedRadius(i)));
  }
}

function makeSprite(color, r) {
  const glow = 16;
  const size = (r + glow) * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(size * 2);
  c.height = Math.ceil(size * 2);
  const g = c.getContext('2d');
  g.scale(2, 2);
  const cx = size / 2, cy = size / 2;

  const halo = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, size / 2);
  halo.addColorStop(0, rgba(color, 0.5));
  halo.addColorStop(0.45, rgba(color, 0.16));
  halo.addColorStop(1, rgba(color, 0));
  g.fillStyle = halo;
  g.beginPath(); g.arc(cx, cy, size / 2, 0, TAU); g.fill();

  const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.36, color);
  body.addColorStop(1, rgba(color, 0.78));
  g.fillStyle = body;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.lineWidth = 1;
  g.strokeStyle = rgba(color, 0.9);
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();

  g.fillStyle = 'rgba(255,255,255,.88)';
  g.beginPath(); g.arc(cx - r * 0.32, cy - r * 0.38, r * 0.28, 0, TAU); g.fill();

  return { canvas: c, size };
}

function buildBackground() {
  const { w, h, pad, binTop, floorY, dividers } = geo;
  const c = document.createElement('canvas');
  c.width = Math.round(w * geo.dpr);
  c.height = Math.round(h * geo.dpr);
  const b = c.getContext('2d');
  b.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);

  const grad = b.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#080020');
  grad.addColorStop(0.55, '#160536');
  grad.addColorStop(1, '#0a0122');
  b.fillStyle = grad;
  b.fillRect(0, 0, w, h);

  const topGlow = b.createRadialGradient(w * 0.5, -h * 0.1, 10, w * 0.5, h * 0.12, h * 0.9);
  topGlow.addColorStop(0, 'rgba(255,79,184,.24)');
  topGlow.addColorStop(0.45, 'rgba(130,25,115,.08)');
  topGlow.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = topGlow;
  b.fillRect(0, 0, w, h);

  const sun = b.createRadialGradient(w * 0.5, binTop * 0.6, 8, w * 0.5, binTop * 0.6, Math.min(w, binTop) * 0.55);
  sun.addColorStop(0, 'rgba(255,209,240,.12)');
  sun.addColorStop(0.65, 'rgba(255,79,184,.05)');
  sun.addColorStop(1, 'rgba(255,79,184,0)');
  b.fillStyle = sun;
  b.fillRect(0, 0, w, binTop);

  for (let x = pad; x <= w - pad; x += 44) {
    b.strokeStyle = 'rgba(99,247,255,.045)';
    b.lineWidth = 1;
    b.beginPath(); b.moveTo(x, 22); b.lineTo(x, floorY); b.stroke();
  }

  b.strokeStyle = 'rgba(183,155,255,.25)';
  b.beginPath(); b.moveTo(pad, 17); b.lineTo(w - pad, 17); b.stroke();
  for (let x = pad; x <= w - pad; x += 22) {
    b.strokeStyle = 'rgba(183,155,255,.18)';
    b.beginPath(); b.moveTo(x, 17); b.lineTo(x, 21); b.stroke();
  }

  b.save();
  b.beginPath(); b.rect(pad, binTop, w - pad * 2, floorY - binTop); b.clip();
  b.fillStyle = 'rgba(6,0,20,.35)';
  b.fillRect(pad, binTop, w - pad * 2, floorY - binTop);
  for (let i = 0; i < 8; i++) {
    const y = binTop + ((floorY - binTop) * i) / 7;
    b.strokeStyle = `rgba(99,247,255,${0.09 - i * 0.008})`;
    b.lineWidth = 1;
    b.beginPath(); b.moveTo(pad, y); b.lineTo(w - pad, y); b.stroke();
  }
  const binW = (w - pad * 2) / 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 1; j < 5; j++) {
      const y = binTop + ((floorY - binTop) * j) / 4.5;
      b.strokeStyle = 'rgba(255,79,184,.05)';
      b.beginPath();
      b.moveTo(pad + i * binW + binW * 0.18, y);
      b.lineTo(pad + i * binW + binW * 0.82, y);
      b.stroke();
    }
  }
  b.restore();

  const horizon = b.createLinearGradient(0, binTop - 1, 0, binTop + 1);
  horizon.addColorStop(0, 'rgba(99,247,255,0)');
  horizon.addColorStop(0.5, 'rgba(99,247,255,.42)');
  horizon.addColorStop(1, 'rgba(99,247,255,0)');
  b.fillStyle = horizon;
  b.fillRect(pad, binTop - 1.5, w - pad * 2, 3);

  for (const d of dividers) {
    const dw = d.w;
    b.fillStyle = 'rgba(26,10,52,.95)';
    b.fillRect(d.x - dw / 2, binTop, dw, floorY - binTop);
    const side = b.createLinearGradient(d.x - dw, 0, d.x + dw, 0);
    side.addColorStop(0, 'rgba(99,247,255,.55)');
    side.addColorStop(0.5, 'rgba(183,155,255,.2)');
    side.addColorStop(1, 'rgba(255,79,184,.55)');
    b.fillStyle = side;
    b.fillRect(d.x - dw / 2, binTop, 1.4, floorY - binTop);
    b.fillRect(d.x + dw / 2 - 1.4, binTop, 1.4, floorY - binTop);
    b.fillStyle = 'rgba(0,0,0,.4)';
    b.fillRect(d.x - dw / 2, binTop, dw, 3);
  }

  b.strokeStyle = 'rgba(99,247,255,.45)';
  b.lineWidth = 2;
  b.beginPath(); b.moveTo(pad, floorY); b.lineTo(w - pad, floorY); b.stroke();
  b.strokeStyle = 'rgba(255,79,184,.2)';
  b.lineWidth = 1;
  b.beginPath(); b.moveTo(pad, floorY + 2); b.lineTo(w - pad, floorY + 2); b.stroke();

  b.strokeStyle = 'rgba(255,255,255,.055)';
  b.lineWidth = 1;
  b.strokeRect(pad - 4.5, 6.5, w - pad * 2 + 9, floorY - 3);

  return c;
}

/* ── physics ────────────────────────────────────────── */
function circleRect(s, rx, ry, rw, rh) {
  const nx = clamp(s.x, rx, rx + rw);
  const ny = clamp(s.y, ry, ry + rh);
  const dx = s.x - nx, dy = s.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > s.r * s.r) return;

  let ux, uy, d;
  if (d2 > 0.0001) {
    d = Math.sqrt(d2);
    ux = dx / d; uy = dy / d;
    s.x = nx + ux * s.r;
    s.y = ny + uy * s.r;
  } else {
    const left = s.x - rx, right = rx + rw - s.x;
    const top = s.y - ry, bottom = ry + rh - s.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { ux = -1; uy = 0; s.x = rx - s.r; }
    else if (m === right) { ux = 1; uy = 0; s.x = rx + rw + s.r; }
    else if (m === top) { ux = 0; uy = -1; s.y = ry - s.r; }
    else { ux = 0; uy = 1; s.y = ry + rh + s.r; }
  }

  const vn = s.vx * ux + s.vy * uy;
  if (vn < 0) {
    s.vx -= 1.35 * vn * ux;
    s.vy -= 1.35 * vn * uy;
  }
}

function step(dt) {
  if (!geo.w) return;
  const { pad, w, floorY, binTop, pegs, dividers } = geo;
  const G = 1600;

  for (const s of state.seeds) {
    if (s.settled) {
      s.vx = 0; s.vy = 0;
    } else {
      s.vy = Math.min(1150, s.vy + G * dt);
      s.vx *= 0.999;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }

    if (s.x - s.r < pad) { s.x = pad + s.r; if (s.vx < 0) s.vx = Math.abs(s.vx) * 0.45; }
    if (s.x + s.r > w - pad) { s.x = w - pad - s.r; if (s.vx > 0) s.vx = -Math.abs(s.vx) * 0.45; }

    for (const p of pegs) {
      const dx = s.x - p.x, dy = s.y - p.y;
      const rr = s.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      s.x = p.x + nx * rr;
      s.y = p.y + ny * rr;
      const vn = s.vx * nx + s.vy * ny;
      if (vn < 0) {
        s.vx -= 1.5 * vn * nx;
        s.vy -= 1.5 * vn * ny;
        p.flash = 1;
      }
    }

    for (const d of dividers) {
      circleRect(s, d.x - d.w / 2, binTop, d.w, floorY - binTop);
    }

    if (s.y + s.r > floorY) {
      s.y = floorY - s.r;
      if (s.vy > 30) s.vy *= -0.28; else s.vy = 0;
      s.vx *= 0.9;
    }

    s.x = clamp(s.x, pad + s.r, w - pad - s.r);
  }

  for (let i = 0; i < state.seeds.length; i++) {
    const a = state.seeds[i];
    for (let j = i + 1; j < state.seeds.length; j++) {
      const b = state.seeds[j];
      const rr = a.r + b.r;
      const dx = b.x - a.x;
      if (dx > rr || dx < -rr) continue;
      const dy = b.y - a.y;
      if (dy > rr || dy < -rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;

      let d = Math.sqrt(d2);
      let nx, ny;
      if (d < 0.0001) { nx = 0; ny = -1; d = 0.0001; } else { nx = dx / d; ny = dy / d; }
      const push = (rr - d) * 0.5;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const imp = -(1.12 * vn) / 2;
        a.vx -= imp * nx; a.vy -= imp * ny;
        b.vx += imp * nx; b.vy += imp * ny;
      }
    }
  }

  for (const s of state.seeds) {
    s.x = clamp(s.x, pad + s.r, w - pad - s.r);
    if (s.y + s.r > floorY) s.y = floorY - s.r;
    for (const d of dividers) {
      circleRect(s, d.x - d.w / 2, binTop, d.w, floorY - binTop);
    }
  }

  for (const s of state.seeds) {
    if (s.settled) continue;
    const speed = Math.hypot(s.vx, s.vy);
    const grounded = s.y + s.r >= floorY - 2.5;
    if (s.y > binTop && grounded && speed < 30) {
      s.still++;
      if (s.still > 16) settle(s);
    } else if (speed > 90 || !grounded) {
      s.still = 0;
    }
  }
}

function settle(s) {
  s.settled = true;
  s.still = 0;
  s.vx = 0;
  s.vy = 0;

  const bin = binIndex(s.x);
  if (state.lastBin === bin) state.chain = Math.min(5, state.chain + 1);
  else state.chain = 1;
  state.lastBin = bin;
  state.best = Math.max(state.best, state.chain);

  const color = RARITIES[s.vi].color;
  const pts = RARITIES[s.vi].val * state.chain;
  state.score += pts;

  burst(s.x, s.y, color, s.vi >= 2 ? 16 : 7);
  floater(s.x, s.y - s.r - 5, `+${pts}`, color, state.chain > 1 ? `×${state.chain}` : '');
  geo.binFlash[bin] = 1;

  syncUI();
  save();
  checkSeal();
}

/* ── effects ────────────────────────────────────────── */
function burst(x, y, color, n) {
  const count = reduceMotion ? Math.min(4, n) : n;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-130, 130),
      vy: rand(-190, 20),
      life: 0, max: rand(0.4, 0.9),
      size: rand(1, 2.8),
      color,
      kind: 'spark',
    });
  }
}

function celebrate() {
  const colors = ['#63f7ff', '#ff4fb8', '#ffd166', '#c6ff8a', '#b79bff'];
  const n = reduceMotion ? 16 : 80;
  for (let i = 0; i < n; i++) {
    particles.push({
      x: rand(geo.pad, geo.w - geo.pad),
      y: rand(geo.h * 0.1, geo.h * 0.4),
      vx: rand(-70, 70),
      vy: rand(-40, 140),
      life: 0, max: rand(1, 2.1),
      size: rand(2, 4.5),
      color: colors[Math.floor(rand(0, colors.length))],
      kind: 'confetti',
      rot: rand(0, TAU),
      spin: rand(-6, 6),
    });
  }
}

function floater(x, y, text, color, suffix) {
  floaters.push({ x, y, text, suffix, color, life: 0, max: 1.25 });
  if (floaters.length > 14) floaters.shift();
}

function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.vy += (p.kind === 'confetti' ? 260 : 420) * dt;
    p.vx *= 0.99;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life += dt;
    if (f.life >= f.max) { floaters.splice(i, 1); continue; }
    f.y -= 34 * dt;
  }
  for (let i = 0; i < 3; i++) {
    geo.binFlash[i] = Math.max(0, geo.binFlash[i] - dt * 2.2);
  }
}

/* ── draw ───────────────────────────────────────────── */
function draw(now) {
  if (!geo.w) return;
  const { w, h } = geo;
  ctx.clearRect(0, 0, w, h);
  if (geo.bg) ctx.drawImage(geo.bg, 0, 0, w, h);

  drawAimLine(now);
  drawBinFlashes();
  drawPegs();
  drawSeeds(now);
  drawAimMarker(now);
  drawFx();
}

function drawAimLine(now) {
  if (pointerX === null) return;
  const alpha = 0.28 + Math.sin(now / 420) * 0.07;
  ctx.save();
  ctx.strokeStyle = `rgba(99,247,255,${alpha})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(pointerX, 22);
  ctx.lineTo(pointerX, geo.binTop - 14);
  ctx.stroke();
  ctx.restore();
}

function drawAimMarker(now) {
  if (pointerX === null) return;
  const x = pointerX;
  const pulse = 0.55 + Math.sin(now / 300) * 0.15;
  ctx.save();
  ctx.shadowColor = '#63f7ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = `rgba(99,247,255,${pulse + 0.25})`;
  ctx.beginPath();
  ctx.moveTo(x, 23);
  ctx.lineTo(x - 5, 11);
  ctx.lineTo(x + 5, 11);
  ctx.closePath();
  ctx.fill();
  const r = RARITIES[state.next].r * (geo.w < 400 ? 0.92 : 1);
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(233,220,255,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, 32, r * 0.62, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawBinFlashes() {
  const binW = (geo.w - geo.pad * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const f = geo.binFlash[i];
    if (f <= 0) continue;
    const cx = geo.pad + binW * (i + 0.5);
    const cy = geo.floorY - 16;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, binW * 0.7);
    const color = ['#63f7ff', '#ff5fce', '#ffd166'][i];
    g.addColorStop(0, rgba(color, 0.22 * f));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - binW, geo.binTop, binW * 2, geo.floorY - geo.binTop);
  }
}

function drawPegs() {
  for (const p of geo.pegs) {
    if (p.fin) {
      const glow = 0.55 + p.flash * 0.45;
      ctx.save();
      ctx.shadowColor = '#b79bff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(22,8,44,.95)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(183,155,255,${glow})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,209,102,${0.5 + p.flash * 0.5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fillStyle = 'rgba(34,14,68,.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(167,138,255,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(233,220,255,.4)';
    ctx.beginPath(); ctx.arc(p.x - 1.4, p.y - 1.4, 1.1, 0, TAU); ctx.fill();

    if (p.flash > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 5, 0, TAU);
      ctx.strokeStyle = `rgba(99,247,255,${p.flash * 0.65})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      p.flash = Math.max(0, p.flash - 0.05);
    }
  }
}

function drawSeeds(now) {
  for (const s of state.seeds) {
    if (s.settled) continue;
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 140) {
      ctx.strokeStyle = rgba(RARITIES[s.vi].color, 0.22);
      ctx.lineWidth = s.r * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
  }

  for (const s of state.seeds) {
    const sp = sprites[s.vi];
    if (!sp) continue;
    ctx.drawImage(sp.canvas, s.x - sp.size / 2, s.y - sp.size / 2, sp.size, sp.size);

    if (s.vi >= 2 && !s.settled) {
      ctx.save();
      ctx.strokeStyle = rgba(RARITIES[s.vi].color, 0.6);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -now / 55;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 5.5, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawFx() {
  for (const p of particles) {
    const a = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + p.spin * p.life);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floaters) {
    const a = 1 - f.life / f.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 10;
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.fillText(f.text, f.x, f.y);
    if (f.suffix) {
      ctx.font = '700 10px "Chakra Petch", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(f.suffix, f.x, f.y - 13);
    }
  }
  ctx.restore();
}

/* ── interaction ────────────────────────────────────── */
function drop(x) {
  if (state.sealed) {
    toast('VAULT SEALED · EXPORT OR PURGE', true);
    return;
  }
  if (state.seeds.length >= MAX_SEEDS) {
    toast('CHAMBER FULL · PURGE TO REFILL');
    return;
  }

  const vi = state.next;
  state.next = rollRarity();
  const r = seedRadius(vi);
  const cx = clamp(x, geo.pad + r + 2, geo.w - geo.pad - r - 2);

  state.seeds.push({
    x: cx, y: 29, vx: rand(-40, 40), vy: 30,
    r, vi, settled: false, still: 0,
  });
  state.drops++;
  pointerX = cx;
  burst(cx, 30, RARITIES[vi].color, 5);
  machineEl.classList.remove('thump');
  void machineEl.offsetWidth;
  machineEl.classList.add('thump');
  syncUI();
  save();
}

function syncUI() {
  if (state.score !== lastScore) {
    ui.score.textContent = fmt(state.score);
    ui.score.classList.remove('pop');
    void ui.score.offsetWidth;
    ui.score.classList.add('pop');
    lastScore = state.score;
  }
  ui.drops.textContent = fmt(state.drops);
  ui.chainTop.textContent = '×' + state.chain;
  ui.bestLine.textContent = '×' + state.best;

  const r = RARITIES[state.next];
  ui.nextName.textContent = r.name;
  ui.nextVal.textContent = '+' + r.val;
  ui.nextDot.style.setProperty('--c', r.color);

  const pct = Math.min(100, (state.score / TARGET) * 100);
  ui.sealFill.style.width = pct + '%';
  ui.sealText.textContent = `${fmt(Math.min(state.score, TARGET))} / ${TARGET}`;
  ui.sealBar.setAttribute('aria-valuenow', String(Math.min(state.score, TARGET)));

  const counts = [0, 0, 0];
  for (const s of state.seeds) if (s.settled) counts[binIndex(s.x)]++;
  counts.forEach((c, i) => {
    if (c !== lastCounts[i]) {
      binEls[i].textContent = c;
      binEls[i].classList.remove('pop');
      void binEls[i].offsetWidth;
      binEls[i].classList.add('pop');
    } else if (binEls[i].textContent !== String(c)) {
      binEls[i].textContent = c;
    }
  });
  lastCounts = counts;

  ui.empty.classList.toggle('gone', state.drops > 0);
  ui.sealedBanner.hidden = !state.sealed;
  document.body.classList.toggle('is-sealed', state.sealed);
  ui.hintAlt.textContent = state.sealed
    ? 'VAULT SEALED · EXPORT OR PURGE'
    : state.seeds.length >= MAX_SEEDS
      ? 'CHAMBER FULL · PURGE TO REFILL'
      : 'GRAVITY 1.24 G · CLICK ONLY';
}

function checkSeal() {
  if (state.sealed || state.score < TARGET) return;
  state.sealed = true;
  celebrate();
  toast('VAULT SEALED · MYRTLE APPROVES', true);
  syncUI();
  save();
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  pointerX = clamp(e.clientX - rect.left, geo.pad, geo.w - geo.pad);
  drop(pointerX);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const rect = canvas.getBoundingClientRect();
  pointerX = clamp(e.clientX - rect.left, geo.pad, geo.w - geo.pad);
});

canvas.addEventListener('pointerleave', () => {
  // keep the last aim; the machine holds its position.
});

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    pointerX = geo.w / 2;
    drop(geo.w / 2);
  }
});

/* ── persistence ────────────────────────────────────── */
function snapshot() {
  return {
    v: 1,
    score: state.score,
    drops: state.drops,
    chain: state.chain,
    best: state.best,
    lastBin: state.lastBin,
    seeds: state.seeds.map((s) => [
      Math.round(s.x), Math.round(s.y), s.vi, s.settled ? 1 : 0,
    ]),
  };
}

function seedFromArray(arr) {
  if (!Array.isArray(arr) || !geo.w) return null;
  const vi = Math.round(+arr[2]);
  if (!(vi >= 0 && vi < RARITIES.length)) return null;
  const x = +arr[0], y = +arr[1];
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const settled = arr[3] !== 0;
  const r = seedRadius(vi);
  return {
    x: clamp(x, geo.pad + r, geo.w - geo.pad - r),
    y: clamp(y, r + 10, geo.floorY - r),
    r, vi, settled, still: settled ? 99 : 0,
    vx: 0, vy: settled ? 0 : 40,
  };
}

function applyData(d) {
  if (!d || typeof d !== 'object') return false;
  const score = Number(d.score);
  if (!Number.isFinite(score)) return false;

  state.score = clamp(Math.round(score), 0, 9999999);
  state.drops = clamp(Math.round(Number(d.drops) || 0), 0, 99999);
  state.chain = clamp(Math.round(Number(d.chain) || 1), 1, 5);
  state.best = clamp(Math.round(Number(d.best) || state.chain), 1, 5);
  state.lastBin = clamp(Math.round(Number(d.lastBin)), -1, 2);
  if (!Number.isFinite(state.lastBin)) state.lastBin = -1;

  state.seeds = [];
  const raw = Array.isArray(d.seeds) ? d.seeds.slice(0, MAX_SEEDS) : [];
  for (const item of raw) {
    const s = seedFromArray(item);
    if (s) state.seeds.push(s);
  }
  state.sealed = state.score >= TARGET;
  state.next = rollRarity();
  lastCounts = [-1, -1, -1];
  lastScore = -1;
  return true;
}

function encodeState() {
  const seeds = state.seeds
    .filter((s) => s.settled)
    .map((s) => s.vi.toString(36)
      + Math.round(s.x / 4).toString(36).padStart(2, '0')
      + Math.round(s.y / 4).toString(36).padStart(2, '0'))
    .join('');
  return [
    'mvv1',
    state.score.toString(36),
    state.drops.toString(36),
    state.chain.toString(36),
    (state.lastBin + 1).toString(36),
    state.best.toString(36),
    seeds,
  ].join('-');
}

function decodeHash() {
  if (!location.hash.startsWith('#mvv1-')) return null;
  const parts = location.hash.slice(1).split('-');
  if (parts.length < 7) return null;
  const score = parseInt(parts[1], 36);
  if (!Number.isFinite(score)) return null;

  const seeds = [];
  const body = parts[6] || '';
  for (let i = 0; i + 5 <= body.length; i += 5) {
    const vi = parseInt(body[i], 36);
    const x = parseInt(body.slice(i + 1, i + 3), 36) * 4;
    const y = parseInt(body.slice(i + 3, i + 5), 36) * 4;
    if (!(vi >= 0 && vi < RARITIES.length) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    seeds.push([x, y, vi, 1]);
    if (seeds.length >= MAX_SEEDS) break;
  }

  return {
    score,
    drops: parseInt(parts[2], 36) || 0,
    chain: parseInt(parts[3], 36) || 1,
    lastBin: (parseInt(parts[4], 36) || 1) - 1,
    best: parseInt(parts[5], 36) || 1,
    seeds,
  };
}

function load() {
  let data = decodeHash();
  let fromHash = !!data;
  if (!data) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch { /* private mode or blocked storage */ }
  }
  if (data && applyData(data)) {
    if (fromHash) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file:// quirks */ }
      setTimeout(() => toast('VAULT RESTORED FROM SNAPSHOT'), 450);
    }
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(writeSave, 320);
}

function writeSave() {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
  } catch { /* storage unavailable; the vault lives in memory */ }
}

function resetVault() {
  state.score = 0;
  state.drops = 0;
  state.chain = 1;
  state.best = 1;
  state.lastBin = -1;
  state.seeds = [];
  state.sealed = false;
  state.next = rollRarity();
  particles.length = 0;
  floaters.length = 0;
  geo.binFlash = [0, 0, 0];
  lastCounts = [-1, -1, -1];
  lastScore = -1;
  disarmPurge();

  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* noop */ }

  ui.shareOut.hidden = true;
  syncUI();
  save();
  toast('VAULT PURGED · MYRTLE STARTS AGAIN');
}

/* ── share + export ─────────────────────────────────── */
function toast(msg, gold = false) {
  clearTimeout(toastTimer);
  ui.toast.textContent = msg;
  ui.toast.classList.toggle('gold', gold);
  ui.toast.classList.add('show');
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 2800);
}

async function share() {
  const url = location.href.split('#')[0] + '#' + encodeState();
  try {
    await navigator.clipboard.writeText(url);
    ui.shareOut.hidden = true;
    toast('SNAPSHOT LINK COPIED');
  } catch {
    ui.shareOut.textContent = url;
    ui.shareOut.hidden = false;
    toast('CLIPBOARD BLOCKED · LINK SHOWN');
  }
}

function armPurge() {
  if (purgeArmed) {
    purgeArmed = false;
    resetVault();
    return;
  }
  purgeArmed = true;
  ui.purgeBtn.textContent = 'CLICK AGAIN TO PURGE';
  ui.purgeBtn.classList.add('armed');
  clearTimeout(purgeTimer);
  purgeTimer = window.setTimeout(disarmPurge, 3400);
}

function disarmPurge() {
  purgeArmed = false;
  clearTimeout(purgeTimer);
  ui.purgeBtn.textContent = 'PURGE VAULT';
  ui.purgeBtn.classList.remove('armed');
}

function drawSpaced(g, text, x, y, spacing, align) {
  if (!spacing) {
    g.textAlign = align;
    g.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  g.textAlign = 'left';
  chars.forEach((ch, i) => {
    g.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
}

function buildPoster() {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0124');
  bg.addColorStop(0.52, '#1c033b');
  bg.addColorStop(1, '#0c0128');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const rnd = lcg(1986);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W, y = rnd() * H * 0.9;
    const a = rnd() * 0.5 + 0.1, r = rnd() * 1.5 + 0.35;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  const sx = W / 2, sy = 455, sr = 250;
  const sun = g.createRadialGradient(sx, sy - 50, 20, sx, sy, sr);
  sun.addColorStop(0, '#ffe2f5');
  sun.addColorStop(0.36, '#ff6cc6');
  sun.addColorStop(0.78, '#a11c86');
  sun.addColorStop(1, 'rgba(120,12,100,0)');
  g.save();
  g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.clip();
  g.fillStyle = sun;
  g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  g.fillStyle = 'rgba(13,1,34,.8)';
  for (let i = 0; i < 9; i++) {
    const y = sy + 30 + i * ((sr - 30) / 9);
    g.fillRect(sx - sr, y, sr * 2, 3.4 + i * 1.5);
  }
  g.restore();

  g.save();
  g.beginPath(); g.rect(0, 840, W, H - 840); g.clip();
  g.strokeStyle = 'rgba(99,247,255,.16)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const y = 840 + i * 38;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  for (let i = -12; i <= 12; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * 42, 840);
    g.lineTo(W / 2 + i * 300, H);
    g.stroke();
  }
  g.restore();

  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(99,247,255,.85)';
  g.font = '600 19px "Chakra Petch", sans-serif';
  drawSpaced(g, 'ANALOG CACHE ENGINE · EST. 1986', W / 2, 92, 5, 'center');

  const titleFill = g.createLinearGradient(0, 120, 0, 286);
  titleFill.addColorStop(0, '#ffffff');
  titleFill.addColorStop(0.44, '#ffd9f4');
  titleFill.addColorStop(0.75, '#ff4fb8');
  titleFill.addColorStop(1, '#9a5bff');
  g.save();
  g.shadowColor = 'rgba(255,79,184,.55)';
  g.shadowBlur = 34;
  g.fillStyle = titleFill;
  g.textAlign = 'center';
  g.font = '94px Monoton, Impact, fantasy';
  g.fillText('MYRTLE VOLE', W / 2, 218);
  g.fillText('VAULT', W / 2, 306);
  g.restore();

  g.fillStyle = 'rgba(233,220,255,.75)';
  g.font = '500 19px "Chakra Petch", sans-serif';
  drawSpaced(g, 'A NEON BURROW FOR WINTER SEEDS', W / 2, 352, 4.5, 'center');

  const fx = 96, fy = 400, fw = 888, fh = 610;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.6)';
  g.shadowBlur = 40;
  g.shadowOffsetY = 18;
  roundRect(g, fx, fy, fw, fh, 26);
  g.fillStyle = '#0b0122';
  g.fill();
  g.restore();

  g.save();
  roundRect(g, fx, fy, fw, fh, 26);
  g.clip();
  const inner = g.createLinearGradient(0, fy, 0, fy + fh);
  inner.addColorStop(0, '#130332');
  inner.addColorStop(1, '#080117');
  g.fillStyle = inner;
  g.fillRect(fx, fy, fw, fh);

  if (geo.w) {
    const padF = 24;
    const sc = Math.min((fw - padF * 2) / geo.w, (fh - padF * 2) / geo.h);
    const ox = fx + (fw - geo.w * sc) / 2;
    const oy = fy + (fh - geo.h * sc) / 2;

    g.save();
    g.translate(ox, oy);
    g.scale(sc, sc);

    g.fillStyle = 'rgba(99,247,255,.06)';
    g.fillRect(geo.pad, geo.binTop, geo.w - geo.pad * 2, geo.floorY - geo.binTop);
    for (let i = 0; i < 8; i++) {
      const y = geo.binTop + ((geo.floorY - geo.binTop) * i) / 7;
      g.strokeStyle = 'rgba(99,247,255,.1)';
      g.lineWidth = 1 / sc;
      g.beginPath(); g.moveTo(geo.pad, y); g.lineTo(geo.w - geo.pad, y); g.stroke();
    }

    for (const d of geo.dividers) {
      g.fillStyle = 'rgba(26,10,52,.95)';
      g.fillRect(d.x - d.w / 2, geo.binTop, d.w, geo.floorY - geo.binTop);
      g.fillStyle = 'rgba(183,155,255,.5)';
      g.fillRect(d.x - d.w / 2, geo.binTop, 1.2 / sc, geo.floorY - geo.binTop);
      g.fillRect(d.x + d.w / 2 - 1.2 / sc, geo.binTop, 1.2 / sc, geo.floorY - geo.binTop);
    }

    for (const p of geo.pegs) {
      if (p.fin) continue;
      g.beginPath();
      g.arc(p.x, p.y, Math.max(p.r, 3.4), 0, TAU);
      g.fillStyle = 'rgba(38,16,76,.96)';
      g.fill();
      g.strokeStyle = 'rgba(183,155,255,.55)';
      g.lineWidth = 1 / sc;
      g.stroke();
    }

    for (const s of state.seeds) {
      const color = RARITIES[s.vi].color;
      const r = Math.max(s.r, 4.4);
      g.beginPath(); g.arc(s.x, s.y, r * 2.1, 0, TAU);
      g.fillStyle = rgba(color, 0.1);
      g.fill();
      g.beginPath(); g.arc(s.x, s.y, r, 0, TAU);
      g.fillStyle = color;
      g.fill();
      g.beginPath(); g.arc(s.x - r * 0.3, s.y - r * 0.34, r * 0.28, 0, TAU);
      g.fillStyle = 'rgba(255,255,255,.8)';
      g.fill();
    }

    g.strokeStyle = 'rgba(99,247,255,.5)';
    g.lineWidth = 2 / sc;
    g.beginPath(); g.moveTo(geo.pad, geo.floorY); g.lineTo(geo.w - geo.pad, geo.floorY); g.stroke();
    g.restore();
  }
  g.restore();

  const frame = g.createLinearGradient(fx, fy, fx + fw, fy + fh);
  frame.addColorStop(0, 'rgba(99,247,255,.75)');
  frame.addColorStop(0.5, 'rgba(255,79,184,.75)');
  frame.addColorStop(1, 'rgba(183,155,255,.6)');
  roundRect(g, fx, fy, fw, fh, 26);
  g.strokeStyle = frame;
  g.lineWidth = 3;
  g.stroke();

  g.save();
  g.translate(fx + fw - 150, fy + 62);
  g.rotate(-0.12);
  roundRect(g, -98, -30, 196, 60, 8);
  g.fillStyle = 'rgba(8,1,22,.75)';
  g.fill();
  g.strokeStyle = state.sealed ? 'rgba(255,209,102,.95)' : 'rgba(183,155,255,.5)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = state.sealed ? '#ffd166' : '#b79bff';
  g.font = '700 21px "Chakra Petch", sans-serif';
  g.textBaseline = 'middle';
  drawSpaced(g, state.sealed ? 'SEALED' : 'IN PROGRESS', 0, 2, 4, 'center');
  g.restore();
  g.textBaseline = 'alphabetic';

  const stats = [
    ['CACHE VALUE', fmt(state.score), '#63f7ff'],
    ['SEEDS DROPPED', String(state.drops), '#ff5fce'],
    ['BEST CHAIN', '×' + state.best, '#ffd166'],
  ];
  const sw = (W - 192 - 36) / 3;
  stats.forEach(([label, value, color], i) => {
    const x = 96 + i * (sw + 18);
    roundRect(g, x, 1052, sw, 96, 12);
    g.fillStyle = 'rgba(20,6,44,.78)';
    g.fill();
    g.strokeStyle = 'rgba(183,155,255,.24)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = 'rgba(173,143,217,.85)';
    g.font = '600 14px "Chakra Petch", sans-serif';
    drawSpaced(g, label, x + 22, 1084, 2.4, 'left');
    g.fillStyle = color;
    g.font = '700 38px "Chakra Petch", sans-serif';
    g.textAlign = 'left';
    g.fillText(value, x + 22, 1128);
  });

  g.textAlign = 'left';
  g.fillStyle = 'rgba(173,143,217,.6)';
  g.font = '600 14px "Chakra Petch", sans-serif';
  drawSpaced(g, 'SEED INDEX', W / 2, 1190, 3.4, 'center');
  let lx = W / 2 - 300;
  for (const r of RARITIES) {
    g.beginPath();
    g.arc(lx, 1222, 7, 0, TAU);
    g.fillStyle = r.color;
    g.fill();
    g.fillStyle = 'rgba(233,220,255,.9)';
    g.font = '600 15px "Chakra Petch", sans-serif';
    g.textAlign = 'left';
    g.fillText(r.name, lx + 16, 1228);
    g.fillStyle = 'rgba(173,143,217,.65)';
    g.font = '500 14px "Chakra Petch", sans-serif';
    g.fillText('+' + r.val, lx + 24 + g.measureText(r.name).width, 1228);
    lx += 156;
  }

  g.fillStyle = 'rgba(233,220,255,.6)';
  g.font = '500 15px "Chakra Petch", sans-serif';
  drawSpaced(g, `MYRTLE VOLE VAULT · ${dateLabel()}`, W / 2, 1298, 3, 'center');
  g.fillStyle = 'rgba(99,247,255,.55)';
  g.font = '500 13px "Chakra Petch", sans-serif';
  drawSpaced(g, 'SORTED BY GRAVITY · SOFTLY SUPERVISED', W / 2, 1324, 2.6, 'center');

  return c;
}

async function exportPoster() {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch { /* fall back to system fonts */ }

  let poster;
  try {
    poster = buildPoster();
  } catch {
    toast('EXPORT FAILED');
    return;
  }

  const done = (blob) => {
    if (!blob) { toast('EXPORT FAILED'); return; }
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `myrtle-vole-vault-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('POSTER EXPORTED');
  };

  if (poster.toBlob) poster.toBlob(done, 'image/png');
  else done(null);
}

/* ── wire up ────────────────────────────────────────── */
ui.exportBtn.addEventListener('click', exportPoster);
ui.shareBtn.addEventListener('click', share);
ui.purgeBtn.addEventListener('click', armPurge);

const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    resize();
    syncUI();
  }, 90);
});
let resizeTimer = 0;
ro.observe(screenEl);

window.addEventListener('pagehide', writeSave);

resize();
load();
syncUI();

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!document.hidden) {
    acc += dt;
    let guard = 0;
    while (acc >= FIXED && guard++ < 7) {
      step(FIXED);
      acc -= FIXED;
    }
    updateFx(dt);
    draw(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame((t) => {
  lastT = t;
  frame(t);
});
