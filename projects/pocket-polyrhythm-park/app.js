// Pocket Polyrhythm Park — PPP/01
// Swiss grid polyrhythm toy. ONE interaction type: click. No drag, no typing.
// Three lanes (4 / 3 / 5) sharing one 8th-note pulse; WebAudio synth voices.

const BPM_MIN = 60;
const BPM_MAX = 180;
const STORE_KEY = "ppp01-state";

const DEFAULTS = {
  bpm: 112,
  lanes: [
    { name: "KICK", voice: "SINE DROP", len: 4, steps: [1, 0, 0, 0], on: true },
    { name: "SNARE", voice: "NOISE SNAP", len: 3, steps: [0, 0, 1], on: true },
    { name: "HAT", voice: "STEEL TICK", len: 5, steps: [1, 0, 1, 0, 1], on: true },
  ],
};

const state = load();
let playing = false;
let morph = false;
let morphBase = state.bpm;

// ——— audio ———
let ac = null;
let master = null;
let noiseBuf = null;
let timerId = 0;
let tick = 0;
let nextTime = 0;
const uiQueue = []; // {time, lane, idx, sounded}

function ensureAudio() {
  if (ac) {
    if (ac.state === "suspended") ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = new AC();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 8;
  comp.connect(ac.destination);
  master = ac.createGain();
  master.gain.value = 0.85;
  master.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function stepDur() {
  return 60 / state.bpm / 2; // 8th-note pulse
}

function vKick(t) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.26);
}

function vSnare(t) {
  const n = ac.createBufferSource();
  n.buffer = noiseBuf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp).connect(g).connect(master);
  n.start(t);
  n.stop(t + 0.18);
  const o = ac.createOscillator();
  const g2 = ac.createGain();
  o.type = "triangle";
  o.frequency.value = 196;
  g2.gain.setValueAtTime(0.35, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g2).connect(master);
  o.start(t);
  o.stop(t + 0.1);
}

function vHat(t) {
  const n = ac.createBufferSource();
  n.buffer = noiseBuf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7200;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
  n.connect(hp).connect(g).connect(master);
  n.start(t);
  n.stop(t + 0.07);
}

const VOICES = [vKick, vSnare, vHat];

function schedule() {
  while (nextTime < ac.currentTime + 0.14) {
    const t = nextTime;
    state.lanes.forEach((lane, li) => {
      const idx = tick % lane.len;
      const sounded = Boolean(lane.on && lane.steps[idx]);
      if (sounded) VOICES[li](t);
      uiQueue.push({ time: t, lane: li, idx, sounded });
      if (uiQueue.length > 96) uiQueue.splice(0, uiQueue.length - 96);
    });
    nextTime += stepDur();
    tick++;
  }
}

function start() {
  ensureAudio();
  playing = true;
  tick = 0;
  nextTime = ac.currentTime + 0.08;
  timerId = setInterval(schedule, 25);
  playBtn.setAttribute("aria-pressed", "true");
  playLabel.textContent = "STOP";
  playIcon.innerHTML = "&#9632;";
  requestAnimationFrame(paint);
}

function stop() {
  playing = false;
  clearInterval(timerId);
  uiQueue.length = 0;
  playBtn.setAttribute("aria-pressed", "false");
  playLabel.textContent = "PLAY";
  playIcon.innerHTML = "&#9654;";
  document.querySelectorAll(".cell.now").forEach((c) => c.classList.remove("now"));
}

// ——— dom ———
const lanesEl = document.getElementById("lanes");
const playBtn = document.getElementById("playBtn");
const playLabel = document.getElementById("playLabel");
const playIcon = document.querySelector(".play__icon");
const bpmNum = document.getElementById("bpmNum");
const tempoTrack = document.getElementById("tempoTrack");
const tempoFill = document.getElementById("tempoFill");
const tempoKnob = document.getElementById("tempoKnob");
const morphBtn = document.getElementById("morphBtn");
const gridMsg = document.getElementById("gridMsg");
const linkBox = document.getElementById("linkBox");
const linkMsg = document.getElementById("linkMsg");

function buildLanes() {
  lanesEl.innerHTML = "";
  state.lanes.forEach((lane, li) => {
    const sec = document.createElement("div");
    sec.className = "lane" + (lane.on ? "" : " lane--off");
    const head = document.createElement("div");
    head.className = "lane__head";
    const idx = document.createElement("span");
    idx.className = "lane__idx";
    idx.textContent = "0" + (li + 1);
    const nm = document.createElement("span");
    nm.textContent = lane.name;
    const vv = document.createElement("span");
    vv.className = "lane__voice";
    vv.textContent = lane.voice;
    const ln = document.createElement("span");
    ln.className = "lane__len";
    ln.textContent = "\u00D7" + lane.len;
    const tg = document.createElement("button");
    tg.className = "layer";
    tg.setAttribute("aria-pressed", String(lane.on));
    tg.textContent = lane.on ? "LAYER ON" : "LAYER OFF";
    tg.setAttribute("aria-label", lane.name + " layer on or off");
    tg.addEventListener("click", () => {
      ensureAudio();
      lane.on = !lane.on;
      persist();
      buildLanes();
      refreshLink();
      flash(gridMsg, lane.name + (lane.on ? " LAYER IN" : " LAYER OUT"));
    });
    head.append(idx, nm, vv, ln, tg);
    const cells = document.createElement("div");
    cells.className = "lane__cells";
    cells.style.gridTemplateColumns = "repeat(" + lane.len + ", 1fr)";
    lane.steps.forEach((v, si) => {
      const b = document.createElement("button");
      b.className = "cell";
      b.dataset.lane = String(li);
      b.dataset.idx = String(si);
      b.setAttribute("aria-pressed", String(Boolean(v)));
      b.setAttribute("aria-label", lane.name + " step " + (si + 1));
      b.innerHTML = '<span class="n">' + (si + 1) + "</span>" + (v ? "\u25A0" : "");
      b.addEventListener("click", () => {
        ensureAudio();
        lane.steps[si] = lane.steps[si] ? 0 : 1;
        if (lane.steps[si]) blip(li);
        persist();
        buildLanes();
        refreshLink();
      });
      cells.appendChild(b);
    });
    sec.append(head, cells);
    lanesEl.appendChild(sec);
  });
}

function blip(li) {
  // instant audition click so taps feel alive even when stopped
  const t = ac.currentTime + 0.01;
  VOICES[li](t);
}

function paint() {
  if (!playing) return;
  const now = ac.currentTime;
  while (uiQueue.length && uiQueue[0].time <= now + 0.005) {
    const ev = uiQueue.shift();
    document
      .querySelectorAll('.cell[data-lane="' + ev.lane + '"]')
      .forEach((c) => c.classList.remove("now"));
    const sel = '.cell[data-lane="' + ev.lane + '"][data-idx="' + ev.idx + '"]';
    const cell = document.querySelector(sel);
    if (cell) {
      cell.classList.add("now");
      if (ev.sounded) {
        cell.classList.remove("hit");
        void cell.offsetWidth;
        cell.classList.add("hit");
      }
    }
  }
  if (morph) {
    const span = 10;
    state.bpm = clamp(Math.round(morphBase + Math.sin(now * 0.6) * span), BPM_MIN, BPM_MAX);
    renderTempo();
  }
  requestAnimationFrame(paint);
}

// ——— tempo (click-only track: press to jump, never drag) ———
function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function renderTempo() {
  bpmNum.textContent = String(state.bpm);
  const frac = (state.bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
  tempoFill.style.width = frac * 100 + "%";
  tempoKnob.style.left = frac * 100 + "%";
}

function setTempoFromEvent(e) {
  const r = tempoTrack.getBoundingClientRect();
  const x = "touches" in e && e.touches.length ? e.touches[0].clientX : e.clientX;
  const frac = clamp((x - r.left) / r.width, 0, 1);
  state.bpm = Math.round(BPM_MIN + frac * (BPM_MAX - BPM_MIN));
  morphBase = state.bpm;
  persist();
  renderTempo();
  refreshLink();
}

tempoTrack.addEventListener("click", setTempoFromEvent);
tempoTrack.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    state.bpm = state.bpm >= BPM_MAX ? BPM_MIN : state.bpm + 4;
    morphBase = state.bpm;
    persist();
    renderTempo();
    refreshLink();
  }
});

document.querySelectorAll(".preset").forEach((b) => {
  b.addEventListener("click", () => {
    state.bpm = Number(b.dataset.bpm);
    morphBase = state.bpm;
    persist();
    renderTempo();
    refreshLink();
    flash(gridMsg, "TEMPO " + state.bpm + " BPM");
  });
});

morphBtn.addEventListener("click", () => {
  morph = !morph;
  morphBase = state.bpm;
  morphBtn.setAttribute("aria-pressed", String(morph));
  morphBtn.textContent = morph ? "MORPH: ON" : "MORPH: OFF";
  flash(gridMsg, morph ? "TEMPO DRIFT ENGAGED" : "TEMPO LOCKED");
});

// ——— transport / tools ———
playBtn.addEventListener("click", () => {
  if (playing) stop();
  else start();
});

document.getElementById("diceBtn").addEventListener("click", () => {
  ensureAudio();
  state.lanes.forEach((lane) => {
    const density = 0.35 + Math.random() * 0.3;
    lane.steps = lane.steps.map(() => (Math.random() < density ? 1 : 0));
    if (!lane.steps.some(Boolean)) {
      lane.steps[Math.floor(Math.random() * lane.len)] = 1;
    }
    lane.on = true;
  });
  persist();
  buildLanes();
  refreshLink();
  flash(gridMsg, "NEW GROOVE PLANTED");
});

document.getElementById("clearBtn").addEventListener("click", () => {
  state.lanes.forEach((lane) => {
    lane.steps = lane.steps.map(() => 0);
  });
  persist();
  buildLanes();
  refreshLink();
  flash(gridMsg, "PARK SWEPT CLEAN");
});

// ——— share link + persistence ———
function encode() {
  const pat = state.lanes.map((l) => l.steps.join("")).join(".");
  const on = state.lanes.map((l) => (l.on ? "1" : "0")).join("");
  return "#g=" + state.bpm + "." + pat + "." + on;
}

function decode(hash) {
  const m = hash.match(/^#g=(\d{2,3})\.([01.]+)\.([01]{3})$/);
  if (!m) return null;
  const bpm = clamp(Number(m[1]), BPM_MIN, BPM_MAX);
  const parts = m[2].split(".");
  if (parts.length !== DEFAULTS.lanes.length) return null;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length !== DEFAULTS.lanes[i].len) return null;
  }
  return {
    bpm,
    lanes: DEFAULTS.lanes.map((d, i) => ({
      name: d.name,
      voice: d.voice,
      len: d.len,
      steps: parts[i].split("").map(Number),
      on: m[3][i] === "1",
    })),
  };
}

function refreshLink() {
  const url = location.origin === "null" || location.protocol === "file:"
    ? location.href.split("#")[0] + encode()
    : location.href.split("#")[0] + encode();
  linkBox.textContent = url;
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (_) {
    /* pocket stays pocket */
  }
  if ("replaceState" in history) {
    history.replaceState(null, "", encode());
  }
}

function load() {
  const fromHash = decode(location.hash || "");
  if (fromHash) return fromHash;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.bpm === "number" && Array.isArray(s.lanes) && s.lanes.length === 3) {
        return s;
      }
    }
  } catch (_) {
    /* fall through to defaults */
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function flash(el, msg) {
  el.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => {
    el.textContent = "";
  }, 1800);
}

async function copyLink() {
  refreshLink();
  const url = linkBox.textContent;
  try {
    await navigator.clipboard.writeText(url);
    flash(linkMsg, "LINK COPIED \u2713");
  } catch (_) {
    // file:// contexts may block clipboard: select-free fallback message
    flash(linkMsg, "COPY BLOCKED — LINK ABOVE IS READY");
  }
}

document.getElementById("copyBtn").addEventListener("click", copyLink);
linkBox.addEventListener("click", copyLink);

// ——— init ———
morphBase = state.bpm;
buildLanes();
renderTempo();
refreshLink();
