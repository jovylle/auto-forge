import "./index.css";

/* ============ VELVET KICK DRUMBOX — sci-fi-terminal drum machine ============
   16-step sequencer, 4 synth voices (Web Audio, no samples), live filter +
   delay, one-tap random groove. Keyboard-only operable, system fonts only. */

type VoiceId = "kick" | "snare" | "hat" | "bass";

interface Voice {
  id: VoiceId;
  name: string;
  key: string;
  color: string;
  glow: string;
}

const VOICES: Voice[] = [
  { id: "kick", name: "KICK", key: "1", color: "#ff4d6d", glow: "rgba(255,77,109,0.4)" },
  { id: "snare", name: "SNARE", key: "2", color: "#ffb648", glow: "rgba(255,182,72,0.4)" },
  { id: "hat", name: "HAT", key: "3", color: "#6fe3bd", glow: "rgba(111,227,189,0.4)" },
  { id: "bass", name: "BASS", key: "4", color: "#a5637e", glow: "rgba(165,99,126,0.55)" },
];

const STEPS = 16;
const STORE_KEY = "velvet-kick-drumbox:v1";

interface Saved {
  pattern: boolean[][];
  bpm: number;
  swing: number;
  cutoff: number;
  delayMix: number;
}

const DEFAULTS: Saved = {
  pattern: [
    [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    [true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
  ],
  bpm: 124,
  swing: 56,
  cutoff: 72,
  delayMix: 38,
};

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(s.pattern) || s.pattern.length !== 4) return structuredClone(DEFAULTS);
    for (const row of s.pattern) {
      if (!Array.isArray(row) || row.length !== STEPS) return structuredClone(DEFAULTS);
    }
    return {
      pattern: s.pattern.map((r) => r.map(Boolean)),
      bpm: clamp(Math.round(Number(s.bpm) || DEFAULTS.bpm), 60, 180),
      swing: clamp(Math.round(Number(s.swing) || DEFAULTS.swing), 50, 75),
      cutoff: clamp(Math.round(Number(s.cutoff) || DEFAULTS.cutoff), 0, 100),
      delayMix: clamp(Math.round(Number(s.delayMix) || DEFAULTS.delayMix), 0, 100),
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const state = {
  ...loadSaved(),
  playing: false,
  step: 0,
};

/* ---------------- audio engine ---------------- */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let delaySend: GainNode | null = null;
let delayNode: DelayNode | null = null;
let wetGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function cutoffHz(v: number): number {
  // 0..100 -> 150..12000 log
  return Math.round(150 * Math.pow(12000 / 150, v / 100));
}

function ensureCtx(): AudioContext {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoffHz(state.cutoff);
  filter.Q.value = 0.8;

  // dotted-eighth-ish echo, tempo synced
  delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = stepDur() * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  const wet = ctx.createGain();
  wet.gain.value = state.delayMix / 100 * 0.6;
  wetGain = wet;
  delaySend = ctx.createGain();
  delaySend.gain.value = 1;
  delaySend.connect(delayNode);
  delayNode.connect(fb);
  fb.connect(delayNode);
  delayNode.connect(wet);
  wet.connect(master);
  delaySend.connect(master); // dry passes through send node

  // white noise buffer, reused by snare + hat
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // rewire: voices -> filter -> delaySend (dry to master, wet via echo)
  filter.disconnect();
  filter.connect(delaySend);
  return ctx;
}

function voiceBus(): AudioNode {
  return (filter as BiquadFilterNode) ?? (ctx as AudioContext).destination;
}

function adsrGain(t: number, peak: number, decay: number): GainNode {
  const c = ctx as AudioContext;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0011), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(voiceBus());
  return g;
}

function playKick(t: number): void {
  const c = ctx as AudioContext;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  const g = adsrGain(t, 0.95, 0.3);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.32);
  // click transient
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  const ng = adsrGain(t, 0.25, 0.025);
  n.connect(hp);
  hp.connect(ng);
  n.start(t);
  n.stop(t + 0.04);
}

function playSnare(t: number): void {
  const c = ctx as AudioContext;
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.9;
  const ng = adsrGain(t, 0.6, 0.17);
  n.connect(bp);
  bp.connect(ng);
  n.start(t);
  n.stop(t + 0.2);
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(196, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.09);
  const og = adsrGain(t, 0.5, 0.11);
  o.connect(og);
  o.start(t);
  o.stop(t + 0.13);
}

function playHat(t: number, open = false): void {
  const c = ctx as AudioContext;
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7600;
  const dur = open ? 0.22 : 0.05;
  const ng = adsrGain(t, open ? 0.32 : 0.3, dur);
  n.connect(hp);
  hp.connect(ng);
  n.start(t);
  n.stop(t + dur + 0.02);
}

function playBass(t: number): void {
  const c = ctx as AudioContext;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const g = adsrGain(t, 0.65, 0.42);
  o.connect(lp);
  lp.connect(g);
  o.start(t);
  o.stop(t + 0.45);
}

function triggerVoice(id: VoiceId, t: number): void {
  if (id === "kick") playKick(t);
  else if (id === "snare") playSnare(t);
  else if (id === "hat") playHat(t, false);
  else playBass(t);
}

function stepDur(): number {
  return 60 / state.bpm / 4;
}

/* ---------------- sequencer scheduler ---------------- */

let timer: number | null = null;
let nextTime = 0;
let nextStep = 0;
let shownStep = -1;

function playStep(s: number, t: number): void {
  for (let v = 0; v < VOICES.length; v++) {
    if (state.pattern[v][s]) triggerVoice(VOICES[v].id, t);
  }
  // open-hat shimmer would go here; closed hats only (shortcut: fixed kit, no open-hat voice)
}

function schedule(): void {
  if (!ctx) return;
  // background tabs clamp setInterval to ~1s: widen lookahead and drop time
  // that already passed so buried steps don't fire as one chord-cluster.
  if (nextTime < ctx.currentTime - 0.03) {
    while (nextTime < ctx.currentTime - 0.03) {
      nextTime += stepDur();
      nextStep = (nextStep + 1) % STEPS;
    }
    pending.length = 0;
  }
  const ahead = ctx.currentTime + (document.hidden ? 1.0 : 0.12);
  while (nextTime < ahead) {
    let t = nextTime;
    if (nextStep % 2 === 1) t += ((state.swing - 50) / 50) * stepDur();
    playStep(nextStep, t);
    pending.push({ step: nextStep, time: t });
    nextTime += stepDur();
    nextStep = (nextStep + 1) % STEPS;
  }
}

interface Pending { step: number; time: number }
const pending: Pending[] = [];

function start(): void {
  const c = ensureCtx();
  if (c.state === "suspended") void c.resume();
  nextTime = c.currentTime + 0.06;
  nextStep = 0;
  pending.length = 0;
  shownStep = -1;
  timer = window.setInterval(schedule, 25);
  state.playing = true;
  document.body.classList.add("is-playing");
  playBtn.textContent = "■ STOP";
  playBtn.classList.add("playing");
  playBtn.setAttribute("aria-pressed", "true");
  log(`transport ▸ RUN @${state.bpm}bpm swing ${state.swing}%`);
}

function stop(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  state.playing = false;
  document.body.classList.remove("is-playing");
  playBtn.textContent = "▸ PLAY";
  playBtn.classList.remove("playing");
  playBtn.setAttribute("aria-pressed", "false");
  setNow(-1);
  log("transport ■ STOP");
}

function togglePlay(): void {
  if (state.playing) stop();
  else start();
}

/* ---------------- dom ---------------- */

const app = document.getElementById("app") as HTMLDivElement;

app.innerHTML = `
<div class="poweron mx-auto max-w-6xl px-3 sm:px-5 pb-8">
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-5 pb-4">
    <div>
      <div class="wordmark">VELVET KICK<span class="cursor-block" aria-hidden="true"></span></div>
      <div class="label mt-1">drumbox // sci-fi-terminal // webaudio</div>
    </div>
    <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div class="flex items-center gap-3">
        <button id="play" class="tbtn" aria-pressed="false">▸ PLAY</button>
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3">
          <span class="label">BPM</span>
          <span id="bpmVal" class="readout num text-xl font-bold">124</span>
        </div>
        <input id="bpm" type="range" class="fader" min="60" max="180" step="1" value="124" aria-label="tempo in BPM" />
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-3">
          <span class="label">SWING</span>
          <span id="swingVal" class="readout num text-xl font-bold">56%</span>
        </div>
        <input id="swing" type="range" class="fader" min="50" max="75" step="1" value="56" aria-label="swing percent" />
      </div>
    </div>
  </header>

  <main class="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)_232px]">
    <section aria-label="voices" class="terminal-panel p-3">
      <div class="label mb-2">voices // tap</div>
      <div id="pads" class="flex lg:flex-col flex-row gap-2"></div>
      <div class="label mt-3 hidden lg:block">keys 1–4<br/>audition</div>
    </section>

    <section aria-label="16-step sequencer" class="terminal-panel p-3 sm:p-4">
      <div class="flex items-baseline justify-between mb-2">
        <span class="label">seq // 16 steps</span>
        <span class="label num" id="hitCount"></span>
      </div>
      <div id="stepnums" class="grid grid-cols-16 gap-1" aria-hidden="true"></div>
      <div id="grid" class="grid grid-cols-16 gap-1"></div>
      <div class="label mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span><span class="kbd">tab</span> move</span>
        <span><span class="kbd">←→↑↓</span> step cursor</span>
        <span><span class="kbd">space</span>/<span class="kbd">⏎</span> toggle</span>
      </div>
    </section>

    <section aria-label="live mix" class="terminal-panel p-3">
      <div class="label mb-2">live mix</div>
      <div class="flex lg:flex-col flex-row justify-around gap-4">
        <div class="knob-wrap">
          <input id="cutoff" type="range" class="knob" min="0" max="100" step="1" value="72" aria-label="filter cutoff" style="--kcolor:#ff4d6d" />
          <span class="label">filter</span>
          <span id="cutoffVal" class="readout num text-sm font-bold">LPF</span>
        </div>
        <div class="knob-wrap">
          <input id="delay" type="range" class="knob" min="0" max="100" step="1" value="38" aria-label="delay mix" style="--kcolor:#6fe3bd" />
          <span class="label">delay</span>
          <span id="delayVal" class="readout num text-sm font-bold">DLY</span>
        </div>
      </div>
      <div class="mt-4 flex lg:flex-col flex-row gap-2">
        <button id="random" class="tbtn random-btn flex-1">◈ RANDOM</button>
        <button id="clear" class="tbtn danger flex-1">CLEAR</button>
      </div>
      <div class="label mt-3 hidden lg:block">keys<br/><span class="kbd">R</span> groove &nbsp;<span class="kbd">[</span><span class="kbd">]</span> bpm<br/><span class="kbd">-</span><span class="kbd">=</span> swing &nbsp;<span class="kbd">P</span> play</div>
    </section>
  </main>

  <footer class="terminal-panel mt-3 px-4 py-3">
    <div id="log" role="status" aria-live="polite" class="log-line text-[13px] text-dim">
      <span class="prompt">▸</span> booted. tap pads or press 1–4 · toggle steps · P to play.
    </div>
  </footer>
</div>`;

// Tailwind v4 has no grid-cols-16 by default — define via inline style below
for (const id of ["stepnums", "grid"]) {
  const el = document.getElementById(id) as HTMLDivElement;
  el.style.display = "grid";
  el.style.gridTemplateColumns = "repeat(16, minmax(0, 1fr))";
  el.style.gap = "4px";
}

const playBtn = document.getElementById("play") as HTMLButtonElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const gridEl = document.getElementById("grid") as HTMLDivElement;
const numsEl = document.getElementById("stepnums") as HTMLDivElement;
const hitEl = document.getElementById("hitCount") as HTMLSpanElement;
const padsEl = document.getElementById("pads") as HTMLDivElement;

function log(msg: string, ok = false): void {
  logEl.innerHTML = "";
  const p = document.createElement("span");
  p.className = "prompt";
  p.textContent = "▸ ";
  const m = document.createElement("span");
  m.textContent = msg;
  if (ok) m.className = "log-ok";
  logEl.append(p, m);
}

/* cells + numbers */
const cells: HTMLButtonElement[][] = [];
const nums: HTMLDivElement[] = [];

for (let s = 0; s < STEPS; s++) {
  const n = document.createElement("div");
  n.className = "stepnum num" + (s % 4 === 0 ? " downbeat" : "");
  n.textContent = String(s + 1).padStart(2, "0");
  if (s % 4 === 0 && s !== 0) n.style.marginLeft = "6px";
  numsEl.appendChild(n);
  nums.push(n);
}

VOICES.forEach((v, vi) => {
  cells[vi] = [];
  for (let s = 0; s < STEPS; s++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell" + (s % 4 === 0 ? " beat" : "") + ` vrow-${vi}`;
    if (s % 4 === 0 && s !== 0) b.style.marginLeft = "6px";
    b.style.setProperty("--accent", v.color);
    b.style.setProperty("--glow", v.glow);
    b.setAttribute("aria-pressed", state.pattern[vi][s] ? "true" : "false");
    b.setAttribute("aria-label", `${v.name} step ${s + 1}`);
    if (state.pattern[vi][s]) b.classList.add("on");
    b.addEventListener("click", () => {
      const turnedOn = !state.pattern[vi][s];
      toggleCell(vi, s);
      if (turnedOn && !state.playing) {
        ensureCtx();
        triggerVoice(v.id, (ctx as AudioContext).currentTime);
      }
    });
    b.addEventListener("keydown", (e) => {
      const move = (dvi: number, ds: number): void => {
        const nvi = clamp(vi + dvi, 0, VOICES.length - 1);
        const ns = clamp(s + ds, 0, STEPS - 1);
        cells[nvi][ns].focus();
      };
      if (e.key === "ArrowRight") { e.preventDefault(); move(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(1, 0); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1, 0); }
    });
    gridEl.appendChild(b);
    cells[vi].push(b);
  }
});

function refreshHits(): void {
  let hits = 0;
  for (const row of state.pattern) for (const on of row) if (on) hits++;
  hitEl.textContent = `${hits} hits`;
}

function toggleCell(vi: number, s: number): void {
  state.pattern[vi][s] = !state.pattern[vi][s];
  cells[vi][s].classList.toggle("on", state.pattern[vi][s]);
  cells[vi][s].setAttribute("aria-pressed", state.pattern[vi][s] ? "true" : "false");
  refreshHits();
  save();
  if (state.pattern[vi][s]) log(`${VOICES[vi].name} ON @${String(s + 1).padStart(2, "0")}`);
}

/* voice pads */
const padBtns: HTMLButtonElement[] = [];
VOICES.forEach((v, vi) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "voice-pad";
  b.style.setProperty("border-left", `3px solid ${v.color}`);
  b.setAttribute("aria-label", `audition ${v.name} (key ${v.key})`);
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.style.background = v.color;
  chip.style.boxShadow = `0 0 8px ${v.glow}`;
  const nm = document.createElement("span");
  nm.className = "vname";
  nm.textContent = v.name;
  const k = document.createElement("span");
  k.className = "vkey";
  k.textContent = v.key;
  b.append(chip, nm, k);
  b.addEventListener("click", () => audition(vi, b));
  padsEl.appendChild(b);
  padBtns.push(b);
});

function audition(vi: number, btn?: HTMLButtonElement): void {
  ensureCtx();
  triggerVoice(VOICES[vi].id, (ctx as AudioContext).currentTime);
  const el = btn ?? padBtns[vi];
  el.classList.remove("hit");
  void el.offsetWidth;
  el.classList.add("hit");
}

/* transport + faders */
const bpmEl = document.getElementById("bpm") as HTMLInputElement;
const swingEl = document.getElementById("swing") as HTMLInputElement;
const bpmVal = document.getElementById("bpmVal") as HTMLSpanElement;
const swingVal = document.getElementById("swingVal") as HTMLSpanElement;

function paintFader(el: HTMLInputElement): void {
  const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
  el.style.setProperty("--p", `${pct}%`);
}

function setBpm(v: number, announce = false): void {
  state.bpm = clamp(Math.round(v), 60, 180);
  bpmEl.value = String(state.bpm);
  bpmVal.textContent = String(state.bpm);
  paintFader(bpmEl);
  if (ctx && delayNode) delayNode.delayTime.setTargetAtTime(stepDur() * 3, ctx.currentTime, 0.03);
  if (announce) {
    bpmVal.classList.remove("tick");
    void bpmVal.offsetWidth;
    bpmVal.classList.add("tick");
    log(`tempo ▸ ${state.bpm} BPM`);
  }
  save();
}

function setSwing(v: number, announce = false): void {
  state.swing = clamp(Math.round(v), 50, 75);
  swingEl.value = String(state.swing);
  swingVal.textContent = `${state.swing}%`;
  paintFader(swingEl);
  if (announce) log(`swing ▸ ${state.swing}%`);
  save();
}

playBtn.addEventListener("click", togglePlay);
bpmEl.addEventListener("input", () => setBpm(Number(bpmEl.value)));
swingEl.addEventListener("input", () => setSwing(Number(swingEl.value)));

/* knobs */
const cutoffEl = document.getElementById("cutoff") as HTMLInputElement;
const delayEl = document.getElementById("delay") as HTMLInputElement;
const cutoffVal = document.getElementById("cutoffVal") as HTMLSpanElement;
const delayVal = document.getElementById("delayVal") as HTMLSpanElement;

function paintKnob(el: HTMLInputElement): void {
  const v = Number(el.value);
  el.style.setProperty("--sweep", `${(v / 100) * 270}deg`);
  el.style.setProperty("--rot", `${-135 + (v / 100) * 270}deg`);
}

function fmtHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz}Hz`;
}

function setCutoff(v: number, announce = false): void {
  state.cutoff = clamp(Math.round(v), 0, 100);
  cutoffEl.value = String(state.cutoff);
  paintKnob(cutoffEl);
  const hz = cutoffHz(state.cutoff);
  cutoffVal.textContent = fmtHz(hz);
  if (ctx && filter) filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02);
  if (announce) log(`filter ▸ ${fmtHz(hz)}`);
  save();
}

function setDelayMix(v: number, announce = false): void {
  state.delayMix = clamp(Math.round(v), 0, 100);
  delayEl.value = String(state.delayMix);
  paintKnob(delayEl);
  delayVal.textContent = `${state.delayMix}%`;
  if (ctx && wetGain) {
    wetGain.gain.setTargetAtTime(state.delayMix / 100 * 0.6, ctx.currentTime, 0.02);
  }
  if (announce) log(`delay ▸ ${state.delayMix}%`);
  save();
}

cutoffEl.addEventListener("input", () => setCutoff(Number(cutoffEl.value)));
delayEl.addEventListener("input", () => setDelayMix(Number(delayEl.value)));
cutoffEl.addEventListener("change", () => setCutoff(Number(cutoffEl.value), true));
delayEl.addEventListener("change", () => setDelayMix(Number(delayEl.value), true));

/* random groove + clear */
const randomBtn = document.getElementById("random") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;

function rnd(p: number): boolean {
  return Math.random() < p;
}

function randomGroove(): void {
  gridEl.classList.remove("grid-scrambling");
  void gridEl.offsetWidth;
  const p: boolean[][] = [[], [], [], []];
  // kick: anchor downbeats, ghost offbeats
  for (let s = 0; s < STEPS; s++) {
    p[0][s] = s % 4 === 0 ? true : rnd(s % 2 === 0 ? 0.14 : 0.3);
  }
  // snare: backbeat + rare extra
  for (let s = 0; s < STEPS; s++) {
    p[1][s] = s === 4 || s === 12 ? true : rnd(0.05);
  }
  // hat: 8ths guaranteed, 16ths coin-flip
  for (let s = 0; s < STEPS; s++) {
    p[2][s] = s % 2 === 0 ? true : rnd(0.45);
  }
  // bass: sparse syncopation leaning on off-downbeats
  for (let s = 0; s < STEPS; s++) {
    p[3][s] = s === 0 ? rnd(0.9) : rnd(s % 4 === 2 ? 0.3 : 0.12);
  }
  state.pattern = p;
  for (let vi = 0; vi < 4; vi++) {
    for (let s = 0; s < STEPS; s++) {
      cells[vi][s].classList.toggle("on", p[vi][s]);
      cells[vi][s].setAttribute("aria-pressed", p[vi][s] ? "true" : "false");
    }
  }
  gridEl.classList.add("grid-scrambling");
  window.setTimeout(() => gridEl.classList.remove("grid-scrambling"), 500);
  refreshHits();
  save();
  let hits = 0;
  for (const row of p) for (const on of row) if (on) hits++;
  log(`groove shuffled (${hits} hits)`, true);
}

randomBtn.addEventListener("click", () => {
  ensureCtx();
  randomGroove();
});

clearBtn.addEventListener("click", () => {
  state.pattern = state.pattern.map((row) => row.map(() => false));
  for (let vi = 0; vi < 4; vi++) {
    for (let s = 0; s < STEPS; s++) {
      cells[vi][s].classList.remove("on");
      cells[vi][s].setAttribute("aria-pressed", "false");
    }
  }
  refreshHits();
  save();
  log("grid cleared");
});

/* playhead */
function setNow(s: number): void {
  if (s === shownStep) return;
  shownStep = s;
  for (let i = 0; i < STEPS; i++) {
    nums[i].classList.toggle("now", i === s);
    for (let vi = 0; vi < 4; vi++) cells[vi][i].classList.toggle("now", i === s);
  }
}

function raf(): void {
  if (state.playing && ctx) {
    const now = ctx.currentTime;
    while (pending.length && pending[0].time <= now + 0.001) {
      const p = pending.shift() as Pending;
      setNow(p.step);
    }
    if (pending.length > 64) pending.splice(0, pending.length - 64);
  }
  requestAnimationFrame(raf);
}

/* global keys — native controls keep Tab/Space/Enter/arrows; these are extras */
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  const tag = t.tagName;
  const inField = tag === "INPUT" || tag === "TEXTAREA";
  const k = e.key.toLowerCase();

  if (k >= "1" && k <= "4" && !inField) {
    e.preventDefault();
    audition(Number(k) - 1);
    return;
  }
  if (k === "p" && !inField) {
    if (tag !== "BUTTON") e.preventDefault();
    togglePlay();
    return;
  }
  if (k === "r" && !inField) {
    ensureCtx();
    randomGroove();
    return;
  }
  if (e.key === "[" && !inField) { setBpm(state.bpm - 4, true); return; }
  if (e.key === "]" && !inField) { setBpm(state.bpm + 4, true); return; }
  if ((e.key === "-" || k === "-") && !inField) { setSwing(state.swing - 1, true); return; }
  if ((e.key === "=" || k === "=") && !inField) { setSwing(state.swing + 1, true); return; }
  if (e.key === " " && tag !== "BUTTON" && !inField) {
    e.preventDefault();
    togglePlay();
  }
});

/* persistence */
let saveT: number | null = null;
function save(): void {
  if (saveT !== null) window.clearTimeout(saveT);
  saveT = window.setTimeout(() => {
    const s: Saved = {
      pattern: state.pattern,
      bpm: state.bpm,
      swing: state.swing,
      cutoff: state.cutoff,
      delayMix: state.delayMix,
    };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      /* storage full/blocked — groove keeps playing */
    }
  }, 250);
}

/* init visuals from state */
setBpm(state.bpm);
setSwing(state.swing);
setCutoff(state.cutoff);
setDelayMix(state.delayMix);
refreshHits();
requestAnimationFrame(raf);
