// STATIC BLOOM CHOIR — WebAudio only, no assets. System fonts only.
const $ = (s) => document.querySelector(s);
const stage = $("#stage"), bloomFx = $("#bloomFx"), stepsEl = $("#steps");
const hudVoices = $("#hudVoices"), hudSeed = $("#hudSeed"), hudState = $("#hudState");
const pitchReadout = $("#pitchReadout"), exportStatus = $("#exportStatus");
const btnPower = $("#btnPower"), btnTap = $("#btnTap"), btnScatter = $("#btnScatter"), btnClear = $("#btnClear");
const btnLoop = $("#btnLoop"), btnExport = $("#btnExport"), btnReset = $("#btnReset");
const tapZone = $("#tapZone"), tapCount = $("#tapCount");
const volEl = $("#vol"), bloomEl = $("#bloomAmt"), driftEl = $("#drift");

const LOOP_S = 8, STEPS = 16, STEP_S = LOOP_S / STEPS, N_PETALS = 7;
const COLORS = ["#00f0ff", "#ff2d95", "#f9f002", "#7b2ff7", "#39ff14", "#ff6b35", "#b967ff"];
const SCALES = {
  pent:  { label: "C-min pentatonic", iv: [0, 3, 5, 7, 10, 12, 15] },
  dorian:{ label: "C dorian",         iv: [0, 2, 3, 5, 7, 9, 10] },
  hira:  { label: "Hira lullaby",     iv: [0, 2, 3, 7, 8, 12, 14] },
};
const CHORDS = [
  [48, 51, 55, 58], // Cm7
  [44, 48, 51, 55], // Abmaj (Ab C Eb G)
  [39, 46, 51, 55], // Eb (Eb Bb Eb G)
  [46, 48, 53, 55], // Bb sus (Bb C F G)
];
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const LS_KEY = "static-bloom-choir-v1";

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const midiName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- state ----------
const defaultState = () => ({
  offsets: Array(N_PETALS).fill(0),
  pattern: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
  pads: { root: true, third: true, fifth: true, shimmer: false },
  scale: "pent", vol: 78, bloom: 62, drift: 35, loop: true,
});
let S = defaultState();
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) S = { ...defaultState(), ...JSON.parse(raw) };
} catch { /* fresh */ }
const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch {} };

let taps = [];
let playing = false;

// ---------- petals DOM ----------
const petals = [];
function petalMidi(i) {
  const sc = SCALES[S.scale] || SCALES.pent;
  const deg = i % sc.iv.length;
  const oct = Math.floor(i / sc.iv.length);
  return 60 + sc.iv[deg] + oct * 0 + Math.round(S.offsets[i] || 0);
}
function buildPetals() {
  stage.querySelectorAll(".petal").forEach((e) => e.remove());
  petals.length = 0;
  for (let i = 0; i < N_PETALS; i++) {
    const d = document.createElement("div");
    d.className = "petal";
    d.dataset.i = i;
    d.style.setProperty("--pc", COLORS[i % COLORS.length]);
    d.innerHTML = `<div class="stem"></div><div class="leaf"><div class="meta"><b></b><small></small></div></div>`;
    d.setAttribute("role", "slider");
    d.setAttribute("tabindex", "0");
    d.setAttribute("aria-label", `Petal voice ${i + 1}. Drag vertically to pitch-shift.`);
    stage.appendChild(d);
    petals.push(d);
    layoutPetal(i);
    refreshPetalLabel(i);
    attachDrag(d, i);
  }
  hudVoices.textContent = String(N_PETALS);
}
function layoutPetal(i) {
  const r = stage.getBoundingClientRect();
  const cx = r.width / 2, cy = r.height * 0.46;
  const ang = (i / N_PETALS) * Math.PI * 2 - Math.PI / 2;
  const rx = Math.min(r.width * 0.40, 300), ry = Math.min(r.height * 0.36, 210);
  const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
  const el = petals[i];
  el.style.left = x + "px"; el.style.top = y + "px";
  el.style.setProperty("--stem", Math.max(24, Math.abs(cy - y) * 0.35) + "px");
}
function layoutAll() { for (let i = 0; i < N_PETALS; i++) layoutPetal(i); }
function refreshPetalLabel(i) {
  const m = petalMidi(i), off = Math.round(S.offsets[i] || 0);
  const el = petals[i];
  el.querySelector("b").textContent = midiName(m);
  el.querySelector("small").textContent = `V${i + 1} ${off >= 0 ? "+" : ""}${off}`;
  el.setAttribute("aria-valuenow", off);
  el.setAttribute("aria-valuetext", `${midiName(m)}, offset ${off} semitones`);
}
window.addEventListener("resize", layoutAll);

// drag → pitch-shift ±7 semitones
function attachDrag(el, i) {
  let dragging = false, startY = 0, startOff = 0, lastAud = 0;
  const setFromEvent = (clientY) => {
    const dy = clientY - startY;
    S.offsets[i] = clamp(Math.round(startOff - dy / 14), -7, 7);
    refreshPetalLabel(i);
    liveRetune(i);
    const now = performance.now();
    if (now - lastAud > 140) { lastAud = now; audition(i); }
    pitchReadout.textContent = `${midiName(petalMidi(i))} · V${i + 1} ${S.offsets[i] >= 0 ? "+" : ""}${S.offsets[i]} st`;
  };
  el.addEventListener("pointerdown", (e) => {
    dragging = true; startY = e.clientY; startOff = S.offsets[i] || 0;
    el.classList.add("dragging"); el.setPointerCapture(e.pointerId);
    ensureCtx(); e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => { if (dragging) setFromEvent(e.clientY); });
  const end = () => { if (!dragging) return; dragging = false; el.classList.remove("dragging"); save(); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault(); ensureCtx();
      S.offsets[i] = clamp((S.offsets[i] || 0) + (e.key === "ArrowUp" ? 1 : -1), -7, 7);
      refreshPetalLabel(i); liveRetune(i); audition(i); save();
    }
  });
}

// ---------- pattern UI ----------
function buildSteps() {
  stepsEl.innerHTML = "";
  for (let s = 0; s < STEPS; s++) {
    const b = document.createElement("button");
    b.className = "step" + (S.pattern[s] ? " on" : "");
    b.setAttribute("aria-label", `Step ${s + 1} ${S.pattern[s] ? "on" : "off"}`);
    b.innerHTML = `<span class="dot">${s % 4 === 0 ? "◆" : ""}</span>`;
    b.addEventListener("click", () => {
      S.pattern[s] = S.pattern[s] ? 0 : 1;
      b.classList.toggle("on", !!S.pattern[s]);
      ensureCtx(); if (S.pattern[s]) pluckStep(s, ctx.currentTime + 0.02, 0.5);
      save();
    });
    stepsEl.appendChild(b);
  }
}
function paintSteps(nowStep = -1) {
  [...stepsEl.children].forEach((b, s) => {
    b.classList.toggle("on", !!S.pattern[s]);
    b.classList.toggle("now", s === nowStep);
  });
}

// ---------- audio ----------
let ctx = null, master = null, delaySend = null, padBus = null, pluckBus = null;
let padNodes = [];   // {oscs:[], gain}
let petalNodes = []; // {osc, osc2, gain, pan}
let schedTimer = null, loopT0 = 0, nextStep = 0, chordIdx = -1;

function ensureCtx() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = (S.vol / 100) * 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  // echo space (cheap reverb-ish)
  delaySend = ctx.createGain(); delaySend.gain.value = 0.32;
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.375;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 2200;
  delaySend.connect(dl); dl.connect(damp); damp.connect(fb); fb.connect(dl);
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  damp.connect(wet); wet.connect(master);
  padBus = ctx.createGain(); padBus.gain.value = 0.5; padBus.connect(master);
  const padFilter = ctx.createBiquadFilter(); padFilter.type = "lowpass";
  padFilter.frequency.value = 1600; padFilter.Q.value = 0.4;
  padBus.disconnect(); padBus.connect(padFilter); padFilter.connect(master);
  padBus.connect(delaySend);
  pluckBus = ctx.createGain(); pluckBus.gain.value = 0.9;
  pluckBus.connect(master); pluckBus.connect(delaySend);
  buildPads(); buildPetalDrones();
  return ctx;
}

function buildPads() {
  padNodes.forEach((p) => { try { p.oscs.forEach((o) => o.stop()); } catch {} try { p.gain.disconnect(); } catch {} });
  padNodes = [];
  const defs = [
    { key: "root", type: "sawtooth", det: 4, g: 0.05, sub: true },
    { key: "third", type: "sawtooth", det: 7, g: 0.045 },
    { key: "fifth", type: "triangle", det: 3, g: 0.06 },
    { key: "shimmer", type: "sine", det: 2, g: 0.05, oct: 12 },
  ];
  defs.forEach((d) => {
    const g = ctx.createGain(); g.gain.value = S.pads[d.key] ? d.g : 0.0;
    g.connect(padBus);
    const oscs = [-d.det, d.det].map((c) => {
      const o = ctx.createOscillator(); o.type = d.type; o.detune.value = c;
      o.frequency.value = 110; o.connect(g); o.start(); return o;
    });
    let sub = null;
    if (d.sub) {
      sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = 55;
      const sg = ctx.createGain(); sg.gain.value = 0.8;
      sub.connect(sg); sg.connect(g); sub.start(); oscs.push(sub);
    }
    // slow drift LFO on gain
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.08;
    const lg = ctx.createGain(); lg.gain.value = d.g * 0.5;
    lfo.connect(lg); lg.connect(g.gain); lfo.start(); oscs.push(lfo);
    padNodes.push({ key: d.key, oscs, gain: g, base: d.g, oct: d.oct || 0 });
  });
  chordIdx = -1;
}
function setPadLayer(key, on) {
  const p = padNodes.find((n) => n.key === key);
  if (!p || !ctx) return;
  p.gain.gain.setTargetAtTime(on ? p.base : 0.0, ctx.currentTime, 0.4);
}
function applyChord(ci) {
  if (!ctx || ci === chordIdx) return;
  chordIdx = ci;
  const ch = CHORDS[ci % CHORDS.length];
  const map = { root: ch[0] - 12, third: ch[1], fifth: ch[2], shimmer: ch[3] + 12 };
  const driftAmt = S.drift / 100;
  padNodes.forEach((p) => {
    const f = midiHz(map[p.key] + (p.oct || 0));
    p.oscs.forEach((o) => {
      if (o.type === "sine" && o.frequency.value < 30) return; // LFO guard
      try { o.frequency.setTargetAtTime(f * (1 + (Math.random() - 0.5) * 0.002 * (1 + driftAmt * 4)), ctx.currentTime, 0.6); } catch {}
    });
  });
}

function buildPetalDrones() {
  petalNodes.forEach((p) => { try { p.osc.stop(); p.osc2.stop(); } catch {} try { p.gain.disconnect(); } catch {} });
  petalNodes = [];
  for (let i = 0; i < N_PETALS; i++) {
    const g = ctx.createGain(); g.gain.value = 0.035;
    let pan = null;
    try {
      pan = ctx.createStereoPanner(); pan.pan.value = (i / (N_PETALS - 1)) * 1.4 - 0.7;
      g.connect(pan); pan.connect(pluckBus);
    } catch { g.connect(pluckBus); }
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = midiHz(petalMidi(i));
    const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = midiHz(petalMidi(i)); o2.detune.value = 5;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(g); o2.connect(g2); g2.connect(g);
    const vib = ctx.createOscillator(); vib.frequency.value = 4.5 + i * 0.3;
    const vg = ctx.createGain(); vg.gain.value = 3 + S.drift / 100 * 8;
    vib.connect(vg); vg.connect(o.frequency); vib.start();
    o.start(); o2.start();
    petalNodes.push({ osc: o, osc2: o2, gain: g, pan, vib, vg });
  }
}
function liveRetune(i) {
  if (!ctx || !petalNodes[i]) return;
  const f = midiHz(petalMidi(i));
  petalNodes[i].osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
  petalNodes[i].osc2.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
}

// short audition pluck
function audition(i) {
  if (!ctx) return;
  pluck(midiHz(petalMidi(i)), ctx.currentTime, 0.6, 0.25);
}
function pluck(freq, t, dur = 0.6, vel = 0.3) {
  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 2;
  const g = ctx.createGain();
  const bloom = S.bloom / 100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * (0.5 + bloom)), t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(pluckBus);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function pluckStep(step, t, vel = 0.5) {
  const voice = step % N_PETALS;
  pluck(midiHz(petalMidi(voice)), t, 0.9, vel);
  // visual slightly delayed to match heard time
  const ms = Math.max(0, (t - ctx.currentTime) * 1000);
  setTimeout(() => bloomVisual(voice, step), ms);
}

// ---------- scheduler ----------
function startLoop() {
  ensureCtx();
  if (!ctx || playing) return;
  playing = true;
  loopT0 = ctx.currentTime + 0.08; nextStep = 0;
  hudState.textContent = "LIVE"; hudState.className = "state-live";
  btnPower.textContent = "■ DISSOLVE"; btnPower.classList.add("live"); btnPower.setAttribute("aria-pressed", "true");
  schedTimer = setInterval(schedule, 90);
  schedule();
}
function stopLoop() {
  playing = false;
  clearInterval(schedTimer); schedTimer = null;
  hudState.textContent = "IDLE"; hudState.className = "state-idle";
  btnPower.textContent = "▶ IGNITE CHOIR"; btnPower.classList.remove("live"); btnPower.setAttribute("aria-pressed", "false");
  paintSteps(-1);
}
function schedule() {
  if (!playing) return;
  const ahead = 0.35;
  while (true) {
    const t = loopT0 + nextStep * STEP_S;
    if (t > ctx.currentTime + ahead) break;
    const s = nextStep % STEPS;
    if (s % 4 === 0) applyChord(Math.floor(nextStep / 4) % CHORDS.length);
    if (S.pattern[s]) pluckStep(s, Math.max(t, ctx.currentTime + 0.01), 0.42);
    else setTimeout(((ss) => () => paintNow(ss))(s), Math.max(0, (t - ctx.currentTime) * 1000));
    if (!S.loop && nextStep >= STEPS - 1 && s === STEPS - 1) {
      const stopIn = Math.max(0, (t - ctx.currentTime) * 1000) + 600;
      setTimeout(() => stopLoop(), stopIn);
      nextStep++;
      break;
    }
    nextStep++;
  }
  // paint "now" marker from time
  const elapsed = ctx.currentTime - loopT0;
  if (elapsed >= 0) {
    const cur = Math.floor(elapsed / STEP_S) % STEPS;
    paintSteps(cur);
  }
}
function paintNow(s) { if (playing) paintSteps(s); }

function bloomVisual(voice, step) {
  const el = petals[voice];
  if (el) {
    el.classList.remove("blooming"); void el.offsetWidth; el.classList.add("blooming");
    const r = stage.getBoundingClientRect(), pr = el.getBoundingClientRect();
    spawnParticle(pr.left - r.left + pr.width / 2, pr.top - r.top + 10, COLORS[voice % COLORS.length]);
  }
  paintSteps(step);
}
function spawnParticle(x, y, color) {
  if (bloomFx.childElementCount > 40) return;
  const p = document.createElement("span");
  p.className = "bloom-particle";
  p.style.left = x + "px"; p.style.top = y + "px";
  p.style.setProperty("--pc", color);
  bloomFx.appendChild(p);
  setTimeout(() => p.remove(), 1500);
}

// ---------- tap → seed ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function registerTap() {
  ensureCtx();
  const now = performance.now();
  taps = taps.filter((t) => now - t < 4000);
  taps.push(now);
  tapCount.textContent = String(taps.length);
  tapZone.classList.add("hit"); setTimeout(() => tapZone.classList.remove("hit"), 130);
  if (ctx) pluck(660 + taps.length * 40, ctx.currentTime, 0.25, 0.2);
  if (taps.length >= 3) seedFromTaps();
}
function seedFromTaps() {
  const iois = [];
  for (let k = 1; k < taps.length; k++) iois.push(taps[k] - taps[k - 1]);
  const avg = iois.reduce((a, b) => a + b, 0) / iois.length;
  const seed = Math.round(taps[0] % 100000) ^ Math.round(avg * 7) ^ (taps.length * 7919);
  const rng = mulberry32(seed);
  // tempo → density: fast taps denser, slow taps sparser (lullaby)
  const density = clamp(0.62 - avg / 1600, 0.18, 0.55);
  const pat = Array(STEPS).fill(0);
  pat[0] = 1;
  // quantize tap positions onto steps
  const t0 = taps[0];
  taps.forEach((t) => {
    const beat = (t - t0) / 1000; // seconds
    const s = Math.round((beat / LOOP_S) * STEPS) % STEPS;
    pat[(s + STEPS) % STEPS] = 1;
  });
  for (let s = 0; s < STEPS; s++) if (rng() < density * 0.55) pat[s] = 1;
  S.pattern = pat;
  hudSeed.textContent = "#" + (Math.abs(seed) % 9999).toString().padStart(4, "0");
  buildSteps(); paintSteps(-1); save();
}

// ---------- export 8s WAV ----------
function encodeWAV(buf) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, bytes - 8, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true); ws(36, "data");
  v.setUint32(40, len * nCh * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) {
    const x = clamp(buf.getChannelData(c)[i], -1, 1);
    v.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7FFF, true); off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}
async function exportLoop() {
  exportStatus.textContent = "Rendering 8s offline…";
  exportStatus.classList.remove("ok");
  try {
    const sr = 44100;
    const oc = new OfflineAudioContext(2, sr * LOOP_S, sr);
    const mst = oc.createGain(); mst.gain.value = (S.vol / 100) * 0.8;
    const cmp = oc.createDynamicsCompressor(); mst.connect(cmp); cmp.connect(oc.destination);
    const dl = oc.createDelay(1); dl.delayTime.value = 0.375;
    const fb = oc.createGain(); fb.gain.value = 0.35;
    const wet = oc.createGain(); wet.gain.value = 0.35;
    const send = oc.createGain(); send.gain.value = 0.3;
    send.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mst);
    const bus = oc.createGain(); bus.gain.value = 0.9; bus.connect(mst); bus.connect(send);
    // pads: one osc pair per active layer per chord segment
    const layerOf = { root: 0, third: 1, fifth: 2, shimmer: 3 };
    Object.entries(S.pads).forEach(([key, on]) => {
      if (!on) return;
      CHORDS.forEach((ch, ci) => {
        const t0 = (ci * LOOP_S) / CHORDS.length;
        const f = midiHz(ch[layerOf[key]] + (key === "root" ? -12 : key === "shimmer" ? 12 : 0));
        ["sawtooth", "sine"].forEach((ty, k) => {
          const o = oc.createOscillator(); o.type = key === "fifth" ? "triangle" : ty;
          o.frequency.value = f; o.detune.value = k ? 5 : -5;
          const g = oc.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(key === "root" ? 0.05 : 0.04, t0 + 0.4);
          g.gain.setValueAtTime(key === "root" ? 0.05 : 0.04, t0 + 1.6);
          g.gain.linearRampToValueAtTime(0.0001, t0 + 2.0);
          const lp = oc.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
          o.connect(g); g.connect(lp); lp.connect(bus);
          o.start(t0); o.stop(t0 + 2.05);
        });
      });
    });
    // plucks from pattern
    S.pattern.forEach((on, s) => {
      if (!on) return;
      const t = s * STEP_S + 0.02;
      const f = midiHz(petalMidi(s % N_PETALS));
      const o = oc.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = oc.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1);
    });
    const rendered = await oc.startRendering();
    const blob = encodeWAV(rendered);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bloom-choir-loop.wav";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    exportStatus.textContent = "✓ Exported bloom-choir-loop.wav (8.0s, 44.1kHz).";
    exportStatus.classList.add("ok");
  } catch (err) {
    exportStatus.textContent = "Export failed: " + (err && err.message ? err.message : err);
  }
}

// ---------- wiring ----------
btnPower.addEventListener("click", () => (playing ? stopLoop() : startLoop()));
btnTap.addEventListener("click", registerTap);
tapZone.addEventListener("click", (e) => { e.stopPropagation(); registerTap(); });
btnScatter.addEventListener("click", () => {
  ensureCtx();
  const rng = mulberry32((Math.random() * 1e9) | 0);
  S.pattern = Array.from({ length: STEPS }, (_, s) => (s === 0 || rng() < 0.34 ? 1 : 0));
  hudSeed.textContent = "#SCAT"; buildSteps(); save();
  if (ctx) pluck(520, ctx.currentTime, 0.4, 0.25);
});
btnClear.addEventListener("click", () => {
  S.pattern = Array(STEPS).fill(0); taps = []; tapCount.textContent = "0";
  hudSeed.textContent = "—"; buildSteps(); save();
});
btnLoop.addEventListener("click", () => {
  S.loop = !S.loop; save();
  btnLoop.textContent = S.loop ? "∞ LOOP: ON" : "∞ LOOP: OFF";
  btnLoop.setAttribute("aria-pressed", String(S.loop));
});
btnExport.addEventListener("click", exportLoop);
btnReset.addEventListener("click", () => {
  try { localStorage.removeItem(LS_KEY); } catch {}
  S = defaultState(); syncControls(); buildPetals(); buildSteps(); layoutAll();
  hudSeed.textContent = "—"; tapCount.textContent = "0"; taps = [];
});
document.querySelectorAll(".pad").forEach((b) => {
  const key = b.dataset.pad;
  const paint = () => {
    b.classList.toggle("on", !!S.pads[key]);
    b.setAttribute("aria-pressed", String(!!S.pads[key]));
  };
  paint();
  b.addEventListener("click", () => {
    ensureCtx();
    S.pads[key] = !S.pads[key]; paint(); setPadLayer(key, S.pads[key]); save();
    if (ctx && S.pads[key]) pluck(440 + Object.keys(S.pads).indexOf(key) * 110, ctx.currentTime, 0.4, 0.2);
  });
});
document.querySelectorAll(".seg-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    S.scale = b.dataset.scale; save();
    for (let i = 0; i < N_PETALS; i++) { refreshPetalLabel(i); liveRetune(i); }
    pitchReadout.textContent = SCALES[S.scale].label;
  });
});
volEl.addEventListener("input", () => {
  S.vol = +volEl.value; save();
  if (ctx && master) master.gain.setTargetAtTime((S.vol / 100) * 0.8, ctx.currentTime, 0.05);
});
bloomEl.addEventListener("input", () => { S.bloom = +bloomEl.value; save(); });
driftEl.addEventListener("input", () => {
  S.drift = +driftEl.value; save();
  petalNodes.forEach((p, i) => { try { p.vg.gain.setTargetAtTime(3 + (S.drift / 100) * 8, ctx.currentTime, 0.1); } catch {} });
});
function syncControls() {
  volEl.value = S.vol; bloomEl.value = S.bloom; driftEl.value = S.drift;
  btnLoop.textContent = S.loop ? "∞ LOOP: ON" : "∞ LOOP: OFF";
  document.querySelectorAll(".pad").forEach((b) => {
    b.classList.toggle("on", !!S.pads[b.dataset.pad]);
    b.setAttribute("aria-pressed", String(!!S.pads[b.dataset.pad]));
  });
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.scale === S.scale));
}

// init
syncControls();
buildPetals();
buildSteps();
requestAnimationFrame(() => layoutAll());
setTimeout(layoutAll, 120);
pitchReadout.textContent = (SCALES[S.scale] ? SCALES[S.scale].label : "") + " · drag a petal";
console.log("static bloom choir ready");
