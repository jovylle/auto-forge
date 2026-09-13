// Paper Garden — origami flora.
// Generative grunge garden: click dirt to plant folded-paper flowers,
// SCROLL raises the sun and blooms them. Share via URL hash, export PNG.
"use strict";

const canvas = document.getElementById("bed");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
const hudSun = $("hudSun"), hudCount = $("hudCount"), hudScroll = $("hudScroll");

const LS_KEY = "paperGarden.v1";
const PAPERS = ["kraft", "news", "rust", "moss", "ink"];
const PAPER_HEX = {
  kraft: ["#c9a86a", "#a8814a"],
  news: ["#d8d3c3", "#a9a394"],
  rust: ["#b6502a", "#7e2f16"],
  moss: ["#8a9458", "#5a6b3c"],
  ink: ["#3a3a42", "#17171b"],
};
const SPECIES = [
  { name: "crane lily", rings: 1, len: 1.0, wid: 0.52, skew: 0.0, center: "#a33b1f", spread: 2.4 },
  { name: "shuriken", rings: 1, len: 1.15, wid: 0.34, skew: 0.55, center: "#14110d", spread: 3.0 },
  { name: "lotus bomb", rings: 2, len: 0.8, wid: 0.6, skew: 0.0, center: "#c9a86a", spread: 2.9 },
  { name: "weed star", rings: 1, len: 0.62, wid: 0.3, skew: 0.2, center: "#5a6b3c", spread: 3.1 },
];

/* ---------- utils ---------- */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function mix(h1, h2, t) {
  const a = hx(h1), b = hx(h2);
  return `rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`;
}
let toastT = 0;
function toast(msg) {
  toastEl.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => (toastEl.textContent = ""), 2600);
}
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- state ---------- */
const params = { sp: 0, paper: "kraft", folds: 8, wind: 28, size: 26 };
let flowers = [];       // {x,gy,seed,sp,paper,petals,size,bloom,phase,born}
let scraps = [];
let flies = [];
let gust = 0;
let forcedNight = false;
let scrollP = 0, scrollV = 0, lastY = scrollY;
let uidc = 1;
const reduced2 = reduced;

/* ---------- persistence + share ---------- */
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      f: flowers.map((f) => [r3(f.x), r3(f.gy), f.seed, f.sp, f.paper, f.petals, f.size]),
      p: params,
    }));
  } catch { /* private mode */ }
}
const r3 = (v) => Math.round(v * 1000) / 1000;
let saveT = 0;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }

function encodeGarden() {
  const data = flowers.map((f) => [r3(f.x), r3(f.gy), f.seed, f.sp, f.paper, f.petals, f.size]);
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeGarden(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(escape(atob(b64)));
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error("bad garden");
  return arr.slice(0, 220).map((a) => ({
    id: uidc++, x: clamp(+a[0], 0, 1), gy: clamp(+a[1], 0.55, 1),
    seed: (a[2] | 0) || 1, sp: clamp(a[3] | 0, 0, 3),
    paper: PAPERS.includes(a[4]) ? a[4] : "kraft",
    petals: clamp(a[5] | 0, 5, 12), size: clamp(+a[6] || 26, 10, 60),
    bloom: 0.05, phase: Math.random() * 6.28, born: performance.now(),
  }));
}
function loadInitial() {
  const h = location.hash.match(/#g=([A-Za-z0-9\-_]+)/);
  if (h) {
    try { flowers = decodeGarden(h[1]); toast("unfolded a shared garden ⧉"); return; } catch { /* fall through */ }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (Array.isArray(o.f) && o.f.length) {
        flowers = o.f.map((a) => ({
          id: uidc++, x: a[0], gy: a[1], seed: a[2], sp: a[3], paper: a[4],
          petals: a[5], size: a[6], bloom: 1, phase: Math.random() * 6.28, born: 0,
        }));
        Object.assign(params, o.p || {});
        syncControls();
        return;
      }
    }
  } catch { /* ignore */ }
  // starter plot
  const r = mulberry32(1234);
  for (let i = 0; i < 6; i++) {
    flowers.push({
      id: uidc++, x: 0.08 + (i / 5) * 0.84 + (r() - 0.5) * 0.04,
      gy: 0.72 + r() * 0.2, seed: 100 + i * 7, sp: i % 4,
      paper: PAPERS[i % PAPERS.length], petals: 6 + (i % 4),
      size: 20 + r() * 12, bloom: 0.4, phase: r() * 6.28, born: 0,
    });
  }
}

/* ---------- planting ---------- */
function plant(nx, gy, opts = {}) {
  const r = mulberry32((Math.random() * 1e9) | 0);
  flowers.push({
    id: uidc++,
    x: clamp(nx, 0.02, 0.98),
    gy: clamp(gy ?? (0.7 + Math.random() * 0.22), 0.55, 0.99),
    seed: (Math.random() * 1e9) | 0,
    sp: opts.sp ?? params.sp,
    paper: opts.paper ?? params.paper,
    petals: opts.petals ?? params.folds,
    size: opts.size ?? params.size,
    bloom: 0.04, phase: r() * 6.28, born: performance.now(),
  });
  if (flowers.length > 220) flowers.splice(0, flowers.length - 220);
  saveSoon();
}
function sowRow() {
  for (let i = 0; i < 6; i++) plant(0.1 + (i / 5) * 0.8, 0.72 + Math.random() * 0.18);
  toast("sowed a row ✂");
  updateCount();
}
function sowWave(kind) {
  const conf = {
    dawn: { n: 5, sps: [0, 3], papers: ["kraft", "news", "moss"] },
    noon: { n: 4, sps: [1, 0], papers: ["news", "kraft"] },
    storm: { n: 3, sps: [3, 1], papers: ["ink", "rust"] },
    dusk: { n: 6, sps: [2, 0, 1], papers: ["rust", "kraft", "moss"] },
    night: { n: 4, sps: [2, 3], papers: ["ink", "moss"] },
  }[kind] || { n: 4, sps: [0], papers: ["kraft"] };
  for (let i = 0; i < conf.n; i++) {
    plant(Math.random(), 0.7 + Math.random() * 0.22, {
      sp: conf.sps[i % conf.sps.length],
      paper: conf.papers[(Math.random() * conf.papers.length) | 0],
      petals: 5 + ((Math.random() * 8) | 0),
      size: 16 + Math.random() * 22,
    });
  }
  if (kind === "storm") gust = Math.min(1.6, gust + 1.1);
  updateCount();
  saveSoon();
}

/* ---------- canvas sizing ---------- */
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  W = Math.max(300, rect.width); H = Math.max(200, rect.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seedSpeckles();
}
addEventListener("resize", resize);

/* ---------- sky keyframes (scroll-driven) ---------- */
const SKY = [
  { p: 0.0, top: "#3d3a4a", mid: "#c99a5e", soil: "#4a3a26", label: "☀ dawn" },
  { p: 0.3, top: "#7fa3a8", mid: "#d8c9a3", soil: "#54432c", label: "☀ noon" },
  { p: 0.55, top: "#4a4a52", mid: "#8d8574", soil: "#3e3222", label: "≋ storm" },
  { p: 0.8, top: "#2e2030", mid: "#a33b1f", soil: "#43301e", label: "☁ dusk" },
  { p: 1.0, top: "#0b0b10", mid: "#232028", soil: "#241c12", label: "☾ night" },
];
function skyAt(p) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (p >= SKY[i].p && p <= SKY[i + 1].p) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const t = clamp((p - a.p) / Math.max(1e-6, b.p - a.p), 0, 1);
  return { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), soil: mix(a.soil, b.soil, t) };
}
function sunLabel(p) {
  if (forcedNight) return "☾ night (forced)";
  for (let i = SKY.length - 1; i >= 0; i--) if (p >= SKY[i].p - 0.02) return SKY[i].label;
  return SKY[0].label;
}

/* ---------- speckles / scraps / fireflies ---------- */
let speckles = [];
function seedSpeckles() {
  const r = mulberry32(77);
  speckles = Array.from({ length: 130 }, () => ({ x: r(), y: r(), s: 0.5 + r() * 1.8, a: 0.04 + r() * 0.1 }));
}
function initAir() {
  scraps = Array.from({ length: 26 }, () => ({
    x: Math.random(), y: Math.random() * 0.8, s: 2 + Math.random() * 5,
    vy: 0.008 + Math.random() * 0.02, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.05,
    tone: Math.random(),
  }));
  flies = Array.from({ length: 18 }, () => ({ x: Math.random(), y: 0.2 + Math.random() * 0.6, ph: Math.random() * 6.28 }));
}

/* ---------- origami flower ---------- */
function drawFlower(f, t, windAmt, sky) {
  const r = mulberry32(f.seed);
  const j1 = (r() - 0.5), j2 = (r() - 0.5);
  const gx = f.x * W, gy = f.gy * H;
  const S = f.size * (0.75 + 0.5 * f.bloom) * (W < 480 ? 0.85 : 1);
  const sway = Math.sin(t * 0.0016 + f.phase) * (2 + windAmt * 22) + j1 * 4;
  const hx_ = gx + sway * (gy / H + 0.4);
  const hy = gy - S * 2.6 * f.bloom - 8;

  // stem
  ctx.strokeStyle = "rgba(28,32,18,.9)";
  ctx.lineWidth = Math.max(1.5, S * 0.07);
  ctx.beginPath();
  ctx.moveTo(gx, gy + 2);
  ctx.quadraticCurveTo(gx + sway * 0.3, (gy + hy) / 2, hx_, hy);
  ctx.stroke();
  // folded leaf
  const ly = gy - (gy - hy) * 0.35;
  ctx.fillStyle = "rgba(90,107,60,.9)";
  ctx.beginPath();
  ctx.moveTo(gx + sway * 0.2, ly);
  ctx.lineTo(gx + sway * 0.2 + S * (0.7 + j2 * 0.2), ly - S * 0.28);
  ctx.lineTo(gx + sway * 0.2 + S * 0.15, ly + S * 0.12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.moveTo(gx + sway * 0.2, ly);
  ctx.lineTo(gx + sway * 0.2 + S * 0.15, ly + S * 0.12);
  ctx.lineTo(gx + sway * 0.2 + S * (0.7 + j2 * 0.2), ly - S * 0.28);
  ctx.lineTo(gx + sway * 0.2 + S * 0.32, ly - S * 0.1);
  ctx.closePath(); ctx.fill();

  // head
  const sp = SPECIES[f.sp];
  const [cLight, cDark] = PAPER_HEX[f.paper] || PAPER_HEX.kraft;
  const open = 0.15 + 0.85 * f.bloom; // 0=bud … 1=flat
  const rings = sp.rings;
  for (let ring = rings - 1; ring >= 0; ring--) {
    const rr = ring === 0 ? 1 : 0.55;
    const n = f.petals;
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const ang = -Math.PI / 2 + (frac - 0.5) * sp.spread * open + ring * 0.35 + sp.skew * open + j1 * 0.1;
      const L = S * sp.len * rr * (0.55 + 0.45 * open);
      const Wd = S * sp.wid * rr * (0.5 + 0.5 * open);
      const bx = hx_, by = hy + ring * S * 0.12;
      const tx = bx + Math.cos(ang) * L, ty = by + Math.sin(ang) * L;
      const px = -Math.sin(ang), py = Math.cos(ang);
      const lx = bx + px * Wd * 0.5, ly2 = by + py * Wd * 0.5;
      const rx = bx - px * Wd * 0.5, ry = by - py * Wd * 0.5;
      // light half
      ctx.fillStyle = cLight;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(lx, ly2); ctx.lineTo(tx, ty); ctx.closePath(); ctx.fill();
      // shaded fold half
      ctx.fillStyle = cDark;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fill();
      // crease line
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }
  // bud casing when closed
  if (f.bloom < 0.5) {
    ctx.fillStyle = "rgba(20,17,13,.55)";
    ctx.beginPath();
    ctx.moveTo(hx_ - S * 0.18, hy + S * 0.3);
    ctx.lineTo(hx_, hy - S * 0.5);
    ctx.lineTo(hx_ + S * 0.18, hy + S * 0.3);
    ctx.closePath(); ctx.fill();
  }
  // center
  ctx.fillStyle = sp.center;
  ctx.beginPath(); ctx.arc(hx_, hy, S * 0.16 * open + 1.5, 0, 6.29); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.arc(hx_ - 1, hy - 1, Math.max(0.6, S * 0.04), 0, 6.29); ctx.fill();
}

/* ---------- main render ---------- */
function frame(now) {
  const dt = Math.min(0.05, (now - (frame._l || now)) / 1000);
  frame._l = now;
  const t = reduced2 ? 10000 : now;

  const windBase = params.wind / 100;
  gust = Math.max(0, gust - dt * 0.5);
  const windAmt = clamp(windBase + gust * 0.9 + Math.abs(scrollV) * 0.004, 0, 2);
  scrollV *= 0.92;

  const p = forcedNight ? 1 : scrollP;
  const sky = skyAt(p);
  const nightF = clamp((p - 0.72) / 0.28, 0, 1);

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sky.top); g.addColorStop(0.62, sky.mid); g.addColorStop(0.78, sky.mid); g.addColorStop(0.79, sky.soil);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sun / moon arc driven by scroll
  const sa = Math.PI * (1 - clamp(p, 0, 1)); // 0..π
  const sx = W * (0.12 + 0.76 * (clamp(p, 0, 1)));
  const sy = H * (0.62 - Math.sin(sa) * 0.48);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = nightF > 0.5 ? "#e8e2cc" : "#f2e3b0";
  ctx.beginPath(); ctx.arc(sx, sy, H * 0.055, 0, 6.29); ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(sx, sy, H * 0.1, 0, 6.29); ctx.fill();
  ctx.restore();
  // photocopy sun stripes
  ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = "#14110d";
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sx, sy, H * 0.055 + 4 + i * 5, 0, 6.29); ctx.stroke(); }
  ctx.restore();

  // far ripped hills
  ctx.fillStyle = "rgba(20,17,13,.35)";
  ctx.beginPath(); ctx.moveTo(0, H * 0.66);
  for (let x = 0; x <= W; x += W / 14) ctx.lineTo(x, H * 0.66 - Math.abs(Math.sin(x * 0.02 + 2)) * H * 0.07 - (x % 3));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // soil
  const soilY = H * 0.72;
  ctx.fillStyle = sky.soil; ctx.fillRect(0, soilY, W, H - soilY);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  for (const s of speckles) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x * W, soilY + s.y * (H - soilY), s.s, s.s);
  }
  ctx.globalAlpha = 1;
  // torn edge highlight
  ctx.fillStyle = "rgba(232,220,174,.5)";
  ctx.beginPath(); ctx.moveTo(0, soilY);
  for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, soilY + ((x * 7) % 5) - 2);
  ctx.lineTo(W, soilY + 3); ctx.lineTo(0, soilY + 3); ctx.closePath(); ctx.fill();

  // growth: sun speeds blooming
  const growthRate = reduced2 ? 1 : (0.25 + p * 1.6);
  for (const f of flowers) {
    if (f.bloom < 1) f.bloom = Math.min(1, f.bloom + dt * growthRate * 0.35);
  }

  // flowers, back to front
  const sorted = [...flowers].sort((a, b) => a.gy - b.gy);
  for (const f of sorted) drawFlower(f, t, windAmt, sky);

  // drifting scraps
  for (const s of scraps) {
    s.x += (windAmt * 0.12 + 0.008) * dt * (0.5 + s.s * 0.2);
    s.y += s.vy * dt * (gust > 0.3 ? 3 : 1) * (reduced2 ? 0 : 1);
    s.rot += s.vr * (reduced2 ? 0 : 1);
    if (s.x > 1.05) { s.x = -0.05; s.y = Math.random() * 0.75; }
    if (s.y > 0.9) s.y = 0.05;
    ctx.save();
    ctx.translate(s.x * W, s.y * H); ctx.rotate(s.rot);
    ctx.fillStyle = s.tone > 0.66 ? "rgba(216,201,163,.8)" : s.tone > 0.33 ? "rgba(163,59,31,.55)" : "rgba(20,17,13,.5)";
    ctx.fillRect(-s.s, -s.s * 0.6, s.s * 2, s.s * 1.2);
    ctx.restore();
  }

  // fireflies at night
  if (nightF > 0.05 && !reduced2) {
    for (const fl of flies) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.002 + fl.ph));
      ctx.fillStyle = `rgba(242,227,176,${(nightF * tw * 0.9).toFixed(2)})`;
      const fx = (fl.x + Math.sin(t * 0.0004 + fl.ph) * 0.02) * W;
      const fy = (fl.y + Math.cos(t * 0.0005 + fl.ph) * 0.03) * H;
      ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, 6.29); ctx.fill();
    }
  }

  // vignette + stamp
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(10,8,6,.5)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W - 66, 26); ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(163,59,31,.8)"; ctx.lineWidth = 2;
  ctx.strokeRect(-52, -14, 104, 28);
  ctx.fillStyle = "rgba(163,59,31,.85)";
  ctx.font = "11px 'Special Elite', monospace"; ctx.textAlign = "center";
  ctx.fillText("FIELD GROWN", 0, 4);
  ctx.restore();

  requestAnimationFrame(frame);
}

/* ---------- scroll engine (the constraint) ---------- */
function updateScroll() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const y = scrollY;
  const p = clamp(y / max, 0, 1);
  scrollV = scrollV * 0.8 + (y - lastY) * 0.2;
  lastY = y;
  scrollP = p;
  hudScroll.textContent = `scroll ${Math.round(p * 100)}%`;
  hudSun.textContent = sunLabel(p);
}
addEventListener("scroll", updateScroll, { passive: true });

const firedWaves = new Set();
function watchChapters() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const card = e.target;
      if (e.isIntersecting) {
        card.classList.add("lit");
        const w = card.dataset.wave;
        if (w && !firedWaves.has(w)) {
          firedWaves.add(w);
          sowWave(w);
          toast(`${w} wave sown ❀ — scroll on`);
        }
      } else {
        card.classList.remove("lit");
      }
    }
  }, { threshold: 0.35 });
  document.querySelectorAll(".chapter").forEach((c) => io.observe(c));
}

/* ---------- controls ---------- */
function syncControls() {
  document.querySelectorAll(".seed").forEach((b) => b.classList.toggle("sel", +b.dataset.sp === params.sp));
  document.querySelectorAll(".paper").forEach((b) => b.classList.toggle("sel", b.dataset.paper === params.paper));
  $("folds").value = params.folds; $("wind").value = params.wind; $("size").value = params.size;
}
function updateCount() {
  const n = flowers.length;
  hudCount.textContent = `${n} bloom${n === 1 ? "" : "s"}`;
  $("footCount").textContent = `${n} folds planted`;
}
function bindUI() {
  document.querySelectorAll(".seed").forEach((b) => b.addEventListener("click", () => {
    params.sp = +b.dataset.sp; syncControls(); saveSoon();
    toast(`seed: ${SPECIES[params.sp].name} ❀ — click dirt to plant`);
  }));
  document.querySelectorAll(".paper").forEach((b) => b.addEventListener("click", () => {
    params.paper = b.dataset.paper; syncControls(); saveSoon();
  }));
  $("folds").addEventListener("input", (e) => { params.folds = +e.target.value; saveSoon(); });
  $("wind").addEventListener("input", (e) => { params.wind = +e.target.value; saveSoon(); });
  $("size").addEventListener("input", (e) => { params.size = +e.target.value; saveSoon(); });

  $("btnSow").addEventListener("click", sowRow);
  $("btnGust").addEventListener("click", () => { gust = Math.min(1.8, gust + 1.2); toast("gust! ≋ hold your folds"); });
  $("btnNight").addEventListener("click", (e) => {
    forcedNight = !forcedNight;
    e.currentTarget.textContent = forcedNight ? "day ☀" : "night ◐";
    toast(forcedNight ? "lights out ☾" : "sun's back ☀");
  });
  $("btnPng").addEventListener("click", exportPNG);
  $("btnPng2").addEventListener("click", exportPNG);
  $("btnShare").addEventListener("click", share);
  $("btnShare2").addEventListener("click", share);

  let armed = 0;
  const raze = (e) => {
    const now = Date.now();
    if (now - armed < 4000) {
      flowers = []; updateCount(); save();
      toast("bed razed. fresh sheet. ✕");
      armed = 0;
    } else {
      armed = now;
      toast("click raze again to confirm ✕");
    }
  };
  $("btnRaze").addEventListener("click", raze);
  $("btnRaze2").addEventListener("click", raze);

  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    plant(nx, 0.55 + (ny * 0.45) / 1, {});
    // map click height onto soil band: clicks above soil still plant near that x
    const f = flowers[flowers.length - 1];
    if (f) f.gy = clamp(0.66 + ny * 0.3, 0.6, 0.98);
    updateCount();
    toast(`planted ${SPECIES[f.sp].name} ❀`);
  });
}

async function share() {
  const code = encodeGarden();
  const url = `${location.origin}${location.pathname}#g=${code}`;
  const full = url.startsWith("http") ? url : `${location.href.split("#")[0]}#g=${code}`;
  try {
    await navigator.clipboard.writeText(full);
    toast("share link copied ⧉ — anyone opening it gets your garden");
  } catch {
    prompt("copy your garden link:", full);
  }
  history.replaceState(null, "", `#g=${code}`);
  saveSoon();
}

function exportPNG() {
  canvas.toBlob((blob) => {
    if (!blob) { toast("export failed — try again"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "paper-garden.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("pressed your garden to PNG ⇩");
  }, "image/png");
}

/* ---------- boot ---------- */
loadInitial();
syncControls();
updateCount();
resize();
initAir();
updateScroll();
bindUI();
watchChapters();
requestAnimationFrame(frame);
console.log("paper garden grown", flowers.length + " folds");
