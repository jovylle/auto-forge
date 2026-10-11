// ============================================================
// LOOPING BELL FOUNDRY — generative time instrument
// WebAudio only. No samples, no assets, no backend.
// ============================================================
const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

const ALLOYS = {
  bronze: { name: "BRONZE", color: "#ffb000", glyph: "🔔", filter: 4200,
    partials: [[1,.6,4],[2.01,.25,3],[2.74,.18,2.2],[3.76,.12,1.6],[5.4,.06,1]] },
  iron:   { name: "IRON",   color: "#35e0ff", glyph: "🔔", filter: 6200,
    partials: [[1,.5,2.5],[2.76,.3,1.5],[5.4,.2,1],[8.9,.1,.6]] },
  glass:  { name: "GLASS",  color: "#b6ff5e", glyph: "🔔", filter: 9000,
    partials: [[1,.5,6],[2,.3,5],[3,.15,4],[4.2,.1,3],[6.3,.05,2]] },
  void:   { name: "VOID",   color: "#ff3df0", glyph: "🔔", filter: 1300,
    partials: [[1,.6,3],[1.5,.3,2],[2.02,.2,1.5],[0.5,.25,3.5]] },
};
const SCALES = {
  spring: { label: "SPRING", mode: "LYDIAN", iv: [0,2,4,6,7,9,11] },
  summer: { label: "SUMMER", mode: "IONIAN", iv: [0,2,4,5,7,9,11] },
  autumn: { label: "AUTUMN", mode: "DORIAN", iv: [0,2,3,5,7,9,10] },
  winter: { label: "WINTER", mode: "AEOLIAN", iv: [0,2,3,5,7,8,10] },
};
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const LS_KEY = "looping-bell-foundry.v1";

// ---------------- state ----------------
let state = load() || seed();
function seed() {
  return {
    bells: [
      { id: "s0", hour: 0,  alloy: "bronze", oct: 0 },
      { id: "s1", hour: 4,  alloy: "glass",  oct: 0 },
      { id: "s2", hour: 7,  alloy: "iron",   oct: 0 },
      { id: "s3", hour: 12, alloy: "bronze", oct: 1 },
      { id: "s4", hour: 14, alloy: "void",   oct: 0 },
      { id: "s5", hour: 18, alloy: "glass",  oct: 0 },
      { id: "s6", hour: 21, alloy: "bronze", oct: 0 },
    ],
    tempo: 84, alloy: "bronze", oct: 0,
    season: "auto", live: true, simHour: new Date().getHours(),
  };
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.bells)) return null;
    return s;
  } catch { return null; }
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }
const uid = () => "b" + Math.random().toString(36).slice(2, 9);

// ---------------- tuning (loops shift with hour) ----------------
function realHour() { return new Date().getHours(); }
function effHour() { return state.live ? realHour() : state.simHour; }
function effSeason() {
  if (state.season !== "auto") return state.season;
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}
function tuning() {
  const h = effHour(), s = effSeason();
  const scale = SCALES[s];
  const rootPc = h % 12;
  const rootMidi = 48 + rootPc;
  return { h, s, scale, rootPc, rootMidi };
}
function bellMidi(bell, t) {
  const deg = bell.hour % 7;
  const up = Math.floor(bell.hour / 14); // 0 for 0-13, 1 for 14-23
  return t.rootMidi + 12 + t.scale.iv[deg] + 12 * up + (bell.oct || 0) * 12;
}
const midiName = (m) => NOTES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- log ----------------
const logEl = $("log");
function log(msg, cls = "ok") {
  const d = document.createElement("div");
  const t = new Date();
  const ts = String(t.getHours()).padStart(2,"0") + ":" + String(t.getMinutes()).padStart(2,"0") + ":" + String(t.getSeconds()).padStart(2,"0");
  d.innerHTML = `<span class="t">[${ts}]</span> <span class="${cls}">${msg}</span>`;
  logEl.prepend(d);
  while (logEl.children.length > 60) logEl.lastChild.remove();
}

// ---------------- audio ----------------
let AC = null, master = null, verb = null, wetGain = null, noiseBuf = null;
function ensureCtx() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return AC; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.85;
  const comp = AC.createDynamicsCompressor();
  master.connect(comp); comp.connect(AC.destination);
  verb = AC.createConvolver(); verb.buffer = makeImpulse(AC, 1.9, 2.6);
  wetGain = AC.createGain(); wetGain.gain.value = 0.24;
  verb.connect(wetGain); wetGain.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.05, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  $("audioState").textContent = "AUDIO: LIVE";
  $("audioState").style.color = "var(--phos)";
  return AC;
}
function makeImpulse(ctx, dur, decay) {
  const rate = ctx.sampleRate, len = Math.floor(rate * dur);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
// One bell strike — works on live ctx AND OfflineAudioContext graphs
function strikeOn(ctx, outDry, outWet, { freq, alloy, when, vol = 0.5 }) {
  const A = ALLOYS[alloy] || ALLOYS.bronze;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = A.filter;
  lp.connect(outDry);
  const send = ctx.createGain(); send.gain.value = 0.6;
  lp.connect(send); send.connect(outWet);
  const cents = (Math.random() * 10 - 5);
  for (const [ratio, amp, dec] of A.partials) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * ratio;
    o.detune.value = cents;
    const g = ctx.createGain();
    const peak = Math.max(0.0002, amp * vol * 0.5);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dec);
    o.connect(g); g.connect(lp);
    o.start(when); o.stop(when + dec + 0.1);
  }
  // clapper tick
  if (ctx.createBufferSource && noiseBuf && ctx === AC) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.25, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    n.connect(hp); hp.connect(ng); ng.connect(outDry);
    n.start(when); n.stop(when + 0.08);
  }
}
function strikeLive(freq, alloy) {
  const ctx = ensureCtx();
  strikeOn(ctx, master, verb, { freq, alloy, when: ctx.currentTime + 0.01, vol: 0.55 });
}

// ---------------- dial (SVG ring) ----------------
const dial = $("dial"), wrap = $("dialWrap");
const nodeEls = [], nodeXY = [];
function polar(h, R, cx = 200, cy = 200) {
  const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
}
function buildDial() {
  dial.innerHTML = "";
  nodeEls.length = 0;
  const defs = document.createElementNS(SVGNS, "defs");
  defs.innerHTML = `<radialGradient id="coreg"><stop offset="0%" stop-color="#0a2e1c"/><stop offset="100%" stop-color="#04110b"/></radialGradient>`;
  dial.appendChild(defs);
  for (const R of [150, 118, 86]) {
    const c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", 200); c.setAttribute("cy", 200); c.setAttribute("r", R);
    c.setAttribute("fill", "none"); c.setAttribute("stroke", "#0f3d26");
    c.setAttribute("stroke-width", R === 150 ? 1.5 : 1);
    c.setAttribute("opacity", R === 150 ? 0.9 : 0.45);
    dial.appendChild(c);
  }
  for (let h = 0; h < 24; h++) {
    const [x, y] = polar(h, 150);
    const [lx, ly] = polar(h, 168);
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "node"); g.dataset.hour = h;
    const halo = document.createElementNS(SVGNS, "circle");
    halo.setAttribute("cx", x); halo.setAttribute("cy", y); halo.setAttribute("r", 15);
    halo.setAttribute("fill", "transparent"); halo.setAttribute("class", "halo");
    const ring = document.createElementNS(SVGNS, "circle");
    ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", 11);
    ring.setAttribute("class", "ring");
    const bell = document.createElementNS(SVGNS, "text");
    bell.setAttribute("x", x); bell.setAttribute("y", y + 5.5);
    bell.setAttribute("class", "bell"); bell.textContent = "";
    const lab = document.createElementNS(SVGNS, "text");
    lab.setAttribute("x", lx); lab.setAttribute("y", ly + 3);
    lab.setAttribute("class", "hlabel"); lab.textContent = String(h).padStart(2, "0");
    g.append(halo, ring, bell, lab);
    g.addEventListener("click", () => toggleHour(h));
    dial.appendChild(g);
    nodeEls[h] = { g, ring, bell, halo };
  }
}

// ---------------- timeline + strata ----------------
const tlEl = $("timeline"), cellEls = [];
function buildTimeline() {
  tlEl.innerHTML = ""; cellEls.length = 0;
  for (let h = 0; h < 24; h++) {
    const b = document.createElement("button");
    b.className = "cell"; b.dataset.hour = h;
    b.setAttribute("aria-label", `hour ${h}`);
    b.innerHTML = `<span class="ch">${String(h).padStart(2,"0")}:00</span><span class="cb"></span><span class="cn"></span>`;
    b.addEventListener("click", () => toggleHour(h));
    tlEl.appendChild(b); cellEls.push(b);
  }
}
const strataEl = $("strata"), strataSlots = {};
function buildStrata() {
  strataEl.innerHTML = "";
  for (const key of Object.keys(ALLOYS)) {
    const row = document.createElement("div");
    row.className = "stratum";
    row.innerHTML = `<span class="sname" style="color:${ALLOYS[key].color}">${ALLOYS[key].name}</span>`;
    const slots = document.createElement("div");
    slots.className = "slots"; slots.style.setProperty("--c", ALLOYS[key].color);
    const arr = [];
    for (let h = 0; h < 24; h++) {
      const s = document.createElement("div");
      s.className = "slot"; slots.appendChild(s); arr.push(s);
    }
    row.appendChild(slots); strataEl.appendChild(row);
    strataSlots[key] = arr;
  }
}
function bellAt(h) { return state.bells.find((b) => b.hour === h); }

function refreshStatic() {
  const t = tuning();
  // dial nodes
  for (let h = 0; h < 24; h++) {
    const n = nodeEls[h], b = bellAt(h);
    n.g.classList.toggle("has-bell", !!b);
    n.g.classList.toggle("nowhour", h === t.h);
    if (b) {
      const A = ALLOYS[b.alloy];
      n.ring.style.stroke = A.color;
      n.halo.setAttribute("fill", A.color);
      n.halo.setAttribute("opacity", 0.22);
      n.bell.textContent = A.glyph;
    } else {
      n.ring.style.stroke = "";
      n.halo.setAttribute("fill", "transparent");
      n.bell.textContent = "";
    }
  }
  // timeline cells
  for (let h = 0; h < 24; h++) {
    const c = cellEls[h], b = bellAt(h);
    c.classList.toggle("filled", !!b);
    c.classList.toggle("realnow", h === t.h);
    const cb = c.querySelector(".cb"), cn = c.querySelector(".cn");
    if (b) {
      const A = ALLOYS[b.alloy];
      c.style.setProperty("--c", A.color);
      cb.textContent = A.glyph; cb.style.color = A.color;
      cn.textContent = midiName(bellMidi(b, t));
    } else { cb.textContent = "+"; cb.style.color = "var(--dim)"; cn.textContent = ""; }
  }
  // strata
  for (const key of Object.keys(strataSlots)) {
    for (let h = 0; h < 24; h++) {
      const has = state.bells.some((b) => b.hour === h && b.alloy === key);
      strataSlots[key][h].classList.toggle("on", has);
    }
  }
  $("bellCount").textContent = `${state.bells.length} bell${state.bells.length === 1 ? "" : "s"}`;
  $("coreHour").textContent = String(t.h).padStart(2, "0");
  $("shiftReadout").textContent =
    `H${String(t.h).padStart(2,"0")} → ROOT ${midiName(t.rootMidi + 12)} · ${t.scale.label} ${t.scale.mode} · ${state.bells.length} BELLS · ${state.tempo} BPM` +
    (state.live ? " · ◉ LIVE CLOCK" : " · ◌ SIM TIME");
  $("seasonBadge").textContent = `${t.scale.label} · ${t.scale.mode}`;
}

// ---------------- canvas ripples + embers ----------------
const cv = $("ripples"), cx2d = cv.getContext("2d");
let ripples = [], embers = [];
function sizeCanvas() {
  const r = wrap.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
  embers = Array.from({ length: 46 }, () => ({
    x: Math.random(), y: Math.random(),
    s: 0.4 + Math.random() * 1.4, v: 0.0002 + Math.random() * 0.0009,
    o: 0.12 + Math.random() * 0.4,
  }));
}
new ResizeObserver(sizeCanvas).observe(wrap);
function canvasXY(h) {
  const w = cv.width, R = w * 0.375;
  const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
  return [w / 2 + R * Math.cos(a), w / 2 + R * Math.sin(a)];
}
function spawnRipple(h, color) {
  const [x, y] = canvasXY(h);
  ripples.push({ x, y, r: 8, max: cv.width * 0.22, color, a: 0.9 });
  if (ripples.length > 40) ripples.shift();
}
function drawFrame() {
  const w = cv.width, hgt = cv.height;
  cx2d.clearRect(0, 0, w, hgt);
  for (const e of embers) {
    e.y -= e.v; if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
    cx2d.globalAlpha = e.o;
    cx2d.fillStyle = "#33ff99";
    cx2d.fillRect(e.x * w, e.y * hgt, e.s, e.s);
  }
  cx2d.globalAlpha = 1;
  ripples = ripples.filter((r) => r.a > 0.02);
  for (const r of ripples) {
    r.r += w * 0.006; r.a *= 0.94;
    cx2d.globalAlpha = Math.max(0, r.a);
    cx2d.strokeStyle = r.color; cx2d.lineWidth = Math.max(1, w * 0.004);
    cx2d.beginPath(); cx2d.arc(r.x, r.y, r.r, 0, Math.PI * 2); cx2d.stroke();
    cx2d.globalAlpha = Math.max(0, r.a * 0.5);
    cx2d.beginPath(); cx2d.arc(r.x, r.y, r.r * 0.6, 0, Math.PI * 2); cx2d.stroke();
  }
  cx2d.globalAlpha = 1;
  requestAnimationFrame(drawFrame);
}

// ---------------- sequencer ----------------
let playing = false, step = 0, nextT = 0, schedTimer = null, curStepUI = -1;
const stepDur = () => 60 / state.tempo / 2;
function setPlayingUI() {
  $("playBtn").textContent = playing ? "■ HALT LOOP" : "▶ IGNITE LOOP";
  $("corePlay").textContent = playing ? "■" : "▶";
  $("corePlay").classList.toggle("playing", playing);
}
function startLoop() {
  ensureCtx();
  if (playing) return;
  playing = true; step = 0;
  nextT = AC.currentTime + 0.08;
  schedTimer = setInterval(schedule, 60);
  setPlayingUI();
  log(`loop ignited @ ${state.tempo} BPM · root ${midiName(tuning().rootMidi + 12)}`, "ok");
}
function stopLoop() {
  playing = false;
  clearInterval(schedTimer);
  clearPlayhead();
  setPlayingUI();
  log("loop halted — bells cooling", "warn");
}
function schedule() {
  if (!playing) return;
  const t = tuning();
  while (nextT < AC.currentTime + 0.3) {
    const s = step, when = nextT;
    const b = bellAt(s);
    if (b) {
      const freq = midiFreq(bellMidi(b, t));
      strikeOn(AC, master, verb, { freq, alloy: b.alloy, when, vol: 0.55 });
      const delay = Math.max(0, (when - AC.currentTime) * 1000);
      const A = ALLOYS[b.alloy];
      setTimeout(() => {
        spawnRipple(s, A.color);
        flashStep(s, A.color);
      }, delay);
    }
    setTimeout(((ss) => () => showPlayhead(ss)), Math.max(0, (when - AC.currentTime) * 1000), s);
    nextT += stepDur();
    step = (step + 1) % 24;
  }
}
function clearPlayhead() {
  curStepUI = -1;
  nodeEls.forEach((n) => n && n.g.classList.remove("playhead"));
  cellEls.forEach((c) => c.classList.remove("playing"));
  Object.values(strataSlots).forEach((arr) => arr.forEach((s) => s.classList.remove("now")));
}
function showPlayhead(s) {
  if (!playing) return;
  if (nodeEls[curStepUI]) nodeEls[curStepUI].g.classList.remove("playhead");
  if (cellEls[curStepUI]) cellEls[curStepUI].classList.remove("playing");
  curStepUI = s;
  if (nodeEls[s]) nodeEls[s].g.classList.add("playhead");
  if (cellEls[s]) cellEls[s].classList.add("playing");
  Object.values(strataSlots).forEach((arr) => arr.forEach((el, i) => el.classList.toggle("now", i === s)));
}
function flashStep(s, color) {
  for (const arr of Object.values(strataSlots)) {
    const el = arr[s];
    if (el.classList.contains("on")) {
      el.classList.add("hit");
      setTimeout(() => el.classList.remove("hit"), 260);
    }
  }
  void color;
}

// ---------------- casting ----------------
function toggleHour(h) {
  ensureCtx(); // sound on interaction
  const ex = bellAt(h);
  const t = tuning();
  if (ex) {
    state.bells = state.bells.filter((b) => b !== ex);
    log(`hour ${String(h).padStart(2,"0")} reclaimed — ${ALLOYS[ex.alloy].name} bell melted down`, "warn");
  } else {
    if (state.bells.length >= 24) { log("foundry full — reclaim a bell first", "warn"); return; }
    const b = { id: uid(), hour: h, alloy: state.alloy, oct: state.oct };
    state.bells.push(b);
    state.bells.sort((a, c) => a.hour - c.hour);
    strikeLive(midiFreq(bellMidi(b, t)), b.alloy);
    spawnRipple(h, ALLOYS[b.alloy].color);
    log(`cast ${ALLOYS[b.alloy].name} bell @ ${String(h).padStart(2,"0")}:00 → ${midiName(bellMidi(b, t))}`, "ok");
  }
  save(); refreshStatic();
}

// ---------------- export daily melody ----------------
function scoreData() {
  const t = tuning();
  const now = new Date();
  return {
    instrument: "looping-bell-foundry",
    date: now.toISOString().slice(0, 10),
    syncHour: t.h, season: t.s, mode: t.scale.mode,
    root: midiName(t.rootMidi + 12), rootMidi: t.rootMidi + 12,
    tempo: state.tempo,
    bells: state.bells.map((b) => {
      const m = bellMidi(b, t);
      return { hour: b.hour, alloy: b.alloy, octave: b.oct, midi: m, note: midiName(m), freqHz: +midiFreq(m).toFixed(2) };
    }),
  };
}
function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function encodeWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
  const bytes = 44 + n * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); v.setUint32(4, bytes - 8, true); wstr(8, "WAVE");
  wstr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  wstr(36, "data"); v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}
async function exportWav() {
  if (!state.bells.length) { log("nothing to render — cast a bell first", "warn"); return; }
  const btn = $("wavBtn");
  btn.textContent = "◌ RENDERING…"; btn.disabled = true;
  try {
    const t = tuning();
    const sd = stepDur(), tail = 3;
    const dur = 24 * sd + tail, sr = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const og = off.createGain(); og.gain.value = 0.85; og.connect(off.destination);
    const ov = off.createConvolver(); ov.buffer = makeImpulse(off, 1.9, 2.6);
    const ow = off.createGain(); ow.gain.value = 0.24;
    ov.connect(ow); ow.connect(og);
    for (const b of state.bells) {
      const when = b.hour * sd + 0.05;
      strikeOn(off, og, ov, { freq: midiFreq(bellMidi(b, t)), alloy: b.alloy, when, vol: 0.55 });
    }
    const rendered = await off.startRendering();
    const fname = `foundry-${new Date().toISOString().slice(0,10)}-H${String(t.h).padStart(2,"0")}.wav`;
    download(fname, encodeWav(rendered));
    log(`daily melody rendered → ${fname} (${dur.toFixed(1)}s, 1 loop + tail)`, "ok");
  } catch (e) {
    log("WAV render failed: " + e.message, "warn");
  }
  btn.textContent = "⬇ WAV LOOP"; btn.disabled = false;
}
function exportJson() {
  if (!state.bells.length) { log("nothing to export — cast a bell first", "warn"); return; }
  const d = scoreData();
  download(`foundry-${d.date}-H${String(d.syncHour).padStart(2,"0")}.json`,
    new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
  log(`score exported → ${d.bells.length} bells in ${d.season} ${d.mode}`, "ok");
}
async function copyScore() {
  if (!state.bells.length) { log("nothing to copy — cast a bell first", "warn"); return; }
  const d = scoreData();
  const txt = `LOOPING BELL FOUNDRY · ${d.date} · H${d.syncHour} ${d.season}/${d.mode} root ${d.root}\n` +
    d.bells.map((b) => `H${String(b.hour).padStart(2,"0")} ${b.note.padEnd(4)} ${b.alloy} ${b.freqHz}Hz`).join("\n");
  try { await navigator.clipboard.writeText(txt); log("score copied to clipboard", "ok"); }
  catch { log("clipboard blocked (file://) — use JSON export", "warn"); }
}

// ---------------- wiring ----------------
function initControls() {
  $("tempo").value = state.tempo; $("tempoVal").textContent = state.tempo;
  $("alloy").value = state.alloy;
  $("octave").value = state.oct; $("octVal").textContent = (state.oct >= 0 ? "+" : "") + state.oct;
  $("season").value = state.season;
  $("simHour").value = state.simHour; $("simVal").textContent = state.simHour;
  syncLiveUI();

  $("playBtn").addEventListener("click", () => (playing ? stopLoop() : startLoop()));
  $("corePlay").addEventListener("click", () => (playing ? stopLoop() : startLoop()));
  $("clearBtn").addEventListener("click", () => {
    ensureCtx();
    state.bells = []; save(); refreshStatic();
    log("all bells melted down — clean crucible", "warn");
  });
  $("tempo").addEventListener("input", (e) => {
    state.tempo = +e.target.value; $("tempoVal").textContent = state.tempo;
    save(); refreshStatic();
  });
  $("alloy").addEventListener("change", (e) => { state.alloy = e.target.value; save(); });
  $("octave").addEventListener("input", (e) => {
    state.oct = +e.target.value;
    $("octVal").textContent = (state.oct >= 0 ? "+" : "") + state.oct;
    save();
  });
  $("season").addEventListener("change", (e) => {
    state.season = e.target.value; save(); refreshStatic();
    log(`season override → ${effSeason().toUpperCase()} ${SCALES[effSeason()].mode}`, "hit");
  });
  $("liveBtn").addEventListener("click", () => {
    state.live = !state.live; save(); syncLiveUI(); refreshStatic();
    log(state.live ? "clock sync → LIVE (following real hour)" : `clock sync → MANUAL (simulating H${state.simHour})`, "hit");
  });
  $("simHour").addEventListener("input", (e) => {
    state.simHour = +e.target.value; $("simVal").textContent = state.simHour;
    save(); refreshStatic();
  });
  $("wavBtn").addEventListener("click", exportWav);
  $("jsonBtn").addEventListener("click", exportJson);
  $("copyBtn").addEventListener("click", copyScore);
}
function syncLiveUI() {
  const b = $("liveBtn");
  b.classList.toggle("on", state.live);
  b.textContent = state.live ? "LIVE" : "MANUAL";
  b.setAttribute("aria-pressed", String(state.live));
  $("simHour").disabled = state.live;
}

// ---------------- clocks ----------------
let lastEffH = -1;
function tickClock() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, "0");
  $("liveClock").textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  if (effHour() !== lastEffH) {
    lastEffH = effHour();
    refreshStatic();
    if (lastEffH !== -1) {
      const t = tuning();
      log(`hour shift → H${p(t.h)} · root ${midiName(t.rootMidi + 12)} · ${t.scale.label} ${t.scale.mode}`, "hit");
    }
  }
}

// ---------------- boot ----------------
buildDial(); buildTimeline(); buildStrata(); initControls();
sizeCanvas(); requestAnimationFrame(drawFrame);
refreshStatic();
lastEffH = effHour();
$("footDate").textContent = new Date().toDateString().toUpperCase();
log(`foundry online — ${state.bells.length} bells in crucible · root ${midiName(tuning().rootMidi + 12)}`, "ok");
log("click any ring node or timeline cell to cast · sound starts on touch", "hit");
setInterval(tickClock, 1000);
console.log("looping-bell-foundry ready");
