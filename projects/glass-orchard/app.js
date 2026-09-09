const COLS = 5;
const ROWS = 8;
const RIPE = 2;

const SPECIES = [
  { name: "SOL FIG", rgb: "255,180,84", key: "amber" },
  { name: "FROST PEAR", rgb: "65,226,236", key: "cyan" },
  { name: "NOVA PLUM", rgb: "255,106,213", key: "magenta" }
];

const LNAME = ["PITH", "BUD", "RIPE"];

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (n) => Math.floor(Math.random() * n);

const fruitsEl = $("fruits");
const boardEl = $("board");
const guidesEl = $("guides");
const statusText = $("statustext");
const statusLine = $("statusline");
const burstEl = $("burst");
const surgeEl = $("surge");
const yieldVal = $("yieldVal");
const yieldBig = $("yieldBig");
const picksVal = $("picksVal");
const bestVal = $("bestVal");
const roPicks = $("roPicks");
const roBest = $("roBest");
const logBox = $("logbox");
const queueSlots = $("queueSlots");
const auraSpots = document.querySelectorAll(".aura-spot");
const lamps = document.querySelectorAll(".lamp");
const reseedBtn = $("reseed");
const boardwrap = $("boardwrap");

const BEST_KEY = "glass-orchard-best-v1";

let grid = null;
let nextId = 1;
let queue = [];
let selCol = 2;
let busy = false;
let pendingCol = null;
let over = false;
let score = 0;
let picks = 0;
let best = 0;
let turns = 0;

const curE = [0, 0, 0];
const tarE = [0, 0, 0];

try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}

const byId = new Map();

function resetState() {
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  fruitsEl.textContent = "";
  byId.clear();
  score = 0;
  picks = 0;
  turns = 0;
  over = false;
  busy = false;
  pendingCol = null;
  tarE[0] = tarE[1] = tarE[2] = 0.25;
  queue = [];
  for (let i = 0; i < 3; i++) queue.push(newSpecies());
  renderQueue();
  syncHUD();
}

function countSpecies() {
  const c = [0, 0, 0];
  for (let r = 0; r < ROWS; r++)
    for (let cc = 0; cc < COLS; cc++) if (grid[r][cc]) c[grid[r][cc].sp]++;
  return c;
}

function newSpecies() {
  const counts = countSpecies();
  const lowest = counts.indexOf(Math.min(...counts));
  const pick = Math.random() < 0.34 ? lowest : rand(3);
  return pick;
}

function makeFruit(sp) {
  const id = nextId++;
  const wrap = el("div", "fruit h-" + sp);
  wrap.dataset.id = id;
  const orb = el("div", "orb");
  wrap.appendChild(orb);
  fruitsEl.appendChild(wrap);
  const f = { id, sp, lvl: 0, r: 0, c: 0, el: wrap, orb };
  byId.set(id, f);
  setLevel(f, 0, false);
  return f;
}

function setLevel(f, lvl, pop) {
  f.lvl = lvl;
  f.el.classList.remove("lvl-1", "lvl-2");
  if (lvl === 1) f.el.classList.add("lvl-1");
  if (lvl === 2) f.el.classList.add("lvl-2");
  if (pop) {
    f.el.classList.remove("just");
    void f.el.offsetWidth;
    f.el.classList.add("just");
  }
}

function posOf(f, instant) {
  f.el.style.transition = instant ? "none" : "";
  f.el.style.transform = "translate(" + f.c * 100 + "%," + f.r * 100 + "%)";
}

function landingRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) if (!grid[r][col]) return r;
  return -1;
}

function same(a, b) {
  return !!a && !!b && a.sp === b.sp && a.lvl === b.lvl;
}

function collapseCol(col) {
  let w = ROWS - 1;
  for (let r = ROWS - 1; r >= 0; r--) {
    const f = grid[r][col];
    if (f) {
      if (w !== r) {
        grid[w][col] = f;
        grid[r][col] = null;
        f.r = w;
        posOf(f);
      }
      w--;
    }
  }
}

function collapseAll() {
  for (let c = 0; c < COLS; c++) collapseCol(c);
}

function addScore(n) {
  score += n;
  syncHUD();
}

function syncHUD() {
  const y = String(score);
  yieldVal.textContent = y;
  yieldBig.textContent = y;
  picksVal.textContent = String(picks);
  bestVal.textContent = String(best);
  roPicks.textContent = String(picks);
  roBest.textContent = String(best);
  yieldBig.classList.remove("pop");
  void yieldBig.offsetWidth;
  yieldBig.classList.add("pop");
}

function saveBest() {
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
  }
  syncHUD();
}

function log(html, tone) {
  const line = el("div", "logln" + (tone !== undefined ? " lg-" + tone : ""));
  line.innerHTML = html;
  logBox.appendChild(line);
  while (logBox.children.length > 6) logBox.removeChild(logBox.firstChild);
}

function setStatus(msg, kind) {
  statusText.textContent = msg;
  statusLine.className = kind ? (kind === "ok" ? "ok" : "bad") : "";
}

function burst(tone, text) {
  burstEl.className = "";
  burstEl.innerHTML = "";
  burstEl.classList.add("bt-" + tone);
  const s = el("span");
  s.textContent = text;
  burstEl.appendChild(s);
  void burstEl.offsetWidth;
  burstEl.classList.add("on");
}

function surge() {
  surgeEl.classList.remove("on");
  void surgeEl.offsetWidth;
  surgeEl.classList.add("on");
}

function floatText(c, r, text, tone, big) {
  const f = el("span", "float f-" + tone + (big ? " big" : ""));
  f.textContent = text;
  f.style.left = "calc(" + (((c + 0.5) / COLS) * 100).toFixed(2) + "% - 0px)";
  f.style.top = "calc(" + (((r + 0.6) / ROWS) * 100).toFixed(2) + "%)";
  fruitsEl.appendChild(f);
  setTimeout(() => f.remove(), 950);
}

function renderQueue() {
  queueSlots.textContent = "";
  queue.forEach((sp, i) => {
    const slot = el("div", "qslot" + (i === 0 ? " cur" : ""));
    const orb = el("div", "orb h-" + sp);
    slot.appendChild(orb);
    queueSlots.appendChild(slot);
  });
}

async function dropInto(col) {
  if (over) return;
  if (busy) { pendingCol = col; return; }

  const row = landingRow(col);
  if (row < 0) {
    if (anyRipe()) {
      setStatus("CHAMBER JAM — PICK a pulsing ripe fruit", "bad");
      shakeWarn();
    } else {
      setStatus("column full", "bad");
    }
    return;
  }

  busy = true;
  turns++;

  const sp = queue.shift();
  queue.push(newSpecies());
  renderQueue();

  const f = makeFruit(sp);
  f.r = row;
  f.c = col;
  grid[row][col] = f;

  const dist = row + 1;
  posOf(f, true);
  f.el.style.transition = "none";
  f.el.style.transform = "translate(" + col * 100 + "%," + (-1 * 100) + "%)";
  void f.el.offsetWidth;
  const fallMs = 60 + dist * 46;
  f.el.style.transition = "transform " + fallMs + "ms cubic-bezier(.55,.06,.3,.9)";
  f.el.style.transform = "translate(" + col * 100 + "%," + row * 100 + "%)";

  tarE[sp] = Math.min(1, tarE[sp] + 0.12);

  await sleep(fallMs + 30);
  f.el.style.transition = "";

  setStatus("...merging", "");
  await resolveAll();
  await sleep(40);

  busy = false;
  if (pendingCol !== null) {
    const pc = pendingCol;
    pendingCol = null;
    await dropInto(pc);
    return;
  }
  checkChamber();
}

function findMerge() {
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const a = grid[r][c];
      if (!a) continue;
      const right = c + 1 < COLS ? grid[r][c + 1] : null;
      if (same(a, right)) return { a, b: right };
      const below = r + 1 < ROWS ? grid[r + 1][c] : null;
      if (same(a, below)) return { a, b: below };
    }
  }
  return null;
}

async function resolveAll() {
  let guard = 0;
  while (guard++ < 60) {
    const m = findMerge();
    if (!m) break;
    await doMerge(m);
  }
}

async function doMerge(m) {
  const a = m.a;
  const b = m.b;

  if (a.lvl === RIPE) {
    grid[a.r][a.c] = null;
    grid[b.r][b.c] = null;
    a.el.classList.add("gone");
    b.el.classList.add("gone");
    await sleep(200);
    a.el.remove();
    b.el.remove();
    byId.delete(a.id);
    byId.delete(b.id);

    addScore(130);
    saveBest();
    tarE[a.sp] = 1;
    surge();
    burst(a.sp, "HARVEST +130");
    floatText(a.c, a.r, "+130", a.sp, true);
    log("<b>" + SPECIES[a.sp].name + "</b> + <b>" + SPECIES[a.sp].name + "</b> = harvest &nbsp;YIELD +130", a.sp);
    setStatus(SPECIES[a.sp].name + " harvested into the light", "ok");
    collapseAll();
    await sleep(120);
    return;
  }

  grid[b.r][b.c] = null;
  b.el.classList.add("gone");

  a.lvl += 1;
  setLevel(a, a.lvl, true);

  const gained = a.lvl === 1 ? 5 : 20;
  addScore(gained);
  tarE[a.sp] = Math.min(1, tarE[a.sp] + 0.28);
  floatText(a.c, a.r, "+" + gained, a.sp, false);

  if (a.lvl === RIPE) {
    log("<b>" + SPECIES[a.sp].name + "</b> ripened → <b>" + LNAME[RIPE] + "</b> +20", a.sp);
    setStatus(SPECIES[a.sp].name + " is RIPE — pick it to harvest", "ok");
  }

  await sleep(120);
  b.el.remove();
  byId.delete(b.id);
  collapseCol(b.c);
  await sleep(60);
}

async function pickFruit(f) {
  if (over) return;
  if (busy) return;
  if (f.lvl !== RIPE) return;

  busy = true;
  picks++;
  turns++;
  grid[f.r][f.c] = null;
  const c = f.c;

  f.el.classList.add("gone");
  addScore(40);
  saveBest();
  tarE[f.sp] = Math.min(1, tarE[f.sp] + 0.6);
  surge();
  burst(f.sp, "PICK +40");
  floatText(f.c, f.r, "+40", f.sp, true);
  log("<b>" + SPECIES[f.sp].name + "</b> picked &nbsp;YIELD +40", f.sp);
  setStatus(SPECIES[f.sp].name + " picked — the lamp brightens", "ok");

  await sleep(230);
  f.el.remove();
  byId.delete(f.id);
  collapseCol(c);
  await sleep(120);
  await resolveAll();
  await sleep(60);

  busy = false;
  if (pendingCol !== null) {
    const pc = pendingCol;
    pendingCol = null;
    await dropInto(pc);
    return;
  }
  checkChamber();
}

function anyRipe() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const f = grid[r][c];
      if (f && f.lvl === RIPE) return true;
    }
  return false;
}

function canDropAny() {
  for (let c = 0; c < COLS; c++) if (!grid[0][c]) return true;
  return false;
}

function shakeWarn() {
  boardwrap.classList.remove("no-more");
  void boardwrap.offsetWidth;
  boardwrap.classList.add("no-more");
  setTimeout(() => boardwrap.classList.remove("no-more"), 450);
}

function checkChamber() {
  if (over) return;
  if (canDropAny()) {
    setStatus("drop seeds — equal fruits merge & glow");
    return;
  }
  if (anyRipe()) {
    setStatus("CHAMBER JAM — PICK a pulsing ripe fruit to free space", "bad");
    shakeWarn();
    return;
  }
  gameOver();
}

function gameOver() {
  over = true;
  saveBest();
  surge();
  burst("w", "CHAMBER FULL");
  log("<b>CHAMBER FULL</b> — final yield " + score + " <b>(BEST " + best + ")</b>", "w");
  setStatus("CHAMBER FULL — press RESEED (R) for a fresh soil bed", "bad");
}

function reseed() {
  if (busy) {
    setStatus("hold — the chamber is still settling", "bad");
    return;
  }
  resetState();
  log("soil bed reset — new growth cycle", 0);
  setStatus("drop seeds — equal fruits merge & glow");
}

boardEl.addEventListener("click", (e) => {
  const fruitNode = e.target.closest(".fruit");
  if (fruitNode) {
    const f = byId.get(parseInt(fruitNode.dataset.id, 10));
    if (f && f.lvl === RIPE) {
      pickFruit(f);
      return;
    }
  }
  const rect = boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  let col = Math.floor((x / rect.width) * COLS);
  col = clamp(col, 0, COLS - 1);
  dropInto(col);
});

guidesEl.querySelectorAll("i").forEach((g, i) => {
  g.addEventListener("click", (e) => {
    e.stopPropagation();
    dropInto(i);
  });
});

function selGuide() {
  guidesEl.querySelectorAll("i").forEach((g, i) => g.classList.toggle("sel", i === selCol));
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") { selCol = (selCol + COLS - 1) % COLS; selGuide(); e.preventDefault(); }
  else if (e.key === "ArrowRight") { selCol = (selCol + 1) % COLS; selGuide(); e.preventDefault(); }
  else if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); dropInto(selCol); }
  else if (e.key === "r" || e.key === "R") { reseed(); }
});

reseedBtn.addEventListener("click", reseed);

let last = performance.now();
function tick(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  for (let i = 0; i < 3; i++) {
    curE[i] += (tarE[i] - curE[i]) * Math.min(1, dt * 2.6);
    tarE[i] = Math.max(0, tarE[i] - dt * 0.05);
  }
  const t = ts / 1000;
  for (let i = 0; i < 3; i++) {
    const wave = 0.07 + 0.05 * Math.sin(t * 0.7 + i * 2.2);
    const v = clamp(wave + curE[i] * 0.85, 0.02, 1);
    auraSpots[i].style.opacity = String(Math.round(v * 100) / 100);
    lamps[i].classList.toggle("hot", curE[i] > 0.3 || (curE[i] > 0.12 && Math.sin(t * 5 + i * 2) > 0.4));
  }
  requestAnimationFrame(tick);
}

resetState();
log("<b>CHAMBER 07</b> sealed — soil ready", 0);
log("two equal fruits merge &amp; glow — harvest the <b>RIPE</b>", 1);
log("arrows + <b>SPACE</b> to drop, <b>R</b> to reseed", 2);
setStatus("drop seeds — equal fruits merge & glow");
requestAnimationFrame(tick);
selGuide();
