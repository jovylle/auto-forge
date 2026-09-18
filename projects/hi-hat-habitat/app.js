// Hi-Hat Habitat — breed tiny hi-hat patterns that evolve into glitchy rhythms.
// WebAudio synthesis (no samples) + lookahead sequencer + shareable seeds.

const $ = (id) => document.getElementById(id);
const grid = $("grid"), playBtn = $("playBtn"), playLabel = $("playLabel");
const bpmSlider = $("bpm"), driftSlider = $("drift"), evoBtn = $("evoBtn");
const bpmVal = $("bpmVal"), bpmView = $("bpmView"), driftVal = $("driftVal"), evoVal = $("evoVal");
const seedView = $("seedView"), seedInput = $("seedInput"), copyNote = $("copyNote");
const genPill = $("genPill"), barPill = $("barPill");
const kids = $("kids"), clutch = $("clutch");

const STEPS = 16;
const GLYPHS = ["·", "◔", "●", "⬢"]; // off, closed, accent, open
const NAMES = ["empty", "closed", "accent", "open"];

/* ---------- seeded rng ---------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rngFrom = (s) => mulberry32(xmur3(s)());
const randSeed = () => Math.random().toString(36).slice(2, 6).toUpperCase();

/* ---------- state ---------- */
const store = { load() { try { return JSON.parse(localStorage.getItem("hihat-habitat") || "null"); } catch { return null; } }, save(s) { try { localStorage.setItem("hihat-habitat", JSON.stringify(s)); } catch {} } };

const state = {
  seed: randSeed(),
  steps: new Array(STEPS).fill(0),
  bpm: 112, drift: 35, evolving: true,
  generation: 0, bar: 1,
  playing: false,
};

function growFromSeed(seed) {
  const r = rngFrom("habitat:" + seed);
  const steps = [];
  for (let i = 0; i < STEPS; i++) {
    const x = r();
    // musical default: four-on-floor-ish closed hats with accents + gaps
    steps.push(i % 4 === 0 ? 2 : x < 0.42 ? 1 : x < 0.52 ? 2 : x < 0.60 ? 3 : 0);
  }
  return steps;
}

function mutateSteps(src, amount /*0..1*/, r) {
  const out = src.slice();
  const flips = Math.max(1, Math.round(amount * 6));
  for (let k = 0; k < flips; k++) {
    const i = Math.floor(r() * STEPS);
    const roll = r();
    if (roll < 0.55) out[i] = (out[i] + (r() < 0.5 ? 1 : 3)) % 4; // nudge velocity
    else if (roll < 0.8) out[i] = r() < 0.45 ? 0 : 1 + Math.floor(r() * 3); // reseed cell
    else { const j = Math.floor(r() * STEPS); [out[i], out[j]] = [out[j], out[i]]; } // swap genes
  }
  // keep at least 4 hits so it never goes silent
  if (out.every((v) => v === 0)) { out[0] = 2; out[4] = 1; out[8] = 2; out[12] = 1; }
  return out;
}

/* ---------- seed encode / decode ---------- */
// seed string: <4-char id>.<16 base4 digits>.<bpm>  e.g. "K3Q9.2110211021102110.112"
function encodeSeed() {
  return `${state.seed}.${state.steps.join("")}.${state.bpm}`;
}
function decodeSeed(s) {
  const m = /^([A-Za-z0-9]{1,8})\.([0-3]{16})\.(\d{2,3})$/.exec((s || "").trim());
  if (!m) return null;
  const bpm = Math.min(180, Math.max(70, parseInt(m[3], 10)));
  return { seed: m[1].toUpperCase(), steps: m[2].split("").map(Number), bpm };
}

/* ---------- audio ---------- */
let ctx = null, noiseBuf = null, delaySend = null;
function ensureAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // dubby feedback delay for glitch tails
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  const wet = ctx.createGain(); wet.gain.value = 0.25;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
  delaySend = delay;
}

function hat(time, kind, accent, glitchy) {
  // kind: 1 closed, 2 accent, 3 open
  const dur = kind === 3 ? 0.32 : kind === 2 ? 0.12 : 0.055;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.9 + Math.random() * 0.35 + (glitchy ? 0.8 : 0);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass";
  hp.frequency.value = kind === 3 ? 6200 : 7800 + Math.random() * 1200;
  hp.Q.value = 0.8;
  const g = ctx.createGain();
  const peak = (kind === 2 ? 0.75 : kind === 3 ? 0.5 : 0.42) * (accent ? 1 : 0.9);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  src.connect(hp); hp.connect(g);
  if (pan) { pan.pan.value = (Math.random() * 2 - 1) * 0.35; g.connect(pan); pan.connect(ctx.destination); if (kind === 3 || glitchy) pan.connect(delaySend); }
  else { g.connect(ctx.destination); if (kind === 3 || glitchy) g.connect(delaySend); }
  src.start(time, Math.random() * 0.4, dur + 0.05);
  src.stop(time + dur + 0.08);
  if (glitchy && Math.random() < 0.7) {
    // 32nd-note stutter flam
    hat(time + 60 / state.bpm / 4 / 2, 1, false, false);
  }
}

/* ---------- sequencer ---------- */
let step = 0, nextTime = 0, timer = null;
const LOOKAHEAD = 0.12, TICK = 25;

function schedule() {
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    const v = state.steps[step];
    const s = step;
    if (v > 0) {
      const glitchy = state.drift > 10 && Math.random() < state.drift / 100 * 0.35;
      hat(nextTime, v, v === 2, glitchy);
      setTimeout(() => flashCell(s), Math.max(0, (nextTime - ctx.currentTime) * 1000));
    }
    setTimeout(() => markNow(s), Math.max(0, (nextTime - ctx.currentTime) * 1000));
    nextTime += 60 / state.bpm / 4; // 16ths
    step = (step + 1) % STEPS;
    if (step === 0) onBarEnd();
  }
}

function onBarEnd() {
  state.bar++;
  barPill.textContent = "bar " + state.bar;
  if (state.evolving && state.playing && state.drift > 0) {
    const r = Math.random;
    const before = state.steps.join("");
    state.steps = mutateSteps(state.steps, (state.drift / 100) * 0.5, r);
    if (state.steps.join("") !== before) {
      state.generation++;
      genPill.textContent = "gen " + state.generation;
      render(true);
      persist();
    }
  }
}

function setPlaying(on) {
  ensureAudio();
  state.playing = on;
  playBtn.classList.toggle("on", on);
  playBtn.setAttribute("aria-pressed", String(on));
  playLabel.textContent = on ? "stop" : "play";
  document.querySelector(".play-icon").textContent = on ? "❚❚" : "▶";
  if (on) {
    if (ctx.state === "suspended") ctx.resume();
    step = 0; nextTime = ctx.currentTime + 0.06;
    timer = setInterval(schedule, TICK);
  } else {
    clearInterval(timer); timer = null;
    document.querySelectorAll(".egg.now").forEach((e) => e.classList.remove("now"));
  }
}

/* ---------- grid ui ---------- */
const eggBtns = [];
function buildGrid() {
  grid.innerHTML = "";
  eggBtns.length = 0;
  for (let i = 0; i < STEPS; i++) {
    const b = document.createElement("button");
    b.className = "egg";
    b.setAttribute("aria-label", `step ${i + 1}`);
    b.addEventListener("click", () => {
      ensureAudio();
      state.steps[i] = (state.steps[i] + 1) % 4; // tap to mutate cell
      state.generation++;
      genPill.textContent = "gen " + state.generation;
      render(); persist();
      // audition the new sound instantly
      if (ctx && state.steps[i] > 0) hat(ctx.currentTime + 0.01, state.steps[i], state.steps[i] === 2, false);
    });
    grid.appendChild(b);
    eggBtns.push(b);
  }
}
function render(soft) {
  state.steps.forEach((v, i) => {
    const b = eggBtns[i];
    b.classList.toggle("v1", v === 1);
    b.classList.toggle("v2", v === 2);
    b.classList.toggle("v3", v === 3);
    b.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}${i % 4 === 0 ? '<span class="beat">◆</span>' : ""}</span><span class="g">${GLYPHS[v]}</span>`;
    b.setAttribute("aria-label", `step ${i + 1}, ${NAMES[v]}. Activate to change.`);
  });
  seedView.textContent = encodeSeed();
  seedInput.value = encodeSeed();
  bpmVal.textContent = state.bpm;
  bpmView.textContent = state.bpm + " bpm";
  driftVal.textContent = state.drift + "%";
  if (!soft) persist();
}
function markNow(s) {
  eggBtns.forEach((e, i) => e.classList.toggle("now", i === s));
}
function flashCell(s) {
  const e = eggBtns[s];
  e.classList.remove("hit"); void e.offsetWidth; e.classList.add("hit");
}

/* ---------- offspring ---------- */
function spawnClutch() {
  const base = rngFrom("habitat:" + state.seed + ":" + state.generation + ":" + Date.now() % 100000);
  kids.innerHTML = "";
  clutch.hidden = false;
  [0.25, 0.55, 0.9].forEach((amt, k) => {
    const child = mutateSteps(state.steps, amt, base);
    const b = document.createElement("button");
    b.className = "kid";
    b.innerHTML = `<span class="mini">${child.map((v) => `<i class="f${v}"></i>`).join("")}</span><b>hatchling ${k + 1} · ±${Math.round(amt * 100)}%</b>`;
    b.addEventListener("click", () => {
      state.steps = child;
      state.generation++;
      state.seed = randSeed();
      genPill.textContent = "gen " + state.generation;
      clutch.hidden = true;
      render(); persist();
    });
    kids.appendChild(b);
  });
  clutch.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------- share ---------- */
async function copyLink() {
  const url = new URL(location.href);
  url.searchParams.set("s", encodeSeed());
  const link = url.toString();
  try {
    await navigator.clipboard.writeText(link);
    copyNote.textContent = "link copied — anyone opening it hears this exact rhythm 🧬";
  } catch {
    seedInput.select();
    document.execCommand && document.execCommand("copy");
    copyNote.textContent = "seed copied: " + encodeSeed();
  }
  setTimeout(() => (copyNote.textContent = ""), 4000);
}

/* ---------- persistence / init ---------- */
function persist() {
  store.save({ seed: state.seed, steps: state.steps, bpm: state.bpm, drift: state.drift, evolving: state.evolving, generation: state.generation });
}

function init() {
  // URL seed wins, then localStorage, then fresh growth
  const q = new URLSearchParams(location.search).get("s");
  const fromUrl = q && decodeSeed(q);
  const saved = !fromUrl && store.load();
  if (fromUrl) {
    state.seed = fromUrl.seed; state.steps = fromUrl.steps; state.bpm = fromUrl.bpm;
  } else if (saved && Array.isArray(saved.steps) && saved.steps.length === STEPS) {
    Object.assign(state, { seed: saved.seed || state.seed, steps: saved.steps, bpm: saved.bpm || 112, drift: saved.drift ?? 35, evolving: saved.evolving ?? true, generation: saved.generation || 0 });
  } else {
    state.steps = growFromSeed(state.seed);
  }
  bpmSlider.value = state.bpm;
  driftSlider.value = state.drift;
  evoBtn.classList.toggle("on", state.evolving);
  evoBtn.textContent = state.evolving ? "on" : "off";
  evoVal.textContent = state.evolving ? "on" : "off";
  genPill.textContent = "gen " + state.generation;

  buildGrid();
  render(true);

  playBtn.addEventListener("click", () => setPlaying(!state.playing));
  bpmSlider.addEventListener("input", () => { state.bpm = +bpmSlider.value; render(); });
  driftSlider.addEventListener("input", () => { state.drift = +driftSlider.value; render(); });
  evoBtn.addEventListener("click", () => {
    state.evolving = !state.evolving;
    evoBtn.classList.toggle("on", state.evolving);
    evoBtn.textContent = state.evolving ? "on" : "off";
    evoVal.textContent = state.evolving ? "on" : "off";
    persist();
  });
  $("mutateBtn").addEventListener("click", () => {
    ensureAudio();
    state.steps = mutateSteps(state.steps, 0.3 + (state.drift / 100) * 0.5, Math.random);
    state.generation++;
    genPill.textContent = "gen " + state.generation;
    render(); persist();
  });
  $("spawnBtn").addEventListener("click", spawnClutch);
  $("diceBtn").addEventListener("click", () => {
    state.seed = randSeed();
    state.steps = growFromSeed(state.seed);
    state.generation = 0; state.bar = 1;
    genPill.textContent = "gen 0"; barPill.textContent = "bar 1";
    clutch.hidden = true;
    render(); persist();
  });
  $("copyBtn").addEventListener("click", copyLink);
  seedInput.addEventListener("change", () => {
    const d = decodeSeed(seedInput.value);
    if (d) {
      state.seed = d.seed; state.steps = d.steps; state.bpm = d.bpm;
      bpmSlider.value = state.bpm;
      state.generation++;
      genPill.textContent = "gen " + state.generation;
      render(); persist();
      copyNote.textContent = "seed loaded 🧬";
      setTimeout(() => (copyNote.textContent = ""), 2500);
    } else {
      copyNote.textContent = "that seed didn't hatch — format: XXXX.16digits.bpm";
      setTimeout(() => (copyNote.textContent = ""), 3000);
    }
  });
  // spacebar toggles play (when not typing in seed box)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== seedInput) { e.preventDefault(); setPlaying(!state.playing); }
  });
}

init();
