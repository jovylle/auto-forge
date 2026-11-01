import "./index.css";

/* ============ JUNIPER BAT ECHOLOFT ============
   16-step pitch sequencer → synthesized bat chirps → live echo + reverb.
   All "samples" are synthesized with WebAudio (no files, works offline). */

type Step = { on: boolean; semi: number; chirp: number };
const N = 16;
const STORE_KEY = "juniper-bat-echoloft:v1";
const PENTA = [-12, -7, -5, -3, 0, 2, 5, 7, 12];

const CHIRPS = [
  { name: "PIP", glyph: "●", desc: "short pip 4.2k→2.6k · synthesized, no files" },
  { name: "SWEEP", glyph: "◠", desc: "long down-sweep 6.8k→2.4k · synthesized, no files" },
  { name: "TRILL", glyph: "⋮", desc: "triple-pip feeding trill · synthesized, no files" },
  { name: "THOCK", glyph: "■", desc: "click + low night thump · synthesized, no files" },
] as const;

interface Saved {
  bpm: number; steps: Step[]; echo: number; fb: number; verb: number; brush: number;
}

function defaultSteps(): Step[] {
  // "roost" starter: sparse low pips on the quarters
  return Array.from({ length: N }, (_, i) => ({
    on: i % 4 === 0,
    semi: i % 8 === 0 ? 0 : -5,
    chirp: i % 8 === 4 ? 1 : 0,
  }));
}

function load(): Saved {
  const fallback: Saved = {
    bpm: 112, steps: defaultSteps(), echo: 0.35, fb: 0.45, verb: 0.4, brush: 0,
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(p.steps) || p.steps.length !== N) return fallback;
    const steps = p.steps.map((s) => ({
      on: s?.on === true,
      semi: Math.max(-12, Math.min(12, Math.round(s?.semi ?? 0))),
      chirp: Math.max(0, Math.min(3, Math.round(s?.chirp ?? 0))),
    }));
    const num = (v: unknown, d: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
    const bpm = typeof p.bpm === "number" && Number.isFinite(p.bpm)
      ? Math.max(50, Math.min(220, Math.round(p.bpm))) : fallback.bpm;
    const brush = typeof p.brush === "number" ? Math.max(0, Math.min(3, Math.round(p.brush))) : 0;
    return { bpm, steps, echo: num(p.echo, 0.35), fb: num(p.fb, 0.45), verb: num(p.verb, 0.4), brush };
  } catch { return fallback; }
}

const S = load();
let playing = false;
let brush = S.brush;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const toastEl = $("#toast");
let toastTimer = 0;
function toast(msg: string, hot = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("hot", hot);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("hot"), 1600);
}
function save() {
  try {
    const data: Saved = { bpm: S.bpm, steps: S.steps, echo: S.echo, fb: S.fb, verb: S.verb, brush };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch { /* private mode — jam on anyway */ }
}

/* ---------------- AUDIO ---------------- */
let ctx: AudioContext | null = null;
let bus!: GainNode;       // dry voice bus
let master!: GainNode;
let delay!: DelayNode; let fbGain!: GainNode; let echoWet!: GainNode;
let verb!: ConvolverNode; let verbWet!: GainNode;

function ensureAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);

  // echo: dotted-8th delay with feedback
  delay = ctx.createDelay(2.0);
  fbGain = ctx.createGain();
  echoWet = ctx.createGain();
  delay.connect(fbGain); fbGain.connect(delay);
  delay.connect(echoWet); echoWet.connect(master);

  // reverb: generated-impulse convolver
  verb = ctx.createConvolver();
  verb.buffer = makeImpulse(1.9, 3.2);
  verbWet = ctx.createGain();
  bus.connect(verb); verb.connect(verbWet); verbWet.connect(master);
  applyFx();
}

function makeImpulse(dur: number, decay: number): AudioBuffer {
  const c = ctx!;
  const rate = c.sampleRate;
  const len = Math.floor(rate * dur);
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

const stepDur = () => 60 / S.bpm / 4;

function applyFx() {
  if (!ctx) return;
  const t = ctx.currentTime;
  delay.delayTime.setTargetAtTime(stepDur() * 3, t, 0.02); // dotted 8th
  fbGain.gain.setTargetAtTime(S.fb * 0.8, t, 0.02);
  echoWet.gain.setTargetAtTime(S.echo * 0.7, t, 0.02);
  verbWet.gain.setTargetAtTime(S.verb * 0.9, t, 0.02);
}

function blip(when: number, f0: number, f1: number, dur: number, peak = 0.5) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(Math.max(40, f0), when);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(bus);
  o.start(when); o.stop(when + dur + 0.02);
}

/** Built-in bat chirps. mul = pitch multiplier from step semitones. */
function playChirp(type: number, when: number, mul: number) {
  const c = ctx!;
  if (type === 0) {          // PIP: fast short drop
    blip(when, 4200 * mul, 2600 * mul, 0.07, 0.5);
  } else if (type === 1) {  // SWEEP: long downward glide w/ FM shimmer
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(6800 * mul, when);
    o.frequency.exponentialRampToValueAtTime(2400 * mul, when + 0.16);
    const lfo = c.createOscillator(); lfo.frequency.value = 90;
    const lfoG = c.createGain(); lfoG.gain.value = 320 * mul;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.42, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);
    o.connect(g); g.connect(bus);
    o.start(when); o.stop(when + 0.22); lfo.start(when); lfo.stop(when + 0.22);
  } else if (type === 2) {  // TRILL: three rapid pips
    for (let k = 0; k < 3; k++) {
      blip(when + k * 0.045, 5100 * mul, 3300 * mul, 0.04, 0.4);
    }
  } else {                  // THOCK: click + low thump
    const dur = 0.03;
    const nb = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const dd = nb.getChannelData(0);
    for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length);
    const src = c.createBufferSource(); src.buffer = nb;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 1.2;
    const ng = c.createGain(); ng.gain.value = 0.5;
    src.connect(bp); bp.connect(ng); ng.connect(bus);
    src.start(when);
    blip(when, 210 * mul, 90 * mul, 0.12, 0.5);
  }
}

/* ---------------- SEQUENCER ---------------- */
let nextTime = 0;   // audio-clock time of next scheduled step
let nextIdx = 0;    // next step index to schedule
let schedTimer = 0;
let startStamp = 0; // ctx.currentTime at step 0 of current cycle start
let startIdx = 0;   // step index at startStamp

function scheduleStep(idx: number, when: number) {
  const st = S.steps[idx];
  if (st.on && ctx) playChirp(st.chirp, when, Math.pow(2, st.semi / 12));
  const delayMs = ctx ? Math.max(0, (when - ctx.currentTime) * 1000) : 0;
  window.setTimeout(() => sonarPing(idx, st.on), delayMs);
}

function tick() {
  if (!ctx || !playing) return;
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(nextIdx, nextTime);
    nextTime += stepDur();
    nextIdx = (nextIdx + 1) % N;
  }
}

function start() {
  ensureAudio();
  if (playing || !ctx) return;
  playing = true;
  nextIdx = 0;
  nextTime = ctx.currentTime + 0.06;
  startStamp = nextTime; startIdx = 0;
  schedTimer = window.setInterval(tick, 25);
  playBtn.textContent = "■ ROOST";
  playBtn.classList.add("live");
  playBtn.setAttribute("aria-label", "Stop the sequencer");
  toast("the loft is flying.", true);
}

function stop() {
  playing = false;
  window.clearInterval(schedTimer);
  document.querySelectorAll(".step.now").forEach((el) => el.classList.remove("now"));
  playBtn.textContent = "▶ FLY";
  playBtn.classList.remove("live");
  playBtn.setAttribute("aria-label", "Play or stop the sequencer");
  toast("roosted. pattern kept.");
}

function currentStep(): number {
  if (!playing || !ctx) return -1;
  const el = ctx.currentTime - startStamp;
  if (el < 0) return -1;
  return (startIdx + Math.floor(el / stepDur())) % N;
}

/* ---------------- SONAR CANVAS ---------------- */
const sonar = $("#sonar") as HTMLCanvasElement;
const sg = sonar.getContext("2d")!;
interface Ring { x: number; born: number; strong: boolean }
let rings: Ring[] = [];

function sizeSonar() {
  const r = sonar.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  sonar.width = Math.max(1, Math.floor(r.width * dpr));
  sonar.height = Math.floor(72 * dpr);
}
function sonarPing(idx: number, strong: boolean) {
  const r = sonar.getBoundingClientRect();
  rings.push({ x: ((idx + 0.5) / N) * r.width, born: performance.now(), strong });
  if (rings.length > 48) rings.splice(0, rings.length - 48);
}
function drawSonar(now: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = sonar.width / dpr, H = sonar.height / dpr;
  sg.setTransform(dpr, 0, 0, dpr, 0, 0);
  sg.clearRect(0, 0, W, H);
  // playhead
  const cs = currentStep();
  if (cs >= 0) {
    const x = ((cs + 0.5) / N) * W;
    sg.fillStyle = "rgba(224,145,47,0.16)";
    sg.fillRect((cs / N) * W, 0, W / N, H);
    sg.fillStyle = "#e0912f";
    sg.fillRect(x - 1, 0, 2, H);
  }
  rings = rings.filter((rg) => now - rg.born < 1400);
  for (const rg of rings) {
    const age = (now - rg.born) / 1400;
    const rad = 4 + age * 64;
    sg.beginPath();
    sg.arc(rg.x, H - 6, rad, Math.PI, 0);
    sg.strokeStyle = rg.strong ? `rgba(224,145,47,${(1 - age) * 0.9})` : `rgba(87,167,115,${(1 - age) * 0.55})`;
    sg.lineWidth = rg.strong ? 3 : 2;
    sg.stroke();
  }
  requestAnimationFrame(drawSonar);
}

/* ---------------- STEP GRID ---------------- */
const stepsEl = $("#steps");
const readoutEl = $("#readout");
const stepBtns: HTMLButtonElement[] = [];

function hangHeight(semi: number): number {
  return 28 + ((semi + 12) / 24) * 100; // 28..128px
}

function paintStep(i: number) {
  const b = stepBtns[i], st = S.steps[i];
  b.classList.toggle("on", st.on);
  b.classList.toggle("beat4", i % 4 === 0);
  b.setAttribute("aria-pressed", String(st.on));
  b.setAttribute("aria-label",
    `Step ${i + 1} ${st.on ? "on" : "off"}, ${st.semi >= 0 ? "+" : ""}${st.semi} semitones, ${CHIRPS[st.chirp].name}`);
  (b.querySelector(".hang") as HTMLElement).style.height = `${hangHeight(st.semi)}px`;
  (b.querySelector(".glyph") as HTMLElement).textContent = CHIRPS[st.chirp].glyph;
  const semiEl = b.querySelector(".semi") as HTMLElement;
  semiEl.textContent = `${st.semi >= 0 ? "+" : ""}${st.semi}`;
}

function paintAll() { for (let i = 0; i < N; i++) paintStep(i); }

function previewStep(i: number) {
  ensureAudio();
  const st = S.steps[i];
  playChirp(st.chirp, ctx!.currentTime + 0.01, Math.pow(2, st.semi / 12));
  sonarPing(i, true);
  readoutEl.textContent = `step ${i + 1} · ${st.semi >= 0 ? "+" : ""}${st.semi} · ${CHIRPS[st.chirp].name}`;
}

function buildSteps() {
  for (let i = 0; i < N; i++) {
    const b = document.createElement("button");
    b.className = "step";
    b.type = "button";
    b.innerHTML = `<span class="hang"></span><span class="meta"><span class="glyph"></span><span class="semi"></span></span><span class="idx">${i + 1}</span>`;
    let dragY: number | null = null;
    let moved = false;
    b.addEventListener("pointerdown", (e) => {
      dragY = e.clientY; moved = false;
      b.setPointerCapture(e.pointerId);
    });
    b.addEventListener("pointermove", (e) => {
      if (dragY === null) return;
      const dy = dragY - e.clientY;
      if (Math.abs(dy) > 6) {
        moved = true;
        const st = S.steps[i];
        st.semi = Math.max(-12, Math.min(12, Math.round(st.semi + dy / 8)));
        dragY = e.clientY;
        paintStep(i);
        readoutEl.textContent = `step ${i + 1} · ${st.semi >= 0 ? "+" : ""}${st.semi} · ${CHIRPS[st.chirp].name}`;
      }
    });
    b.addEventListener("pointerup", () => {
      if (dragY === null) return;
      dragY = null;
      const st = S.steps[i];
      if (!moved) {
        st.on = !st.on;
        if (st.on) st.chirp = brush; // paint with the loaded brush
      }
      paintStep(i); save();
      if (st.on) previewStep(i);
      else readoutEl.textContent = `step ${i + 1} · off`;
    });
    b.addEventListener("keydown", (e) => {
      const st = S.steps[i];
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        st.semi = Math.max(-12, Math.min(12, st.semi + (e.key === "ArrowUp" ? 1 : -1)));
        st.on = true;
        paintStep(i); save(); previewStep(i);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const j = (i + (e.key === "ArrowRight" ? 1 : N - 1)) % N;
        stepBtns[j].focus();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        st.on = !st.on;
        if (st.on) st.chirp = brush;
        paintStep(i); save();
        if (st.on) previewStep(i);
      }
    });
    stepsEl.appendChild(b);
    stepBtns.push(b);
  }
  paintAll();
}

/* ---------------- BRUSH ---------------- */
function buildBrush() {
  const row = $("#brushRow");
  CHIRPS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "brush" + (i === brush ? " sel" : "");
    b.type = "button";
    b.setAttribute("aria-pressed", String(i === brush));
    b.setAttribute("aria-label", `Chirp brush ${c.name}: ${c.desc}`);
    b.innerHTML = `<span class="b-glyph">${c.glyph}</span><span>${c.name}</span>`;
    b.addEventListener("click", () => {
      brush = i;
      row.querySelectorAll(".brush").forEach((el, j) => {
        el.classList.toggle("sel", j === i);
        el.setAttribute("aria-pressed", String(j === i));
      });
      $("#brushDesc").textContent = c.desc;
      ensureAudio();
      playChirp(i, ctx!.currentTime + 0.01, 1);
      sonarPing(2 + i * 4, true);
      save();
    });
    row.appendChild(b);
  });
  $("#brushDesc").textContent = CHIRPS[brush].desc;
}

/* ---------------- KNOBS ---------------- */
function bindKnob(id: string, valId: string, get: () => number, set: (v: number) => void) {
  const el = document.getElementById(id)!;
  const valEl = document.getElementById(valId)!;
  const ptr = el.querySelector(".knob-ptr") as HTMLElement;
  const render = () => {
    const v = get();
    ptr.style.transform = `rotate(${-135 + v * 270}deg) translateY(-32px)`;
    const pct = Math.round(v * 100);
    valEl.textContent = String(pct);
    el.setAttribute("aria-valuenow", String(pct));
    el.setAttribute("aria-valuetext", `${pct} percent`);
  };
  // indicator bar spans knob-center → downward; rotate about its top (knob center),
  // then push outward so it reads as a needle (see .knob-ptr transform-origin 50% 0).
  let startY: number | null = null, startV = 0;
  el.addEventListener("pointerdown", (e) => {
    startY = e.clientY; startV = get();
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    set(Math.max(0, Math.min(1, startV + (startY - e.clientY) / 160)));
    ensureAudio(); applyFx(); render(); save();
  });
  el.addEventListener("pointerup", () => { startY = null; });
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    set(Math.max(0, Math.min(1, get() + (e.deltaY < 0 ? 0.05 : -0.05))));
    ensureAudio(); applyFx(); render(); save();
  }, { passive: false });
  el.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault(); set(Math.min(1, get() + step));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault(); set(Math.max(0, get() - step));
    } else if (e.key === "Home") { e.preventDefault(); set(0); }
    else if (e.key === "End") { e.preventDefault(); set(1); }
    else return;
    ensureAudio(); applyFx(); render(); save();
  });
  render();
}

/* ---------------- TEMPO ---------------- */
const bpmVal = $("#bpmVal");
const bpmSlider = $("#bpmSlider") as HTMLInputElement;
const stepLenEl = $("#stepLen");

function paintTempo() {
  bpmVal.textContent = String(S.bpm);
  bpmSlider.value = String(S.bpm);
  stepLenEl.textContent = String(Math.round(stepDur() * 1000));
  applyFx();
}
bpmSlider.addEventListener("input", () => {
  S.bpm = Number(bpmSlider.value);
  paintTempo(); save();
});

const tapDots = $("#tapDots");
let taps: number[] = [];
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  if (taps.length > 6) taps.shift();
  tapDots.textContent = "●".repeat(Math.min(taps.length, 6));
  if (taps.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
    gaps.sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    S.bpm = Math.max(50, Math.min(220, Math.round(60000 / med)));
    paintTempo(); save();
    toast(`tempo ${S.bpm} bpm`, true);
  }
}
$("#tapPad").addEventListener("click", () => { ensureAudio(); tap(); });

/* ---------------- PATTERNS ---------------- */
function randomize() {
  for (let i = 0; i < N; i++) {
    const on = Math.random() < 0.45;
    S.steps[i] = {
      on,
      semi: PENTA[Math.floor(Math.random() * PENTA.length)],
      chirp: Math.floor(Math.random() * 4),
    };
    if (i % 4 === 0 && Math.random() < 0.7) S.steps[i].on = true; // keep a spine
  }
  paintAll(); save();
  toast("seeded a fresh flock.", true);
}

function preset(name: string) {
  if (name === "roost") {
    S.steps = Array.from({ length: N }, (_, i) => ({
      on: i % 4 === 0, semi: i % 8 === 0 ? 0 : -5, chirp: i % 8 === 4 ? 1 : 0,
    }));
  } else if (name === "swarm") {
    S.steps = Array.from({ length: N }, (_, i) => ({
      on: i % 2 === 0 || i % 5 === 0,
      semi: PENTA[(i * 3 + 4) % PENTA.length], chirp: i % 3 === 0 ? 2 : i % 4,
    }));
  } else { // moth: offbeat flickers
    S.steps = Array.from({ length: N }, (_, i) => ({
      on: i % 2 === 1, semi: i % 4 === 1 ? 7 : 2, chirp: i % 4 === 3 ? 3 : 1,
    }));
  }
  paintAll(); save();
  toast(`flock: ${name}.`, true);
}

const playBtn = $("#playBtn");
$("#randBtn").addEventListener("click", () => { ensureAudio(); randomize(); });
$("#clearBtn").addEventListener("click", () => {
  S.steps = S.steps.map(() => ({ on: false, semi: 0, chirp: brush }));
  paintAll(); save();
  toast("loft swept clean.");
});
document.querySelectorAll<HTMLButtonElement>(".chip").forEach((c) => {
  c.addEventListener("click", () => { ensureAudio(); preset(c.dataset.preset!); });
});
playBtn.addEventListener("click", () => {
  ensureAudio();
  if (playing) stop(); else start();
});

document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  // Buttons (incl. steps) handle their own keyboard activation natively —
  // the global handler must not double-fire on top of a focused button.
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON")) return;
  if (e.code === "Space" && !t.classList?.contains("step") && t.getAttribute("role") !== "slider") {
    e.preventDefault();
    ensureAudio();
    if (playing) stop(); else start();
  } else if (e.key === "t" || e.key === "T") { ensureAudio(); tap(); }
  else if (e.key === "r" || e.key === "R") { ensureAudio(); randomize(); }
});

/* playhead highlight */
let lastShown = -2;
setInterval(() => {
  const cs = currentStep();
  if (cs !== lastShown) {
    if (lastShown >= 0) stepBtns[lastShown]?.classList.remove("now");
    if (cs >= 0) stepBtns[cs]?.classList.add("now");
    lastShown = cs;
  }
}, 40);

/* ---------------- BOOT ---------------- */
buildSteps();
buildBrush();
bindKnob("knobEcho", "valEcho", () => S.echo, (v) => { S.echo = v; });
bindKnob("knobFb", "valFb", () => S.fb, (v) => { S.fb = v; });
bindKnob("knobVerb", "valVerb", () => S.verb, (v) => { S.verb = v; });
bpmSlider.value = String(S.bpm);
paintTempo();
sizeSonar();
window.addEventListener("resize", sizeSonar);
requestAnimationFrame(drawSonar);
