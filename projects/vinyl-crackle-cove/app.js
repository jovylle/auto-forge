// Vinyl Crackle Cove — 100% synthesized lo-fi beat machine. No samples, no images.
const $ = (id) => document.getElementById(id);

const LS_KEY = "vinyl-crackle-cove:v1";

/* ---------------- crates: each record is a live synth recipe ---------------- */
const PRESETS = [
  { id: "misty", title: "Misty Rhodes", artist: "The Cove Combo", year: "1973",
    bpm: 84, root: 45, prog: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-2, 2, 5, 8]],
    drums: "boom", bright: 0.5, color: "#ff2e88", initial: "M" },
  { id: "blue", title: "Blue Break", artist: "Aqua Velvets", year: "1971",
    bpm: 92, root: 43, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [3, 7, 10, 14], [-2, 2, 5, 9]],
    drums: "break", bright: 0.7, color: "#00d2ff", initial: "B" },
  { id: "sunset", title: "Sunset Loop", artist: "Palais Sunset", year: "1976",
    bpm: 78, root: 48, prog: [[0, 4, 7, 10], [-4, 0, 3, 8], [-2, 2, 5, 9], [0, 3, 7, 12]],
    drums: "soft", bright: 0.45, color: "#ffd500", initial: "S" },
  { id: "night", title: "Night Bus", artist: "Midnight Transfer", year: "1979",
    bpm: 96, root: 41, prog: [[0, 3, 7, 12], [0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14]],
    drums: "trap", bright: 0.6, color: "#7b2ff7", initial: "N" },
  { id: "peach", title: "Peach Fuzz", artist: "The Pits", year: "1968",
    bpm: 88, root: 46, prog: [[0, 4, 7, 9], [5, 9, 12, 14], [0, 4, 7, 10], [-2, 3, 7, 10]],
    drums: "boom", bright: 0.8, color: "#ff3b30", initial: "P" },
  { id: "reef", title: "Coral Reef", artist: "Tidepool Five", year: "1974",
    bpm: 82, root: 44, prog: [[0, 5, 7, 12], [-2, 3, 7, 10], [0, 3, 8, 12], [-4, 1, 5, 8]],
    drums: "break", bright: 0.55, color: "#00b894", initial: "C" },
];

const CHOPS = {
  smooth:  { label: "SMOOTH",  gates: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
  bounce:  { label: "BOUNCE",  gates: [1,.5,1,.55, 1,.5,1,.55, 1,.5,1,.55, 1,.4,.6,.25] },
  trap:    { label: "TRAP",    gates: [1,1,.3,1, .3,1,1,.35, 1,.3,1,1, .3,1,.5,.5] },
  stutter: { label: "STUTTER", gates: [1,1,1,.12, 1,.12,1,1, 1,.12,.12,1, 1,1,.5,1] },
};

const state = {
  preset: PRESETS[0],
  bpm: 84,
  crackle: 55, wow: 40, dust: 62, swing: 18,
  chop: "bounce", chopAmt: 70,
  playing: false,
};

/* ---------------- persistence ---------------- */
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      preset: state.preset.id, bpm: state.bpm, crackle: state.crackle,
      wow: state.wow, dust: state.dust, swing: state.swing,
      chop: state.chop, chopAmt: state.chopAmt, track: $("trackName").value,
    }));
  } catch { /* private mode — ignore */ }
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const p = PRESETS.find((x) => x.id === s.preset);
    if (p) state.preset = p;
    for (const k of ["bpm", "crackle", "wow", "dust", "swing", "chopAmt"])
      if (typeof s[k] === "number") state[k] = s[k];
    if (CHOPS[s.chop]) state.chop = s.chop;
    if (typeof s.track === "string" && s.track.trim()) $("trackName").value = s.track;
  } catch { /* ignore */ }
}

/* ---------------- audio graph ---------------- */
let AC = null;             // AudioContext (live)
let master, musicBus, wowDelay, wowAmp, chopGain, dustFilter, analyser, delaySend, delayNode, delayFb;
let crackleSrc = null, crackleGain = null;
let wowLfo = null, wowLfoGain = null, amLfo = null, amLfoGain = null;
let schedTimer = null, nextTime = 0, stepIdx = 0, barCount = 0;
let currentStepShown = -1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensureCtx() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();

  master = AC.createGain(); master.gain.value = 0.9;
  analyser = AC.createAnalyser(); analyser.fftSize = 1024;
  master.connect(analyser); analyser.connect(AC.destination);

  musicBus = AC.createGain(); musicBus.gain.value = 1;

  // WOW: pitch wobble via modulated micro-delay (classic vibrato trick)
  wowDelay = AC.createDelay(0.05); wowDelay.delayTime.value = 0.012;
  wowLfo = AC.createOscillator(); wowLfo.frequency.value = 0.7;
  wowLfoGain = AC.createGain(); wowLfoGain.gain.value = 0.0016;
  wowLfo.connect(wowLfoGain); wowLfoGain.connect(wowDelay.delayTime);
  wowLfo.start();

  // slow volume seasickness
  wowAmp = AC.createGain(); wowAmp.gain.value = 1;
  amLfo = AC.createOscillator(); amLfo.frequency.value = 0.45;
  amLfoGain = AC.createGain(); amLfoGain.gain.value = 0.03;
  amLfo.connect(amLfoGain); amLfoGain.connect(wowAmp.gain);
  amLfo.start();

  chopGain = AC.createGain(); chopGain.gain.value = 1;
  dustFilter = AC.createBiquadFilter(); dustFilter.type = "lowpass"; dustFilter.frequency.value = 3800;

  // slapback echo for melody
  delayNode = AC.createDelay(1); delayNode.delayTime.value = 0.32;
  delayFb = AC.createGain(); delayFb.gain.value = 0.34;
  delaySend = AC.createGain(); delaySend.gain.value = 0.5;
  delaySend.connect(delayNode); delayNode.connect(delayFb);
  delayFb.connect(delayNode); delayNode.connect(dustFilter);

  musicBus.connect(wowDelay); wowDelay.connect(wowAmp);
  wowAmp.connect(chopGain); chopGain.connect(dustFilter);
  dustFilter.connect(master);

  // CRACKLE: looped dusty noise with pops
  crackleGain = AC.createGain(); crackleGain.gain.value = 0.2;
  crackleSrc = AC.createBufferSource();
  crackleSrc.buffer = makeCrackleBuffer(AC, Math.random());
  crackleSrc.loop = true;
  crackleSrc.connect(crackleGain); crackleGain.connect(master);
  crackleSrc.start();

  applyFx();
}

function makeCrackleBuffer(ctx, seed) {
  // deterministic-ish dusty vinyl: hiss + random pops + occasional thump
  let s = seed * 4294967295 || 12345;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * 0.012;
  for (let p = 0; p < 46; p++) {
    const at = Math.floor(rnd() * (len - 800));
    const amp = 0.15 + rnd() * 0.5;
    for (let j = 0; j < 300 && at + j < len; j++)
      d[at + j] += amp * Math.exp(-j / (6 + rnd() * 30)) * (rnd() > 0.5 ? 1 : -1);
  }
  return buf;
}

function applyFx() {
  if (!AC) return;
  crackleGain.gain.setTargetAtTime((state.crackle / 100) * 0.5, AC.currentTime, 0.05);
  wowLfoGain.gain.setTargetAtTime((state.wow / 100) * 0.004, AC.currentTime, 0.05);
  amLfoGain.gain.setTargetAtTime((state.wow / 100) * 0.07, AC.currentTime, 0.05);
  const cutoff = 900 + (state.dust / 100) * 5500 * state.preset.bright + (state.dust / 100) * 2000;
  dustFilter.frequency.setTargetAtTime(Math.min(12000, cutoff), AC.currentTime, 0.05);
}

/* ---------------- voices (ctx-parametric so export can reuse) ---------------- */
function vKick(ctx, dest, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.26);
}
function vSnare(ctx, dest, t, noiseBuf) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.18);
  const o = ctx.createOscillator(), g2 = ctx.createGain();
  o.type = "triangle"; o.frequency.value = 190;
  g2.gain.setValueAtTime(0.35, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2); g2.connect(dest); o.start(t); o.stop(t + 0.12);
}
function vHat(ctx, dest, t, noiseBuf, open) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
  const g = ctx.createGain();
  const dur = open ? 0.22 : 0.05;
  g.gain.setValueAtTime(open ? 0.22 : 0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + 0.02);
}
function vBass(ctx, dest, t, freq) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.34);
}
function vChord(ctx, dest, t, freqs) {
  for (const fr of freqs) {
    for (const [type, vol, det] of [["triangle", 0.11, 0], ["sine", 0.09, 5]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = fr; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.55);
    }
  }
}
function vPluck(ctx, dest, echoSend, t, freq) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "square"; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2400;
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(f); f.connect(g); g.connect(dest);
  if (echoSend) g.connect(echoSend);
  o.start(t); o.stop(t + 0.32);
}
function whiteNoise(ctx, seconds = 1) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/* ---------------- sequencer ---------------- */
const DRUMS = {
  boom:  { kick: [0, 7, 8], snare: [4, 12], hat: "8ths" },
  break: { kick: [0, 3, 8, 10], snare: [4, 12, 15], hat: "16ths" },
  soft:  { kick: [0, 8], snare: [4, 12], hat: "8ths" },
  trap:  { kick: [0, 6, 8], snare: [8], hat: "16ths" },
};
const MELODY = [0, -1, 7, -1, 5, -1, 3, -1, 2, -1, 5, 7, -1, 3, 2, 0]; // semitone offsets, -1 = rest

let sharedNoise = null;
function scheduleStep(t, step, bar) {
  const P = state.preset;
  const pat = DRUMS[P.drums];
  const spb = 60 / state.bpm / 4; // 16th duration
  let tt = t;
  if (step % 2 === 1) tt += spb * (state.swing / 100) * 0.9; // swing the off-16ths

  if (pat.kick.includes(step)) vKick(AC, musicBus, tt);
  if (pat.snare.includes(step)) vSnare(AC, musicBus, tt, sharedNoise);
  if (pat.hat === "16ths" || (pat.hat === "8ths" && step % 2 === 0))
    vHat(AC, musicBus, tt, sharedNoise, step === 14);

  if (step % 4 === 0) {
    const chord = P.prog[bar % P.prog.length];
    const rootF = midi(P.root - 12);
    vBass(AC, musicBus, tt, rootF * (step === 8 ? 1.5 : 1));
    if (step === 0 || step === 8 || step === 11)
      vChord(AC, musicBus, tt, chord.map((s) => midi(P.root + s)));
  }
  const m = MELODY[(step + bar * 5) % 16];
  if (m >= 0 && (step % 2 === 0 || state.chop === "stutter"))
    vPluck(AC, musicBus, delaySend, tt, midi(P.root + 12 + m));

  // loop-chopper gate on this 16th
  const raw = CHOPS[state.chop].gates[step];
  const amt = state.chopAmt / 100;
  const gate = 1 - (1 - raw) * amt;
  chopGain.gain.setValueAtTime(Math.max(0.02, gate), t);
}

function scheduler() {
  const spb = 60 / state.bpm / 4;
  while (nextTime < AC.currentTime + 0.14) {
    scheduleStep(nextTime, stepIdx, barCount);
    if (stepIdx === 15) barCount++;
    currentStepShown = stepIdx;
    nextTime += spb;
    stepIdx = (stepIdx + 1) % 16;
  }
}

function play() {
  ensureCtx();
  if (state.playing) return;
  sharedNoise = sharedNoise || whiteNoise(AC, 1);
  state.playing = true;
  stepIdx = 0; barCount = 0; currentStepShown = -1;
  nextTime = AC.currentTime + 0.08;
  schedTimer = setInterval(scheduler, 25);
  $("playBtn").textContent = "■ STOP";
  document.querySelector(".turntable").classList.add("playing");
  pow("PLAY!");
  toast(`Needle down — ${state.preset.title} @ ${state.bpm} BPM`);
}
function stop() {
  state.playing = false;
  clearInterval(schedTimer);
  if (AC) chopGain.gain.cancelScheduledValues(AC.currentTime);
  $("playBtn").textContent = "▶ PLAY";
  document.querySelector(".turntable").classList.remove("playing");
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("hit"));
  currentStepShown = -1;
}

/* ---------------- tap tempo ---------------- */
let taps = [];
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2200) taps = [];
  taps.push(now);
  if (taps.length > 6) taps.shift();
  const btn = $("tapBtn");
  btn.classList.add("tapped");
  setTimeout(() => btn.classList.remove("tapped"), 120);
  if (taps.length >= 2) {
    const iv = [];
    for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    iv.sort((a, b) => a - b);
    const med = iv[Math.floor(iv.length / 2)];
    setBpm(Math.round(60000 / med), true);
  } else {
    toast("Keep tapping… feel the groove");
  }
}
function setBpm(v, fromTap) {
  state.bpm = Math.max(60, Math.min(140, v));
  $("bpmVal").textContent = state.bpm;
  $("tempoSlider").value = state.bpm;
  $("tempoOut").textContent = state.bpm;
  if (fromTap) toast(`Tempo caught: ${state.bpm} BPM`);
  save();
}

/* ---------------- UI ---------------- */
function pow(word) {
  const el = $("pow");
  el.textContent = word;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}
let toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = "⚡ " + msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ""; }, 2600);
}

function buildCrates() {
  const row = $("crateRow");
  row.innerHTML = "";
  PRESETS.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "record" + (p.id === state.preset.id ? " active" : "");
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", p.id === state.preset.id ? "true" : "false");
    b.innerHTML =
      `<span class="sleeve" style="background:${p.color}">` +
      `<span class="mini-disc"><i style="background:${p.color}"></i></span></span>` +
      `<span class="rec-title">${i + 1}. ${p.title}</span>` +
      `<span class="rec-meta">${p.artist} · ’${p.year.slice(2)} · ${p.bpm} BPM</span>`;
    b.addEventListener("click", () => selectPreset(p.id, true));
    row.appendChild(b);
  });
}
function selectPreset(id, announce) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  state.preset = p;
  setBpm(p.bpm);
  $("nowTitle").textContent = p.title;
  $("nowMeta").textContent = `${p.artist} · ${p.year} · ${DRUMS[p.drums] ? p.drums : ""} drums`;
  $("vinylLabel").style.background = p.color;
  $("vinylInitial").textContent = p.initial;
  document.querySelectorAll(".record").forEach((el, i) => {
    const on = PRESETS[i].id === id;
    el.classList.toggle("active", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  });
  applyFx();
  if (announce) { pow("WAX!"); toast(`Dug up: ${p.title}`); }
  save();
}
function buildSteps() {
  const box = $("steps");
  box.innerHTML = "";
  for (let i = 0; i < 16; i++) {
    const d = document.createElement("div");
    d.className = "step" + (i % 4 === 0 ? " beat" : "");
    box.appendChild(d);
  }
}

/* ---------------- visuals ---------------- */
let rot = 0;
const scopeCtx = $("scope").getContext("2d");
function frame() {
  // vinyl spin
  if (state.playing) rot = (rot + state.bpm / 60 * 2.2) % 360;
  $("vinyl").style.transform = `rotate(${rot}deg)`;

  // step highlight
  const cells = document.querySelectorAll(".step");
  cells.forEach((c, i) => c.classList.toggle("hit", state.playing && i === currentStepShown));

  // scope + VU
  if (AC && analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const W = $("scope").width, H = $("scope").height;
    scopeCtx.fillStyle = "#141014";
    scopeCtx.fillRect(0, 0, W, H);
    // pop-art grid
    scopeCtx.strokeStyle = "rgba(255,213,0,.18)";
    scopeCtx.lineWidth = 1;
    for (let x = 0; x < W; x += 26) { scopeCtx.beginPath(); scopeCtx.moveTo(x, 0); scopeCtx.lineTo(x, H); scopeCtx.stroke(); }
    scopeCtx.lineWidth = 3;
    scopeCtx.strokeStyle = state.preset.color;
    scopeCtx.shadowColor = state.preset.color;
    scopeCtx.shadowBlur = 12;
    scopeCtx.beginPath();
    const step = Math.floor(data.length / W);
    for (let x = 0; x < W; x++) {
      const v = data[x * step] / 128 - 1;
      const y = H / 2 + v * H * 0.45;
      x === 0 ? scopeCtx.moveTo(x, y) : scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += Math.abs(data[i] - 128);
    const rms = Math.min(1, sum / (data.length / 4) / 40);
    $("vuFill").style.width = `${Math.round(rms * 100)}%`;
  } else {
    scopeCtx.fillStyle = "#141014";
    scopeCtx.fillRect(0, 0, $("scope").width, $("scope").height);
    scopeCtx.fillStyle = "#ffd500";
    scopeCtx.font = "bold 20px 'Space Grotesk', sans-serif";
    scopeCtx.fillText("▶ PRESS PLAY, DIGGER", 24, 66);
  }
  requestAnimationFrame(frame);
}

/* ---------------- export: offline 2-bar WAV bounce ---------------- */
function encodeWav(buffer) {
  const nCh = 2, sr = buffer.sampleRate, n = buffer.length;
  const bytes = 44 + n * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); v.setUint32(4, bytes - 8, true); wstr(8, "WAVE");
  wstr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nCh * 2, true); v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true); wstr(36, "data"); v.setUint32(40, n * nCh * 2, true);
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const ch of [ch0, ch1]) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

async function exportBeat() {
  const btn = $("exportBtn");
  btn.disabled = true;
  $("exportStatus").textContent = "Warming up the pressing plant…";
  try {
    const sr = 44100;
    const spb = 60 / state.bpm / 4;
    const totalSteps = 32; // 2 bars
    const dur = totalSteps * spb + 1.2;
    const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);

    const oMaster = off.createGain(); oMaster.gain.value = 0.9;
    oMaster.connect(off.destination);
    const oDust = off.createBiquadFilter(); oDust.type = "lowpass";
    oDust.frequency.value = Math.min(12000, 900 + (state.dust / 100) * 5500 * state.preset.bright + (state.dust / 100) * 2000);
    oDust.connect(oMaster);
    const oChop = off.createGain(); oChop.connect(oDust);
    const oEcho = off.createDelay(1); oEcho.delayTime.value = 60 / state.bpm * 0.75;
    const oFb = off.createGain(); oFb.gain.value = 0.34;
    const oSend = off.createGain(); oSend.gain.value = 0.5;
    oSend.connect(oEcho); oEcho.connect(oFb); oFb.connect(oEcho); oEcho.connect(oDust);

    const nz = whiteNoise(off, 1);
    const P = state.preset;
    const pat = DRUMS[P.drums];
    const amt = state.chopAmt / 100;
    for (let s = 0; s < totalSteps; s++) {
      const t = 0.1 + s * spb;
      const step = s % 16, bar = Math.floor(s / 16);
      let tt = t;
      if (step % 2 === 1) tt += spb * (state.swing / 100) * 0.9;
      if (pat.kick.includes(step)) vKick(off, oChop, tt);
      if (pat.snare.includes(step)) vSnare(off, oChop, tt, nz);
      if (pat.hat === "16ths" || (pat.hat === "8ths" && step % 2 === 0))
        vHat(off, oChop, tt, nz, step === 14);
      if (step % 4 === 0) {
        const chord = P.prog[bar % P.prog.length];
        vBass(off, oChop, tt, midi(P.root - 12) * (step === 8 ? 1.5 : 1));
        if (step === 0 || step === 8 || step === 11)
          vChord(off, oChop, tt, chord.map((x) => midi(P.root + x)));
      }
      const m = MELODY[(step + bar * 5) % 16];
      if (m >= 0 && (step % 2 === 0 || state.chop === "stutter"))
        vPluck(off, oChop, oSend, tt, midi(P.root + 12 + m));
      const raw = CHOPS[state.chop].gates[step];
      oChop.gain.setValueAtTime(Math.max(0.02, 1 - (1 - raw) * amt), t);
    }
    // dusty crackle bed in the bounce too
    const cr = off.createBufferSource(); cr.buffer = makeCrackleBuffer(off, 0.42);
    cr.loop = true;
    const crG = off.createGain(); crG.gain.value = (state.crackle / 100) * 0.5;
    cr.connect(crG); crG.connect(oMaster); cr.start(0);

    $("exportStatus").textContent = "Pressing 2 bars of wax…";
    const rendered = await off.startRendering();
    const blob = encodeWav(rendered);
    const name = ($("trackName").value.trim() || "cove-banger").replace(/[^\w\-]+/g, "-").toLowerCase();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${state.bpm}bpm.wav`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    $("exportStatus").textContent = `✔ Pressed ${a.download} — fresh wax!`;
    pow("WAX!");
    toast("Beat exported as .wav");
  } catch (err) {
    $("exportStatus").textContent = "✘ Pressing jammed: " + err.message;
  } finally {
    btn.disabled = false;
    save();
  }
}

/* ---------------- wiring ---------------- */
function bindRange(id, out, fmt, set) {
  const el = $(id);
  const paint = () => { $(out).textContent = fmt(Number(el.value)); };
  el.addEventListener("input", () => { set(Number(el.value)); paint(); save(); });
  paint();
}
function init() {
  load();
  buildCrates();
  buildSteps();
  selectPreset(state.preset.id, false);

  // sync controls from state
  $("bpmVal").textContent = state.bpm;
  $("tempoSlider").value = state.bpm; $("tempoOut").textContent = state.bpm;
  $("crackle").value = state.crackle; $("crackleOut").textContent = state.crackle + "%";
  $("wow").value = state.wow; $("wowOut").textContent = state.wow + "%";
  $("dustFilter").value = state.dust; $("dustFilterOut").textContent = state.dust + "%";
  $("swing").value = state.swing; $("swingOut").textContent = state.swing + "%";
  $("chopAmt").value = state.chopAmt; $("chopAmtOut").textContent = state.chopAmt + "%";
  document.querySelectorAll(".chip").forEach((c) => {
    const on = c.dataset.chop === state.chop;
    c.classList.toggle("on", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  });

  $("playBtn").addEventListener("click", () => (state.playing ? stop() : play()));
  $("tapBtn").addEventListener("click", () => { ensureCtx(); tap(); });
  $("digBtn").addEventListener("click", () => {
    const others = PRESETS.filter((p) => p.id !== state.preset.id);
    selectPreset(others[Math.floor(Math.random() * others.length)].id, true);
  });

  bindRange("tempoSlider", "tempoOut", (v) => `${v}`, (v) => { state.bpm = v; $("bpmVal").textContent = v; });
  bindRange("crackle", "crackleOut", (v) => `${v}%`, (v) => { state.crackle = v; applyFx(); });
  bindRange("wow", "wowOut", (v) => `${v}%`, (v) => { state.wow = v; applyFx(); });
  bindRange("dustFilter", "dustFilterOut", (v) => `${v}%`, (v) => { state.dust = v; applyFx(); });
  bindRange("swing", "swingOut", (v) => `${v}%`, (v) => { state.swing = v; });
  bindRange("chopAmt", "chopAmtOut", (v) => `${v}%`, (v) => { state.chopAmt = v; });

  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => {
      state.chop = c.dataset.chop;
      document.querySelectorAll(".chip").forEach((x) => {
        const on = x === c;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      toast(`Chopper: ${CHOPS[state.chop].label}`);
      save();
    });
  });

  $("trackName").addEventListener("change", save);
  $("exportBtn").addEventListener("click", exportBeat);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input[type=text]")) return;
    if (e.code === "Space") { e.preventDefault(); state.playing ? stop() : play(); }
    else if (e.key === "t" || e.key === "T") { ensureCtx(); tap(); }
    else if (e.key === "e" || e.key === "E") exportBeat();
    else if (e.key >= "1" && e.key <= "6") selectPreset(PRESETS[Number(e.key) - 1].id, true);
  });

  requestAnimationFrame(frame);
  console.log("vinyl-crackle-cove ready — 100% synthesized wax");
}

init();
