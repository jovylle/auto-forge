// Chrono Tide Conservatory — generative tidal loop instrument
// Live dials (lunar+harmonic tide model) · WebAudio loop · 30d scrub/breed · offline WAV stem export
// Fully keyboard-operable: native controls + shortcuts (Space 1-4 L [ ] B E ?)
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SYNODIC = 29.530588853;
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // known new moon
const STORE_KEY = 'ctc-v1';

// ---------- seeded rng ----------
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tide + moon model ----------
const lunarAge = (date = new Date()) =>
  (((date.getTime() - REF_NEW_MOON) / 864e5) % SYNODIC + SYNODIC) % SYNODIC;

const MOON_NAMES = [
  [1.845, 'New Moon', '○'], [5.53, 'Waxing Crescent', '◔'], [9.22, 'First Quarter', '◑'],
  [12.91, 'Waxing Gibbous', '◕'], [16.61, 'Full Moon', '●'], [20.30, 'Waning Gibbous', '◕'],
  [23.99, 'Last Quarter', '◐'], [27.68, 'Waning Crescent', '◔'], [99, 'New Moon', '○'],
];
const moonInfo = (age) => MOON_NAMES.find(([lim]) => age < lim).slice(1);
const illum = (age) => (1 - Math.cos((age / SYNODIC) * Math.PI * 2)) / 2;

// Harmonic-ish tide: M2 (12.42h) + S2 (12h, spring/neap by moon) + K1 diurnal. Returns metres ~[-1.6,1.6].
function tideHeight(date = new Date(), age = lunarAge(date)) {
  const tH = date.getTime() / 36e5;
  const spring = 0.55 + 0.45 * Math.cos((age / SYNODIC) * Math.PI * 2); // big at new/full
  const m2 = Math.cos((tH / 12.4206) * Math.PI * 2 + 1.1);
  const s2 = 0.42 * spring * Math.cos((tH / 12.0) * Math.PI * 2 + 0.4);
  const k1 = 0.28 * Math.cos((tH / 23.934) * Math.PI * 2);
  return (m2 + s2 + k1) * 0.85;
}
function tideDirection(date = new Date()) {
  const d = tideHeight(new Date(date.getTime() + 6e4)) - tideHeight(new Date(date.getTime() - 6e4));
  return d >= 0 ? 'flood · rising' : 'ebb · falling';
}
function nextExtreme(date = new Date()) {
  // scan forward 13h in 3-min steps for sign change of derivative
  const step = 3 * 6e4;
  let prev = tideHeight(date), prevD = tideHeight(new Date(+date + step)) - prev;
  for (let t = +date + step; t < +date + 13 * 36e5; t += step) {
    const d = tideHeight(new Date(t + step)) - tideHeight(new Date(t));
    if ((prevD > 0) !== (d > 0)) {
      const when = new Date(t);
      return { high: d < 0, at: when };
    }
    prevD = d;
  }
  return { high: true, at: new Date(+date + 6 * 36e5) };
}
const fmtClock = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ---------- state ----------
const defaults = {
  playing: false, loopBars: 8, scrub: 0, breedSeed: null,
  master: 70, vols: { swell: 80, undertow: 70, drone: 65, shimmer: 75 },
  mutes: { swell: false, undertow: false, drone: false, shimmer: false },
};
let state = { ...defaults, vols: { ...defaults.vols }, mutes: { ...defaults.mutes } };
try {
  const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (raw) state = { ...state, ...raw, vols: { ...state.vols, ...raw.vols }, mutes: { ...state.mutes, ...raw.mutes } };
} catch { /* fresh */ }
state.playing = false;
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, playing: false })); } catch {} };

const daySeedOf = (daysAgo) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysAgo);
  return `tide-${d.toISOString().slice(0, 10)}`;
};
const activeSeed = () => state.breedSeed || daySeedOf(0);
const announce = (msg) => { $('#liveLine').innerHTML = `<span class="dot" aria-hidden="true"></span>${msg}`; };

// ---------- dial ticks ----------
function buildTicks(id, n, majorEvery = 3) {
  const g = $(id); if (!g) return;
  const NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const major = i % majorEvery === 0;
    const r1 = major ? 72 : 79, r2 = 86;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', 100 + r1 * Math.sin(a)); l.setAttribute('y1', 100 - r1 * Math.cos(a));
    l.setAttribute('x2', 100 + r2 * Math.sin(a)); l.setAttribute('y2', 100 - r2 * Math.cos(a));
    l.setAttribute('stroke', major ? '#9fd8cb' : '#2c443b');
    l.setAttribute('stroke-width', major ? 3 : 1.5);
    g.appendChild(l);
  }
}
buildTicks('#tideTicks', 24, 6); buildTicks('#moonTicks', 30, 5); buildTicks('#dayTicks', 24, 6);

// ---------- chart ----------
function drawChart() {
  const c = $('#tideChart'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, pad = 14;
  ctx.clearRect(0, 0, W, H);
  // 30-day envelope: sample tide range per day
  const days = [];
  for (let ago = 29; ago >= 0; ago--) {
    const base = new Date(); base.setHours(12, 0, 0, 0); base.setDate(base.getDate() - ago);
    let mn = 9, mx = -9;
    for (let h = 0; h < 24; h += 1) {
      const v = tideHeight(new Date(+base + h * 36e5));
      mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    days.push({ ago, mn, mx, age: lunarAge(base) });
  }
  const y = (v) => H - pad - ((v + 1.8) / 3.6) * (H - pad * 2);
  // zero line
  ctx.strokeStyle = '#2c443b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(W - pad, y(0)); ctx.stroke();
  // area
  const x = (i) => pad + (i / 29) * (W - pad * 2);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#9fd8cb55'); grad.addColorStop(1, '#d96f3c33');
  ctx.beginPath();
  days.forEach((d, i) => { i ? ctx.lineTo(x(i), y(d.mx)) : ctx.moveTo(x(0), y(d.mx)); });
  [...days].reverse().forEach((d, ri) => ctx.lineTo(x(29 - ri), y(d.mn)));
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); days.forEach((d, i) => { i ? ctx.lineTo(x(i), y(d.mx)) : ctx.moveTo(x(0), y(d.mx)); });
  ctx.strokeStyle = '#9fd8cb'; ctx.lineWidth = 2.5; ctx.stroke();
  // new/full markers
  ctx.font = '13px "Space Mono", monospace'; ctx.textAlign = 'center';
  days.forEach((d, i) => {
    if (d.age < 1.2 || Math.abs(d.age - SYNODIC / 2) < 0.8) {
      ctx.fillStyle = d.age < 1.2 ? '#b9b09a' : '#ece4cf';
      ctx.fillText(d.age < 1.2 ? '○' : '●', x(i), H - 2);
    }
  });
  // scrub cursor (ago=0 is rightmost)
  const ci = 29 - state.scrub;
  ctx.strokeStyle = '#d96f3c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x(ci), 6); ctx.lineTo(x(ci), H - 6); ctx.stroke();
  ctx.fillStyle = '#d96f3c';
  ctx.fillText('▼', x(ci), 16);
}

// ---------- dials + readouts ----------
function updateDials() {
  const now = new Date();
  const age = lunarAge(now), h = tideHeight(now, age);
  // needles: tide maps [-1.8,1.8] -> [-135°,135°]; moon age -> 360°; day -> 360°
  $('#needleTide').style.transform = `rotate(${clamp(h / 1.8, -1, 1) * 135}deg)`;
  $('#needleMoon').style.transform = `rotate(${(age / SYNODIC) * 360}deg)`;
  const dayFrac = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  $('#needleDay').style.transform = `rotate(${dayFrac * 360}deg)`;
  const [mName, glyph] = moonInfo(age);
  $('#moonGlyph').textContent = glyph;

  $('#tideHeight').textContent = `${h >= 0 ? '+' : ''}${h.toFixed(2)} m`;
  $('#tideDir').textContent = tideDirection(now);
  const nx = nextExtreme(now);
  $('#tideNext').textContent = `next ${nx.high ? 'high' : 'low'} ${fmtClock(nx.at)}`;
  $('#moonName').textContent = mName;
  const full = ((SYNODIC - age) % SYNODIC);
  $('#moonAge').textContent = `age ${age.toFixed(1)} d · illum ${Math.round(illum(age) * 100)}%`;
  $('#moonNext').textContent = `full moon in ${full > SYNODIC / 2 ? (SYNODIC - full).toFixed(1) : full.toFixed(1)} d`;
  $('#clockNow').textContent = now.toLocaleTimeString([], { hour12: false });

  const stepsPerLoop = state.loopBars * 8;
  const pos = audio.loopStep % stepsPerLoop;
  const bar = Math.floor(pos / 8) + 1;
  $('#loopPos').textContent = audio.playing ? `loop bar ${bar} / ${state.loopBars}` : 'loop idle — press play';
  const arc = $('#loopArc'), C = 439.8;
  arc.style.strokeDashoffset = String(C * (1 - pos / stepsPerLoop));

  // scrub readout
  const ago = state.scrub;
  const d = new Date(); d.setDate(d.getDate() - ago);
  const sAge = lunarAge(d), [sName] = moonInfo(sAge);
  $('#scrubOut').textContent = ago === 0 ? 'today' : `${ago}d ago · ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  $('#scrubInfo').textContent =
    `${ago === 0 ? 'today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${sName.toLowerCase()} · seed ${daySeedOf(ago)}` +
    (state.breedSeed ? ` · ✦ bred: ${state.breedSeed}` : '');
}

// ==================================================================
// AUDIO — one shared voice recipe for live + offline render
// ==================================================================
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]; // semitones
const ROOT = 196; // G3
const semi = (n) => ROOT * Math.pow(2, n / 12);
const BPM = 72, STEP = 60 / BPM / 2; // 8th notes
const loopDur = () => state.loopBars * 8 * STEP;

function makeNoise(ctx, seconds = 4) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
const stemVol = (name) => (state.mutes[name] ? 0 : state.vols[name] / 100);

// Render ONE stem (or 'mix') into an OfflineAudioContext of one full loop.
async function renderStem(name, seconds) {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // gentle space: feedback delay shared
  const delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const wet = ctx.createGain(); wet.gain.value = 0.25;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  master.connect(ctx.destination);

  const now = new Date(), age = lunarAge(now), tide = tideHeight(now, age);
  const moon01 = age / SYNODIC;
  const rnd = mulberry32(hashStr(activeSeed() + ':' + name));
  const want = (s) => name === 'mix' || name === s;

  const out = (node, stemName, base = 0.5) => {
    const g = ctx.createGain(); g.gain.value = base * (name === 'mix' ? stemVol(stemName) : 1);
    node.connect(g); g.connect(master); g.connect(delay);
  };

  if (want('swell')) {
    const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(320 + (tide + 1.8) * 160, 0);
    bp.frequency.linearRampToValueAtTime(320 + (1.8 - tide) * 160, seconds); // seamless-ish mirror
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    // two breathing swells per loop
    for (let i = 0; i <= 2; i++) {
      const t = (i / 2) * seconds;
      g.gain.linearRampToValueAtTime(0.5, t + seconds / 6);
      if (i < 2) g.gain.linearRampToValueAtTime(0.08, t + seconds / 3);
    }
    src.connect(bp); bp.connect(g); out(g, 'swell', 0.9);
    src.start(0); src.stop(seconds);
  }
  if (want('undertow')) {
    const f = 48 + moon01 * 22;
    const g = ctx.createGain(); g.gain.value = 0.34;
    [1, 1.5].forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const og = ctx.createGain(); og.gain.value = i ? 0.35 : 1;
      o.connect(og); og.connect(g); o.start(0); o.stop(seconds);
    });
    // slow tide LFO on level
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2 / seconds;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(g.gain); lfo.start(0); lfo.stop(seconds);
    out(g, 'undertow', 1);
  }
  if (want('drone')) {
    const rootIdx = Math.floor(moon01 * PENTA.length) % PENTA.length;
    [0, 1, 2].forEach((v) => {
      const o = ctx.createOscillator();
      o.type = v === 2 ? 'sine' : 'triangle';
      o.frequency.value = semi(PENTA[(rootIdx + v * 2) % PENTA.length]) / 2;
      o.detune.value = (rnd() - 0.5) * 14;
      const g = ctx.createGain(); g.gain.value = v === 2 ? 0.2 : 0.11;
      // fade edges for seamless loop
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.linearRampToValueAtTime(v === 2 ? 0.2 : 0.11, 0.4);
      g.gain.setValueAtTime(v === 2 ? 0.2 : 0.11, seconds - 0.4);
      g.gain.linearRampToValueAtTime(0.0001, seconds);
      // slow shimmer LFO
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1 + rnd() * 0.15;
      const lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(0); lfo.stop(seconds);
      o.connect(g); out(g, 'drone', 1); o.start(0); o.stop(seconds);
    });
  }
  if (want('shimmer')) {
    const steps = state.loopBars * 8;
    const rootIdx = Math.floor(moon01 * PENTA.length) % PENTA.length;
    for (let s = 0; s < steps; s++) {
      if (rnd() < (s % 2 ? 0.3 : 0.55)) {
        const t = s * STEP + rnd() * 0.02;
        if (t >= seconds) continue;
        const deg = PENTA[Math.floor(rnd() * PENTA.length)];
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = semi(deg + 12) * (rnd() < 0.2 ? 1.5 : 1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.28, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); out(g, 'shimmer', 1);
        o.start(t); o.stop(Math.min(seconds, t + 1));
      }
    }
  }
  return ctx.startRendering();
}

// ---------- live engine (persistent graph + pluck scheduler) ----------
const audio = { ctx: null, playing: false, loopStep: 0, nodes: null, timer: null, nextT: 0 };
let liveBP = null, liveSwellG = null;

function ensureCtx() {
  if (audio.ctx) return audio.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = (state.master / 100) * 0.9;
  master.connect(ctx.destination);
  const delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

  const N = {};
  const bus = (base) => {
    const g = ctx.createGain(); g.gain.value = base;
    g.connect(master); g.connect(delay);
    return g;
  };
  // swell
  const nsrc = ctx.createBufferSource(); nsrc.buffer = makeNoise(ctx); nsrc.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 500;
  const swellG = ctx.createGain(); swellG.gain.value = 0.25;
  nsrc.connect(bp); bp.connect(swellG); N.swellBus = bus(0.9); swellG.connect(N.swellBus); nsrc.start();
  liveBP = bp; liveSwellG = swellG;
  // undertow
  N.underBus = bus(1);
  N.underLevel = ctx.createGain(); N.underLevel.gain.value = 0.34;
  N.underLevel.connect(N.underBus);
  N.underOsc = [1, 1.5].map((m, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 55 * m;
    const g = ctx.createGain(); g.gain.value = i ? 0.35 : 1;
    o.connect(g); g.connect(N.underLevel); o.start(); return { o, m };
  });
  // drone
  N.droneBus = bus(1);
  N.droneOsc = [0, 1, 2].map(() => {
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain(); g.gain.value = 0.1;
    o.connect(g); g.connect(N.droneBus); o.start(); return { o, g };
  });
  // shimmer bus only (plucks scheduled)
  N.shimBus = bus(1);

  audio.ctx = ctx; audio.nodes = { master, ...N };
  return ctx;
}

function livePluck(when, freq) {
  const { ctx, nodes } = audio;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.3 * stemVol('shimmer'), when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
  o.connect(g); g.connect(nodes.shimBus);
  o.start(when); o.stop(when + 1);
}

function schedulerTick() {
  const { ctx } = audio;
  const age = lunarAge(), tide = tideHeight(new Date(), age), moon01 = age / SYNODIC;
  const rnd = mulberry32(hashStr(activeSeed() + ':shimmer') + audio.loopStep);
  while (audio.nextT < ctx.currentTime + 0.35) {
    const step = audio.loopStep;
    if (rnd() < (step % 2 ? 0.3 : 0.55)) {
      const deg = PENTA[Math.floor(rnd() * PENTA.length)];
      livePluck(audio.nextT, semi(deg + 12));
    }
    audio.nextT += STEP;
    audio.loopStep = (audio.loopStep + 1) % (state.loopBars * 8);
  }
  // continuous voices follow tide + mixer
  const N = audio.nodes, t = ctx.currentTime;
  N.swellBus.gain.setTargetAtTime(0.9 * stemVol('swell'), t, 0.2);
  const breathe = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / loopDur()) * 2));
  N.underBus.gain.setTargetAtTime(stemVol('undertow'), t, 0.2);
  N.droneBus.gain.setTargetAtTime(stemVol('drone'), t, 0.2);
  N.shimBus.gain.setTargetAtTime(1, t, 0.2);
  const f = 48 + moon01 * 22;
  if (liveBP) liveBP.frequency.setTargetAtTime(320 + (tide + 1.8) * 160, t, 0.3);
  if (liveSwellG) liveSwellG.gain.setTargetAtTime(breathe * 0.9, t, 0.25);
  N.underOsc.forEach(({ o, m }) => o.frequency.setTargetAtTime(f * m, t, 0.3));
  const rootIdx = Math.floor(moon01 * PENTA.length) % PENTA.length;
  N.droneOsc.forEach(({ o, g }, v) => {
    o.frequency.setTargetAtTime(semi(PENTA[(rootIdx + v * 2) % PENTA.length]) / 2, t, 0.4);
    o.type = v === 2 ? 'sine' : 'triangle';
  });
  N.master.gain.setTargetAtTime((state.master / 100) * 0.9, t, 0.2);
}

async function setPlaying(on) {
  const ctx = ensureCtx();
  if (ctx.state === 'suspended') await ctx.resume();
  audio.playing = on; state.playing = on;
  const btn = $('#btnPlay');
  btn.setAttribute('aria-pressed', String(on));
  btn.innerHTML = on ? '❚❚&nbsp; ebb to silence' : '▶&nbsp; flood the room';
  if (on) {
    audio.loopStep = 0; audio.nextT = ctx.currentTime + 0.06;
    audio.timer = setInterval(schedulerTick, 120);
    announce(`tide sounding · ${state.loopBars}-bar loop · seed ${activeSeed()}`);
  } else {
    clearInterval(audio.timer); audio.timer = null;
    announce('tide held in the basin · paused');
  }
}

// ---------- export ----------
function wavBlob(buffer) {
  const nCh = 2, sr = buffer.sampleRate, len = buffer.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true); wstr(36, 'data');
  v.setUint32(40, len * nCh * 2, true);
  let off = 44;
  const ch0 = buffer.getChannelData(0), ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  for (let i = 0; i < len; i++) {
    v.setInt16(off, clamp(ch0[i], -1, 1) * 32767, true); off += 2;
    v.setInt16(off, clamp(ch1[i], -1, 1) * 32767, true); off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
let exporting = false;
async function exportStem(name) {
  if (exporting) return;
  exporting = true;
  $$('.exports button').forEach((b) => (b.disabled = true));
  const status = $('#expStatus');
  try {
    if (name === 'json') {
      const doc = {
        project: 'chrono-tide-conservatory', exportedAt: new Date().toISOString(),
        loopBars: state.loopBars, bpm: BPM, seed: activeSeed(), scrubDaysAgo: state.scrub,
        date: new Date().toISOString().slice(0, 10),
        moon: { age: +lunarAge().toFixed(2), name: moonInfo(lunarAge())[0] },
        tide: +tideHeight().toFixed(3),
        mixer: { vols: state.vols, mutes: state.mutes, master: state.master },
        stems: ['swell', 'undertow', 'drone', 'shimmer'],
      };
      download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'tide-session.json');
      status.textContent = 'session.json beached to your downloads.';
    } else {
      status.textContent = `rendering ${name} · one ${state.loopBars}-bar loop…`;
      const buf = await renderStem(name, loopDur());
      download(wavBlob(buf), name === 'mix' ? 'tide-mix.wav' : `tide-${name}.wav`);
      const secs = loopDur().toFixed(1);
      status.textContent = `${name} rendered · ${secs}s · 44.1kHz 16-bit WAV · seed ${activeSeed()}`;
      announce(`stem exported · ${name} · ${secs} seconds`);
    }
  } catch (err) {
    console.error(err);
    status.textContent = 'render snagged on a rock — try again (audio needs no permissions for offline render).';
  } finally {
    exporting = false;
    $$('.exports button').forEach((b) => (b.disabled = false));
  }
}

// ---------- breed ----------
function breed() {
  const todaySeed = daySeedOf(0), pastSeed = daySeedOf(state.scrub);
  state.breedSeed = `x${hashStr(todaySeed + '×' + pastSeed).toString(36)}`;
  if (audio.playing) { audio.loopStep = 0; } // restart loop on new melody
  save();
  const d = new Date(); d.setDate(d.getDate() - state.scrub);
  $('#breedInfo').textContent =
    `✦ bred ${todaySeed} × ${pastSeed} → ${state.breedSeed} · pluck melody rewritten from ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} waters.`;
  announce(`new loop bred · ${state.breedSeed} · press play to hear it`);
}

// ---------- wiring ----------
function init() {
  // restore controls
  $('#gainMaster').value = state.master;
  $('#gainMasterOut').textContent = `${state.master}%`;
  $$('[data-vol]').forEach((el) => { el.value = state.vols[el.dataset.vol] ?? 70; });
  $$('[data-mute]').forEach((b) => {
    const m = !!state.mutes[b.dataset.mute];
    b.setAttribute('aria-pressed', String(m));
    b.textContent = m ? 'unmute' : 'mute';
    b.closest('.stem').classList.toggle('muted', m);
  });
  $$('.loop-len button').forEach((b) =>
    b.setAttribute('aria-pressed', String(+b.dataset.bars === state.loopBars)));
  $('#scrub').value = state.scrub;

  $('#btnPlay').addEventListener('click', () => setPlaying(!audio.playing));
  $('#gainMaster').addEventListener('input', (e) => {
    state.master = +e.target.value;
    $('#gainMasterOut').textContent = `${state.master}%`;
    if (audio.ctx) audio.nodes.master.gain.setTargetAtTime((state.master / 100) * 0.9, audio.ctx.currentTime, 0.1);
    save();
  });
  $$('.loop-len button').forEach((b) => b.addEventListener('click', () => {
    state.loopBars = +b.dataset.bars;
    $$('.loop-len button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (audio.playing) audio.loopStep = 0;
    save(); announce(`loop length · ${state.loopBars} bars · ${loopDur().toFixed(1)}s`);
  }));
  $$('[data-vol]').forEach((el) => el.addEventListener('input', () => {
    state.vols[el.dataset.vol] = +el.value; save();
  }));
  $$('[data-mute]').forEach((b) => b.addEventListener('click', () => toggleMute(b.dataset.mute)));
  $('#scrub').addEventListener('input', (e) => {
    state.scrub = +e.target.value; save(); drawChart(); updateDials();
  });
  $('#scrub').addEventListener('change', () => {
    announce(`history · ${state.scrub === 0 ? 'today' : state.scrub + ' days ago'} · ${daySeedOf(state.scrub)}`);
  });
  $('#btnBreed').addEventListener('click', breed);
  $$('[data-exp]').forEach((b) => b.addEventListener('click', () => exportStem(b.dataset.exp)));

  // keymap dialog
  const km = $('#keymap');
  const openKm = () => { km.hidden = false; $('#keymapClose').focus(); };
  const closeKm = () => { km.hidden = true; };
  $('#keymapClose').addEventListener('click', closeKm);
  km.addEventListener('click', (e) => { if (e.target === km) closeKm(); });

  // global shortcuts — never hijack native control keys
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' && t.type === 'text' || t.tagName === 'TEXTAREA');
    if (typing) return;
    const onRange = t && t.tagName === 'INPUT' && t.type === 'range';
    const onBtn = t && t.tagName === 'BUTTON';
    const k = e.key;
    if (k === 'Escape' && !km.hidden) { closeKm(); return; }
    if (k === '?' || (k === '/' && e.shiftKey)) { km.hidden ? openKm() : closeKm(); e.preventDefault(); return; }
    if (k === ' ' && !onBtn && !onRange) { e.preventDefault(); setPlaying(!audio.playing); return; }
    if (onRange && (k === '[' || k === ']' || k === 'ArrowLeft' || k === 'ArrowRight')) return; // let sliders be sliders
    if (k >= '1' && k <= '4' && !onRange) {
      toggleMute(['swell', 'undertow', 'drone', 'shimmer'][+k - 1]); return;
    }
    switch (k) {
      case 'l': case 'L': cycleLoop(); break;
      case '[': nudgeScrub(-1); break;
      case ']': nudgeScrub(1); break;
      case 'b': case 'B': breed(); $('#btnBreed').focus(); break;
      case 'e': case 'E': exportStem('mix'); break;
    }
  });

  drawChart(); updateDials();
  setInterval(() => { updateDials(); }, 1000);
  if (state.breedSeed) $('#breedInfo').textContent = `✦ bred loop active · ${state.breedSeed} · scrub + B to re-breed.`;
  announce(`estuary tuned · ${moonInfo(lunarAge())[0].toLowerCase()} · tide ${tideHeight() >= 0 ? 'high' : 'low'} side · press play or Space`);
}

function toggleMute(name) {
  state.mutes[name] = !state.mutes[name];
  const b = $(`[data-mute="${name}"]`);
  b.setAttribute('aria-pressed', String(state.mutes[name]));
  b.textContent = state.mutes[name] ? 'unmute' : 'mute';
  b.closest('.stem').classList.toggle('muted', state.mutes[name]);
  save();
  announce(`${name} ${state.mutes[name] ? 'muted' : 'sounding'}`);
}
function cycleLoop() {
  const order = [4, 8, 16];
  state.loopBars = order[(order.indexOf(state.loopBars) + 1) % order.length];
  $$(`.loop-len button`).forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.bars === state.loopBars)));
  if (audio.playing) audio.loopStep = 0;
  save(); announce(`loop length · ${state.loopBars} bars`);
}
function nudgeScrub(d) {
  state.scrub = clamp(state.scrub + d, 0, 29);
  $('#scrub').value = state.scrub;
  save(); drawChart(); updateDials();
}

init();
