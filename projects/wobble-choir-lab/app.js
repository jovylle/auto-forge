// Wobble Choir Lab — drag blobs, morph vowels, loop 4 bars, record.
// Plain WebAudio, no deps. Works from file://.
'use strict';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), threads = $('threads'), nowSinging = $('nowSinging');
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]); // quantize: pleasant, never wrong
// Formant triplets (F1,F2,F3 Hz) per vowel ア エ イ オ ウ
const FORMANTS = [
  [730, 1090, 2440],  // A
  [530, 1840, 2480],  // E
  [270, 2290, 3010],  // I
  [570, 840, 2410],   // O
  [300, 870, 2240],   // U
];
const VOWEL_META = [
  ['ア', 'A — 「ア」 open mouth'], ['エ', 'E — 「エ」 smiling teeth'],
  ['イ', 'I — 「イ」 narrow stream'], ['オ', 'O — 「オ」 round well'],
  ['ウ', 'U — 「ウ」 deep bamboo'],
];
const VOICES = [
  { name: 'Sora', kana: 'ソ', color: 'var(--blob-0)', x: 0.22, y: 0.30 },
  { name: 'Kaze', kana: 'カ', color: 'var(--blob-1)', x: 0.50, y: 0.18 },
  { name: 'Mori', kana: 'モ', color: 'var(--blob-2)', x: 0.74, y: 0.38 },
  { name: 'Hoshi', kana: 'ホ', color: 'var(--blob-3)', x: 0.36, y: 0.62 },
  { name: 'Umi',  kana: 'ウ', color: 'var(--blob-4)', x: 0.64, y: 0.74 },
];
const LS_KEY = 'wobble-choir-v1';

// ---------- state ----------
const state = {
  started: false, playing: false, step: 0, bpm: 96,
  vowel: 0, voices: VOICES.map((v) => ({ x: v.x, y: v.y })),
  grid: VOICES.map(() => Array(16).fill(false)),
};
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ vowel: state.vowel, bpm: state.bpm, voices: state.voices, grid: state.grid })); } catch {}
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!s) return;
    if (Array.isArray(s.voices) && s.voices.length === 5) state.voices = s.voices;
    if (typeof s.vowel === 'number') state.vowel = Math.min(4, Math.max(0, s.vowel));
    if (typeof s.bpm === 'number') state.bpm = Math.min(160, Math.max(60, s.bpm));
    if (Array.isArray(s.grid) && s.grid.length === 5) state.grid = s.grid.map((r) => Array.from({ length: 16 }, (_, i) => !!r[i]));
  } catch {}
}

// ---------- pitch math ----------
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const midiName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
function quantizeC(m) {
  let d = Math.round(m);
  for (let k = 0; k < 12; k++) {
    const pc = ((d % 12) + 12) % 12;
    if (C_MAJOR.has(pc)) return d;
    d -= 1;
  }
  return Math.round(m);
}
const voiceMidi = (i) => quantizeC(79 - state.voices[i].y * 31); // top=high, ~G2..G5 quantized

// ---------- audio ----------
let AC = null, bus, air, comp, verb, mediaDest;
let channels = []; // per-voice nodes

function makeImpulse(ctx, sec = 1.8, decay = 2.4) {
  const rate = ctx.sampleRate, len = Math.floor(rate * sec);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  bus = AC.createGain(); bus.gain.value = 0.9;
  air = AC.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 3000; air.Q.value = 0.4;
  comp = AC.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  verb = AC.createConvolver(); verb.buffer = makeImpulse(AC);
  const wet = AC.createGain(); wet.gain.value = 0.35;
  bus.connect(air); air.connect(comp);
  bus.connect(verb); verb.connect(wet); wet.connect(comp);
  mediaDest = AC.createMediaStreamDestination();
  comp.connect(AC.destination); comp.connect(mediaDest);

  channels = VOICES.map((v, i) => {
    const g = AC.createGain(); g.gain.value = 0.0;
    const bright = AC.createBiquadFilter(); bright.type = 'lowpass'; bright.frequency.value = 2500;
    const pans = AC.createStereoPanner ? AC.createStereoPanner() : null;
    const formGains = [], formFilts = [];
    for (let f = 0; f < 3; f++) {
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7; bp.frequency.value = FORMANTS[0][f];
      const fg = AC.createGain(); fg.gain.value = f === 0 ? 1 : 0.5;
      bright.connect(bp); bp.connect(fg); fg.connect(g);
      formFilts.push(bp); formGains.push(fg);
    }
    const o1 = AC.createOscillator(); o1.type = 'sawtooth';
    const o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 5;
    const sub = AC.createOscillator(); sub.type = 'sine';
    const subG = AC.createGain(); subG.gain.value = 0.5;
    const vib = AC.createOscillator(); vib.frequency.value = 5.2 + i * 0.35;
    const vibG = AC.createGain(); vibG.gain.value = 20;
    vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
    o1.connect(bright); o2.connect(bright); sub.connect(subG); subG.connect(bright);
    let tail = g;
    if (pans) { g.connect(pans); tail = pans; pans.pan.value = (i / 4) * 1.2 - 0.6; }
    tail.connect(bus);
    o1.start(); o2.start(); sub.start(); vib.start();
    return { g, bright, o1, o2, sub, vibG, formFilts, formGains };
  });
  applyAllVoices();
  applyVowel(state.vowel);
  // gentle drone in
  const t = AC.currentTime;
  channels.forEach((ch) => { ch.g.gain.setTargetAtTime(0.055, t, 1.2); });
}

function applyVoice(i) {
  const m = voiceMidi(i), f = midiHz(m), ch = channels[i];
  if (!ch || !AC) return;
  const t = AC.currentTime, x = state.voices[i].x;
  [ch.o1, ch.o2, ch.sub].forEach((o, k) => {
    const mult = k === 2 ? 0.5 : 1;
    o.frequency.setTargetAtTime(f * mult, t, 0.06);
  });
  ch.vibG.gain.setTargetAtTime(4 + x * 46, t, 0.1);   // left-right = wobble depth
  ch.bright.frequency.setTargetAtTime(900 + x * 4200, t, 0.1);
  return { m, f };
}

function applyAllVoices() { for (let i = 0; i < 5; i++) applyVoice(i); }

function applyVowel(v) {
  state.vowel = v;
  const i0 = Math.min(3, Math.floor(v)), frac = Math.min(1, v - i0), i1 = Math.min(4, i0 + 1);
  if (AC) {
    const t = AC.currentTime;
    channels.forEach((ch) => {
      for (let f = 0; f < 3; f++) {
        const a = FORMANTS[i0][f], b = FORMANTS[i1][f];
        ch.formFilts[f].frequency.setTargetAtTime(a + (b - a) * frac, t, 0.05);
      }
    });
  }
  // label
  const near = Math.round(v);
  $('vowelKana').textContent = VOWEL_META[near][0];
  $('vowelName').textContent = VOWEL_META[near][1];
  document.querySelectorAll('.vowel-ticks span').forEach((el) => {
    el.classList.toggle('on', +el.dataset.v === near);
  });
}

function pluck(i, vel = 1) {
  if (!AC) return;
  applyVoice(i);
  const t = AC.currentTime, ch = channels[i], base = 0.055;
  ch.g.gain.cancelScheduledValues(t);
  ch.g.gain.setValueAtTime(Math.max(ch.g.gain.value, base), t);
  ch.g.gain.linearRampToValueAtTime(base + 0.22 * vel, t + 0.02);
  ch.g.gain.exponentialRampToValueAtTime(base, t + 0.5);
}

// ---------- blobs (DOM) ----------
const blobEls = [];
function buildBlobs() {
  VOICES.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'blob'; el.tabIndex = 0;
    el.setAttribute('role', 'slider');
    el.dataset.i = i;
    el.style.background = v.color;
    el.innerHTML = `<span><span class="kana">${v.kana}</span><small>${v.name}</small><small class="nn"></small></span>`;
    stage.appendChild(el); blobEls.push(el);
    positionBlob(i); updateBlobLabel(i);

    let dragging = false, sx = 0, sy = 0, moved = 0, downT = 0;
    el.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; downT = performance.now();
      sx = e.clientX; sy = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.animationPlayState = 'paused';
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      state.voices[i].x = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width));
      state.voices[i].y = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));
      positionBlob(i); updateBlobLabel(i);
      if (AC) applyVoice(i);
    });
    const up = (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.animationPlayState = '';
      if (moved < 8 && performance.now() - downT < 400) { // tap = solo blip
        if (AC) { pluck(i, 1); flashSolo(el); }
      }
      save(); refreshNow();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', (e) => {
      const s = 0.04; let used = true;
      if (e.key === 'ArrowUp') state.voices[i].y -= s;
      else if (e.key === 'ArrowDown') state.voices[i].y += s;
      else if (e.key === 'ArrowLeft') state.voices[i].x -= s;
      else if (e.key === 'ArrowRight') state.voices[i].x += s;
      else if (e.key === 'Enter' || e.key === ' ') { if (AC) pluck(i, 1); }
      else used = false;
      if (used) {
        e.preventDefault();
        state.voices[i].x = Math.min(0.97, Math.max(0.03, state.voices[i].x));
        state.voices[i].y = Math.min(0.97, Math.max(0.03, state.voices[i].y));
        positionBlob(i); updateBlobLabel(i);
        if (AC) applyVoice(i);
        save(); refreshNow();
      }
    });
  });
}
function positionBlob(i) {
  blobEls[i].style.left = state.voices[i].x * 100 + '%';
  blobEls[i].style.top = state.voices[i].y * 100 + '%';
}
function updateBlobLabel(i) {
  const m = voiceMidi(i);
  const nn = blobEls[i].querySelector('.nn');
  if (nn) nn.textContent = midiName(m);
  blobEls[i].setAttribute('aria-label', `${VOICES[i].name} voice, note ${midiName(m)}. Arrow keys retune.`);
}
function flashSolo(el) {
  el.classList.add('solo'); setTimeout(() => el.classList.remove('solo'), 450);
}
function refreshNow() {
  if (!state.started) { nowSinging.innerHTML = '— silent — press Begin —'; return; }
  const names = state.voices.map((_, i) => `<strong>${midiName(voiceMidi(i))}</strong>`);
  nowSinging.innerHTML = `now singing — ${names.join(' · ')}${state.playing ? ` &nbsp;|&nbsp; bar ${Math.floor(state.step / 4) + 1}/4` : ''}`;
}

// ---------- threads canvas ----------
let tctx, tparts = [];
function sizeCanvas() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  threads.width = Math.max(1, r.width * dpr); threads.height = Math.max(1, r.height * dpr);
  tctx = threads.getContext('2d'); tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawThreads(t) {
  if (!tctx) return;
  const r = stage.getBoundingClientRect();
  tctx.clearRect(0, 0, r.width, r.height);
  const pts = state.voices.map((v) => ({ x: v.x * r.width, y: v.y * r.height }));
  // ink threads between neighbours
  tctx.lineWidth = 1.2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const wob = Math.sin(t / 700 + i * 1.7) * 14;
    tctx.strokeStyle = 'rgba(28,26,22,.28)';
    tctx.beginPath();
    tctx.moveTo(a.x, a.y);
    tctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + wob, b.x, b.y);
    tctx.stroke();
  }
  // drifting dust (breath of the page)
  if (tparts.length === 0) for (let i = 0; i < 26; i++) tparts.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, p: Math.random() * 6.28 });
  tctx.fillStyle = 'rgba(199,62,29,.35)';
  tparts.forEach((p) => {
    const px = ((p.x + t / 90000 * p.s) % 1) * r.width;
    const py = (p.y * r.height + Math.sin(t / 1200 + p.p) * 8 + r.height) % r.height;
    tctx.beginPath(); tctx.arc(px, py, p.s, 0, 6.29); tctx.fill();
  });
  // playhead glow on active blobs
  if (state.playing && AC) {
    blobEls.forEach((el, i) => {
      el.style.filter = state.grid[i][state.step] ? 'saturate(1.4) brightness(1.1)' : '';
    });
  } else blobEls.forEach((el) => { el.style.filter = ''; });
  requestAnimationFrame(drawThreads);
}

// ---------- sequencer ----------
const cellEls = [];
function buildGrid() {
  const grid = $('grid');
  VOICES.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'grow';
    row.style.gridTemplateColumns = `44px repeat(16, 1fr)`;
    const lab = document.createElement('div');
    lab.className = 'vlabel'; lab.textContent = v.kana; lab.style.background = v.color;
    row.appendChild(lab);
    cellEls[i] = [];
    for (let s = 0; s < 16; s++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell' + (s % 4 === 0 ? ' bar' : '');
      b.setAttribute('aria-label', `${v.name} step ${s + 1}`);
      b.setAttribute('aria-pressed', state.grid[i][s] ? 'true' : 'false');
      if (state.grid[i][s]) b.classList.add('on');
      b.addEventListener('click', () => {
        state.grid[i][s] = !state.grid[i][s];
        b.classList.toggle('on', state.grid[i][s]);
        b.setAttribute('aria-pressed', state.grid[i][s] ? 'true' : 'false');
        if (state.grid[i][s] && AC) pluck(i, 0.8);
        save();
      });
      row.appendChild(b); cellEls[i].push(b);
    }
    grid.appendChild(row);
  });
}
let schedTimer = null, nextTime = 0;
function sixteenth() { return 60 / state.bpm / 4; }
function scheduler() {
  if (!AC) return;
  while (nextTime < AC.currentTime + 0.15) {
    const s = state.step;
    state.grid.forEach((row, i) => { if (row[s]) {
      const ch = channels[i], t = nextTime, base = 0.055;
      applyVoice(i);
      ch.g.gain.cancelScheduledValues(t);
      ch.g.gain.setValueAtTime(base, t);
      ch.g.gain.linearRampToValueAtTime(base + 0.24, t + 0.02);
      ch.g.gain.exponentialRampToValueAtTime(base, t + 0.5);
    }});
    // schedule UI tick
    const stepAt = s, when = (nextTime - AC.currentTime) * 1000;
    setTimeout(() => paintPlayhead(stepAt), Math.max(0, when));
    nextTime += sixteenth();
    state.step = (state.step + 1) % 16;
  }
}
function paintPlayhead(s) {
  cellEls.forEach((row) => row.forEach((c, j) => c.classList.toggle('now', j === s)));
  if (s % 4 === 0) refreshNow();
}
function setPlaying(on) {
  state.playing = on;
  $('playBtn').textContent = on ? '■ Stop jam' : '▶ Play jam';
  if (on) {
    state.step = 0; nextTime = AC.currentTime + 0.06;
    schedTimer = setInterval(scheduler, 25);
  } else {
    clearInterval(schedTimer); schedTimer = null;
    cellEls.forEach((row) => row.forEach((c) => c.classList.remove('now')));
    refreshNow();
  }
}
const PRESETS = {
  still:   [[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0],[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
  festival:[[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0],[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1],[0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]],
  rain:    [[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0],[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0],[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1]],
};
function applyPattern(p) {
  state.grid = p.map((r) => r.slice());
  cellEls.forEach((row, i) => row.forEach((c, j) => {
    c.classList.toggle('on', !!state.grid[i][j]);
    c.setAttribute('aria-pressed', state.grid[i][j] ? 'true' : 'false');
  }));
  save();
}

// ---------- recorder ----------
let rec = null, chunks = [], recStart = 0, recTick = null;
function setRecUI(mode, text) {
  $('recLabel').textContent = text;
  $('recBtn').classList.toggle('armed', mode === 'on');
  $('recStatus').textContent = text === 'Record' ? 'recorder idle' : text;
}
function toggleRecord() {
  if (!AC || !state.started) return;
  if (rec && rec.state === 'recording') {
    rec.stop();
    return;
  }
  chunks = [];
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
  try { rec = new MediaRecorder(mediaDest.stream, mime ? { mimeType: mime } : undefined); }
  catch (e) { $('recStatus').textContent = 'recorder not supported in this browser'; return; }
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    clearInterval(recTick);
    const type = rec.mimeType || 'audio/webm';
    const url = URL.createObjectURL(new Blob(chunks, { type }));
    const dl = $('dl');
    dl.href = url;
    dl.download = `wobble-choir-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${type.includes('mp4') ? 'm4a' : 'webm'}`;
    dl.hidden = false;
    setRecUI('off', 'Record');
    $('recStatus').textContent = `take saved — ${chunks.length} chunks · ${dl.download} · press Download`;
  };
  rec.start(250); recStart = Date.now();
  setRecUI('on', 'Stop ● rec');
  recTick = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    $('recStatus').textContent = `● recording ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} — everything you hear`;
  }, 500);
}

// ---------- scroll: the page breathes ----------
function onScroll() {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight || 1;
  const p = Math.min(1, Math.max(0, h.scrollTop / max));
  $('progress').style.width = p * 100 + '%';
  $('breathFill').style.width = p * 100 + '%';
  $('breathVal').textContent = Math.round(p * 100) + '%';
  if (AC && air) air.frequency.setTargetAtTime(900 + p * 9000, AC.currentTime, 0.2); // scroll = air
  const enso = document.querySelector('.enso');
  if (enso) enso.style.transform = `scale(${1 + p * 0.25}) rotate(${p * 40}deg)`;
  document.body.style.backgroundColor = p > 0.85 ? '#efe8d6' : '';
}

// ---------- wire up ----------
load();
buildBlobs(); buildGrid(); sizeCanvas();
requestAnimationFrame(drawThreads);
window.addEventListener('resize', sizeCanvas);

$('vowel').value = state.vowel;
$('bpm').value = state.bpm; $('bpmVal').textContent = state.bpm;
applyVowel(state.vowel);

$('vowel').addEventListener('input', (e) => { applyVowel(+e.target.value); save(); });
document.querySelectorAll('.vowel-ticks span').forEach((el) => {
  el.addEventListener('click', () => { $('vowel').value = el.dataset.v; applyVowel(+el.dataset.v); save(); });
});
$('bpm').addEventListener('input', (e) => { state.bpm = +e.target.value; $('bpmVal').textContent = state.bpm; save(); });

$('startBtn').addEventListener('click', () => {
  initAudio();
  state.started = true;
  $('playBtn').disabled = false; $('recBtn').disabled = false;
  $('startBtn').textContent = 'Singing — 声が聞こえる';
  $('startBtn').disabled = true;
  refreshNow();
  document.querySelector('#choir-section').scrollIntoView({ behavior: 'smooth' });
});
$('playBtn').addEventListener('click', () => { if (AC) setPlaying(!state.playing); });
$('recBtn').addEventListener('click', toggleRecord);
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPattern(PRESETS[b.dataset.preset])));
document.querySelector('[data-clear]').addEventListener('click', () => applyPattern(VOICES.map(() => Array(16).fill(false))));

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

window.addEventListener('scroll', onScroll, { passive: true });
onScroll(); refreshNow();
console.log('wobble-choir-lab ready');
