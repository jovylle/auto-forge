// Velvet Hour Reverie — generative clock-chime soundscape (retro-wave)
// WebAudio synthesis, no samples. Works from file:// .
// Features: drag-hours tempo bend · live chime layers · clockwork canvas · WAV export.

const $ = (s) => document.querySelector(s);
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // minor pentatonic ladder
const BASE_BPM = 72;
const STORE_KEY = "velvet-hour-reverie-v1";

const LAYER_DEFS = [
  { id: "bell",  name: "MIDNIGHT BELL", desc: "Hour-strike bell · tolls each bar", key: "1" },
  { id: "chime", name: "GLASS CHIME",   desc: "Drifting pentatonic plucks",        key: "2" },
  { id: "tick",  name: "COPPER TICK",   desc: "Clockwork pulse · every step",      key: "3" },
  { id: "pad",   name: "VELVET PAD",    desc: "Slow detuned dusk-chord",           key: "4" },
  { id: "arp",   name: "NEON ARP",      desc: "Retro arpeggio through echo",       key: "5" },
];

const state = {
  hour: 23.2,
  playing: false,
  flowing: false,
  layers: { bell: true, chime: true, tick: false, pad: true, arp: false },
  gains: { bell: 0.9, chime: 0.75, tick: 0.5, pad: 0.6, arp: 0.65 },
};

// ---------- persistence ----------
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    const s = JSON.parse(raw);
    if (typeof s.hour === "number") state.hour = Math.min(23.99, Math.max(0, s.hour));
    Object.assign(state.layers, s.layers || {});
    Object.assign(state.gains, s.gains || {});
  }
} catch { /* private mode — ignore */ }
const save = () => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ hour: state.hour, layers: state.layers, gains: state.gains })); } catch {}
};

// ---------- derived musical time ----------
const bendOf = (h) => 0.6 + (h / 24) * 1.0;              // 0.6× – ~1.6×
const bpmOf = (h) => BASE_BPM * bendOf(h);
const rootOf = (h) => 220 * Math.pow(2, (Math.floor(h) % 12) / 12); // key rotates with hour
const scaleFreq = (h, degree) => rootOf(h) * Math.pow(2, PENTA[((degree % PENTA.length) + PENTA.length) % PENTA.length] / 12);
const fmtClock = (h) => {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
};

// ---------- audio graph ----------
let actx = null, master = null, delaySend = null, layerBus = {};
function ensureAudio() {
  if (actx) { if (actx.state === "suspended") actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  actx = new AC();
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  master = actx.createGain(); master.gain.value = 0.9;
  master.connect(comp); comp.connect(actx.destination);
  // shared echo
  const dly = actx.createDelay(2); dly.delayTime.value = 60 / bpmOf(state.hour) * 0.75;
  const fb = actx.createGain(); fb.gain.value = 0.38;
  const wet = actx.createGain(); wet.gain.value = 0.5;
  dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(master);
  delaySend = actx.createGain(); delaySend.gain.value = 1;
  delaySend.connect(dly);
  delaySend._delay = dly;
  for (const d of LAYER_DEFS) {
    const g = actx.createGain(); g.gain.value = state.layers[d.id] ? state.gains[d.id] : 0;
    g.connect(master); layerBus[d.id] = g;
  }
}

// ---------- voices (context-agnostic: work for realtime + offline render) ----------
function envGain(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
function voiceBell(ctx, out, echo, t, freq, vol) {
  const g = envGain(ctx, t, vol, 0.005, 3.2); g.connect(out);
  const echoAmt = ctx.createGain(); echoAmt.gain.value = 0.5;
  g.connect(echoAmt); echoAmt.connect(echo);
  for (const [m, a] of [[1, 1], [2.01, 0.45], [2.98, 0.28], [4.2, 0.12]]) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq * m;
    const og = ctx.createGain(); og.gain.value = a;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + 3.6);
  }
}
function voicePluck(ctx, out, echo, t, freq, vol) {
  const g = envGain(ctx, t, vol, 0.004, 1.6); g.connect(out);
  const e = ctx.createGain(); e.gain.value = 0.7; g.connect(e); e.connect(echo);
  for (const [ty, f, a] of [["sine", 1, 1], ["sine", 3.003, 0.22], ["triangle", 0.5, 0.3]]) {
    const o = ctx.createOscillator(); o.type = ty; o.frequency.value = freq * f;
    const og = ctx.createGain(); og.gain.value = a;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + 2);
  }
}
function voiceTick(ctx, out, _echo, t, hi, vol) {
  const o = ctx.createOscillator(); o.type = "square";
  o.frequency.value = hi ? 5200 : 3400;
  const g = envGain(ctx, t, vol * 0.5, 0.001, hi ? 0.05 : 0.09);
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500;
  o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
}
function voicePad(ctx, out, _echo, t, freqs, vol, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * 0.35, t + dur * 0.3);
  g.gain.setValueAtTime(vol * 0.35, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 0.6;
  g.connect(f); f.connect(out);
  for (const fr of freqs) for (const det of [-6, 5]) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + dur + 0.1);
  }
}
function voiceArp(ctx, out, echo, t, freq, vol) {
  const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = "lowpass";
  f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(500, t + 0.22);
  const g = envGain(ctx, t, vol * 0.5, 0.003, 0.24);
  o.connect(f); f.connect(g); g.connect(out);
  const e = ctx.createGain(); e.gain.value = 0.8; g.connect(e); e.connect(echo);
  o.start(t); o.stop(t + 0.4);
}

// ---------- generative scheduler ----------
let step = 0, nextT = 0, timer = null;
const pulses = []; // visual hits consumed by canvas
function rngLive() { return Math.random(); }
function scheduleStep(t, s, hour, active, rand) {
  const bar = Math.floor(s / 8) % 8, sub = s % 8;
  const stepDur = 60 / bpmOf(hour) / 2;
  if (active.bell && sub === 0) {
    const strikes = 1 + (Math.floor(hour) % 4);
    for (let i = 0; i < strikes; i++)
      voiceBell(actx, layerBus.bell, delaySend, t + i * 0.42, rootOf(hour) / 2, 0.5);
    pulses.push({ kind: "bell", at: performance.now() });
  }
  if (active.chime && rand() < 0.62) {
    const deg = Math.floor(rand() * 8) + bar;
    voicePluck(actx, layerBus.chime, delaySend, t, scaleFreq(hour, deg) * 2, 0.32);
    pulses.push({ kind: "chime", at: performance.now() });
  }
  if (active.tick) {
    voiceTick(actx, layerBus.tick, null, t, sub % 2 === 0, 0.30);
  }
  if (active.pad && sub === 0 && bar % 2 === 0) {
    const r = rootOf(hour);
    voicePad(actx, layerBus.pad, null, t, [r / 2, r * 0.595, r * 0.75], 0.5, stepDur * 16);
    pulses.push({ kind: "pad", at: performance.now() });
  }
  if (active.arp) {
    const seq = [0, 2, 4, 7, 4, 2];
    voiceArp(actx, layerBus.arp, delaySend, t, scaleFreq(hour, seq[sub % 6] % 8), 0.30);
    if (sub % 2 === 0) pulses.push({ kind: "arp", at: performance.now() });
  }
}
function tick() {
  const ahead = 0.35;
  while (nextT < actx.currentTime + ahead) {
    const active = { ...state.layers }, hour = state.hour;
    scheduleStep(nextT, step, hour, active, rngLive);
    const stepDur = 60 / bpmOf(hour) / 2;
    if (delaySend._delay) delaySend._delay.delayTime.setValueAtTime(stepDur * 1.5, nextT);
    nextT += stepDur; step++;
  }
}
function setPlaying(on) {
  ensureAudio();
  state.playing = on;
  const btn = $("#startBtn");
  if (on) { step = 0; nextT = actx.currentTime + 0.08; timer = setInterval(tick, 90); }
  else clearInterval(timer);
  btn.textContent = on ? "❚❚ SUSPEND THE REVERIE" : "▶ ENTER THE REVERIE";
  btn.classList.toggle("live", on);
  $("#exportBtn").disabled = false; // export available after first unlock
}

// ---------- layer UI ----------
function buildLayers() {
  const wrap = $("#layers"); wrap.innerHTML = "";
  LAYER_DEFS.forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "layer" + (state.layers[d.id] ? " on" : "");
    el.id = "layer-" + d.id;
    el.innerHTML =
      `<div class="layer-head">
        <button class="layer-toggle" role="switch" aria-checked="${state.layers[d.id]}" aria-label="Toggle ${d.name}"></button>
        <span class="layer-name">${d.name}</span><span class="layer-key">${d.key}</span>
      </div><p class="layer-desc">${d.desc}</p>
      <input type="range" min="0" max="1" step="0.01" value="${state.gains[d.id]}" aria-label="${d.name} volume" />`;
    const [tgl, slider] = [el.querySelector(".layer-toggle"), el.querySelector("input")];
    tgl.addEventListener("click", () => setLayer(d.id, !state.layers[d.id], true));
    slider.addEventListener("input", () => {
      state.gains[d.id] = +slider.value;
      if (actx && state.layers[d.id]) layerBus[d.id].gain.setTargetAtTime(+slider.value, actx.currentTime, 0.03);
      save();
    });
    wrap.appendChild(el);
  });
}
function setLayer(id, on, flash) {
  state.layers[id] = on;
  const el = $("#layer-" + id);
  el.classList.toggle("on", on);
  el.querySelector(".layer-toggle").setAttribute("aria-checked", on);
  if (actx) layerBus[id].gain.setTargetAtTime(on ? state.gains[id] : 0, actx.currentTime, 0.05);
  if (flash) { el.classList.remove("layer-flash"); void el.offsetWidth; el.classList.add("layer-flash"); }
  save();
}

// ---------- dial (drag hours to bend tempo) ----------
const dial = $("#dial"), svg = $("#dialSvg");
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function renderDial() {
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";
  const ring = (r, stroke, w, op) => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", 100); c.setAttribute("cy", 100); c.setAttribute("r", r);
    c.setAttribute("fill", "none"); c.setAttribute("stroke", stroke);
    c.setAttribute("stroke-width", w); c.setAttribute("opacity", op ?? 1);
    svg.appendChild(c);
  };
  ring(94, "#01cdfe", 1.5, 0.7); ring(78, "#ff71ce", 1, 0.5); ring(60, "#b967ff", 1, 0.4);
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0, cur = Math.floor(state.hour) === h;
    const [x1, y1] = polar(100, 100, major ? 82 : 86, h * 15);
    const [x2, y2] = polar(100, 100, 94, h * 15);
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", cur ? "#fffb96" : major ? "#01cdfe" : "#ff71ce");
    l.setAttribute("stroke-width", cur ? 3.5 : major ? 2.5 : 1.2);
    l.setAttribute("opacity", cur ? 1 : major ? 0.95 : 0.55);
    if (cur) l.style.filter = "drop-shadow(0 0 4px #fffb96)";
    svg.appendChild(l);
    if (major) {
      const [tx, ty] = polar(100, 100, 70, h * 15);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", tx); t.setAttribute("y", ty + 4); t.setAttribute("text-anchor", "middle");
      t.setAttribute("fill", "#9d8fc4"); t.setAttribute("font-size", "11"); t.setAttribute("font-family", "Orbitron,sans-serif");
      t.textContent = h; svg.appendChild(t);
    }
  }
  const [nx, ny] = polar(100, 100, 58, state.hour * 15);
  const n = document.createElementNS(NS, "line");
  n.setAttribute("x1", 100); n.setAttribute("y1", 100);
  n.setAttribute("x2", nx); n.setAttribute("y2", ny);
  n.setAttribute("stroke", "#fff"); n.setAttribute("stroke-width", 3); n.setAttribute("stroke-linecap", "round");
  n.style.filter = "drop-shadow(0 0 6px #ff2a9d)";
  svg.appendChild(n);
  const hub = document.createElementNS(NS, "circle");
  hub.setAttribute("cx", 100); hub.setAttribute("cy", 100); hub.setAttribute("r", 6);
  hub.setAttribute("fill", "#ff2a9d"); svg.appendChild(hub);
}
function renderReadouts() {
  $("#clockReadout").textContent = fmtClock(state.hour);
  const bpm = bpmOf(state.hour);
  $("#tempoReadout").textContent = `${Math.round(bpm)} BPM · ${bendOf(state.hour).toFixed(2)}×`;
  $("#keyReadout").textContent = "KEY " + NOTE_NAMES[Math.floor(state.hour) % 12] + " · MIN-PENT";
  dial.setAttribute("aria-valuenow", Math.floor(state.hour));
  const sl = $("#hourSlider");
  if (document.activeElement !== sl) sl.value = state.hour;
}
function setHour(h, fromSlider) {
  state.hour = ((h % 24) + 24) % 24;
  renderDial(); renderReadouts(); save();
}
function hourFromEvent(e) {
  const r = dial.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  return (deg / 360) * 24;
}
let dragging = false;
dial.addEventListener("pointerdown", (e) => { dragging = true; dial.setPointerCapture(e.pointerId); setHour(hourFromEvent(e)); });
dial.addEventListener("pointermove", (e) => { if (dragging) setHour(hourFromEvent(e)); });
dial.addEventListener("pointerup", () => (dragging = false));
dial.addEventListener("pointercancel", () => (dragging = false));
dial.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setHour(state.hour - 0.5); e.preventDefault(); }
  if (e.key === "ArrowRight" || e.key === "ArrowUp") { setHour(state.hour + 0.5); e.preventDefault(); }
});
$("#hourSlider").addEventListener("input", (e) => setHour(+e.target.value, true));
$("#midnightBtn").addEventListener("click", () => {
  setHour(0);
  pulses.push({ kind: "bell", at: performance.now() });
  if (actx && state.playing) voiceBell(actx, master, delaySend, actx.currentTime + 0.02, rootOf(0) / 2, 0.6);
});
$("#flowBtn").addEventListener("click", (e) => {
  state.flowing = !state.flowing;
  e.currentTarget.textContent = state.flowing ? "FLOW: ON" : "FLOW: OFF";
  e.currentTarget.setAttribute("aria-pressed", state.flowing);
});

// ---------- transport + presets ----------
$("#startBtn").addEventListener("click", () => setPlaying(!state.playing));
$("#demoBtn").addEventListener("click", () => {
  for (const d of LAYER_DEFS) setLayer(d.id, true, false);
  document.querySelectorAll(".layer").forEach((el) => { el.classList.remove("layer-flash"); void el.offsetWidth; el.classList.add("layer-flash"); });
});
$("#clearBtn").addEventListener("click", () => { for (const d of LAYER_DEFS) setLayer(d.id, false, false); });
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,textarea")) return;
  if (e.code === "Space") { setPlaying(!state.playing); e.preventDefault(); }
  else if (e.key >= "1" && e.key <= "5") { const d = LAYER_DEFS[+e.key - 1]; setLayer(d.id, !state.layers[d.id], true); }
  else if (e.key === "ArrowLeft") setHour(state.hour - 0.5);
  else if (e.key === "ArrowRight") setHour(state.hour + 0.5);
  else if (e.key.toLowerCase() === "m") setHour(0);
});
setInterval(() => { if (state.flowing) setHour(state.hour + 1 / 120); }, 500); // 1 game-hour / 30 s

// ---------- evolving clockwork visuals ----------
const cv = $("#sky"), cx2d = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function sizeCanvas() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", sizeCanvas); sizeCanvas();
const motes = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.8, v: 0.0004 + Math.random() * 0.0016,
}));
let beatPulse = 0;
setInterval(() => { // consume audio pulses → visual energy
  const now = performance.now();
  while (pulses.length && now - pulses[0].at > 120) pulses.shift();
  if (pulses.length) beatPulse = Math.min(1.4, beatPulse + 0.55);
}, 60);
function gear(gx, gy, r, teeth, rot, color, alpha) {
  cx2d.save(); cx2d.translate(gx, gy); cx2d.rotate(rot);
  cx2d.strokeStyle = color; cx2d.globalAlpha = alpha; cx2d.lineWidth = 2;
  cx2d.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    cx2d.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    cx2d.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10));
  }
  cx2d.stroke();
  cx2d.beginPath(); cx2d.arc(0, 0, r, 0, Math.PI * 2); cx2d.stroke();
  cx2d.beginPath(); cx2d.arc(0, 0, r * 0.35, 0, Math.PI * 2); cx2d.stroke();
  cx2d.restore(); cx2d.globalAlpha = 1;
}
let t0 = performance.now();
function frame(now) {
  const t = (now - t0) / 1000;
  const hn = state.hour / 24;                       // 0..1 across the night
  const hue = 300 - hn * 60 + Math.sin(t * 0.2) * 8; // magenta → violet → blue
  beatPulse *= 0.94;
  // sky
  const sky = cx2d.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#070014");
  sky.addColorStop(0.45, `hsl(${hue},72%,${10 + hn * 6}%)`);
  sky.addColorStop(0.72, `hsl(${(hue + 40) % 360},85%,26%)`);
  sky.addColorStop(1, "#0d0221");
  cx2d.fillStyle = sky; cx2d.fillRect(0, 0, W, H);
  // stars
  cx2d.fillStyle = "#fff";
  for (let i = 0; i < 70; i++) {
    const sx = ((i * 197.3) % 1) * W, sy = ((i * 331.7) % 1) * H * 0.5;
    cx2d.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.8 + i));
    cx2d.fillRect(sx, sy, 1.6, 1.6);
  }
  cx2d.globalAlpha = 1;
  // retro sun (striped), breathes with beat + hour height
  const sunR = Math.min(W, H) * (0.16 + beatPulse * 0.02);
  const sunX = W / 2, sunY = H * (0.60 - hn * 0.12) + Math.sin(t * 0.5) * 4;
  const sg = cx2d.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, "#fffb96"); sg.addColorStop(0.45, "#ff9e00");
  sg.addColorStop(0.75, "#ff2a9d"); sg.addColorStop(1, "#b967ff");
  cx2d.save();
  cx2d.beginPath(); cx2d.arc(sunX, sunY, sunR, 0, Math.PI * 2); cx2d.clip();
  cx2d.fillStyle = sg;
  cx2d.shadowColor = "#ff2a9d"; cx2d.shadowBlur = 40 + beatPulse * 60;
  cx2d.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  cx2d.shadowBlur = 0;
  cx2d.fillStyle = "#0d0221";
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const yy = sunY + (i / stripes) * sunR;
    cx2d.fillRect(sunX - sunR, yy + Math.sin(t * 1.4 + i) * 2, sunR * 2, 2 + i * 1.6);
  }
  cx2d.restore();
  // perspective grid floor
  const horizon = sunY + sunR * 0.9;
  cx2d.strokeStyle = "#01cdfe"; cx2d.globalAlpha = 0.55; cx2d.lineWidth = 1;
  const scroll = (t * bendOf(state.hour) * 40) % 46;
  for (let i = 0; i < 14; i++) {
    const y = horizon + Math.pow(i / 14, 1.8) * (H - horizon) + scroll * (i / 14);
    if (y > H) continue;
    cx2d.beginPath(); cx2d.moveTo(0, y); cx2d.lineTo(W, y); cx2d.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    cx2d.beginPath(); cx2d.moveTo(W / 2 + i * 24, horizon);
    cx2d.lineTo(W / 2 + i * W * 0.14, H); cx2d.stroke();
  }
  cx2d.globalAlpha = 1;
  // clockwork gears drift with tempo
  const spd = bendOf(state.hour);
  gear(W * 0.12, H * 0.24, 44, 12, t * 0.25 * spd, "#b967ff", 0.5);
  gear(W * 0.88, H * 0.30, 60, 16, -t * 0.18 * spd, "#01cdfe", 0.4);
  gear(W * 0.80, H * 0.78, 34, 10, t * 0.4 * spd, "#ff71ce", 0.35);
  // hour orbit ring
  cx2d.save(); cx2d.translate(sunX, sunY); cx2d.globalAlpha = 0.85;
  const or_ = sunR + 26 + beatPulse * 8;
  for (let h = 0; h < 24; h++) {
    const a = h * 15 * Math.PI / 180;
    const isCur = h === Math.floor(state.hour);
    cx2d.fillStyle = isCur ? "#fffb96" : h % 6 === 0 ? "#01cdfe" : "#ff71ce";
    if (isCur) { cx2d.shadowColor = "#fffb96"; cx2d.shadowBlur = 12; } else cx2d.shadowBlur = 0;
    cx2d.beginPath(); cx2d.arc(Math.cos(a) * or_, Math.sin(a) * or_, isCur ? 5 : 2.4, 0, Math.PI * 2); cx2d.fill();
  }
  cx2d.restore(); cx2d.shadowBlur = 0;
  // rising motes
  for (const m of motes) {
    m.y -= m.v * (0.5 + spd);
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    cx2d.globalAlpha = 0.5;
    cx2d.fillStyle = m.s > 1.4 ? "#01cdfe" : "#ff71ce";
    cx2d.beginPath(); cx2d.arc(m.x * W, m.y * H, m.s, 0, Math.PI * 2); cx2d.fill();
  }
  cx2d.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- export midnight mix (16 s WAV, offline render) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function encodeWav(buffers, sampleRate) {
  const ch = buffers.length, len = buffers[0].length;
  const bytes = 44 + len * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, bytes - 8, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, "data");
  v.setUint32(40, len * ch * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, buffers[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}
$("#exportBtn").addEventListener("click", async () => {
  const btn = $("#exportBtn"), status = $("#exportStatus");
  btn.disabled = true; status.textContent = "◌ rendering midnight mix…";
  try {
    const SR = 44100, DUR = 16;
    const off = new OfflineAudioContext(2, SR * DUR, SR);
    const oMaster = off.createGain(); oMaster.gain.value = 0.9; oMaster.connect(off.destination);
    const oDly = off.createDelay(2); oDly.delayTime.value = 60 / bpmOf(state.hour) * 0.75;
    const oFb = off.createGain(); oFb.gain.value = 0.38;
    const oWet = off.createGain(); oWet.gain.value = 0.5;
    oDly.connect(oFb); oFb.connect(oDly); oDly.connect(oWet); oWet.connect(oMaster);
    const buses = {};
    for (const d of LAYER_DEFS) {
      const g = off.createGain(); g.gain.value = state.layers[d.id] ? state.gains[d.id] : 0;
      g.connect(oMaster); buses[d.id] = g;
    }
    // schedule deterministically with a seeded RNG so the mix is reproducible
    const rand = mulberry32(Math.floor(state.hour * 1000) + 7);
    const stepDur = 60 / bpmOf(state.hour) / 2;
    const active = { ...state.layers }, hour = state.hour;
    let t = 0.1, s = 0;
    // local inline scheduling using offline nodes
    while (t < DUR - 0.5) {
      const bar = Math.floor(s / 8) % 8, sub = s % 8;
      if (active.bell && sub === 0) {
        const strikes = 1 + (Math.floor(hour) % 4);
        for (let i = 0; i < strikes && t + i * 0.42 < DUR - 1; i++)
          voiceBell(off, buses.bell, oDly, t + i * 0.42, rootOf(hour) / 2, 0.5);
      }
      if (active.chime && rand() < 0.62)
        voicePluck(off, buses.chime, oDly, t, scaleFreq(hour, Math.floor(rand() * 8) + bar) * 2, 0.32);
      if (active.tick) voiceTick(off, buses.tick, null, t, sub % 2 === 0, 0.30);
      if (active.pad && sub === 0 && bar % 2 === 0) {
        const r = rootOf(hour);
        voicePad(off, buses.pad, null, t, [r / 2, r * 0.595, r * 0.75], 0.5, Math.min(stepDur * 16, DUR - t - 0.2));
      }
      if (active.arp) {
        const seq = [0, 2, 4, 7, 4, 2];
        voiceArp(off, buses.arp, oDly, t, scaleFreq(hour, seq[sub % 6] % 8), 0.30);
      }
      t += stepDur; s++;
    }
    const rendered = await off.startRendering();
    const chans = [rendered.getChannelData(0), rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0)];
    const blob = encodeWav(chans, SR);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `velvet-hour-reverie_${fmtClock(hour).replace(":", "")}.wav`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    status.textContent = `✓ exported 16 s @ ${fmtClock(hour)} · ${Math.round(bpmOf(hour))} BPM — check downloads`;
  } catch (err) {
    console.error(err);
    status.textContent = "✕ export failed in this browser — try Chrome/Edge/Safari";
  } finally {
    btn.disabled = false;
  }
});

// ---------- init ----------
buildLayers();
setHour(state.hour);
if (!state.playing) $("#exportBtn").disabled = false; // offline render needs no running ctx
console.log("velvet-hour-reverie ready");
