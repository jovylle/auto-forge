// Sidereal Moth Observatory — time-seeded generative moths
// Palette (3 + black/white): amber #ffc85c, periwinkle #a99bff, mint #6fe3c1
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('sky'), ctx = canvas.getContext('2d');
const toast = $('toast');

const PALETTE = ['#ffc85c', '#a99bff', '#6fe3c1'];
const NAMES = ['Vesper', 'Lumen', 'Noctua', 'Selene', 'Pyralis', 'Umbra', 'Cinnabar', 'Halo', 'Duskwisp', 'Astral'];

// ---------- utils ----------
function toastMsg(m) { toast.textContent = m; toast.classList.add('show'); clearTimeout(toastMsg.t); toastMsg.t = setTimeout(() => toast.classList.remove('show'), 2200); }
function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function nowSeed() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
function randSeed() { const p = () => String(Math.floor(Math.random() * 24)).padStart(2, '0'); const q = () => String(Math.floor(Math.random() * 60)).padStart(2, '0'); return `${p()}:${q()}:${q()}`; }

// ---------- state ----------
const state = {
  moths: [], focus: 0, orbit: 0,
  dials: { speed: 1, curl: 50, spots: 50, glow: 50 },
  audio: null, chorusOn: false,
};
try {
  const saved = JSON.parse(localStorage.getItem('sidereal-moths') || 'null');
  if (saved && Array.isArray(saved.seeds)) saved.seeds.slice(0, 8).forEach((s) => addMoth(s, true));
  if (saved && saved.dials) Object.assign(state.dials, saved.dials);
} catch { /* fresh sky */ }
function persist() {
  try { localStorage.setItem('sidereal-moths', JSON.stringify({ seeds: state.moths.map((m) => m.seed), dials: state.dials })); } catch { /* ignore */ }
}

// ---------- genome ----------
function genomeFrom(seed) {
  const rnd = mulberry32(hashSeed('moth:' + seed));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return {
    seed,
    wingSpan: 46 + rnd() * 40,
    wingRound: 0.35 + rnd() * 0.6,
    sweep: rnd() * Math.PI * 2,
    cA: pick(PALETTE), cB: pick(PALETTE),
    spots: Array.from({ length: 3 + Math.floor(rnd() * 9) }, () => ({ x: rnd(), y: rnd(), r: 0.03 + rnd() * 0.07, c: pick(PALETTE) })),
    antenna: 0.4 + rnd() * 1.2,
    flutter: 5 + rnd() * 5,
    orbitR: 90 + rnd() * 130,
    orbitW: 0.15 + rnd() * 0.4,
    phase: rnd() * Math.PI * 2,
    name: `${pick(NAMES)} ${seed.replaceAll(':', '')}`,
    born: Date.now(),
  };
}

function addMoth(seed, silent) {
  seed = (seed || '').trim() || nowSeed();
  if (!/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(seed)) { if (!silent) toastMsg('Seed must look like HH:MM:SS ✨'); return null; }
  const g = genomeFrom(seed);
  const moth = { ...g, age: silent ? 2 : 0, life: 1, // 1 full → 0 faded
    hatchT: silent ? 1 : 0 };
  state.moths.push(moth);
  if (state.moths.length > 10) state.moths.shift();
  state.focus = state.moths.length - 1;
  renderFlock(); updateMeta(); persist();
  if (!silent) toastMsg(`✦ ${g.name} hatched from ${seed}`);
  return moth;
}

// ---------- drawing ----------
function drawMoth(c, m, x, y, s, t, opts = {}) {
  const curl = (state.dials.curl / 100) * 1.1 + m.wingRound * 0.4;
  const flap = Math.sin(t * m.flutter + m.phase) * (0.35 + state.dials.speed * 0.25);
  const glow = state.dials.glow / 100;
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 0.7 + m.phase) * 0.25);
  c.scale(s, s);
  c.globalAlpha = (opts.alpha ?? 1) * Math.min(1, m.hatchT * 2) * (0.25 + 0.75 * m.life);
  if (glow > 0.02) { c.shadowBlur = 18 + glow * 30; c.shadowColor = m.cA; }
  // wings
  for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    c.rotate(flap * 0.5 * side * -1);
    const w = m.wingSpan / 46, hgt = m.wingRound;
    const grad = c.createLinearGradient(0, 0, w * 46, 0);
    grad.addColorStop(0, m.cB); grad.addColorStop(1, m.cA);
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(0, -6);
    c.bezierCurveTo(w * 20, -34 * hgt - curl * 8, w * (44 + curl * 14), -22 * hgt, w * 46, 6);
    c.bezierCurveTo(w * (40 - curl * 6), 20, w * 18, 26 + curl * 8, 0, 10);
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.1; c.stroke();
    // spots (warped by starlight dial)
    const density = Math.round(m.spots.length * (0.3 + (state.dials.spots / 100) * 1.4));
    c.fillStyle = '#fff';
    m.spots.slice(0, density).forEach((sp) => {
      c.globalAlpha *= 1; c.fillStyle = sp.c;
      c.beginPath(); c.arc(8 + sp.x * w * 32, -14 + sp.y * 30, sp.r * 46 * 0.45 + 1, 0, 7); c.fill();
    });
    c.restore();
  }
  // body
  c.shadowBlur = 0;
  c.fillStyle = '#0b0b16';
  c.strokeStyle = '#fff'; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(0, 2, 5, 13, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = m.cA;
  c.beginPath(); c.arc(0, -12, 4.5, 0, 7); c.fill();
  // antennae
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * 2, -14);
    c.quadraticCurveTo(side * (8 + m.antenna * 8), -24, side * (12 + m.antenna * 10), -30 - Math.sin(t * 3 + m.phase) * 3);
    c.stroke();
  }
  c.restore();
}

function drawScene(t, dt) {
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2 + 10;
  ctx.clearRect(0, 0, W, H);
  // nebula
  const neb = ctx.createRadialGradient(cx, cy, 20, cx, cy, 320);
  neb.addColorStop(0, 'rgba(169,155,255,.16)'); neb.addColorStop(0.6, 'rgba(255,200,92,.05)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
  // orbital clock rings (12 ticks)
  for (let ring = 0; ring < 3; ring++) {
    const r = 95 + ring * 62;
    ctx.strokeStyle = ring === 1 ? 'rgba(255,200,92,.35)' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = ring === 1 ? 1.6 : 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + state.orbit * 0.05 * (ring + 1);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i % 3 === 0 ? 2.4 : 1.2, 0, 7); ctx.fill();
    }
  }
  // moon dial
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 24; ctx.shadowColor = '#ffc85c';
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#060714'; ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 13, 0, 7); ctx.fill();

  // moths
  state.moths.forEach((m, i) => {
    m.hatchT = Math.min(1, m.hatchT + dt * 0.8);
    const w = m.orbitW * state.dials.speed * (i === state.focus ? 1.15 : 1);
    m.phase2 = (m.phase2 ?? m.phase) + dt * w;
    const r = m.orbitR * (0.95 + (state.dials.curl / 100) * 0.25);
    const x = cx + Math.cos(m.phase2) * r * 1.25;
    const y = cy + Math.sin(m.phase2) * r * 0.72;
    const laps = Math.abs(m.phase2 - m.phase) / (Math.PI * 2);
    m.life = Math.max(0, 1 - laps / 6); // fade after ~6 orbits
    const s = (i === state.focus ? 1.15 : 0.8) * (0.6 + 0.4 * m.hatchT);
    drawMoth(ctx, m, x, y, s, t);
  });
  // remove fully faded (keep at least focused)
  state.moths = state.moths.filter((m, i) => m.life > 0 || i === state.focus);
  if (state.focus >= state.moths.length) state.focus = Math.max(0, state.moths.length - 1);
}

// ---------- HUD loop ----------
let last = performance.now(), frames = 0, fpsT = 0;
function loop(now) {
  const t = now / 1000;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  state.orbit += dt * state.dials.speed;
  drawScene(t, dt);
  frames++; fpsT += dt;
  if (fpsT >= 1) { $('fps').textContent = `${frames} fps · ${state.moths.length} moths`; frames = 0; fpsT = 0; }
  const f = state.moths[state.focus];
  if (f) {
    $('mothName').textContent = `✦ ${f.name}`;
    $('lifeBar').style.width = `${Math.round(f.life * 100)}%`;
    $('lifeLabel').textContent = f.life > 0.6 ? 'fluttering' : f.life > 0.25 ? 'fading' : 'almost stardust';
    $('orbitCount').textContent = `orbit ${Math.floor(state.orbit)}`;
  }
  requestAnimationFrame(loop);
}

// ---------- UI wiring ----------
function updateMeta() {
  const f = state.moths[state.focus];
  $('seedMeta').textContent = f ? `seed ${f.seed} · genome ${hashSeed('moth:' + f.seed).toString(16)} · ${f.spots.length} spots` : 'seed — · genome —';
  if (f) { $('mothName').textContent = `✦ ${f.name}`; }
}
function renderFlock() {
  const fl = $('flock'); fl.innerHTML = '';
  state.moths.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = `${m.seed} ${i === state.focus ? '●' : ''}`;
    b.className = i === state.focus ? 'focus' : '';
    b.title = m.name;
    b.onclick = () => { state.focus = i; renderFlock(); updateMeta(); };
    fl.appendChild(b);
  });
}

$('seedInput').value = nowSeed();
$('hatchBtn').onclick = () => addMoth($('seedInput').value);
$('nowBtn').onclick = () => { $('seedInput').value = nowSeed(); addMoth($('seedInput').value); };
$('diceBtn').onclick = () => { $('seedInput').value = randSeed(); addMoth($('seedInput').value); };
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (e.code === 'Space') { e.preventDefault(); addMoth($('seedInput').value); }
  if (e.key === 'c' || e.key === 'C') toggleChorus();
});

function bindDial(id, key, label, fmt) {
  const el = $(id);
  el.value = key === 'speed' ? state.dials.speed * 100 : state.dials[key];
  const show = () => { $(label).textContent = fmt(Number(el.value)); };
  el.oninput = () => {
    if (key === 'speed') state.dials.speed = el.value / 100; else state.dials[key] = Number(el.value);
    show(); persist();
  };
  show();
}
bindDial('dSpeed', 'speed', 'vSpeed', (v) => (v / 100).toFixed(1) + '×');
bindDial('dCurl', 'curl', 'vCurl', (v) => v);
bindDial('dSpots', 'spots', 'vSpots', (v) => v);
bindDial('dGlow', 'glow', 'vGlow', (v) => v);

// clock readout
setInterval(() => { $('clockReadout').textContent = new Date().toLocaleTimeString('en-GB'); }, 500);
$('clockReadout').textContent = new Date().toLocaleTimeString('en-GB');

// ---------- generative dusk chorus (WebAudio, loops forever) ----------
function buildChorus() {
  const AC = new (window.AudioContext || window.webkitAudioContext)();
  const master = AC.createGain(); master.gain.value = Number($('vol').value) / 100 * 0.5;
  master.connect(AC.destination);
  $('vol').oninput = () => { master.gain.value = Number($('vol').value) / 100 * 0.5; };
  // low dusk pad: two detuned sines through slow LFO
  const padG = AC.createGain(); padG.gain.value = 0.16; padG.connect(master);
  [110, 164.8, 220 * 1.005].forEach((f, i) => {
    const o = AC.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f;
    const g = AC.createGain(); g.gain.value = 0.33; o.connect(g); g.connect(padG); o.start();
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
    const lg = AC.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  });
  // cricket shimmer: bandpassed noise pulses
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = AC.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4600; bp.Q.value = 9;
  const ng = AC.createGain(); ng.gain.value = 0;
  noise.connect(bp); bp.connect(ng); ng.connect(master); noise.start();
  const lfo2 = AC.createOscillator(); lfo2.type = 'square'; lfo2.frequency.value = 14;
  const lg2 = AC.createGain(); lg2.gain.value = 0.05; lfo2.connect(lg2); lg2.connect(ng.gain); lfo2.start();
  // distant owl: schedule soft two-note hoots
  function hoot() {
    if (!state.chorusOn) return;
    const t0 = AC.currentTime + 0.1;
    [340, 290].forEach((f, k) => {
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = AC.createGain(); g.gain.setValueAtTime(0, t0 + k * 0.45);
      g.gain.linearRampToValueAtTime(0.12, t0 + k * 0.45 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + k * 0.45 + 0.4);
      o.connect(g); g.connect(master); o.start(t0 + k * 0.45); o.stop(t0 + k * 0.45 + 0.5);
    });
    setTimeout(hoot, 7000 + Math.random() * 9000);
  }
  setTimeout(hoot, 2500);
  return { AC, master };
}
async function toggleChorus() {
  if (!state.audio) state.audio = buildChorus();
  await state.audio.AC.resume();
  state.chorusOn = !state.chorusOn;
  state.audio.master.gain.value = state.chorusOn ? Number($('vol').value) / 100 * 0.5 : 0;
  const label = state.chorusOn ? '🌙 Dusk chorus: on' : '🦉 Dusk chorus: off';
  const label2 = state.chorusOn ? '⏸ Stop chorus' : '▶ Loop dusk chorus';
  $('chorusBtn').textContent = label; $('chorusBtn2').textContent = label2;
  $('chorusBtn').classList.toggle('on', state.chorusOn);
  $('chorusBtn').setAttribute('aria-pressed', String(state.chorusOn));
  if (state.chorusOn) toastMsg('🌙 dusk chorus looping — crickets + pad + owls');
}
$('chorusBtn').onclick = toggleChorus;
$('chorusBtn2').onclick = toggleChorus;

// ---------- wallpaper export ----------
function exportWallpaper() {
  const f = state.moths[state.focus];
  if (!f) { toastMsg('Hatch a moth first ✦'); return; }
  const [W, H] = $('wallSize').value.split('x').map(Number);
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const c = off.getContext('2d');
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0d0e2a'); g.addColorStop(0.55, '#060714'); g.addColorStop(1, '#131134');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rnd = mulberry32(hashSeed('stars:' + f.seed));
  for (let i = 0; i < 400; i++) {
    c.fillStyle = ['#ffffff', '#ffc85c', '#a99bff', '#6fe3c1'][Math.floor(rnd() * 4)];
    c.globalAlpha = 0.25 + rnd() * 0.75;
    c.beginPath(); c.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 2.2, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  // rings
  c.strokeStyle = 'rgba(255,255,255,.14)';
  [0.22, 0.3, 0.38].forEach((k) => { c.beginPath(); c.arc(W / 2, H / 2, Math.min(W, H) * k, 0, 7); c.stroke(); });
  // big centered moth (reuse live draw via temp state boost)
  const prevGlow = state.dials.glow;
  const s = Math.min(W, H) / 260;
  const t = performance.now() / 1000;
  const keep = ctx; // draw onto offscreen using same routine by swapping ctx ops
  drawMothOn(c, f, W / 2, H / 2, s, t);
  state.dials.glow = prevGlow;
  // caption
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `${Math.round(Math.min(W, H) / 28)}px Georgia, serif`;
  c.textAlign = 'center';
  c.fillText(`✦ ${f.name} · seed ${f.seed} ✦`, W / 2, H - Math.min(W, H) * 0.07);
  c.font = `${Math.round(Math.min(W, H) / 60)}px monospace`; c.fillStyle = 'rgba(255,255,255,.45)';
  c.fillText('SIDEREAL MOTH OBSERVATORY', W / 2, H - Math.min(W, H) * 0.035);
  const a = document.createElement('a');
  a.download = `moth-${f.seed.replaceAll(':', '')}-${W}x${H}.png`;
  a.href = off.toDataURL('image/png');
  a.click();
  toastMsg(`⬇ wallpaper saved — ${W}×${H}`);
}
// drawMoth uses outer ctx; make a ctx-swappable copy for export
function drawMothOn(c, m, x, y, s, t) {
  const curl = (state.dials.curl / 100) * 1.1 + m.wingRound * 0.4;
  const flap = Math.sin(t * m.flutter + m.phase) * 0.3;
  const glow = state.dials.glow / 100;
  c.save(); c.translate(x, y); c.scale(s, s);
  if (glow > 0.02) { c.shadowBlur = 30 + glow * 40; c.shadowColor = m.cA; }
  for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1); c.rotate(flap * 0.5 * side * -1);
    const w = m.wingSpan / 46;
    const grad = c.createLinearGradient(0, 0, w * 46, 0);
    grad.addColorStop(0, m.cB); grad.addColorStop(1, m.cA);
    c.fillStyle = grad;
    c.beginPath(); c.moveTo(0, -6);
    c.bezierCurveTo(w * 20, -34 * m.wingRound - curl * 8, w * (44 + curl * 14), -22 * m.wingRound, w * 46, 6);
    c.bezierCurveTo(w * (40 - curl * 6), 20, w * 18, 26 + curl * 8, 0, 10);
    c.closePath(); c.fill();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.1; c.stroke();
    const density = Math.round(m.spots.length * (0.3 + (state.dials.spots / 100) * 1.4));
    m.spots.slice(0, density).forEach((sp) => {
      c.fillStyle = sp.c;
      c.beginPath(); c.arc(8 + sp.x * w * 32, -14 + sp.y * 30, sp.r * 46 * 0.45 + 1, 0, 7); c.fill();
    });
    c.restore();
  }
  c.shadowBlur = 0; c.fillStyle = '#0b0b16'; c.strokeStyle = '#fff'; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(0, 2, 5, 13, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = m.cA; c.beginPath(); c.arc(0, -12, 4.5, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * 2, -14);
    c.quadraticCurveTo(side * (8 + m.antenna * 8), -24, side * (12 + m.antenna * 10), -30);
    c.stroke();
  }
  c.restore();
}
$('wallpaperBtn').onclick = exportWallpaper;
$('wallpaperBtn2').onclick = exportWallpaper;

// ---------- boot ----------
function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * scale);
  canvas.height = Math.round((r.width * 0.688) * scale);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();
if (state.moths.length === 0) addMoth(nowSeed(), true);
renderFlock(); updateMeta();
requestAnimationFrame(loop);
console.log('sidereal moth observatory ready');
