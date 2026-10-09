// Tidal Minute Archive — looping tide-clock sequencer + tap sampling + ribbon + loop cards.
// Plain ES module, no deps. Works from file://. System fonts only (CSS).
const $ = (id) => document.getElementById(id);
const STEPS = 12;
const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51]; // D-maj pentatonic-ish climb
const NAMES = ["Low Slack", "First Flood", "Half Flood", "Full Flood", "High Slack", "First Ebb", "Half Ebb", "Full Ebb", "Low Water", "Kelp Drift", "Glass Calm", "Salt Return"];
const TITLES = ["Neap Glass Study", "Kelp-Bell Ledger", "Salt Meridian Reel", "Fogline Lullaby", "Brine Clock Etude", "Driftwood Telemetry", "High Slack Hymn", "Low Water Confession"];

const store = {
  load() { try { return JSON.parse(localStorage.getItem("tma-v1")) || null; } catch { return null; } },
  save(s) { try { localStorage.setItem("tma-v1", JSON.stringify(s)); } catch {} }
};

const state = Object.assign({
  pattern: [1,0,0,1, 0,1,0,0, 1,0,1,0],
  vel: [1,.8,.8,1, .8,1,.8,.8, 1,.8,1,.8],
  bpm: 72, depth: 60, decayMs: 180, voice: "bell", evolve: true, muted: false,
  loop: 1, history: [], tide: 0.5,
}, store.load() || {});

function persist() {
  store.save({ pattern: state.pattern, vel: state.vel, bpm: state.bpm, depth: state.depth,
    decayMs: state.decayMs, voice: state.voice, evolve: state.evolve, muted: state.muted,
    loop: state.loop, history: state.history.slice(-48) });
}

// ---------- audio ----------
let ctx = null, master = null, delaySend = null, mutedGain = null;
function audio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    mutedGain = ctx.createGain(); mutedGain.gain.value = state.muted ? 0 : 1;
    master.connect(comp); comp.connect(mutedGain); mutedGain.connect(ctx.destination);
    // evolving space: feedback delay
    const dly = ctx.createDelay(1); dly.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    delaySend = ctx.createGain(); delaySend.gain.value = 1;
    delaySend.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(master);
    return true;
  } catch { toast("WebAudio unavailable — visuals still run"); return false; }
}

function chime(freq, when, vel, tide) {
  if (!ctx) return;
  const t = when, dec = state.decayMs / 100 * (0.8 + tide * 0.9);
  const cutoff = 700 + tide * (state.depth / 100) * 5200 + 600;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cutoff; lp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * vel * (0.45 + tide * 0.55) + 0.001, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  lp.connect(g); g.connect(master); g.connect(delaySend);
  const partials = {
    shell: [[1, 1, "sine"], [2.01, 0.18, "sine"]],
    bell:  [[1, 1, "sine"], [2.76, 0.4, "sine"], [5.4, 0.18, "triangle"]],
    kelp:  [[1, 1, "triangle"], [1.5, 0.35, "sine"], [3.02, 0.15, "sine"]],
    fog:   [[0.5, 1, "sawtooth"], [1, 0.5, "triangle"], [2.02, 0.2, "sine"]],
  }[state.voice] || [[1,1,"sine"]];
  for (const [m, a, type] of partials) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.value = freq * m * (1 + (tide - 0.5) * 0.01);
    const og = ctx.createGain(); og.gain.value = a / partials.length;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dec + 0.1);
  }
}

// ---------- sequencer ----------
let playing = false, step = 0, nextTime = 0, timer = null, tidePhase = 0.35, lastLoopChimes = 0, tideAcc = 0, tideN = 0;

function stepDur() { return 60 / state.bpm / 2; } // 12 eighth-notes ≈ one "minute"
function tideNow() {
  const depthAmt = state.depth / 100;
  return 0.5 + 0.5 * Math.sin(tidePhase) * (0.25 + 0.75 * depthAmt) + 0.0;
}
function scheduler() {
  while (nextTime < ctx.currentTime + 0.15) {
    const tide = tideNow();
    if (state.pattern[step]) {
      const drift = state.evolve ? (tide - 0.5) * 2 : 0; // tide bends pitch slightly
      const f = SCALE[step] * Math.pow(2, Math.round(drift) / 12);
      chime(f, nextTime, state.vel[step] || 0.9, tide);
      lastLoopChimes++;
      visualStrike(step, nextTime);
    }
    tideAcc += tide; tideN++;
    const dur = stepDur();
    nextTime += dur;
    tidePhase += dur * 0.9;
    const prev = step;
    step = (step + 1) % STEPS;
    if (step === 0) onLoopEnd(prev);
    schedulePaint(step, nextTime);
  }
}
// paint queue mapped to audio time
let paintQ = [];
function schedulePaint(s, t) { paintQ.push({ s, t }); }
function paintLoop() {
  requestAnimationFrame(paintLoop);
  if (!ctx || !playing) return;
  const now = ctx.currentTime;
  while (paintQ.length && paintQ[0].t - now < 0.05) {
    const { s } = paintQ.shift();
    setPlayhead(s);
  }
  // live tide readouts
  const tide = tideNow();
  state.tide = tide;
  tideUI(tide);
}

function start() {
  if (!audio()) return;
  if (playing) return pause();
  playing = true; step = 0; lastLoopChimes = 0; tideAcc = 0; tideN = 0;
  nextTime = ctx.currentTime + 0.06; paintQ = [];
  timer = setInterval(scheduler, 25);
  $("btnPlay").textContent = "⏸ EBB (pause)";
  $("btnPlay").setAttribute("aria-pressed", "true");
}
function pause() {
  playing = false; clearInterval(timer); paintQ = [];
  $("btnPlay").textContent = "▶ FLOOD";
  $("btnPlay").setAttribute("aria-pressed", "false");
}

function onLoopEnd() {
  const avg = tideN ? tideAcc / tideN : 0.5;
  pushStratum({ loop: state.loop, pattern: [...state.pattern], tide: +avg.toFixed(3),
    chimes: lastLoopChimes, voice: state.voice, bpm: state.bpm, t: Date.now() });
  state.loop++;
  lastLoopChimes = 0; tideAcc = 0; tideN = 0;
  if (state.evolve) mutate();
  persist(); renderAll();
}

// gentle generative drift: flip/add one quiet chime, nudge a velocity
function mutate() {
  const r = Math.random();
  const i = Math.floor(Math.random() * STEPS);
  if (r < 0.3) { state.pattern[i] = state.pattern[i] ? 0 : 1; state.vel[i] = 0.55 + Math.random() * 0.3; }
  else if (r < 0.6) { state.vel[i] = Math.min(1, Math.max(0.4, (state.vel[i] || 0.8) + (Math.random() - 0.5) * 0.3)); }
  buildSteps();
}

// one-tap sampling: capture a chime at the live playhead
function tapSample() {
  if (!audio()) return;
  const tide = tideNow();
  const s = playing ? step : (state._armed ?? 0);
  state.pattern[s] = 1;
  state.vel[s] = Math.min(1, 0.72 + tide * 0.28);
  const f = SCALE[s] * (1 + (tide - 0.5) * 0.02);
  chime(f, ctx.currentTime + 0.01, state.vel[s], tide);
  visualStrike(s, ctx.currentTime);
  buildSteps(); renderCard(); persist();
  toast(`◉ sampled “${NAMES[s]}” @ step ${s + 1} · tide ${Math.round(tide * 100)}%`);
  state._armed = (s + 1) % STEPS;
}

// ---------- visuals: clock ----------
const NS = "http://www.w3.org/2000/svg";
function buildSteps() {
  const g = $("steps"); g.innerHTML = "";
  const R = 98, cx = 160, cy = 160;
  state.pattern.forEach((on, i) => {
    const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const grp = document.createElementNS(NS, "g");
    grp.setAttribute("class", `step-dot ${on ? "active" : "inactive"}`);
    grp.dataset.i = i;
    const halo = document.createElementNS(NS, "circle");
    halo.setAttribute("cx", x); halo.setAttribute("cy", y); halo.setAttribute("r", 19);
    halo.setAttribute("class", "halo");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", on ? 15 : 11);
    c.setAttribute("class", "core");
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", x); label.setAttribute("y", y + 3.5);
    label.textContent = i + 1;
    grp.append(halo, c, label);
    grp.addEventListener("click", () => {
      state.pattern[i] = state.pattern[i] ? 0 : 1;
      if (audio() && state.pattern[i]) chime(SCALE[i], ctx.currentTime + 0.01, 0.9, tideNow());
      buildSteps(); renderCard(); persist(); refreshStats();
    });
    g.appendChild(grp);
  });
  refreshStats();
}
function setPlayhead(s) {
  document.querySelectorAll(".step-dot").forEach((el, i) => el.classList.toggle("now", i === s));
  const deg = (s / STEPS) * 360;
  $("hand").setAttribute("transform", `rotate(${deg} 160 160)`);
  $("hubText").textContent = s + 1;
  $("statLoop").textContent = "#" + String(state.loop).padStart(3, "0");
}
function visualStrike(s, when) {
  const delay = Math.max(0, (when - (ctx ? ctx.currentTime : 0)) * 1000);
  setTimeout(() => {
    const el = document.querySelectorAll(".step-dot")[s];
    if (el) { el.classList.add("struck"); setTimeout(() => el.classList.remove("struck"), 220); }
  }, delay);
}
function tideUI(tide) {
  const pct = Math.round(tide * 100);
  $("tideFill").style.width = pct + "%";
  $("tideBob").style.left = `calc(${pct}% - 12px)`;
  $("tidePct").textContent = pct + "%";
  $("statTide").textContent = pct + "%";
  const name = tide > 0.8 ? "SPRING" : tide > 0.6 ? "FLOOD" : tide > 0.4 ? "NEAP" : tide > 0.2 ? "EBB" : "SLACK";
  $("tideStamp").textContent = name;
  // tide ring arc
  const R = 138, C = 2 * Math.PI * R;
  const ring = $("tideRing");
  ring.setAttribute("d", describeArc(160, 160, R, -90, -90 + 360 * tide));
  ring.setAttribute("stroke-dasharray", "none");
  ring.setAttribute("stroke", tide > 0.6 ? "#2e6f8e" : "#3c5a45");
}
function describeArc(cx, cy, r, a0, a1) {
  const p = (a) => { const rad = a * Math.PI / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; };
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

// ---------- history ribbon ----------
function pushStratum(s) { state.history.push(s); state.history = state.history.slice(-48); renderRibbon(); }
function renderRibbon() {
  const box = $("ribbon"); box.innerHTML = "";
  $("ribbonCount").textContent = `${state.history.length} strat${state.history.length === 1 ? "um" : "a"}`;
  if (!state.history.length) {
    box.innerHTML = `<div class="ribbon-empty">∿ no strata yet — press FLOOD and let one loop lay down the first layer ∿</div>`;
    return;
  }
  [...state.history].reverse().forEach((s) => {
    const row = document.createElement("div");
    row.className = "stratum" + (s.loop === state.loop - 1 ? " current" : "");
    const cells = s.pattern.map((p) => {
      const a = p ? 0.35 + s.tide * 0.65 : 0.12;
      const col = p ? `rgba(217,93,57,${a})` : `rgba(159,216,201,${a * 0.5})`;
      return `<i style="background:${col}"></i>`;
    }).join("");
    row.innerHTML = `<span class="s-num">#${String(s.loop).padStart(3, "0")}</span><span class="s-cells">${cells}</span><span class="s-tide">${Math.round(s.tide * 100)}%</span>`;
    row.title = `Loop #${s.loop} · ${s.chimes} chimes · ${s.voice} · click to reload`;
    row.addEventListener("click", () => {
      state.pattern = [...s.pattern]; state.bpm = s.bpm || state.bpm; state.voice = s.voice || state.voice;
      $("bpm").value = state.bpm; $("voice").value = state.voice;
      buildSteps(); renderCard(); persist(); refreshStats();
      toast(`↩ reloaded loop #${s.loop} into the clock`);
    });
    box.appendChild(row);
  });
}

// ---------- loop card ----------
function cardTitle() { return TITLES[(state.loop - 1) % TITLES.length]; }
function renderCard() {
  $("cardLoop").textContent = "LOOP #" + String(state.loop).padStart(3, "0");
  const t = state.tide;
  const name = t > 0.8 ? "SPRING" : t > 0.6 ? "FLOOD" : t > 0.4 ? "NEAP" : t > 0.2 ? "EBB" : "SLACK";
  $("cardTide").textContent = `TIDE ${Math.round(t * 100)}% · ${name}`;
  $("cardTitle").textContent = cardTitle();
  $("cardDate").textContent = new Date().toISOString().slice(0, 10);
  const n = state.pattern.reduce((a, b) => a + b, 0);
  $("cardMeta").textContent = `${n} chimes · ${state.bpm} bpm · ${state.voice} voice · ${state.history.length} strata archived`;
  const dots = $("cardDots"); dots.innerHTML = "";
  state.pattern.forEach((p, i) => {
    const el = document.createElement("i");
    el.style.background = p ? (i === step && playing ? "#c9a86a" : "#d95d39") : "#fffdf4";
    dots.appendChild(el);
  });
  drawWave($("cardWave"), state.pattern, state.tide, 520, 120, false);
}
function drawWave(cv, pattern, tide, W, H, exportMode) {
  const c = cv.getContext("2d");
  c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1c3a44"); g.addColorStop(1, "#0b1512");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // tide wave
  c.beginPath();
  for (let x = 0; x <= W; x += 4) {
    const y = H * 0.55 - Math.sin(x / W * Math.PI * 4 + tide * 6) * H * 0.18 * (0.3 + tide) - tide * H * 0.15;
    x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.strokeStyle = "#9fd8c9"; c.lineWidth = exportMode ? 5 : 3; c.stroke();
  c.lineTo(W, H); c.lineTo(0, H); c.closePath();
  c.fillStyle = "rgba(46,111,142,.45)"; c.fill();
  // step ticks
  pattern.forEach((p, i) => {
    const x = (i + 0.5) / pattern.length * W;
    c.fillStyle = p ? "#d95d39" : "rgba(237,232,216,.25)";
    const h = p ? H * 0.5 : H * 0.15;
    c.fillRect(x - (exportMode ? 8 : 5), H - h - 8, exportMode ? 16 : 10, h);
  });
}

function exportPNG() {
  const W = 640, H = 860;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  if (!c.roundRect) c.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this;};
  c.fillStyle = "#ede8d8"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#141a15"; c.fillRect(0, 0, W, 26);
  for (let x = 0; x < W; x += 26) { c.fillStyle = x % 52 ? "#3c5a45" : "#9fd8c9"; c.fillRect(x, 0, 14, 10); }
  c.strokeStyle = "#141a15"; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
  c.fillStyle = "#141a15"; c.font = "700 20px ui-monospace, Menlo, monospace";
  c.fillText($("cardLoop").textContent + "  ·  " + $("cardTide").textContent, 36, 70);
  c.fillStyle = "#141a15"; c.font = "italic 900 54px Georgia, serif";
  c.fillText(cardTitle(), 36, 130);
  // wave block
  const wave = document.createElement("canvas"); wave.width = 568; wave.height = 180;
  drawWave(wave, state.pattern, state.tide, 568, 180, true);
  c.drawImage(wave, 36, 160, 568, 180);
  // dots
  state.pattern.forEach((p, i) => {
    c.fillStyle = p ? "#d95d39" : "#fffdf4";
    c.strokeStyle = "#141a15"; c.lineWidth = 4;
    const x = 36 + i * 48;
    c.beginPath(); c.roundRect(x, 370, 38, 60, 10); c.fill(); c.stroke();
    c.fillStyle = "#141a15"; c.font = "700 18px ui-monospace, monospace";
    c.fillText(String(i + 1), x + 12, 460);
  });
  c.fillStyle = "#4a4636"; c.font = "16px ui-monospace, Menlo, monospace";
  c.fillText($("cardMeta").textContent, 36, 510);
  // strata mini-tapestry
  c.fillStyle = "#0e130f";
  c.beginPath(); c.roundRect(36, 540, 568, 220, 14); c.fill();
  const rows = state.history.slice(-8);
  rows.forEach((s, r) => {
    s.pattern.forEach((p, i) => {
      c.fillStyle = p ? `rgba(217,93,57,${0.35 + s.tide * 0.65})` : "rgba(159,216,201,.2)";
      c.fillRect(56 + i * 45, 560 + r * 24, 36, 16);
    });
  });
  if (!rows.length) { c.fillStyle = "#9fd8c9"; c.font = "14px ui-monospace, monospace"; c.fillText("∿ first stratum pending — flood the clock ∿", 56, 650); }
  c.fillStyle = "#6b6350"; c.font = "700 15px ui-monospace, monospace";
  c.fillText("TIDAL MINUTE ARCHIVE  ·  " + new Date().toISOString().slice(0, 10), 36, 800);
  const a = document.createElement("a");
  a.download = `tidal-minute-loop-${String(state.loop).padStart(3, "0")}.png`;
  a.href = cv.toDataURL("image/png");
  a.click();
  toast("⬇ loop card exported as PNG");
}

function copyText() {
  const glyph = state.pattern.map((p) => (p ? "◉" : "·")).join(" ");
  const txt = `TIDAL MINUTE ARCHIVE — ${$("cardLoop").textContent}\n“${cardTitle()}” · ${$("cardTide").textContent}\npattern  ${glyph}\n${$("cardMeta").textContent}`;
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
    .then(() => toast("⧉ loop card copied to clipboard"))
    .catch(() => { prompt("Copy this loop card:", txt); });
}
function downloadJSON() {
  const blob = new Blob([JSON.stringify({ app: "tidal-minute-archive", exported: new Date().toISOString(),
    loop: state.loop, bpm: state.bpm, voice: state.voice, pattern: state.pattern,
    vel: state.vel, history: state.history }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tidal-minute-loop-${String(state.loop).padStart(3, "0")}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("{} loop data exported as JSON");
}

// ---------- misc UI ----------
let toastT = null;
function toast(msg) {
  const el = $("toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2400);
}
function refreshStats() {
  $("statChimes").textContent = state.pattern.reduce((a, b) => a + b, 0);
  $("statLoop").textContent = "#" + String(state.loop).padStart(3, "0");
  $("bpmVal").textContent = state.bpm;
  $("depthVal").textContent = state.depth + "%";
  $("decayVal").textContent = (state.decayMs / 100).toFixed(1) + "s";
}

// ---------- wire up ----------
$("btnPlay").addEventListener("click", start);
$("btnTap").addEventListener("click", tapSample);
$("btnClear").addEventListener("click", () => {
  state.pattern = Array(STEPS).fill(0); buildSteps(); renderCard(); persist();
  toast("⌫ dial cleared — tap to score a new tide");
});
$("btnSeed").addEventListener("click", () => {
  state.pattern = Array.from({ length: STEPS }, () => (Math.random() < 0.35 ? 1 : 0));
  if (!state.pattern.some(Boolean)) state.pattern[0] = 1;
  state.vel = state.pattern.map(() => 0.6 + Math.random() * 0.4);
  buildSteps(); renderCard(); persist();
  toast("✳ tide seeded a new pattern");
});
$("btnMute").addEventListener("click", (e) => {
  state.muted = !state.muted;
  if (mutedGain) mutedGain.gain.value = state.muted ? 0 : 1;
  e.currentTarget.textContent = state.muted ? "✕ muted" : "♪ sound on";
  e.currentTarget.setAttribute("aria-pressed", String(state.muted));
  persist();
});
$("btnKeep").addEventListener("click", () => {
  pushStratum({ loop: state.loop, pattern: [...state.pattern], tide: +state.tide.toFixed(3),
    chimes: state.pattern.reduce((a, b) => a + b, 0), voice: state.voice, bpm: state.bpm, t: Date.now(), kept: true });
  state.loop++; persist(); renderAll(); toast("＋ loop kept as a stratum");
});
$("btnWipe").addEventListener("click", () => {
  if (!state.history.length) return toast("archive already empty");
  if (confirm("Wipe the whole history ribbon?")) {
    state.history = []; state.loop = 1; persist(); renderAll(); toast("archive wiped clean");
  }
});
$("btnPNG").addEventListener("click", exportPNG);
$("btnCopy").addEventListener("click", copyText);
$("btnJSON").addEventListener("click", downloadJSON);
$("bpm").addEventListener("input", (e) => { state.bpm = +e.target.value; refreshStats(); renderCard(); persist(); });
$("depth").addEventListener("input", (e) => { state.depth = +e.target.value; refreshStats(); persist(); });
$("decay").addEventListener("input", (e) => { state.decayMs = +e.target.value; refreshStats(); persist(); });
$("voice").addEventListener("change", (e) => { state.voice = e.target.value; renderCard(); persist(); });
$("evolve").addEventListener("change", (e) => { state.evolve = e.target.checked; persist(); });

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  if (e.code === "Space") { e.preventDefault(); tapSample(); }
  else if (e.key === "p" || e.key === "P") start();
  else if ("123456789".includes(e.key)) {
    const i = +e.key - 1; state.pattern[i] = state.pattern[i] ? 0 : 1; buildSteps(); renderCard(); persist();
  }
  else if (e.key === "0") { state.pattern[9] = !state.pattern[9] * 1; buildSteps(); renderCard(); persist(); }
  else if (e.key === "-") { state.pattern[10] = !state.pattern[10] * 1; buildSteps(); renderCard(); persist(); }
  else if (e.key === "=") { state.pattern[11] = !state.pattern[11] * 1; buildSteps(); renderCard(); persist(); }
});

function renderAll() { refreshStats(); renderRibbon(); renderCard(); }

// init from storage
$("bpm").value = state.bpm; $("depth").value = state.depth; $("decay").value = state.decayMs;
$("voice").value = state.voice; $("evolve").checked = state.evolve !== false;
if (state.muted) { $("btnMute").textContent = "✕ muted"; $("btnMute").setAttribute("aria-pressed", "true"); }
buildSteps(); renderAll(); tideUI(state.tide || 0.5);
requestAnimationFrame(paintLoop);
// idle tide animation when paused
setInterval(() => { if (!playing) { tidePhase += 0.04; state.tide = tideNow(); tideUI(state.tide); if (!document.hidden && Math.random() < 0.1) renderCard(); } }, 120);

console.log("tidal-minute-archive ready");
