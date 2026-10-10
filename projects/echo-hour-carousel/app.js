// Echo Hour Carousel 電響回転時計 — generative time-ring looper
// rings: hour(24) -> root pitch | min(60) -> density/brightness | echo(12) -> delay feedback
// WebAudio only, no assets. localStorage history. MediaRecorder 8s export.

const $ = (id) => document.getElementById(id);
const canvas = $("rings"), ctx = canvas.getContext("2d");
const playBtn = $("playBtn"), exportBtn = $("exportBtn"), exportStatus = $("exportStatus");
const histBtn = $("histBtn"), stampBtn = $("stampBtn"), clearHistBtn = $("clearHistBtn");
const timeline = $("timeline"), bigClock = $("bigClock"), bpmLabel = $("bpmLabel");

const LS_KEY = "echo-hour-carousel-history-v1";
const now = new Date();
const state = {
  hour: now.getHours(), min: now.getMinutes(), echo: 4,
  playing: false, step: 0, seed: (now.getHours() * 60 + now.getMinutes()) >>> 0,
  historyMode: false, histIdx: 0, selected: "hour",
  drag: null,
};

// ---------- history ----------
function loadHist() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function saveHist(h) { try { localStorage.setItem(LS_KEY, JSON.stringify(h.slice(-24))); } catch {} }
function stampHour(auto) {
  const h = loadHist();
  const last = h[h.length - 1];
  if (last && last.h === state.hour && last.m === state.min && !auto) return;
  h.push({ h: state.hour, m: state.min, e: state.echo, at: Date.now() });
  saveHist(h); renderTimeline();
}
function renderTimeline() {
  const h = loadHist();
  timeline.innerHTML = "";
  if (!h.length) { timeline.innerHTML = `<span class="empty">no stamps yet — press「刻印」or change the hour. played-back here.</span>`; return; }
  h.slice().reverse().slice(0, 12).forEach((s) => {
    const b = document.createElement("button");
    b.className = "chip" + (state.historyMode ? " now" : "");
    const hh = String(s.h).padStart(2, "0"), mm = String(s.m).padStart(2, "0");
    b.innerHTML = `${hh}:${mm} <small>echo ${s.e}</small>`;
    b.title = "jump carousel to this hour";
    b.addEventListener("click", () => { applySnap(s); });
    timeline.appendChild(b);
  });
}
function applySnap(s) {
  state.hour = s.h; state.min = s.m; state.echo = s.e;
  state.seed = ((s.h * 60 + s.m) * 2654435761) >>> 0;
  syncLabels();
}

// ---------- music theory ----------
// Insen scale (miyako-bushi-ish, cyber-kyoto vibe): semitone offsets
const INSEN = [0, 1, 5, 7, 8];
const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const midi2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rootMidi = () => 33 + (state.hour % 24); // A1.. ~2 octaves across the day
const rootName = () => NAMES[rootMidi() % 12] + (Math.floor(rootMidi() / 12) - 1);
function noteFor(step) {
  // deterministic generative melody from seed + rings
  const s = (state.seed + step * 97 + state.min * 13) >>> 0;
  const deg = (s ^ (s >> 7)) % INSEN.length;
  const oct = ((s >> 3) + state.echo) % 3;
  return midi2f(rootMidi() + 12 + INSEN[deg] + oct * 12);
}
const bpm = () => 72 + Math.round((state.min / 59) * 48); // 72..120
const density = () => 0.25 + (state.min / 59) * 0.75;
const feedback = () => 0.1 + (state.echo / 11) * 0.55;

// ---------- audio ----------
let AC = null, master, delay, delayGain, filter, mediaDest, comp;
function ensureAudio() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.8;
  comp = AC.createDynamicsCompressor();
  filter = AC.createBiquadFilter(); filter.type = "lowpass";
  filter.frequency.value = 1200 + (state.min / 59) * 5200; filter.Q.value = 0.8;
  delay = AC.createDelay(1.2); delay.delayTime.value = 0.32 + (state.echo / 11) * 0.35;
  delayGain = AC.createGain(); delayGain.gain.value = feedback();
  const wet = AC.createGain(); wet.gain.value = 0.5;
  filter.connect(master);
  master.connect(comp); comp.connect(AC.destination);
  // echo loop: filter -> delay -> delayGain -> delay (feedback) -> wet -> comp
  filter.connect(delay); delay.connect(delayGain); delayGain.connect(delay);
  delay.connect(wet); wet.connect(comp);
  mediaDest = AC.createMediaStreamDestination();
  comp.connect(mediaDest);
}
function blip(freq, t, dur, type, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(filter);
  o.start(t); o.stop(t + dur + 0.05);
}
function pad(freq, t, dur) {
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = "sine"; o.frequency.value = freq / 2;
  f.type = "lowpass"; f.frequency.value = 500;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.1);
}
let schedTimer = null, nextT = 0;
function schedule() {
  const stepDur = 60 / bpm() / 2; // 8th notes
  while (nextT < AC.currentTime + 0.25) {
    const s = state.step, t = nextT;
    const r = mulberry(state.seed + s * 31)();
    if (r < density()) blip(noteFor(s), t, 0.28, s % 4 === 0 ? "triangle" : "sine", 0.5);
    if (s % 2 === 0) blip(noteFor(s) * 2, t + stepDur / 2, 0.1, "square", 0.06); // tick ghost
    if (s % 16 === 0) pad(midi2f(rootMidi()), t, stepDur * 8);
    state.step = s + 1;
    nextT += stepDur;
  }
}
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function startLoop() {
  ensureAudio();
  if (state.playing) return;
  state.playing = true; state.step = 0;
  nextT = AC.currentTime + 0.08;
  schedTimer = setInterval(schedule, 90);
  playBtn.textContent = "■ 停止 STOP"; playBtn.classList.add("live");
  playBtn.setAttribute("aria-pressed", "true");
  stampHour(true);
}
function stopLoop() {
  state.playing = false;
  clearInterval(schedTimer);
  playBtn.textContent = "▶ 起動 PLAY"; playBtn.classList.remove("live");
  playBtn.setAttribute("aria-pressed", "false");
}

// ---------- canvas rings ----------
const CX = 280, CY = 280;
const R1 = 218, R2 = 158, R3 = 100; // hour, min, echo radii
function angOf(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width) - CX;
  const y = (e.clientY - r.top) * (canvas.height / r.height) - CY;
  return { a: Math.atan2(y, x), d: Math.hypot(x, y) };
}
function ringAt(d) {
  if (Math.abs(d - R1) < 44) return "hour";
  if (Math.abs(d - R2) < 38) return "min";
  if (Math.abs(d - R3) < 42) return "echo";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { a, d } = angOf(e);
  const ring = ringAt(d);
  if (!ring) return;
  canvas.setPointerCapture(e.pointerId);
  state.drag = { ring, last: a };
  state.selected = ring; syncTabs();
  if (!state.playing && AC === null) { /* don't autoplay before PLAY, but wake visuals */ }
});
canvas.addEventListener("pointermove", (e) => {
  if (!state.drag) return;
  const { a } = angOf(e);
  let da = a - state.drag.last;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  state.drag.last = a;
  const turns = da / (2 * Math.PI);
  if (state.drag.ring === "hour") state.hour = (state.hour + Math.round(turns * 24) + 24) % 24 || (turns > 0 ? (state.hour + 1) % 24 : (state.hour + 23) % 24);
  if (state.drag.ring === "min") state.min = (((state.min + turns * 60) % 60) + 60) % 60 | 0;
  if (state.drag.ring === "echo") state.echo = Math.max(0, Math.min(11, state.echo + Math.round(turns * 24)));
  state.seed = ((state.hour * 60 + state.min) * 2654435761 + state.echo * 97) >>> 0;
  liveAudioTweak(); syncLabels();
});
const endDrag = () => { if (state.drag && state.drag.ring === "hour") stampHour(false); state.drag = null; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

function liveAudioTweak() {
  if (!AC) return;
  const t = AC.currentTime;
  filter.frequency.setTargetAtTime(1200 + (state.min / 59) * 5200, t, 0.05);
  delay.delayTime.setTargetAtTime(0.32 + (state.echo / 11) * 0.35, t, 0.05);
  delayGain.gain.setTargetAtTime(feedback(), t, 0.05);
}

function draw(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // backdrop grid glow
  ctx.save(); ctx.translate(CX, CY);
  ctx.strokeStyle = "#ffffff10"; ctx.lineWidth = 1;
  for (let r = 40; r <= 240; r += 40) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
  // torii-ish neon frame ticks
  ctx.restore();
  drawHourRing(t); drawMinRing(t); drawEchoRing(t); drawCenter(t);
  requestAnimationFrame(draw);
}
function segArc(r, i, n, w, color, glow, rot) {
  const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 0.86) / n) * Math.PI * 2;
  ctx.beginPath(); ctx.arc(CX, CY, r, a0, a1);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.shadowColor = glow; ctx.shadowBlur = 12;
  ctx.stroke(); ctx.shadowBlur = 0;
}
function drawHourRing(t) {
  const rot = -Math.PI / 2 + t * 0.00002 * (state.playing ? 1 : 0.2);
  for (let i = 0; i < 24; i++) {
    const active = i === state.hour;
    segArc(R1, i, 24, active ? 16 : 9,
      active ? "#ff2d78" : (i % 6 === 0 ? "#7b5cff" : "#2c2560"),
      active ? "#ff2d78" : "transparent", rot);
  }
  // numerals for cardinal hours
  ctx.fillStyle = "#f2ecdf"; ctx.font = "700 13px 'JetBrains Mono',monospace"; ctx.textAlign = "center";
  [0, 6, 12, 18].forEach((h) => {
    const a = rot + (h / 24) * Math.PI * 2;
    ctx.fillText(String(h).padStart(2, "0"), CX + Math.cos(a) * (R1 + 26), CY + Math.sin(a) * (R1 + 26) + 4);
  });
  ringLabel(R1, "外 HOUR · 日", "#ff2d78", state.drag?.ring === "hour");
}
function drawMinRing(t) {
  const rot = -Math.PI / 2 - (state.min / 60) * Math.PI * 2 + (state.playing ? Math.sin(t * 0.0004) * 0.02 : 0);
  for (let i = 0; i < 60; i++) {
    const active = i === state.min;
    const is5 = i % 5 === 0;
    segArc(R2, i, 60, active ? 12 : is5 ? 7 : 3,
      active ? "#00f0ff" : is5 ? "#1e7f8f" : "#1a2a4a",
      active ? "#00f0ff" : "transparent", rot);
  }
  ringLabel(R2, "中 MINUTE · 分", "#00f0ff", state.drag?.ring === "min");
}
function drawEchoRing(t) {
  const rot = -Math.PI / 2 + (state.echo / 12) * Math.PI * 2 + (state.playing ? t * 0.0006 : 0);
  for (let i = 0; i < 12; i++) {
    const on = i <= state.echo;
    ctx.beginPath();
    const a = rot + (i / 12) * Math.PI * 2;
    const rr = R3 + (state.playing ? Math.sin(t * 0.004 + i) * 3 : 0);
    ctx.arc(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, on ? 9 : 5, 0, 7);
    ctx.fillStyle = on ? "#ffcf5c" : "#3a2f1a";
    ctx.shadowColor = on ? "#ffcf5c" : "transparent"; ctx.shadowBlur = on ? 14 : 0;
    ctx.fill(); ctx.shadowBlur = 0;
  }
  ringLabel(R3, "内 ECHO · 響", "#ffcf5c", state.drag?.ring === "echo");
}
function ringLabel(r, text, color, hot) {
  ctx.fillStyle = hot ? "#fff" : color + "aa";
  ctx.font = "700 11px 'Zen Kaku Gothic New',sans-serif"; ctx.textAlign = "center";
  ctx.fillText(text, CX, CY - r - 12);
}
function drawCenter(t) {
  // playhead sweep
  if (state.playing) {
    const stepDur = 60 / bpm() / 2;
    const ph = ((AC ? AC.currentTime : t / 1000) % (stepDur * 16)) / (stepDur * 16);
    const a = -Math.PI / 2 + ph * Math.PI * 2;
    const grad = ctx.createLinearGradient(CX, CY, CX + Math.cos(a) * R1, CY + Math.sin(a) * R1);
    grad.addColorStop(0, "#ff2d7800"); grad.addColorStop(1, "#ff2d78aa");
    ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(a) * R1, CY + Math.sin(a) * R1);
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.stroke();
  }
  // core disc
  const g = ctx.createRadialGradient(CX, CY, 4, CX, CY, 64);
  g.addColorStop(0, "#ff2d78"); g.addColorStop(0.5, "#2a1650"); g.addColorStop(1, "#08070fcc");
  ctx.beginPath(); ctx.arc(CX, CY, 62, 0, 7); ctx.fillStyle = g;
  ctx.shadowColor = "#ff2d78"; ctx.shadowBlur = 26; ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff"; ctx.textAlign = "center";
  ctx.font = "800 26px 'JetBrains Mono',monospace";
  ctx.fillText(`${String(state.hour).padStart(2, "0")}:${String(state.min).padStart(2, "0")}`, CX, CY - 2);
  ctx.font = "700 11px 'Zen Kaku Gothic New',sans-serif"; ctx.fillStyle = "#ffcf5c";
  ctx.fillText(state.playing ? `♪ ${bpm()} BPM · STEP ${state.step % 16}` : "TAP 起動 TO BEGIN · 回", CX, CY + 20);
}

// ---------- labels / tabs ----------
function syncLabels() {
  bigClock.textContent = `${String(state.hour).padStart(2, "0")}:${String(state.min).padStart(2, "0")}`;
  bpmLabel.textContent = `${bpm()} BPM`;
  $("vHour").textContent = state.hour; $("vMin").textContent = state.min; $("vEcho").textContent = state.echo;
  $("rootNote").textContent = rootName();
  $("densVal").textContent = Math.round(density() * 100) + "%";
  $("fbVal").textContent = Math.round(feedback() * 100) + "%";
  $("mRoot").style.width = ((state.hour / 23) * 100) + "%";
  $("mDens").style.width = (density() * 100) + "%";
  $("mFb").style.width = (feedback() * 100 / 0.65) + "%";
}
function syncTabs() {
  document.querySelectorAll(".ring-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.ring === state.selected));
}
document.querySelectorAll(".ring-tab").forEach((b) =>
  b.addEventListener("click", () => { state.selected = b.dataset.ring; syncTabs(); }));
window.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const d = e.key === "ArrowRight" ? 1 : -1;
  if (state.selected === "hour") state.hour = (state.hour + d + 24) % 24;
  if (state.selected === "min") state.min = (state.min + d + 60) % 60;
  if (state.selected === "echo") state.echo = Math.max(0, Math.min(11, state.echo + d));
  liveAudioTweak(); syncLabels();
});

// ---------- buttons ----------
playBtn.addEventListener("click", () => (state.playing ? stopLoop() : startLoop()));
stampBtn.addEventListener("click", () => { stampHour(false); exportStatus.textContent = `刻印 stamped ${String(state.hour).padStart(2, "0")}:${String(state.min).padStart(2, "0")} → history`; });
clearHistBtn.addEventListener("click", () => { saveHist([]); state.historyMode = false; histBtn.textContent = "⏪ history: OFF"; renderTimeline(); });
$("mutateBtn").addEventListener("click", () => {
  state.seed = (Math.random() * 0xffffffff) >>> 0;
  state.min = (Math.random() * 60) | 0; liveAudioTweak(); syncLabels();
});

let histTimer = null;
histBtn.addEventListener("click", () => {
  const h = loadHist();
  if (!h.length) { exportStatus.textContent = "history is empty — stamp an hour first (刻印)"; return; }
  state.historyMode = !state.historyMode;
  histBtn.textContent = state.historyMode ? "⏪ history: ON 再生中" : "⏪ history: OFF";
  histBtn.setAttribute("aria-pressed", String(state.historyMode));
  clearInterval(histTimer); histTimer = null;
  if (state.historyMode) {
    if (!state.playing) startLoop();
    const walk = () => { const hh = loadHist(); if (!hh.length) return; applySnap(hh[state.histIdx % hh.length]); state.histIdx++; };
    state.histIdx = 0; walk();
    histTimer = setInterval(walk, 4000);
  }
  renderTimeline();
});

// ---------- one-click 8s export ----------
exportBtn.addEventListener("click", async () => {
  try {
    ensureAudio();
    if (!state.playing) startLoop();
    if (typeof MediaRecorder === "undefined" || !mediaDest) {
      exportStatus.textContent = "MediaRecorder not supported in this browser — loop keeps playing ♪";
      return;
    }
    exportBtn.disabled = true;
    const rec = new MediaRecorder(mediaDest.stream);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((res) => (rec.onstop = res));
    rec.start();
    let s = 8;
    exportStatus.classList.add("hot");
    exportStatus.textContent = `● recording loop… ${s}s — keep the rings spinning`;
    const tick = setInterval(() => {
      s--;
      if (s > 0) exportStatus.textContent = `● recording loop… ${s}s — keep the rings spinning`;
      else clearInterval(tick);
    }, 1000);
    await new Promise((r) => setTimeout(r, 8000));
    rec.stop(); await done; clearInterval(tick);
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const a = document.createElement("a");
    const tag = `${String(state.hour).padStart(2, "0")}${String(state.min).padStart(2, "0")}-echo`;
    a.href = URL.createObjectURL(blob);
    a.download = `echo-hour-${tag}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    exportStatus.textContent = `✓ exported echo-hour-${tag}.webm (${(blob.size / 1024).toFixed(0)} KB) — loop it ♪`;
  } catch (err) {
    exportStatus.textContent = "export failed: " + err.message;
  } finally {
    exportBtn.disabled = false;
    exportStatus.classList.remove("hot");
  }
});

// ---------- init ----------
syncLabels(); syncTabs(); renderTimeline();
requestAnimationFrame(draw);
console.log("echo-hour-carousel ready", { hour: state.hour, min: state.min });
