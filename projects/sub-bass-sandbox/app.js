// Sub Bass Sandbox — 808 toy: 16-step sequencer, glide+drive, randomizer, echo room.
// Plain WebAudio, no samples, no deps. Pattern persists to localStorage.

const $ = (s) => document.querySelector(s);
const LS_KEY = "sub-bass-sandbox:v1";

// Chromatic bass range C1..B2 (MIDI 24..47)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiToName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_MIDIS = Array.from({ length: 24 }, (_, i) => 24 + i); // C1..B2

const DEFAULTS = {
  on: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,1],
  notes: [33,33,33,31, 33,33,29,33, 33,36,33,33, 31,33,28,33], // A1-based groove
  tempo: 112, glide: 35, drive: 30, room: 45, echo: 50, decay: 60,
  mix: 35, punch: 65, vol: 80,
};
const PRESETS = {
  deep:   { on:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], notes:[28,28,28,28,28,28,26,28,28,28,31,28,28,28,24,26] },
  bounce: { on:[1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0], notes:[33,33,36,33,38,33,33,31,33,36,33,33,29,33,31,29] },
  acid:   { on:[1,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0], notes:[33,34,33,36,33,32,33,36,39,38,36,34,33,31,29,28] },
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    if (!Array.isArray(s.on) || s.on.length !== 16) s.on = DEFAULTS.on.slice();
    if (!Array.isArray(s.notes) || s.notes.length !== 16) s.notes = DEFAULTS.notes.slice();
    return s;
  } catch { return structuredClone(DEFAULTS); }
}
const state = loadState();
const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} };
let saveT = null;
const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 200); };

// ---------- sequencer UI ----------
const stepsEl = $("#steps");
const padBtns = [], noteSels = [], stepDivs = [];
for (let i = 0; i < 16; i++) {
  const div = document.createElement("div");
  div.className = "step" + (state.on[i] ? " on" : "");
  const num = document.createElement("div");
  num.className = "num" + (i % 4 === 0 ? " beat4" : "");
  num.textContent = String(i + 1).padStart(2, "0");
  const pad = document.createElement("button");
  pad.className = "pad";
  pad.textContent = midiToName(state.notes[i]).replace(/(\d)/, "$1").toUpperCase();
  pad.setAttribute("aria-label", `Step ${i + 1} ${state.on[i] ? "on" : "off"}, note ${midiToName(state.notes[i])}. Activate to toggle.`);
  pad.addEventListener("click", () => {
    ensureAudio();
    state.on[i] = state.on[i] ? 0 : 1;
    div.classList.toggle("on", !!state.on[i]);
    pad.setAttribute("aria-label", `Step ${i + 1} ${state.on[i] ? "on" : "off"}. Activate to toggle.`);
    if (state.on[i]) previewNote(state.notes[i]); // audition on enable
    saveSoon();
  });
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", `Step ${i + 1} pitch`);
  for (const m of NOTE_MIDIS) {
    const o = document.createElement("option");
    o.value = m; o.textContent = midiToName(m);
    if (m === state.notes[i]) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    state.notes[i] = Number(sel.value);
    pad.textContent = midiToName(state.notes[i]).toUpperCase();
    ensureAudio(); previewNote(state.notes[i]);
    saveSoon();
  });
  div.append(num, pad, sel);
  stepsEl.appendChild(div);
  padBtns.push(pad); noteSels.push(sel); stepDivs.push(div);
}
function refreshSteps() {
  for (let i = 0; i < 16; i++) {
    stepDivs[i].classList.toggle("on", !!state.on[i]);
    noteSels[i].value = String(state.notes[i]);
    padBtns[i].textContent = midiToName(state.notes[i]).toUpperCase();
  }
}

// ---------- audio engine ----------
let ctx = null, N = null; // N = nodes
let prevFreq = 55;
function ensureAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const master = ctx.createGain();
  const analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
  const shaper = ctx.createWaveShaper(); shaper.oversample = "4x";
  const lowpass = ctx.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = 900; lowpass.Q.value = 4;
  const dry = ctx.createGain();
  const echoSend = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  const fb = ctx.createGain();
  const fbFilter = ctx.createBiquadFilter(); fbFilter.type = "lowpass"; fbFilter.frequency.value = 1400;
  const wet = ctx.createGain();
  // voiceBus -> shaper -> lowpass -> dry -> master ; voiceBus -> echoSend -> delay -(fb loop)-> wet -> master
  echoSend.connect(delay); delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
  delay.connect(wet); wet.connect(master);
  dry.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
  // drive inserts before lowpass: voices connect to voiceBus
  const voiceBus = ctx.createGain(); voiceBus.connect(shaper); shaper.connect(lowpass); lowpass.connect(dry);
  N = { master, analyser, shaper, lowpass, dry, echoSend, delay, fb, wet, voiceBus };
  applyParams();
}
function driveCurve(k) { // k 0..1
  const n = 256, curve = new Float32Array(n), amt = 1 + k * 60;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(amt * x) / Math.tanh(amt * 0.6) * 0.7; }
  return curve;
}
function applyParams() {
  if (!ctx || !N) return;
  const t = ctx.currentTime;
  N.shaper.curve = driveCurve(state.drive / 100);
  N.lowpass.frequency.setTargetAtTime(500 + (1 - state.drive / 100) * 900, t, 0.03);
  N.delay.delayTime.setTargetAtTime(0.06 + (state.room / 100) * 0.5, t, 0.03); // ROOM = echo time
  N.fb.gain.setTargetAtTime((state.echo / 100) * 0.82, t, 0.03);               // ECHO = feedback
  N.wet.gain.setTargetAtTime((state.mix / 100) * 0.9, t, 0.03);
  N.master.gain.setTargetAtTime(Math.pow(state.vol / 100, 1.5) * 0.9, t, 0.03);
  N.echoSend.gain.setTargetAtTime(0.9, t, 0.03);
}
function previewNote(midi) { if (!ctx || !N) return; play808(ctx.currentTime + 0.01, midi); }
function play808(t, midi) {
  const target = midiToFreq(midi);
  const glideSec = (state.glide / 100) * 0.35;
  const punchMult = 1 + (state.punch / 100) * 3.2;
  const decaySec = 0.18 + (state.decay / 100) * 1.1;
  const osc = ctx.createOscillator(); osc.type = "sine";
  const start = prevFreq > 0 && glideSec > 0.008 ? prevFreq : target * punchMult;
  osc.frequency.setValueAtTime(Math.max(20, Math.min(400, start)), t);
  // punch drop then glide-settle onto target
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, target * punchMult * 0.55 + target * 0.45), t + 0.028);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, target), t + 0.055 + glideSec);
  const g = ctx.createGain();
  const peak = 0.9;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);
  osc.connect(g); g.connect(N.voiceBus); g.connect(N.echoSend);
  osc.start(t); osc.stop(t + decaySec + 0.1);
  prevFreq = target;
}

// ---------- transport / scheduler ----------
let playing = false, step = 0, nextTime = 0, timer = null;
const playBtn = $("#playBtn"), playLabel = $("#playLabel"), statusEl = $("#status");
function sixteenthDur() { return 60 / state.tempo / 4; }
function scheduler() {
  while (nextTime < ctx.currentTime + 0.14) {
    const s = step;
    if (state.on[s]) play808(Math.max(nextTime, ctx.currentTime + 0.005), state.notes[s]);
    const dl = (nextTime - ctx.currentTime) * 1000;
    setTimeout(() => highlight(s), Math.max(0, dl));
    nextTime += sixteenthDur();
    step = (step + 1) % 16;
  }
}
function highlight(s) {
  stepDivs.forEach((d, i) => d.classList.toggle("playing", playing && i === s));
}
function setPlaying(p) {
  ensureAudio();
  playing = p;
  playBtn.setAttribute("aria-pressed", String(p));
  playLabel.textContent = p ? "STOP" : "PLAY";
  playBtn.querySelector(".play-icon").textContent = p ? "■" : "▶";
  if (p) {
    step = 0; prevFreq = midiToFreq(state.notes[0]);
    nextTime = ctx.currentTime + 0.06;
    timer = setInterval(scheduler, 25);
    statusEl.textContent = `● playing — ${state.tempo} BPM · 16 steps`;
  } else {
    clearInterval(timer); timer = null; highlight(-1);
    statusEl.textContent = "○ stopped — hit PLAY";
  }
}
playBtn.addEventListener("click", () => setPlaying(!playing));
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); }
  if (e.key === "r" || e.key === "R") randomize();
});

// ---------- knobs ----------
const KNOB_DEFS = { glide: 35, drive: 30, room: 45, echo: 50, decay: 60 };
for (const [name, def] of Object.entries(KNOB_DEFS)) {
  const el = $("#knob-" + name), val = $("#val-" + name);
  state[name] = Number.isFinite(state[name]) ? state[name] : def;
  const render = () => {
    el.querySelector(".pointer").style.transform = `translateX(-50%) rotate(${-135 + (state[name] / 100) * 270}deg)`;
    val.textContent = Math.round(state[name]) + "%";
    el.setAttribute("aria-valuenow", String(Math.round(state[name])));
  };
  const set = (v) => { state[name] = Math.max(0, Math.min(100, v)); render(); applyParams(); saveSoon(); };
  render();
  let dragging = false, startY = 0, startV = 0;
  el.addEventListener("pointerdown", (e) => { dragging = true; startY = e.clientY; startV = state[name]; el.setPointerCapture(e.pointerId); ensureAudio(); });
  el.addEventListener("pointermove", (e) => { if (dragging) set(startV + (startY - e.clientY) * 0.5); });
  el.addEventListener("pointerup", () => (dragging = false));
  el.addEventListener("wheel", (e) => { e.preventDefault(); ensureAudio(); set(state[name] + (e.deltaY < 0 ? 4 : -4)); }, { passive: false });
  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(state[name] + 5); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(state[name] - 5); }
  });
  el.addEventListener("dblclick", () => set(def));
}

// sliders
function bindSlider(id, key, fmt) {
  const el = $(id);
  el.value = state[key];
  const out = id === "#tempo" ? $("#tempoVal") : null;
  if (out) out.textContent = state.tempo;
  el.addEventListener("input", () => {
    state[key] = Number(el.value); ensureAudio(); applyParams(); saveSoon();
    if (out) out.textContent = state.tempo;
    if (playing && key === "tempo") statusEl.textContent = `● playing — ${state.tempo} BPM · 16 steps`;
  });
}
bindSlider("#tempo", "tempo"); bindSlider("#mix", "mix"); bindSlider("#punch", "punch"); bindSlider("#vol", "vol");

// ---------- randomizer + presets + clear ----------
function randomize() {
  ensureAudio();
  const roots = [24, 26, 28, 29, 31, 33]; // C1..A1
  const root = roots[Math.floor(Math.random() * roots.length)];
  const scale = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7];
  const density = 6 + Math.floor(Math.random() * 5);
  const on = new Array(16).fill(0);
  on[0] = 1;
  while (on.reduce((a, b) => a + b, 0) < density) on[Math.floor(Math.random() * 16)] = 1;
  const notes = Array.from({ length: 16 }, () => {
    const iv = scale[Math.floor(Math.random() * scale.length)];
    return Math.max(24, Math.min(47, root + iv));
  });
  // keep musical anchor: downbeats hug the root
  notes[0] = root + 12 > 47 ? root : root; notes[8] = root + (Math.random() < 0.5 ? 0 : 7);
  state.on = on; state.notes = notes;
  refreshSteps(); saveSoon();
  // audition: quick two-note teaser
  if (!playing && ctx) { play808(ctx.currentTime + 0.02, notes[0]); play808(ctx.currentTime + 0.24, notes[8]); }
  statusEl.textContent = playing ? statusEl.textContent : "★ fresh random pattern — hit PLAY";
  // dice wiggle
  const d = $("#randomBtn"); d.style.transform = "rotate(-6deg) scale(1.08)";
  setTimeout(() => (d.style.transform = ""), 160);
}
$("#randomBtn").addEventListener("click", randomize);
$("#clearBtn").addEventListener("click", () => { state.on = new Array(16).fill(0); refreshSteps(); saveSoon(); });
document.querySelectorAll(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    const p = PRESETS[c.dataset.preset];
    state.on = p.on.slice(); state.notes = p.notes.slice();
    refreshSteps(); saveSoon(); ensureAudio();
    if (!playing && ctx) { play808(ctx.currentTime + 0.02, state.notes[0]); }
  })
);

// ---------- visualizer (canvas only) ----------
const scope = $("#scope"), sctx = scope.getContext("2d");
function fitScope() {
  const r = scope.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  scope.width = Math.max(300, r.width * dpr); scope.height = 110 * dpr;
}
window.addEventListener("resize", fitScope); fitScope();
const PAL = ["#FF2E88", "#00D9C0", "#FFC900"];
function draw() {
  requestAnimationFrame(draw);
  const W = scope.width, H = scope.height;
  sctx.fillStyle = "#16121A"; sctx.fillRect(0, 0, W, H);
  // dotted grid (memphis)
  sctx.fillStyle = "rgba(255,246,233,.16)";
  for (let x = 12; x < W; x += 26) for (let y = 12; y < H; y += 26) { sctx.fillRect(x, y, 2.4, 2.4); }
  let data = null;
  if (N) { data = new Uint8Array(N.analyser.frequencyBinCount); N.analyser.getByteFrequencyData(data); }
  const bars = 48, bw = W / bars;
  for (let i = 0; i < bars; i++) {
    const v = data ? data[Math.floor((i / bars) * data.length * 0.6)] / 255 : 0.03;
    const h = Math.max(4, v * H * 0.92);
    sctx.fillStyle = PAL[i % 3];
    const x = i * bw + bw * 0.18, w = bw * 0.64;
    const y = H - h - 6;
    sctx.beginPath();
    if (sctx.roundRect) sctx.roundRect(x, y, w, h, 4); else sctx.rect(x, y, w, h);
    sctx.fill();
  }
  // playhead stripe
  if (playing) {
    sctx.fillStyle = "rgba(255,246,233,.85)";
    sctx.fillRect(((step + 15) % 16) / 16 * W, 0, 3, H);
  }
}
draw();
refreshSteps();
console.log("sub-bass-sandbox ready");
