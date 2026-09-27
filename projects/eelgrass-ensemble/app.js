// Eelgrass Ensemble — conduct an underwater grass band.
// tide baton (drag lagoon: X→tempo, Y→tide) · grass voices (8 synth blades) · reef mix (filter/echo/glow + presets)
// All audio synthesized with WebAudio. Settings persist to localStorage.

const $ = (id) => document.getElementById(id);
const NOTES = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
const FREQ = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25 };
const PRESETS = {
  lagoon: { depth: 60, current: 35, glow: 70, tide: 50, tempo: 96 },
  storm: { depth: 25, current: 65, glow: 85, tide: 85, tempo: 132 },
  night: { depth: 85, current: 55, glow: 45, tide: 30, tempo: 72 },
};
const STORE_KEY = "eelgrass-ensemble-v1";

const state = {
  playing: false,
  tempo: 96,
  tide: 50,
  depth: 60,
  current: 35,
  glow: 70,
  voices: new Array(8).fill(true),
  step: 0,
};

// ---------- persistence ----------
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  for (const k of ["tempo", "tide", "depth", "current", "glow"]) {
    if (Number.isFinite(saved[k])) state[k] = saved[k];
  }
  if (Array.isArray(saved.voices) && saved.voices.length === 8) state.voices = saved.voices.map(Boolean);
} catch { /* fresh lagoon */ }
const save = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      tempo: state.tempo, tide: state.tide, depth: state.depth,
      current: state.current, glow: state.glow, voices: state.voices,
    }));
  } catch { /* private mode — still plays */ }
};

// ---------- audio engine ----------
let AC = null, master, tideFilter, delaySend, delayNode, analyser;
function ensureAudio() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = state.glow / 100 * 0.9;

  tideFilter = AC.createBiquadFilter();
  tideFilter.type = "lowpass";
  tideFilter.frequency.value = 600 + (state.depth / 100) * 5200;
  tideFilter.Q.value = 1.1;

  // echo = underwater current
  delayNode = AC.createDelay(1.5);
  delayNode.delayTime.value = 0.34;
  const fb = AC.createGain(); fb.gain.value = 0.38;
  delayNode.connect(fb); fb.connect(delayNode);
  delaySend = AC.createGain();
  delaySend.gain.value = state.current / 100 * 0.7;

  analyser = AC.createAnalyser();
  analyser.fftSize = 64;

  tideFilter.connect(master);
  delaySend.connect(delayNode);
  delayNode.connect(master);
  master.connect(analyser);
  analyser.connect(AC.destination);
  applyTide();
}

function applyTide() {
  if (!AC) return;
  const t = AC.currentTime;
  // tide swell: LFO on filter cutoff, depth set by tide slider
  tideFilter.frequency.cancelScheduledValues(t);
  tideFilter.frequency.setValueAtTime(600 + (state.depth / 100) * 5200, t);
  master.gain.setTargetAtTime(state.glow / 100 * 0.9, t, 0.05);
  delaySend.gain.setTargetAtTime(state.current / 100 * 0.7, t, 0.05);
}

function pluck(i, when = 0, vel = 1) {
  if (!AC) return;
  const t = AC.currentTime + when;
  const f = FREQ[NOTES[i]];
  const osc = AC.createOscillator();
  osc.type = i % 3 === 2 ? "sine" : "triangle";
  osc.frequency.value = f;
  // gentle tide vibrato
  const lfo = AC.createOscillator();
  lfo.frequency.value = 4 + state.tide / 25;
  const lfoG = AC.createGain();
  lfoG.gain.value = 2 + state.tide / 12;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);

  const g = AC.createGain();
  const peak = 0.22 * vel;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

  osc.connect(g); g.connect(tideFilter); g.connect(delaySend);
  osc.start(t); lfo.start(t);
  osc.stop(t + 1.2); lfo.stop(t + 1.2);
  flashVoice(i);
}

// ---------- sequencer ----------
// each blade plays on its own Euclidean-ish cycle so the meadow feels alive
const CYCLES = [8, 8, 4, 8, 2, 8, 4, 8];
const OFFSETS = [0, 3, 1, 5, 0, 6, 2, 4];
let timer = null;
function schedule() {
  const spb = 60 / state.tempo / 2; // eighth notes
  timer = setTimeout(() => {
    if (!state.playing) return;
    for (let i = 0; i < 8; i++) {
      if (state.voices[i] && state.step % CYCLES[i] === OFFSETS[i] % CYCLES[i]) {
        pluck(i, 0, 0.7 + Math.random() * 0.5);
        energize[i] = 1;
      }
    }
    state.step = (state.step + 1) % 64;
    schedule();
  }, spb * 1000);
}

function setPlaying(on) {
  if (on) ensureAudio();
  state.playing = on;
  $("playBtn").innerHTML = on ? "⏸&nbsp;Pause" : "▶&nbsp;Play";
  $("playBtn").classList.toggle("playing", on);
  $("playBtn").setAttribute("aria-pressed", String(on));
  clearTimeout(timer);
  if (on) { state.step = 0; schedule(); }
  $("tapHint").classList.add("hide");
}

// ---------- canvas: eelgrass meadow ----------
const canvas = $("reef"), ctx = canvas.getContext("2d");
const lagoon = $("lagoon"), baton = $("baton");
const energize = new Array(8).fill(0);
let sway = 0, level = 0;

function sizeCanvas() {
  const r = lagoon.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, r.width * dpr);
  canvas.height = 340 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", sizeCanvas);

function bladePath(x, base, h, bend, w) {
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.bezierCurveTo(x - w + bend * 0.3, base - h * 0.4, x + bend * 0.7, base - h * 0.7, x + bend, base - h);
  ctx.lineTo(x + bend + w * 0.7, base - h);
  ctx.bezierCurveTo(x + bend * 0.7 + w, base - h * 0.6, x + w, base - h * 0.3, x + w, base);
  ctx.closePath();
}

const BLADES = 8;
function draw() {
  const W = canvas.width / (Math.min(window.devicePixelRatio || 1, 2)), H = 340;
  sway += 0.012 + state.tide / 4000;
  level += (((AC && state.playing) ? sampleLevel() : 0) - level) * 0.1;
  ctx.clearRect(0, 0, W, H);

  // sandy floor glow
  const sand = ctx.createLinearGradient(0, H - 60, 0, H);
  sand.addColorStop(0, "rgba(255,138,92,0)");
  sand.addColorStop(1, "rgba(255,138,92,0.22)");
  ctx.fillStyle = sand;
  ctx.fillRect(0, H - 60, W, 60);

  const gap = W / (BLADES + 1);
  for (let i = 0; i < BLADES; i++) {
    energize[i] = Math.max(0, energize[i] - 0.03);
    const x = gap * (i + 1);
    const h = 130 + ((i * 47) % 90) + energize[i] * 30 + level * 60;
    const bend = Math.sin(sway * 2 + i * 0.9) * (14 + state.tide / 3) + energize[i] * 18;
    const w = 9 + (i % 3) * 2;
    const on = state.voices[i];
    const e = energize[i];

    const grad = ctx.createLinearGradient(0, H - 20, 0, H - 20 - h);
    if (on) {
      grad.addColorStop(0, "#0e7c7b");
      grad.addColorStop(1, e > 0.15 ? "#ff8a5c" : "#7ef0c1");
    } else {
      grad.addColorStop(0, "rgba(14,124,123,0.35)");
      grad.addColorStop(1, "rgba(126,240,193,0.25)");
    }
    ctx.fillStyle = grad;
    ctx.shadowColor = e > 0.15 ? "#ff8a5c" : "#7ef0c1";
    ctx.shadowBlur = e * 28 + (on ? 6 : 0);
    bladePath(x, H - 14, h, bend, w);
    ctx.fill();
    ctx.shadowBlur = 0;

    // seed head
    ctx.beginPath();
    ctx.arc(x + bend, H - 14 - h, 3 + e * 5, 0, Math.PI * 2);
    ctx.fillStyle = on ? (e > 0.15 ? "#ff8a5c" : "#7ef0c1") : "rgba(126,240,193,0.3)";
    ctx.fill();

    // store hit zone
    bladeZones[i] = { x0: x - 34, x1: x + 34 };
  }

  // baton shimmer follows glow
  requestAnimationFrame(draw);
}
const bladeZones = new Array(BLADES).fill(null).map(() => ({ x0: 0, x1: 0 }));

function sampleLevel() {
  if (!analyser) return 0;
  const d = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(d);
  let s = 0;
  for (const v of d) s += v;
  return s / d.length / 255;
}

// ---------- tide baton gestures ----------
let dragging = false, lastX = 0, lastT = 0, lastTap = 0, tapIdx = -1;
function lagoonPos(e) {
  const r = lagoon.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
}
function moveBaton(x, y) {
  baton.style.left = x + "px";
  baton.style.top = y + "px";
  baton.style.opacity = "1";
}
function sparkle(x, y) {
  const s = document.createElement("span");
  s.style.left = x + "px"; s.style.top = y + "px";
  $("trail").appendChild(s);
  setTimeout(() => s.remove(), 850);
}
lagoon.addEventListener("pointerdown", (e) => {
  ensureAudio();
  $("tapHint").classList.add("hide");
  dragging = true; lastX = e.clientX; lastT = performance.now();
  lagoon.setPointerCapture(e.pointerId);
  const p = lagoonPos(e);
  moveBaton(p.x, p.y);
  sparkle(p.x, p.y);

  // tap a blade? double-tap plucks solo, single tap toggles after delay
  const idx = bladeZones.findIndex(z => e.clientX - lagoon.getBoundingClientRect().left > z.x0 && e.clientX - lagoon.getBoundingClientRect().left < z.x1);
  const now = performance.now();
  if (idx >= 0) {
    if (tapIdx === idx && now - lastTap < 320) {
      ensureAudio(); pluck(idx, 0, 1); energize[idx] = 1;
      pingVoice(idx);
      tapIdx = -1;
    } else {
      tapIdx = idx; lastTap = now;
      setTimeout(() => {
        if (tapIdx === idx) { toggleVoice(idx); tapIdx = -1; }
      }, 330);
    }
  }
});
lagoon.addEventListener("pointermove", (e) => {
  const p = lagoonPos(e);
  if (!dragging) { moveBaton(p.x, p.y); return; }
  moveBaton(p.x, p.y);
  sparkle(p.x, p.y);
  const now = performance.now();
  const dx = Math.abs(e.clientX - lastX) / Math.max(1, now - lastT); // px per ms
  lastX = e.clientX; lastT = now;
  // horizontal energy → tempo (60–160), vertical → tide
  const target = Math.min(160, Math.max(60, 60 + dx * 260));
  state.tempo += (target - state.tempo) * 0.12;
  state.tide = Math.min(100, Math.max(0, (p.y / p.h) * 100));
  syncControls(); save();
});
const endDrag = () => { dragging = false; };
lagoon.addEventListener("pointerup", endDrag);
lagoon.addEventListener("pointercancel", endDrag);

// ---------- voices UI ----------
const voicesEl = $("voices");
const voiceBtns = [];
function buildVoices() {
  voicesEl.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const b = document.createElement("button");
    b.className = "voice" + (state.voices[i] ? "" : " off");
    b.setAttribute("aria-pressed", String(state.voices[i]));
    b.innerHTML = `<span class="blade">🌿</span><span class="note">${NOTES[i]}</span><span class="state">${state.voices[i] ? "sounding" : "muted"}</span>`;
    b.title = `${NOTES[i]} — click to ${state.voices[i] ? "mute" : "unmute"}`;
    b.addEventListener("click", () => { ensureAudio(); toggleVoice(i); pluck(i, 0, 0.8); energize[i] = 1; save(); });
    voicesEl.appendChild(b);
    voiceBtns[i] = b;
  }
}
function toggleVoice(i) {
  state.voices[i] = !state.voices[i];
  const b = voiceBtns[i];
  b.classList.toggle("off", !state.voices[i]);
  b.setAttribute("aria-pressed", String(state.voices[i]));
  b.querySelector(".state").textContent = state.voices[i] ? "sounding" : "muted";
  save();
}
function flashVoice(i) {
  const b = voiceBtns[i];
  if (!b) return;
  b.classList.add("pulse");
  setTimeout(() => b.classList.remove("pulse"), 220);
}
function pingVoice(i) {
  const b = voiceBtns[i];
  if (!b) return;
  b.classList.remove("solo-ping"); void b.offsetWidth; b.classList.add("solo-ping");
}

// ---------- controls ----------
function syncControls() {
  $("tempo").value = Math.round(state.tempo);
  $("tide").value = Math.round(state.tide);
  $("depth").value = state.depth;
  $("current").value = state.current;
  $("glow").value = state.glow;
  $("tempoOut").textContent = Math.round(state.tempo);
  $("tideOut").textContent = Math.round(state.tide);
  $("depthOut").textContent = state.depth + "%";
  $("currentOut").textContent = state.current + "%";
  $("glowOut").textContent = state.glow + "%";
  $("tempoBar").style.width = ((state.tempo - 60) / 100 * 100) + "%";
  $("tideBar").style.width = state.tide + "%";
}
$("tempo").addEventListener("input", (e) => { state.tempo = +e.target.value; syncControls(); save(); });
$("tide").addEventListener("input", (e) => { state.tide = +e.target.value; syncControls(); save(); });
$("depth").addEventListener("input", (e) => { state.depth = +e.target.value; applyTide(); syncControls(); save(); });
$("current").addEventListener("input", (e) => { state.current = +e.target.value; applyTide(); syncControls(); save(); });
$("glow").addEventListener("input", (e) => { state.glow = +e.target.value; applyTide(); syncControls(); save(); });

document.querySelectorAll(".chip").forEach((c) => {
  c.addEventListener("click", () => {
    ensureAudio();
    Object.assign(state, PRESETS[c.dataset.preset]);
    applyTide(); syncControls(); save();
    document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active");
  });
});

$("playBtn").addEventListener("click", () => setPlaying(!state.playing));
$("calmBtn").addEventListener("click", () => setPlaying(false));
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) { e.preventDefault(); setPlaying(!state.playing); }
});

// ---------- bubbles ----------
(function bubbles() {
  const box = $("bubbles");
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    const sz = 4 + Math.random() * 16;
    s.style.cssText = `left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;animation-duration:${7 + Math.random() * 12}s;animation-delay:${-Math.random() * 14}s;`;
    box.appendChild(s);
  }
})();

// ---------- boot ----------
buildVoices();
syncControls();
sizeCanvas();
setTimeout(sizeCanvas, 60);
draw();
