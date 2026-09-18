// Tape Loop Lagoon — 4 synthesized tape loops, ripple-triggered, pitch-bendable, WAV export.
// No assets, no network. Works from file://. Fully keyboard playable.
'use strict';

const SR = 44100, LOOP_SECS = 8;
const DECKS = [
  { name: 'I · SILT DRONE', sub: '55hz moss hum',   color: '#9db35c', defRate: 1.0, defVol: 0.8 },
  { name: 'II · RUST ARP',  sub: 'pentatonic plucks', color: '#d8b93c', defRate: 1.0, defVol: 0.75 },
  { name: 'III · CHOIR REEDS', sub: 'drowned chords', color: '#7a5fa0', defRate: 1.0, defVol: 0.8 },
  { name: 'IV · HERON STATIC', sub: 'noise + gull pings', color: '#c1502e', defRate: 1.0, defVol: 0.65 },
];

/* ---------- persistent state ---------- */
const store = (() => {
  try {
    const s = JSON.parse(localStorage.getItem('tape-loop-lagoon') || '{}');
    return s && typeof s === 'object' ? s : {};
  } catch { return {}; }
})();
function save() {
  try {
    localStorage.setItem('tape-loop-lagoon', JSON.stringify({
      rates: deckState.map(d => d.rate), vols: deckState.map(d => d.vol),
      master, echoAmt, hissAmt,
    }));
  } catch {}
}

/* ---------- procedural loop synthesis (seamless 8s buffers) ---------- */
function norm(buf, peak = 0.75) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}
function tri(phase) { // -1..1 triangle
  const p = phase % 1;
  return p < 0.5 ? -1 + 4 * p : 3 - 4 * p;
}
function makeDrone() {
  const n = SR * LOOP_SECS, b = new Float32Array(n);
  const partials = [[55, .5], [110.4, .3], [164.9, .2], [220.5, .14], [331, .07]];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const swell = 0.72 + 0.28 * Math.sin(2 * Math.PI * t / LOOP_SECS);
    let v = 0;
    for (const [f, a] of partials) v += a * Math.sin(2 * Math.PI * f * t + 0.4 * Math.sin(2 * Math.PI * t / 5.3));
    v += 0.05 * Math.sin(2 * Math.PI * 440.7 * t) * Math.sin(2 * Math.PI * t / 8);
    b[i] = Math.tanh(v * 0.9) * swell * 0.8;
  }
  return norm(b);
}
function makeArp() {
  const n = SR * LOOP_SECS, b = new Float32Array(n);
  const scale = [110, 130.81, 146.83, 164.81, 196, 220, 196, 164.81, 146.83, 130.81, 164.81, 196, 246.94, 220, 164.81, 146.83];
  const step = LOOP_SECS / 16;
  for (let s = 0; s < 16; s++) {
    const f = scale[s] * 2, start = Math.floor(s * step * SR);
    const len = Math.floor(step * 1.6 * SR);
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / SR, env = Math.exp(-t * 6.5);
      const wob = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t);
      b[start + i] += (0.55 * tri(f * wob * t) + 0.3 * Math.sin(2 * Math.PI * f * wob * t)) * env * 0.5;
    }
  }
  // baked slapback for dreaminess (kept in-loop by wrapping)
  const d = Math.floor(0.375 * SR);
  for (let i = 0; i < n; i++) b[i] += 0.28 * b[(i - d + n * 2) % n];
  return norm(b, 0.7);
}
function makeChoir() {
  const n = SR * LOOP_SECS, b = new Float32Array(n);
  const A = [220, 261.63, 293.66, 329.63, 493.88], B = [174.61, 220, 261.63, 329.63, 392];
  for (let i = 0; i < n; i++) {
    const t = i / SR, half = t < LOOP_SECS / 2 ? 0 : 1;
    const local = half ? t - 4 : t;
    const atk = Math.min(1, local / 1.2), rel = Math.min(1, (4 - local) / 1.2);
    const xfade = Math.min(atk, rel);
    const chord = half ? B : A;
    let v = 0;
    for (const f of chord) {
      v += 0.2 * Math.sin(2 * Math.PI * f * t + 1.2 * Math.sin(2 * Math.PI * 0.5 * t));
      v += 0.08 * Math.sin(2 * Math.PI * f * 2.003 * t);
    }
    v *= 0.35 + 0.65 * xfade;
    b[i] += v;
  }
  return norm(b, 0.7);
}
function makeStatic() {
  const n = SR * LOOP_SECS, b = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const white = Math.random() * 2 - 1;
    lp += 0.06 * (white - lp); // murky lowpass
    const swell = 0.45 + 0.3 * Math.sin(2 * Math.PI * t / LOOP_SECS + 1) + 0.12 * Math.sin(2 * Math.PI * 3 * t / LOOP_SECS);
    b[i] = lp * 2.2 * swell;
  }
  const pings = [[0.5, 880], [2.1, 659.25], [3.4, 987.77], [5.0, 783.99], [6.6, 1046.5]];
  for (const [at, f] of pings) {
    const start = Math.floor(at * SR);
    for (let i = 0; i < SR * 1.4 && start + i < n; i++) {
      const t = i / SR;
      b[start + i] += 0.35 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4);
    }
  }
  return norm(b, 0.65);
}

/* ---------- audio engine ---------- */
let actx = null, masterGain, echoGain, delayNode, hissGain, hissSrc;
let buffers = [];
const deckState = DECKS.map((d, i) => ({
  on: false, rate: store.rates?.[i] ?? d.defRate, vol: store.vols?.[i] ?? d.defVol,
  src: null, gain: null, filter: null, lfo1: null, lfo2: null, lfoG1: null, lfoG2: null,
}));
let master = store.master ?? 0.85, echoAmt = store.echoAmt ?? 0.35, hissAmt = store.hissAmt ?? 0.08;
let powered = false, selected = 0, masterMuted = false;

function buildBuffers() {
  if (buffers.length) return buffers;
  buffers = [makeDrone(), makeArp(), makeChoir(), makeStatic()];
  return buffers;
}
function toAudioBuffer(ch) {
  const ab = actx.createBuffer(1, ch.length, SR);
  ab.getChannelData(0).set(ch);
  return ab;
}

function powerOn() {
  if (powered) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  actx = new AC({ latencyHint: 'interactive' });
  buildBuffers();
  masterGain = actx.createGain(); masterGain.gain.value = masterMuted ? 0 : master;
  const comp = actx.createDynamicsCompressor();
  masterGain.connect(comp); comp.connect(actx.destination);
  // dreamy echo bus
  delayNode = actx.createDelay(2); delayNode.delayTime.value = 0.375;
  const fb = actx.createGain(); fb.gain.value = 0.42;
  const damp = actx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800;
  echoGain = actx.createGain(); echoGain.gain.value = echoAmt;
  delayNode.connect(damp); damp.connect(fb); fb.connect(delayNode);
  delayNode.connect(echoGain); echoGain.connect(masterGain);
  // tape hiss
  const nlen = SR * 2, nz = actx.createBuffer(1, nlen, SR), ch = nz.getChannelData(0);
  let l = 0;
  for (let i = 0; i < nlen; i++) { const w = Math.random() * 2 - 1; l += 0.04 * (w - l); ch[i] = l * 3; }
  hissSrc = actx.createBufferSource(); hissSrc.buffer = nz; hissSrc.loop = true;
  hissGain = actx.createGain(); hissGain.gain.value = hissAmt * 0.5;
  const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  hissSrc.connect(hp); hp.connect(hissGain); hissGain.connect(masterGain);
  hissSrc.start();
  // per-deck chains (sources started lazily on toggle)
  deckState.forEach((d, i) => {
    d.gain = actx.createGain(); d.gain.gain.value = 0;
    d.filter = actx.createBiquadFilter(); d.filter.type = 'lowpass'; d.filter.frequency.value = i === 3 ? 9000 : 4200;
    d.filter.connect(d.gain); d.gain.connect(masterGain); d.gain.connect(delayNode);
  });
  powered = true;
}

function startDeck(i) {
  const d = deckState[i];
  stopSrc(i);
  const src = actx.createBufferSource();
  src.buffer = toAudioBuffer(buffers[i]); src.loop = true;
  src.playbackRate.value = d.rate;
  // wow + flutter: two gentle LFOs on playbackRate
  d.lfo1 = actx.createOscillator(); d.lfo1.frequency.value = 0.6;
  d.lfoG1 = actx.createGain(); d.lfoG1.gain.value = 0.006;
  d.lfo2 = actx.createOscillator(); d.lfo2.frequency.value = 5.1;
  d.lfoG2 = actx.createGain(); d.lfoG2.gain.value = 0.0028;
  d.lfo1.connect(d.lfoG1); d.lfoG1.connect(src.playbackRate);
  d.lfo2.connect(d.lfoG2); d.lfoG2.connect(src.playbackRate);
  src.connect(d.filter);
  const t = actx.currentTime;
  d.gain.gain.cancelScheduledValues(t);
  d.gain.gain.setTargetAtTime(d.vol * 0.9, t, 0.35); // ~1.2s fade in
  src.start(); d.lfo1.start(); d.lfo2.start();
  d.src = src; d.on = true;
}
function stopDeck(i, immediate = false) {
  const d = deckState[i];
  if (!d.src && !d.on) { d.on = false; return; }
  const t = actx.currentTime;
  d.gain.gain.cancelScheduledValues(t);
  d.gain.gain.setTargetAtTime(0, t, immediate ? 0.05 : 0.35); // fade out
  const src = d.src, a = d.lfo1, b = d.lfo2;
  setTimeout(() => { try { src?.stop(); } catch {} try { a?.stop(); } catch {} try { b?.stop(); } catch {} }, immediate ? 300 : 1700);
  d.src = null; d.on = false;
}
function stopSrc(i) { const d = deckState[i]; if (d.src) { try { d.src.stop(); } catch {} try { d.lfo1?.stop(); } catch {} try { d.lfo2?.stop(); } catch {} d.src = null; } }

function ensurePower() {
  if (!powered) powerOn();
  if (actx.state === 'suspended') actx.resume();
}

function toggleDeck(i, ripple = true) {
  ensurePower();
  selected = i;
  const d = deckState[i];
  if (d.on) stopDeck(i); else startDeck(i);
  if (ripple) splash(buoys[i].x, buoys[i].y, DECKS[i].color, d.on ? 0 : 1);
  syncUI(); save();
}
function setRate(i, r, fromSlider = false) {
  r = Math.min(2, Math.max(0.5, r));
  deckState[i].rate = r;
  if (powered && deckState[i].src) deckState[i].src.playbackRate.setTargetAtTime(r, actx.currentTime, 0.03);
  syncDeckUI(i, fromSlider); save();
}
function setVol(i, v, fromSlider = false) {
  v = Math.min(1, Math.max(0, v));
  deckState[i].vol = v;
  if (powered && deckState[i].on) deckState[i].gain.gain.setTargetAtTime(v * 0.9, actx.currentTime, 0.08);
  syncDeckUI(i, fromSlider); save();
}

/* ---------- WAV export (offline render of current mix, 8s) ---------- */
function encodeWAV(interleaved, sr) {
  const buf = new ArrayBuffer(44 + interleaved.length * 2);
  const v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + interleaved.length * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, interleaved.length * 2, true);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
async function exportMix() {
  const btn = document.getElementById('exportBtn'), st = document.getElementById('exportStatus');
  ensurePower(); buildBuffers();
  btn.disabled = true; st.textContent = '▚ rendering 8s of lagoon… hold the wow…';
  try {
    const secs = LOOP_SECS, oc = new OfflineAudioContext(2, secs * SR, SR);
    const mst = oc.createGain(); mst.gain.value = masterMuted ? 0 : master;
    const comp = oc.createDynamicsCompressor(); mst.connect(comp); comp.connect(oc.destination);
    const dl = oc.createDelay(2); dl.delayTime.value = 0.375;
    const fb = oc.createGain(); fb.gain.value = 0.42;
    const damp = oc.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800;
    const wet = oc.createGain(); wet.gain.value = echoAmt;
    dl.connect(damp); damp.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mst);
    deckState.forEach((d, i) => {
      if (!d.on && d.vol <= 0.01) return;
      const ab = oc.createBuffer(1, buffers[i].length, SR);
      ab.getChannelData(0).set(buffers[i]);
      const src = oc.createBufferSource(); src.buffer = ab; src.loop = true; src.playbackRate.value = d.rate;
      const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = i === 3 ? 9000 : 4200;
      const g = oc.createGain();
      const t = oc.currentTime;
      const target = (d.on ? d.vol : 0) * 0.9;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(target, t + 1.2);
      g.gain.setValueAtTime(target, t + secs - 1.2);
      g.gain.linearRampToValueAtTime(0, t + secs);
      src.connect(f); f.connect(g); g.connect(mst); g.connect(dl);
      src.start();
    });
    const rendered = await oc.startRendering();
    const L = rendered.getChannelData(0), R = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : L;
    const inter = new Float32Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { inter[i * 2] = L[i]; inter[i * 2 + 1] = R[i]; }
    const blob = encodeWAV(inter, SR);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tape-loop-lagoon-mix.wav';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    const live = deckState.filter(d => d.on).length;
    st.textContent = `✔ pressed ${secs}s · ${live} tape${live === 1 ? '' : 's'} · tape-loop-lagoon-mix.wav — check downloads`;
  } catch (e) {
    st.textContent = '✕ export drowned: ' + (e?.message || e);
  } finally { btn.disabled = false; }
}

/* ---------- lagoon canvas: water, buoys, ripples ---------- */
const cv = document.getElementById('lagoon'), ctx = cv.getContext('2d');
const cursorTag = document.getElementById('cursorReadout');
let W = 900, H = 420, ripples = [], drops = [], t0 = performance.now();
const cursor = { x: 450, y: 210 };
const buoys = DECKS.map((d, i) => ({ x: 130 + i * 215, y: 210, r: 44, i, dragY: null }));
function fitCanvas() {
  const w = cv.clientWidth || 900;
  const scale = w / 900;
  cv.style.height = Math.round(420 * scale) + 'px';
}
function splash(x, y, color, big = 0) {
  ripples.push({ x, y, r: 6, max: big ? 190 : 120, a: 0.9, color, w: big ? 3 : 2 });
  drops.push({ x, y: y - 4, vy: -(1 + Math.random() * 2), life: 1, color });
  if (ripples.length > 60) ripples.splice(0, ripples.length - 60);
}
function stillWater() { ripples = []; drops = []; }
function draw(now) {
  const t = (now - t0) / 1000;
  W = cv.width; H = cv.height;
  // water body
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d3329'); g.addColorStop(0.55, '#12241d'); g.addColorStop(1, '#0a1410');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // moon streaks
  ctx.save(); ctx.globalAlpha = 0.14;
  for (let k = 0; k < 5; k++) {
    const y = 60 + k * 62 + Math.sin(t * 0.7 + k * 2) * 6;
    ctx.fillStyle = k % 2 ? '#9db35c' : '#d8b93c';
    ctx.fillRect(60 + ((k * 173 + t * 12) % (W - 120)), y, 90 - k * 10, 3);
  }
  ctx.restore();
  // drifting weed lines
  ctx.save(); ctx.strokeStyle = '#3f7a5e55'; ctx.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 18) {
      const y = 90 + k * 46 + Math.sin(x / 90 + t * (0.5 + k * 0.06) + k * 2.4) * 10;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // ripples
  for (const r of ripples) {
    r.r += 1.6; r.a *= 0.985;
    ctx.save(); ctx.globalAlpha = Math.max(0, r.a);
    ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha *= 0.5;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 0.6, r.r * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ripples = ripples.filter(r => r.a > 0.03 && r.r < r.max);
  // splash drops
  for (const p of drops) {
    p.y += p.vy; p.vy += 0.09; p.life *= 0.97;
    ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 6); ctx.restore();
  }
  drops = drops.filter(p => p.life > 0.05);
  // ambient rain ripples
  if (Math.random() < 0.06 && ripples.length < 40) {
    splash(Math.random() * W, 60 + Math.random() * (H - 120), '#9db35c55');
  }
  // buoys (tape floats)
  buoys.forEach((b, i) => {
    const live = deckState[i].on;
    const bob = Math.sin(t * 1.4 + i * 1.8) * 7;
    b.bx = b.x; b.by = b.y + bob;
    // halo
    if (live) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + i);
      ctx.fillStyle = DECKS[i].color;
      ctx.beginPath(); ctx.ellipse(b.x, b.by, b.r + 16, (b.r + 16) * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // float body
    ctx.save();
    ctx.translate(b.x, b.by);
    ctx.fillStyle = '#0c0e0a'; ctx.strokeStyle = live ? DECKS[i].color : '#5a5a48'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // cassette stripes
    ctx.fillStyle = DECKS[i].color;
    for (let s = -2; s <= 2; s++) ctx.fillRect(s * 14 - 3, -6, 6, 12);
    ctx.fillStyle = '#0c0e0a';
    ctx.beginPath(); ctx.arc(-16, 0, 6, 0, Math.PI * 2); ctx.arc(16, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0c0e0a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-16, 0, 6, 0, Math.PI * 2); ctx.arc(16, 0, 6, 0, Math.PI * 2); ctx.stroke();
    // label
    ctx.fillStyle = live ? '#fff' : '#b9b091';
    ctx.font = '700 17px "Special Elite", monospace'; ctx.textAlign = 'center';
    ctx.fillText('TAPE ' + ['I', 'II', 'III', 'IV'][i], 0, -b.r * 0.45 - 12);
    ctx.font = '12px "Special Elite", monospace'; ctx.fillStyle = '#9db35c';
    const st = live ? (deckState[i].rate.toFixed(2) + 'x') : 'asleep — tap!';
    ctx.fillText(st, 0, b.r * 0.45 + 18);
    ctx.restore();
    if (i === selected) {
      ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = '#d8b93c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(b.x, b.by, b.r + 26, (b.r + 26) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  });
  // keyboard splash cursor
  const showCur = document.activeElement === cv;
  ctx.save();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cursor.x - 20, cursor.y); ctx.lineTo(cursor.x - 8, cursor.y);
  ctx.moveTo(cursor.x + 8, cursor.y); ctx.lineTo(cursor.x + 20, cursor.y);
  ctx.moveTo(cursor.x, cursor.y - 20); ctx.lineTo(cursor.x, cursor.y - 8);
  ctx.moveTo(cursor.x, cursor.y + 8); ctx.lineTo(cursor.x, cursor.y + 20);
  ctx.stroke();
  if (!showCur) ctx.globalAlpha = 0.35;
  ctx.restore();
  positionCursorTag();
  requestAnimationFrame(draw);
}
function positionCursorTag() {
  const r = cv.getBoundingClientRect(), h = cv.parentElement.getBoundingClientRect();
  cursorTag.style.display = 'block';
  cursorTag.style.left = (r.left - h.left + (cursor.x / cv.width) * r.width) + 'px';
  cursorTag.style.top = (r.top - h.top + (cursor.y / cv.height) * r.height) + 'px';
}
function nearestBuoy(x, y) {
  let bi = 0, bd = 1e9;
  buoys.forEach((b, i) => { const d = (b.x - x) ** 2 + (b.y - y) ** 2; if (d < bd) { bd = d; bi = i; } });
  return bi;
}
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height };
}
let dragBuoy = -1;
cv.addEventListener('pointerdown', e => {
  cv.focus({ preventScroll: true });
  const p = canvasPos(e);
  const bi = nearestBuoy(p.x, p.y);
  const b = buoys[bi];
  if (Math.hypot(b.x - p.x, b.y - p.y) < 70) { dragBuoy = bi; buoys[bi].dragY = p.y; cv.setPointerCapture(e.pointerId); }
  else { cursor.x = p.x; cursor.y = p.y; splash(p.x, p.y, '#e8dfc8'); toggleDeck(bi); }
});
cv.addEventListener('pointermove', e => {
  if (dragBuoy < 0) return;
  const p = canvasPos(e);
  const dy = buoys[dragBuoy].dragY - p.y; // up = faster
  if (Math.abs(dy) > 4) {
    setRate(dragBuoy, deckState[dragBuoy].rate + dy / 300);
    buoys[dragBuoy].dragY = p.y;
    splash(buoys[dragBuoy].x, buoys[dragBuoy].y, DECKS[dragBuoy].color);
  }
});
cv.addEventListener('pointerup', () => { dragBuoy = -1; });
cv.addEventListener('keydown', e => {
  const step = e.shiftKey ? 40 : 16;
  if (e.key === 'ArrowLeft') { cursor.x = Math.max(10, cursor.x - step); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { cursor.x = Math.min(cv.width - 10, cursor.x + step); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { cursor.y = Math.max(10, cursor.y - step); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { cursor.y = Math.min(cv.height - 10, cursor.y + step); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    splash(cursor.x, cursor.y, '#e8dfc8');
    toggleDeck(nearestBuoy(cursor.x, cursor.y), false);
    splash(buoys[selected].x, buoys[selected].y, DECKS[selected].color, deckState[selected].on ? 0 : 1);
  }
});

/* ---------- deck cards ---------- */
const decksEl = document.getElementById('decks');
const statusLine = document.getElementById('statusLine');
const deckStateLine = document.getElementById('deckStateLine');
const cardRefs = [];

function semis(rate) { return Math.round(12 * Math.log2(rate)); }
function rateLabel(r) {
  const s = semis(r);
  const sign = s > 0 ? '+' : '';
  return `${r.toFixed(2)}x · ${sign}${s} st`;
}
function drawWave(canvas, buf, color, progress) {
  const c = canvas.getContext('2d'), w = canvas.width = canvas.clientWidth * 2 || 300, h = canvas.height = 128;
  c.fillStyle = '#0a0c08'; c.fillRect(0, 0, w, h);
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
  const step = Math.max(1, Math.floor(buf.length / w));
  for (let x = 0; x < w; x++) {
    const v = buf[Math.floor(x / w * buf.length)] || 0;
    const y = h / 2 - v * h * 0.46;
    x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
  if (progress != null) {
    c.fillStyle = '#ffffff22';
    c.fillRect(0, 0, w * progress, h);
    c.fillStyle = color;
    c.fillRect(w * progress - 2, 0, 4, h);
  }
}

function buildCards() {
  buildBuffers();
  DECKS.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'deck'; card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="deck-top"><span class="cassette" aria-hidden="true"></span>
        <h3>${d.name}<small>${d.sub} · key ${i + 1}</small></h3>
        <span class="led" aria-hidden="true"></span></div>
      <div class="deck-body">
        <canvas class="wave" aria-hidden="true"></canvas>
        <div class="deck-btns">
          <button class="toggle" aria-pressed="false">▶ loop it</button>
        </div>
        <label class="ctl">pitch-bend <span class="val pv"></span>
          <input class="pitch" type="range" min="0.5" max="2" step="0.01" value="${deckState[i].rate}"
            aria-label="${d.name} pitch speed, 0.5 to 2 times" /></label>
        <div class="pitch-read" aria-hidden="true"><span>speed</span><span class="semitone ps"></span></div>
        <label class="ctl">fade / volume <span class="val vv"></span>
          <input class="vol" type="range" min="0" max="1" step="0.01" value="${deckState[i].vol}"
            aria-label="${d.name} volume" /></label>
      </div>`;
    decksEl.appendChild(card);
    const refs = {
      card,
      toggle: card.querySelector('.toggle'),
      pitch: card.querySelector('.pitch'),
      vol: card.querySelector('.vol'),
      pv: card.querySelector('.pv'), vv: card.querySelector('.vv'),
      ps: card.querySelector('.ps'), wave: card.querySelector('.wave'),
    };
    refs.toggle.addEventListener('click', () => toggleDeck(i));
    refs.toggle.addEventListener('focus', () => { selected = i; syncUI(); });
    refs.pitch.addEventListener('input', () => { selected = i; setRate(i, parseFloat(refs.pitch.value), true); });
    refs.vol.addEventListener('input', () => { selected = i; setVol(i, parseFloat(refs.vol.value), true); });
    card.addEventListener('pointerdown', () => { selected = i; syncUI(); });
    cardRefs.push(refs);
    drawWave(refs.wave, buffers[i], d.color, 0);
  });
  syncUI();
}

function syncDeckUI(i, fromSlider = false) {
  const r = cardRefs[i]; if (!r) return;
  const d = deckState[i];
  r.card.classList.toggle('live', d.on);
  r.card.classList.toggle('selected', i === selected);
  r.toggle.setAttribute('aria-pressed', String(d.on));
  r.toggle.textContent = d.on ? '■ fade out' : '▶ loop it';
  r.pv.textContent = d.rate.toFixed(2) + 'x';
  r.ps.textContent = rateLabel(d.rate);
  r.vv.textContent = Math.round(d.vol * 100) + '%';
  if (!fromSlider) { r.pitch.value = d.rate; r.vol.value = d.vol; }
  drawWave(r.wave, buffers[i], DECKS[i].color, d.on ? (performance.now() / 8000) % 1 : 0);
}
function syncUI() {
  deckState.forEach((_, i) => syncDeckUI(i));
  const live = deckState.filter(d => d.on).length;
  deckStateLine.textContent = `${live} / 4 tapes rolling`;
  statusLine.innerHTML = !powered
    ? 'lagoon asleep — press power (or hit <kbd>P</kbd>)'
    : live === 0
      ? `awake · ${DECKS[selected].name} selected · tap water or press <kbd>1</kbd>–<kbd>4</kbd>`
      : `rolling: ${deckState.map((d, i) => d.on ? `TAPE ${['I', 'II', 'III', 'IV'][i]} ${d.rate.toFixed(2)}x` : '').filter(Boolean).join(' · ')}`;
  document.getElementById('powerBtn').setAttribute('aria-pressed', String(powered));
  document.getElementById('powerBtn').textContent = powered ? '■ drain the lagoon (power off)' : '▶ power on the lagoon';
}

/* ---------- transport buttons + global keys ---------- */
document.getElementById('powerBtn').addEventListener('click', () => {
  if (!powered) { ensurePower(); announce('lagoon awake. tap a ripple.'); }
  else {
    deckState.forEach((d, i) => { if (d.on) stopDeck(i, true); });
    setTimeout(() => { actx?.close?.(); actx = null; powered = false; syncUI(); }, 350);
  }
  syncUI(); splash(450, 210, '#d8b93c', 1);
});
function announce(msg) { statusLine.textContent = msg; }
document.getElementById('stillBtn').addEventListener('click', stillWater);
document.getElementById('swellBtn').addEventListener('click', () => {
  ensurePower();
  deckState.forEach((d, i) => { if (!d.on) startDeck(i); splash(buoys[i].x, buoys[i].y, DECKS[i].color, 1); });
  syncUI(); save();
});
document.getElementById('drainBtn').addEventListener('click', () => {
  deckState.forEach((d, i) => { if (d.on && powered) stopDeck(i); else d.on = false; });
  stillWater(); syncUI(); save();
});
document.getElementById('exportBtn').addEventListener('click', exportMix);

const masterEl = document.getElementById('masterGain'), echoEl = document.getElementById('echoAmt'), hissEl = document.getElementById('hissAmt');
function paintMixVals() {
  document.getElementById('masterGainVal').textContent = Math.round(master * 100) + '%';
  document.getElementById('echoAmtVal').textContent = Math.round(echoAmt * 100) + '%';
  document.getElementById('hissAmtVal').textContent = Math.round(hissAmt * 100) + '%';
}
masterEl.value = master; echoEl.value = echoAmt; hissEl.value = hissAmt; paintMixVals();
masterEl.addEventListener('input', () => {
  master = parseFloat(masterEl.value); paintMixVals();
  if (powered) masterGain.gain.setTargetAtTime(masterMuted ? 0 : master, actx.currentTime, 0.05);
  save();
});
echoEl.addEventListener('input', () => {
  echoAmt = parseFloat(echoEl.value); paintMixVals();
  if (powered) echoGain.gain.setTargetAtTime(echoAmt, actx.currentTime, 0.05);
  save();
});
hissEl.addEventListener('input', () => {
  hissAmt = parseFloat(hissEl.value); paintMixVals();
  if (powered) hissGain.gain.setTargetAtTime(hissAmt * 0.5, actx.currentTime, 0.05);
  save();
});

const helpBtn = document.getElementById('helpBtn'), helpCard = document.getElementById('helpCard');
function toggleHelp(force) {
  const show = force ?? helpCard.hidden;
  helpCard.hidden = !show;
  helpBtn.setAttribute('aria-expanded', String(show));
}
helpBtn.addEventListener('click', () => toggleHelp());

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) {
    if (e.key === 'Escape') e.target.blur();
    return; // let native slider keys work
  }
  const k = e.key;
  if (k >= '1' && k <= '4') { toggleDeck(Number(k) - 1); e.preventDefault(); }
  else if (k === '0') { document.getElementById('swellBtn').click(); }
  else if (k === '9') { document.getElementById('drainBtn').click(); }
  else if (k === 'c' || k === 'C') { stillWater(); }
  else if (k === 'e' || k === 'E') { exportMix(); }
  else if (k === 'p' || k === 'P') { document.getElementById('powerBtn').click(); }
  else if (k === 'm' || k === 'M') {
    masterMuted = !masterMuted; ensurePower();
    masterGain.gain.setTargetAtTime(masterMuted ? 0 : master, actx.currentTime, 0.05);
    announce(masterMuted ? 'master muted (M to unmute)' : 'master live');
  }
  else if (k === 'h' || k === 'H' || k === '?') { toggleHelp(); }
  else if (k === 'ArrowLeft' && document.activeElement !== cv) { selected = (selected + 3) % 4; syncUI(); e.preventDefault(); }
  else if (k === 'ArrowRight' && document.activeElement !== cv) { selected = (selected + 1) % 4; syncUI(); e.preventDefault(); }
  else if (k === '[' || k === '-') { nudgePitch(-1, e.shiftKey); e.preventDefault(); }
  else if (k === ']' || k === '=') { nudgePitch(1, e.shiftKey); e.preventDefault(); }
  else if (k === ',') { setVol(selected, deckState[selected].vol - 0.05); e.preventDefault(); }
  else if (k === '.') { setVol(selected, deckState[selected].vol + 0.05); e.preventDefault(); }
});
function nudgePitch(dir, fine) {
  // ±1 semitone (fine: 10 cents) on selected deck
  const cur = deckState[selected].rate;
  const ratio = fine ? Math.pow(2, dir * 10 / 1200) : Math.pow(2, dir / 12);
  ensurePower(); selected = selected;
  setRate(selected, cur * ratio);
  splash(buoys[selected].x, buoys[selected].y, DECKS[selected].color);
  announce(`${DECKS[selected].name}: ${rateLabel(deckState[selected].rate)}`);
}

/* ---------- boot ---------- */
buildCards();
fitCanvas();
window.addEventListener('resize', fitCanvas);
setInterval(() => { // keep wave playheads + selection fresh, cheap
  deckState.forEach((d, i) => { if (d.on && cardRefs[i]) drawWave(cardRefs[i].wave, buffers[i], DECKS[i].color, (performance.now() / 8000 + i * 0.25) % 1); });
}, 500);
requestAnimationFrame(draw);
syncUI();
console.log('tape loop lagoon ready — press P, tap water, bend pitch');
