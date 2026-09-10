/* ──────────────────────────────────────────────────────────────
   Paper Garden — fold origami flora that blooms on click
   Fold engine · Bloom garden · Seed sharing
   Plain ES module, no dependencies.
   ────────────────────────────────────────────────────────────── */

/* ── constants ─────────────────────────────────────────────── */
const TAU = Math.PI * 2;
const MAX_FLOWERS = 26;
const STORE_KEY = 'paper-garden.v1';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const PAPER_D = [242, 237, 226];
const PAPER_N = [23, 22, 19];
const INK_D = [33, 30, 25];
const INK_N = [236, 230, 216];

// curated washi palette — restrained by design
const PALETTE = {
  shu:     [184, 68, 47],
  ai:      [51, 80, 95],
  sakura:  [212, 143, 138],
  yamabuki:[196, 150, 66],
  matcha:  [124, 134, 79],
  fuji:    [126, 110, 150],
  sumire:  [88, 104, 150],
  kaki:    [198, 118, 58],
};

/* ── tiny math ─────────────────────────────────────────────── */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomSeed(len = 6) {
  const arr = new Uint8Array(len);
  try { (crypto || window.crypto).getRandomValues(arr); }
  catch (e) { for (let i = 0; i < len; i++) arr[i] = (Math.random() * 256) | 0; }
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[arr[i] % 32];
  return s;
}
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

/* ── seed → genome ─────────────────────────────────────────── */
const PAL_KEYS = Object.keys(PALETTE);
function genomeFromSeed(seed) {
  const r = mulberry32(hashStr('paper-garden:' + seed));
  const col = PAL_KEYS[(r() * PAL_KEYS.length) | 0];
  const coreKey = r() < 0.5 ? 'yamabuki' : (r() < 0.5 ? 'shu' : 'sumire');
  const stemKey = r() < 0.62 ? 'matcha' : 'ai';
  return {
    seed,
    col, coreKey, stemKey,
    rings: r() < 0.45 ? 2 : 3,
    petals: 5 + ((r() * 4) | 0),        // 5..8
    size: 0.82 + r() * 0.55,
    spread: 0.62 + r() * 0.5,
    curl: 0.12 + r() * 0.5,
    stem: 0.72 + r() * 0.85,
    lean: (r() * 2 - 1) * 0.16,
  };
}

/* ── fold engine: local petal geometry ─────────────────────── */
function petalPoints(L, w0, w1, curl, seg = 4) {
  const pts = [];
  const at = (t, sign) => {
    const x = t * L;
    const w = w0 * (1 - t) + w1 * Math.sin(Math.PI * t);
    return { x, y: curl * L * t * t, z: sign * w };
  };
  for (let i = 0; i <= seg; i++) pts.push(at(i / seg, -1));
  for (let i = seg; i >= 0; i--) pts.push(at(i / seg, 1));
  return pts;
}

function buildModel(g) {
  const petals = [];
  const rings = g.rings;
  for (let r = 0; r < rings; r++) {
    const t = rings > 1 ? r / (rings - 1) : 1;
    const L = (1.18 - 0.52 * t) * g.size;
    const w0 = 0.12 * L, w1 = 0.30 * L;
    const curl = g.curl * (0.45 + 0.7 * t);
    const n = Math.max(4, g.petals - (r > 0 ? 1 : 0));
    const closed = lerp(1.72, 1.98, t);
    const open = clamp(lerp(0.74, 1.04, t) * g.spread + r * 0.05, 0.4, 1.45);
    const baseR = 0.015 + 0.05 * (1 - t);
    const yOff = 0.02 + 0.11 * t;
    const phaseOff = r * 0.5;
    const local = petalPoints(L, w0, w1, curl, 4);
    for (let i = 0; i < n; i++) {
      petals.push({ phi: phaseOff + (i / n) * TAU, closed, open, baseR, yOff, local, ring: r });
    }
  }
  const coreR = 0.15 * g.size;
  const core = [], coreInner = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU - Math.PI / 2; core.push({ x: Math.cos(a) * coreR, y: 0, z: Math.sin(a) * coreR }); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; coreInner.push({ x: Math.cos(a) * coreR * 0.55, y: 0.035, z: Math.sin(a) * coreR * 0.55 }); }
  const leaf = [
    { x: 0, y: 0, z: 0 },
    { x: 0.16, y: 0.05, z: 0.10 },
    { x: 0.44, y: 0.02, z: 0 },
    { x: 0.16, y: -0.02, z: -0.10 },
  ];
  return {
    petals, core, coreInner, leaf,
    coreY: 0.055 + 0.10 * (rings > 1 ? 1 : 0),
    stemW: 0.045 * (0.8 + 0.4 * g.size),
  };
}

/* ── camera + projection ───────────────────────────────────── */
const cam = {
  pos: { x: 0, y: 5.4, z: 8.2 },
  target: { x: 0, y: 1.35, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  f: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 },
  focal: 1000, depth: 9,
};
let W = 1, H = 1;
let parallax = { x: 0, y: 0 }, parallaxT = { x: 0, y: 0 };

function updateCamera() {
  const narrow = W < 640;
  cam.pos.y = narrow ? 4.6 : 5.4;
  cam.pos.z = narrow ? 6.6 : 8.2;
  cam.target.y = (narrow ? 1.15 : 1.35) - parallax.y * 0.2;
  cam.target.x = parallax.x * 0.35;
  const f = norm(sub(cam.target, cam.pos));
  const r = norm(cross(f, cam.up));
  const u = cross(r, f);
  cam.f = f; cam.r = r; cam.u = u;
  cam.depth = Math.hypot(cam.pos.x - cam.target.x, cam.pos.y - cam.target.y, cam.pos.z - cam.target.z);
  const bedW = narrow ? 5.2 : 9.4;
  cam.focal = (0.86 * W / bedW) * cam.depth;
}
function projectPoint(p) {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.f);
  if (z <= 0.06) return { X: 0, Y: 0, depth: z, s: 0, ok: false };
  const x = dot(d, cam.r), y = dot(d, cam.u);
  const s = cam.focal / z;
  return { X: W / 2 + x * s, Y: H * 0.54 - y * s, depth: z, s, ok: true };
}
function groundFromScreen(px, py) {
  const a = (px - W / 2) / cam.focal;
  const b = (H * 0.54 - py) / cam.focal;
  const dir = norm({
    x: cam.f.x + cam.r.x * a + cam.u.x * b,
    y: cam.f.y + cam.r.y * a + cam.u.y * b,
    z: cam.f.z + cam.r.z * a + cam.u.z * b,
  });
  if (dir.y >= -1e-4) return null;
  const t = -cam.pos.y / dir.y;
  return { x: cam.pos.x + dir.x * t, y: 0, z: cam.pos.z + dir.z * t };
}

/* ── canvas / dom ──────────────────────────────────────────── */
const canvas = document.getElementById('garden');
const ctx = canvas.getContext('2d');
const countEl = document.getElementById('count');
const seasonEl = document.getElementById('season');
const modeBtn = document.getElementById('modeBtn');
const hintEl = document.getElementById('hint');
const toastEl = document.getElementById('toast');
const panel = document.getElementById('seedpanel');
const seedInput = document.getElementById('seedInput');
const shareOut = document.getElementById('shareOut');
const seedGo = document.getElementById('seedGo');
const seedRandom = document.getElementById('seedRandom');
const shareCopy = document.getElementById('shareCopy');
const panelClose = document.getElementById('panelClose');
const brandEl = document.querySelector('.brand');

/* ── state ─────────────────────────────────────────────────── */
const flowers = [];
const particles = [];
let fireflies = [];
let night = false;
let soundOn = true;
let hovered = null;
let pointer = { x: -9999, y: -9999, has: false };
let inkRGB = '33,30,25';
let ready = false;
let eggBuf = '';
let last = performance.now();

/* ── audio (WebAudio, no assets) ───────────────────────────── */
let actx = null;
function ensureAudio() {
  if (!soundOn) return null;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  } catch (e) { return null; }
}
function rustle(vol = 0.05) {
  const a = ensureAudio(); if (!a) return;
  const n = Math.floor(a.sampleRate * 0.16);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.7;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(a.destination);
  src.start(a.currentTime);
}
const NOTES = [523.25, 587.33, 698.46, 783.99, 880.0];
function pluck(freq) {
  const a = ensureAudio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + 1);
}

/* ── colors ────────────────────────────────────────────────── */
function petalColor(g) {
  const base = PALETTE[g.col] || PALETTE.shu;
  return mix(night ? PAPER_N : PAPER_D, base, night ? 0.7 : 0.82);
}
function stemColor(g) { return mix(night ? PAPER_N : PAPER_D, PALETTE[g.stemKey] || PALETTE.matcha, 0.86); }
function coreColor(g) { return mix(night ? PAPER_N : PAPER_D, PALETTE[g.coreKey] || PALETTE.yamabuki, 0.92); }

/* ── render ────────────────────────────────────────────────── */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  W = w; H = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  updateCamera();
}

function drawGround() {
  const R = 6.4;
  const o = projectPoint({ x: 0, y: 0, z: 0 });
  const e = projectPoint({ x: R, y: 0, z: 0 });
  if (o.ok && e.ok) {
    const rad = Math.abs(e.X - o.X);
    const g = ctx.createRadialGradient(o.X, o.Y, 0, o.X, o.Y, rad);
    g.addColorStop(0, `rgba(${inkRGB},${night ? 0.10 : 0.055})`);
    g.addColorStop(0.65, `rgba(${inkRGB},${night ? 0.035 : 0.018})`);
    g.addColorStop(1, `rgba(${inkRGB},0)`);
    ctx.save();
    ctx.translate(o.X, o.Y); ctx.scale(1, 0.42); ctx.translate(-o.X, -o.Y);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(o.X, o.Y, rad, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const hl = projectPoint({ x: -R, y: 0, z: -R });
  const hr = projectPoint({ x: R, y: 0, z: -R });
  if (hl.ok && hr.ok) {
    ctx.strokeStyle = `rgba(${inkRGB},${night ? 0.1 : 0.07})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hl.X, hl.Y); ctx.lineTo(hr.X, hr.Y); ctx.stroke();
  }
}

function drawShadow(f) {
  const o = projectPoint({ x: f.x, y: 0, z: f.z });
  if (!o.ok) return;
  const r = 0.55 * o.s * f.g.size * (0.55 + 0.45 * f.grow);
  const g = ctx.createRadialGradient(o.X, o.Y, 0, o.X, o.Y, r);
  g.addColorStop(0, `rgba(${inkRGB},${night ? 0.22 : 0.13})`);
  g.addColorStop(1, `rgba(${inkRGB},0)`);
  ctx.save();
  ctx.translate(o.X, o.Y); ctx.scale(1, 0.4); ctx.translate(-o.X, -o.Y);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(o.X, o.Y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

function collectFaces(f, now, out) {
  const g = f.g, m = f.model;
  const t = (now - f.t0) / f.dur;
  const grow = easeOutCubic(clamp(t * 1.5, 0, 1));
  const bp = easeOutBack(clamp((t - 0.28) / 0.72, 0, 1));
  f.grow = grow; f.bloom = clamp(bp, 0, 1);
  const stemH = g.stem * grow;
  const scl = 0.45 + 0.55 * grow;
  const ts = now * 0.001;
  const amp = 0.016 + 0.03 * (1 - f.bloom);
  const ax = Math.sin(ts * 0.9 + f.phase) * amp;
  const az = Math.cos(ts * 0.72 + f.phase * 1.3) * amp * 0.55;
  const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(az), sb = Math.sin(az);
  const place = (p) => {
    const x1 = p.x * ca - p.y * sa, y1 = p.x * sa + p.y * ca, z1 = p.z;
    const y2 = y1 * cb - z1 * sb, z2 = y1 * sb + z1 * cb;
    return { x: x1 + f.x, y: y2, z: z2 + f.z };
  };
  const light = norm({ x: -0.35, y: 0.9, z: 0.55 });

  const pushFace = (pts, baseCol, creases, bias) => {
    const world = pts.map(place);
    const proj = world.map(projectPoint);
    for (let i = 0; i < proj.length; i++) if (!proj[i].ok) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, dsum = 0;
    for (const p of proj) {
      if (p.X < minX) minX = p.X; if (p.X > maxX) maxX = p.X;
      if (p.Y < minY) minY = p.Y; if (p.Y > maxY) maxY = p.Y;
      dsum += p.depth;
    }
    if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) return;
    const n = norm(cross(sub(world[1], world[0]), sub(world[2], world[0])));
    const shade = clamp((0.62 + 0.46 * Math.abs(dot(n, light))) * (bias || 1), 0.4, 1.18);
    const col = [baseCol[0] * shade, baseCol[1] * shade, baseCol[2] * shade];
    let crease = null;
    if (creases) crease = creases.map((seg) => seg.map((pp) => projectPoint(place(pp))));
    out.push({ proj, depth: dsum / proj.length, col, crease });
  };

  const pcol = petalColor(g);
  const seg = 4;
  for (const p of m.petals) {
    const th = lerp(p.closed, p.open, clamp(bp, 0, 1.12));
    const cth = Math.cos(th), sth = Math.sin(th);
    const cphi = Math.cos(p.phi), sphi = Math.sin(p.phi);
    const yBase = stemH + p.yOff * scl;
    const bR = p.baseR * scl;
    const xf = (lp) => {
      const fx = (lp.x * scl) * cth - (lp.y * scl) * sth;
      const fy = (lp.x * scl) * sth + (lp.y * scl) * cth;
      const fz = lp.z * scl;
      return { x: fx * cphi + fz * sphi + bR * cphi, y: fy + yBase, z: -fx * sphi + fz * cphi + bR * sphi };
    };
    const pts = p.local.map(xf);
    const crease = [[xf(p.local[0]), xf(p.local[seg])]];
    pushFace(pts, pcol, crease, 1 - p.ring * 0.025);
  }

  const coreY = stemH + m.coreY * scl;
  const cc = coreColor(g);
  const cpts = m.core.map((lp) => ({ x: lp.x * scl, y: coreY + lp.y * scl, z: lp.z * scl }));
  pushFace(cpts, cc, m.core.map((lp) => [{ x: 0, y: coreY, z: 0 }, { x: lp.x * scl, y: coreY + lp.y * scl, z: lp.z * scl }]), 1);
  const cpts2 = m.coreInner.map((lp) => ({ x: lp.x * scl, y: coreY + lp.y * scl, z: lp.z * scl }));
  pushFace(cpts2, mix(cc, PAPER_N, night ? 0.1 : 0.25), null, 1.08);

  if (stemH > 0.03) {
    const w = m.stemW * scl;
    const tx = g.lean * stemH, tz = g.lean * 0.4 * stemH;
    const b = [[-w, 0, -w], [w, 0, -w], [w, 0, w], [-w, 0, w]];
    const tp = [[tx - w, stemH, tz - w], [tx + w, stemH, tz - w], [tx + w, stemH, tz + w], [tx - w, stemH, tz + w]];
    const sc = stemColor(g);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const pts = [
        { x: b[i][0], y: b[i][1], z: b[i][2] },
        { x: b[j][0], y: b[j][1], z: b[j][2] },
        { x: tp[j][0], y: tp[j][1], z: tp[j][2] },
        { x: tp[i][0], y: tp[i][1], z: tp[i][2] },
      ];
      const crease = [[
        { x: (b[i][0] + b[j][0]) / 2, y: 0, z: (b[i][2] + b[j][2]) / 2 },
        { x: (tp[i][0] + tp[j][0]) / 2, y: stemH, z: (tp[i][2] + tp[j][2]) / 2 },
      ]];
      pushFace(pts, sc, crease, 1);
    }
    const lh = stemH * 0.42;
    for (const ang of [0.7, 2.5]) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const pts = m.leaf.map((lp) => ({
        x: lp.x * scl * c + lp.z * scl * s,
        y: lh + lp.y * scl,
        z: -lp.x * scl * s + lp.z * scl * c,
      }));
      pushFace(pts, sc, [[pts[0], pts[2]]], 0.95);
    }
  }

  // hover + screen bounds
  const sc2 = projectPoint({ x: f.x, y: Math.max(0.2, f.grow * g.stem * 0.55), z: f.z });
  f.screen.x = sc2.X; f.screen.y = sc2.Y;
  f.screen.r = sc2.s * 0.9 * g.size * (0.5 + 0.5 * f.grow);
}

function drawFace(face) {
  const p = face.proj;
  ctx.beginPath();
  ctx.moveTo(p[0].X, p[0].Y);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].X, p[i].Y);
  ctx.closePath();
  ctx.fillStyle = `rgb(${face.col[0] | 0},${face.col[1] | 0},${face.col[2] | 0})`;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = `rgba(${inkRGB},${night ? 0.5 : 0.42})`;
  ctx.stroke();
  if (face.crease) {
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = `rgba(${inkRGB},${night ? 0.34 : 0.3})`;
    ctx.beginPath();
    for (const s of face.crease) {
      if (!s[0] || !s[1] || !s[0].ok || !s[1].ok) continue;
      ctx.moveTo(s[0].X, s[0].Y); ctx.lineTo(s[1].X, s[1].Y);
    }
    ctx.stroke();
  }
}

/* ── particles ─────────────────────────────────────────────── */
function spawnBloom(f) {
  const col = petalColor(f.g);
  const n = 5 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 0.4 + Math.random() * 1.5;
    particles.push({
      x: f.screen.x, y: f.screen.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7,
      rot: Math.random() * TAU, vr: (Math.random() * 2 - 1) * 0.1,
      life: 0, max: 900 + Math.random() * 800, col, size: 3 + Math.random() * 4,
    });
  }
}
function spawnDust(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU, sp = 0.3 + Math.random() * 1.1;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
      rot: 0, vr: 0, life: 0, max: 600 + Math.random() * 400,
      col: night ? PAPER_N : PAPER_D, size: 1.5 + Math.random() * 2,
    });
  }
}
function updateParticles(dt) {
  const k = dt / 16;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.vy += 0.05 * k;
    p.vx *= Math.pow(0.99, k); p.vy *= Math.pow(0.995, k);
    p.vx += Math.sin((p.life + p.rot * 100) * 0.006) * 0.02 * k;
    p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
  }
}
function drawParticles() {
  for (const p of particles) {
    const a = clamp(1 - p.life / p.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.95;
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = rgb(p.col);
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.quadraticCurveTo(p.size, 0, 0, p.size);
    ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function petalStorm() {
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.5,
      vx: (Math.random() * 2 - 1) * 1.4, vy: 0.6 + Math.random() * 1.6,
      rot: Math.random() * TAU, vr: (Math.random() * 2 - 1) * 0.14,
      life: 0, max: 3200 + Math.random() * 2600,
      col: PALETTE[PAL_KEYS[(Math.random() * PAL_KEYS.length) | 0]], size: 3 + Math.random() * 5,
    });
  }
}

/* ── fireflies ─────────────────────────────────────────────── */
function makeFireflies() {
  fireflies = Array.from({ length: 16 }, () => ({
    x: Math.random(), y: Math.random(),
    p: Math.random() * TAU, s: 0.3 + Math.random() * 0.7,
  }));
}
function drawFireflies(now) {
  const t = now * 0.001;
  for (const ff of fireflies) {
    const x = ff.x * W + Math.sin(t * 0.3 * ff.s + ff.p) * 32;
    const y = ff.y * H + Math.cos(t * 0.24 * ff.s + ff.p * 1.7) * 26;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 * ff.s + ff.p);
    const r = 2 + 2.4 * pulse;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, `rgba(201,168,106,${0.5 * pulse})`);
    g.addColorStop(1, 'rgba(201,168,106,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
  }
}

/* ── main loop ─────────────────────────────────────────────── */
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  parallax.x += (parallaxT.x - parallax.x) * 0.06;
  parallax.y += (parallaxT.y - parallax.y) * 0.06;
  resize();
  ctx.clearRect(0, 0, W, H);
  drawGround();
  const faces = [];
  for (const f of flowers) collectFaces(f, now, faces);
  for (const f of flowers) drawShadow(f);
  faces.sort((a, b) => b.depth - a.depth);
  for (const face of faces) drawFace(face);

  if (hovered && flowers.includes(hovered)) {
    const s = hovered.screen;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = `rgba(${inkRGB},.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(24, s.r), 0, TAU); ctx.stroke();
    ctx.restore();
  }

  updateParticles(dt);
  drawParticles();
  if (night) drawFireflies(now);
  updateHover();
  requestAnimationFrame(frame);
}

/* ── interaction ───────────────────────────────────────────── */
function hitTest(px, py) {
  let best = null, bd = Infinity;
  for (const f of flowers) {
    const d = Math.hypot(px - f.screen.x, py - f.screen.y);
    const r = Math.max(22, f.screen.r);
    if (d < r && d < bd) { bd = d; best = f; }
  }
  return best;
}
function updateHover() {
  if (!pointer.has) { hovered = null; return; }
  hovered = hitTest(pointer.x, pointer.y);
  canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
}
function bounds() { return W < 640 ? { x: 3.4, z: 2.6 } : { x: 4.6, z: 3.4 }; }
function tooClose(x, z, d) {
  for (const f of flowers) if (Math.hypot(f.x - x, f.z - z) < d) return true;
  return false;
}
function spreadPosition(x, z) {
  const b = bounds();
  for (let i = 0; i < 26; i++) {
    if (!tooClose(x, z, 0.62)) return { x, z };
    const a = Math.random() * TAU, r = 0.45 + Math.random() * 0.7;
    x = clamp(x + Math.cos(a) * r, -b.x, b.x);
    z = clamp(z + Math.sin(a) * r * 0.8, -b.z, b.z);
  }
  return { x, z };
}
function freePosition() {
  const b = bounds();
  for (let i = 0; i < 60; i++) {
    const a = i * 2.399, r = Math.min(0.4 + 0.42 * i * 0.5, Math.max(b.x, b.z) * 0.8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
    if (!tooClose(x, z, 0.7)) return { x, z };
  }
  return spreadPosition((Math.random() * 2 - 1) * b.x, (Math.random() * 2 - 1) * b.z);
}
function addFlower(seed, x, z, t0) {
  const g = genomeFromSeed(seed);
  const model = buildModel(g);
  flowers.push({
    g, model, x, z,
    t0: t0 ?? performance.now(),
    dur: 1500, phase: Math.random() * TAU,
    screen: { x: 0, y: 0, r: 0 }, sway: { ax: 0, az: 0 },
    grow: 0, bloom: 0,
  });
  while (flowers.length > MAX_FLOWERS) flowers.shift();
}
function rebloom(f) {
  f.t0 = performance.now();
  f.dur = 1050;
  spawnBloom(f);
  if (soundOn) pluck(NOTES[(Math.random() * NOTES.length) | 0]);
}
function plantAt(x, z, seed) {
  const p = spreadPosition(x, z);
  addFlower(seed || randomSeed(), p.x, p.z, performance.now());
  const s = projectPoint({ x: p.x, y: 0.1, z: p.z });
  if (s.ok) spawnDust(s.X, s.Y);
  if (soundOn) { rustle(); pluck(NOTES[(Math.random() * NOTES.length) | 0] * 0.5); }
  hideHint(); save(); updateMeta();
}
function plantCenter() {
  const p = freePosition();
  plantAt(p.x, p.z);
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const hit = hitTest(px, py);
  if (hit) { rebloom(hit); return; }
  const gp = groundFromScreen(px, py);
  if (!gp) return;
  plantAt(gp.x, gp.z);
});
canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = e.clientX - rect.left;
  pointer.y = e.clientY - rect.top;
  pointer.has = true;
  if (e.pointerType === 'mouse') {
    parallaxT.x = (pointer.x / W - 0.5) * 2;
    parallaxT.y = (pointer.y / H - 0.5) * 2;
  }
});
canvas.addEventListener('pointerleave', () => { pointer.has = false; hovered = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ── garden meta ───────────────────────────────────────────── */
function updateMeta() { countEl.textContent = String(flowers.length); }
function updateSeason() {
  const m = new Date().getMonth() + 1;
  seasonEl.textContent = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
function hideHint() { hintEl.classList.add('is-hidden'); }

/* ── persistence ───────────────────────────────────────────── */
function save() {
  if (!ready) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      v: 1, night, sound: soundOn,
      flowers: flowers.map((f) => [f.g.seed, +f.x.toFixed(2), +f.z.toFixed(2)]),
    }));
  } catch (e) { /* ignore */ }
}
function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    night = !!d.night;
    soundOn = d.sound !== false;
    return d;
  } catch (e) { return null; }
}

/* ── seed sharing ──────────────────────────────────────────── */
function buildGardenCode() {
  return 'PG1.' + b64urlEncode(JSON.stringify(flowers.map((f) => [f.g.seed, +f.x.toFixed(2), +f.z.toFixed(2)])));
}
function buildShareLink() {
  const base = location.href.split('#')[0];
  return base + '#g=' + buildGardenCode();
}
function loadGardenFromCode(code, animate) {
  let arr;
  try { arr = JSON.parse(b64urlDecode(code.replace(/^PG1\./, ''))); }
  catch (e) { return 0; }
  if (!Array.isArray(arr)) return 0;
  flowers.length = 0;
  const now = performance.now();
  arr.slice(0, MAX_FLOWERS).forEach((it, i) => {
    const seed = String((it && it[0]) || '').slice(0, 16);
    if (!seed) return;
    addFlower(seed, clamp(+it[1] || 0, -6, 6), clamp(+it[2] || 0, -5, 5), animate ? now + i * 120 : now - 1500 + i * 90);
  });
  save(); updateMeta();
  if (flowers.length) hideHint();
  return flowers.length;
}
function initFromHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  if (h.startsWith('PG1.')) { return loadGardenFromCode(h, true) > 0; }
  const params = new URLSearchParams(h);
  const code = params.get('g');
  const seed = params.get('s') || params.get('seed');
  if (code) return loadGardenFromCode(code, true) > 0;
  if (seed) { addFlower(seed, 0, 0.2, performance.now()); save(); updateMeta(); hideHint(); return true; }
  return false;
}
function plantFromInput(str) {
  str = (str || '').trim();
  if (!str) return;
  const gi = str.indexOf('#g=');
  if (gi >= 0) str = str.slice(gi + 3);
  if (str.startsWith('PG1.')) {
    const n = loadGardenFromCode(str, true);
    toast(n ? `Planted ${n} bloom${n === 1 ? '' : 's'} from a shared seed` : 'That seed could not be read');
    closePanel();
    return;
  }
  const m = str.match(/[0-9A-Za-z]{4,16}/);
  if (m) {
    const p = freePosition();
    plantAt(p.x, p.z, m[0]);
    toast('A seed was planted');
    closePanel();
  } else {
    toast('Paste a seed code or a Paper Garden link');
  }
}

/* ── UI ────────────────────────────────────────────────────── */
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      return true;
    } catch (_) { return false; }
  }
}
function openPanel() {
  if (shareOut) shareOut.value = flowers.length ? buildShareLink() : '';
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('open'));
  setTimeout(() => seedInput.focus(), 120);
}
function closePanel() {
  panel.classList.remove('open');
  setTimeout(() => { panel.hidden = true; }, 350);
}
function newSeed() {
  const p = freePosition();
  const seed = randomSeed();
  plantAt(p.x, p.z, seed);
  toast('New seed · ' + seed);
}
function share() {
  if (!flowers.length) plantCenter();
  const link = buildShareLink();
  if (shareOut) shareOut.value = link;
  openPanel();
  copyText(link).then((ok) => toast(ok ? 'Garden link copied — share it' : 'Select the link to copy'));
}
function clearGarden() {
  flowers.length = 0;
  particles.length = 0;
  save(); updateMeta();
  toast('Garden swept clean');
}
function applyNight(v, silent) {
  night = v;
  document.body.classList.toggle('night', v);
  document.body.classList.toggle('day', !v);
  inkRGB = night ? '236,230,216' : '33,30,25';
  modeBtn.textContent = night ? 'night' : 'day';
  if (night && !fireflies.length) makeFireflies();
  if (!silent) { rustle(0.03); save(); }
}
function toggleNight() { applyNight(!night); toast(night ? 'night falls over the garden' : 'morning light'); }
function toggleSound() {
  soundOn = !soundOn;
  document.querySelectorAll('.btn[data-act="sound"]').forEach((b) => b.setAttribute('aria-pressed', String(soundOn)));
  if (soundOn) { ensureAudio(); rustle(0.04); }
  toast(soundOn ? 'sound on' : 'sound off');
  save();
}
function wireUI() {
  document.querySelectorAll('.btn[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'new') newSeed();
      else if (a === 'share') share();
      else if (a === 'plant') openPanel();
      else if (a === 'clear') clearGarden();
      else if (a === 'sound') toggleSound();
    });
  });
  modeBtn.addEventListener('click', toggleNight);
  brandEl.addEventListener('click', (e) => { e.preventDefault(); toggleNight(); });
  panelClose.addEventListener('click', closePanel);
  seedGo.addEventListener('click', () => plantFromInput(seedInput.value));
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') plantFromInput(seedInput.value); });
  seedRandom.addEventListener('click', () => { seedInput.value = randomSeed(); seedInput.focus(); });
  shareCopy.addEventListener('click', () => copyText(shareOut.value).then((ok) => toast(ok ? 'Link copied' : 'Copy failed')));
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') closePanel(); return; }
    const k = e.key.toLowerCase();
    if (k === 'n') newSeed();
    else if (k === 's') share();
    else if (k === 'p') openPanel();
    else if (k === 'c') clearGarden();
    else if (k === 'm') toggleSound();
    else if (k === 'd') toggleNight();
    else if (k === ' ' || k === 'enter') { plantCenter(); e.preventDefault(); }
    eggBuf = (eggBuf + k).slice(-6);
    if (eggBuf === 'sakura') { petalStorm(); toast('❀ sakura ❀'); eggBuf = ''; }
  });
  window.addEventListener('hashchange', () => { if (initFromHash()) toast('A garden arrived from a link'); });
}

/* ── boot ──────────────────────────────────────────────────── */
function starterGarden() {
  const now = performance.now();
  const seeds = [randomSeed(), randomSeed(), randomSeed()];
  const spots = [{ x: -1.1, z: 0.6 }, { x: 0.9, z: -0.5 }, { x: 0.1, z: 1.0 }];
  spots.forEach((s, i) => addFlower(seeds[i], s.x, s.z, now + i * 240));
}
function init() {
  const saved = loadPrefs();
  resize();
  applyNight(night, true);
  document.querySelectorAll('.btn[data-act="sound"]').forEach((b) => b.setAttribute('aria-pressed', String(soundOn)));
  updateSeason();

  const fromHash = initFromHash();
  if (!fromHash) {
    if (saved && Array.isArray(saved.flowers) && saved.flowers.length) {
      const now = performance.now();
      saved.flowers.slice(0, MAX_FLOWERS).forEach((it, i) => {
        if (it && it[0]) addFlower(String(it[0]), +it[1] || 0, +it[2] || 0, now - 1500 + i * 90);
      });
    } else {
      starterGarden();
    }
  }
  updateMeta();
  if (flowers.length) hideHint();
  ready = true;
  wireUI();
  requestAnimationFrame(frame);
}
init();
