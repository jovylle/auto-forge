/* Clockwork Tide Loops — tidal clock garden
   Features: plant time-looped chimes / tide-synced hourly blooms /
             shareable garden snapshots / ambient loop mixer.
   100% synthesized WebAudio, localStorage persistence, works from file:// */
'use strict';

const $ = (id) => document.getElementById(id);
const gardenEl = $('garden'), waterEl = $('water'), fxEl = $('fx');
const seedbarEl = $('seedbar'), mixerEl = $('mixer'), galleryEl = $('gallery');
const toastEl = $('toast');

const PLOTS = 12;
const LS_GARDEN = 'ctl-garden-v1';
const LS_SNAPS = 'ctl-snaps-v1';
const TIDE_FULL = 60;   // seconds per tide cycle (normal)
const TIDE_FAST = 12;   // demo tide: whole loop playable in ~30s

// Pentatonic seed notes (C major pent, 2 octaves) — always consonant together
const NOTES = [
  { n: 'C4', f: 261.63, e: '🫧', c: '#01cdfe' },
  { n: 'D4', f: 293.66, e: '🐚', c: '#05ffa1' },
  { n: 'E4', f: 329.63, e: '🌺', c: '#ff71ce' },
  { n: 'G4', f: 392.00, e: '🔔', c: '#fffb96' },
  { n: 'A4', f: 440.00, e: '🪼', c: '#b967ff' },
  { n: 'C5', f: 523.25, e: '🦩', c: '#ff71ce' },
  { n: 'D5', f: 587.33, e: '🐬', c: '#01cdfe' },
  { n: 'E5', f: 659.25, e: '🌸', c: '#ffd166' },
];
const LOOPS = [2, 4, 8]; // loop bars in beats
const EMOJI_TOP = ['🌺', '🔔', '🐚', '🌸', '🪼', '🦩', '🫧', '🐬'];

let state = {
  chimes: {},       // plot -> {note, loop, born}
  seed: 3,          // selected seed index
  fast: true,       // demo tide on by default => playable in 30s
  tempo: 92,
  t0: Date.now(),
  lastBloom: 0,
  lastHour: new Date().getHours(),
  muted: { pad: false, bass: false, surf: false, arp: false },
  vol: { pad: 0.7, bass: 0.6, surf: 0.5, arp: 0.9 },
};

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
function save() {
  try { localStorage.setItem(LS_GARDEN, JSON.stringify({ chimes: state.chimes, seed: state.seed, fast: state.fast, tempo: state.tempo })); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(LS_GARDEN);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d && d.chimes) { state.chimes = d.chimes; state.seed = d.seed ?? 3; state.fast = d.fast ?? true; state.tempo = d.tempo ?? 92; return true; }
  } catch (e) {}
  return false;
}

/* ---------- seed picker ---------- */
function renderSeeds() {
  seedbarEl.innerHTML = '';
  NOTES.forEach((nt, i) => {
    const b = document.createElement('button');
    b.className = 'seed' + (i === state.seed ? ' sel' : '');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', i === state.seed ? 'true' : 'false');
    b.title = 'Plant ' + nt.n;
    b.innerHTML = '<div class="n">' + nt.e + '</div><div class="f">' + nt.n + '</div>';
    b.onclick = () => { state.seed = i; renderSeeds(); save(); ensureAudio(); blip(NOTES[i].f, 0.25); };
    seedbarEl.appendChild(b);
  });
}

/* ---------- garden ---------- */
function hourOf(plot) { return plot; } // plot i owns hour i (mod 12 mapped to clock)
function renderGarden() {
  gardenEl.innerHTML = '';
  const count = Object.keys(state.chimes).length;
  $('chimeCount').textContent = count + ' / ' + PLOTS;
  for (let p = 0; p < PLOTS; p++) {
    const d = document.createElement('div');
    d.className = 'plot' + (state.chimes[p] ? '' : ' empty');
    d.dataset.plot = p;
    const h = hourOf(p);
    if (state.chimes[p]) {
      const c = state.chimes[p];
      const nt = NOTES[c.note];
      d.innerHTML =
        '<span class="hour">' + String(h).padStart(2, '0') + ':00</span>' +
        '<div class="chime" style="color:' + nt.c + '">' + nt.e + '</div>' +
        '<div class="nname">' + nt.n + ' · ' + EMOJI_TOP[c.note % EMOJI_TOP.length] + '</div>' +
        '<div class="loop">↻ every ' + c.loop + ' beats</div>' +
        '<div class="ctrl"><button data-a="t" title="Change loop length">↻ ' + c.loop + '</button>' +
        '<button data-a="x" title="Uproot">✕</button></div>';
      d.querySelector('[data-a="t"]').onclick = (e) => {
        e.stopPropagation();
        const i = (LOOPS.indexOf(c.loop) + 1) % LOOPS.length;
        c.loop = LOOPS[i]; save(); renderGarden(); toast('↻ loop set to ' + c.loop + ' beats');
      };
      d.querySelector('[data-a="x"]').onclick = (e) => {
        e.stopPropagation(); delete state.chimes[p]; save(); renderGarden(); toast('Uprooted plot ' + h);
      };
      d.onclick = (e) => {
        if (e.target.closest('.ctrl')) return;
        ensureAudio(); ringChime(p, true);
      };
    } else {
      d.innerHTML = '<span class="hour">' + String(h).padStart(2, '0') + ':00</span>';
      d.onclick = () => plant(p);
      d.title = 'Empty plot — click to plant ' + NOTES[state.seed].n;
    }
    gardenEl.appendChild(d);
  }
}

function plant(p, noteIdx, loopLen, silent) {
  if (Object.keys(state.chimes).length >= PLOTS && !state.chimes[p]) { toast('Garden is full — uproot something first'); return; }
  state.chimes[p] = {
    note: noteIdx ?? state.seed,
    loop: loopLen ?? LOOPS[1],
    born: Date.now(),
  };
  save(); renderGarden();
  if (!silent) {
    ensureAudio();
    ringChime(p, true);
    burst(p);
    toast(NOTES[state.chimes[p].note].n + ' planted on the ' + String(hourOf(p)).padStart(2, '0') + ':00 loop ✺');
  }
}

/* ---------- tide engine + clocks ---------- */
function tidePeriod() { return state.fast ? TIDE_FAST : TIDE_FULL; }
function tideAt(now) {
  const el = (now - state.t0) / 1000;
  const ph = (el % tidePeriod()) / tidePeriod(); // 0..1
  const level = (Math.sin(ph * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0 low → 1 high
  return { ph, level };
}
function tick() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  $('realClock').textContent = hh + ':' + mm + ':' + ss;
  $('vhsClock').textContent = hh + ':' + mm + ':' + ss;

  const { ph, level } = tideAt(Date.now());
  const rising = ph < 0.5;
  const period = tidePeriod();
  const toHigh = rising ? Math.ceil((0.5 - ph) * period) : Math.ceil((1.5 - ph) * period % period || period);
  $('tidePhase').textContent = (rising ? 'RISING ◐ ' : 'FALLING ◑ ') + Math.round(level * 100) + '%';
  $('bloomIn').textContent = 'bloom in ' + toHigh + 's';
  $('tideFill').style.width = (level * 100).toFixed(1) + '%';
  $('tideNeedle').style.left = 'calc(' + (level * 100).toFixed(1) + '% - 1px)';
  $('tidePct').textContent = 'tide ' + Math.round(level * 100) + '%';
  waterEl.style.height = (14 + level * 34) + '%';

  // High-tide bloom: level crosses ~0.97
  if (level > 0.965 && Date.now() - state.lastBloom > (period * 1000 * 0.6)) {
    state.lastBloom = Date.now();
    fullBloom('high tide ✺');
  }
  // Real hourly bloom: minute rolled to :00
  const hr = now.getHours(), min = now.getMinutes();
  if (min === 0 && now.getSeconds() < 2 && (state.lastHour !== hr || true)) {
    state.lastHour = hr;
    hourlyBloom(hr);
  }
  if (min !== 0) state.lastHour = hr;
}

function burst(plot) {
  const cell = gardenEl.querySelector('[data-plot="' + plot + '"]');
  if (!cell) return;
  const r = cell.getBoundingClientRect(), w = gardenEl.parentElement.getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span');
    s.className = 'petal';
    s.textContent = ['✺', '❀', '＋', '◦', '✦'][i % 5];
    s.style.color = NOTES[state.chimes[plot].note].c;
    s.style.left = (r.left - w.left + r.width / 2 + (Math.random() * 60 - 30)) + 'px';
    s.style.top = (r.top - w.top + 30) + 'px';
    fxEl.appendChild(s);
    setTimeout(() => s.remove(), 1900);
  }
}

function ringVisual(plot, cls) {
  const cell = gardenEl.querySelector('[data-plot="' + plot + '"]');
  if (!cell) return;
  cell.classList.remove('ring', 'bloom');
  void cell.offsetWidth;
  cell.classList.add(cls || 'ring');
  setTimeout(() => cell.classList.remove('ring', 'bloom'), 1700);
}

function fullBloom(why) {
  const keys = Object.keys(state.chimes);
  if (!keys.length) { toast('Plant a chime first — then bloom 🌊'); return; }
  toast(why + ' — ' + keys.length + ' chimes blooming ✺');
  keys.forEach((p, i) => {
    setTimeout(() => { ringChime(Number(p), true); ringVisual(Number(p), 'bloom'); burst(Number(p)); }, i * 160);
  });
}
function hourlyBloom(hr) {
  const plot = hr % PLOTS;
  if (state.chimes[plot]) {
    ringChime(plot, true); ringVisual(plot, 'bloom'); burst(plot);
    toast('🕰 ' + String(hr).padStart(2, '0') + ':00 — the ' + NOTES[state.chimes[plot].note].n + ' chime blooms');
  } else if (Object.keys(state.chimes).length) {
    fullBloom('🕰 ' + String(hr).padStart(2, '0') + ':00');
  }
}

/* ---------- audio: all synthesized ---------- */
let AC = null, master = null, delaySend = null;
const g = { pad: null, bass: null, surf: null, arp: null };
let started = false, padNodes = [], beatTimer = null, beat = 0;

function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return true; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { toast('WebAudio unavailable in this browser'); return false; }
  master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
  // echoey space delay
  const dl = AC.createDelay(1); dl.delayTime.value = 0.34;
  const fb = AC.createGain(); fb.gain.value = 0.38;
  const wet = AC.createGain(); wet.gain.value = 0.3;
  delaySend = AC.createGain(); delaySend.gain.value = 1;
  delaySend.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  ['pad', 'bass', 'surf', 'arp'].forEach((k) => {
    g[k] = AC.createGain(); g[k].gain.value = state.vol[k];
    g[k].connect(master);
  });
  startPad(); startSurf();
  return true;
}

function blip(freq, dur) {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.6));
  o.connect(gn); gn.connect(g.arp); gn.connect(delaySend);
  o.start(t); o.stop(t + (dur || 0.6) + 0.05);
}

function ringChime(plot, audible) {
  ringVisual(plot, 'ring');
  if (audible && AC) {
    const c = state.chimes[plot];
    if (c) chimeVoice(NOTES[c.note].f, 1.6);
  }
}
function chimeVoice(freq, dur) {
  const t = AC.currentTime;
  [['triangle', freq, 0.5], ['sine', freq * 2, 0.18], ['sine', freq / 2, 0.12]].forEach(([type, f, v]) => {
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(v, t + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(g.arp); gn.connect(delaySend);
    o.start(t); o.stop(t + dur + 0.05);
  });
}

function startPad() {
  // lush detuned saw pad on Cmaj9, slow filter LFO
  const t = AC.currentTime;
  const filt = AC.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 2;
  filt.connect(g.pad);
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = 0.08; lg.gain.value = 500;
  lfo.connect(lg); lg.connect(filt.frequency); lfo.start(t);
  [130.81, 164.81, 196.0, 246.94, 293.66].forEach((f) => {
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 10 - 5;
    gn.gain.value = 0.035;
    o.connect(gn); gn.connect(filt); o.start(t);
    padNodes.push(o);
  });
  padNodes.push(lfo);
}

function startSurf() {
  // surf = looped noise through bandpass, gain follows tide
  const len = AC.sampleRate * 2;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
  const ng = AC.createGain(); ng.gain.value = 0.06;
  src.connect(bp); bp.connect(ng); ng.connect(g.surf);
  src.start();
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = 0.15; lg.gain.value = 300;
  lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
  padNodes.push(src, lfo);
  // per-frame: surf loudness breathes with tide
  setInterval(() => {
    if (!AC) return;
    const { level } = tideAt(Date.now());
    ng.gain.setTargetAtTime(0.02 + level * 0.09, AC.currentTime, 0.3);
  }, 400);
}

function bassPulse() {
  const t = AC.currentTime;
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(65.41, t); // C2
  o.frequency.linearRampToValueAtTime(98, t + 0.4);       // glide to G2
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(gn); gn.connect(g.bass);
  o.start(t); o.stop(t + 1);
}

function beatLoop() {
  if (!started) return;
  const spb = 60 / state.tempo / 2; // 8th notes
  beat++;
  const keys = Object.keys(state.chimes).map(Number);
  // arp: any chime whose loop divides the beat rings softly
  keys.forEach((p) => {
    const c = state.chimes[p];
    if (c && beat % (c.loop * 2) === (p % (c.loop * 2))) {
      chimeVoice(NOTES[c.note].f, 1.1);
      ringVisual(p, 'ring');
    }
  });
  if (beat % 8 === 0) bassPulse();
  beatTimer = setTimeout(beatLoop, spb * 1000);
}

function renderMixer() {
  const chans = [
    ['pad', '🌅', 'PAD'], ['bass', '🌊', 'BASS'], ['surf', '🐚', 'SURF'], ['arp', '🔔', 'CHIMES'],
  ];
  mixerEl.innerHTML = '';
  chans.forEach(([k, ico, label]) => {
    const d = document.createElement('div');
    d.className = 'chan' + (state.muted[k] ? ' muted' : '');
    d.innerHTML = '<div class="ico">' + ico + '</div><h3>' + label + '</h3>' +
      '<input type="range" min="0" max="100" value="' + Math.round(state.vol[k] * 100) + '" aria-label="' + label + ' volume" />' +
      '<br /><button>' + (state.muted[k] ? 'unmute' : 'mute') + '</button>';
    const slider = d.querySelector('input');
    slider.oninput = () => {
      state.vol[k] = slider.value / 100;
      if (AC && g[k]) g[k].gain.setTargetAtTime(state.muted[k] ? 0 : state.vol[k], AC.currentTime, 0.05);
    };
    d.querySelector('button').onclick = (e) => {
      state.muted[k] = !state.muted[k];
      if (AC && g[k]) g[k].gain.setTargetAtTime(state.muted[k] ? 0 : state.vol[k], AC.currentTime, 0.05);
      renderMixer();
    };
    mixerEl.appendChild(d);
  });
  $('tempo').value = state.tempo;
  $('tempoVal').textContent = state.tempo;
}

/* ---------- snapshots (shareable garden links) ---------- */
function encodeGarden(name) {
  const payload = { v: 1, name: name || 'untitled tide', chimes: state.chimes, tempo: state.tempo };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeGarden(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
function applyHash() {
  if (!location.hash || location.hash.indexOf('#g=') !== 0) return false;
  try {
    const d = decodeGarden(location.hash.slice(3));
    if (d && d.chimes) {
      state.chimes = d.chimes;
      if (d.tempo) state.tempo = d.tempo;
      toast('🌊 grew a shared garden: “' + (d.name || 'untitled') + '”');
      return true;
    }
  } catch (e) { toast('That tide-link didn\u2019t parse 🌧'); }
  return false;
}
function getSnaps() {
  try { return JSON.parse(localStorage.getItem(LS_SNAPS) || '[]'); } catch (e) { return []; }
}
function setSnaps(a) { try { localStorage.setItem(LS_SNAPS, JSON.stringify(a.slice(0, 9))); } catch (e) {} }
function renderGallery() {
  const snaps = getSnaps();
  galleryEl.innerHTML = '';
  if (!snaps.length) {
    galleryEl.innerHTML = '<div class="empty-g">no snapshots yet — 📸 one and it will live here</div>';
    return;
  }
  snaps.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'snap'; d.title = 'Click to grow this garden';
    const keys = Object.keys(s.chimes);
    const em = keys.slice(0, 4).map((p) => NOTES[s.chimes[p].note].e).join('') || '🌊';
    d.innerHTML = '<div class="em">' + em + '</div><span class="nm">' + escapeHtml(s.name) + '</span>' +
      '<span class="dl">' + keys.length + ' chimes · ♪' + s.tempo + '</span>';
    d.onclick = () => {
      state.chimes = JSON.parse(JSON.stringify(s.chimes));
      state.tempo = s.tempo || 92;
      save(); renderGarden(); renderMixer();
      toast('🌊 grew “' + s.name + '”');
    };
    d.oncontextmenu = (e) => {
      e.preventDefault();
      const a = getSnaps(); a.splice(i, 1); setSnaps(a); renderGallery();
      toast('snapshot deleted');
    };
    galleryEl.appendChild(d);
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

$('snapSave').onclick = () => {
  const name = ($('snapName').value || 'tide ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })).trim();
  const code = encodeGarden(name);
  const url = location.href.split('#')[0] + '#g=' + code;
  history.replaceState(null, '', '#g=' + code);
  const snaps = getSnaps();
  snaps.unshift({ name, chimes: JSON.parse(JSON.stringify(state.chimes)), tempo: state.tempo, at: Date.now() });
  setSnaps(snaps); renderGallery();
  $('snapName').value = '';
  // try clipboard, fall back to prompt-less select
  copyText(url);
};
$('snapCopy').onclick = () => {
  const code = encodeGarden($('snapName').value.trim() || 'untitled tide');
  copyText(location.href.split('#')[0] + '#g=' + code);
};
$('snapDl').onclick = () => {
  const blob = new Blob([JSON.stringify({ name: $('snapName').value || 'tide', chimes: state.chimes, tempo: state.tempo }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clockwork-tide-garden.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('💾 garden downloaded');
};
$('snapClear').onclick = () => {
  state.chimes = {};
  history.replaceState(null, '', location.pathname);
  save(); renderGarden();
  toast('garden cleared — fresh sand ✨');
};
function copyText(t) {
  const done = () => toast('🔗 tide-link copied — share the vibe');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  } else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('copy failed — link is in the address bar'); }
  ta.remove();
}

/* ---------- top controls ---------- */
$('bloomNow').onclick = () => { ensureAudio(); fullBloom('manual bloom'); };
$('tideFast').onclick = (e) => {
  state.fast = !state.fast;
  const b = e.currentTarget;
  b.setAttribute('aria-pressed', String(state.fast));
  b.textContent = state.fast ? '⚡ demo tide: ON' : '⚡ demo tide: OFF';
  state.t0 = Date.now() - (state.fast ? 0 : 0); // restart phase for predictability
  save();
  toast(state.fast ? '⚡ 12s demo tide — bloom in seconds' : '🌙 60s true tide — slow + deep');
};
$('audioToggle').onclick = (e) => {
  const ok = ensureAudio();
  if (!ok) return;
  started = !started;
  e.currentTarget.textContent = started ? '⏸ pause the tide' : '▶ start the tide';
  if (started) {
    beat = 0; beatLoop();
    toast('🔊 tide is live — plant chimes to steer the arp');
  } else clearTimeout(beatTimer);
};
$('tempo').oninput = (e) => { state.tempo = Number(e.target.value); $('tempoVal').textContent = state.tempo; save(); };

/* ---------- boot ---------- */
(function boot() {
  const fromLink = applyHash();
  if (!fromLink) load();
  if (!Object.keys(state.chimes).length && !fromLink) {
    // starter garden so first paint sings in <30s
    state.chimes = { 2: { note: 3, loop: 4, born: Date.now() }, 5: { note: 0, loop: 8, born: Date.now() }, 9: { note: 4, loop: 2, born: Date.now() } };
  }
  if (state.fast) { $('tideFast').setAttribute('aria-pressed', 'true'); $('tideFast').textContent = '⚡ demo tide: ON'; }
  else { $('tideFast').setAttribute('aria-pressed', 'false'); $('tideFast').textContent = '⚡ demo tide: OFF'; }
  renderSeeds(); renderGarden(); renderMixer(); renderGallery();
  setInterval(tick, 250); tick();
  // dismiss hint after first plant
  gardenEl.addEventListener('click', function h() {
    if (Object.keys(state.chimes).length) $('hint').style.opacity = '0.55';
  });
})();
