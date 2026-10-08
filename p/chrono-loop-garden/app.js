// Chrono Loop Garden — drag-only generative time garden.
// Single interaction type: DRAG (pointerdown + pointermove + pointerup only).
//   - drag across soil ......... plants time-seeds (one per cell entered)
//   - drag sideways on a bloom . rewinds its loop + shrinks its bloom
//   - rewind past zero ......... uproots the seed
//   - drag releases over rail .. exports the garden as a chime (WAV)
// Loops evolve automatically every 60s. Sound wakes on first drag.

const COLS = 8;
const ROWS = 8;
const EVOLVE_MS = 60_000;
const STORE_KEY = "chrono-loop-garden-v1";
// High row = high pitch. A-minor pentatonic lane, E4..A5.
const ROW_NOTES = [81, 79, 76, 74, 72, 69, 67, 64];
const SCALE_STEPS = [-2, -1, 1, 2];

const grid = document.getElementById("grid");
const rail = document.getElementById("rail");
const genEl = document.getElementById("gen");
const clockEl = document.getElementById("clock");
const voicesEl = document.getElementById("voices");
const chimeEl = document.getElementById("chime");
const toastEl = document.getElementById("toast");

// ---------- state ----------
let seeds = new Map(); // "x,y" -> seed
let gen = 0;
let nextEvolve = Date.now() + EVOLVE_MS;
let drag = null; // active drag stroke
let toastTimer = 0;

function key(x, y) { return x + "," + y; }
function periodFor(x, y) { return 3 + (x % 4) * 1.5 + y * 0.25; }
function midiFor(y) { return ROW_NOTES[Math.max(0, Math.min(7, y))]; }

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      gen,
      seeds: [...seeds.values()].map((s) => ({ x: s.x, y: s.y, midi: s.midi, period: s.period, phase: s.phase, bloom: s.bloom })),
    }));
  } catch (_) { /* private mode — garden simply forgets */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    gen = data.gen | 0;
    for (const s of data.seeds || []) {
      if (s.x >= 0 && s.x < COLS && s.y >= 0 && s.y < ROWS && !seeds.has(key(s.x, s.y))) {
        seeds.set(key(s.x, s.y), { x: s.x, y: s.y, midi: s.midi, period: s.period, phase: s.phase || 0, bloom: s.bloom ?? 0.3 });
      }
    }
  } catch (_) { /* start wild */ }
}

// ---------- audio ----------
let actx = null;
let master = null;
let echo = null;

function ensureAudio() {
  if (actx) {
    if (actx.state === "suspended") actx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.5;
  const comp = actx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(actx.destination);
  // sparse dub echo — the garden's air
  const delay = actx.createDelay(1.0);
  delay.delayTime.value = 0.42;
  const fb = actx.createGain();
  fb.gain.value = 0.34;
  const damp = actx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 1800;
  echo = actx.createGain();
  echo.gain.value = 0.5;
  echo.connect(delay);
  delay.connect(damp);
  damp.connect(fb);
  fb.connect(delay);
  damp.connect(master);
}

function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function pluck(midi, when, dest, panValue) {
  const t = when;
  const osc1 = actx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = midiHz(midi);
  const osc2 = actx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = midiHz(midi) * 2;
  const g2 = actx.createGain();
  g2.gain.value = 0.18;
  const env = actx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  const pan = actx.createStereoPanner ? actx.createStereoPanner() : null;
  if (pan) {
    pan.pan.value = panValue;
    osc1.connect(env);
    osc2.connect(g2);
    g2.connect(env);
    env.connect(pan);
    pan.connect(dest);
    pan.connect(echo);
  } else {
    osc1.connect(env);
    osc2.connect(g2);
    g2.connect(env);
    env.connect(dest);
    env.connect(echo);
  }
  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 2.6);
  osc2.stop(t + 2.6);
}

// ---------- dom ----------
const cells = [];
function buildGrid() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const d = document.createElement("div");
      d.className = "cell";
      d.dataset.x = x;
      d.dataset.y = y;
      d.innerHTML = '<span class="ring"></span><span class="hand"></span><span class="dot"></span><span class="strike"></span><span class="ghost"></span>';
      grid.appendChild(d);
      cells.push(d);
    }
  }
}
function cellAt(x, y) { return cells[y * COLS + x]; }

function cellFromPoint(cx, cy) {
  const r = grid.getBoundingClientRect();
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
  const x = Math.max(0, Math.min(COLS - 1, Math.floor(((cx - r.left) / r.width) * COLS)));
  const y = Math.max(0, Math.min(ROWS - 1, Math.floor(((cy - r.top) / r.height) * ROWS)));
  return { x, y };
}

function overRail(cx, cy) {
  const r = rail.getBoundingClientRect();
  return cy >= r.top - 14 && cy <= r.bottom + 14 && cx >= r.left - 20 && cx <= r.right + 20;
}

// ---------- garden ops ----------
function plant(x, y) {
  const k = key(x, y);
  if (seeds.has(k)) return false;
  seeds.set(k, { x, y, midi: midiFor(y), period: periodFor(x, y), phase: (x / COLS + y / ROWS) % 1, bloom: 0.15 });
  const c = cellAt(x, y);
  c.classList.add("sown");
  if (actx) pluck(seeds.get(k).midi, actx.currentTime, master, panFor(x));
  persist();
  refreshVoices();
  return true;
}

function panFor(x) { return (x / (COLS - 1)) * 1.6 - 0.8; }

function uproot(seed) {
  seeds.delete(key(seed.x, seed.y));
  const c = cellAt(seed.x, seed.y);
  c.classList.remove("sown", "rewinding");
  persist();
  refreshVoices();
  toast("uprooted · " + seeds.size + " voice" + (seeds.size === 1 ? "" : "s") + " left");
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function refreshVoices() {
  voicesEl.textContent = seeds.size + " voice" + (seeds.size === 1 ? "" : "s");
  genEl.textContent = "gen " + String(gen).padStart(2, "0");
}

function evolve() {
  gen++;
  nextEvolve = Date.now() + EVOLVE_MS;
  for (const s of seeds.values()) {
    if (Math.random() < 0.45) {
      const step = SCALE_STEPS[(Math.random() * SCALE_STEPS.length) | 0];
      s.midi = Math.max(48, Math.min(88, s.midi + step));
    }
    s.period = Math.max(2, Math.min(9, s.period * (0.94 + Math.random() * 0.12)));
    s.bloom = Math.min(1, s.bloom + 0.1);
  }
  refreshVoices();
  persist();
  toast(seeds.size ? "generation " + gen + " · loops evolved" : "generation " + gen + " · soil rests");
}

// ---------- THE one gesture: drag ----------
grid.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  ensureAudio();
  try { grid.setPointerCapture(e.pointerId); } catch (_) {}
  const cell = cellFromPoint(e.clientX, e.clientY);
  drag = {
    id: e.pointerId,
    mode: null, seed: null, visited: new Set(),
    lastX: e.clientX, wound: 0,
  };
  if (cell) {
    const s = seeds.get(key(cell.x, cell.y));
    if (s) {
      drag.mode = "rewind";
      drag.seed = s;
      cellAt(cell.x, cell.y).classList.add("rewinding");
    } else {
      drag.mode = "plant";
      drag.visited.add(key(cell.x, cell.y));
      if (plant(cell.x, cell.y) && seeds.size === 1) toast("first seed · it chimes each revolution");
    }
  } else {
    drag.mode = "plant";
  }
});

grid.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  e.preventDefault();
  // rail arming preview while dragging
  rail.classList.toggle("armed", overRail(e.clientX, e.clientY) && seeds.size > 0);
  if (drag.mode === "plant") {
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell) {
      const k = key(cell.x, cell.y);
      if (!drag.visited.has(k)) {
        drag.visited.add(k);
        plant(cell.x, cell.y);
      }
    }
  } else if (drag.mode === "rewind" && drag.seed) {
    const dx = e.clientX - drag.lastX;
    drag.lastX = e.clientX;
    const s = drag.seed;
    s.phase -= dx / 260; // drag sideways → time flows backwards
    drag.wound += Math.abs(dx) / 260;
    s.bloom = Math.max(0, s.bloom - Math.abs(dx) / 1600);
    if (s.phase < 0) s.phase += Math.ceil(-s.phase);
    if (s.phase >= 1) s.phase %= 1;
    if (s.bloom <= 0 && drag.wound > 1.2) {
      const gone = s;
      drag.mode = "spent";
      drag.seed = null;
      uproot(gone);
    }
  }
});

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  if (drag.seed) {
    const c = cellAt(drag.seed.x, drag.seed.y);
    if (c) c.classList.remove("rewinding");
    if (drag.mode === "rewind" && drag.wound > 0.08) {
      toast("rewound " + drag.wound.toFixed(1) + " loops");
      persist();
    }
  }
  const releaseOverRail = e && overRail(e.clientX, e.clientY);
  const wasStroke = drag.visited.size > 0 || drag.wound > 0.05 || drag.mode === "spent";
  drag = null;
  rail.classList.remove("armed");
  if (releaseOverRail && wasStroke && seeds.size > 0) exportChime();
}

grid.addEventListener("pointerup", endDrag);
grid.addEventListener("pointercancel", () => endDrag(null));

// rail never listens for presses — export fires only from a drag release above.
// (no press/tap handlers exist anywhere in this file by design.)

// ---------- export garden as chime (WAV) ----------
function gardenCode() {
  const body = [...seeds.values()]
    .map((s) => s.x.toString(36) + s.y.toString(36) + s.midi.toString(36))
    .sort()
    .join("-");
  return "CLG·g" + gen + "·" + body;
}

async function exportChime() {
  rail.classList.add("exporting");
  setTimeout(() => rail.classList.remove("exporting"), 750);
  const code = gardenCode();
  chimeEl.textContent = code;
  chimeEl.classList.add("struck");
  try {
    const seconds = 8;
    const rate = 22050;
    const off = new OfflineAudioContext(2, seconds * rate, rate);
    const dest = off.createGain();
    dest.gain.value = 0.6;
    dest.connect(off.destination);
    const dly = off.createDelay(1);
    dly.delayTime.value = 0.42;
    const fb = off.createGain();
    fb.gain.value = 0.34;
    const wet = off.createGain();
    wet.gain.value = 0.4;
    dest.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);
    wet.connect(off.destination);
    for (const s of seeds.values()) {
      let t = (1 - (s.phase % 1)) * s.period * 0.5;
      while (t < seconds) {
        renderPluck(off, s.midi, t, dest, panFor(s.x));
        t += s.period;
      }
    }
    const buf = await off.startRendering();
    const blob = encodeWav(buf);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chrono-garden-chime-g" + gen + ".wav";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
    toast("garden exported as chime · " + seeds.size + " voices");
  } catch (_) {
    toast(code);
  }
  persist();
}

function renderPluck(off, midi, t, dest, panValue) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const o1 = off.createOscillator();
  o1.type = "sine";
  o1.frequency.value = f;
  const o2 = off.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = f * 2;
  const g2 = off.createGain();
  g2.gain.value = 0.18;
  const env = off.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, Math.min(t + 2.4, off.length / off.sampleRate - 0.05));
  const p = off.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, panValue));
  o1.connect(env);
  o2.connect(g2);
  g2.connect(env);
  env.connect(p);
  p.connect(dest);
  o1.start(t);
  o2.start(t);
  o1.stop(t + 2.5);
  o2.stop(t + 2.5);
}

function encodeWav(buf) {
  const nCh = 2;
  const rate = buf.sampleRate;
  const len = buf.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF");
  v.setUint32(4, bytes - 8, true);
  wstr(8, "WAVE");
  wstr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * nCh * 2, true);
  v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true);
  wstr(36, "data");
  v.setUint32(40, len * nCh * 2, true);
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
  let o = 44;
  for (let i = 0; i < len; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, ch0[i])) * 32767, true);
    o += 2;
    v.setInt16(o, Math.max(-1, Math.min(1, ch1[i])) * 32767, true);
    o += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

// ---------- transport: hands, blooms, strikes, countdown ----------
let lastFrame = performance.now();
let lastClockText = "";

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  if (Date.now() >= nextEvolve) evolve();

  if (actx && actx.state === "running") {
    for (const s of seeds.values()) {
      if (drag && drag.mode === "rewind" && drag.seed === s) continue; // held by hand
      s.phase += dt / s.period;
      if (s.phase >= 1) {
        s.phase -= 1;
        pluck(s.midi, actx.currentTime, master, panFor(s.x));
        const c = cellAt(s.x, s.y);
        const strike = c.querySelector(".strike");
        strike.classList.remove("hit");
        void strike.offsetWidth;
        strike.classList.add("hit");
      }
      s.bloom = Math.min(1, s.bloom + dt / 24);
    }
  }

  // visuals
  for (const s of seeds.values()) {
    const c = cellAt(s.x, s.y);
    if (!c.classList.contains("sown")) c.classList.add("sown");
    const deg = (s.phase % 1) * 360;
    c.querySelector(".hand").style.transform = "rotate(" + deg.toFixed(1) + "deg)";
    c.querySelector(".dot").style.setProperty("--bloom", (0.4 + s.bloom * 1.6).toFixed(2));
  }

  const remain = Math.max(0, nextEvolve - Date.now());
  const mm = Math.floor(remain / 60000);
  const ss = Math.floor((remain % 60000) / 1000);
  const txt = "evolves in " + mm + ":" + String(ss).padStart(2, "0");
  if (txt !== lastClockText) {
    lastClockText = txt;
    clockEl.textContent = txt;
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
buildGrid();
restore();
refreshVoices();
for (const s of seeds.values()) cellAt(s.x, s.y).classList.add("sown");
if (!seeds.size) {
  // a starter constellation, silent until first drag wakes audio
  plantSilent(2, 5);
  plantSilent(4, 3);
  plantSilent(5, 6);
}
function plantSilent(x, y) {
  const k = key(x, y);
  if (seeds.has(k)) return;
  seeds.set(k, { x, y, midi: midiFor(y), period: periodFor(x, y), phase: (x / COLS + y / ROWS) % 1, bloom: 0.4 });
  cellAt(x, y).classList.add("sown");
}
refreshVoices();
requestAnimationFrame(frame);
