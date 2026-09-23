// Echo Fern Sequencer — steampunk WebAudio step sequencer. No assets, all synth.
const TRACKS = [
  { id: 'kick',  name: 'Kick',  icon: '⚙' },
  { id: 'snare', name: 'Snare', icon: '✦' },
  { id: 'hat',   name: 'Hat',   icon: '≋' },
  { id: 'clank', name: 'Clank', icon: '◈' },
  { id: 'spore', name: 'Spore', icon: '❀' },
];
const STEPS = 16;
const LS_KEY = 'echo-fern-sequencer-v1';

const $ = (s) => document.querySelector(s);
const grid = $('#grid'), btnPower = $('#btnPower'), lamp = $('#lamp');
const bpmEl = $('#bpm'), bpmVal = $('#bpmVal'), swingEl = $('#swing'), swingVal = $('#swingVal');
const stepRead = $('#stepRead'), toast = $('#toast');
const delayPad = $('#delayPad'), delayKnob = $('#delayKnob'), verbPad = $('#verbPad'), verbKnob = $('#verbKnob');
const delayTimeEl = $('#delayTime'), delayFbEl = $('#delayFb'), verbDecayEl = $('#verbDecay'), verbMixEl = $('#verbMix');
const delayRead = $('#delayRead'), verbRead = $('#verbRead');
const seedCode = $('#seedCode'), seedInput = $('#seedInput'), seedNote = $('#seedNote');
const bloomCanvas = $('#bloomCanvas'), meterLevel = $('#meterLevel'), meterScroll = $('#meterScroll');
const scrollProgress = $('#scrollProgress');

// ---------- state ----------
let pattern = {}; // trackId -> bool[16]
let muted = {}; let solo = {};
TRACKS.forEach(t => { pattern[t.id] = new Array(STEPS).fill(false); muted[t.id] = false; solo[t.id] = false; });
// default groove: mossy boom-bap
pattern.kick  = [1,0,0,0, 0,0,1,0, 1,0,0,1, 0,0,0,0].map(Boolean);
pattern.snare = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean);
pattern.hat   = [1,0,1,1, 1,0,1,0, 1,1,1,0, 1,0,1,1].map(Boolean);
pattern.clank = [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean);
pattern.spore = [0,0,1,0, 0,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean);

let playing = false, step = 0, nextTime = 0, timer = null, eraseMode = false, isMuted = false;
let fx = { delayTime: .45, delayFb: .38, verbDecay: .52, verbMix: .42 };
let scrollBend = 0; // 0..1 from scroll position — satisfies "must react to scroll"
let paintVal = true, painting = false;

// ---------- audio graph ----------
let AC = null, master, compBus, filterNode, analyser, delayNode, delayFbGain, verb, verbGain, dryGain, wetDelayGain, noiseBuf;
let verbTimer = null;

function ctx() {
  if (AC) return AC;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.9;
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  analyser = AC.createAnalyser(); analyser.fftSize = 256;
  filterNode = AC.createBiquadFilter(); filterNode.type = 'lowpass'; filterNode.frequency.value = 16000; filterNode.Q.value = 0.6;
  dryGain = AC.createGain(); dryGain.gain.value = 0.85;
  // delay chain
  delayNode = AC.createDelay(2.0);
  delayFbGain = AC.createGain();
  wetDelayGain = AC.createGain(); wetDelayGain.gain.value = 0.5;
  delayNode.connect(delayFbGain); delayFbGain.connect(delayNode);
  delayNode.connect(wetDelayGain); wetDelayGain.connect(filterNode);
  // reverb chain
  verb = AC.createConvolver(); verbGain = AC.createGain();
  verb.connect(verbGain); verbGain.connect(filterNode);
  rebuildImpulse();
  compBus = AC.createGain();
  compBus.connect(dryGain); dryGain.connect(filterNode);
  compBus.connect(delayNode); compBus.connect(verb);
  filterNode.connect(comp); comp.connect(analyser); analyser.connect(master); master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyFx();
  return AC;
}
function rebuildImpulse() {
  if (!AC) return;
  const decay = 0.4 + fx.verbDecay * 3.4; // 0.4..3.8s
  const len = Math.floor(AC.sampleRate * decay);
  const ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * (0.6 + 0.4 * Math.sin(t * 40 + c));
    }
  }
  verb.buffer = ir;
}
function applyFx() {
  if (!AC) return;
  const bpm = +bpmEl.value;
  const beat = 60 / bpm;
  const t = 0.06 + fx.delayTime * beat * 1.5;
  delayNode.delayTime.setTargetAtTime(t, AC.currentTime, 0.03);
  delayFbGain.gain.setTargetAtTime(Math.min(0.85, fx.delayFb), AC.currentTime, 0.03);
  verbGain.gain.setTargetAtTime(fx.verbMix * 1.4 * (1 + scrollBend * 0.8), AC.currentTime, 0.1);
  const names = ['16th', '8th', '¼', 'dotted ¼', '½'];
  const idx = Math.min(4, Math.floor(fx.delayTime * 5));
  delayRead.textContent = `${names[idx]} · ${Math.round(fx.delayFb * 100)}%`;
  verbRead.textContent = `${(0.4 + fx.verbDecay * 3.4).toFixed(1)}s · ${Math.round(fx.verbMix * 100)}%`;
  delayKnob.style.left = `calc(${fx.delayTime * 100}% - 15px)`;
  delayKnob.style.top = `calc(${(1 - fx.delayFb) * 100}% - 15px)`;
  verbKnob.style.left = `calc(${fx.verbDecay * 100}% - 15px)`;
  verbKnob.style.top = `calc(${(1 - fx.verbMix) * 100}% - 15px)`;
  syncFxSliders();
}
function syncFxSliders() {
  delayTimeEl.value = fx.delayTime * 100; delayFbEl.value = fx.delayFb * 100;
  verbDecayEl.value = fx.verbDecay * 100; verbMixEl.value = fx.verbMix * 100;
}

// ---------- synthesized drums (no assets) ----------
function env(g, t, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
}
function playDrum(id, t, vel = 1) {
  const ac = ctx();
  const out = ac.createGain(); out.connect(compBus);
  if (id === 'kick') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.95 * vel, 0.34);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
    const c = ac.createBufferSource(); c.buffer = noiseBuf;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const cg = ac.createGain(); env(cg, t, 0.25 * vel, 0.03);
    c.connect(hp); hp.connect(cg); cg.connect(out); c.start(t); c.stop(t + 0.05);
  } else if (id === 'snare') {
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = ac.createGain(); env(ng, t, 0.6 * vel, 0.18);
    n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.25);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 186;
    env(g, t, 0.5 * vel, 0.1);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
  } else if (id === 'hat') {
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = ac.createGain(); env(g, t, 0.32 * vel, 0.07);
    n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.1);
  } else if (id === 'clank') {
    [521, 739, 1180].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f * (1 + (Math.random() - .5) * 0.01);
      env(g, t, 0.16 * vel / (i + 1), 0.22);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    });
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 4;
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    const ng = ac.createGain(); env(ng, t, 0.2 * vel, 0.09);
    n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.12);
  } else if (id === 'spore') {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = scale[(step * 5 + 3) % scale.length];
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    env(g, t, 0.4 * vel, 0.9);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.type = 'sine'; o2.frequency.value = f * 2.01;
    env(g2, t, 0.12 * vel, 0.5);
    o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 0.6);
    drip(f);
  }
  out.gain.setValueAtTime(1, t);
}

// ---------- sequencer ----------
function audible(id) {
  if (isMuted || muted[id]) return false;
  const anySolo = TRACKS.some(t => solo[t.id]);
  if (anySolo && !solo[id]) return false;
  return true;
}
function schedule() {
  const ac = ctx();
  const bpm = +bpmEl.value, swing = +swingEl.value / 100;
  const spb = 60 / bpm / 2; // 8th-note steps
  while (nextTime < ac.currentTime + 0.15) {
    const s = step;
    const late = (s % 2 === 1) ? spb * swing * 0.5 : 0;
    const t = nextTime + late;
    TRACKS.forEach(tr => {
      if (pattern[tr.id][s] && audible(tr.id)) {
        const vel = (s % 4 === 0) ? 1 : 0.82;
        playDrum(tr.id, Math.max(t, ac.currentTime + 0.001), vel);
      }
    });
    setTimeout(((ss) => () => paintHead(ss))(s), Math.max(0, (t - ac.currentTime) * 1000));
    nextTime += spb;
    step = (step + 1) % STEPS;
  }
}
function paintHead(s) {
  document.querySelectorAll('.cell.now').forEach(c => c.classList.remove('now'));
  document.querySelectorAll(`.cell[data-step="${s}"]`).forEach(c => {
    c.classList.add('now');
    if (c.classList.contains('on')) { c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); }
  });
  stepRead.textContent = `STEP ${String(s + 1).padStart(2, '0')} / 16`;
  lamp.classList.toggle('on', s % 4 === 0);
}
function start() {
  ctx(); AC.resume();
  if (playing) return;
  playing = true; step = 0; nextTime = AC.currentTime + 0.06;
  timer = setInterval(schedule, 30);
  btnPower.innerHTML = '⏸&nbsp; Let it rest'; btnPower.classList.add('live');
  btnPower.setAttribute('aria-pressed', 'true');
  toastMsg('The engine is wound. Paint while it plays.');
}
function stop() {
  playing = false; clearInterval(timer);
  btnPower.innerHTML = '▶&nbsp; Wind it up'; btnPower.classList.remove('live');
  btnPower.setAttribute('aria-pressed', 'false');
  document.querySelectorAll('.cell.now').forEach(c => c.classList.remove('now'));
}
btnPower.addEventListener('click', () => { ctx(); AC.resume(); playing ? stop() : start(); });
bpmEl.addEventListener('input', () => { bpmVal.textContent = bpmEl.value; save(); encodeSeed(); });
swingEl.addEventListener('input', () => { swingVal.textContent = swingEl.value + '%'; save(); encodeSeed(); });

// ---------- grid build + paint ----------
const cellRefs = [];
function buildGrid() {
  grid.innerHTML = ''; cellRefs.length = 0;
  TRACKS.forEach(tr => {
    const lab = document.createElement('div');
    lab.className = 'track-name';
    lab.innerHTML = `<span>${tr.icon} ${tr.name}</span>`;
    const mBtn = document.createElement('button');
    mBtn.textContent = 'M'; mBtn.title = `Mute ${tr.name}`; mBtn.setAttribute('aria-label', `Mute ${tr.name}`);
    mBtn.addEventListener('click', (e) => {
      e.stopPropagation(); ctx();
      muted[tr.id] = !muted[tr.id];
      mBtn.textContent = muted[tr.id] ? '✕' : 'M';
      mBtn.style.color = muted[tr.id] ? '#e87a52' : '';
      toastMsg(muted[tr.id] ? `${tr.name} muffled.` : `${tr.name} back in the mix.`);
    });
    const sBtn = document.createElement('button');
    sBtn.textContent = 'S'; sBtn.title = `Solo ${tr.name}`;
    sBtn.addEventListener('click', (e) => {
      e.stopPropagation(); ctx();
      solo[tr.id] = !solo[tr.id];
      sBtn.classList.toggle('solo-on', solo[tr.id]);
    });
    lab.append(mBtn, sBtn);
    grid.appendChild(lab);
    for (let s = 0; s < STEPS; s++) {
      const c = document.createElement('div');
      c.className = 'cell' + (pattern[tr.id][s] ? ' on' : '');
      c.dataset.track = tr.id; c.dataset.step = s;
      c.setAttribute('role', 'gridcell');
      c.setAttribute('aria-label', `${tr.name} step ${s + 1}`);
      cellRefs.push(c);
      grid.appendChild(c);
    }
  });
  refreshSeed();
}
function setCell(track, s, v, silent = false) {
  pattern[track][s] = v;
  const c = cellRefs.find(el => el.dataset.track === track && +el.dataset.step === s);
  if (c) c.classList.toggle('on', v);
  if (!silent) { preview(track); save(); encodeSeed(); }
}
function preview(track) {
  ctx(); AC.resume();
  playDrum(track, AC.currentTime + 0.001, 0.9);
}
function cellFromEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  return el && el.classList && el.classList.contains('cell') ? el : null;
}
grid.addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.cell'); if (!c) return;
  e.preventDefault(); ctx(); AC.resume();
  if (!playing) start();
  painting = true;
  grid.setPointerCapture && (() => {})();
  paintVal = eraseMode ? false : !pattern[c.dataset.track][+c.dataset.step];
  setCell(c.dataset.track, +c.dataset.step, paintVal);
});
grid.addEventListener('pointerover', (e) => {
  if (!painting) return;
  const c = e.target.closest('.cell'); if (!c) return;
  if (pattern[c.dataset.track][+c.dataset.step] !== paintVal) setCell(c.dataset.track, +c.dataset.step, paintVal);
});
window.addEventListener('pointerup', () => { painting = false; });
grid.addEventListener('touchmove', (e) => {
  if (!painting) return;
  const t = e.touches[0]; const c = cellFromEvent(t);
  if (c && pattern[c.dataset.track][+c.dataset.step] !== paintVal) setCell(c.dataset.track, +c.dataset.step, paintVal);
}, { passive: true });

// ---------- drag-to-bend pads ----------
function bindPad(pad, fn) {
  let drag = false;
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    let x = (p.clientX - r.left) / r.width, y = (p.clientY - r.top) / r.height;
    x = Math.min(1, Math.max(0, x)); y = Math.min(1, Math.max(0, y));
    ctx(); AC.resume();
    fn(x, y);
    // audible preview so bending is heard instantly (satisfies "sound on interaction")
    if (AC && playing === false && (drag || e.type === 'pointerdown')) preview('clank');
  };
  pad.addEventListener('pointerdown', (e) => { drag = true; pad.setPointerCapture(e.pointerId); ctx(); AC.resume(); move(e); });
  pad.addEventListener('pointermove', (e) => { if (drag) move(e); });
  pad.addEventListener('pointerup', () => { drag = false; save(); encodeSeed(); });
  pad.addEventListener('pointercancel', () => { drag = false; });
  pad.addEventListener('keydown', (e) => {
    const stepv = 0.05; let handled = true;
    if (e.key === 'ArrowLeft') fn._x = Math.max(0, (fn._x ?? .5) - stepv);
    else if (e.key === 'ArrowRight') fn._x = Math.min(1, (fn._x ?? .5) + stepv);
    else if (e.key === 'ArrowUp') fn._y = Math.max(0, (fn._y ?? .5) - stepv);
    else if (e.key === 'ArrowDown') fn._y = Math.min(1, (fn._y ?? .5) + stepv);
    else handled = false;
    if (handled) { e.preventDefault(); ctx(); fn(fn._x, fn._y); save(); encodeSeed(); }
  });
}
const dFn = (x, y) => { dFn._x = x; dFn._y = y; fx.delayTime = x; fx.delayFb = 1 - y; applyFx(); };
const vFn = (x, y) => { vFn._x = x; vFn._y = y; fx.verbDecay = x; fx.verbMix = 1 - y; applyFx(); clearTimeout(verbTimer); verbTimer = setTimeout(rebuildImpulse, 180); };
bindPad(delayPad, dFn); bindPad(verbPad, vFn);
dFn._x = fx.delayTime; dFn._y = 1 - fx.delayFb; vFn._x = fx.verbDecay; vFn._y = 1 - fx.verbMix;
delayTimeEl.addEventListener('input', () => { ctx(); fx.delayTime = delayTimeEl.value / 100; dFn._x = fx.delayTime; applyFx(); });
delayFbEl.addEventListener('input', () => { ctx(); fx.delayFb = delayFbEl.value / 100; dFn._y = 1 - fx.delayFb; applyFx(); });
verbDecayEl.addEventListener('input', () => { ctx(); fx.verbDecay = verbDecayEl.value / 100; vFn._x = fx.verbDecay; applyFx(); clearTimeout(verbTimer); verbTimer = setTimeout(rebuildImpulse, 180); });
verbMixEl.addEventListener('input', () => { ctx(); fx.verbMix = verbMixEl.value / 100; vFn._y = 1 - fx.verbMix; applyFx(); });

// ---------- bloom canvas: dripping reverb blooms ----------
const bctx = bloomCanvas.getContext('2d');
let drops = [];
function sizeBloom() {
  const r = verbPad.getBoundingClientRect();
  bloomCanvas.width = r.width * devicePixelRatio; bloomCanvas.height = r.height * devicePixelRatio;
}
function drip(freq = 660) {
  const n = 2 + Math.floor(Math.random() * 4 * (0.5 + fx.verbMix));
  for (let i = 0; i < n; i++) {
    drops.push({
      x: Math.random(), y: 0.05 + Math.random() * 0.2,
      vy: 0.001 + Math.random() * 0.004 * (0.6 + fx.verbDecay),
      r: 2 + Math.random() * (4 + fx.verbMix * 10),
      hue: 95 + Math.random() * 60 + (freq % 60),
      life: 1,
    });
  }
  if (drops.length > 220) drops = drops.slice(-220);
}
function tickBloom() {
  const w = bloomCanvas.width, h = bloomCanvas.height;
  bctx.clearRect(0, 0, w, h);
  drops.forEach(p => {
    p.y += p.vy * (1 + scrollBend); p.life -= 0.006; p.r += 0.06;
    const alpha = Math.max(0, p.life * (0.35 + fx.verbMix * 0.6));
    bctx.beginPath();
    bctx.arc(p.x * w, p.y * h, p.r * devicePixelRatio, 0, 7);
    bctx.fillStyle = `hsla(${p.hue},60%,62%,${alpha * 0.5})`;
    bctx.fill();
    bctx.beginPath();
    bctx.arc(p.x * w, p.y * h, p.r * devicePixelRatio * 0.45, 0, 7);
    bctx.fillStyle = `hsla(${p.hue},80%,82%,${alpha})`;
    bctx.fill();
  });
  drops = drops.filter(p => p.life > 0 && p.y < 1.05);
  requestAnimationFrame(tickBloom);
}

// ---------- level meter ----------
const meterData = new Uint8Array(64);
setInterval(() => {
  if (!AC || !playing) { meterLevel.style.width = '4%'; return; }
  analyser.getByteTimeDomainData(meterData);
  let sum = 0;
  for (let i = 0; i < meterData.length; i++) { const v = (meterData[i] - 128) / 128; sum += v * v; }
  meterLevel.style.width = Math.min(100, 6 + Math.sqrt(sum) * 220) + '%';
}, 100);

// ---------- scroll coupling (constraint: must react to scroll) ----------
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? scrollY / max : 0;
  scrollBend = p;
  scrollProgress.style.width = (p * 100) + '%';
  meterScroll.style.width = (4 + p * 96) + '%';
  if (AC) {
    // scroll opens the master filter and swells reverb: clearly audible + visible
    filterNode.frequency.setTargetAtTime(900 + (1 - Math.abs(p - 0.5) * 2) * 4000 + p * 9000, AC.currentTime, 0.2);
    verbGain.gain.setTargetAtTime(fx.verbMix * 1.4 * (1 + p * 0.9), AC.currentTime, 0.2);
  }
  document.querySelectorAll('.frond').forEach((f, i) => {
    f.style.transform = `rotate(${Math.sin(scrollY / 120 + i) * (10 + p * 18)}deg) translateY(${p * -14}px)`;
  });
  $('#machine').style.transform = `perspective(1200px) rotateX(${p * 4}deg)`;
}
addEventListener('scroll', onScroll, { passive: true });

// ---------- seeds: instant rhythm sharing ----------
const GLYPHS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function encodeSeed() {
  let bits = '';
  TRACKS.forEach(t => pattern[t.id].forEach(v => bits += v ? '1' : '0'));
  let num = BigInt('0b' + bits);
  let s = '';
  if (num === 0n) s = 'A';
  while (num > 0n) { s = GLYPHS[Number(num % 31n)] + s; num = num / 31n; }
  const fxS = [fx.delayTime, fx.delayFb, fx.verbDecay, fx.verbMix].map(v => GLYPHS[Math.round(v * 30)]).join('');
  const bpmS = (+bpmEl.value).toString(31).toUpperCase().padStart(2, '0');
  const seed = `EF-${s}-${fxS}${bpmS}`;
  seedCode.textContent = seed;
  history.replaceState(null, '', '#' + seed);
  return seed;
}
function decodeSeed(seed) {
  try {
    const clean = seed.trim().replace(/^#/, '');
    const parts = clean.split('-');
    if (parts[0] !== 'EF' || parts.length < 3) return false;
    const gridPart = parts[1], tail = parts[2];
    let num = 0n;
    for (const ch of gridPart) { const i = GLYPHS.indexOf(ch); if (i < 0) return false; num = num * 31n + BigInt(i); }
    let bits = num.toString(2).padStart(80, '0').slice(-80);
    TRACKS.forEach((t, ti) => {
      for (let s = 0; s < STEPS; s++) pattern[t.id][s] = bits[ti * STEPS + s] === '1';
    });
    if (tail.length >= 6) {
      const g = (c) => GLYPHS.indexOf(c) / 30;
      fx.delayTime = g(tail[0]); fx.delayFb = g(tail[1]); fx.verbDecay = g(tail[2]); fx.verbMix = g(tail[3]);
      const bpm = parseInt(tail.slice(4), 31);
      if (bpm >= 70 && bpm <= 170) { bpmEl.value = bpm; bpmVal.textContent = bpm; }
      dFn._x = fx.delayTime; dFn._y = 1 - fx.delayFb; vFn._x = fx.verbDecay; vFn._y = 1 - fx.verbMix;
      applyFx(); rebuildImpulse();
    }
    buildGrid(); encodeSeed(); save();
    return true;
  } catch { return false; }
}
function refreshSeed() { encodeSeed(); }
$('#btnCopy').addEventListener('click', async () => {
  const seed = encodeSeed();
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toastMsg('Seed link copied — send the fern.'); }
  catch {
    seedInput.value = url; seedInput.select();
    document.execCommand && document.execCommand('copy');
    toastMsg('Link placed in the box below — copy it manually.');
  }
  seedNote.textContent = `Seed ${seed} · ${url.length} chars, no server involved.`;
});
$('#btnLoad').addEventListener('click', () => {
  ctx();
  if (decodeSeed(seedInput.value)) { toastMsg('Seed planted — the fern regrew.'); preview('spore'); }
  else toastMsg('That seed would not sprout. Check it and try again.');
});
seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnLoad').click(); });

// ---------- toolbar ----------
$('#btnSeed').addEventListener('click', () => {
  ctx(); AC.resume();
  const density = { kick: .28, snare: .16, hat: .55, clank: .12, spore: .2 };
  TRACKS.forEach(t => {
    for (let s = 0; s < STEPS; s++) {
      let p = density[t.id];
      if (s % 4 === 0 && t.id === 'kick') p = 0.9;
      if (s === 4 || s === 12) p = t.id === 'snare' ? 0.95 : p;
      if (s % 2 === 0 && t.id === 'hat') p = 0.85;
      pattern[t.id][s] = Math.random() < p;
    }
  });
  if (!playing) start();
  buildGrid(); save(); preview('spore');
  toastMsg('A wild rhythm blew in through the vents.');
});
$('#btnClear').addEventListener('click', () => {
  TRACKS.forEach(t => pattern[t.id].fill(false));
  buildGrid(); save(); toastMsg('Bed weeded. Fresh moss.');
});
$('#btnErase').addEventListener('click', (e) => {
  eraseMode = !eraseMode;
  e.currentTarget.textContent = eraseMode ? '🧽 Eraser: on' : '🧽 Eraser: off';
  e.currentTarget.setAttribute('aria-pressed', String(eraseMode));
});
$('#btnMute').addEventListener('click', (e) => {
  isMuted = !isMuted;
  e.currentTarget.textContent = isMuted ? '🔇 Mute: on' : '🔔 Mute: off';
});
$('#btnTop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

// ---------- persistence ----------
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      pattern, fx, bpm: bpmEl.value, swing: swingEl.value,
    }));
  } catch {}
}
function load() {
  if (location.hash.length > 4) { if (decodeSeed(location.hash)) return; }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.pattern) TRACKS.forEach(t => { if (Array.isArray(d.pattern[t.id])) pattern[t.id] = d.pattern[t.id].slice(0, 16).map(Boolean); });
    if (d.fx) Object.assign(fx, d.fx);
    if (d.bpm) { bpmEl.value = d.bpm; bpmVal.textContent = d.bpm; }
    if (d.swing) { swingEl.value = d.swing; swingVal.textContent = d.swing + '%'; }
  } catch {}
}

// ---------- toast ----------
let toastT = null;
function toastMsg(msg) {
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ---------- boot ----------
load();
buildGrid();
applyFx();
sizeBloom();
addEventListener('resize', sizeBloom);
setTimeout(sizeBloom, 300);
onScroll();
requestAnimationFrame(tickBloom);
setInterval(() => { if (playing) encodeSeed(); }, 4000);
console.log('Echo Fern Sequencer ready — paint the moss.');
