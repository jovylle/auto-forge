const WEEK_MS = 7 * 24 * 3600 * 1000;
const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const LEVEL_NAME = ["ASH", "EMBER", "FIRE", "MOLTEN"];
const LEVEL_CHAR = ["·", "░", "▒", "█"];
const LEVEL_COLOR = ["#05060a", "#ff9f1c", "#ff2d78", "#ffffff"];
const DECAY = [
  { level: 3, until: 3 * 3600e3 },
  { level: 2, until: 9 * 3600e3 },
  { level: 1, until: 26 * 3600e3 },
];

const stage = document.getElementById("stage");
const fx = document.getElementById("fx");
const fxctx = fx.getContext("2d");
const tooltip = document.getElementById("tooltip");
const cellRead = document.getElementById("cellRead");

let brush = "ignite";
let cells = {};
let particles = [];
let weekStart = weekStartOf(new Date());
let lastPaintKey = null;
let muted = false;
let lastHover = null;

function weekStartOf(d) {
  const dow = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, 0, 0).getTime();
}

function levelOf(ignitions, now) {
  let best = 0;
  for (const t of ignitions) {
    const age = now - t;
    for (const d of DECAY) {
      if (age < d.until) { best = Math.max(best, d.level); break; }
    }
  }
  return best;
}

function timeToNextDrop(ignitions, now) {
  if (!ignitions.length) return null;
  let best = Infinity;
  for (const t of ignitions) {
    const age = now - t;
    for (const d of DECAY) {
      if (age < d.until) { best = Math.min(best, t + d.until - now); break; }
    }
  }
  return best === Infinity ? null : best;
}

/* ---------- grid ---------- */

const cellsByKey = {};
const cellEls = [];
function buildGrid() {
  stage.innerHTML = "";
  const corner = el("div", "gutter");
  stage.appendChild(corner);
  for (let d = 0; d < 7; d++) {
    const dh = document.createElement("div");
    dh.className = "dayhead";
    const date = new Date(weekStart + d * 86400e3);
    dh.innerHTML = `${DAY_NAMES[d]}<small>${date.getDate()}</small>`;
    stage.appendChild(dh);
  }
  for (let h = 0; h < 24; h++) {
    const g = el("div", "gutter");
    g.textContent = String(h).padStart(2, "0");
    stage.appendChild(g);
    for (let d = 0; d < 7; d++) {
      const key = `${d}-${h}`;
      const c = el("div", "cell");
      c.dataset.d = d;
      c.dataset.h = h;
      c.dataset.key = key;
      stage.appendChild(c);
      cellsByKey[key] = c;
      cellEls.push(c);
    }
  }
}
function el(tag, cls) {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
}

/* ---------- render ---------- */

function renderCell(cell, now) {
  const key = cell.dataset.key;
  const ignitions = cells[key] || [];
  const lvl = levelOf(ignitions, now);
  cell.dataset.lvl = lvl;
}
function renderAll(now) {
  for (const c of cellEls) renderCell(c, now);
}

/* ---------- painting ---------- */

let painting = false;
stage.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  painting = true;
  try { stage.setPointerCapture(e.pointerId); } catch {}
  paintAt(e.clientX, e.clientY);
});
stage.addEventListener("pointermove", (e) => {
  if (painting) paintAt(e.clientX, e.clientY);
});
stage.addEventListener("pointerup", () => { painting = false; lastPaintKey = null; });
stage.addEventListener("pointercancel", () => { painting = false; lastPaintKey = null; });

function paintAt(x, y) {
  const t = document.elementFromPoint(x, y);
  if (!t || !t.classList || !t.classList.contains("cell")) return;
  const key = t.dataset.key;
  if (key === lastPaintKey) return;
  lastPaintKey = key;
  const now = Date.now();
  if (brush === "ignite") {
    if (!cells[key]) cells[key] = [];
    cells[key].push(now);
    if (cells[key].length > 12) cells[key].splice(0, cells[key].length - 12);
    renderCell(t, now);
    t.classList.remove("ignited"); void t.offsetWidth; t.classList.add("ignited");
    burst(key, now, 10, ["#ffffff", "#ff2d78", "#ff9f1c"], 0, -0.4);
    sndIgnite(key, now);
  } else {
    if (cells[key] && cells[key].length) {
      delete cells[key];
      renderCell(t, now);
      t.classList.remove("dousing"); void t.offsetWidth; t.classList.add("dousing");
      burst(key, now, 7, ["#22e6ff", "#ff9f1c"], 0.2, 0.5);
      sndDouse();
    }
  }
  save();
  updateStats(now);
}

/* ---------- hover ---------- */

function cellCenter(key) {
  const c = cellsByKey[key];
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

stage.addEventListener("pointermove", (e) => {
  const t = e.target;
  if (!t.classList || !t.classList.contains("cell")) return;
  const key = t.dataset.key;
  const ignitions = cells[key] || [];
  const now = Date.now();
  const lvl = levelOf(ignitions, now);
  const next = timeToNextDrop(ignitions, now);
  const d = +t.dataset.d, h = +t.dataset.h;
  const day = DAY_NAMES[d];
  cellRead.textContent = `${day} ${String(h).padStart(2, "0")}:00 · ${LEVEL_NAME[lvl].toUpperCase()}`;
  const date = new Date(weekStart + d * 86400e3 + h * 3600e3);
  tooltip.querySelector("#ttHead").textContent = `${day} ${String(h).padStart(2, "0")}:00 — ${date.getMonth() + 1}/${date.getDate()}`;
  tooltip.querySelector("#ttLevel").textContent = `${LEVEL_NAME[lvl]}${lvl > 0 ? " · " + ignitions.length + " ignitions" : ""}`;
  tooltip.querySelector("#ttCool").textContent = next === null ? "—" : `to ${LEVEL_NAME[Math.max(0, lvl - 1)]} in ${fmtDur(next)}`;
  drawTrail(tooltip.querySelector("#ttTrail"), ignitions, now, lvl);
  placeTooltip(e.clientX, e.clientY);
  lastHover = key;
});

stage.addEventListener("pointerleave", () => {
  tooltip.hidden = true;
  cellRead.textContent = "_ _ _";
  lastHover = null;
});

function placeTooltip(x, y) {
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let px = x + 16, py = y + 14;
  if (px + tw > innerWidth - 8) px = x - tw - 16;
  if (py + th > innerHeight - 8) py = y - th - 14;
  tooltip.style.left = px + "px";
  tooltip.style.top = py + "px";
}

function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h}h${mm ? " " + mm + "m" : ""}`;
}

function drawTrail(cv, ignitions, now, lvl) {
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#0a0c13";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const span = 30 * 3600e3;
  const t0 = now - span * 0.08, t1 = now + span * 0.92;
  const draw = (val, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 60; i++) {
      const t = t0 + (t1 - t0) * i / 60;
      const l = levelOf(ignitions, t);
      const x = 4 + (cv.width - 8) * i / 60;
      const y = cv.height - 6 - (l / 3) * (cv.height - 14);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  for (const ig of ignitions) {
    const sx = 4 + (cv.width - 8) * ((ig - t0) / (t1 - t0));
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(sx - 1, cv.height - 8, 2, 5);
  }
  draw(0, "#ffffff", 2);
  draw(1, "#ff2d78", 1);
  const x = 4 + (cv.width - 8) * ((now - t0) / (t1 - t0));
  ctx.strokeStyle = "#22e6ff";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, cv.height - 2); ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- particles ---------- */

function resizeFx() {
  const r = stage.getBoundingClientRect();
  fx.width = r.width * devicePixelRatio;
  fx.height = r.height * devicePixelRatio;
  fxctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resizeFx);
resizeFx();

function burst(key, now, count, colors, vx, vy) {
  const c = cellCenter(key);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: c.x, y: c.y,
      vx: vx + (Math.random() - 0.5) * 1.4,
      vy: vy + (Math.random() - 0.5) * 1.4,
      life: 0,
      max: 700 + Math.random() * 900,
      size: 1 + Math.random() * 2.6,
      color: colors[(Math.random() * colors.length) | 0],
    });
  }
}

let lastAmbient = 0;
function tickFx(dt) {
  const now = Date.now();
  if (now - lastAmbient > 700) {
    lastAmbient = now;
    const hot = cellEls.filter((c) => (+c.dataset.lvl || 0) >= 1);
    if (hot.length) {
      const c = hot[(Math.random() * hot.length) | 0];
      burst(c.dataset.key, now, 1, ["#ff9f1c", "#ff2d78", "#ffffff"], 0, -0.6);
    }
  }
  const ctx = fxctx;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(5,6,10,0.14)";
  ctx.fillRect(0, 0, fx.width / devicePixelRatio, fx.height / devicePixelRatio);
  ctx.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life > p.max) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = k;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8 * k;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
}

let lastFrame = 0;
function loop(ts) {
  const dt = Math.min(50, ts - lastFrame || 16);
  lastFrame = ts;
  tickFx(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- decay ticking ---------- */

let coolTimer = null;
function startCoolTick() {
  clearInterval(coolTimer);
  coolTimer = setInterval(() => {
    const now = Date.now();
    let cooled = false;
    for (const key of Object.keys(cells)) {
      const el = cellsByKey[key];
      const before = +el.dataset.lvl || 0;
      renderCell(el, now);
      const after = +el.dataset.lvl || 0;
      if (after < before && after >= 0) {
        cooled = true;
        burst(key, now, 5, ["#22e6ff", "#ff9f1c"], 0.15, 0.4);
        const c = cellsByKey[key];
        if (c) { c.classList.remove("dousing"); void c.offsetWidth; c.classList.add("dousing"); }
      }
      if (!cells[key].length) delete cells[key];
    }
    if (cooled) { sndCool(); save(); updateStats(now); }
  }, 30000);
}

/* ---------- stats ---------- */

function updateStats(now) {
  let embers = 0, burning = 0, coolSoon = 0, peakDay = 0, peakHeat = 0, dayHeat = [0, 0, 0, 0, 0, 0, 0];
  for (const key of Object.keys(cells)) {
    const ignitions = cells[key];
    embers += ignitions.length;
    const lvl = levelOf(ignitions, now);
    const [d] = key.split("-").map(Number);
    dayHeat[d] += lvl;
    if (lvl > 0) burning++;
    const next = timeToNextDrop(ignitions, now);
    if (next !== null && next < 3600e3 && lvl > 0) coolSoon++;
  }
  for (let d = 0; d < 7; d++) if (dayHeat[d] > peakHeat) { peakHeat = dayHeat[d]; peakDay = d; }
  document.getElementById("statEmbers").textContent = embers;
  document.getElementById("statBurn").textContent = Math.round(burning / 168 * 100) + "%";
  document.getElementById("statPeak").textContent = peakHeat ? DAY_NAMES[peakDay] : "—";
  document.getElementById("statCool").textContent = coolSoon ? `${coolSoon} cells` : "—";
}

/* ---------- persistence ---------- */

const STORE = "emberAtlas.v1";
function save() {
  const now = Date.now();
  const prune = {};
  for (const key of Object.keys(cells)) {
    const kept = cells[key].filter((t) => now - t < 26 * 3600e3);
    if (kept.length) prune[key] = kept;
  }
  cells = prune;
  try {
    localStorage.setItem(STORE, JSON.stringify({ ws: weekStart, cells: cells }));
  } catch {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.ws === weekStart && data.cells) cells = data.cells;
  } catch {}
}

/* ---------- audio ---------- */

let actx = null, master = null;
function ensureAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    const comp = actx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(actx.destination);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function tone(freq, type, dur, vol, slide) {
  const ctx = ensureAudio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}
function noise(dur, vol, freq) {
  const ctx = ensureAudio();
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); src.stop(ctx.currentTime + dur);
}
function sndIgnite(key, now) {
  const [d, h] = key.split("-").map(Number);
  const base = 220 + h * 12 + d * 8;
  tone(base, "square", 0.12, 0.35, base * 0.7);
  tone(base * 2, "sawtooth", 0.09, 0.12, base * 1.4);
  noise(0.06, 0.2, 2400);
}
function sndDouse() {
  tone(300, "sawtooth", 0.3, 0.2, 60);
  noise(0.25, 0.18, 500);
}
function sndCool() {
  tone(180, "sine", 0.35, 0.08, 60);
  noise(0.4, 0.05, 300);
}
function sndTick() {
  tone(1400, "sine", 0.03, 0.02);
}
function sndExport() {
  const notes = [440, 554, 659, 880];
  notes.forEach((f, i) => setTimeout(() => { tone(f, "triangle", 0.35, 0.16, f * 1.01); tone(f / 2, "sine", 0.4, 0.1); }, i * 90));
}

document.getElementById("btnMute").addEventListener("click", () => {
  muted = !muted;
  const b = document.getElementById("btnMute");
  b.textContent = muted ? "OFF" : "ON";
  b.classList.toggle("off", muted);
  if (master) master.gain.value = muted ? 0 : 0.5;
});

/* ---------- brush toggle ---------- */

document.querySelectorAll(".brush").forEach((b) => {
  b.addEventListener("click", () => {
    brush = b.dataset.brush;
    document.querySelectorAll(".brush").forEach((x) => x.classList.toggle("active", x === b));
    sndTick();
  });
});

/* ---------- export ---------- */

const modal = document.getElementById("modal");
document.getElementById("btnExport").addEventListener("click", () => {
  sndExport();
  buildPreview();
  buildShard();
  modal.hidden = false;
});
document.getElementById("closeModal").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

function buildPreview() {
  const cv = document.getElementById("prevCanvas");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const now = Date.now();
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.fillStyle = "#22e6ff";
  ctx.font = "600 22px 'Chakra Petch', sans-serif";
  ctx.fillText("EMBER ATLAS", 24, 40);
  ctx.fillStyle = "#6b7a92";
  ctx.font = "12px 'Share Tech Mono', monospace";
  ctx.fillText("WEEK OF " + weekLabel(), 24, 60);
  const gx = 24, gy = 80, cw = (W - 48) / 7, ch = (H - gy - 60) / 24;
  ctx.font = "10px 'Share Tech Mono', monospace";
  for (let d = 0; d < 7; d++) {
    ctx.fillStyle = "#22e6ff";
    ctx.fillText(DAY_NAMES[d], gx + d * cw + 4, gy - 6);
  }
  for (let h = 0; h < 24; h++) {
    ctx.fillStyle = "#6b7a92";
    ctx.fillText(String(h).padStart(2, "0"), 4, gy + h * ch + 10);
    for (let d = 0; d < 7; d++) {
      const key = `${d}-${h}`;
      const lvl = levelOf(cells[key] || [], now);
      ctx.fillStyle = LEVEL_COLOR[lvl];
      if (lvl > 0) { ctx.shadowColor = LEVEL_COLOR[lvl]; ctx.shadowBlur = 8; }
      ctx.fillRect(gx + d * cw + 2, gy + h * ch + 2, cw - 4, ch - 3);
      ctx.shadowBlur = 0;
    }
  }
  const embers = Object.values(cells).reduce((a, b) => a + b.length, 0);
  ctx.fillStyle = "#6b7a92";
  ctx.fillText(`${embers} embers · ${Math.round(embers / 168 / 3 * 100)}% heat · cooled over 26h`, 24, H - 18);
}

function weekLabel() {
  const s = new Date(weekStart), e = new Date(weekStart + 6 * 86400e3);
  const f = (d) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  return `${f(s)} — ${f(e)} ${s.getFullYear()}`;
}

function buildShard() {
  const now = Date.now();
  let out = "EMBER ATLAS · " + weekLabel() + "\n";
  out += "      " + DAY_NAMES.join("   ") + "\n";
  for (let h = 0; h < 24; h++) {
    let line = String(h).padStart(2, "0") + "  ";
    for (let d = 0; d < 7; d++) {
      const lvl = levelOf(cells[`${d}-${h}`] || [], now);
      line += " " + LEVEL_CHAR[lvl] + "  ";
    }
    out += line + "\n";
  }
  let embers = 0;
  for (const key of Object.keys(cells)) embers += cells[key].length;
  out += `\n${embers} embers live · cools over 26h · auto-forged`;
  document.getElementById("emberCode").textContent = out;
}

document.getElementById("dlPng").addEventListener("click", () => {
  const cv = document.getElementById("prevCanvas");
  const a = document.createElement("a");
  a.download = `ember-atlas-${new Date().toISOString().slice(0, 10)}.png`;
  a.href = cv.toDataURL("image/png");
  a.click();
  sndTick();
});

document.getElementById("copyCode").addEventListener("click", async () => {
  const txt = document.getElementById("emberCode").textContent;
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  sndExport();
});

document.getElementById("btnClear").addEventListener("click", () => {
  cells = {};
  renderAll(Date.now());
  save();
  updateStats(Date.now());
  sndDouse();
});

/* ---------- init ---------- */

function init() {
  load();
  buildGrid();
  renderAll(Date.now());
  updateStats(Date.now());
  startCoolTick();
  const d = new Date();
  document.getElementById("weekLabel").textContent = weekLabel();
  setInterval(() => {
    document.getElementById("clock").textContent = new Date().toLocaleTimeString("en-GB");
  }, 1000);
  document.getElementById("clock").textContent = new Date().toLocaleTimeString("en-GB");
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.hidden = true;
  });
}
init();