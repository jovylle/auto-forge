// Staircase Ballads — each step you climb writes a lyric.
// step counter · lyric engine · ballad archive · WebAudio on interaction.

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ *
 *  THEMES — each ballad is seeded by a weather theme. Every step      *
 *  draws a line from the theme's well.                                *
 * ------------------------------------------------------------------ */
const THEMES = [
  {
    name: "Rain", kanji: "雨",
    title: () => pick(["A Rain Ascension", "The Stair That Wept", "Umbrage Rising", "Nimbus Steps"]),
    lines: [
      "rain begins as a single step",
      "the stair is a river we climb",
      "each landing a held breath",
      "gutters sing their slow lullabies",
      "my shoes carry small weather",
      "up is the only dry direction",
      "the roof drinks the whole sky",
      "we ascend through falling water",
      "puddles keep our footprints",
      "thunder counts our rhythm",
      "the highest stair is the clearest",
      "rain on tin is applause",
    ],
  },
  {
    name: "Wind", kanji: "風",
    title: () => pick(["A Wind Ascent", "Kites of the Hallway", "The Draft Upward", "Gust & Stone"]),
    lines: [
      "wind climbs faster than I do",
      "the stairs taste of weather",
      "each step scatters the dust",
      "a draft combs the banister",
      "doors hold their breath passing",
      "we ascend on unseen currents",
      "the window exhales and inhales",
      "loose hair learns the staircase",
      "higher air is a colder friend",
      "gusts fold the silence over",
      "the landing steadies my stride",
      "I climb on borrowed wind",
    ],
  },
  {
    name: "Snow", kanji: "雪",
    title: () => pick(["A Snow Climb", "The White Stair", "Slow Drift Ascending", "Frost on Each Riser"]),
    lines: [
      "snow mutes the tread of boots",
      "each step etches the white",
      "the stair is a quiet ledger",
      "cold gathers at the risers",
      "we climb without a sound",
      "breath clouds in front of me",
      "the banister is rimed with stars",
      "up is warmer than the landing",
      "drifts soften every footprint",
      "the roof wears a new silence",
      "I am the red mark in winter",
      "the top step glows with snow",
    ],
  },
  {
    name: "Moon", kanji: "月",
    title: () => pick(["A Moonrise", "The Stair of Silver", "Night Ascending", "Pale Steps"]),
    lines: [
      "moonlight pools on each stair",
      "the night is a wide landing",
      "we climb by borrowed silver",
      "shadows steeple behind me",
      "each riser holds a dim lamp",
      "the full moon tops the stairwell",
      "stars are other people's lights",
      "quiet grows as we ascend",
      "the window frames one bright face",
      "up is a quieter country",
      "my shadow climbs with me",
      "the top step is the brightest",
    ],
  },
  {
    name: "Dusk", kanji: "夕",
    title: () => pick(["A Dusk Ascent", "The Amber Stair", "Slow Light Rising", "Ember Steps"]),
    lines: [
      "dusk lengthens on the risers",
      "amber fills each tread",
      "we climb through thinning light",
      "the west window pours gold",
      "dust turns to fire mid-step",
      "the day folds its long body",
      "up is where the light flees to",
      "lanterns hum in the distance",
      "each stair a held sunset",
      "shadows stretch down behind us",
      "the top step keeps the last glow",
      "I climb into the evening",
    ],
  },
];

const ADJ = ["slow", "steady", "hollow", "bright", "quiet", "worn", "echoing", "patient", "gentle", "lone"];
const NOUN = ["stair", "step", "riser", "landing", "tread", "banister", "threshold", "ascent", "way", "climb"];

/* ------------------------------------------------------------------ *
 *  STATE                                                              *
 * ------------------------------------------------------------------ */
const state = {
  theme: null,
  steps: 0,            // steps on the current ballad
  totalSteps: 0,       // lifetime steps across all ballads
  lines: [],           // lyrics of the current ballad
  ballads: [],         // saved archive
  muted: false,
  currentBalladId: null,
  completed: false,
};

const FLOORS = 4;
const PERFECT = 12;     // the ballad is complete at 12 lines (0..11)

const $stepNum = $("stepNum");
const $floorTag = $("floorTag");
const $stairSvg = $("stairSvg");
const $themeKanji = $("themeKanji");
const $themeName = $("themeName");
const $lyrics = $("lyrics");
const $balladTitle = $("balladTitle");
const $sheetMeta = $("sheetMeta");
const $stepBtn = $("stepBtn");
const $newBtn = $("newBtn");
const $status = $("status");
const $soundBtn = $("soundBtn");
const $archiveBtn = $("archiveBtn");
const $drawer = $("drawer");
const $drawerClose = $("drawerClose");
const $archiveList = $("archiveList");
const $veil = $("veil");
const $modal = $("modal");
const $modalClose = $("modalClose");
const $modalSeal = $("modalSeal");
const $modalLyrics = $("modalLyrics");
const $modalTitle = $("modalTitle");
const $modalDate = $("modalDate");
const $modalDelete = $("modalDelete");
const $stamp = $("stamp");

/* ------------------------------------------------------------------ *
 *  HELPERS                                                            *
 * ------------------------------------------------------------------ */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function nowStamp() { return Date.now(); }
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ------------------------------------------------------------------ *
 *  AUDIO — WebAudio, no assets                                        *
 * ------------------------------------------------------------------ */
let audioCtx = null;
function ensureCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur = 0.16, type = "sine", vol = 0.16, delay = 0) {
  if (state.muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
// a scale climbing with each step — like ascending a musical stair
const SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
function stepSound(stepIdx) {
  const base = SCALE[stepIdx % SCALE.length];
  tone(base, 0.2, "sine", 0.16);
  tone(base * 1.5, 0.24, "triangle", 0.07, 0.03);
  tone(base * 2, 0.3, "sine", 0.05, 0.06);
}
function completeSound() {
  tone(523.25, 0.5, "sine", 0.14);
  tone(659.25, 0.5, "sine", 0.14, 0.12);
  tone(783.99, 0.7, "sine", 0.14, 0.24);
}
function uiSound() {
  tone(440, 0.08, "triangle", 0.08);
}
function closeSound() {
  tone(392, 0.1, "triangle", 0.08);
}

/* ------------------------------------------------------------------ *
 *  LYRICS — the engine                                                *
 * ------------------------------------------------------------------ */
function makeLine(index) {
  const theme = state.theme;
  const pool = theme.lines;
  // guarantee a strong opening and a complete, non-repeating climb
  if (index === 0) return pool[0];
  if (index >= pool.length) {
    // improvise once the theme's well is drunk
    return pick(ADJ) + " " + pick(NOUN) + ", and still " + pick(theme.lines);
  }
  return pool[index];
}

function renderLine(i) {
  const div = document.createElement("div");
  div.className = "line";
  const span = document.createElement("span");
  span.textContent = state.lines[i];
  div.appendChild(span);
  return div;
}

function appendLyricLine() {
  const div = renderLine(state.lines.length - 1);
  div.classList.add("live");
  $lyrics.appendChild(div);
  // clear live flag after the animation so older lines settle to ink
  setTimeout(() => {
    div.classList.remove("live");
    div.classList.add("static");
    div.style.animation = "none";
  }, 700);
  $lyrics.scrollTop = $lyrics.scrollHeight;
}

function rewriteLyrics() {
  $lyrics.innerHTML = "";
  for (let i = 0; i < state.lines.length; i++) {
    const div = renderLine(i);
    div.classList.add("static");
    $lyrics.appendChild(div);
  }
  $lyrics.scrollTop = $lyrics.scrollHeight;
}

/* ------------------------------------------------------------------ *
 *  STAIR VISUAL                                                       *
 * ------------------------------------------------------------------ */
const STONES = [
  // each stone: [x, y, r] on a 420x340 viewBox
  { x: 120, y: 260, r: 30 },
  { x: 168, y: 238, r: 28 },
  { x: 210, y: 214, r: 27 },
  { x: 248, y: 190, r: 26 },
  { x: 280, y: 166, r: 25 },
  { x: 306, y: 142, r: 24 },
  { x: 328, y: 118, r: 23 },
  { x: 348, y: 94, r: 22 },
  { x: 364, y: 70, r: 21 },
  { x: 380, y: 48, r: 20 },
  { x: 394, y: 28, r: 19 },
];
let stoneEls = [];
let figEl = null;
let figShadowEl = null;

function buildStair() {
  $stairSvg.innerHTML = "";
  stoneEls = [];
  // path hint
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "stone-p");
  path.setAttribute(
    "d",
    "M120 260 C 200 250, 240 210, 280 166 C 310 134, 340 110, 394 28"
  );
  $stairSvg.appendChild(path);
  STONES.forEach((s, i) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    el.setAttribute("class", "stone future");
    el.setAttribute("cx", s.x);
    el.setAttribute("cy", s.y);
    el.setAttribute("rx", s.r);
    el.setAttribute("ry", s.r * 0.55);
    el.setAttribute("data-i", i);
    $stairSvg.appendChild(el);
    stoneEls.push(el);
  });
  // figure (a small walking silhouette)
  figShadowEl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  figShadowEl.setAttribute("class", "fig-shadow");
  figShadowEl.setAttribute("rx", "9");
  figShadowEl.setAttribute("ry", "3.4");
  $stairSvg.appendChild(figShadowEl);
  figEl = document.createElementNS("http://www.w3.org/2000/svg", "g");
  figEl.setAttribute("class", "figure");
  const body = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  body.setAttribute("cx", "0");
  body.setAttribute("cy", "-8");
  body.setAttribute("rx", "5.4");
  body.setAttribute("ry", "7");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  head.setAttribute("cx", "0");
  head.setAttribute("cy", "-18");
  head.setAttribute("r", "3.6");
  figEl.appendChild(body);
  figEl.appendChild(head);
  $stairSvg.appendChild(figEl);
  updateStair();
}

function stairPos(idx) {
  if (idx < 0) idx = 0;
  if (idx >= STONES.length) idx = STONES.length - 1;
  return STONES[idx];
}

function updateStair() {
  const n = state.steps;
  stoneEls.forEach((el, i) => {
    el.classList.remove("up", "curr", "future");
    if (i < n) el.classList.add("up");
    else if (i === n) el.classList.add("curr");
    else el.classList.add("future");
  });
  const p = stairPos(n);
  figEl.setAttribute("transform", `translate(${p.x},${p.y})`);
  figShadowEl.setAttribute("cx", p.x);
  figShadowEl.setAttribute("cy", p.y + 3.5);
  figEl.style.transition = "transform .3s cubic-bezier(.2,1.4,.3,1)";
}

/* ------------------------------------------------------------------ *
 *  FLOOR / COUNTER                                                    *
 * ------------------------------------------------------------------ */
function floorOf(steps) {
  return Math.min(FLOORS, Math.floor(steps / 3));
}
function renderCounter() {
  $stepNum.textContent = state.steps;
  $stepNum.classList.remove("bump");
  void $stepNum.offsetWidth;
  $stepNum.classList.add("bump");
  const floor = floorOf(state.steps);
  $floorTag.innerHTML = `floor <b>${floor}</b> of ${FLOORS}`;
}

/* ------------------------------------------------------------------ *
 *  BALLAD LIFECYCLE                                                   *
 * ------------------------------------------------------------------ */
function newBallad(sound = true) {
  state.theme = pick(THEMES);
  state.steps = 0;
  state.lines = [];
  state.completed = false;
  state.currentBalladId = null;

  $themeKanji.textContent = state.theme.kanji;
  $themeName.textContent = state.theme.name;
  $balladTitle.textContent = "a blank stair";
  $sheetMeta.textContent = state.theme.name + " · " + state.theme.kanji;
  $stamp.classList.remove("show");
  rewriteLyrics();
  renderCounter();
  updateStair();
  setStatus("press space to take the first step");
  if (sound) uiSound();
}

function step() {
  if (state.completed) return;
  state.steps += 1;
  state.totalSteps += 1;

  // lyric engine writes a line each step
  const idx = state.lines.length;
  state.lines.push(makeLine(idx));

  stepSound(idx);
  appendLyricLine();
  renderCounter();
  updateStair();

  // does the ballad end here?
  if (state.steps >= PERFECT) {
    state.completed = true;
    completeBallad();
  } else if (state.steps === 3 || state.steps === 6 || state.steps === 9) {
    // floor transitions
    const floor = floorOf(state.steps);
    setStatus(`you reach floor ${floor} — ${state.theme.name} deepens`);
  } else {
    const left = PERFECT - state.steps;
    setStatus(`${left} ${left === 1 ? "step" : "steps"} to the top of this ballad`);
  }
}

function completeBallad() {
  const title = state.theme.title();
  $balladTitle.textContent = title;
  $stamp.classList.add("show");
  completeSound();
  saveBallad(title);
  setStatus("the ballad is complete — saved to your archive");
}

function saveBallad(title) {
  const entry = {
    id: "b" + nowStamp(),
    title,
    theme: state.theme.name,
    kanji: state.theme.kanji,
    steps: state.steps,
    lines: [...state.lines],
    ts: nowStamp(),
  };
  state.ballads.unshift(entry);
  state.currentBalladId = entry.id;
  persist();
  renderArchive();
}

function setStatus(msg) {
  const wrap = document.createElement("span");
  wrap.textContent = msg;
  $status.innerHTML = "";
  $status.appendChild(wrap);
}

/* ------------------------------------------------------------------ *
 *  ARCHIVE                                                            *
 * ------------------------------------------------------------------ */
function persist() {
  try {
    localStorage.setItem("staircase-ballads", JSON.stringify({
      ballads: state.ballads,
      totalSteps: state.totalSteps,
      muted: state.muted,
    }));
  } catch (e) { /* ignore quota */ }
}

function load() {
  try {
    const raw = localStorage.getItem("staircase-ballads");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.ballads)) state.ballads = data.ballads;
    if (typeof data.totalSteps === "number") state.totalSteps = data.totalSteps;
    if (typeof data.muted === "boolean") state.muted = data.muted;
  } catch (e) { /* ignore */ }
}

function renderArchive() {
  $archiveList.innerHTML = "";
  if (!state.ballads.length) {
    const li = document.createElement("li");
    li.className = "arc-empty";
    li.textContent = "no ballads yet.\nclimb a stair, and a verse will keep for you.";
    $archiveList.appendChild(li);
    return;
  }
  state.ballads.forEach((b) => {
    const li = document.createElement("li");
    li.className = "arc-card";
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.addEventListener("click", () => openModal(b));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(b); }
    });

    const kanji = document.createElement("span");
    kanji.className = "arc-kanji";
    kanji.textContent = b.kanji;
    const info = document.createElement("div");
    info.className = "arc-info";
    const t = document.createElement("div");
    t.className = "arc-title";
    t.textContent = b.title;
    const m = document.createElement("div");
    m.className = "arc-meta";
    m.textContent = `${b.theme} · ${b.steps} steps · ${fmtDate(b.ts)}`;
    info.appendChild(t);
    info.appendChild(m);
    const arrow = document.createElement("span");
    arrow.className = "arc-arrow";
    arrow.textContent = "→";
    li.appendChild(kanji);
    li.appendChild(info);
    li.appendChild(arrow);
    $archiveList.appendChild(li);
  });
}

function openModal(b) {
  $modalTitle.textContent = b.title;
  $modalDate.textContent = `${b.theme} · ${b.steps} steps · ${fmtDate(b.ts)}`;
  $modalSeal.textContent = b.kanji;
  $modalLyrics.innerHTML = "";
  b.lines.forEach((l) => {
    const div = document.createElement("div");
    div.className = "m-line";
    div.textContent = l;
    $modalLyrics.appendChild(div);
  });
  $modal.dataset.id = b.id;
  $modal.classList.add("show");
  uiSound();
}
function closeModal() {
  $modal.classList.remove("show");
  closeSound();
}
function deleteCurrent() {
  const id = $modal.dataset.id;
  state.ballads = state.ballads.filter((b) => b.id !== id);
  persist();
  renderArchive();
  closeModal();
}

function openDrawer() {
  $drawer.classList.add("show");
  $veil.classList.add("show");
  uiSound();
}
function closeDrawer() {
  $drawer.classList.remove("show");
  $veil.classList.remove("show");
  closeSound();
}

/* ------------------------------------------------------------------ *
 *  SOUND TOGGLE                                                       *
 * ------------------------------------------------------------------ */
function renderSound() {
  $soundBtn.classList.toggle("muted", state.muted);
  $soundBtn.setAttribute("aria-pressed", String(!state.muted));
}
function toggleSound() {
  state.muted = !state.muted;
  renderSound();
  persist();
  if (!state.muted) uiSound();
}

/* ------------------------------------------------------------------ *
 *  INPUT                                                              *
 * ------------------------------------------------------------------ */
function onKey(e) {
  if (e.repeat) return;
  if (e.key === " ") {
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    step();
  } else if (e.key === "Escape") {
    if ($modal.classList.contains("show")) closeModal();
    else if ($drawer.classList.contains("show")) closeDrawer();
  } else if (e.key.toLowerCase() === "n") {
    newBallad();
  }
}
function isTypingTarget(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
function nudgeStep() {
  $stepBtn.classList.remove("nudge");
  void $stepBtn.offsetWidth;
  $stepBtn.classList.add("nudge");
}

/* ------------------------------------------------------------------ *
 *  INIT                                                               *
 * ------------------------------------------------------------------ */
function init() {
  load();
  renderSound();
  buildStair();
  newBallad(false);

  $stepBtn.addEventListener("click", step);
  $newBtn.addEventListener("click", () => newBallad());
  $soundBtn.addEventListener("click", toggleSound);
  $archiveBtn.addEventListener("click", openDrawer);
  $drawerClose.addEventListener("click", closeDrawer);
  $veil.addEventListener("click", closeDrawer);
  $modalClose.addEventListener("click", closeModal);
  $modalDelete.addEventListener("click", deleteCurrent);
  window.addEventListener("keydown", onKey);

  renderArchive();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
