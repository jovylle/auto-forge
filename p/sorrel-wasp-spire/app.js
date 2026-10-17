// Sorrel Wasp Spire — generative paper spire + hum synth + swarm export.
// Plain ES module, no deps. Works from file:// . Seeded RNG so share-links regrow identical spires.

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- seeded rng ----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const randSeed = () => Math.random().toString(36).slice(2, 8);
let rng = mulberry32(1);

// ---------- state ----------
const MAX_TIERS = 44;
const state = {
  seed: randSeed(),
  cells: [],            // {tier, slot, jitter, cap, born, pop}
  cursor: { tier: 0, slot: 0 },
  wasps: [],            // {x,y,vx,vy, turbo}
  swarmTarget: 14,
  cellScale: 1,
  tempo: 1,
  drone: 150, buzz: 40, vol: 60,
  rotation: 0, camY: 0, camTarget: 0,
  agitation: 0, buildQueue: 0, buildAcc: 0,
  autoBuild: true, sting: 0,
  audioOn: false, focusTier: 6,
  t: 0,
};

function slotsFor(tier) { return Math.max(3, Math.round(11 * (1 - tier / (MAX_TIERS + 8)))); }
function radiusFor(tier) { return 150 * (1 - tier / (MAX_TIERS + 14)); }

// ---------- dom ----------
const canvas = $('#spireCanvas');
const ctx = canvas.getContext('2d');
const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---------- persistence ----------
const LS_KEY = 'sorrel-wasp-spire-v1';
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      seed: state.seed, cells: state.cells.length, cursor: state.cursor,
      swarmTarget: state.swarmTarget, cellScale: state.cellScale, tempo: state.tempo,
      drone: state.drone, buzz: state.buzz, vol: state.vol,
    }));
    $('#saveState').textContent = `local · ${state.cells.length} cells · just now`;
  } catch { /* private mode */ }
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- colony growth ----------
function placeCell() {
  let { tier, slot } = state.cursor;
  if (tier >= MAX_TIERS) return false;
  const slots = slotsFor(tier);
  const j = () => (rng() - 0.5) * 0.24;
  const idx = state.cells.length;
  state.cells.push({ tier, slot, jitter: j(), cap: idx % 5 === 3, born: state.t, pop: 0, shade: rng() });
  slot++;
  if (slot >= slots) { tier++; slot = 0; }
  state.cursor = { tier, slot };
  return true;
}
function cellsForCount(n) { for (let i = 0; i < n; i++) if (!placeCell()) break; }
function regrow(seed, count) {
  const seedFn = xmur3(seed);
  rng = mulberry32(seedFn());
  state.seed = seed;
  state.cells = [];
  state.cursor = { tier: 0, slot: 0 };
  state.t = 0;
  cellsForCount(count);
  $('#seedLabel').textContent = seed;
}

// ---------- wasps ----------
function spawnWasp(anywhere = false) {
  const w = canvas.width / (dpr || 1), h = canvas.height / (dpr || 1);
  state.wasps.push({
    x: anywhere ? Math.random() * w : w / 2 + (Math.random() - 0.5) * 60,
    y: anywhere ? Math.random() * h : h - 40,
    vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
    ph: Math.random() * Math.PI * 2,
  });
}
function syncWasps() {
  while (state.wasps.length < state.swarmTarget) spawnWasp();
  if (state.wasps.length > state.swarmTarget) state.wasps.length = state.swarmTarget;
}

// ---------- canvas sizing ----------
let dpr = 1;
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
}
window.addEventListener('resize', resize);

// ---------- scroll: camera + agitation + chapters ----------
let lastY = window.scrollY;
function scrollMetrics() {
  const doc = document.documentElement;
  const max = Math.max(1, doc.scrollHeight - window.innerHeight);
  return clamp(window.scrollY / max, 0, 1);
}
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  state.agitation = clamp(state.agitation + Math.abs(y - lastY) * 0.012, 0, 3);
  lastY = y;
  const p = scrollMetrics();
  state.camTarget = p * MAX_TIERS;
  $('#scrollProgress').style.transform = `scaleX(${p})`;
}, { passive: true });

const chapterIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    $$('.chapter').forEach((c) => c.classList.remove('in'));
    el.classList.add('in');
    state.focusTier = Number(el.dataset.tier || 6);
    $('#stratum').textContent = `stratum 0${Number(el.dataset.chapter) + 1} · ${el.dataset.name}`;
  }
}, { threshold: 0.35 });
$$('.chapter').forEach((c) => chapterIO.observe(c));

// ---------- audio: hum synth ----------
let AC = null, oscSaw = null, oscSub = null, lfo = null, lfoGain = null, bp = null, master = null, stingGain = null;
function ensureAudio() {
  if (AC) return true;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { toast('WebAudio unavailable in this browser'); return false; }
  oscSaw = AC.createOscillator(); oscSaw.type = 'sawtooth';
  oscSub = AC.createOscillator(); oscSub.type = 'sine';
  lfo = AC.createOscillator(); lfo.type = 'square';
  lfoGain = AC.createGain();
  bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
  master = AC.createGain(); master.gain.value = 0;
  stingGain = AC.createGain(); stingGain.gain.value = 0;
  const sting = AC.createOscillator(); sting.type = 'triangle'; sting.frequency.value = 880;
  sting.connect(stingGain).connect(AC.destination); sting.start();
  oscSaw.connect(bp); oscSub.connect(bp);
  lfo.connect(lfoGain); lfoGain.connect(oscSaw.detune); lfoGain.connect(oscSub.detune);
  bp.connect(master).connect(AC.destination);
  oscSaw.start(); oscSub.start(); lfo.start();
  return true;
}
function liveFreq() {
  const alt = state.cells.length / 6 + state.focusTier * 0.6;
  return state.drone * (1 + alt / 90) + state.agitation * 14 + state.sting * 160;
}
function updateAudio() {
  if (!AC || !state.audioOn) return;
  const t = AC.currentTime, f = liveFreq();
  oscSaw.frequency.setTargetAtTime(f, t, 0.08);
  oscSub.frequency.setTargetAtTime(f / 2, t, 0.1);
  lfo.frequency.setTargetAtTime(4 + state.buzz / 6 + state.agitation * 3, t, 0.1);
  lfoGain.gain.setTargetAtTime(state.buzz * 1.6, t, 0.1);
  bp.frequency.setTargetAtTime(400 + f * 3 + state.agitation * 300 + state.sting * 1200, t, 0.06);
  bp.Q.setTargetAtTime(1.2 + state.buzz / 40, t, 0.1);
  master.gain.setTargetAtTime((state.vol / 100) * 0.22, t, 0.12);
}
function setHum(on) {
  if (on && !ensureAudio()) return;
  state.audioOn = on;
  if (AC && AC.state === 'suspended') AC.resume();
  if (AC) master.gain.setTargetAtTime(on ? (state.vol / 100) * 0.22 : 0, AC.currentTime, 0.15);
  $('#btnHum').textContent = on ? '🔊 hum: on' : '🔇 hum: off';
  $('#heroHum').textContent = on ? '🔊 humming…' : '🔇 start the hum';
  if (on) toast('the spire hums — scroll to bend the pitch');
}
function sting() {
  state.sting = 1;
  state.agitation = clamp(state.agitation + 1.4, 0, 3);
  for (let i = 0; i < 6; i++) spawnWasp();
  syncWasps();
  if (AC && state.audioOn) {
    stingGain.gain.cancelScheduledValues(AC.currentTime);
    stingGain.gain.setValueAtTime(0.25, AC.currentTime);
    stingGain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.5);
  }
}

// ---------- drawing ----------
function hexPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
function cellScreenPos(cell, cx, baseY, tierH) {
  const slots = slotsFor(cell.tier);
  const a = ((cell.slot + cell.jitter) / slots) * Math.PI * 2 + state.rotation * (1 + cell.tier * 0.012);
  const R = radiusFor(cell.tier) * state.cellScale * 0.62;
  const depth = Math.sin(a); // -1 back … +1 front
  const x = cx + Math.cos(a) * R;
  const y = baseY - (cell.tier - state.camY) * tierH + depth * R * 0.28;
  return { x, y, depth, a };
}
const AMBER = '#F2B705'; // single wasp-amber; variety comes from alpha, not hue
function draw(now) {
  const dt = Math.min(0.05, (now - (draw.prev || now)) / 1000);
  draw.prev = now;
  state.t += dt;
  state.rotation += dt * (0.12 + state.agitation * 0.25);
  state.camY = lerp(state.camY, state.autoBuild ? lerp(state.camTarget, state.cursor.tier - 4, 0.35) : state.camTarget, 1 - Math.pow(0.002, dt));
  state.agitation = Math.max(0, state.agitation - dt * 1.2);
  state.sting = Math.max(0, state.sting - dt * 1.6);

  // auto-build from the swarm
  if (state.autoBuild && state.cells.length > 0) {
    state.buildAcc += dt * state.tempo * (1 + state.agitation * 0.8);
    const interval = 0.5;
    while (state.buildAcc > interval) {
      state.buildAcc -= interval;
      if (state.cursor.tier < MAX_TIERS && state.buildQueue > 0) { placeCell(); state.buildQueue--; }
      else if (state.cursor.tier < MAX_TIERS && Math.random() < 0.25) placeCell();
    }
  }

  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, baseY = h - 56;
  const tierH = Math.max(15, 21 * state.cellScale);
  const hexR = Math.max(7, 13.5 * state.cellScale);

  // ground glow
  const glow = ctx.createRadialGradient(cx, baseY, 8, cx, baseY, Math.max(w, h) * 0.55);
  glow.addColorStop(0, 'rgba(242,183,5,.30)');
  glow.addColorStop(0.5, 'rgba(200,80,46,.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // stalk
  ctx.strokeStyle = 'rgba(255,249,238,.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, baseY + 30);
  ctx.quadraticCurveTo(cx - 14, baseY - state.cursor.tier * tierH * 0.3, cx, baseY - (state.cursor.tier + 2) * tierH);
  ctx.stroke();

  // cells, painter's order back→front
  const order = state.cells
    .map((c) => ({ c, p: cellScreenPos(c, cx, baseY, tierH) }))
    .filter(({ p }) => p.y > -60 && p.y < h + 60)
    .sort((a, b) => a.p.depth - b.p.depth);
  for (const { c, p } of order) {
    c.pop = Math.min(1, (c.pop || 0) + dt * 3);
    const s = 0.4 + 0.6 * c.pop;
    const r = hexR * s * (0.92 + 0.16 * ((c.slot % 3) / 2));
    const alpha = 0.55 + 0.45 * ((p.depth + 1) / 2);
    ctx.globalAlpha = alpha;
    hexPath(ctx, p.x, p.y, r);
    if (c.cap) {
      ctx.fillStyle = '#C8502E';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,249,238,.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.22, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = AMBER;
      ctx.fill();
      // tonal variety via an ink wash, never a new hue
      ctx.globalAlpha = alpha * (c.shade || 0) * 0.35;
      ctx.fillStyle = '#120B06';
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(18,11,6,.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // paper grain: two chewed-fibre strokes
      ctx.strokeStyle = 'rgba(18,11,6,.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.5, p.y - r * 0.12);
      ctx.lineTo(p.x + r * 0.5, p.y - r * 0.3);
      ctx.moveTo(p.x - r * 0.45, p.y + r * 0.28);
      ctx.lineTo(p.x + r * 0.45, p.y + r * 0.1);
      ctx.stroke();
    }
    // fresh-cell glint
    if (state.t - c.born < 0.6) {
      ctx.globalAlpha = (0.6 - (state.t - c.born)) * alpha;
      hexPath(ctx, p.x, p.y, r + 3);
      ctx.strokeStyle = '#FFF9EE';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // build tip sparkle
  if (state.cursor.tier < MAX_TIERS) {
    const tipY = baseY - (state.cursor.tier - state.camY) * tierH;
    if (tipY > 0 && tipY < h) {
      ctx.fillStyle = `rgba(242,183,5,${0.35 + 0.3 * Math.sin(state.t * 5)})`;
      ctx.beginPath(); ctx.arc(cx, tipY, 5 + state.agitation * 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // wasps
  syncWasps();
  const tipY = baseY - (state.cursor.tier - state.camY) * tierH;
  for (const m of state.wasps) {
    m.ph += dt * (10 + state.agitation * 14);
    const tx = cx + Math.cos(m.ph * 0.7) * (60 + state.agitation * 40);
    const ty = clamp(tipY, 40, h - 30) + Math.sin(m.ph) * 46 - 30;
    m.vx = lerp(m.vx, (tx - m.x) * 2.2, 0.06);
    m.vy = lerp(m.vy, (ty - m.y) * 2.2, 0.06);
    const sp = 1 + state.agitation * 1.6 + state.sting * 3;
    m.x += m.vx * sp; m.y += m.vy * sp;
    const flap = Math.abs(Math.sin(m.ph * 3)) * 5;
    ctx.strokeStyle = 'rgba(255,249,238,.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(m.x - 3, m.y - flap * 0.4, 4.5, 1.8, -0.5, 0, Math.PI * 2);
    ctx.ellipse(m.x + 3, m.y - flap * 0.4, 4.5, 1.8, 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#120B06';
    ctx.beginPath(); ctx.ellipse(m.x, m.y, 4.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F2B705';
    ctx.fillRect(m.x - 1, m.y - 1.6, 2.4, 3.2);
  }

  updateAudio();
  requestAnimationFrame(draw);
}

// ---------- HUD ----------
setInterval(() => {
  $('#statCells').textContent = state.cells.length;
  $('#statWasps').textContent = state.wasps.length;
  const f = state.audioOn && AC ? Math.round(liveFreq()) : Math.round(liveFreq());
  $('#statFreq').textContent = `${f} Hz`;
  $('#freqReadout').textContent = `${f} Hz`;
  $('#hudTier').textContent = `${state.cursor.tier}/${MAX_TIERS}`;
  $('#hudAgit').textContent = state.agitation > 1.6 ? 'frenzy' : state.agitation > 0.5 ? 'astir' : 'calm';
  $('#hudCam').textContent = `${Math.max(0, Math.round(state.camY))}m`;
}, 250);

// ---------- controls ----------
$('#btnCell').addEventListener('click', () => {
  if (placeCell()) { state.agitation = clamp(state.agitation + 0.3, 0, 3); save(); }
  else toast('the spire has reached the sky — reset to rebuild');
});
$('#layHint').addEventListener('click', () => $('#btnCell').click());
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const burst = clamp(Math.round((1 - (e.clientY - r.top) / r.height) * 4) + 1, 1, 5);
  let laid = 0;
  for (let i = 0; i < burst; i++) if (placeCell()) laid++;
  state.agitation = clamp(state.agitation + 0.5, 0, 3);
  for (let i = 0; i < burst; i++) spawnWasp();
  syncWasps();
  if (!laid) toast('the spire has reached the sky — reset to rebuild');
  save();
});
$('#btnSwarm').addEventListener('click', () => {
  state.buildQueue += 40;
  state.agitation = clamp(state.agitation + 1, 0, 3);
  toast('the swarm descends — 40 cells inbound');
});
$('#btnSeed').addEventListener('click', () => {
  regrow(randSeed(), 60 + Math.floor(Math.random() * 40));
  state.buildQueue = 0;
  toast(`new foundress · seed ${state.seed}`);
  save();
});
$('#btnReset').addEventListener('click', () => {
  regrow(state.seed, 48);
  state.buildQueue = 0; state.agitation = 0;
  toast('spire pared back to the foundation ring');
  save();
});
$('#btnHum').addEventListener('click', () => setHum(!state.audioOn));
$('#heroHum').addEventListener('click', () => setHum(!state.audioOn));
$('#btnSting').addEventListener('click', sting);
$('#btnSting2').addEventListener('click', sting);

function bindSlider(id, out, fmt, fn) {
  const el = $(id);
  const render = () => { $(out).textContent = fmt(Number(el.value)); };
  el.addEventListener('input', () => { fn(Number(el.value)); render(); save(); });
  render();
}
bindSlider('#sSwarm', '#oSwarm', (v) => `${v}`, (v) => { state.swarmTarget = v; syncWasps(); });
bindSlider('#sCell', '#oCell', (v) => `${(v / 100).toFixed(1)}×`, (v) => { state.cellScale = v / 100; });
bindSlider('#sTempo', '#oTempo', (v) => `${(v / 100).toFixed(1)}×`, (v) => { state.tempo = v / 100; });
bindSlider('#sDrone', '#oDrone', (v) => `${v} Hz`, (v) => { state.drone = v; });
bindSlider('#sBuzz', '#oBuzz', (v) => `${v}%`, (v) => { state.buzz = v; });
bindSlider('#sVol', '#oVol', (v) => `${v}%`, (v) => { state.vol = v; });

// ---------- export ----------
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
$('#btnPng').addEventListener('click', () => {
  canvas.toBlob((b) => {
    if (!b) return toast('PNG export failed in this browser');
    download(`sorrel-wasp-spire-${state.seed}.png`, b);
    toast('poster pinned — png saved');
  }, 'image/png');
});
$('#btnJson').addEventListener('click', () => {
  const genome = {
    app: 'sorrel-wasp-spire', seed: state.seed, exportedAt: new Date().toISOString(),
    cells: state.cells, cursor: state.cursor,
    params: { swarm: state.swarmTarget, cellScale: state.cellScale, tempo: state.tempo, drone: state.drone, buzz: state.buzz, vol: state.vol },
  };
  download(`wasp-genome-${state.seed}.json`, new Blob([JSON.stringify(genome, null, 2)], { type: 'application/json' }));
  toast('genome sequenced — json saved');
});
$('#btnLink').addEventListener('click', async () => {
  const p = new URLSearchParams({
    seed: state.seed, n: String(state.cells.length),
    swarm: String(state.swarmTarget), cell: String(Math.round(state.cellScale * 100)),
    drone: String(state.drone), buzz: String(state.buzz),
  });
  const url = `${location.href.split('#')[0]}#colony=${p.toString()}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('share-link copied — it regrows this exact spire');
  } catch {
    location.hash = `colony=${p.toString()}`;
    toast('clipboard blocked — link is in the address bar');
  }
});
$('#btnWipe').addEventListener('click', () => {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  $('#saveState').textContent = 'forgotten';
  toast('saved colony forgotten on this device');
});
function restoreFromHash() {
  if (!location.hash.includes('colony=')) return false;
  try {
    const p = new URLSearchParams(location.hash.split('colony=')[1]);
    const seed = p.get('seed') || randSeed();
    regrow(seed, clamp(Number(p.get('n')) || 60, 1, 2000));
    state.swarmTarget = clamp(Number(p.get('swarm')) || 14, 3, 40);
    state.cellScale = clamp((Number(p.get('cell')) || 100) / 100, 0.6, 1.6);
    state.drone = clamp(Number(p.get('drone')) || 150, 70, 320);
    state.buzz = clamp(Number(p.get('buzz')) || 40, 0, 100);
    $('#sSwarm').value = state.swarmTarget; $('#oSwarm').textContent = state.swarmTarget;
    $('#sCell').value = Math.round(state.cellScale * 100); $('#oCell').textContent = `${state.cellScale.toFixed(1)}×`;
    $('#sDrone').value = state.drone; $('#oDrone').textContent = `${state.drone} Hz`;
    $('#sBuzz').value = state.buzz; $('#oBuzz').textContent = `${state.buzz}%`;
    toast(`colony ${seed} regrown from link`);
    return true;
  } catch { return false; }
}

// ---------- boot ----------
resize();
let restored = restoreFromHash();
if (!restored) {
  const saved = loadSaved();
  if (saved && saved.seed) {
    regrow(saved.seed, clamp(saved.cells || 60, 1, 2000));
    Object.assign(state, {
      swarmTarget: saved.swarmTarget ?? 14, cellScale: saved.cellScale ?? 1,
      tempo: saved.tempo ?? 1, drone: saved.drone ?? 150, buzz: saved.buzz ?? 40, vol: saved.vol ?? 60,
    });
    toast(`welcome back — colony ${saved.seed} restored`);
  } else {
    regrow(state.seed, 118);
  }
}
$('#seedLabel').textContent = state.seed;
for (let i = 0; i < state.swarmTarget; i++) spawnWasp(true);
syncWasps();
setInterval(save, 8000);
requestAnimationFrame(draw);
console.log('sorrel-wasp-spire ready · cells/hum/export online');
