// Echo Garden Oscillator — plant synths, strum polyrhythms, export ambient mixes.
// Plain WebAudio, no deps. Works from file:// . State persists to localStorage.

const MAX_BLOOMS = 12;
const STORE_KEY = 'echo-garden-v1';
const DEGREES = 10; // scale steps (bottom row = 0, top row = 9)

const SCALES = {
  sunny:   { root: 60, steps: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] },
  moody:   { root: 60, steps: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22] },
  strange: { root: 60, steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
};
const LOOP_CHOIR = [4, 3, 5, 6, 7, 8, 5, 4, 3, 7, 6, 8]; // per-bloom polyrhythm assignment
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const $ = (id) => document.getElementById(id);
const garden = $('garden'), bloomsEl = $('blooms'), gridlines = $('gridlines');
const rowsLabel = $('rowsLabel'), hint = $('hint'), toastEl = $('toast');
const playBtn = $('playBtn'), strumBtn = $('strumBtn'), exportBtn = $('exportBtn'), clearBtn = $('clearBtn');
const bpmInput = $('bpm'), bpmVal = $('bpmVal'), scaleSel = $('scaleSel'), waveSel = $('waveSel');
const inspector = $('inspector'), inspNote = $('inspNote'), inspLen = $('inspLen'), inspMeta = $('inspMeta');
const countEl = $('count'), sunBtn = $('sunBtn');

const state = {
  blooms: [],       // {id,x,degree,len,offset,wave}
  bpm: 96,
  scaleKey: 'sunny',
  wave: 'sine',
  playing: false,
  selectedId: null,
  seq: 0,
};

let actx = null, master = null, delaySend = null, delayNode = null;
let schedTimer = null, nextTime = 0, step = 0;
let toastTimer = null, lastPreview = 0;

/* ---------- helpers ---------- */
function midiFor(degree) {
  const s = SCALES[state.scaleKey] || SCALES.sunny;
  return s.root + s.steps[Math.max(0, Math.min(DEGREES - 1, degree))];
}
function freqFor(degree) {
  return 440 * Math.pow(2, (midiFor(degree) - 69) / 12);
}
function noteName(degree) {
  const m = midiFor(degree);
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}
function panFor(x) { return Math.max(-1, Math.min(1, x * 2 - 1)); }
function panLabel(x) {
  const p = panFor(x);
  if (p < -0.35) return 'L' + Math.round(-p * 100);
  if (p > 0.35) return 'R' + Math.round(p * 100);
  return 'C';
}
function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      blooms: state.blooms, bpm: state.bpm, scaleKey: state.scaleKey, wave: state.wave,
    }));
  } catch (_) { /* storage unavailable — garden still plays */ }
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.blooms)) {
      state.blooms = d.blooms.filter(validBloom).slice(0, MAX_BLOOMS);
      state.seq = state.blooms.reduce((m, b) => Math.max(m, b.id || 0), 0);
    }
    if (d.bpm) state.bpm = Math.max(60, Math.min(160, +d.bpm || 96));
    if (SCALES[d.scaleKey]) state.scaleKey = d.scaleKey;
    if (typeof d.wave === 'string') state.wave = d.wave;
  } catch (_) { /* corrupted save — start fresh */ }
}
function validBloom(b) {
  return b && typeof b.x === 'number' && typeof b.degree === 'number'
    && typeof b.len === 'number' && typeof b.wave === 'string';
}

/* ---------- audio engine ---------- */
function ensureCtx() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { toast('WEB AUDIO NOT SUPPORTED HERE ✕'); return null; }
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.8;
  master.connect(actx.destination);
  // dubby feedback delay = the ambient glue
  delayNode = actx.createDelay(2.0);
  delayNode.delayTime.value = stepDur() * 3;
  const fb = actx.createGain(); fb.gain.value = 0.36;
  const dampen = actx.createBiquadFilter(); dampen.type = 'lowpass'; dampen.frequency.value = 2200;
  const wet = actx.createGain(); wet.gain.value = 0.28;
  delaySend = actx.createGain(); delaySend.gain.value = 1;
  delaySend.connect(delayNode);
  delayNode.connect(dampen); dampen.connect(fb); fb.connect(delayNode);
  dampen.connect(wet); wet.connect(master);
  return actx;
}
function stepDur() { return 60 / state.bpm / 4; } // 16th notes

function voice(ctx, dest, delay, freq, pan, wave, when, dur = 1.5, vol = 0.5) {
  const osc = ctx.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  let node = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); node = p;
  }
  osc.connect(g);
  node.connect(dest);
  if (delay) node.connect(delay);
  osc.start(when); osc.stop(when + dur + 0.05);
}

function playBloom(b, when) {
  voice(actx, master, delaySend, freqFor(b.degree), panFor(b.x), b.wave, when);
  const ms = Math.max(0, (when - actx.currentTime) * 1000);
  setTimeout(() => flashBloom(b.id), ms);
}

/* lookahead scheduler — the auto-looping polyrhythm heart */
function schedulerTick() {
  if (!actx || !state.playing) return;
  const ahead = 0.15;
  while (nextTime < actx.currentTime + ahead) {
    for (const b of state.blooms) {
      if ((step + (b.offset || 0)) % b.len === 0) playBloom(b, nextTime);
    }
    nextTime += stepDur();
    step++;
  }
}
function startLoop() {
  if (!ensureCtx()) return;
  if (state.playing) return;
  state.playing = true;
  step = 0;
  nextTime = actx.currentTime + 0.08;
  delayNode.delayTime.value = stepDur() * 3;
  schedTimer = setInterval(schedulerTick, 25);
  playBtn.textContent = '■ STOP LOOP';
}
function stopLoop() {
  state.playing = false;
  clearInterval(schedTimer); schedTimer = null;
  playBtn.textContent = '▶ START LOOP';
}

/* ---------- garden rendering ---------- */
function gardenPos(b) {
  const r = garden.getBoundingClientRect();
  return { left: b.x * r.width, top: (1 - b.degree / (DEGREES - 1)) * r.height };
}
function renderGrid() {
  gridlines.innerHTML = '';
  rowsLabel.innerHTML = '';
  for (let d = DEGREES - 1; d >= 0; d--) {
    const line = document.createElement('i');
    line.style.top = ((1 - d / (DEGREES - 1)) * 100) + '%';
    const tag = document.createElement('b');
    tag.textContent = noteName(d);
    line.appendChild(tag);
    gridlines.appendChild(line);
    const lab = document.createElement('span');
    lab.textContent = noteName(d);
    rowsLabel.appendChild(lab);
  }
}
function bloomEl(b) {
  const el = document.createElement('div');
  el.className = 'bloom plant';
  el.dataset.id = b.id;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `bloom ${noteName(b.degree)}, loop ${b.len} steps. Drag to bend, double-click to dig up.`);
  el.innerHTML = `<div class="petals"><i></i><i></i><i></i><i></i></div>
    <div class="core">${noteName(b.degree)}</div><div class="stem"></div>
    <div class="loopbadge">×${b.len}</div>`;
  setTimeout(() => el.classList.remove('plant'), 500);
  return el;
}
function renderBlooms() {
  bloomsEl.innerHTML = '';
  for (const b of state.blooms) {
    const el = bloomEl(b);
    const p = gardenPos(b);
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
    if (b.id === state.selectedId) el.classList.add('sel');
    bloomsEl.appendChild(el);
  }
  hint.style.display = state.blooms.length ? 'none' : 'block';
  countEl.textContent = `${state.blooms.length}/${MAX_BLOOMS} planted`;
}
function refreshBloomEl(b) {
  const el = bloomsEl.querySelector(`[data-id="${b.id}"]`);
  if (!el) return;
  const p = gardenPos(b);
  el.style.left = p.left + 'px';
  el.style.top = p.top + 'px';
  el.querySelector('.core').textContent = noteName(b.degree);
  el.querySelector('.loopbadge').textContent = '×' + b.len;
  el.classList.toggle('sel', b.id === state.selectedId);
}
function flashBloom(id) {
  const el = bloomsEl.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('hit');
  void el.offsetWidth; // restart animation
  el.classList.add('hit');
}

/* ---------- planting / bending ---------- */
function coordsFromEvent(e) {
  const r = garden.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
  };
}
function degreeFromY(y) {
  return Math.max(0, Math.min(DEGREES - 1, Math.round((1 - y) * (DEGREES - 1))));
}
function preview(b) {
  const now = performance.now();
  if (now - lastPreview < 70) return;
  lastPreview = now;
  if (!ensureCtx()) return;
  voice(actx, master, delaySend, freqFor(b.degree), panFor(b.x), b.wave, actx.currentTime, 0.5, 0.3);
}
function plant(x, y) {
  if (state.blooms.length >= MAX_BLOOMS) { toast(`GARDEN FULL — ${MAX_BLOOMS} BLOOMS MAX`); return; }
  if (!ensureCtx()) return;
  const id = ++state.seq;
  const degree = degreeFromY(y);
  const len = LOOP_CHOIR[(id - 1) % LOOP_CHOIR.length];
  const b = { id, x, degree, len, offset: (id - 1) % len, wave: state.wave };
  state.blooms.push(b);
  state.selectedId = id;
  renderBlooms(); renderInspector(); save();
  voice(actx, master, delaySend, freqFor(degree), panFor(x), b.wave, actx.currentTime, 1.6, 0.55);
  if (!state.playing) startLoop(); // loops auto-run once planted
}
function digUp(id) {
  state.blooms = state.blooms.filter((b) => b.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderBlooms(); renderInspector(); save();
  toast('BLOOM DUG UP ✕');
}

/* drag-to-bend on blooms (pointer capture, works for touch + mouse) */
let drag = null;
bloomsEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.bloom');
  if (!el) return;
  e.preventDefault();
  const id = +el.dataset.id;
  const b = state.blooms.find((bb) => bb.id === id);
  if (!b) return;
  state.selectedId = id;
  renderInspector();
  bloomsEl.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
  el.classList.add('sel');
  ensureCtx();
  drag = { id };
  el.classList.add('dragging');
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
  const move = (ev) => {
    if (!drag || drag.id !== id) return;
    const c = coordsFromEvent(ev);
    b.x = c.x;
    b.degree = degreeFromY(c.y);
    refreshBloomEl(b); renderInspector(); preview(b);
  };
  const up = () => {
    el.classList.remove('dragging');
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    if (drag && drag.id === id) { drag = null; save(); }
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
});
bloomsEl.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.bloom');
  if (el) digUp(+el.dataset.id);
});
/* tap empty soil to plant */
garden.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.bloom')) return;
  const c = coordsFromEvent(e);
  plant(c.x, c.y);
});
/* keyboard: arrows nudge, delete digs, space toggles */
garden.addEventListener('keydown', (e) => {
  const b = state.blooms.find((bb) => bb.id === state.selectedId);
  if (e.key === ' ' && e.target === garden) { e.preventDefault(); togglePlay(); return; }
  if (!b) return;
  const r = garden.getBoundingClientRect();
  const dx = 1 / Math.max(1, r.width / 24), dy = 1 / (DEGREES - 1);
  if (e.key === 'ArrowLeft') { b.x = Math.max(0, b.x - dx); }
  else if (e.key === 'ArrowRight') { b.x = Math.min(1, b.x + dx); }
  else if (e.key === 'ArrowUp') { b.degree = Math.min(DEGREES - 1, b.degree + 1); }
  else if (e.key === 'ArrowDown') { b.degree = Math.max(0, b.degree - 1); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { digUp(b.id); return; }
  else return;
  e.preventDefault();
  refreshBloomEl(b); renderInspector(); preview(b); save();
});

/* ---------- inspector ---------- */
function renderInspector() {
  const b = state.blooms.find((bb) => bb.id === state.selectedId);
  if (!b) { inspector.classList.add('hidden'); return; }
  inspector.classList.remove('hidden');
  inspNote.textContent = noteName(b.degree);
  inspLen.textContent = `${b.len} STEPS`;
  inspMeta.textContent = `pan ${panLabel(b.x)} · ${b.wave} · ${freqFor(b.degree).toFixed(1)}Hz`;
}
$('lenDown').addEventListener('click', () => stepLen(-1));
$('lenUp').addEventListener('click', () => stepLen(1));
function stepLen(d) {
  const b = state.blooms.find((bb) => bb.id === state.selectedId);
  if (!b) return;
  b.len = Math.max(2, Math.min(8, b.len + d));
  b.offset = b.offset % b.len;
  refreshBloomEl(b); renderInspector(); save();
  if (ensureCtx()) voice(actx, master, delaySend, freqFor(b.degree), panFor(b.x), b.wave, actx.currentTime, 0.4, 0.35);
}
$('delBtn').addEventListener('click', () => { if (state.selectedId != null) digUp(state.selectedId); });

/* ---------- transport / strum ---------- */
function togglePlay() {
  if (state.playing) { stopLoop(); }
  else {
    if (!state.blooms.length) { toast('PLANT A BLOOM FIRST ✿'); return; }
    startLoop();
  }
}
playBtn.addEventListener('click', togglePlay);
strumBtn.addEventListener('click', () => {
  if (!state.blooms.length) { toast('NOTHING TO STRUM — PLANT FIRST ✿'); return; }
  if (!ensureCtx()) return;
  const order = [...state.blooms].sort((a, b2) => a.degree - b2.degree);
  const t0 = actx.currentTime + 0.05;
  order.forEach((b, i) => {
    voice(actx, master, delaySend, freqFor(b.degree), panFor(b.x), b.wave, t0 + i * 0.09, 1.8, 0.5);
    setTimeout(() => flashBloom(b.id), 50 + i * 90);
  });
  toast('✿ STRUM ✿');
});
clearBtn.addEventListener('click', () => {
  if (!state.blooms.length) return;
  state.blooms = []; state.selectedId = null;
  stopLoop(); playBtn.textContent = '▶ START LOOP';
  renderBlooms(); renderInspector(); save();
  toast('GARDEN CLEARED — FRESH SOIL');
});
bpmInput.addEventListener('input', () => {
  state.bpm = +bpmInput.value;
  bpmVal.textContent = state.bpm;
  if (delayNode && actx) delayNode.delayTime.value = stepDur() * 3;
  save();
});
scaleSel.addEventListener('change', () => {
  state.scaleKey = scaleSel.value;
  renderGrid(); renderBlooms(); renderInspector(); save();
  toast(`SCALE → ${scaleSel.selectedOptions[0].textContent}`);
});
waveSel.addEventListener('change', () => { state.wave = waveSel.value; save(); });
window.addEventListener('resize', () => renderBlooms());

/* ---------- one-click ambient mix export ---------- */
function encodeWav(buffers, sampleRate) {
  const nCh = buffers.length, len = buffers[0].length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nCh * 2, true); v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true); wstr(36, 'data'); v.setUint32(40, len * nCh * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffers[ch][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}
exportBtn.addEventListener('click', async () => {
  if (!state.blooms.length) { toast('PLANT SOMETHING BEFORE EXPORTING ✿'); return; }
  exportBtn.disabled = true;
  const label = exportBtn.textContent;
  exportBtn.textContent = '… RENDERING …';
  try {
    const sr = 44100;
    const bars = 4, stepsTotal = 16 * bars;
    const sd = stepDur(), dur = stepsTotal * sd + 2.5;
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) throw new Error('no offline audio');
    const oc = new OC(2, Math.ceil(sr * dur), sr);
    const om = oc.createGain(); om.gain.value = 0.8; om.connect(oc.destination);
    const od = oc.createDelay(2.0); od.delayTime.value = sd * 3;
    const fb = oc.createGain(); fb.gain.value = 0.36;
    const wet = oc.createGain(); wet.gain.value = 0.28;
    const ds = oc.createGain();
    ds.connect(od); od.connect(fb); fb.connect(od); od.connect(wet); wet.connect(om);
    const osend = oc.createGain(); osend.gain.value = 1;
    // deterministic replay of the live polyrhythm
    for (let s = 0; s < stepsTotal; s++) {
      const t = s * sd + 0.05;
      for (const b of state.blooms) {
        if ((s + (b.offset || 0)) % b.len === 0) {
          voice(oc, om, osend, freqFor(b.degree), panFor(b.x), b.wave, t);
        }
      }
    }
    // closing strum flourish
    const order = [...state.blooms].sort((a, b2) => a.degree - b2.degree);
    order.forEach((b, i) => voice(oc, om, osend, freqFor(b.degree), panFor(b.x), b.wave, stepsTotal * sd + 0.1 + i * 0.12, 2.2, 0.4));
    osend.connect(od);
    const rendered = await oc.startRendering();
    const blob = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], sr);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'echo-garden-mix.wav';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('MIX EXPORTED ⤓ echo-garden-mix.wav');
  } catch (err) {
    toast('EXPORT FAILED ✕');
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = label;
  }
});

/* ---------- easter egg: MIDNIGHT GARDEN ---------- */
// Click the sun 5× (or type "echo") → midnight palette + secret arpeggio.
let sunClicks = [], midnight = false, typed = '';
function secretArp() {
  if (!ensureCtx()) return;
  const seq = [9, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9, 12].slice(0, 12);
  const t0 = actx.currentTime + 0.05;
  seq.forEach((d, i) => {
    const deg = Math.max(0, Math.min(9, d > 9 ? 9 : d));
    voice(actx, master, delaySend, freqFor(deg), -0.6 + (i / (seq.length - 1)) * 1.2, 'sine', t0 + i * 0.14, 1.2, 0.4);
  });
}
function toggleMidnight() {
  midnight = !midnight;
  document.body.classList.toggle('midnight', midnight);
  secretArp();
  toast(midnight ? '🌙 MIDNIGHT GARDEN UNLOCKED 🌙' : '☀ BACK TO DAYLIGHT ☀');
}
sunBtn.addEventListener('click', () => {
  const now = Date.now();
  sunClicks = sunClicks.filter((t) => now - t < 2500);
  sunClicks.push(now);
  if (sunClicks.length >= 5) { sunClicks = []; toggleMidnight(); }
});
window.addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-4);
  if (typed === 'echo') { typed = ''; toggleMidnight(); }
});

/* ---------- boot ---------- */
load();
bpmInput.value = state.bpm; bpmVal.textContent = state.bpm;
scaleSel.value = state.scaleKey; waveSel.value = state.wave;
renderGrid(); renderBlooms(); renderInspector();
console.log('echo garden ready — tap the soil ✿');
