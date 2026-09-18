// Fader Fern Playground — vaporwave generative jungle.
// 100% WebAudio synthesis, zero assets. 4-bar / 64-step loop, live faders, seed grooves.
'use strict';

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const toastEl = $('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.textContent = ''; }, 3400);
}
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
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
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PENTA = [0, 3, 5, 7, 10, 12, 15];

/* ---------- state ---------- */
const STEPS = 64; // 4 bars x 16 sixteenths
const store = { load() { try { return JSON.parse(localStorage.getItem('fader-fern-v1') || '{}'); } catch { return {}; } }, save(s) { try { localStorage.setItem('fader-fern-v1', JSON.stringify(s)); } catch {} } };
const saved = store.load();

const S = {
  seed: (saved.seed || 'MIST-1984').toUpperCase().slice(0, 24),
  bpm: saved.bpm ?? 96,
  swing: saved.swing ?? 12,
  delayTime: saved.delayTime ?? 0.32,
  feedback: saved.feedback ?? 38,
  wet: saved.wet ?? 30,
  cutoff: saved.cutoff ?? 5200,
  resonance: saved.resonance ?? 1.2,
  volume: saved.volume ?? 80,
  click: saved.click ?? true,
  pattern: Array.isArray(saved.pattern) && saved.pattern.length === STEPS ? saved.pattern : [],
  root: 57, // A3 default, retuned per seed
};
if (!S.pattern.length) S.pattern = Array.from({ length: STEPS }, () => []);
function persist() {
  store.save({ seed: S.seed, bpm: S.bpm, swing: S.swing, delayTime: S.delayTime, feedback: S.feedback, wet: S.wet, cutoff: S.cutoff, resonance: S.resonance, volume: S.volume, click: S.click, pattern: S.pattern });
}

/* ---------- audio engine ---------- */
const A = {
  ctx: null, bus: null, filter: null, dry: null, delay: null, fb: null,
  wetGain: null, master: null, comp: null, noiseBuf: null, verb: null, verbGain: null, ready: false,
};
function ensureAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { toast('WebAudio not supported in this browser'); return false; }
  const ctx = new Ctx();
  A.ctx = ctx;
  A.bus = ctx.createGain(); A.bus.gain.value = 1;
  A.filter = ctx.createBiquadFilter(); A.filter.type = 'lowpass';
  A.filter.frequency.value = S.cutoff; A.filter.Q.value = S.resonance;
  A.dry = ctx.createGain(); A.dry.gain.value = 1;
  A.delay = ctx.createDelay(1.5); A.delay.delayTime.value = S.delayTime;
  A.fb = ctx.createGain(); A.fb.gain.value = S.feedback / 100;
  A.wetGain = ctx.createGain(); A.wetGain.gain.value = S.wet / 100;
  A.master = ctx.createGain(); A.master.gain.value = S.volume / 100;
  A.comp = ctx.createDynamicsCompressor();
  A.comp.threshold.value = -18; A.comp.ratio.value = 6;
  // routing: bus -> filter -> dry -> master -> comp -> out
  //                 filter -> delay -> wet -> master ; delay -> fb -> delay
  A.bus.connect(A.filter); A.filter.connect(A.dry); A.dry.connect(A.master);
  A.filter.connect(A.delay); A.delay.connect(A.fb); A.fb.connect(A.delay);
  A.delay.connect(A.wetGain); A.wetGain.connect(A.master);
  A.master.connect(A.comp); A.comp.connect(ctx.destination);
  // generated noise buffer
  const len = ctx.sampleRate * 1.2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noiseBuf = buf;
  // generated mist reverb (small convolver)
  try {
    const irLen = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.4) * 0.5; }
    A.verb = ctx.createConvolver(); A.verb.buffer = ir;
    A.verbGain = ctx.createGain(); A.verbGain.gain.value = 0.22;
    A.filter.connect(A.verb); A.verb.connect(A.verbGain); A.verbGain.connect(A.master);
  } catch { /* reverb optional */ }
  A.ready = true;
  applyFaders(true);
  return true;
}
function applyFaders(silent) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  A.delay.delayTime.setTargetAtTime(S.delayTime, t, 0.03);
  A.fb.gain.setTargetAtTime(Math.min(0.85, S.feedback / 100), t, 0.03);
  A.wetGain.gain.setTargetAtTime(S.wet / 100, t, 0.03);
  A.filter.frequency.setTargetAtTime(S.cutoff, t, 0.03);
  A.filter.Q.setTargetAtTime(S.resonance, t, 0.03);
  A.master.gain.setTargetAtTime(S.volume / 100, t, 0.03);
  if (!silent) persist();
}

/* ---------- voices (all synthesized) ---------- */
function env(g, t, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
}
function osc(type, freq, t, dur, peak = 0.5, dest) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  env(g, t, peak, dur);
  o.connect(g); g.connect(dest || A.bus);
  o.start(t); o.stop(t + dur + 0.05);
  return { o, g };
}
function noise(t, dur, peak, filterType, freq, q = 1, dest) {
  const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, peak, dur);
  src.connect(f); f.connect(g); g.connect(dest || A.bus);
  src.start(t); src.stop(t + dur + 0.05);
}
function degreeToMidi(deg) { return S.root + 12 + PENTA[((deg % PENTA.length) + PENTA.length) % PENTA.length]; }

const VOICES = [
  { name: 'Palm Kick', sub: 'sub thump', hue: 320, play(t) {
      osc('sine', 150, t, 0.32, 0.9); osc('sine', 44, t, 0.4, 0.8);
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
      env(g, t, 0.9, 0.3); o.connect(g); g.connect(A.bus); o.start(t); o.stop(t + 0.4);
      noise(t, 0.03, 0.25, 'highpass', 4000);
  } },
  { name: 'Mist Snare', sub: 'vapor crack', hue: 25, play(t) {
      noise(t, 0.18, 0.55, 'bandpass', 1900, 0.8); osc('triangle', 190, t, 0.12, 0.4);
  } },
  { name: 'Chrome Hat', sub: 'laser ticks', hue: 55, play(t, o = {}) {
      const open = o.open ? 0.32 : 0.07;
      noise(t, open, o.open ? 0.3 : 0.34, 'highpass', 7500);
      osc('square', 8900, t, 0.03, 0.06); osc('square', 11900, t, 0.025, 0.05);
  } },
  { name: 'Lagoon Bass', sub: 'deep current', hue: 160, play(t, o = {}) {
      const f = midi(o.midi ?? degreeToMidi(0));
      const ctx = A.ctx, v = ctx.createOscillator(), v2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      v.type = 'sawtooth'; v2.type = 'sine'; v.frequency.value = f; v2.frequency.value = f / 2;
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(220, t + 0.28); fl.Q.value = 4;
      env(g, t, 0.6, 0.42); v.connect(fl); v2.connect(fl); fl.connect(g); g.connect(A.bus);
      v.start(t); v2.start(t); v.stop(t + 0.5); v2.stop(t + 0.5);
  } },
  { name: 'Neon Pluck', sub: 'chrome melody', hue: 190, play(t, o = {}) {
      const f = midi(o.midi ?? degreeToMidi(2));
      osc('triangle', f, t, 0.5, 0.5); osc('sine', f * 2, t, 0.3, 0.18); osc('sawtooth', f, t, 0.22, 0.1);
  } },
  { name: 'VHS Pad', sub: 'slow vignette', hue: 275, play(t, o = {}) {
      const base = o.midi ?? degreeToMidi(4);
      [0, 3, 5].forEach((iv, i) => {
        const f = midi(base + iv);
        const ctx = A.ctx, v = ctx.createOscillator(), g = ctx.createGain();
        v.type = 'sawtooth'; v.frequency.value = f; v.detune.value = i * 7 - 7;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.25 + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        v.connect(fl); fl.connect(g); g.connect(A.bus); v.start(t); v.stop(t + 1.5);
      });
  } },
  { name: 'Glass Frog', sub: 'bell ribbit', hue: 0, play(t, o = {}) {
      const f = midi(o.midi ?? degreeToMidi(5));
      osc('sine', f, t, 0.7, 0.42); osc('sine', f * 2.76, t, 0.4, 0.12); osc('sine', f * 5.4, t, 0.2, 0.05);
  } },
];

/* ---------- fern grove UI ---------- */
function fernSVG(hue, variant) {
  const leaf = (y, len, bend, w) =>
    `<path d="M50 ${y} Q ${50 - len} ${y - bend} ${50 - len * 1.7} ${y - bend * 2.1}" fill="none" stroke="hsl(${hue},95%,62%)" stroke-width="${w}" stroke-linecap="round" opacity=".92"/>` +
    `<path d="M50 ${y} Q ${50 + len} ${y - bend} ${50 + len * 1.7} ${y - bend * 2.1}" fill="none" stroke="hsl(${(hue + 24) % 360},95%,66%)" stroke-width="${w}" stroke-linecap="round" opacity=".92"/>`;
  let leaves = '';
  const rows = [[86, 26, 4, 3.4], [74, 31, 7, 3.2], [62, 34, 10, 3], [50, 33, 13, 2.8], [38, 29, 15, 2.5], [27, 23, 16, 2.2]];
  rows.forEach(([y, l, b, w], i) => { leaves += leaf(y, l + (variant * 2) - i, b, w); });
  return `<svg viewBox="0 0 100 96" aria-hidden="true">
    <path d="M50 92 Q ${48 + variant} 60 50 12" fill="none" stroke="hsl(${hue},90%,55%)" stroke-width="3.6" stroke-linecap="round"/>
    ${leaves}
    <circle cx="50" cy="10" r="3.4" fill="hsl(${hue},100%,72%)"/>
  </svg>`;
}
const fernsEl = $('ferns');
VOICES.forEach((v, i) => {
  const b = document.createElement('button');
  b.className = 'fern'; b.style.setProperty('--hue', v.hue);
  b.innerHTML = `${fernSVG(v.hue, i % 3)}<span class="fname">${v.name}<span class="key">${i + 1}</span></span><span class="fsub">${v.sub}</span>`;
  b.setAttribute('aria-label', `Pluck ${v.name}`);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); pluck(i, b); });
  fernsEl.appendChild(b);
});
function spores(el, hue) {
  for (let k = 0; k < 7; k++) {
    const s = document.createElement('span');
    s.className = 'spore'; s.style.setProperty('--hue', hue);
    s.style.setProperty('--dx', `${(Math.random() * 90 - 45).toFixed(0)}px`);
    s.style.left = `${20 + Math.random() * 60}%`; s.style.top = '30%';
    el.appendChild(s); setTimeout(() => s.remove(), 850);
  }
}

/* ---------- loop: 64 steps ---------- */
const stepsEl = $('steps'), stepCells = [];
for (let i = 0; i < STEPS; i++) {
  const c = document.createElement('div');
  c.className = 'step' + (i % 16 === 0 ? ' barline' : '');
  stepsEl.appendChild(c); stepCells.push(c);
}
function renderPattern() {
  for (let i = 0; i < STEPS; i++) {
    const ev = S.pattern[i];
    stepCells[i].className = 'step' + (i % 16 === 0 ? ' barline' : '') + (ev.length ? ` hit k${(ev[0].v % 7) + 1}` : '');
    stepCells[i].title = ev.length ? `step ${i + 1}: ${ev.map((e) => VOICES[e.v].name).join(', ')}` : `step ${i + 1}`;
  }
}
function clearLoop() { S.pattern = Array.from({ length: STEPS }, () => []); renderPattern(); persist(); toast('loop cleared — the mist forgets'); }

const loop = { playing: false, rec: false, step: 0, nextTime: 0, timer: 0, startStamp: 0 };
const stepDur = () => 60 / S.bpm / 4;
function cursStep() {
  if (!loop.playing || !A.ctx) return loop.step;
  const el = (A.ctx.currentTime - loop.startStamp) / stepDur();
  return ((Math.floor(el) % STEPS) + STEPS) % STEPS;
}
function schedule() {
  if (!A.ctx) return;
  const ahead = 0.15;
  while (loop.nextTime < A.ctx.currentTime + ahead) {
    const s = loop.step, t = loop.nextTime;
    const swingShift = (s % 2 === 1) ? (S.swing / 100) * stepDur() * 0.9 : 0;
    const tt = t + swingShift;
    for (const ev of S.pattern[s]) { try { VOICES[ev.v].play(tt, ev); } catch {} }
    if (S.click && s % 4 === 0) { try { osc('sine', s % 16 === 0 ? 1560 : 1040, tt, 0.05, 0.12); } catch {} }
    const delayMs = Math.max(0, (tt - A.ctx.currentTime) * 1000);
    setTimeout(((ss) => () => paintStep(ss))(s), delayMs);
    loop.nextTime += stepDur();
    loop.step = (loop.step + 1) % STEPS;
  }
}
function paintStep(s) {
  stepCells.forEach((c, i) => c.classList.toggle('now', i === s));
  $('loopProg').style.width = `${((s + 1) / STEPS) * 100}%`;
  $('barLabel').textContent = `BAR ${Math.floor(s / 16) + 1}/4 · STEP ${(s % 16) + 1}`;
}
function setPlaying(on) {
  const playBtn = $('playBtn');
  if (on && !A.ctx) return;
  loop.playing = on;
  playBtn.classList.toggle('playing', on);
  playBtn.textContent = on ? '❚❚ stop loop' : '▶ play 4-bar loop';
  if (on) {
    loop.step = 0; loop.nextTime = A.ctx.currentTime + 0.08; loop.startStamp = loop.nextTime;
    loop.timer = setInterval(schedule, 25);
    $('loopStatus').textContent = loop.rec ? '● recording — pluck ferns to layer' : 'playing 4-bar loop — pluck to jam';
  } else {
    clearInterval(loop.timer);
    stepCells.forEach((c) => c.classList.remove('now'));
    $('loopProg').style.width = '0%'; $('barLabel').textContent = 'BAR –/4';
    $('loopStatus').textContent = 'loop idle — press play, then pluck ferns';
    if (loop.rec) setRec(false);
  }
}
function setRec(on) {
  loop.rec = on;
  $('recBtn').classList.toggle('armed', on);
  $('recBtn').textContent = on ? '● rec…' : '● record';
  if (on && !loop.playing) setPlaying(true);
  else $('loopStatus').textContent = on ? '● recording — pluck ferns to layer' : (loop.playing ? 'playing 4-bar loop — pluck to jam' : 'loop idle — press play, then pluck ferns');
}

/* ---------- pluck ---------- */
function pluck(i, btn) {
  if (!ensureAudio()) return;
  const t = A.ctx.currentTime + 0.01;
  const deg = Math.floor(Math.random() * PENTA.length);
  const ev = { v: i, midi: [3, 4, 5, 6].includes(i) ? degreeToMidi(deg) : undefined, ...(i === 2 ? { open: Math.random() < 0.25 } : {}) };
  try { VOICES[i].play(t, ev); } catch (err) { toast('audio hiccup — try again'); return; }
  const el = btn || fernsEl.children[i];
  el.classList.remove('plucked'); void el.offsetWidth; el.classList.add('plucked');
  spores(el, VOICES[i].hue);
  if (loop.playing && loop.rec) {
    const s = cursStep();
    S.pattern[s] = [...S.pattern[s], ev].slice(-4);
    renderPattern(); persist();
  }
}

/* ---------- groove seeds ---------- */
function applySeed(newSeed, regen = true) {
  S.seed = (newSeed || 'MIST').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24) || 'MIST';
  $('seedInput').value = S.seed;
  const rng = mulberry32(hashSeed(S.seed));
  S.root = 45 + Math.floor(rng() * 12); // F2..E3
  $('scaleName').textContent = `${NOTE_NAMES[S.root % 12]} minor pentatonic mist · ${S.seed}`;
  if (regen) {
    const pat = Array.from({ length: STEPS }, () => []);
    const put = (s, v, midiN) => { pat[s].push({ v, ...(midiN !== undefined ? { midi: midiN } : {}) }); };
    // kick four-on-floor-ish with seed skips
    for (let b = 0; b < 4; b++) for (let q = 0; q < 4; q++) if (rng() < 0.86) put(b * 16 + q * 4, 0);
    if (rng() < 0.7) put(Math.floor(rng() * 64), 0);
    // snare backbeat + ghost
    for (let b = 0; b < 4; b++) { put(b * 16 + 4, 1); put(b * 16 + 12, 1); }
    if (rng() < 0.6) put(Math.floor(rng() * 64), 1);
    // hats
    for (let s = 0; s < 64; s += 2) if (rng() < (s % 4 === 2 ? 0.9 : 0.55)) pat[s].push({ v: 2, open: rng() < 0.15 });
    // bass line
    const riff = Array.from({ length: 8 }, () => Math.floor(rng() * 5));
    for (let b = 0; b < 4; b++) riff.forEach((dg, k) => { const s = b * 16 + [0, 3, 6, 10, 12, 14][k % 6]; if (rng() < 0.75) put(s, 3, degreeToMidi(dg)); });
    // pluck melody
    const nMel = 4 + Math.floor(rng() * 5);
    for (let k = 0; k < nMel; k++) put(Math.floor(rng() * 64), 4, degreeToMidi(Math.floor(rng() * 7)));
    // pad at bar starts
    for (let b = 0; b < 4; b++) if (rng() < 0.8) put(b * 16, 5, degreeToMidi([0, 2, 4, 1][b]));
    // frog accents
    const nFrog = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < nFrog; k++) put(Math.floor(rng() * 64), 6, degreeToMidi(3 + Math.floor(rng() * 4)));
    // fix hat entries possibly doubled by the put above
    for (let s = 0; s < 64; s++) { const hs = pat[s].filter((e) => e.v === 2); if (hs.length > 1) pat[s] = pat[s].filter((e) => e.v !== 2).concat(hs.slice(0, 1)); }
    S.pattern = pat;
    renderPattern(); persist();
  }
  return S.seed;
}
function randomSeed() {
  const words = ['MIST', 'NEON', 'PALM', 'VHS', 'CORAL', 'GRID', 'LAGOON', 'CHROME', 'FERN', 'ULTRA'];
  const w = words[Math.floor(Math.random() * words.length)];
  applySeed(`${w}-${Math.floor(1000 + Math.random() * 9000)}`);
  toast(`groove seed ${S.seed} grown — play the loop`);
}

/* ---------- controls ---------- */
function bindCtl(id, fn) {
  const el = $(id);
  el.addEventListener('input', () => fn(parseFloat(el.value)));
  return el;
}
function syncCtl() {
  $('bpm').value = S.bpm; $('bpmVal').textContent = S.bpm;
  $('swing').value = S.swing; $('swingVal').textContent = `${S.swing}%`;
  $('delayTime').value = S.delayTime; $('delayTimeVal').textContent = `${Number(S.delayTime).toFixed(2)}s`;
  $('feedback').value = S.feedback; $('feedbackVal').textContent = `${S.feedback}%`;
  $('wet').value = S.wet; $('wetVal').textContent = `${S.wet}%`;
  $('cutoff').value = S.cutoff; $('cutoffVal').textContent = `${S.cutoff}Hz`;
  $('resonance').value = S.resonance; $('resonanceVal').textContent = `${S.resonance}`;
  $('volume').value = S.volume; $('volumeVal').textContent = `${S.volume}%`;
  $('clickBtn').classList.toggle('on', S.click);
  $('clickBtn').setAttribute('aria-pressed', String(S.click));
}
bindCtl('bpm', (v) => { S.bpm = Math.round(v); $('bpmVal').textContent = S.bpm; persist(); });
bindCtl('swing', (v) => { S.swing = Math.round(v); $('swingVal').textContent = `${S.swing}%`; persist(); });
bindCtl('delayTime', (v) => { S.delayTime = v; $('delayTimeVal').textContent = `${v.toFixed(2)}s`; applyFaders(); });
bindCtl('feedback', (v) => { S.feedback = Math.round(v); $('feedbackVal').textContent = `${S.feedback}%`; applyFaders(); });
bindCtl('wet', (v) => { S.wet = Math.round(v); $('wetVal').textContent = `${S.wet}%`; applyFaders(); });
bindCtl('cutoff', (v) => { S.cutoff = Math.round(v); $('cutoffVal').textContent = `${S.cutoff}Hz`; applyFaders(); });
bindCtl('resonance', (v) => { S.resonance = v; $('resonanceVal').textContent = `${v}`; applyFaders(); });
bindCtl('volume', (v) => { S.volume = Math.round(v); $('volumeVal').textContent = `${S.volume}%`; applyFaders(); });

$('audioBtn').addEventListener('click', () => {
  if (!ensureAudio()) return;
  $('audioBtn').textContent = '♪ sound on';
  for (const id of ['playBtn', 'recBtn', 'clearBtn']) $(id).disabled = false;
  toast('sound enabled — pluck a fern');
  pluck(4, fernsEl.children[4]);
});
$('playBtn').addEventListener('click', () => setPlaying(!loop.playing));
$('recBtn').addEventListener('click', () => setRec(!loop.rec));
$('clearBtn').addEventListener('click', clearLoop);
$('clickBtn').addEventListener('click', () => { S.click = !S.click; syncCtl(); persist(); });
$('diceBtn').addEventListener('click', randomSeed);
$('seedInput').addEventListener('change', (e) => { applySeed(e.target.value); toast(`groove seed ${S.seed} grown — play the loop`); });

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (e.target === $('seedInput')) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '7') pluck(Number(k) - 1);
  else if (k === ' ') { e.preventDefault(); if (!$('playBtn').disabled) setPlaying(!loop.playing); }
  else if (k === 'r') { if (!$('recBtn').disabled) setRec(!loop.rec); }
  else if (k === 'x') clearLoop();
  else if (k === 'n') randomSeed();
});

/* ---------- vaporwave backdrop ---------- */
(function backdrop() {
  const cv = $('bg'), g = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, stars = [], motes = [];
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(140, W / 9) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.55, r: Math.random() * 1.6 + 0.3, p: Math.random() * 6.28 }));
    motes = Array.from({ length: Math.min(46, W / 28) }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.4, v: 0.2 + Math.random() * 0.5, h: [320, 190, 160, 55][Math.floor(Math.random() * 4)] }));
  }
  size(); addEventListener('resize', size);
  let t = 0;
  function frame() {
    t += 0.016;
    g.clearRect(0, 0, W, H);
    for (const s of stars) { g.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + s.p); g.fillStyle = '#cfe9ff'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.29); g.fill(); }
    g.globalAlpha = 1;
    // horizon glow
    const hz = H * 0.62;
    const glow = g.createLinearGradient(0, hz - 120, 0, hz + 40);
    glow.addColorStop(0, 'rgba(255,46,136,0)'); glow.addColorStop(1, 'rgba(255,46,136,.28)');
    g.fillStyle = glow; g.fillRect(0, hz - 120, W, 160);
    // perspective grid
    g.strokeStyle = 'rgba(1,205,254,.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, hz); g.lineTo(W, hz); g.stroke();
    for (let i = -12; i <= 12; i++) { g.strokeStyle = 'rgba(1,205,254,.28)'; g.beginPath(); g.moveTo(W / 2 + i * 26, hz); g.lineTo(W / 2 + i * W * 0.11, H); g.stroke(); }
    const off = reduced ? 0 : (t * 26) % 30;
    for (let y = hz, k = 0; y < H; y += 12 + k * 3, k++) { g.strokeStyle = 'rgba(255,113,206,.3)'; g.beginPath(); g.moveTo(0, y + off * (k / 8)); g.lineTo(W, y + off * (k / 8)); g.stroke(); }
    // drifting spores
    for (const m of motes) {
      if (!reduced) { m.y -= m.v; if (m.y < -8) { m.y = H + 8; m.x = Math.random() * W; } }
      g.fillStyle = `hsla(${m.h},95%,68%,.8)`; g.shadowColor = `hsl(${m.h},95%,60%)`; g.shadowBlur = 10;
      g.beginPath(); g.arc(m.x, m.y, m.s, 0, 6.29); g.fill(); g.shadowBlur = 0;
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  frame();
})();

/* ---------- init ---------- */
$('seedInput').value = S.seed;
syncCtl();
applySeed(S.seed, !S.pattern.some((r) => r.length));
renderPattern();
if (S.pattern.some((r) => r.length)) $('scaleName').textContent = `${NOTE_NAMES[S.root % 12]} minor pentatonic mist · ${S.seed}`;
