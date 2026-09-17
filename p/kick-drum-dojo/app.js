// Kick Drum Dojo — 16-step sequencer · tap trial · synth drums · beat codes · easter egg
const $ = (s) => document.querySelector(s);
const grid = $('#grid'), playBtn = $('#playBtn'), bpmInput = $('#bpm'), bpmOut = $('#bpmOut');
const pad = $('#pad'), trialBtn = $('#trialBtn'), judgeList = $('#judgeList'), meterFill = $('#meterFill');
const scoreLine = $('#scoreLine'), codeOut = $('#codeOut'), copyBtn = $('#copyBtn');
const importForm = $('#importForm'), importInput = $('#importInput');
const beltEl = $('#belt'), toast = $('#toast');

const ROWS = ['kick', 'snare', 'hat'];
const N = 16;
const LS_KEY = 'kdd-state-v1';
let bpm = 112;
let pattern = { kick: new Array(N).fill(false), snare: new Array(N).fill(false), hat: new Array(N).fill(false), sensei: new Array(N).fill(false) };
let senseiMode = false;

/* ---------- WebAudio synth drums ---------- */
let actx = null;
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function noiseBuffer(ctx, dur = 1) {
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let _noise = null;
function kick(t, vol = 1) {
  const ctx = ac();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(1 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.45);
  // click
  const o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o2.type = 'square'; o2.frequency.setValueAtTime(900, t);
  g2.gain.setValueAtTime(0.18 * vol, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  o2.connect(g2).connect(ctx.destination); o2.start(t); o2.stop(t + 0.04);
}
function snare(t, vol = 1) {
  const ctx = ac(); _noise ??= noiseBuffer(ctx);
  const s = ctx.createBufferSource(); s.buffer = _noise;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(f).connect(g).connect(ctx.destination); s.start(t); s.stop(t + 0.2);
  const o = ctx.createOscillator(), g2 = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 190;
  g2.gain.setValueAtTime(0.5 * vol, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2).connect(ctx.destination); o.start(t); o.stop(t + 0.12);
}
function hat(t, vol = 1, open = false) {
  const ctx = ac(); _noise ??= noiseBuffer(ctx);
  const s = ctx.createBufferSource(); s.buffer = _noise;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
  const g = ctx.createGain(); const dur = open ? 0.3 : 0.05;
  g.gain.setValueAtTime(0.28 * vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ctx.destination); s.start(t); s.stop(t + dur + 0.02);
}
function bell(t, vol = 1) { // hidden sensei cowbell-ish
  const ctx = ac();
  [845, 562].forEach((fr) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = fr;
    g.gain.setValueAtTime(0.16 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4);
  });
}
const VOICE = { kick, snare, hat, sensei: bell };

/* ---------- Sequencer scheduler ---------- */
let playing = false, step = 0, lastStep = 0, nextTime = 0, timer = null;
const stepDur = () => 60 / bpm / 4;
function scheduler() {
  const ctx = ac();
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(step, nextTime);
    nextTime += stepDur();
    step = (step + 1) % N;
  }
}
function scheduleStep(s, t) {
  for (const r of ROWS.concat(senseiMode ? ['sensei'] : [])) {
    if (pattern[r][s]) VOICE[r](t);
  }
  const delay = Math.max(0, (t - ac().currentTime) * 1000);
  setTimeout(() => paintHead(s), delay);
}
function paintHead(s) {
  lastStep = s;
  grid.querySelectorAll('.step').forEach((el) => el.classList.remove('now'));
  grid.querySelectorAll(`[data-s="${s}"]`).forEach((el) => el.classList.add('now'));
}
function setPlaying(p) {
  playing = p;
  playBtn.textContent = p ? '■ stop' : '▶ play';
  if (p) { ac(); step = 0; nextTime = ac().currentTime + 0.06; timer = setInterval(scheduler, 25); }
  else { clearInterval(timer); grid.querySelectorAll('.step').forEach((e) => e.classList.remove('now')); }
}

/* ---------- Grid UI ---------- */
function buildGrid() {
  grid.innerHTML = '';
  grid.classList.toggle('sensei-on', senseiMode);
  const rows = ROWS.concat(senseiMode ? ['sensei'] : []);
  document.querySelector('.rowlabels').style.gridTemplateRows = `repeat(${rows.length},44px)`;
  $('#secretLabel').hidden = !senseiMode;
  rows.forEach((r) => {
    for (let s = 0; s < N; s++) {
      const b = document.createElement('button');
      b.className = 'step' + (r === 'kick' ? ' kick' : '') + (pattern[r][s] ? ' on' : '') + (s % 4 === 0 ? ' beat' : '');
      b.dataset.r = r; b.dataset.s = s;
      b.setAttribute('aria-label', `${r} step ${s + 1} ${pattern[r][s] ? 'on' : 'off'}`);
      b.setAttribute('aria-pressed', String(pattern[r][s]));
      b.addEventListener('click', () => {
        pattern[r][s] = !pattern[r][s];
        b.classList.toggle('on', pattern[r][s]);
        b.setAttribute('aria-pressed', String(pattern[r][s]));
        if (pattern[r][s]) { ac(); VOICE[r](ac().currentTime); }
        persist(); encode();
      });
      grid.appendChild(b);
    }
  });
}
function refreshGrid() { buildGrid(); }

/* ---------- Presets ---------- */
const PRESETS = [
  { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: new Array(16).fill(false), hat: new Array(16).fill(true) },          // four floor
  { kick: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map((_,i)=>i===4||i===12), hat: [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0].map(Boolean) }, // boom bap
  { kick: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean), snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean), hat: new Array(16).fill(true) }, // dembow-ish
  { kick: [1,0,0,0,0,0,0,0, 0,0,1,0,0,0,0,0].map(Boolean), snare: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0].map(Boolean), hat: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1].map(Boolean) },     // half-time
];
let kataIdx = 0;

/* ---------- Beat codes ---------- */
function bits(arr) { return parseInt(arr.map((v) => (v ? '1' : '0')).join(''), 2).toString(16).toUpperCase().padStart(4, '0'); }
function unbits(hex) { const b = parseInt(hex, 16).toString(2).padStart(16, '0'); return [...b].map((c) => c === '1'); }
function encode() {
  const code = `KDD-${bits(pattern.kick)}.${bits(pattern.snare)}.${bits(pattern.hat)}@${bpm}${senseiMode && pattern.sensei.some(Boolean) ? '+' + bits(pattern.sensei) : ''}`;
  codeOut.textContent = code;
  history.replaceState(null, '', '#b=' + encodeURIComponent(code));
  return code;
}
function decode(str) {
  const m = String(str).trim().toUpperCase().match(/KDD-([0-9A-F]{4})\.([0-9A-F]{4})\.([0-9A-F]{4})(?:\+([0-9A-F]{4}))?@?(\d{2,3})?/);
  if (!m) return false;
  pattern.kick = unbits(m[1]); pattern.snare = unbits(m[2]); pattern.hat = unbits(m[3]);
  if (m[4]) { enableSensei(true); pattern.sensei = unbits(m[4]); }
  if (m[5]) { bpm = Math.min(180, Math.max(70, +m[5])); bpmInput.value = bpm; bpmOut.textContent = bpm; }
  refreshGrid(); persist(); encode();
  return true;
}

/* ---------- Tap trial (timing score) ---------- */
let trial = null;
function startTrial() {
  if (trial) return;
  ac(); setPlaying(false);
  judgeList.innerHTML = ''; meterFill.style.width = '0%';
  const beats = 8, interval = 60 / bpm;
  const t0 = ac().currentTime + 0.8;
  trial = { beats, hits: [], t0, interval, done: 0, timeouts: [] };
  trialBtn.textContent = 'listening…';
  toastMsg(`8 kicks at ${bpm} BPM — strike on each one`);
  for (let i = 0; i < beats; i++) {
    const t = t0 + i * interval;
    kick(t, 1);
    // flash pad on beat
    const to = setTimeout(() => { pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 120); }, (t - ac().currentTime) * 1000);
    trial.timeouts.push(to);
  }
  const end = setTimeout(finishTrial, (t0 - ac().currentTime) * 1000 + beats * interval * 1000 + 400);
  trial.timeouts.push(end);
}
function strike() {
  pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 110);
  const now = ac ? ac().currentTime : 0;
  // tap-write mode: quantize tap into pattern kick row
  if (tapWriteArmed && playing) { quantizeTap(); return; }
  if (!trial) { kick(ac().currentTime, 1); return; } // free play thump
  const { t0, interval, beats, hits } = trial;
  // find nearest beat index
  const rel = (now - t0) / interval;
  const idx = Math.round(rel);
  if (idx < 0 || idx >= beats || hits.some((h) => h.idx === idx)) return;
  const errMs = Math.round((now - (t0 + idx * interval)) * 1000);
  const a = Math.abs(errMs);
  const grade = a <= 35 ? 'PERFECT' : a <= 80 ? 'GREAT' : a <= 140 ? (errMs < 0 ? 'EARLY' : 'LATE') : 'MISS';
  hits.push({ idx, errMs, grade });
  const li = document.createElement('li');
  li.className = 'j-' + grade.toLowerCase();
  li.innerHTML = `#${idx + 1} — <b>${grade}</b> ${a}ms`;
  judgeList.prepend(li);
  meterFill.style.width = `${(hits.length / beats) * 100}%`;
  if (hits.length >= beats) finishTrial();
}
function finishTrial() {
  if (!trial) return;
  trial.timeouts.forEach(clearTimeout);
  const { hits, beats } = trial;
  const scored = hits.filter((h) => h.grade === 'PERFECT' || h.grade === 'GREAT').length;
  const acc = Math.round((scored / beats) * 100);
  const avg = hits.length ? Math.round(hits.reduce((a, h) => a + Math.abs(h.errMs), 0) / hits.length) : 999;
  scoreLine.textContent = `${acc}% · avg ${avg}ms`;
  awardBelt(acc);
  toastMsg(acc === 100 ? '🥋 flawless. sensei bows.' : acc >= 75 ? `${acc}% — strong stance.` : acc >= 50 ? `${acc}% — keep training.` : `${acc}% — breathe, listen, strike.`);
  trial = null; trialBtn.textContent = 'start trial';
  persist();
}
const BELTS = [[0, 'white belt'], [50, 'yellow belt'], [65, 'green belt'], [80, 'brown belt'], [90, 'black belt']];
function awardBelt(acc) {
  const best = +(localStorage.getItem('kdd-best') || 0);
  if (acc > best) localStorage.setItem('kdd-best', acc);
  const top = Math.max(acc, best);
  const belt = [...BELTS].reverse().find(([t]) => top >= t)[1];
  beltEl.textContent = belt + (top >= 90 ? ' 🥋' : '');
}

/* ---------- tap-write: tap pad live-quantized into kick row ---------- */
let tapWriteArmed = false;
function quantizeTap() {
  pattern.kick[lastStep] = true;
  const el = grid.querySelector(`[data-r="kick"][data-s="${lastStep}"]`);
  if (el) el.classList.add('on');
  persist(); encode();
}

/* ---------- Easter egg: Konami → sensei mode ---------- */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let ki = 0;
function enableSensei(silent = false) {
  if (senseiMode) return;
  senseiMode = true;
  document.body.classList.add('sensei');
  $('#senseiMsg').hidden = false;
  $('#secretLabel').hidden = false;
  refreshGrid(); encode();
  if (!silent) { bell(ac().currentTime); setTimeout(() => bell(ac().currentTime), 180); toastMsg('🥋 SENSEI MODE — hidden bell unlocked'); }
  persist();
}
function konamiKey(k) {
  const want = KONAMI[ki];
  if (k === want || (want.length === 1 && k.toLowerCase() === want)) { ki++; }
  else ki = k === KONAMI[0] ? 1 : 0;
  if (ki === KONAMI.length) { ki = 0; enableSensei(); }
}

/* ---------- persistence ---------- */
function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ bpm, pattern, senseiMode, best: +(localStorage.getItem('kdd-best') || 0) }));
  } catch {}
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (s) {
      bpm = s.bpm || 112; Object.assign(pattern, s.pattern || {});
      if (s.senseiMode) { senseiMode = true; document.body.classList.add('sensei'); $('#senseiMsg').hidden = false; }
    }
  } catch {}
  const best = +(localStorage.getItem('kdd-best') || 0);
  if (best) awardBelt(best);
}

/* ---------- misc UI ---------- */
let toastT = null;
function toastMsg(m) {
  toast.textContent = m; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ---------- wire up ---------- */
bpmInput.addEventListener('input', () => { bpm = +bpmInput.value; bpmOut.textContent = bpm; persist(); encode(); });
playBtn.addEventListener('click', () => setPlaying(!playing));
$('#clearBtn').addEventListener('click', () => {
  for (const r of Object.keys(pattern)) pattern[r] = new Array(N).fill(false);
  refreshGrid(); persist(); encode(); toastMsg('cleared — empty mind, ready hands');
});
$('#randBtn').addEventListener('click', () => {
  const density = { kick: 0.28, snare: 0.14, hat: 0.55 };
  for (const r of ROWS) pattern[r] = Array.from({ length: N }, (_, i) => {
    if (r === 'kick' && i % 4 === 0) return Math.random() < 0.8;
    return Math.random() < density[r];
  });
  ac(); refreshGrid(); persist(); encode(); toastMsg('shaken, not stirred');
});
$('#presetBtn').addEventListener('click', () => {
  kataIdx = (kataIdx + 1) % PRESETS.length;
  const p = PRESETS[kataIdx];
  pattern.kick = [...p.kick]; pattern.snare = [...p.snare]; pattern.hat = [...p.hat];
  refreshGrid(); persist(); encode();
  toastMsg(['four on the floor', 'boom bap', 'dembow sway', 'half-time strut'][kataIdx]);
});
document.querySelectorAll('#presets button').forEach((b) => b.addEventListener('click', () => {
  kataIdx = +b.dataset.p;
  const p = PRESETS[kataIdx];
  pattern.kick = [...p.kick]; pattern.snare = [...p.snare]; pattern.hat = [...p.hat];
  refreshGrid(); persist(); encode();
}));
$('#tapWriteBtn').addEventListener('click', (e) => {
  tapWriteArmed = !tapWriteArmed;
  e.currentTarget.classList.toggle('armed', tapWriteArmed);
  e.currentTarget.textContent = tapWriteArmed ? 'tap-write ●' : 'tap-write';
  if (tapWriteArmed && !playing) setPlaying(true);
  toastMsg(tapWriteArmed ? 'tap the pad — kicks land on the grid' : 'tap-write off');
});
trialBtn.addEventListener('click', startTrial);
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); strike(); });
copyBtn.addEventListener('click', async () => {
  const code = encode();
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toastMsg('link copied — send the groove'); }
  catch { importInput.value = code; toastMsg('copy this: ' + code); }
});
importForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (decode(importInput.value)) toastMsg('beat loaded 🥁');
  else toastMsg('that code does not groove — try KDD-…');
});
document.addEventListener('keydown', (e) => {
  konamiKey(e.key);
  if (e.code === 'Space' && !/INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); setPlaying(!playing); }
  if (e.key >= '1' && e.key <= '4') {
    kataIdx = +e.key - 1;
    const p = PRESETS[kataIdx];
    pattern.kick = [...p.kick]; pattern.snare = [...p.snare]; pattern.hat = [...p.hat];
    refreshGrid(); persist(); encode();
  }
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === pad) { e.preventDefault(); strike(); }
});
// long-press pad (1.2s) also unlocks sensei — mobile-friendly egg
let pressT = null;
pad.addEventListener('pointerdown', () => { pressT = setTimeout(() => enableSensei(), 1200); });
['pointerup', 'pointerleave'].forEach((ev) => pad.addEventListener(ev, () => clearTimeout(pressT)));

/* ---------- init ---------- */
restore();
bpmInput.value = bpm; bpmOut.textContent = bpm;
buildGrid();
if (location.hash.startsWith('#b=')) {
  try { if (!decode(decodeURIComponent(location.hash.slice(3)))) encode(); } catch { encode(); }
} else encode();
console.log('kick drum dojo ready 🥋');
