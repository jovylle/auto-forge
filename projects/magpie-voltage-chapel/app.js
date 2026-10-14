// MAGPIE VOLTAGE CHAPEL — generative voltage liturgy
// Keyboard-only sci-fi-terminal sequencer. No deps. file:// safe.
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const VOICES = [
  { name: 'CANTOR', sub: 'sine · root', type: 'sine',     gain: 0.50, oct: 0, color: 0 },
  { name: 'MAGPIE', sub: 'triangle · shiny', type: 'triangle', gain: 0.38, oct: 12, color: 1 },
  { name: 'RELIC',  sub: 'saw · buried', type: 'sawtooth', gain: 0.26, oct: -12, color: 2 },
  { name: 'SURGE',  sub: 'square · arcs', type: 'square',   gain: 0.20, oct: 0, color: 3 },
];
const STEPS = 16;
const HOURS = ['VIGILS', 'LAUDS', 'PRIME', 'TERCE', 'SEXT', 'NONE', 'VESPERS', 'COMPLINE'];
const SEMIS = [0, 3, 5, 7, 10, 12, 15, 19]; // A minor pentatonic, 2 octaves of shine
const BASE = 110; // A2
const LS_KEY = 'magpie-voltage-chapel-v1';

const PRESETS = {
  vigils:  { bpm: 84,  seed: 1103, density: [3, 2, 5, 1] },
  lauds:   { bpm: 112, seed: 2077, density: [5, 4, 3, 3] },
  vespers: { bpm: 132, seed: 9021, density: [4, 6, 2, 5] },
};

// ---------- state ----------
const state = {
  bpm: 112, seed: 20261014,
  grid: Array.from({ length: 4 }, () => Array(STEPS).fill(0)),
  mutes: [false, false, false, false],
  drift: true, playing: false,
  step: 0, cycle: 0,
  cursor: { v: 0, s: 0 },
};

// ---------- utils ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const semitone = (s) => BASE * Math.pow(2, s / 12);
const noteFor = (v, s) => semitone(SEMIS[(s + v * 3) % SEMIS.length] + VOICES[v].oct);

function log(msg, cls = '') {
  const ol = $('#log');
  const li = document.createElement('li');
  if (cls) li.className = cls;
  const t = new Date();
  const stamp = String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
  li.innerHTML = `<b>[${stamp}]</b> ${msg}`;
  ol.prepend(li);
  while (ol.children.length > 60) ol.lastChild.remove();
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- generation ----------
function euclid(row, pulses, seed) {
  row.fill(0);
  const rnd = mulberry32(seed);
  let bucket = 0;
  for (let i = 0; i < STEPS; i++) {
    bucket += pulses;
    if (bucket >= STEPS) { bucket -= STEPS; row[i] = 1; }
  }
  // rotate by seeded offset so voices interlock
  const off = Math.floor(rnd() * STEPS);
  const copy = row.slice();
  for (let i = 0; i < STEPS; i++) row[i] = copy[(i + off) % STEPS];
}
function generate(seed = (Math.random() * 1e9) | 0, density = [5, 4, 3, 3]) {
  state.seed = seed;
  const rnd = mulberry32(seed);
  state.grid.forEach((row, v) => {
    euclid(row, density[v], seed + v * 7919);
    // sprinkle / thin for organic feel
    for (let s = 0; s < STEPS; s++) {
      const r = rnd();
      if (row[s] === 0 && r > 0.93) row[s] = 1;
      else if (row[s] === 1 && r < 0.08) row[s] = 0;
    }
  });
  renderGrid();
  updateMeter();
  save();
}
function mutate() {
  const rnd = Math.random;
  const v = (rnd() * 4) | 0, s = (rnd() * STEPS) | 0;
  state.grid[v][s] ^= 1;
  renderGrid(); updateMeter(); save();
  log(`mutation — ${VOICES[v].name} step ${String(s + 1).padStart(2, '0')} ${state.grid[v][s] ? 'lit ◉' : 'snuffed ·'}`, 'mag');
}
function steal() {
  // the magpie steals one lit cell and hides it at a nearby dark cell
  const lit = [];
  state.grid.forEach((row, v) => row.forEach((on, s) => { if (on) lit.push([v, s]); }));
  if (!lit.length) { log('the magpie found nothing shiny. light a candle first.', 'warn'); toast('Nothing to steal — light a candle first'); return; }
  const [v, s] = lit[(Math.random() * lit.length) | 0];
  const targets = [];
  for (let d = 1; d <= 4; d++) for (const dir of [-1, 1]) {
    const ns = (s + dir * d + STEPS) % STEPS;
    if (!state.grid[v][ns]) targets.push(ns);
  }
  if (!targets.length) { log('the magpie cackles — that row is full of shine.', 'mag'); return; }
  const ns = targets[(Math.random() * targets.length) | 0];
  state.grid[v][s] = 0; state.grid[v][ns] = 1;
  renderGrid(); updateMeter(); save();
  log(`◈ the magpie stole ${VOICES[v].name}·${s + 1} → hid it at ${ns + 1}`, 'mag');
  flashCell(v, ns);
}
function driftCycle() {
  // gentle self-rewriting each cycle: 1 mutation, occasional steal
  const r = Math.random();
  if (r < 0.55) {
    const v = (Math.random() * 4) | 0, s = (Math.random() * STEPS) | 0;
    state.grid[v][s] ^= 1;
  } else if (r < 0.75) { stealSilent(); }
  renderGrid(); updateMeter(); save();
}
function stealSilent() {
  const lit = [];
  state.grid.forEach((row, v) => row.forEach((on, s) => { if (on) lit.push([v, s]); }));
  if (!lit.length) return;
  const [v, s] = lit[(Math.random() * lit.length) | 0];
  const ns = (s + 1 + ((Math.random() * 3) | 0)) % STEPS;
  if (!state.grid[v][ns]) { state.grid[v][s] = 0; state.grid[v][ns] = 1; }
}

// ---------- grid UI ----------
const gridEl = $('#grid');
const cellEls = [];
function buildGrid() {
  gridEl.innerHTML = '';
  cellEls.length = 0;
  // header row of step numbers
  const corner = document.createElement('div');
  corner.setAttribute('aria-hidden', 'true');
  const headRow = document.createElement('div');
  headRow.className = 'grow';
  headRow.style.display = 'contents';
  gridEl.style.gridTemplateColumns = '150px repeat(16, 1fr)';
  gridEl.appendChild(document.createElement('div')); // corner spacer
  for (let s = 0; s < STEPS; s++) {
    const n = document.createElement('div');
    n.className = 'stepnum';
    n.textContent = (s + 1) % 4 === 1 ? String(s + 1).padStart(2, '0') : '·';
    n.setAttribute('aria-hidden', 'true');
    gridEl.appendChild(n);
  }
  state.grid.forEach((row, v) => {
    const vb = document.createElement('button');
    vb.className = 'voice-btn';
    vb.type = 'button';
    vb.innerHTML = `${VOICES[v].name} <small>${VOICES[v].sub} · mute [${v + 1}]</small>`;
    vb.setAttribute('aria-pressed', String(state.mutes[v]));
    vb.setAttribute('aria-label', `${VOICES[v].name} voice, press to ${state.mutes[v] ? 'unmute' : 'mute'}`);
    vb.addEventListener('click', () => toggleMute(v));
    gridEl.appendChild(vb);
    cellEls[v] = [];
    for (let s = 0; s < STEPS; s++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `cell v${v}`;
      b.setAttribute('role', 'gridcell');
      b.dataset.v = v; b.dataset.s = s;
      b.tabIndex = (v === 0 && s === 0) ? 0 : -1; // roving tabindex
      b.addEventListener('click', () => { setCursor(v, s, false); toggleCell(v, s, true); });
      b.addEventListener('focus', () => setCursor(v, s, false));
      gridEl.appendChild(b);
      cellEls[v][s] = b;
    }
  });
  renderGrid();
}
function renderGrid() {
  state.grid.forEach((row, v) => row.forEach((on, s) => {
    const el = cellEls[v]?.[s];
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-label', `${VOICES[v].name} step ${s + 1}, ${on ? 'lit' : 'dark'}. Press space to ${on ? 'snuff' : 'light'}.`);
    el.setAttribute('aria-selected', String(!!on));
    const cur = state.cursor.v === v && state.cursor.s === s;
    el.classList.toggle('cursor', cur);
    el.tabIndex = cur ? 0 : -1;
  }));
  $$('.voice-btn', gridEl).forEach((vb, v) => {
    vb.setAttribute('aria-pressed', String(state.mutes[v]));
    vb.setAttribute('aria-label', `${VOICES[v].name} voice, press to ${state.mutes[v] ? 'unmute' : 'mute'}`);
  });
}
function setCursor(v, s, focus = true) {
  state.cursor.v = Math.max(0, Math.min(3, v));
  state.cursor.s = (s + STEPS) % STEPS;
  renderGrid();
  if (focus) cellEls[state.cursor.v][state.cursor.s].focus();
}
function moveCursor(dv, ds) { setCursor(state.cursor.v + dv, state.cursor.s + ds); }
function toggleCell(v, s, audition = false) {
  state.grid[v][s] ^= 1;
  renderGrid(); updateMeter(); save();
  if (audition && state.grid[v][s]) pluck(v, s);
}
function toggleMute(v) {
  state.mutes[v] = !state.mutes[v];
  renderGrid(); save();
  log(`${VOICES[v].name} ${state.mutes[v] ? 'falls silent' : 'rejoins the choir'}`, 'sys');
}
function flashCell(v, s) {
  const el = cellEls[v]?.[s];
  if (!el) return;
  el.classList.add('playing');
  setTimeout(() => el.classList.remove('playing'), 220);
}
function activeCount() { return state.grid.flat().reduce((a, b) => a + b, 0); }
function updateMeter() {
  const pct = Math.round((activeCount() / (4 * STEPS)) * 100);
  $('#meter-fill').style.width = pct + '%';
  $('#meter-val').textContent = pct + '%';
}

// ---------- audio ----------
let AC = null, master = null, analyser = null, delaySend = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { log('WebAudio unavailable in this terminal.', 'warn'); return false; }
  master = AC.createGain(); master.gain.value = 0.8;
  analyser = AC.createAnalyser(); analyser.fftSize = 1024;
  master.connect(analyser); analyser.connect(AC.destination);
  // chapel echo: feedback delay = the stone walls
  const delay = AC.createDelay(1); delay.delayTime.value = 0.31;
  const fb = AC.createGain(); fb.gain.value = 0.34;
  const wet = AC.createGain(); wet.gain.value = 0.3;
  delaySend = AC.createGain(); delaySend.gain.value = 1;
  delaySend.connect(delay); delay.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(master);
  $('#audio-state').textContent = 'AUDIO LIVE';
  $('#audio-state').classList.add('live');
  log('audio core online — the chapel hums.', 'sys');
  return true;
}
function pluck(v, s, when = 0) {
  if (!AC || state.mutes[v]) return;
  const t = AC.currentTime + when;
  const osc = AC.createOscillator();
  const g = AC.createGain();
  osc.type = VOICES[v].type;
  osc.frequency.value = noteFor(v, s);
  const peak = VOICES[v].gain * (v === 1 && s % 4 === 0 ? 1.35 : 1); // magpie sparkle accent
  const dur = v === 2 ? 0.42 : 0.28;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (v === 2) { // relic through stone: lowpass
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    osc.connect(lp); node = lp;
  }
  node.connect(g); g.connect(master); g.connect(delaySend);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function bell() {
  if (!ensureAudio()) return;
  const t = AC.currentTime;
  [55, 82.4, 110, 165, 220.5].forEach((f, i) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002);
    const amp = 0.4 / (i + 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    o.connect(g); g.connect(master); g.connect(delaySend);
    o.start(t); o.stop(t + 3);
  });
  advanceHour();
  log('♰ the bell tolls across the voltage nave.', 'sys');
}
function advanceHour() {
  state.cycle++;
  $('#cycle-count').textContent = 'CYCLE ' + String(state.cycle).padStart(3, '0');
  $('#hour-name').textContent = HOURS[state.cycle % HOURS.length];
}

// scheduler: lookahead pattern, step = 8th note
let timer = null, nextTime = 0, schedStep = 0;
function stepDur() { return 60 / state.bpm / 2; }
function start() {
  if (!ensureAudio()) { toast('Audio unavailable'); return; }
  if (state.playing) return;
  state.playing = true;
  $('#btn-play').innerHTML = '⏸ STOP <kbd>T</kbd>';
  $('#btn-play').setAttribute('aria-pressed', 'true');
  schedStep = state.step; nextTime = AC.currentTime + 0.06;
  timer = setInterval(schedule, 25);
  log(`liturgy begins — ${state.bpm} BPM, hour of ${$('#hour-name').textContent}.`, 'sys');
}
function stop(silent = false) {
  state.playing = false;
  clearInterval(timer); timer = null;
  $$('.cell.playing').forEach((c) => c.classList.remove('playing'));
  $('#btn-play').innerHTML = '▶ PLAY <kbd>T</kbd>';
  $('#btn-play').setAttribute('aria-pressed', 'false');
  if (!silent) log('the choir rests. the magpie pockets the silence.', 'sys');
}
function schedule() {
  while (nextTime < AC.currentTime + 0.14) {
    const s = schedStep;
    const when = Math.max(0, nextTime - AC.currentTime);
    for (let v = 0; v < 4; v++) if (state.grid[v][s]) pluck(v, s, when);
    setTimeout(((step, time) => () => paintStep(step))(s, when), when * 1000);
    nextTime += stepDur();
    schedStep = (schedStep + 1) % STEPS;
    if (schedStep === 0) {
      setTimeout(() => {
        advanceHour();
        if (state.drift && activeCount() > 0) driftCycle();
      }, when * 1000);
    }
  }
}
function paintStep(s) {
  state.step = s;
  $$('.cell.playing').forEach((c) => c.classList.remove('playing'));
  for (let v = 0; v < 4; v++) {
    const el = cellEls[v]?.[s];
    if (el && state.grid[v][s] && !state.mutes[v]) el.classList.add('playing');
  }
}
function panic() {
  stop(true);
  if (AC) { AC.suspend(); setTimeout(() => AC.resume(), 60); }
  $$('.cell.playing').forEach((c) => c.classList.remove('playing'));
  log('∅ PANIC — every candle drowned at once.', 'warn');
  toast('Silence. All sound cut.');
}

// ---------- scope ----------
const scope = $('#scope');
const sctx = scope.getContext('2d');
function drawScope() {
  requestAnimationFrame(drawScope);
  const W = scope.width, H = scope.height;
  sctx.fillStyle = '#020a06';
  sctx.fillRect(0, 0, W, H);
  sctx.strokeStyle = 'rgba(51,255,153,.15)';
  sctx.lineWidth = 1;
  sctx.beginPath(); sctx.moveTo(0, H / 2); sctx.lineTo(W, H / 2); sctx.stroke();
  if (!analyser) {
    sctx.fillStyle = '#1d4a34';
    sctx.font = '22px monospace';
    sctx.fillText(state.playing ? '· listening ·' : '· press T — the chapel awaits ·', 18, H / 2 - 12);
    return;
  }
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  sctx.strokeStyle = '#33ff99';
  sctx.lineWidth = 2;
  sctx.shadowColor = '#33ff99'; sctx.shadowBlur = 8;
  sctx.beginPath();
  const slice = W / data.length;
  for (let i = 0; i < data.length; i += 2) {
    const y = (data[i] / 255) * H;
    i === 0 ? sctx.moveTo(0, y) : sctx.lineTo(i * slice, y);
  }
  sctx.stroke();
  sctx.shadowBlur = 0;
}

// ---------- persistence + share ----------
function serialize() {
  return {
    app: 'magpie-voltage-chapel', v: 1,
    bpm: state.bpm, seed: state.seed, drift: state.drift,
    mutes: state.mutes, grid: state.grid.map((r) => parseInt(r.join(''), 2)),
  };
}
function deserialize(d) {
  if (!d || d.app !== 'magpie-voltage-chapel') return false;
  if (typeof d.bpm === 'number') state.bpm = Math.max(60, Math.min(180, d.bpm));
  if (typeof d.seed === 'number') state.seed = d.seed;
  if (typeof d.drift === 'boolean') state.drift = d.drift;
  if (Array.isArray(d.mutes)) d.mutes.forEach((m, i) => { if (i < 4) state.mutes[i] = !!m; });
  if (Array.isArray(d.grid)) d.grid.forEach((n, i) => {
    if (i < 4 && typeof n === 'number') {
      const bits = n.toString(2).padStart(STEPS, '0');
      for (let s = 0; s < STEPS; s++) state.grid[i][s] = bits[s] === '1' ? 1 : 0;
    }
  });
  return true;
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(serialize())); } catch { /* private mode */ } }
function load() {
  // URL hash wins, then localStorage, then a fresh generate
  if (location.hash.startsWith('#s=')) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3)))));
      if (deserialize(d)) { log('liturgy received by courier wire (shared link).', 'sys'); return; }
    } catch { log('the courier wire was corrupted — starting fresh.', 'warn'); }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && deserialize(JSON.parse(raw))) { log('your last liturgy was kept warm in the vestry.', 'sys'); return; }
  } catch { /* ignore */ }
  generate(PRESETS.lauds.seed, PRESETS.lauds.density);
  state.bpm = PRESETS.lauds.bpm;
}
function shareURL() {
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
  return location.href.split('#')[0] + '#s=' + enc;
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  toast(okMsg);
  log(okMsg, 'sys');
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `magpie-voltage-chapel-cycle${state.cycle}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  log('liturgy pressed into JSON and handed to you.', 'sys');
  toast('Liturgy downloaded as JSON');
}
function liturgyText() {
  const glyph = (on, v) => on ? ['◉', '⬢', '⬣', '⬔'][v] : '·';
  const head = `MAGPIE VOLTAGE CHAPEL — hour of ${$('#hour-name').textContent}, cycle ${state.cycle}, ${state.bpm} BPM, seed ${state.seed}\n`;
  const rows = state.grid.map((row, v) =>
    `${VOICES[v].name.padEnd(7)} ${state.mutes[v] ? '(mute)' : '      '} |${row.map((on) => glyph(on, v)).join(' ')}|`
  ).join('\n');
  return head + rows + `\n${shareURL()}`;
}

// ---------- help ----------
let lastFocus = null;
function openHelp() {
  lastFocus = document.activeElement;
  $('#help').hidden = false;
  $('#btn-help-close').focus();
}
function closeHelp() {
  $('#help').hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// ---------- wiring ----------
function setTempo(bpm, announce = true) {
  state.bpm = Math.max(60, Math.min(180, Math.round(bpm)));
  $('#tempo').value = state.bpm;
  $('#tempo-val').textContent = state.bpm;
  $('#bpm-readout').textContent = state.bpm + ' BPM';
  save();
  if (announce) toast(`Tempo ${state.bpm} BPM`);
}
function syncChrome() {
  setTempo(state.bpm, false);
  $('#btn-drift').setAttribute('aria-pressed', String(state.drift));
  $('#cycle-count').textContent = 'CYCLE ' + String(state.cycle).padStart(3, '0');
}

$('#btn-play').addEventListener('click', () => (state.playing ? stop() : start()));
$('#btn-bell').addEventListener('click', bell);
$('#btn-panic').addEventListener('click', panic);
$('#btn-generate').addEventListener('click', () => { generate(); log(`✦ a new liturgy crackles in — seed ${state.seed}.`, 'sys'); });
$('#btn-mutate').addEventListener('click', mutate);
$('#btn-steal').addEventListener('click', () => { ensureAudio(); steal(); });
$('#btn-fill').addEventListener('click', () => {
  const d = [3, 5, 7, 9].map((p) => p + ((Math.random() * 3) | 0));
  state.grid.forEach((row, v) => euclid(row, d[v], state.seed + v * 131));
  renderGrid(); updateMeter(); save();
  log('▦ euclidean fill — the pews align in sacred ratios.', 'sys');
});
$('#btn-clear').addEventListener('click', () => {
  state.grid.forEach((r) => r.fill(0));
  renderGrid(); updateMeter(); save();
  log('every candle snuffed. the chapel holds its breath.', 'sys');
});
$('#btn-drift').addEventListener('click', () => {
  state.drift = !state.drift;
  $('#btn-drift').setAttribute('aria-pressed', String(state.drift));
  save();
  log(`generative drift ${state.drift ? 'opens — the liturgy will rewrite itself' : 'sealed — the liturgy holds still'}.`, 'sys');
});
$('#btn-export').addEventListener('click', exportJSON);
$('#btn-share').addEventListener('click', () => copyText(shareURL(), 'Share link copied — the wire carries your liturgy'));
$('#btn-liturgy').addEventListener('click', () => copyText(liturgyText(), 'Liturgy text copied — paste it anywhere'));
$('#btn-help').addEventListener('click', openHelp);
$('#btn-help-close').addEventListener('click', closeHelp);
$('#help').addEventListener('click', (e) => { if (e.target.id === 'help') closeHelp(); });
$('#tempo').addEventListener('input', (e) => setTempo(+e.target.value, false));
$('#tempo').addEventListener('change', () => toast(`Tempo ${state.bpm} BPM`));
$$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  generate(p.seed, p.density); setTempo(p.bpm, false);
  log(`psalm of ${b.dataset.preset.toUpperCase()} laid on the altar — ${p.bpm} BPM.`, 'sys');
}));

// keyboard canon — the whole chapel answers to keys
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#help').hidden) closeHelp(); return; }
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const typing = tag === 'input' && document.activeElement.type === 'text';
  if (typing) return;
  if (tag === 'input' && document.activeElement.type === 'range') {
    if (!['[', ']', 't', ' '].includes(e.key)) return; // let arrows drive the slider
    e.preventDefault();
  }
  const k = e.key;
  const onCell = document.activeElement?.classList?.contains('cell');
  const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], h: [0, -1], l: [0, 1], k: [-1, 0], j: [1, 0], H: [0, -1], L: [0, 1], K: [-1, 0], J: [1, 0] };
  if (move[k]) { e.preventDefault(); ensureAudio(); moveCursor(...move[k]); return; }
  switch (k) {
    case ' ': e.preventDefault(); ensureAudio();
      if (onCell) toggleCell(state.cursor.v, state.cursor.s, true);
      else state.playing ? stop() : start(); break;
    case 'Enter': if (onCell) { e.preventDefault(); toggleCell(state.cursor.v, state.cursor.s, true); } break;
    case 't': case 'T': ensureAudio(); state.playing ? stop() : start(); break;
    case 'b': case 'B': bell(); break;
    case '0': panic(); break;
    case 'g': case 'G': generate(); log(`✦ a new liturgy crackles in — seed ${state.seed}.`, 'sys'); break;
    case 'v': case 'V': ensureAudio(); mutate(); break;
    case 'x': case 'X': ensureAudio(); steal(); break;
    case 'f': case 'F': $('#btn-fill').click(); break;
    case 'c': case 'C': $('#btn-clear').click(); break;
    case 'm': case 'M': $('#btn-drift').click(); break;
    case 'e': case 'E': exportJSON(); break;
    case 'y': case 'Y': $('#btn-share').click(); break;
    case 'l': case 'L': $('#btn-liturgy').click(); break;
    case '[': setTempo(state.bpm - 2); break;
    case ']': setTempo(state.bpm + 2); break;
    case '1': case '2': case '3': case '4': toggleMute(+k - 1); break;
    case '5': case '6': case '7': {
      const names = ['vigils', 'lauds', 'vespers'];
      const p = PRESETS[names[+k - 5]];
      generate(p.seed, p.density); setTempo(p.bpm, false);
      log(`psalm of ${names[+k - 5].toUpperCase()} laid on the altar.`, 'sys'); break;
    }
    case 'n': case 'N':
      e.preventDefault();
      setCursor(state.cursor.v + (e.shiftKey ? 3 : 1), state.cursor.s);
      break;
    case '?': openHelp(); break;
  }
});

// ---------- boot ----------
function boot() {
  load();
  buildGrid();
  syncChrome();
  updateMeter();
  drawScope();
  const lines = ['MAGPIE VOLTAGE CHAPEL v1.0', 'tuning stray current …', 'the magpie takes its perch.'];
  const bt = $('#boot-text');
  let i = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    if (i < lines.length && !reduced) { bt.textContent = lines.slice(0, ++i).join('\n'); setTimeout(tick, 260); }
    else { bt.textContent = lines.join('\n'); setTimeout(() => $('#boot').classList.add('done'), 350); }
  };
  tick();
  setTimeout(() => $('#boot').classList.add('done'), reduced ? 100 : 1600);
  log('the chapel doors open. press <b>?</b> for the key canon, <b>T</b> to begin.', 'sys');
  log('every control below answers to the keyboard — tab walks, arrows aim.', 'sys');
}
boot();
