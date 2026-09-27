// Gravity Harp Garden — cyberpunk generative instrument.
// Strings bend under drag (spring physics), falling particles pluck them
// (pre-rendered Karplus-Strong samples), performances save as tiny seed loops.
'use strict';

const canvas = document.getElementById('stage');
const ctx2d = canvas.getContext('2d');
const live = document.getElementById('live');
const el = (id) => document.getElementById(id);
const audioStateEl = el('audioState'), scaleNameEl = el('scaleName'), loopStateEl = el('loopState');
const seedInput = el('seedCode');
const overdriveEl = el('overdrive');

const N = 7;
const BASE = 110; // A2
const SCALES = {
  penta:  { name: 'A-MINOR PENTA', steps: [0, 3, 5, 7, 10, 12, 15] },
  dorian: { name: 'D-DORIAN NEON', steps: [0, 2, 3, 5, 7, 9, 10] },
  hira:   { name: 'HIRA-JOSHI GRID', steps: [0, 2, 3, 7, 8, 12, 14] },
};
const NEON = ['#ff2bd6', '#ff7b00', '#ffb300', '#b6ff00', '#00f0ff', '#7b9bff', '#c26bff'];
let scaleKey = 'penta';
const semi = (i) => SCALES[scaleKey].steps[i % N];
const freqOf = (i) => BASE * Math.pow(2, semi(i) / 12);

// ---------- state ----------
let W = 0, H = 0, DPR = 1;
const strings = Array.from({ length: N }, (_, i) => ({
  i, bend: 0, bendV: 0, target: 0, grabbed: false, grabY: 0.5,
  glow: 0, coolUntil: 0, lastSoft: 0,
}));
let particles = [], sparks = [];
let selected = 3;
let keyBendDir = 0; // -1/0/+1 held via keyboard
let spawnAcc = 0;
let overdrive = false;
let eggClicks = 0;
let activeSlot = 0;

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
function say(msg) { live.textContent = msg; }
function stringX(i) { return ((i + 0.5) / N) * W; }
// x position of string i at vertical pixel y (quadratic bezier, t = y/H)
function stringXAt(s, y) {
  const t = clamp(y / H, 0, 1);
  const sx = stringX(s.i);
  const cx = sx + s.bend * 1.7;
  const u = 1 - t;
  return u * u * sx + 2 * u * t * cx + t * t * sx;
}

// ---------- canvas sizing ----------
function resize() {
  const r = canvas.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(200, r.width); H = Math.max(280, r.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// ---------- audio: sampled plucks ----------
let AC = null, master = null, delaySend = null, pluckBuf = [], muted = false;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch { say('Audio not supported in this browser.'); return false; }
  master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
  const delay = AC.createDelay(1); delay.delayTime.value = 0.31;
  const fb = AC.createGain(); fb.gain.value = 0.34;
  const wet = AC.createGain(); wet.gain.value = 0.3;
  delaySend = AC.createGain(); delaySend.gain.value = 1;
  delaySend.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  renderPlucks();
  audioStateEl.textContent = 'ONLINE'; audioStateEl.classList.remove('off');
  el('btnPower').classList.add('live');
  el('btnPower').firstChild.textContent = '⏻ LIVE ';
  return true;
}
// Karplus-Strong: render one 1.6s pluck sample per string into a buffer.
function renderPlucks() {
  if (!AC) return;
  const sr = AC.sampleRate, dur = 1.6, len = Math.floor(sr * dur);
  pluckBuf = [];
  for (let i = 0; i < N; i++) {
    const f = freqOf(i);
    const buf = AC.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const p = Math.max(2, Math.round(sr / f));
    const line = new Float32Array(p);
    for (let k = 0; k < p; k++) line[k] = Math.random() * 2 - 1;
    let idx = 0, peak = 0;
    const tmp = new Float32Array(len);
    for (let n = 0; n < len; n++) {
      const cur = line[idx];
      const nxt = line[(idx + 1) % p];
      const v = 0.996 * 0.5 * (cur + nxt);
      line[idx] = v; idx = (idx + 1) % p;
      tmp[n] = v; const a = Math.abs(v); if (a > peak) peak = a;
    }
    const g = peak > 0 ? 0.9 / peak : 1;
    for (let n = 0; n < len; n++) d[n] = tmp[n] * g * Math.exp(-n / (sr * 1.1));
    pluckBuf.push(buf);
  }
}
function pluck(i, vel = 1, detuneSemi = 0) {
  const s = strings[i];
  s.glow = Math.min(1.6, s.glow + 0.4 + vel * 0.7);
  burst(stringXAt(s, H * s.grabY), H * s.grabY, NEON[i], 6 + Math.round(vel * 8));
  if (!AC || muted || AC.state !== 'running') return;
  const t = AC.currentTime;
  const src = AC.createBufferSource();
  src.buffer = pluckBuf[i];
  src.playbackRate.value = Math.pow(2, clamp(detuneSemi, -4, 4) / 12);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = 900 + vel * 4200; lp.Q.value = 0.7;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25 + vel * 0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  src.connect(lp); lp.connect(g); g.connect(master); g.connect(delaySend);
  src.start(t); src.stop(t + 1.6);
  recordEvent(i, vel, detuneSemi);
}

// ---------- particles & sparks ----------
function shower(n = 26) {
  for (let k = 0; k < n; k++) {
    particles.push({
      x: Math.random() * W, y: -10 - Math.random() * H * 0.35,
      vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 90,
      px: 0, py: 0, hue: NEON[(Math.random() * N) | 0], dead: false,
    });
  }
  if (particles.length > 420) particles.splice(0, particles.length - 420);
}
function burst(x, y, color, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 220;
    sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.5 + Math.random() * 0.4, t: 0, color });
  }
  if (sparks.length > 500) sparks.splice(0, sparks.length - 500);
}

// ---------- pointer: drag to bend ----------
let dragIdx = -1;
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function nearestString(x, y) {
  let best = -1, bd = 1e9;
  for (const s of strings) {
    const d = Math.abs(stringXAt(s, y) - x);
    if (d < bd) { bd = d; best = s.i; }
  }
  return bd < 42 ? best : -1;
}
canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  const p = canvasPos(e);
  const idx = nearestString(p.x, p.y);
  if (idx >= 0) {
    dragIdx = idx; selected = idx;
    const s = strings[idx];
    s.grabbed = true; s.grabY = clamp(p.y / H, 0.05, 0.95);
    s.target = clamp(p.x - stringX(idx), -150, 150);
    canvas.setPointerCapture(e.pointerId);
    refreshSlots();
  } else {
    shower(8); // tap empty grid => sprinkle
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (dragIdx < 0) return;
  const p = canvasPos(e);
  const s = strings[dragIdx];
  s.grabY = clamp(p.y / H, 0.05, 0.95);
  s.target = clamp(p.x - stringX(dragIdx), -150, 150);
  // fast drag rips soft plucks
  const t = now();
  if (Math.abs(s.bendV) > 480 && t - s.lastSoft > 320) {
    s.lastSoft = t;
    pluck(dragIdx, 0.35, s.bend / 90);
  }
});
function endDrag() {
  if (dragIdx < 0) return;
  const s = strings[dragIdx];
  s.grabbed = false; s.target = 0;
  // spring snap: release velocity => pluck
  const snap = clamp((Math.abs(s.bendV) / 900) + (Math.abs(s.bend) / 220), 0, 1.2);
  if (snap > 0.12) pluck(dragIdx, Math.max(0.3, snap), s.bend / 110);
  dragIdx = -1;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- keyboard: full control, no mouse needed ----------
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiPos = 0;
function inField(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); }

document.addEventListener('keydown', (e) => {
  // konami easter egg (anywhere except text fields)
  if (!inField(e)) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiPos = (k === KONAMI[konamiPos]) ? konamiPos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (konamiPos === KONAMI.length) { konamiPos = 0; toggleOverdrive(); return; }
  }
  if (inField(e)) { if (e.key === 'Escape') e.target.blur(); return; }

  const k = e.key;
  if (k >= '1' && k <= '7') { // pluck, shift = hard bend pluck
    ensureAudio();
    const i = +k - 1;
    selected = i;
    const s = strings[i];
    if (e.shiftKey) { s.bend = 110 * (i % 2 ? 1 : -1); s.bendV = -s.bend * 9; }
    pluck(i, e.shiftKey ? 1 : 0.8, s.bend / 110);
    say(`String ${k} plucked.`);
    refreshSlots(); e.preventDefault(); return;
  }
  switch (k) {
    case 'ArrowLeft': selected = (selected + N - 1) % N; say(`String ${selected + 1} selected.`); refreshSlots(); e.preventDefault(); break;
    case 'ArrowRight': selected = (selected + 1) % N; say(`String ${selected + 1} selected.`); refreshSlots(); e.preventDefault(); break;
    case 'ArrowUp': case 'a': case 'A': keyBendDir = -1; ensureAudio(); e.preventDefault(); break;
    case 'ArrowDown': case 'd': case 'D':
      // 'd' bends right; ArrowDown also bends (symmetric for one-hand play)
      keyBendDir = (k === 'ArrowDown') ? 1 : 1; ensureAudio(); e.preventDefault(); break;
    case ' ': ensureAudio(); shower(overdrive ? 60 : 26); say('Particle shower.'); e.preventDefault(); break;
    case 'r': case 'R': toggleRecord(); break;
    case 'p': case 'P': togglePlay(); break;
    case 'm': case 'M': toggleMute(); break;
    case 's': case 'S': copySeed(); break;
    case 'l': case 'L': plantSeed(); break;
    case 'z': case 'Z': setSlot(0); break;
    case 'x': case 'X': setSlot(1); break;
    case 'c': case 'C': setSlot(2); break;
    case 'v': case 'V': setSlot(3); break;
    case 'h': case 'H': case '?': { const d = el('helpBox'); d.open = !d.open; break; }
  }
  // A/D direction: A bends left, D bends right (ArrowUp bends left too)
  if (k === 'a' || k === 'A' || k === 'ArrowUp') keyBendDir = -1;
});
document.addEventListener('keyup', (e) => {
  const k = e.key;
  if (['ArrowUp','ArrowDown','a','A','d','D'].includes(k)) {
    // release held bend => spring snap + pluck
    if (keyBendDir !== 0) {
      const s = strings[selected];
      const snap = clamp(Math.abs(s.bend) / 200, 0, 1.1);
      s.target = 0;
      if (snap > 0.1) pluck(selected, Math.max(0.35, snap), s.bend / 110);
      keyBendDir = 0;
    }
  }
});

// ---------- seed loops ----------
const LS_KEY = 'ghg.seeds.v1';
let slots = [null, null, null, null];
try {
  const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  if (Array.isArray(raw)) for (let i = 0; i < 4; i++) if (raw[i] && Array.isArray(raw[i].events)) slots[i] = raw[i];
} catch { /* fresh garden */ }
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(slots)); } catch {} }

let recording = null; // {start, events:[{i,dt,vel,det}]}
let playing = null;   // {loop, t0, timer}
function recordEvent(i, vel, det) {
  if (!recording) return;
  recording.events.push({ i, dt: now() - recording.start, vel: +vel.toFixed(2), det: +det.toFixed(2) });
}
function toggleRecord() {
  ensureAudio();
  if (recording) {
    const len = clamp(now() - recording.start, 1500, 16000);
    const ev = recording.events;
    recording = null;
    el('btnRec').classList.remove('armed'); el('btnRec').setAttribute('aria-pressed', 'false');
    if (!ev.length) { loopStateEl.textContent = 'EMPTY'; say('Nothing recorded.'); return; }
    slots[activeSlot] = { scale: scaleKey, len: Math.round(len), events: ev.slice(0, 128), n: ev.length };
    persist(); fillSeedBox(); refreshSlots();
    loopStateEl.textContent = 'READY'; loopStateEl.classList.remove('rec');
    say(`Seed ${activeSlot + 1} saved, ${ev.length} plucks.`);
  } else {
    stopPlay();
    recording = { start: now(), events: [] };
    el('btnRec').classList.add('armed'); el('btnRec').setAttribute('aria-pressed', 'true');
    loopStateEl.textContent = '● REC'; loopStateEl.classList.add('rec');
    say('Recording. Pluck strings, press R to finish.');
  }
}
function togglePlay() {
  ensureAudio();
  if (playing) { stopPlay(); return; }
  if (recording) { say('Finish recording (R) before playing.'); return; }
  const loop = slots[activeSlot];
  if (!loop || !loop.events.length) { say(`Seed ${activeSlot + 1} is empty. Record first with R.`); return; }
  if (loop.scale && loop.scale !== scaleKey) { scaleKey = loop.scale; el('scaleSel').value = scaleKey; applyScale(); }
  playing = { loop, t0: now(), last: 0, timer: 0 };
  playing.timer = setInterval(scheduleLoop, 80);
  el('btnPlay').setAttribute('aria-pressed', 'true');
  loopStateEl.textContent = 'PLAYING'; loopStateEl.classList.remove('rec');
  say(`Playing seed ${activeSlot + 1}, ${loop.events.length} plucks.`);
}
function scheduleLoop() {
  if (!playing) return;
  const { loop } = playing;
  const elapsed = (now() - playing.t0) % loop.len;
  const prev = playing.last;
  playing.last = elapsed;
  const inWindow = (at) => {
    if (elapsed >= prev) return at > prev && at <= elapsed + 90; // +90ms lookahead
    return at > prev || at <= elapsed + 90; // wrapped
  };
  for (const ev of loop.events) {
    const at = ((ev.dt % loop.len) + loop.len) % loop.len;
    if (inWindow(at)) {
      const delay = Math.max(0, at - elapsed);
      setTimeout(((e) => () => {
        selected = e.i;
        pluck(e.i, e.vel ?? 0.8, e.det ?? 0);
        refreshSlots();
      })(ev), Math.min(delay, 200));
    }
  }
}
function stopPlay() {
  if (!playing) return;
  clearInterval(playing.timer); playing = null;
  el('btnPlay').setAttribute('aria-pressed', 'false');
  const loop = slots[activeSlot];
  loopStateEl.textContent = loop && loop.events.length ? 'READY' : 'EMPTY';
  say('Loop stopped.');
}
function setSlot(i) {
  stopPlay(); activeSlot = i; refreshSlots(); fillSeedBox();
  say(`Seed slot ${i + 1} selected.`);
}
function encodeLoop(loop) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(loop)))).replace(/=+$/, '');
}
function decodeLoop(code) {
  const s = code.trim().replace(/\s+/g, '');
  if (!s) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  const o = JSON.parse(decodeURIComponent(escape(atob(padded))));
  if (!o || !Array.isArray(o.events) || !o.events.length || o.events.length > 256) return null;
  o.events = o.events.filter((e) => Number.isInteger(e.i) && e.i >= 0 && e.i < N).slice(0, 128);
  if (!o.events.length) return null;
  o.len = clamp(+o.len || 4000, 1500, 16000);
  if (!SCALES[o.scale]) o.scale = scaleKey;
  return o;
}
function fillSeedBox() {
  const loop = slots[activeSlot];
  seedInput.value = loop ? encodeLoop(loop) : '';
}
function copySeed() {
  const loop = slots[activeSlot];
  if (!loop) { say(`Seed ${activeSlot + 1} is empty. Record first.`); return; }
  fillSeedBox();
  seedInput.select();
  const done = () => say(`Seed ${activeSlot + 1} copied. ${loop.events.length} plucks.`);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(seedInput.value).then(done, () => done());
  else { document.execCommand?.('copy'); done(); }
}
function plantSeed() {
  try {
    const loop = decodeLoop(seedInput.value);
    if (!loop) { say('That seed code did not grow. Check the text and try again.'); return; }
    stopPlay();
    slots[activeSlot] = loop; persist(); refreshSlots();
    if (loop.scale !== scaleKey) { scaleKey = loop.scale; el('scaleSel').value = scaleKey; applyScale(); }
    loopStateEl.textContent = 'READY';
    say(`Seed planted in slot ${activeSlot + 1}. Press P to play.`);
  } catch { say('That seed code did not grow. Check the text and try again.'); }
}
function refreshSlots() {
  document.querySelectorAll('.slot').forEach((b) => {
    const i = +b.dataset.slot;
    const loop = slots[i];
    b.classList.toggle('active', i === activeSlot);
    b.classList.toggle('has-loop', !!(loop && loop.events.length));
    b.querySelector('.slot-meta').textContent =
      loop && loop.events.length ? `${loop.events.length} plucks · ${(loop.len / 1000).toFixed(1)}s` : 'empty';
  });
  const loop = slots[activeSlot];
  if (!recording && !playing) loopStateEl.textContent = loop && loop.events.length ? 'READY' : 'EMPTY';
}

// ---------- easter egg: OVERDRIVE_2077 ----------
let ghostTimer = 0;
function toggleOverdrive() {
  overdrive = !overdrive;
  overdriveEl.hidden = !overdrive;
  if (overdrive) {
    ensureAudio(); shower(60);
    say('Overdrive engaged. Ghost player online.');
    let step = 0;
    ghostTimer = setInterval(() => {
      if (!overdrive) return;
      step++;
      const i = (Math.floor(Math.random() * N) + step) % N;
      selected = i;
      pluck(i, 0.55 + Math.random() * 0.45, (Math.random() - 0.5) * 1.5);
      if (step % 4 === 0) shower(14);
      refreshSlots();
    }, 430);
  } else {
    clearInterval(ghostTimer);
    say('Jacked out. Garden nominal.');
  }
}
el('eggDot').addEventListener('click', () => {
  eggClicks++;
  if (eggClicks >= 5) { eggClicks = 0; toggleOverdrive(); }
  else say(`Mystery node hums… (${eggClicks}/5)`);
});

// ---------- controls ----------
el('btnPower').addEventListener('click', () => {
  if (!AC) { ensureAudio(); say('Audio live. Pluck something.'); return; }
  if (AC.state === 'running') {
    AC.suspend(); audioStateEl.textContent = 'PAUSED'; el('btnPower').classList.remove('live');
  } else { AC.resume(); audioStateEl.textContent = 'ONLINE'; el('btnPower').classList.add('live'); }
});
el('btnRain').addEventListener('click', () => { ensureAudio(); shower(overdrive ? 60 : 26); });
function toggleMute() {
  muted = !muted;
  if (master && AC) master.gain.setTargetAtTime(muted ? 0 : 0.9, AC.currentTime, 0.02);
  const b = el('btnMute');
  b.setAttribute('aria-pressed', String(muted));
  b.firstChild.textContent = muted ? '✕ MUTED ' : '♪ SOUND ON ';
  say(muted ? 'Muted.' : 'Sound on.');
}
el('btnMute').addEventListener('click', toggleMute);
el('btnRec').addEventListener('click', toggleRecord);
el('btnPlay').addEventListener('click', togglePlay);
el('btnClear').addEventListener('click', () => {
  stopPlay(); slots[activeSlot] = null; persist(); fillSeedBox(); refreshSlots();
  say(`Seed ${activeSlot + 1} cleared.`);
});
function applyScale() {
  scaleNameEl.textContent = SCALES[scaleKey].name;
  renderPlucks();
}
el('scaleSel').addEventListener('change', (e) => { scaleKey = e.target.value; applyScale(); say(`Scale: ${SCALES[scaleKey].name}.`); });
document.querySelectorAll('.slot').forEach((b) => b.addEventListener('click', () => setSlot(+b.dataset.slot)));
el('btnSeedCopy').addEventListener('click', copySeed);
el('btnSeedPlant').addEventListener('click', () => { ensureAudio(); plantSeed(); });

// ---------- simulation ----------
let last = now();
function frame() {
  const t = now();
  let dt = Math.min(0.033, (t - last) / 1000); last = t;

  // keyboard bend hold
  if (keyBendDir !== 0) {
    const s = strings[selected];
    s.target = clamp(s.target + keyBendDir * 320 * dt, -150, 150);
  }
  // string spring physics
  for (const s of strings) {
    // grabbed: stiff pull toward target; free: damped spring to 0 with wobble
    const k = s.grabbed ? 180 : 110;
    const c = s.grabbed ? 14 : 2.6;
    if (s.grabbed) {
      const prev = s.bend;
      s.bend += (s.target - s.bend) * Math.min(1, 22 * dt);
      if (dt > 0) s.bendV = 0.85 * s.bendV + 0.15 * ((s.bend - prev) / dt);
    }
    else {
      const a = -k * s.bend - c * s.bendV + (keyBendDir !== 0 && s.i === selected ? 900 * keyBendDir : 0);
      s.bendV += a * dt; s.bend += s.bendV * dt;
      if (Math.abs(s.bend) < 0.02 && Math.abs(s.bendV) < 2) { s.bend = 0; s.bendV = 0; }
    }
    s.glow = Math.max(0, s.glow - dt * 2.2);
  }

  // spawn ambient particles
  spawnAcc += dt * (overdrive ? 20 : 5.5);
  while (spawnAcc >= 1) { spawnAcc -= 1; shower(1); }

  // particles: gravity + string wells + collisions
  for (const p of particles) {
    p.px = p.x; p.py = p.y;
    p.vy += 260 * dt;
    for (const s of strings) {
      const sx = stringXAt(s, p.y);
      const dx = sx - p.x;
      const pull = clamp(s.bend * 2.2, -260, 260);
      p.vx += clamp(dx * 1.6, -320, 320) * dt + pull * dt * 0.35;
    }
    p.vx *= (1 - 0.4 * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.y > H + 20 || p.x < -30 || p.x > W + 30) { p.dead = true; continue; }
    // collision with any string
    const tt = now();
    for (const s of strings) {
      if (tt < s.coolUntil) continue;
      if (Math.abs(stringXAt(s, p.y) - p.x) < 9 && p.vy > 0) {
        s.coolUntil = tt + 130;
        selected = s.i;
        pluck(s.i, clamp(0.35 + p.vy / 500, 0.35, 1), s.bend / 110);
        burst(p.x, p.y, p.hue, 5);
        p.dead = true; refreshSlots();
        break;
      }
    }
  }
  particles = particles.filter((p) => !p.dead);
  // sparks
  for (const g of sparks) {
    g.t += dt; g.vy += 300 * dt;
    g.x += g.vx * dt; g.y += g.vy * dt;
  }
  sparks = sparks.filter((g) => g.t < g.life);

  render(t / 1000);
  requestAnimationFrame(frame);
}

// ---------- render ----------
function render(time) {
  ctx2d.clearRect(0, 0, W, H);
  // faint horizon grid
  ctx2d.save();
  ctx2d.strokeStyle = 'rgba(123,43,255,0.16)'; ctx2d.lineWidth = 1;
  for (let gy = H * 0.12; gy < H; gy += 46) {
    ctx2d.beginPath(); ctx2d.moveTo(0, gy); ctx2d.lineTo(W, gy); ctx2d.stroke();
  }
  ctx2d.restore();

  const hueShift = overdrive ? (time * 90) % 360 : 0;
  for (const s of strings) {
    const sx = stringX(s.i);
    const cx = sx + s.bend * 1.7, cy = s.grabY * H;
    const base = NEON[s.i];
    const col = overdrive ? `hsl(${(hueShift + s.i * 47) % 360} 100% 62%)` : base;
    // aura
    ctx2d.save();
    ctx2d.strokeStyle = col;
    ctx2d.globalAlpha = 0.16 + s.glow * 0.25;
    ctx2d.lineWidth = 10 + s.glow * 10;
    ctx2d.shadowColor = col; ctx2d.shadowBlur = 26;
    ctx2d.beginPath(); ctx2d.moveTo(sx, 0);
    ctx2d.quadraticCurveTo(cx, cy, sx, H); ctx2d.stroke();
    // core
    ctx2d.globalAlpha = 1;
    ctx2d.lineWidth = (s.i === selected ? 3 : 2) + Math.min(2, s.glow);
    ctx2d.shadowBlur = 12 + s.glow * 22;
    ctx2d.beginPath(); ctx2d.moveTo(sx, 0);
    ctx2d.quadraticCurveTo(cx, cy, sx, H); ctx2d.stroke();
    ctx2d.restore();
    // anchors
    for (const ay of [6, H - 6]) {
      ctx2d.save();
      ctx2d.fillStyle = col; ctx2d.shadowColor = col; ctx2d.shadowBlur = 12;
      ctx2d.beginPath(); ctx2d.arc(sx, ay, 4, 0, Math.PI * 2); ctx2d.fill();
      ctx2d.restore();
    }
    // label: key number + note
    ctx2d.save();
    const lbl = `${s.i + 1}`;
    ctx2d.font = '700 11px "Share Tech Mono", monospace';
    ctx2d.fillStyle = s.i === selected ? '#ffffff' : 'rgba(242,233,255,0.55)';
    ctx2d.shadowColor = col; ctx2d.shadowBlur = s.i === selected ? 10 : 0;
    ctx2d.fillText(s.i === selected ? `▶ ${lbl}` : lbl, sx - 10, H - 16);
    ctx2d.restore();
  }
  // selected bend meter
  const sel = strings[selected];
  if (Math.abs(sel.bend) > 2) {
    ctx2d.save();
    ctx2d.fillStyle = 'rgba(182,255,0,0.75)';
    const bw = clamp(Math.abs(sel.bend), 0, 150) / 150 * 60;
    ctx2d.fillRect(sel.bend > 0 ? stringX(selected) + 8 : stringX(selected) - 8 - bw, 22, bw, 4);
    ctx2d.restore();
  }
  // particles
  ctx2d.save();
  ctx2d.lineWidth = 2; ctx2d.lineCap = 'round';
  for (const p of particles) {
    ctx2d.strokeStyle = p.hue; ctx2d.shadowColor = p.hue; ctx2d.shadowBlur = 8;
    ctx2d.globalAlpha = 0.9;
    ctx2d.beginPath(); ctx2d.moveTo(p.px || p.x, p.py || p.y); ctx2d.lineTo(p.x, p.y); ctx2d.stroke();
    ctx2d.fillStyle = '#fff';
    ctx2d.beginPath(); ctx2d.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx2d.fill();
  }
  ctx2d.restore();
  // sparks
  ctx2d.save();
  ctx2d.lineWidth = 1.5;
  for (const g of sparks) {
    ctx2d.globalAlpha = 1 - g.t / g.life;
    ctx2d.strokeStyle = g.color; ctx2d.shadowColor = g.color; ctx2d.shadowBlur = 6;
    ctx2d.beginPath(); ctx2d.moveTo(g.x, g.y);
    ctx2d.lineTo(g.x - g.vx * 0.03, g.y - g.vy * 0.03); ctx2d.stroke();
  }
  ctx2d.restore();
  ctx2d.save();
  ctx2d.globalAlpha = 1;
  ctx2d.restore();
}

// ---------- init ----------
applyScale();
refreshSlots();
fillSeedBox();
if (loopStateEl.textContent === '') loopStateEl.textContent = 'EMPTY';
audioStateEl.classList.add('off');
shower(30);
requestAnimationFrame(frame);
console.log('gravity-harp-garden ready: 7 strings, KS plucks, seed slots');
