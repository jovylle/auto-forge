// Wobble Drum Picnic — blobby polyrhythm drum machine (Web Audio, no samples)
const $ = (s) => document.querySelector(s);

const VOICES = [
  { id: "kick",  name: "Kick Blob",   sub: "floor tom of the forest", color: "#FF6B6B", len: 8,  pat: [1,0,0,1, 0,0,1,0] },
  { id: "snare", name: "Snare Pea",   sub: "snappy lil pod",          color: "#E8A13D", len: 6,  pat: [0,0,1,0, 0,1] },
  { id: "hat",   name: "Hat Sprout",  sub: "tss-tss leaves",          color: "#3E9E6E", len: 12, pat: [1,0,1,1, 0,1,0,1, 1,0,1,0] },
  { id: "tom",   name: "Tom Melon",   sub: "round & juicy",           color: "#6C4AB6", len: 5,  pat: [1,0,0,1,0] },
  { id: "clap",  name: "Clap Fungus", sub: "spore applause",          color: "#2E9E9B", len: 7,  pat: [0,0,1,0, 0,0,1] },
  { id: "boing", name: "Boing Jelly", sub: "dessert percussion",      color: "#E85D9E", len: 9,  pat: [1,0,0,0, 1,0,0,1,0] },
];

const state = {
  playing: false, bpm: 112, wobble: 0.35, vol: 0.8,
  loops: {}, // id -> { on, pat:number[] }
};
VOICES.forEach((v) => { state.loops[v.id] = { on: ["kick", "hat"].includes(v.id), pat: [...v.pat] }; });

/* ---------- audio ---------- */
let actx = null, master = null, noiseBuf = null, wobLFO = null, wobDepth = null;
let wobPhase = 0;

function ensureAudio() {
  if (actx) { if (actx.state === "suspended") actx.resume(); return; }
  actx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = actx.createDynamicsCompressor();
  master = actx.createGain();
  master.gain.value = state.vol;
  master.connect(comp); comp.connect(actx.destination);
  // shared wobble LFO -> per-voice detune patched at trigger time (keeps drums tight)
  wobLFO = actx.createOscillator(); wobLFO.frequency.value = 5.5;
  wobDepth = actx.createGain(); wobDepth.gain.value = 0;
  wobLFO.connect(wobDepth); wobLFO.start();
  updateWobbleDepth();
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function updateWobbleDepth() {
  if (wobDepth && actx) wobDepth.gain.value = state.wobble * 220; // cents-ish via detune param
  document.documentElement.style.setProperty("--wob", (0.4 + state.wobble * 2).toFixed(2));
}
function wobDetune() { // sampled wobble offset so file:// + hosts stay in sync with visuals
  wobPhase += 0.9;
  return Math.sin(wobPhase) * state.wobble * 160;
}
function env(g, t, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
}
function noise(t, { dur = 0.15, type = "highpass", freq = 6000, q = 0.8, peak = 0.5 }) {
  const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); env(g, t, peak, dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}
function tone(t, { f0 = 150, f1 = 45, dur = 0.25, type = "sine", peak = 0.9, curve = "exp" }) {
  const o = actx.createOscillator(); o.type = type;
  const w = wobDetune();
  o.frequency.setValueAtTime(Math.max(20, f0 + w * 0.15), t);
  if (curve === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 + w * 0.1), t + dur);
  else o.frequency.linearRampToValueAtTime(Math.max(20, f1), t + dur);
  wobDepth.connect(o.detune);
  const g = actx.createGain(); env(g, t, peak, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
  o.onended = () => { try { wobDepth.disconnect(o.detune); } catch {} };
}

const HIT = {
  kick(t)  { tone(t, { f0: 165, f1: 42, dur: 0.28, peak: 1.0 }); },
  snare(t) { noise(t, { dur: 0.16, type: "highpass", freq: 1800, peak: 0.5 }); tone(t, { f0: 190, f1: 140, dur: 0.12, type: "triangle", peak: 0.55 }); },
  hat(t)   { noise(t, { dur: 0.05, type: "highpass", freq: 7500, peak: 0.32 }); },
  tom(t)   { tone(t, { f0: 220 + wobDetune() * 0.2, f1: 95, dur: 0.32, peak: 0.8 }); },
  clap(t)  { [0, 0.02, 0.045].forEach((o) => noise(t + o, { dur: 0.09, type: "bandpass", freq: 1600, q: 1.4, peak: 0.4 })); },
  boing(t) {
    const o = actx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(420 + wobDetune() * 0.4, t + 0.09);
    o.frequency.linearRampToValueAtTime(180, t + 0.28);
    wobDepth.connect(o.detune);
    const g = actx.createGain(); env(g, t, 0.6, 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
    o.onended = () => { try { wobDepth.disconnect(o.detune); } catch {} };
  },
};

function playVoice(id, when = 0) {
  ensureAudio();
  HIT[id]((when || actx.currentTime));
}

/* ---------- scheduler (lookahead, polyrhythmic) ---------- */
let step = 0, nextT = 0, timer = null;
const stepDur = () => 60 / state.bpm / 4;

function scheduler() {
  while (nextT < actx.currentTime + 0.14) {
    VOICES.forEach((v) => {
      const L = state.loops[v.id];
      if (L.on && L.pat[step % v.len]) HIT[v.id](nextT);
    });
    drawStep(step);
    step++;
    nextT += stepDur();
  }
}
function setPlaying(on) {
  ensureAudio();
  state.playing = on;
  const b = $("#playBtn");
  b.classList.toggle("playing", on);
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "⏸ pause the picnic" : "▶ start the picnic";
  if (on) { step = 0; nextT = actx.currentTime + 0.06; timer = setInterval(scheduler, 25); toast("the blanket is bouncing — stack those loops 🥁"); }
  else { clearInterval(timer); timer = null; document.querySelectorAll(".dot.now").forEach((d) => d.classList.remove("now")); }
}

/* ---------- ui ---------- */
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.textContent = ""; }, 3200);
}
function drawStep(s) {
  // cheap + robust: schedule highlight on next frame
  requestAnimationFrame(() => {
    document.querySelectorAll(".dot.now").forEach((d) => d.classList.remove("now"));
    VOICES.forEach((v) => {
      const dots = document.querySelectorAll(`.dot[data-v="${v.id}"]`);
      const i = s % v.len;
      if (dots[i]) dots[i].classList.add("now");
      const card = document.querySelector(`.pad[data-v="${v.id}"]`);
      const L = state.loops[v.id];
      card.classList.toggle("playing-now", !!(L.on && L.pat[i] && state.playing));
    });
  });
}
function bonk(id) {
  playVoice(id);
  const card = document.querySelector(`.pad[data-v="${id}"]`);
  card.classList.remove("hit"); void card.offsetWidth; card.classList.add("hit");
}

function buildBlanket() {
  const wrap = $("#blanket");
  wrap.innerHTML = "";
  VOICES.forEach((v) => {
    const L = state.loops[v.id];
    const card = document.createElement("div");
    card.className = "pad"; card.dataset.v = v.id;
    card.innerHTML = `
      <div class="blob" role="button" tabindex="0" aria-label="play ${v.name}" style="background:${v.color}">${v.name}<small>${v.sub}</small></div>
      <div class="meta"><span class="len">${v.len}-beat loop</span>
        <div class="controls">
          <button class="chip loop" aria-pressed="${L.on}">${L.on ? "● looping" : "○ loop"}</button>
          <button class="chip dice" title="randomize pattern">🎲</button>
        </div>
      </div>
      <div class="steps" role="group" aria-label="${v.name} pattern"></div>`;
    const blob = card.querySelector(".blob");
    blob.addEventListener("pointerdown", (e) => { e.preventDefault(); bonk(v.id); });
    blob.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bonk(v.id); } });
    card.querySelector(".loop").addEventListener("click", (e) => {
      ensureAudio();
      L.on = !L.on;
      e.target.setAttribute("aria-pressed", String(L.on));
      e.target.textContent = L.on ? "● looping" : "○ loop";
      persist(); encodeHash();
    });
    card.querySelector(".dice").addEventListener("click", () => {
      for (let i = 0; i < v.len; i++) L.pat[i] = Math.random() < (v.id === "hat" ? 0.55 : 0.38) ? 1 : 0;
      if (!L.pat.includes(1)) L.pat[Math.floor(Math.random() * v.len)] = 1;
      buildDots(card, v); persist(); encodeHash();
    });
    wrap.appendChild(card);
    buildDots(card, v);
  });
}
function buildDots(card, v) {
  const L = state.loops[v.id];
  const box = card.querySelector(".steps");
  box.innerHTML = "";
  for (let i = 0; i < v.len; i++) {
    const d = document.createElement("button");
    d.className = "dot" + (L.pat[i] ? " on" : "");
    d.dataset.v = v.id;
    d.title = `${v.name} step ${i + 1}`;
    d.setAttribute("aria-label", `${v.name} step ${i + 1} ${L.pat[i] ? "on" : "off"}`);
    d.addEventListener("click", () => {
      ensureAudio();
      L.pat[i] = L.pat[i] ? 0 : 1;
      d.classList.toggle("on", !!L.pat[i]);
      if (L.pat[i]) playVoice(v.id); // audition
      persist(); encodeHash();
    });
    box.appendChild(d);
  }
}

/* ---------- persistence + shareable beat link ---------- */
const LS_KEY = "wobble-drum-picnic-v1";
function snapshot() {
  return { v: 1, bpm: state.bpm, wob: +state.wobble.toFixed(3), vol: +state.vol.toFixed(2),
    loops: VOICES.map((x) => ({ id: x.id, on: state.loops[x.id].on ? 1 : 0, pat: state.loops[x.id].pat.join("") })) };
}
function applySnap(s) {
  if (!s) return false;
  if (typeof s.bpm === "number") state.bpm = Math.min(180, Math.max(70, s.bpm));
  if (typeof s.wob === "number") state.wobble = Math.min(1, Math.max(0, s.wob));
  if (typeof s.vol === "number") state.vol = Math.min(1, Math.max(0, s.vol));
  (s.loops || []).forEach((l) => {
    const v = VOICES.find((x) => x.id === l.id);
    if (!v || !state.loops[l.id]) return;
    state.loops[l.id].on = !!l.on;
    const bits = String(l.pat || "").split("").map((c) => (c === "1" ? 1 : 0));
    if (bits.length === v.len) state.loops[l.id].pat = bits;
  });
  return true;
}
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot())); } catch {} }
function encodeHash() {
  const json = JSON.stringify(snapshot());
  const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  history.replaceState(null, "", "#b=" + b64);
}
function decodeHash() {
  const m = location.hash.match(/#b=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch { return null; }
}
function syncControls() {
  $("#bpm").value = state.bpm; $("#bpmVal").textContent = state.bpm;
  $("#wobble").value = Math.round(state.wobble * 100); $("#wobVal").textContent = Math.round(state.wobble * 100) + "%";
  $("#vol").value = Math.round(state.vol * 100); $("#volVal").textContent = Math.round(state.vol * 100) + "%";
  if (master) master.gain.value = state.vol;
  updateWobbleDepth();
}

/* ---------- easter egg: the picnic ant + pickle rave 🐜🥒 ---------- */
const ant = $("#ant");
let antClicks = 0, raveTimer = null, melodyTimer = null;
function marchAnt() {
  ant.style.left = "-60px";
  ant.style.bottom = (8 + Math.random() * 120) + "px";
  requestAnimationFrame(() => {
    ant.style.left = (30 + Math.random() * 70) + "vw";
    ant.style.bottom = (8 + Math.random() * 160) + "px";
  });
}
setInterval(() => { if (document.visibilityState === "visible" && !document.body.classList.contains("rave")) marchAnt(); }, 11000);
setTimeout(marchAnt, 2500);
ant.addEventListener("click", () => {
  ensureAudio();
  antClicks++;
  playVoice(["hat", "boing", "clap"][antClicks % 3]);
  ant.style.transform = `scale(${1 + antClicks * 0.3}) rotate(${antClicks * 40}deg)`;
  if (antClicks >= 3) { antClicks = 0; toggleRave(); }
  else toast(`the ant wiggles (${antClicks}/3)…`);
});
function toggleRave(force) {
  const on = force !== undefined ? force : !document.body.classList.contains("rave");
  document.body.classList.toggle("rave", on);
  clearInterval(raveTimer); clearInterval(melodyTimer); raveTimer = melodyTimer = null;
  if (!on) { toast("the ants scuttle home. 🧺"); return; }
  // ants' choice: everything loops
  VOICES.forEach((v) => { state.loops[v.id].on = true; });
  buildBlanket();
  if (!state.playing) setPlaying(true);
  toast("🥒 PICKLE RAVE! the ants are dancing! (boop the ant to chill)");
  // secret kazoo-ish melody over the top
  const notes = [523, 659, 784, 659, 880, 784, 659, 523, 587, 659, 523, 392];
  let n = 0;
  melodyTimer = setInterval(() => {
    if (!document.body.classList.contains("rave")) return;
    const t = actx.currentTime;
    tone(t, { f0: notes[n % notes.length], f1: notes[n % notes.length] * 1.01, dur: 0.18, type: "sawtooth", peak: 0.16, curve: "lin" });
    n++;
  }, 3000 / state.bpm * 2);
  let hue = 0;
  raveTimer = setInterval(() => {
    hue = (hue + 24) % 360;
    document.querySelectorAll(".blob").forEach((b, i) => {
      b.style.filter = `hue-rotate(${(hue + i * 40) % 360 - 180}deg) saturate(1.4)`;
    });
  }, 220);
}

/* ---------- wire up ---------- */
function init() {
  const fromHash = decodeHash();
  let fromLS = null;
  try { fromLS = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
  applySnap(fromHash || fromLS);
  buildBlanket();
  syncControls();

  $("#playBtn").addEventListener("click", () => setPlaying(!state.playing));
  $("#bpm").addEventListener("input", (e) => { state.bpm = +e.target.value; $("#bpmVal").textContent = state.bpm; persist(); encodeHash(); });
  $("#wobble").addEventListener("input", (e) => { state.wobble = +e.target.value / 100; $("#wobVal").textContent = e.target.value + "%"; ensureAudio(); updateWobbleDepth(); persist(); encodeHash(); });
  $("#vol").addEventListener("input", (e) => { state.vol = +e.target.value / 100; $("#volVal").textContent = e.target.value + "%"; if (master) master.gain.value = state.vol; persist(); encodeHash(); });
  $("#scrambleBtn").addEventListener("click", () => {
    ensureAudio();
    VOICES.forEach((v) => {
      const L = state.loops[v.id];
      for (let i = 0; i < v.len; i++) L.pat[i] = Math.random() < 0.4 ? 1 : 0;
      if (!L.pat.includes(1)) L.pat[0] = 1;
      L.on = Math.random() < 0.7;
    });
    buildBlanket(); persist(); encodeHash(); toast("the blanket sneezed out a fresh groove 🎲");
  });
  $("#clearBtn").addEventListener("click", () => {
    VOICES.forEach((v) => { state.loops[v.id].on = false; });
    buildBlanket(); persist(); encodeHash(); toast("blanket cleared — bonk freely");
  });
  $("#shareBtn").addEventListener("click", async () => {
    ensureAudio(); persist(); encodeHash();
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast("beat link copied — send it to a friend 🔗"); }
    catch { prompt("copy your beat link:", url); }
  });
  // spacebar = play/pause, keys 1-6 bonk pads
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    if (e.code === "Space") { e.preventDefault(); setPlaying(!state.playing); }
    const i = ["1","2","3","4","5","6"].indexOf(e.key);
    if (i >= 0) bonk(VOICES[i].id);
  });
  if (fromHash) toast("a friend's beat just unfolded on your blanket 🎁");
}
init();
