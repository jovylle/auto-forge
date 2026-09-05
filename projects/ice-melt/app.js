// ICE_MELT // CRYO-MONITOR v2.9
// Watch a glacier melt. Scroll = travel through time.
// Melt sim | Year scrubber | Sea-level meter — all scroll-driven.

"use strict";

/* ============================== data model ============================== */

// anchor points: year -> value. smoothstep-interpolated between anchors.
const TEMP = [[1900, 0.0],[1950, 0.1],[2000, 0.5],[2026, 1.3],[2050, 2.0],[2075, 2.8],[2100, 3.5]];
const ICE  = [[1900, 1.0],[1950, 0.98],[2000, 0.90],[2026, 0.84],[2050, 0.60],[2075, 0.40],[2100, 0.22]];
const SEA  = [[1900, 0.00],[1950, 0.05],[2000, 0.15],[2026, 0.25],[2050, 0.50],[2075, 0.72],[2100, 0.92]];

function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t);          // smoothstep
      return y0 + (y1 - y0) * s;
    }
  }
  return pts[pts.length - 1][1];
}

const YEAR0 = 1900, YEAR1 = 2100;

/* ============================== dom refs ============================== */

const $ = (id) => document.getElementById(id);
const canvas = $("scene"), ctx = canvas.getContext("2d");
const scrub = $("scrub"), yearBig = $("yearBig");
const anomalyEl = $("anomaly"), iceEl = $("ice"), statusEl = $("status");
const gaugeFill = $("gaugeFill"), gaugeVal = $("gaugeVal");
const hint = $("hint"), boot = $("boot"), bootText = $("bootText");
const timeline = $("timeline");
const clockEl = $("clock");

/* ============================== state ============================== */

const state = {
  year: 1900,           // displayed year (smoothed)
  targetYear: 1900,
  sliderDragging: false,
  started: false,       // user has interacted
  reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
};

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
let W = 0, H = 0;

/* ============================== particles ============================== */

const particles = { chunks: [], drips: [], ripples: [], embers: [], snow: [] };
const MAX = { chunks: 46, drips: 70, ripples: 30, embers: 40, snow: 50 };

function spawnChunk(x, y, w) {
  if (particles.chunks.length >= MAX.chunks || state.reduceMotion && Math.random() > 0.4) return;
  particles.chunks.push({
    x, y, w: w * (0.5 + Math.random() * 0.5), h: w * (0.3 + Math.random() * 0.5),
    vx: (Math.random() - 0.5) * 60, vy: 20 + Math.random() * 60,
    rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 4,
  });
}

function spawnDrip(x, y) {
  if (particles.drips.length >= MAX.drips) return;
  particles.drips.push({ x, y, vy: 40 + Math.random() * 90, r: 1.5 + Math.random() * 1.5 });
}

function spawnRipple(x, y, big) {
  if (particles.ripples.length >= MAX.ripples) return;
  particles.ripples.push({ x, y, r: big ? 3 : 1.5, vr: big ? 60 : 30, a: big ? 0.85 : 0.6 });
}

function spawnEmber(x, y) {
  if (particles.embers.length >= MAX.embers) return;
  particles.embers.push({ x: x + (Math.random() - 0.5) * 40, y, vy: -(30 + Math.random() * 60), vx: (Math.random() - 0.5) * 20, life: 1, r: 1.5 + Math.random() * 2 });
}

/* ============================== scene geometry ============================== */

// returns computed scene params for a year (in canvas px space)
function sceneParams(year, W, H) {
  const anomaly = interp(TEMP, year);
  const ice = interp(ICE, year);            // 0..1 remaining
  const sea = interp(SEA, year);            // meters rise

  const waterY0 = H * 0.82;                 // waterline at year 1900
  const seaPx = (sea / 1.0) * (H * 0.34);   // how far the sea has risen
  const waterY = waterY0 - seaPx;

  const v = Math.max(0.15, ice);            // volume factor for drawing
  const frontX = W * (0.58 + (1 - v) * 0.10);   // calving front retreats right
  const topY = H * (0.16 + (1 - v) * 0.10);     // ice sheet top lowers

  const melt = Math.max(0, (anomaly - 0.2) / 3.3);  // 0..1 melt intensity
  const t = Math.min(1, anomaly / 3.5);             // 0..1 heat factor

  return { anomaly, ice, sea, waterY, frontX, topY, melt, t };
}

/* ============================== drawing ============================== */

const lerp = (a, b, t) => a + (b - a) * t;
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;
}

let stars = [];
function buildStars() {
  stars = [];
  for (let i = 0; i < 110; i++) {
    stars.push({ x: Math.random(), y: Math.random() * 0.6, r: 0.5 + Math.random() * 1.4, tw: Math.random() * Math.PI * 2 });
  }
}

// seeded ridge profile for glacier top (rebuilt per resize)
let ridge = [];
function buildRidge() {
  ridge = [];
  let y = 0;
  for (let i = 0; i <= 14; i++) {
    y += (Math.random() - 0.5) * 0.014;
    ridge.push(y);
  }
}

function drawSky(p, t) {
  // deep navy -> hazy warm as it heats up
  const top = mix("#050b14", "#1a1208", t * 0.92);
  const horizon = mix("#0a1a2e", "#3a2410", t * 0.9);
  const g = ctx.createLinearGradient(0, 0, 0, p.waterY);
  g.addColorStop(0, top);
  g.addColorStop(0.75, horizon);
  g.addColorStop(1, mix(horizon, "#c95b2e", t * 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // stars dim with heat haze
  ctx.fillStyle = "#cfe8ff";
  for (const s of stars) {
    const a = Math.max(0, 0.9 - t * 1.3) * (0.4 + 0.6 * Math.abs(Math.sin(s.tw + performance.now() / 1400)));
    ctx.globalAlpha = a;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawSun(p, t) {
  const x = W * 0.25, y = p.waterY * 0.5;
  const r = 14 + t * 20;
  const color = mix("#fffbe8", mix("#ffd27a", "#ff6b45", t * 0.8), t);

  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
  glow.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.5)"));
  glow.addColorStop(0.4, mix("#ffffff", "#ff6b45", t).replace("rgb", "rgba").replace(")", ",0.15)"));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(p) {
  // static distant ridge behind the water
  ctx.fillStyle = "rgba(6,14,24,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, p.waterY);
  ctx.lineTo(0, p.waterY - H * 0.06);
  ctx.lineTo(W * 0.10, p.waterY - H * 0.05);
  ctx.lineTo(W * 0.19, p.waterY - H * 0.10);
  ctx.lineTo(W * 0.30, p.waterY - H * 0.04);
  ctx.lineTo(W * 0.42, p.waterY - H * 0.07);
  ctx.lineTo(W * 0.56, p.waterY - H * 0.03);
  ctx.lineTo(W, p.waterY - H * 0.04);
  ctx.lineTo(W, p.waterY);
  ctx.fill();
}

function drawWater(p, time) {
  const waterY = p.waterY;
  const depth = mix("#0a2133", "#17201c", p.t * 0.8);
  const surface = mix("#123a52", "#c95b2e", p.t * 0.55);

  const g = ctx.createLinearGradient(0, waterY, 0, H);
  g.addColorStop(0, surface);
  g.addColorStop(0.25, depth);
  g.addColorStop(1, "#04070d");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, waterY);
  for (let x = 0; x <= W; x += 6) {
    const y = waterY + Math.sin(x * 0.012 + time * 1.4) * 2.2
            + Math.sin(x * 0.03 + time * 2.2) * 1.1;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // wave crest glints (cyan -> amber as it warms)
  const glint = `rgba(${Math.round(lerp(91, 255, p.t))},${Math.round(lerp(232, 180, p.t))},${Math.round(lerp(255, 84, p.t))},0.35)`;
  ctx.strokeStyle = glint;
  ctx.lineWidth = 1;
  for (let row = 1; row <= 3; row++) {
    ctx.beginPath();
    const yy = waterY + row * 9;
    for (let x = 0; x <= W; x += 8) {
      const y = yy + Math.sin(x * 0.02 + time * (1.2 + row * 0.3) + row * 2) * 1.6;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // warm mist rising off the sea
  if (p.t > 0.15) {
    ctx.fillStyle = `rgba(201,91,46,${0.04 * p.t})`;
    ctx.fillRect(0, waterY, W, 40 + 30 * p.t);
  }
}

function drawGlacier(p, time) {
  const { frontX, topY, waterY, v } = p;
  const W2 = W * 1.06;
  const topRightY = topY * (0.96 + ridge[ridge.length - 1]);

  // ---- underwater wedge (ice extends below surface) ----
  const uw = ctx.createLinearGradient(0, waterY, 0, waterY + H * 0.16);
  uw.addColorStop(0, "rgba(60,120,160,0.55)");
  uw.addColorStop(1, "rgba(8,26,44,0.5)");
  ctx.fillStyle = uw;
  ctx.beginPath();
  ctx.moveTo(frontX - W * 0.01, waterY);
  ctx.lineTo(frontX - W * 0.09, waterY + H * 0.11);
  ctx.lineTo(W2, waterY + H * 0.13);
  ctx.lineTo(W2, waterY);
  ctx.closePath();
  ctx.fill();

  // ---- rock base where ice has receded ----
  const rockY = waterY + H * 0.02;
  ctx.fillStyle = "rgba(22,26,32,0.9)";
  ctx.beginPath();
  ctx.moveTo(frontX - W * 0.03, waterY);
  ctx.lineTo(frontX + W * 0.02, rockY - H * 0.02);
  ctx.lineTo(W2, rockY);
  ctx.lineTo(W2, waterY);
  ctx.closePath();
  ctx.fill();

  // ---- main ice sheet ----
  const iceGrad = ctx.createLinearGradient(0, topY, 0, waterY);
  iceGrad.addColorStop(0, "#eaf7ff");
  iceGrad.addColorStop(0.45, "#a8d4ea");
  iceGrad.addColorStop(0.85, "#5d8fb0");
  iceGrad.addColorStop(1, "#3b6d90");
  ctx.fillStyle = iceGrad;

  ctx.beginPath();
  ctx.moveTo(frontX, waterY);
  ctx.lineTo(frontX + W * 0.01, waterY);
  // calving front — jagged cliff
  const cliffSteps = 7;
  for (let i = 1; i <= cliffSteps; i++) {
    const f = i / cliffSteps;
    const x = frontX + W * 0.02 + Math.sin(i * 7.3) * W * 0.006;
    const y = lerp(waterY, topY + H * 0.02, f) + Math.sin(i * 4.1) * H * 0.006;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(frontX + W * 0.045, topY);            // cliff top
  // jagged top surface toward right
  const steps = ridge.length - 1;
  for (let i = 1; i <= steps; i++) {
    const x = lerp(frontX + W * 0.05, W2, i / steps);
    const y = lerp(topY, topRightY, i / steps) + ridge[i] * H * 0.06;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W2, waterY + H * 0.05);
  ctx.closePath();
  ctx.fill();

  // ---- crevasses ----
  ctx.strokeStyle = "rgba(20,50,74,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = lerp(frontX + W * 0.07, W * 0.9, Math.random());
    ctx.beginPath();
    ctx.moveTo(x, topY + H * 0.04);
    ctx.quadraticCurveTo(x + W * 0.008, topY + H * 0.1, x + W * 0.015, topY + H * 0.16 + Math.random() * H * 0.04);
    ctx.stroke();
  }

  // ---- front face highlight / melt sheen ----
  ctx.strokeStyle = "rgba(234,247,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frontX + W * 0.045, topY);
  ctx.lineTo(frontX + W * 0.02, waterY);
  ctx.stroke();

  // glistening melt pools on the surface
  if (p.melt > 0.1) {
    ctx.fillStyle = `rgba(91,232,255,${0.14 * p.melt})`;
    for (let i = 0; i < 5; i++) {
      const x = lerp(frontX + W * 0.08, W * 0.85, i / 4) + Math.sin(time + i) * 6;
      const y = topY + H * (0.03 + i * 0.008) + Math.sin(i * 3) * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + i * 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(p, time, dt) {
  const waterY = p.waterY;

  // --- chunks (calving) ---
  const next = [];
  for (const c of particles.chunks) {
    c.vy += 900 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vrot * dt;
    if (c.y + c.h >= waterY) {
      spawnRipple(c.x, waterY, true);
      for (let i = 0; i < 3; i++) spawnDrip(c.x + (Math.random() - 0.5) * 12, waterY - 2);
      continue;                       // consumed on impact
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = "rgba(200,232,250,0.92)";
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
    next.push(c);
  }
  particles.chunks = next;

  // --- drips ---
  const dripsNext = [];
  for (const d of particles.drips) {
    d.vy += 600 * dt;
    d.y += d.vy * dt;
    if (d.y >= waterY) { spawnRipple(d.x, waterY, false); continue; }
    ctx.fillStyle = "rgba(91,232,255,0.85)";
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    dripsNext.push(d);
  }
  particles.drips = dripsNext;

  // --- ripples ---
  const ripNext = [];
  for (const r of particles.ripples) {
    r.r += r.vr * dt;
    r.a -= dt * 1.3;
    if (r.a <= 0) continue;
    ctx.strokeStyle = `rgba(91,232,255,${Math.max(0, r.a)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ripNext.push(r);
  }
  particles.ripples = ripNext;

  // --- heat embers ---
  const emNext = [];
  for (const e of particles.embers) {
    e.y += e.vy * dt;
    e.x += e.vx * dt;
    e.life -= dt * 0.9;
    if (e.life <= 0) continue;
    ctx.fillStyle = `rgba(255,150,60,${Math.max(0, e.life) * 0.8})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
    ctx.fill();
    emNext.push(e);
  }
  particles.embers = emNext;

  // --- drifting snow (cold years only) ---
  const cold = Math.max(0, 1 - p.t * 2.4);
  if (cold > 0.02 && particles.snow.length) {
    ctx.fillStyle = `rgba(220,240,255,${0.5 * cold})`;
    for (const s of particles.snow) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      if (s.x > W) s.x = 0;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
  }
}

// spawning logic per frame — rate scales with melt intensity
function spawnRates(p, dt) {
  const { frontX, topY, waterY, melt, t, ice } = p;

  // calving chunks off the front
  const calveRate = (melt > 0.12 && ice < 0.985) ? 0.5 + melt * 2.4 : 0;
  if (Math.random() < calveRate * dt) {
    spawnChunk(
      frontX + W * 0.02 + Math.random() * W * 0.02,
      topY + H * (0.04 + Math.random() * 0.1),
      Math.max(6, W * 0.016 * (0.5 + Math.random()))
    );
  }
  // drips along the cliff
  const dripRate = melt * 3.2;
  if (Math.random() < dripRate * dt) {
    spawnDrip(frontX + W * (0.02 + Math.random() * 0.03), waterY - H * (0.04 + Math.random() * 0.14));
  }
  // heat embers off the surface when scorching
  const emberRate = t > 0.6 ? (t - 0.6) * 6 : 0;
  if (Math.random() < emberRate * dt) {
    spawnEmber(frontX + W * 0.1 + Math.random() * W * 0.4, topY + H * 0.05);
  }
}

/* ============================== render ============================== */

let lastTime = performance.now();
function render(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  // ease displayed year toward target
  state.year += (state.targetYear - state.year) * (state.started ? 0.16 : 0.5);

  const p = sceneParams(state.year, W, H);
  drawSky(p, p.t);
  drawSun(p, p.t);
  drawMountains(p);
  drawWater(p, time / 1000);
  drawGlacier(p, time / 1000);
  spawnRates(p, dt);
  drawParticles(p, time / 1000, dt);

  updateHUD(p);
  requestAnimationFrame(render);
}

/* ============================== HUD ============================== */

function updateHUD(p) {
  const yr = Math.round(state.year);
  yearBig.textContent = yr;

  anomalyEl.textContent = `${p.anomaly >= 0 ? "+" : ""}${p.anomaly.toFixed(1)}°C`;
  anomalyEl.className = "v " + (p.t > 0.6 ? "crit" : p.t > 0.35 ? "hot" : "");

  const icePct = Math.round(p.ice * 100);
  iceEl.textContent = icePct + "%";
  iceEl.className = "v " + (p.ice < 0.4 ? "crit" : p.ice < 0.65 ? "hot" : "");

  let status, cls;
  if (p.ice > 0.85) { status = "STABLE"; cls = ""; }
  else if (p.ice > 0.6) { status = "CALVING"; cls = "cyan"; }
  else if (p.ice > 0.35) { status = "RETREATING"; cls = "hot"; }
  else { status = "CRITICAL"; cls = "crit"; }
  statusEl.textContent = status;
  statusEl.className = "v " + cls;

  // sea-level meter
  const frac = Math.min(1, p.sea / 1.0);
  gaugeFill.style.height = (frac * 100) + "%";
  gaugeFill.className = "gauge-fill " + (frac > 0.72 ? "crit" : frac > 0.45 ? "warn" : "");
  gaugeVal.textContent = `+${p.sea.toFixed(2)}m`;

  // timeline marker
  const mark = timeline.querySelector(".marker");
  if (mark) {
    const fracPos = (state.year - YEAR0) / (YEAR1 - YEAR0);
    mark.style.top = `calc(${(1 - fracPos) * 100}% - 4px)`;
  }
  timeline.querySelectorAll(".tick").forEach((tk) => {
    tk.classList.toggle("on", Math.abs(parseInt(tk.dataset.year, 10) - yr) <= 10);
  });

  scrub.value = String(yr);
  scrub.style.setProperty("--fill", `${((yr - YEAR0) / (YEAR1 - YEAR0)) * 100}%`);
  scrub.setAttribute("aria-valuetext", String(yr));
}

/* ============================== scroll ↔ time ============================== */

function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

function yearFromProgress(f) {
  return YEAR0 + f * (YEAR1 - YEAR0);
}

function progressFromYear(y) {
  return (y - YEAR0) / (YEAR1 - YEAR0);
}

function applyScroll() {
  if (state.sliderDragging) return;   // slider owns the year while dragging
  state.targetYear = yearFromProgress(scrollProgress());
  if (!state.started) { state.started = true; hint.classList.add("gone"); }
}

window.addEventListener("scroll", applyScroll, { passive: true });
window.addEventListener("resize", () => {
  resize();
  const f = progressFromYear(state.targetYear);
  // keep the world under the same year after a resize re-centers scroll space
  window.scrollTo(0, f * (document.documentElement.scrollHeight - window.innerHeight));
});

scrub.addEventListener("input", () => {
  const y = Number(scrub.value);
  state.targetYear = y;
  state.started = true;
  hint.classList.add("gone");
  window.scrollTo(0, progressFromYear(y) * (document.documentElement.scrollHeight - window.innerHeight));
});
scrub.addEventListener("pointerdown", () => { state.sliderDragging = true; });
scrub.addEventListener("pointerup", () => { state.sliderDragging = false; });

/* ============================== boot ============================== */

const BOOT_LINES = [
  "> CRYO-LINK ESTABLISHED .......... OK",
  "> LOADING GLACIAL CORE ............ OK",
  "> CALIBRATING SEA-LEVEL BUOY ...... OK",
  "",
  "> TIME-DILATION FIELD ONLINE",
  "> SCROLL TO TRAVEL 1900 → 2100",
];

let bootDone = false;
function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  boot.classList.add("done");
}
function skipBoot() { finishBoot(); }
boot.addEventListener("click", skipBoot);
window.addEventListener("keydown", skipBoot, { once: true });

function typeBoot() {
  let li = 0, ci = 0;
  (function type() {
    if (bootDone) return;
    const line = BOOT_LINES[li];
    if (ci <= line.length) {
      bootText.textContent = BOOT_LINES.slice(0, li).join("\n") + "\n" + line.slice(0, ci) + "█";
      ci++;
      setTimeout(type, 14);
    } else {
      li++;
      ci = 0;
      if (li < BOOT_LINES.length) setTimeout(type, 90);
      else setTimeout(finishBoot, 900);
    }
  })();
}

/* ============================== setup ============================== */

function tickClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  clockEl.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR());
  canvas.height = Math.round(H * DPR());
  ctx.setTransform(DPR(), 0, 0, DPR(), 0, 0);
  buildRidge();
  if (!stars.length) buildStars();
}

function buildTimeline() {
  timeline.innerHTML = "";
  const ticks = [1900, 1925, 1950, 1975, 2000, 2025, 2050, 2075, 2100];
  for (const y of ticks) {
    const s = document.createElement("span");
    s.className = "tick";
    s.dataset.year = y;
    s.textContent = String(y).slice(2);
    timeline.appendChild(s);
  }
  const mark = document.createElement("span");
  mark.className = "marker";
  timeline.appendChild(mark);
}

function buildGaugeTicks() {
  const ticks = $("gaugeTicks");
  for (let i = 0; i <= 10; i++) {
    const s = document.createElement("span");
    s.style.bottom = (i * 10) + "%";
    if (i % 5 === 0) s.classList.add("major");
    ticks.appendChild(s);
  }
}

function buildSnow() {
  particles.snow = [];
  for (let i = 0; i < MAX.snow; i++) {
    particles.snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2, vx: (Math.random() - 0.5) * 12, vy: 14 + Math.random() * 22 });
  }
}

function init() {
  resize();
  buildTimeline();
  buildGaugeTicks();
  buildSnow();
  window.scrollTo(0, 0);
  state.year = state.targetYear = 1900;
  tickClock();
  setInterval(tickClock, 1000);
  requestAnimationFrame(render);
  typeBoot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}