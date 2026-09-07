const SEA = document.getElementById("sea");
const ctx = SEA.getContext("2d");

const THEMES = [
  { a: "#ff2a85", b: "#00e5ff", c: "#ffd60a" },
  { a: "#00e5ff", b: "#ffd60a", c: "#ff2a85" },
  { a: "#ffd60a", b: "#ff2a85", c: "#00e5ff" },
];

let W = 0, H = 0, DPR = 1;
let themeIdx = 0;
let T = THEMES[0];

const S = { storm: 0.55, glow: 0.7, crest: 90 };

const storeKey = "neon-tide-v1";
const els = {
  meterFill: document.getElementById("meterFill"),
  meterRead: document.getElementById("meterRead"),
  stateChip: document.getElementById("stateChip"),
  toast: document.getElementById("toast"),
  spark: document.getElementById("mastSpark"),
  storm: document.getElementById("storm"),
  glow: document.getElementById("glow"),
  crest: document.getElementById("crest"),
  stormOut: document.getElementById("stormOut"),
  glowOut: document.getElementById("glowOut"),
  crestOut: document.getElementById("crestOut"),
  micBtn: document.getElementById("micBtn"),
  surgeBtn: document.getElementById("surgeBtn"),
  pngBtn: document.getElementById("pngBtn"),
  shareBtn: document.getElementById("shareBtn"),
  swatches: document.querySelectorAll(".sw"),
};

let shoreN = 0;
let shoreXs = [];
let particles = [];
let drops = [];
let rings = [];

let bass = 0.3;
let energy = 0.3;
let surgePulse = 0;
let t = 0;
let last = performance.now();

const skySheet = document.createElement("canvas");
const skyCtx = skySheet.getContext("2d");

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function surface(u, time, boost) {
  const amp = boost == null ? 1 : boost;
  const base = H * 0.5 + (u - 0.5) * H * 0.05;
  const swell = Math.sin(u * 6.283 * 1 + time * 0.7) * H * 0.014 * (1 + bass * 1.3) * amp;
  const foam = Math.sin(u * 6.283 * 3 - time * 1.5) * H * 0.011 * (0.35 + bass * 1.0) * amp;
  const chop = Math.sin(u * 6.283 * 8 + time * 2.3) * H * 0.004 * amp;
  const bang = Math.sin(u * 6.283 * 2 - time * 2.6) * H * 0.03 * surgePulse * amp;
  return base + swell + foam + chop + bang;
}

function band(u, d, phase, time) {
  const base = H * (0.5 + d) + (u - 0.5) * H * 0.05;
  return base + Math.sin(u * 6.283 * 2 + phase + time * 0.5) * H * 0.006
       + Math.sin(u * 6.283 * 5 - time * 0.9 + phase) * H * 0.004;
}

function buildSky() {
  skySheet.width = Math.max(1, W * DPR);
  skySheet.height = Math.max(1, H * DPR);
  const c = skyCtx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);

  const horizon = H * 0.62;
  let step = Math.max(14, Math.min(W, H) / 34);
  for (let y = 0; y < horizon; y += step) {
    const deep = y / horizon;
    const r = (0.6 + deep * 1.7) * (step / 2.6);
    for (let x = (deep * step) % step; x < W + step; x += step) {
      c.fillStyle = x % 2 === 0 ? hexA(T.b, 0.05 + deep * 0.1) : hexA(T.c, 0.03 + deep * 0.07);
      c.beginPath();
      c.arc(x, y, Math.max(0.4, r), 0, 6.283);
      c.fill();
    }
  }
  for (let x = 0; x < W; x += 3) {
    const yy = horizon + Math.sin(x * 0.01) * 4;
    c.fillStyle = hexA(T.b, 0.03);
    c.fillRect(x, yy, 1.5, 1.5);
  }
}

function reseed() {
  shoreN = Math.max(48, Math.round(W / 6));
  shoreXs = new Array(shoreN + 1);
  for (let i = 0; i <= shoreN; i++) shoreXs[i] = (i / shoreN) * W;

  const count = Math.round(S.crest * 13);
  particles = new Array(count);
  for (let i = 0; i < count; i++) {
    particles[i] = makeParticle(Math.random());
  }
  drops = [];
  rings = [];
}

function makeParticle(u) {
  const roll = Math.random();
  return {
    u,
    ph: Math.random() * 6.283,
    r: 0.8 + Math.random() * 1.9,
    col: roll < 0.4 ? 0 : roll < 0.68 ? 1 : roll < 0.9 ? 2 : 3,
    drift: 0.4 + Math.random() * 1.2,
    bright: 0.5 + Math.random() * 0.5,
  };
}

function spawnDrops(x, u, power, n) {
  const py = surface(u, t, 1);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const sp = (1 + Math.random() * 2.4) * power * (H / 900 + 0.5);
    drops.push({
      x, y: py - 2,
      vx: Math.cos(ang) * sp * 1.4,
      vy: Math.sin(ang) * sp,
      g: 0.22 * (H / 700),
      life: 0,
      max: 46 + Math.random() * 50,
      size: 1 + Math.random() * 2.6,
      col: Math.random() < 0.3 ? 3 : Math.floor(Math.random() * 3),
    });
  }
}

function burstAt(clientX, power) {
  const u = clamp(clientX / W, 0.02, 0.98);
  const x = u * W;
  rings.push({ u, age: 0, dur: 26, maxR: (14 + power * 90) * (H / 700 + 0.6) });
  spawnDrops(x, u, power, Math.round(10 + power * 26));
}

function surge() {
  surgePulse = 1;
  burstAt(W * (0.2 + Math.random() * 0.6), 1.15);
  blip();
  if (!audio.mic) startDemo();
}

function splashEverywhere(power) {
  const n = Math.round(18 + power * 60);
  for (let i = 0; i < n; i++) {
    const u = 0.04 + Math.random() * 0.92;
    spawnDrops(u * W, u, power * (0.7 + Math.random() * 0.5), 1);
  }
}

// ---------- audio ----------
const audio = { ctx: null, mic: null, analyser: null, data: null, demoOn: false };

function ensureCtx() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio.ctx;
}

function blip() {
  try {
    const ac = ensureCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(42, ac.currentTime + 0.16);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.26);
  } catch (e) {}
}

function startDemo() {
  if (audio.mic || audio.demoOn) return;
  try {
    const ac = ensureCtx();
    const osc = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const filt = ac.createBiquadFilter();
    const g = ac.createGain();
    osc.type = "triangle"; osc.frequency.value = 58;
    osc2.type = "sine"; osc2.frequency.value = 58.7;
    lfo.type = "sine"; lfo.frequency.value = 0.4;
    lfoGain.gain.value = 16;
    filt.type = "lowpass"; filt.frequency.value = 520;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.8);
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(filt); osc2.connect(filt);
    filt.connect(g).connect(ac.destination);
    osc.start(); osc2.start(); lfo.start();
    audio.demoOn = true;
    setChip("DEMO");
  } catch (e) {}
}

function stopDemo() {
  if (!audio.demoOn) return;
  audio.demoOn = false;
}

async function tuneIn() {
  try {
    const ac = ensureCtx();
    if (audio.mic) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stopDemo();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 256;
    an.smoothingTimeConstant = 0.82;
    src.connect(an);
    audio.mic = stream;
    audio.analyser = an;
    audio.data = new Uint8Array(an.frequencyBinCount);
    els.micBtn.classList.add("live");
    els.micBtn.querySelector(".btxt").textContent = "LIVE";
    setChip("LIVE");
    toast("mic on — make some noise");
  } catch (err) {
    toast("no mic — switched to synth tide");
    startDemo();
  }
}

function setChip(label) {
  els.stateChip.textContent = label;
}

function sampleAudio(dt) {
  let target = 0.3;
  if (audio.mic && audio.analyser && audio.data) {
    audio.analyser.getByteFrequencyData(audio.data);
    let e = 0;
    const n = 13;
    for (let i = 1; i <= n; i++) e += audio.data[i];
    target = e / (n * 255);
  } else {
    const phase = t * 0.9;
    const breathe = Math.sin(phase) * 0.5 + 0.5;
    const ripple = Math.sin(t * 2.1) * 0.5 + 0.5;
    target = (audio.demoOn ? 0.85 : 0.42) * (0.35 + 0.65 * (0.65 * breathe + 0.35 * ripple));
  }
  const k = 1 - Math.pow(0.001, dt);
  bass += (target - bass) * k;
  surgePulse = Math.max(0, surgePulse - dt * 1.4);
  energy = clamp(bass * 0.75 + surgePulse * 0.55, 0, 1);
}

// ---------- drawing ----------
function drawShore(time) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const boost = 1 + surgePulse * 0.9;
  const avgTop = H * 0.5;

  const grad = ctx.createLinearGradient(0, avgTop, 0, H);
  grad.addColorStop(0, hexA(T.a, 0.34));
  grad.addColorStop(0.45, hexA(T.b, 0.1));
  grad.addColorStop(1, hexA("#0a0c14", 0.0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, H + 40);
  for (let i = 0; i <= shoreN; i++) {
    const yy = surface(i / shoreN, time, boost);
    ctx.lineTo(shoreXs[i], yy);
  }
  ctx.lineTo(W, H + 40);
  ctx.closePath();
  ctx.fill();

  for (let b = 0; b < 3; b++) {
    const bands = [0.1, 0.18, 0.27];
    const alphas = [0.34, 0.22, 0.14];
    const cols = [T.b, T.c, T.a];
    ctx.strokeStyle = hexA(cols[b], alphas[b]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= shoreN; i++) {
      const u = i / shoreN;
      const yy = band(u, bands[b], b * 2.1, time);
      i === 0 ? ctx.moveTo(shoreXs[i], yy) : ctx.lineTo(shoreXs[i], yy);
    }
    ctx.stroke();
  }

  const G = 0.4 + S.glow * 1.1;

  ctx.save();
  ctx.shadowColor = T.a;
  ctx.shadowBlur = 6 + G * 10;
  ctx.strokeStyle = T.a;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= shoreN; i++) {
    const yy = surface(i / shoreN, time, boost);
    i === 0 ? ctx.moveTo(shoreXs[i], yy) : ctx.lineTo(shoreXs[i], yy);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(0, 5);
  ctx.strokeStyle = hexA("#000", 0.9);
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= shoreN; i++) {
    const yy = surface(i / shoreN, time, boost);
    i === 0 ? ctx.moveTo(shoreXs[i], yy) : ctx.lineTo(shoreXs[i], yy);
  }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = hexA(T.c, 0.4 + energy * 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= shoreN; i++) {
    const yy = surface(i / shoreN, time, boost) - 1.5;
    i === 0 ? ctx.moveTo(shoreXs[i], yy) : ctx.lineTo(shoreXs[i], yy);
  }
  ctx.stroke();
}

function drawParticles(time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const amp = H * (0.016 + 0.03 * S.storm) * (0.35 + energy * 1.5);
  const crestPow = 0.5 + energy * 1.6;

  for (const p of particles) {
    const sy = surface(p.u, time, 1);
    const swell = Math.sin(p.u * 6.283 * 3 - time * 1.5 + p.ph * 2);
    const lift = Math.max(0, swell) * amp * (p.col === 3 ? 1.5 : 1);
    const bounce = Math.sin(time * p.drift + p.ph) * 1.2;
    const jitter = Math.sin(time * 2.2 + p.ph * 3) * 0.7;
    const px = p.u * W + jitter;
    const py = sy - lift - Math.abs(bounce) * (p.col === 3 ? 0.8 : 0.35) - 1;

    const tw = 0.55 + 0.45 * Math.sin(time * p.drift * 1.7 + p.ph);
    const size = p.r * (0.7 + tw * 0.5) * (1 + crestPow * 0.1);

    if (p.col === 3) {
      ctx.fillStyle = hexA("#fff6ec", 0.5 + 0.5 * tw);
    } else {
      const cols = [T.a, T.b, T.c];
      ctx.fillStyle = cols[p.col];
      ctx.globalAlpha = p.bright * (0.5 + 0.5 * tw);
    }
    ctx.beginPath();
    ctx.arc(px, py, size, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawDrops(time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life++;
    d.vy += d.g;
    d.vx *= 0.985;
    d.x += d.vx;
    d.y += d.vy;
    const a = 1 - d.life / d.max;
    if (a <= 0 || d.y > H) { drops.splice(i, 1); continue; }
    const cols = [T.a, T.b, T.c, "#fff6ec"];
    ctx.fillStyle = hexA(cols[d.col], a * 0.9);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size * (0.4 + a * 0.8), 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

function drawRings(time) {
  ctx.save();
  ctx.lineWidth = 3;
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.age++;
    const k = r.age / r.dur;
    if (k >= 1) { rings.splice(i, 1); continue; }
    const rad = r.maxR * (1 - Math.pow(1 - k, 2));
    const y = surface(r.u, time, 1);
    ctx.strokeStyle = hexA("#fff6ec", (1 - k) * 0.8);
    ctx.beginPath();
    ctx.ellipse(r.u * W, y, rad, rad * 0.24, 0, 0, 6.283);
    ctx.stroke();
    ctx.strokeStyle = hexA(T.c, (1 - k) * 0.5);
    ctx.beginPath();
    ctx.ellipse(r.u * W, y, rad * 0.7, rad * 0.16, 0, 0, 6.283);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpeedLines(time) {
  if (energy < 0.55) return;
  const k = (energy - 0.55) / 0.45;
  const n = Math.round(6 + k * 26);
  ctx.save();
  ctx.strokeStyle = hexA("#fff6ec", 0.05 + k * 0.1);
  ctx.lineWidth = 1.5;
  const seg = Math.floor(shoreN / Math.max(1, n));
  for (let i = 0; i <= shoreN; i += seg) {
    const u = i / shoreN;
    const sy = surface(u, time, 1);
    const len = (18 + k * 90) * (0.5 + Math.random() * 0.7);
    ctx.beginPath();
    ctx.moveTo(shoreXs[i], sy + 6);
    ctx.lineTo(shoreXs[i] + (Math.random() - 0.5) * 30, sy + 6 + len);
    ctx.stroke();
  }
  ctx.restore();
}

function frame(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  t += dt;

  sampleAudio(dt);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(skySheet, 0, 0, W, H);

  drawShore(t);
  drawParticles(t);
  drawDrops(t);
  drawRings(t);
  drawSpeedLines(t);

  const pct = clamp(Math.round(bass * 100), 0, 100);
  els.meterFill.style.width = pct + "%";
  els.meterRead.textContent = String(pct).padStart(3, "0");

  if (energy > 0.72 && !sparkLock) {
    sparkLock = true;
    els.spark.classList.add("big");
    setTimeout(() => { els.spark.classList.remove("big"); sparkLock = false; }, 340);
  }

  requestAnimationFrame(frame);
}
let sparkLock = false;

// ---------- export / share / persist ----------
let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function exportPNG() {
  const url = SEA.toDataURL("image/png");
  const a = document.createElement("a");
  a.download = `neon-tide-${["pink", "cyan", "volt"][themeIdx]}.png`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("poster saved");
}

function buildShareURL() {
  const params = new URLSearchParams({
    s: String(Math.round(S.storm * 100)),
    g: String(Math.round(S.glow * 100)),
    c: String(S.crest),
    th: String(themeIdx),
  });
  return location.href.split("?")[0] + "?" + params.toString();
}

function copyText(str) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(str).then(() => true).catch(() => fallbackCopy(str));
  }
  return Promise.resolve(fallbackCopy(str));
}
function fallbackCopy(str) {
  try {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

function share() {
  const url = buildShareURL();
  copyText(url).then((ok) => {
    if (ok) toast("link copied — paste it anywhere");
    else {
      try { prompt("Copy your Neon Tide link", url); }
      catch (e) { toast(url); }
    }
  });
}

function saveState() {
  try {
    localStorage.setItem(storeKey, JSON.stringify({
      s: S.storm, g: S.glow, c: S.crest, th: themeIdx,
    }));
  } catch (e) {}
}

function applyParams(params) {
  const s = parseFloat(params.get("s"));
  const g = parseFloat(params.get("g"));
  const c = parseFloat(params.get("c"));
  const th = parseInt(params.get("th"), 10);
  if (!isNaN(s)) setStorm(s / 100, true);
  if (!isNaN(g)) setGlow(g / 100, true);
  if (!isNaN(c)) setCrest(c, true);
  if (!isNaN(th) && th >= 0 && th < 3) setTheme(th);
  reseed();
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.s != null) setStorm(d.s, true);
      if (d.g != null) setGlow(d.g, true);
      if (d.c != null) setCrest(d.c, true);
      if (d.th != null && d.th >= 0 && d.th < 3) setTheme(d.th);
    }
  } catch (e) {}
  const q = new URLSearchParams(location.search);
  if (q.get("s") || q.get("g") || q.get("c") || q.get("th")) applyParams(q);
  reseed();
}

// ---------- controls ----------
function setStorm(v, silent) {
  S.storm = clamp(v, 0, 1);
  els.storm.value = Math.round(S.storm * 100);
  els.stormOut.textContent = els.storm.value;
  if (!silent) saveState();
}
function setGlow(v, silent) {
  S.glow = clamp(v, 0, 1);
  els.glow.value = Math.round(S.glow * 100);
  els.glowOut.textContent = els.glow.value;
  if (!silent) saveState();
}
function setCrest(v, silent) {
  S.crest = Math.round(clamp(v, 10, 200));
  els.crest.value = S.crest;
  els.crestOut.textContent = S.crest;
  if (!silent) {
    reseed();
    saveState();
  }
}

function setTheme(i) {
  themeIdx = i;
  T = THEMES[i];
  document.body.dataset.theme = String(i);
  els.swatches.forEach((sw) => {
    sw.classList.toggle("on", Number(sw.dataset.theme) === i);
  });
  buildSky();
  reseed();
  saveState();
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  SEA.width = Math.max(1, W * DPR);
  SEA.height = Math.max(1, H * DPR);
  SEA.style.width = W + "px";
  SEA.style.height = H + "px";
  buildSky();
  reseed();
}

// ---------- wire up ----------
els.storm.addEventListener("input", () => setStorm(els.storm.value / 100));
els.glow.addEventListener("input", () => setGlow(els.glow.value / 100));
els.crest.addEventListener("input", () => setCrest(els.crest.value));

els.micBtn.addEventListener("click", tuneIn);
els.surgeBtn.addEventListener("click", surge);
els.pngBtn.addEventListener("click", exportPNG);
els.shareBtn.addEventListener("click", share);

SEA.addEventListener("pointerdown", (e) => {
  burstAt(e.clientX, 0.8);
  if (!greeted) {
    greeted = true;
    setTimeout(() => {
      if (!audio.mic && !audio.demoOn) splashEverywhere(0.4);
    }, 2400);
  }
});
let greeted = false;

els.swatches.forEach((sw) => {
  sw.addEventListener("click", () => setTheme(Number(sw.dataset.theme)));
});

window.addEventListener("resize", resize);

resize();
loadInitial();
requestAnimationFrame(frame);
