// Sundial Loop Workshop — remix daylight hours into looping ambient soundscapes.
// Plain ES module, no deps. WebAudio generative loops + canvas sundial.
// Everything works keyboard-only: global shortcuts + native focusable controls.

const $ = (id) => document.getElementById(id);
const els = {
  dial: $('dial'), tapeTime: $('tapeTime'), nowBig: $('nowBig'),
  hourName: $('hourName'), dayPhase: $('dayPhase'), elevPct: $('elevPct'),
  elevBar: $('elevBar'), slider: $('timeSlider'), dialCanvas: $('dial'),
  btnPlay: $('btnPlay'), btnCycle: $('btnCycle'), btnMute: $('btnMute'),
  rRoot: $('rRoot'), rMode: $('rMode'), rBpm: $('rBpm'), rWave: $('rWave'),
  rSteps: $('rSteps'), btnStamp: $('btnStamp'), stampHour: $('stampHour'),
  btnDrop: $('btnDrop'), btnDemo: $('btnDemo'), btnClear: $('btnClear'),
  cycleList: $('cycleList'), cycleCount: $('cycleCount'), cycleEmpty: $('cycleEmpty'),
  shareLink: $('shareLink'), btnCopy: $('btnCopy'), shareMsg: $('shareMsg'),
  saveName: $('saveName'), btnSave: $('btnSave'), savedList: $('savedList'),
  live: $('live'),
};

/* ---------- deterministic hour recipes ---------- */
const HOUR_NAMES = [
  'WITCHING STATIC','ASHEN BLUE','HOLLOW SIGNAL','LAST TRAIN HUM',
  'PRE-DAWN GRIT','FIRST LIGHT CRACKLE','DAWN CHORUS RIOT','COMMUTE JANGLE',
  'WORKSHOP CLATTER','MID-MORNING HAZE','SUN-BLEACHED TAPE','HIGH-NOON GLARE',
  'SOLAR OVERDRIVE','HEAT-SHIMMER DUB','AFTERNOON SLOG','GOLDEN HOUR TEASE',
  'LONG SHADOW SWING','RUST & EMBER','SUNDOWN FEEDBACK','NEON GRAFFITI',
  'STREETLAMP BLOOM','BASEMENT SHOW','LAST CALL ECHO','MIDNIGHT OIL',
];
const MODES = [
  { name: 'DORIAN', iv: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'AEOLIAN', iv: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'LYDIAN', iv: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'MIXOLYDIAN', iv: [0, 2, 4, 5, 7, 9, 10] },
];
const WAVES = ['sawtooth', 'triangle', 'square', 'sine'];
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LOOPS_PER_HOUR = 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** minutes (0..1439) -> solar elevation -1..1 (peak at 12:00) */
function elevation(min) {
  const theta = ((min - 360) / 1440) * Math.PI * 2;
  return Math.sin(theta);
}

function phaseOf(h) {
  if (h >= 5 && h < 7) return 'DAWN';
  if (h >= 7 && h < 11) return 'MORNING';
  if (h >= 11 && h < 14) return 'MIDDAY';
  if (h >= 14 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 20) return 'DUSK';
  if (h >= 20 || h < 5) return h < 5 ? 'DEEP NIGHT' : 'NIGHT';
  return 'NIGHT';
}

/** Deterministic loop recipe brewed from an hour (0..23). Same hour, same loop. */
function recipeFor(hour) {
  const rng = mulberry32(hour * 7919 + 137);
  const elevNoon = elevation(hour * 60 + 30);
  const daylight = Math.max(0, elevNoon); // 0 at night, ~1 at noon
  const rootPc = (hour * 7 + 9) % 12; // circle of fifths walk from A
  const rootMidi = 45 + rootPc; // A2 + fifth-steps
  const mode = MODES[hour % MODES.length];
  const bpm = Math.round(56 + daylight * 38 + rng() * 4);
  const wave = WAVES[hour % WAVES.length];
  const cutoff = Math.round(350 + Math.max(0, elevNoon + 0.35) * 1900);
  const pattern = Array.from({ length: 8 }, () => (rng() < 0.16 ? -1 : Math.floor(rng() * 8)));
  if (!pattern.some((p) => p >= 0)) pattern[0] = 0;
  const bassSteps = hour % 2 === 0 ? [0, 4, 6] : [0, 3, 5];
  return { hour, rootPc, rootMidi, mode, bpm, wave, cutoff, pattern, bassSteps, name: HOUR_NAMES[hour] };
}

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- state ---------- */
const store = {
  load(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const state = {
  minutes: 360,
  playing: false,
  cycleMode: false,
  muted: false,
  cycle: [], // stamped hours
  cycleIdx: 0,
  saved: store.load('slw.v1.saved', []),
};
Object.assign(state, store.load('slw.v1.state', {}));

function persist() {
  store.save('slw.v1.state', { minutes: state.minutes, cycle: state.cycle, cycleMode: state.cycleMode });
}

function announce(msg) {
  els.live.textContent = '';
  requestAnimationFrame(() => { els.live.textContent = msg; });
}

const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/* ---------- WebAudio generative engine ---------- */
let ctx = null, master = null, musicFilter = null, delaySend = null, noiseBuf = null;

function ensureCtx() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { els.shareMsg.textContent = 'WebAudio not supported in this browser.'; return false; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = state.muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);

  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass'; musicFilter.frequency.value = 1200;
  musicFilter.connect(master);

  // dubby feedback delay = the "tape loop" glue
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  delaySend = ctx.createGain(); delaySend.gain.value = 1;
  delaySend.connect(delay); delay.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(master);

  // 2s of reusable noise for hats / night wind
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function pluck(freq, t, dur, wave, vol) {
  const o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(musicFilter); g.connect(delaySend);
  o.start(t); o.stop(t + dur + 0.05);
}

function bass(freq, t, dur, vol) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(musicFilter);
  o.start(t); o.stop(t + dur + 0.05);
}

function hiss(t, dur, vol, hp = 6000) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

function scheduleStep(step, t, rec, stepDur) {
  musicFilter.frequency.setTargetAtTime(rec.cutoff, t, 0.05);
  const elev = Math.max(0, elevation(state.minutes));
  // bass drone on recipe steps
  if (rec.bassSteps.includes(step)) bass(midiHz(rec.rootMidi - 12), t, stepDur * 3.2, 0.30);
  // plucked melody from the hour pattern
  const deg = rec.pattern[step];
  if (deg >= 0) {
    const semis = rec.mode.iv[deg % 7] + 12 * Math.floor(deg / 7);
    pluck(midiHz(rec.rootMidi + 12 + semis), t, stepDur * 2.1, rec.wave, 0.16 + elev * 0.08);
  }
  // night wind + day ticks
  if (step % 2 === 1) hiss(t, 0.05, 0.015 + elev * 0.03);
  if (elev <= 0.02 && step === 0) hiss(t, stepDur * 6, 0.02, 400); // low night wash
}

/* lookahead scheduler */
const seq = { step: 0, nextTime: 0, loops: 0, timer: null, lastRec: null };
let uiStep = -1, uiPulse = 0;

function schedulerTick() {
  if (!state.playing || !ctx) return;
  const rec = recipeFor(Math.floor(state.minutes / 60));
  seq.lastRec = rec;
  const stepDur = 60 / rec.bpm / 2;
  while (seq.nextTime < ctx.currentTime + 0.18) {
    scheduleStep(seq.step % 8, seq.nextTime, recipeFor(Math.floor(state.minutes / 60)), stepDur);
    seq.nextTime += stepDur;
    seq.step++;
    if (seq.step % 8 === 0) onLoopEnd();
  }
}

function onLoopEnd() {
  seq.loops++;
  uiPulse = 1;
  if (state.cycleMode && state.cycle.length > 0 && seq.loops % LOOPS_PER_HOUR === 0) {
    state.cycleIdx = (state.cycleIdx + 1) % state.cycle.length;
    setMinutes(state.cycle[state.cycleIdx] * 60, { silent: true });
    renderCycle();
    const h = state.cycle[state.cycleIdx];
    announce(`Cycle step ${state.cycleIdx + 1} of ${state.cycle.length}: ${fmt(h * 60)} ${HOUR_NAMES[h]}`);
  }
}

function setPlaying(on) {
  if (on && !ensureCtx()) return;
  state.playing = on;
  if (on) {
    seq.step = 0; seq.loops = 0;
    seq.nextTime = ctx.currentTime + 0.08;
    if (!seq.timer) seq.timer = setInterval(schedulerTick, 30);
    els.btnPlay.textContent = '⏸ STOP';
    els.btnPlay.setAttribute('aria-pressed', 'true');
    announce(`Playing ${fmt(state.minutes)} ${HOUR_NAMES[Math.floor(state.minutes / 60)]} loop`);
  } else {
    els.btnPlay.textContent = '▶ PLAY LOOP';
    els.btnPlay.setAttribute('aria-pressed', 'false');
    announce('Loop stopped');
  }
}

/* ---------- time scrubbing ---------- */
function setMinutes(min, opts = {}) {
  state.minutes = ((Math.round(min) % 1440) + 1440) % 1440;
  if (document.activeElement !== els.slider) els.slider.value = state.minutes;
  renderTime();
  persist();
  updateShareLink();
  if (!opts.silent) {
    const h = Math.floor(state.minutes / 60);
    announce(`${fmt(state.minutes)}, ${HOUR_NAMES[h]}, ${phaseOf(h)}`);
  }
}

function renderTime() {
  const h = Math.floor(state.minutes / 60);
  const rec = recipeFor(h);
  const ev = elevation(state.minutes);
  els.tapeTime.textContent = fmt(state.minutes);
  els.nowBig.textContent = fmt(state.minutes);
  els.hourName.textContent = rec.name;
  els.dayPhase.textContent = phaseOf(h);
  els.elevPct.textContent = (ev >= 0 ? '+' : '') + Math.round(ev * 100) + '%';
  els.elevBar.style.width = `${Math.round(Math.max(0, ev) * 100)}%`;
  els.stampHour.textContent = String(h).padStart(2, '0');
  els.rRoot.textContent = `${NOTE_NAMES[rec.rootPc]}${Math.floor(rec.rootMidi / 12) - 1}`;
  els.rMode.textContent = rec.mode.name;
  els.rBpm.textContent = `${rec.bpm} BPM`;
  els.rWave.textContent = rec.wave.toUpperCase();
  els.rSteps.innerHTML = '';
  rec.pattern.forEach((p) => {
    const s = document.createElement('span');
    s.className = 'step-dot' + (p < 0 ? ' rest' : ' hit');
    els.rSteps.appendChild(s);
  });
  els.dialCanvas.setAttribute('aria-label',
    `Visual sundial showing ${fmt(state.minutes)}, ${rec.name}. Loop: ${NOTE_NAMES[rec.rootPc]} ${rec.mode.name} at ${rec.bpm} BPM. Use arrow keys to scrub time.`);
}

/* ---------- cycle (stamps) ---------- */
function renderCycle() {
  els.cycleList.innerHTML = '';
  state.cycle.forEach((h, i) => {
    const li = document.createElement('li');
    if (state.cycleMode && state.playing && i === state.cycleIdx) li.classList.add('playing');
    const jump = document.createElement('button');
    jump.className = 'jump';
    jump.textContent = `${fmt(h * 60)} · ${HOUR_NAMES[h]}`;
    jump.title = `Jump to ${fmt(h * 60)}`;
    jump.addEventListener('click', () => setMinutes(h * 60));
    const del = document.createElement('button');
    del.className = 'mini-btn';
    del.textContent = '✕';
    del.setAttribute('aria-label', `Remove ${fmt(h * 60)} from cycle`);
    del.addEventListener('click', () => {
      state.cycle.splice(i, 1);
      if (state.cycleIdx >= state.cycle.length) state.cycleIdx = 0;
      renderCycle(); updateShareLink(); persist();
    });
    li.append(jump, del);
    els.cycleList.appendChild(li);
  });
  els.cycleCount.textContent = `(${state.cycle.length} stamp${state.cycle.length === 1 ? '' : 's'})`;
  els.cycleEmpty.style.display = state.cycle.length ? 'none' : '';
}

function stampCurrent() {
  const h = Math.floor(state.minutes / 60);
  if (state.cycle[state.cycle.length - 1] === h) {
    els.shareMsg.textContent = `${fmt(h * 60)} is already the last stamp.`;
    return;
  }
  if (state.cycle.length >= 24) { els.shareMsg.textContent = 'Full day — 24 stamps max.'; return; }
  state.cycle.push(h);
  renderCycle(); updateShareLink(); persist();
  announce(`Stamped ${fmt(h * 60)} ${HOUR_NAMES[h]} — ${state.cycle.length} in cycle`);
}

/* ---------- share + saved ---------- */
function cycleToHash() {
  if (!state.cycle.length) return '';
  return `#c=${state.cycle.join('.')}&t=${state.minutes}`;
}
function updateShareLink() {
  els.shareLink.value = state.cycle.length
    ? `${location.href.split('#')[0]}${cycleToHash()}`
    : '';
}
function hashToCycle() {
  const m = location.hash.match(/#c=([\d.]+)(?:&t=(\d+))?/);
  if (!m) return null;
  const cyc = m[1].split('.').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 24);
  const t = m[2] !== undefined ? Math.max(0, Math.min(1439, parseInt(m[2], 10))) : null;
  return cyc.length ? { cyc, t } : null;
}

async function copyLink() {
  if (!state.cycle.length) { els.shareMsg.textContent = 'Stamp at least one hour first.'; return; }
  updateShareLink();
  const url = els.shareLink.value;
  try {
    await navigator.clipboard.writeText(url);
    els.shareMsg.textContent = '✓ Link copied — send someone your whole day.';
  } catch {
    els.shareLink.select();
    try {
      document.execCommand('copy');
      els.shareMsg.textContent = '✓ Link copied — send someone your whole day.';
    } catch { els.shareMsg.textContent = 'Copy failed — grab the URL from the box above.'; }
  }
  announce('Share link copied');
}

function renderSaved() {
  els.savedList.innerHTML = '';
  if (!state.saved.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="dim">Nothing filed yet — name your day and hit SAVE. It survives reloads.</span>';
    els.savedList.appendChild(li);
    return;
  }
  state.saved.forEach((s, i) => {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = `★ ${s.name}`;
    const ct = document.createElement('span'); ct.className = 'ct';
    ct.textContent = `${s.cycle.length} stamps · ${s.cycle.map((h) => String(h).padStart(2, '0')).join(' → ')}`;
    const load = document.createElement('button'); load.className = 'mini-btn'; load.textContent = 'LOAD';
    load.setAttribute('aria-label', `Load saved cycle ${s.name}`);
    load.addEventListener('click', () => {
      state.cycle = [...s.cycle]; state.cycleIdx = 0;
      renderCycle(); updateShareLink(); persist();
      announce(`Loaded ${s.name}`);
    });
    const del = document.createElement('button'); del.className = 'mini-btn'; del.textContent = '✕';
    del.setAttribute('aria-label', `Delete saved cycle ${s.name}`);
    del.addEventListener('click', () => {
      state.saved.splice(i, 1);
      store.save('slw.v1.saved', state.saved);
      renderSaved(); announce(`Deleted ${s.name}`);
    });
    li.append(nm, ct, load, del);
    els.savedList.appendChild(li);
  });
}

/* ---------- canvas sundial ---------- */
const gx = els.dial.getContext('2d');
const W = 660, H = 440, CX = 330, CY = 300, R = 210;

function minutesToScreen(min) {
  const theta = ((min - 360) / 1440) * Math.PI * 2; // solar angle
  return Math.PI - theta; // screen angle: sunrise left, noon top
}
function screenToMinutes(a) {
  const theta = Math.PI - a;
  return ((theta / (Math.PI * 2)) * 1440 + 360) % 1440;
}

function drawDial() {
  uiPulse = Math.max(0, uiPulse - 0.04);
  const ev = elevation(state.minutes);
  const dayMix = Math.max(0, ev);

  // sky wash
  const sky = gx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${18 + dayMix * 46},${16 + dayMix * 30},${14 + dayMix * 12})`);
  sky.addColorStop(0.72, `rgb(${20 + dayMix * 60},${17 + dayMix * 26},${15 + dayMix * 8})`);
  sky.addColorStop(0.721, '#0a0908');
  sky.addColorStop(1, '#0a0908');
  gx.fillStyle = sky;
  gx.fillRect(0, 0, W, H);

  // horizon glow
  gx.fillStyle = `rgba(194,81,31,${0.10 + dayMix * 0.30})`;
  gx.fillRect(0, CY - 46, W, 46);

  // horizon line
  gx.strokeStyle = '#5a5040'; gx.lineWidth = 2;
  gx.beginPath(); gx.moveTo(20, CY); gx.lineTo(W - 20, CY); gx.stroke();

  // dial arc + hour ticks
  gx.strokeStyle = '#8a7c5c'; gx.lineWidth = 2;
  gx.beginPath(); gx.arc(CX, CY, R, Math.PI, 0); gx.stroke();
  gx.font = '11px Oswald, sans-serif'; gx.textAlign = 'center';
  for (let h = 0; h < 24; h++) {
    const a = minutesToScreen(h * 60);
    const x1 = CX + Math.cos(a) * (R - 12), y1 = CY - Math.sin(a) * (R - 12);
    const x2 = CX + Math.cos(a) * R, y2 = CY - Math.sin(a) * R;
    const day = h >= 6 && h <= 18;
    gx.strokeStyle = day ? '#e0a100' : '#4a4436'; gx.lineWidth = h % 6 === 0 ? 3 : 1.5;
    gx.beginPath(); gx.moveTo(x1, y1); gx.lineTo(x2, y2); gx.stroke();
    if (h % 3 === 0) {
      gx.fillStyle = day ? '#e8ddc4' : '#6b6350';
      gx.fillText(String(h).padStart(2, '0'), CX + Math.cos(a) * (R + 16), CY - Math.sin(a) * (R + 16) + 4);
    }
  }

  // stamped cycle hours = rust rivets
  state.cycle.forEach((h, i) => {
    const a = minutesToScreen(h * 60);
    const x = CX + Math.cos(a) * R, y = CY - Math.sin(a) * R;
    const active = state.cycleMode && state.playing && i === state.cycleIdx;
    gx.fillStyle = active ? '#e0a100' : '#c2511f';
    gx.beginPath(); gx.arc(x, y, active ? 9 : 6, 0, Math.PI * 2); gx.fill();
    gx.strokeStyle = '#000'; gx.lineWidth = 2; gx.stroke();
  });

  // gnomon (the spike) + its shadow cast away from the sun
  const sunA = minutesToScreen(state.minutes);
  const sunX = CX + Math.cos(sunA) * R, sunY = CY - Math.sin(sunA) * R;
  const shLen = 60 + (1 - dayMix) * 130;
  const shA = sunA + Math.PI;
  gx.strokeStyle = 'rgba(0,0,0,.65)'; gx.lineWidth = 9; gx.lineCap = 'round';
  gx.beginPath(); gx.moveTo(CX, CY);
  gx.lineTo(CX + Math.cos(shA) * shLen, CY - Math.sin(shA) * shLen * 0.45 - 8); gx.stroke();
  gx.fillStyle = '#d9cba6';
  gx.beginPath(); gx.moveTo(CX, CY - 108); gx.lineTo(CX - 13, CY); gx.lineTo(CX + 13, CY); gx.closePath(); gx.fill();
  gx.strokeStyle = '#000'; gx.lineWidth = 2; gx.stroke();
  gx.fillStyle = '#000'; gx.beginPath(); gx.arc(CX, CY, 7, 0, Math.PI * 2); gx.fill();

  // sun disc (draggable) with pulse on loop + beat flicker
  const pulse = 1 + uiPulse * 0.18;
  const glow = gx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 44 * pulse);
  glow.addColorStop(0, ev > 0 ? '#ffe9a8' : '#7a6a4a');
  glow.addColorStop(0.35, ev > 0 ? '#e0a100' : '#4a4234');
  glow.addColorStop(1, 'rgba(224,161,0,0)');
  gx.fillStyle = glow;
  gx.beginPath(); gx.arc(sunX, sunY, 44 * pulse, 0, Math.PI * 2); gx.fill();
  gx.fillStyle = ev > 0 ? '#e8b400' : '#57503f';
  gx.beginPath(); gx.arc(sunX, sunY, 17 * pulse, 0, Math.PI * 2); gx.fill();
  gx.strokeStyle = '#000'; gx.lineWidth = 3; gx.stroke();
  // distressed cross on the sun
  gx.strokeStyle = 'rgba(0,0,0,.7)'; gx.lineWidth = 2;
  gx.beginPath();
  gx.moveTo(sunX - 22, sunY + 5); gx.lineTo(sunX + 22, sunY - 5);
  gx.moveTo(sunX - 8, sunY - 20); gx.lineTo(sunX + 8, sunY + 20);
  gx.stroke();

  // beat pips: current 8-step position
  const cur = state.playing ? (seq.step % 8) : -1;
  for (let s = 0; s < 8; s++) {
    const px = 60 + s * 34, py = H - 26;
    gx.fillStyle = s === cur ? '#e0a100' : (recipeFor(Math.floor(state.minutes / 60)).pattern[s] >= 0 ? '#c2511f' : '#2c2820');
    gx.fillRect(px, py, 20, 10);
    gx.strokeStyle = '#000'; gx.lineWidth = 1; gx.strokeRect(px, py, 20, 10);
  }

  // vignette + scratches
  const vg = gx.createRadialGradient(CX, CY, R * 0.5, CX, CY, R * 1.5);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.55)');
  gx.fillStyle = vg; gx.fillRect(0, 0, W, H);

  requestAnimationFrame(drawDial);
}

/* sun dragging (pointer) — the slider + keys do the same job */
let dragging = false;
function scrubToEvent(e) {
  const r = els.dial.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top) * (H / r.height);
  const dx = x - CX, dy = -(y - CY);
  if (Math.hypot(dx, dy) < 24) return; // dead zone on the gnomon
  setMinutes(Math.round(screenToMinutes(Math.atan2(dy, dx)) / 5) * 5);
}
els.dial.addEventListener('pointerdown', (e) => {
  dragging = true;
  els.dial.setPointerCapture(e.pointerId);
  scrubToEvent(e);
});
els.dial.addEventListener('pointermove', (e) => { if (dragging) scrubToEvent(e); });
els.dial.addEventListener('pointerup', () => { dragging = false; });
els.dial.addEventListener('pointercancel', () => { dragging = false; });

/* ---------- wiring ---------- */
els.slider.addEventListener('input', () => setMinutes(Number(els.slider.value)));
els.btnPlay.addEventListener('click', () => setPlaying(!state.playing));
els.btnCycle.addEventListener('click', () => {
  state.cycleMode = !state.cycleMode;
  els.btnCycle.textContent = `↻ CYCLE: ${state.cycleMode ? 'ON' : 'OFF'}`;
  els.btnCycle.setAttribute('aria-pressed', String(state.cycleMode));
  state.cycleIdx = 0;
  renderCycle(); persist();
  announce(`Cycle mode ${state.cycleMode ? 'on — loops walk through stamped hours' : 'off'}`);
});
els.btnMute.addEventListener('click', () => {
  state.muted = !state.muted;
  if (master) master.gain.value = state.muted ? 0 : 0.8;
  els.btnMute.textContent = state.muted ? '🔇 MUTED' : '🔊 SOUND';
  els.btnMute.setAttribute('aria-pressed', String(state.muted));
});
els.btnStamp.addEventListener('click', stampCurrent);
els.btnDrop.addEventListener('click', () => {
  const h = state.cycle.pop();
  renderCycle(); updateShareLink(); persist();
  announce(h === undefined ? 'Cycle already empty' : `Dropped ${fmt(h * 60)}`);
});
els.btnClear.addEventListener('click', () => {
  state.cycle = []; state.cycleIdx = 0;
  renderCycle(); updateShareLink(); persist();
  announce('Cycle cleared');
});
els.btnDemo.addEventListener('click', () => {
  state.cycle = [6, 9, 12, 15, 18, 21, 0];
  state.cycleIdx = 0;
  setMinutes(360, { silent: true });
  renderCycle(); updateShareLink(); persist();
  announce('Demo day loaded: dawn to midnight in seven stamps');
});
els.btnCopy.addEventListener('click', copyLink);
els.btnSave.addEventListener('click', () => {
  const name = els.saveName.value.trim() || `day-${state.cycle.length}-stamps`;
  if (!state.cycle.length) { els.shareMsg.textContent = 'Stamp at least one hour first.'; return; }
  state.saved.push({ name, cycle: [...state.cycle] });
  store.save('slw.v1.saved', state.saved);
  els.saveName.value = '';
  renderSaved();
  announce(`Saved ${name}`);
});

/* global keyboard rig — skipped inside text fields; buttons keep native keys */
const isTexty = (el) => el && (el.tagName === 'INPUT' && el.type === 'text' || el.tagName === 'TEXTAREA');
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (isTexty(t)) { if (e.key === 'Escape') t.blur(); return; }
  const onButton = t && t.closest && t.closest('button');
  const onSlider = t === els.slider;
  const k = e.key;

  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    if (onSlider) return; // native slider = 1-min nudge, don't double-handle
    e.preventDefault();
    const d = (e.shiftKey ? 5 : 60) * (k === 'ArrowRight' ? 1 : -1);
    setMinutes(state.minutes + d);
  } else if (k === 'ArrowUp' || k === 'ArrowDown') {
    if (onSlider) return;
    e.preventDefault();
    setMinutes(state.minutes + (k === 'ArrowUp' ? 15 : -15));
  } else if (k === 'Home') { e.preventDefault(); setMinutes(360); }
  else if (k === 'End') { e.preventDefault(); setMinutes(1080); }
  else if (k === ' ' && !onButton) { e.preventDefault(); setPlaying(!state.playing); }
  else if (k === 'Enter' && t === document.body) { e.preventDefault(); stampCurrent(); }
  else if (k === 'Enter' && !onButton && !isTexty(t)) { stampCurrent(); }
  else if (k === 'Backspace' && !onButton) { e.preventDefault(); els.btnDrop.click(); }
  else if (k === 'm' || k === 'M') { els.btnMute.click(); }
  else if (k === 'l' || k === 'L') { els.btnCycle.click(); }
  else if (k === 'c' || k === 'C') { copyLink(); }
});

/* ---------- boot: shared links > saved state ---------- */
(function boot() {
  const shared = hashToCycle();
  if (shared) {
    state.cycle = shared.cyc;
    state.minutes = shared.t ?? shared.cyc[0] * 60;
  } else if (!Number.isInteger(state.minutes)) {
    state.minutes = 360;
  }
  if (!Array.isArray(state.cycle)) state.cycle = [];
  els.slider.value = state.minutes;
  els.btnCycle.textContent = `↻ CYCLE: ${state.cycleMode ? 'ON' : 'OFF'}`;
  els.btnCycle.setAttribute('aria-pressed', String(!!state.cycleMode));
  els.btnMute.textContent = state.muted ? '🔇 MUTED' : '🔊 SOUND';
  renderTime(); renderCycle(); renderSaved(); updateShareLink();
  requestAnimationFrame(drawDial);
  if (shared) announce(`Shared day loaded — ${shared.cyc.length} stamps. Press Space to play.`);
})();
