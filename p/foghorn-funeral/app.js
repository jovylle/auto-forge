// Foghorn Funeral — mourn ships with layered foghorn drones.
// Spec: drone mixer | fog canvas | eulogy typer  ·  keyboard only.

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const CHAN_CFG = [
  { name: 'HULL', freq: '55.0 Hz', desc: 'keel ache', cutoff: 260 },
  { name: 'SWELL', freq: '110 Hz', desc: 'tide tremor', cutoff: 420 },
  { name: 'THRENODY', freq: '98 Hz', desc: 'beating grief', cutoff: 900 },
];

const DEFAULT_EULOGY =
  'Here lies the SS Meridian, lost with all hands in the winter fog. ' +
  'May the mist be kind, and may the deep remember her name. Sound the horn; she sails on.';

const state = {
  begun: false,
  ctx: null,
  master: null,
  channels: [],
  levels: [45, 30, 20],
  mutes: [false, false, false],
  lastChan: 0,
  fogLevel: 0.16,
  hornEnv: 0,
  submerging: false,
  veiling: false,
};

/* ---------------- persistence ---------------- */

function loadPrefs() {
  try {
    const l = JSON.parse(localStorage.getItem('ff_levels'));
    const m = JSON.parse(localStorage.getItem('ff_mutes'));
    const t = localStorage.getItem('ff_eulogy');
    if (Array.isArray(l) && l.length === 3) state.levels = l.map(Number);
    if (Array.isArray(m) && m.length === 3) state.mutes = m.map(Boolean);
    if (t) $('#eulogyInput').value = t;
  } catch { /* fresh ritual */ }
}
function savePrefs() {
  localStorage.setItem('ff_levels', JSON.stringify(state.levels));
  localStorage.setItem('ff_mutes', JSON.stringify(state.mutes));
  localStorage.setItem('ff_eulogy', $('#eulogyInput').value);
}

/* ---------------- audio engine ---------------- */

function initAudio() {
  if (state.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  state.ctx = new AC();
  const ctx = state.ctx;

  state.master = ctx.createGain();
  state.master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(3.4, 3.4);
  const dry = ctx.createGain(); dry.gain.value = 1;
  const wet = ctx.createGain(); wet.gain.value = 0.5;

  state.master.connect(dry); dry.connect(comp);
  state.master.connect(reverb); reverb.connect(wet); wet.connect(comp);
  comp.connect(ctx.destination);

  buildChannels();
  startAutoCry();
  applyMix();
}

function makeImpulse(seconds, decay) {
  const ctx = state.ctx;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function makeOsc(type, freq, gainVal) {
  const ctx = state.ctx;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gainVal;
  o.connect(g); o.start();
  return g;
}

function buildChannels() {
  const ctx = state.ctx;
  CHAN_CFG.forEach((cfg, i) => {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(state.master);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.cutoff;
    lp.connect(out);

    if (i === 0) {           // hull — low ache
      makeOsc('sine', 55, 0.9).connect(lp);
      makeOsc('sine', 110, 0.2).connect(lp);
    } else if (i === 1) {    // swell — tremored tide
      makeOsc('triangle', 110, 0.85).connect(lp);
      const mod = ctx.createGain(); mod.gain.value = 0;
      mod.connect(out.gain);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
      const lg = ctx.createGain(); lg.gain.value = 0.1;
      lfo.connect(lg); lg.connect(mod); lfo.start();
    } else {                 // threnody — beating, grieving pair
      makeOsc('sine', 98, 0.5).connect(lp);
      makeOsc('sine', 98.65, 0.5).connect(lp);
      const mod = ctx.createGain(); mod.gain.value = 0;
      mod.connect(out.gain);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.16;
      const lg = ctx.createGain(); lg.gain.value = 0.32;
      lfo.connect(lg); lg.connect(mod); lfo.start();
    }

    state.channels.push({ cfg, out, lp });
  });
}

function applyMix() {
  if (!state.ctx) return;
  const t = state.ctx.currentTime;
  state.channels.forEach((ch, i) => {
    const v = state.mutes[i] ? 0 : Math.pow(state.levels[i] / 100, 1.5) * 0.55;
    ch.out.gain.setTargetAtTime(v, t, 0.08);
  });
}

function horn(power = 1, opts = {}) {
  if (!state.begun) return;
  const ctx = state.ctx;
  const t = ctx.currentTime;
  const far = !!opts.far;

  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(state.master);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = far ? 150 : 340;
  lp.connect(g);

  [[65.4, 1.0], [98.1, 0.32], [130.8, 0.13]].forEach(([f, w]) => {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = w;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + 10);
  });
  const r = ctx.createOscillator();
  r.type = 'sine'; r.frequency.value = 32.7;
  const rg = ctx.createGain(); rg.gain.value = 0.7;
  r.connect(rg); rg.connect(lp);
  r.start(t); r.stop(t + 10);

  const peak = far ? 0.1 * power : 0.5 * power;
  const a = far ? 3.2 : 1.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + 1.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + 1.7 + 3.2);

  if (!far) state.hornEnv = 1;
}

function startAutoCry() {
  const loop = () => {
    if (!state.begun) return;
    horn(1, { far: true });
    setTimeout(loop, 20000 + Math.random() * 9000);
  };
  setTimeout(loop, 14000);
}

/* ---------------- mixer UI ---------------- */

function buildMixerUI() {
  const wrap = $('#channels');
  wrap.innerHTML = '';
  CHAN_CFG.forEach((cfg, i) => {
    const card = document.createElement('div');
    card.className = 'channel' + (state.mutes[i] ? ' muted' : '');
    card.id = 'ch' + i;

    const head = document.createElement('div');
    head.className = 'ch-head';
    head.innerHTML = `<span class="ch-name">${cfg.name}</span><span class="ch-freq">${cfg.freq} · ${cfg.desc}</span>`;
    card.appendChild(head);

    const fader = document.createElement('input');
    fader.type = 'range';
    fader.className = 'fader';
    fader.min = 0; fader.max = 100; fader.value = state.levels[i];
    fader.setAttribute('aria-label', cfg.name + ' level');
    fader.setAttribute('tabindex', '0');
    fader.addEventListener('input', () => {
      state.levels[i] = Number(fader.value);
      state.lastChan = i;
      markHot(i);
      readout(i);
      applyMix();
      savePrefs();
    });
    fader.addEventListener('focus', () => { state.lastChan = i; markHot(i); });
    card.appendChild(fader);

    const val = document.createElement('div');
    val.className = 'ch-val';
    val.id = 'lv' + i;
    card.appendChild(val);

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'mute-btn';
    mute.textContent = 'MUTE';
    mute.setAttribute('aria-pressed', String(state.mutes[i]));
    mute.setAttribute('aria-label', 'mute ' + cfg.name);
    mute.addEventListener('click', () => toggleMute(i));
    card.appendChild(mute);

    wrap.appendChild(card);
    readout(i);
  });
}

function readout(i) {
  $('#lv' + i).textContent = (state.mutes[i] ? '—' : state.levels[i] + '%') + ' ' + CHAN_CFG[i].freq;
}

function markHot(i) {
  document.querySelectorAll('.channel').forEach((el, j) => el.classList.toggle('hot', j === i));
}

function toggleMute(i) {
  state.mutes[i] = !state.mutes[i];
  const btn = document.querySelectorAll('.mute-btn')[i];
  btn.setAttribute('aria-pressed', String(state.mutes[i]));
  document.querySelectorAll('.channel')[i].classList.toggle('muted', state.mutes[i]);
  state.lastChan = i;
  readout(i);
  applyMix();
  savePrefs();
}

function focusSlider(i) {
  const f = document.querySelectorAll('.fader')[i];
  if (f) { f.focus(); state.lastChan = i; markHot(i); }
}

/* ---------------- fog canvas ---------------- */

const cnv = $('#fog');
const g = cnv.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  cnv.width = W * DPR;
  cnv.height = H * DPR;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const puffs = Array.from({ length: 16 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: 90 + Math.random() * 240,
  vx: (Math.random() - 0.5) * 0.00005,
  vy: (Math.random() - 0.5) * 0.000035,
  a: 0.035 + Math.random() * 0.05,
  amber: Math.random() > 0.78,
  seed: Math.random() * 100,
}));

const ship = { sink: -70, phase: Math.random() * 100, gone: false };

function drawFog(time) {
  // base haze
  const haze = g.createLinearGradient(0, 0, 0, H);
  haze.addColorStop(0, '#05080f');
  haze.addColorStop(0.55, '#071019');
  haze.addColorStop(1, '#0a141c');
  g.fillStyle = haze;
  g.fillRect(0, 0, W, H);

  // far water glow near the horizon line
  const baseY = H * 0.62 + ship.sink + Math.sin(time * 0.0007 + ship.phase) * 6;
  const sea = g.createLinearGradient(0, baseY - 60, 0, H);
  sea.addColorStop(0, 'rgba(43,138,120,0)');
  sea.addColorStop(1, 'rgba(43,138,120,0.16)');
  g.fillStyle = sea;
  g.fillRect(0, baseY - 60, W, H - baseY + 60);

  // fog puffs — density answers the drone mix
  const dens = 0.5 + state.fogLevel * 0.9;
  for (const p of puffs) {
    const px = (p.x + time * p.vx + Math.sin(time * 0.0001 + p.seed) * 0.012) * W;
    const py = (p.y + time * p.vy + Math.cos(time * 0.00008 + p.seed) * 0.014) * H;
    const r = p.r * (0.8 + state.fogLevel * 0.7);
    const col = p.amber ? '255,180,84' : '143,168,176';
    const rad = g.createRadialGradient(px, py, 0, px, py, r);
    rad.addColorStop(0, `rgba(${col},${p.a * dens})`);
    rad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rad;
    g.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // during a horn, a bright bloom of sound
  if (state.hornEnv > 0.05) {
    const br = g.createRadialGradient(W / 2, baseY, 0, W / 2, baseY, 90 + state.hornEnv * 190);
    br.addColorStop(0, `rgba(89,224,197,${0.14 * state.hornEnv})`);
    br.addColorStop(1, 'rgba(89,224,197,0)');
    g.fillStyle = br;
    g.fillRect(0, 0, W, H);
  }

  drawShip(baseY, time);
}

function drawShip(baseY, time) {
  if (ship.gone) return;
  const scale = clamp(W / 640, 0.55, 1.15);
  const bob = Math.sin(time * 0.0007 + ship.phase) * 6;
  g.save();
  g.translate(W * 0.5, baseY + bob);
  g.scale(scale, scale);

  const hull = g.createLinearGradient(0, 0, 0, 30);
  hull.addColorStop(0, '#05070c');
  hull.addColorStop(1, '#0a0e16');
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-110, 0);
  g.lineTo(110, 0);
  g.lineTo(95, 26);
  g.lineTo(-95, 26);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(89,224,197,0.25)';
  g.lineWidth = 1;
  g.stroke();

  // waterline glint
  g.strokeStyle = 'rgba(89,224,197,0.35)';
  g.beginPath();
  g.moveTo(-108, 4);
  g.lineTo(108, 4);
  g.stroke();

  // bow superstructure + bridge
  g.fillStyle = '#0a0e16';
  g.fillRect(-108, -34, 36, 34);
  g.fillRect(-96, -48, 26, 14);
  // mid deck boxes
  g.fillRect(28, -22, 42, 22);
  g.fillRect(78, -18, 28, 18);

  // funnel with port light
  g.fillRect(44, -60, 20, 38);
  g.fillStyle = 'rgba(255,180,84,0.95)';
  g.fillRect(53, -66, 4, 8);

  // mast + stern light
  g.strokeStyle = '#0c111c';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(108, 0); g.lineTo(108, -56); g.stroke();
  g.beginPath(); g.moveTo(-46, 0); g.lineTo(-46, -38); g.stroke();
  const blink = Math.sin(time * 0.003) > 0 ? 1 : 0.12;
  g.fillStyle = `rgba(255,77,46,${blink})`;
  g.beginPath(); g.arc(108, -58, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(89,224,197,${0.2 + blink * 0.8})`;
  g.beginPath(); g.arc(-46, -40, 2, 0, Math.PI * 2); g.fill();

  // faint hull number
  g.fillStyle = 'rgba(143,168,176,0.4)';
  g.font = '9px "IBM Plex Mono", monospace';
  g.fillText('1938', 40, 16);

  g.restore();
}

/* ---------------- submersion / eulogy ---------------- */

let typeTimer = null;

function commit() {
  if (state.submerging || !state.begun) return;
  state.submerging = true;
  const veil = $('#veil');
  const out = $('#veilEulogy');
  const rest = $('#rest');

  veil.classList.remove('gone');
  veil.classList.add('active', 'typing');
  veil.setAttribute('aria-hidden', 'false');
  $('#dim').classList.add('on');
  out.textContent = '';

  horn(1);
  const text = ($('#eulogyInput').value.trim() || DEFAULT_EULOGY);

  let i = 0;
  typeTimer = setInterval(() => {
    i++;
    out.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(typeTimer);
      setTimeout(() => {
        veil.classList.remove('typing');
        veil.classList.add('sinking');
        setTimeout(() => {
          veil.classList.add('gone');
          rest.classList.add('show');
          state.submerging = false;
        }, 3600);
      }, 700);
    }
  }, 26);

  logCommit(text);
}

function revive() {
  const veil = $('#veil');
  veil.classList.remove('active', 'sinking', 'gone');
  veil.setAttribute('aria-hidden', 'true');
  $('#rest').classList.remove('show');
  $('#dim').classList.remove('on');
  state.submerging = false;
  $('#eulogyInput').value = '';
  $('#eCount').textContent = '0 words';
  savePrefs();
  if (state.begun) $('#horn').focus();
}

function logCommit(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const log = $('#log');
  const entry = document.createElement('span');
  entry.className = 'entry';
  entry.textContent = `${time} · EULOGY COMMITTED TO THE DEEP — `;
  const b = document.createElement('b');
  b.textContent = words + ' words';
  entry.appendChild(b);
  log.prepend(entry);
}

/* ---------------- curtain / begin ---------------- */

function begin() {
  if (state.begun) return;
  state.begun = true;
  initAudio();
  $('#curtain').classList.add('down');
  setTimeout(() => { $('#curtain').style.display = 'none'; }, 1500);
  $('#horn').focus();
}

/* ---------------- keyboard ---------------- */

window.addEventListener('keydown', (e) => {
  const typing = e.target.tagName === 'TEXTAREA';
  const k = e.key.toLowerCase();

  if (k === 'escape') { document.activeElement.blur(); return; }

  if (!state.begun) {
    if (k === ' ' || k === 'enter') { e.preventDefault(); begin(); }
    return;
  }

  if (typing) {
    if (k === 'enter' && e.ctrlKey) { e.preventDefault(); commit(); }
    return;
  }

  if (k === ' ') { e.preventDefault(); horn(); }
  else if (k === 'h') horn();
  else if (k === '1') focusSlider(0);
  else if (k === '2') focusSlider(1);
  else if (k === '3') focusSlider(2);
  else if (k === 'm') toggleMute(state.lastChan);
  else if (k === 't' || k === 'f') $('#eulogyInput').focus();
  else if (k === 'r') revive();
  else if (k === 'e') commit();
  else if (k === 'enter' && e.target.tagName !== 'BUTTON') commit();
});

/* ---------------- word counter ---------------- */

$('#eulogyInput').addEventListener('input', () => {
  const words = $('#eulogyInput').value.trim() ? $('#eulogyInput').value.trim().split(/\s+/).length : 0;
  $('#eCount').textContent = words + (words === 1 ? ' word' : ' words');
  savePrefs();
});

/* ---------------- wire buttons ---------------- */

$('#begin').addEventListener('click', begin);
$('#horn').addEventListener('click', () => horn());
$('#commit').addEventListener('click', commit);
$('#revive').addEventListener('click', revive);

/* ---------------- main loop ---------------- */

let last = 0;
function frame(ts) {
  state.hornEnv = Math.max(0, state.hornEnv - 0.004);
  if (state.begun && state.channels.length) {
    const mix = state.channels.reduce((s, c) => s + c.out.gain.value, 0) / state.channels.length;
    const target = clamp(mix * 1.9 * 0.7, 0, 1) * 0.65 + state.hornEnv * 0.35 + (state.submerging ? 0.5 : 0);
    state.fogLevel += (target - state.fogLevel) * 0.03;
  }
  if (!state.submerging && ship.sink < 230) ship.sink += 0.025;
  else if (state.submerging) ship.sink += 1.6;
  if (ship.sink >= 230) { ship.sink = 230; ship.gone = true; }
  if (ship.gone && !state.submerging) {
    setTimeout(() => { ship.gone = false; ship.sink = -70; ship.phase = Math.random() * 100; }, 4000);
  }
  drawFog(ts);
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */

loadPrefs();
buildMixerUI();
requestAnimationFrame(frame);
$('#begin').focus();