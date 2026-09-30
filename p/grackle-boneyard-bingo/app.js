// Grackle Boneyard Bingo — click-only biomorphic bingo
// Features: bingo caller | boneyard card | grackle heckles
// Constraints: system fonts only, click interaction only (no inputs, no drag, no type)
const $ = (s) => document.querySelector(s);

const LETTERS = ["B", "I", "N", "G", "O"];
const RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
const ADJ = ["Hollow", "Mossy", "Cracked", "Gilded", "Wheezing", "Moonlit", "Soggy", "Ancient", "Chattering", "Velvet"];
const NOUN = ["Beak", "Femur", "Wishbone", "Claw", "Ribcage", "Tailfeather", "Skull", "Marrow", "Perch", "Caw"];

const HECKLES = {
  call: [
    "{g} saw that bone first. Rude.",
    "Ooh, {call}. Even the worms gasped.",
    "Mark it, mortal. {g} is watching.",
    "{call}? Bold. Wrong, but bold.",
    "The boneyard provides. {g} doubts you deserve it.",
    "CAAAAW! That's {call}, slowpoke.",
    "{g} buried that one in 1987.",
  ],
  daub: [
    "Lucky peck. Don't get used to it.",
    "{g} allows this daub. For now.",
    "Ooh, somebody owns a finger. Fancy.",
    "Daubed like a true carrion royal.",
    "Slow clap from the wire.",
  ],
  bad: [
    "NOT CALLED, genius. {g} is embarrassed for you.",
    "That bone is still underground. Stop that.",
    "False peck! The flock laughs.",
    "{g} just told the others. They're all laughing.",
    "Daubing uncalled bones? Jail. Boneyard jail.",
  ],
  win: [
    "BINGO?! {g} demands a recount!",
    "The grackles concede. Barely. Caw.",
    "Somebody feed this human. They won.",
  ],
  false: [
    "FALSE BINGO. The shame. THE SHAME.",
    "{g} has seen eggs smarter than that claim.",
    "No bingo. Just vibes. Bad ones.",
    "The boneyard rejects your claim.",
  ],
  newcard: [
    "Fresh bones! Smell that marrow.",
    "{g} shuffled with their feet. Good luck.",
    "New card, same doomed human.",
  ],
  idle: [
    "{g} is judging your card from the wire.",
    "Click the skull-egg. The grackles grow bored.",
    "A feather falls. Nothing happens. Classic.",
    "{g} ate a fry off the pavement. Living large.",
  ],
};
const NAMES = ["Marlowe", "Beakface", "Aunt Carrion"];

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem("grackle-boneyard-bingo-v1")) || { wins: 0, games: 0 }; }
    catch { return { wins: 0, games: 0 }; }
  },
  save(s) { try { localStorage.setItem("grackle-boneyard-bingo-v1", JSON.stringify(s)); } catch {} },
};

const state = {
  card: [],       // 25 entries {letter,n,key,epi,free}
  daubed: new Array(25).fill(false),
  called: new Set(),
  order: [],
  current: null,
  over: false,
  auto: null,
  sound: true,
  stats: store.load(),
  lastGrackle: -1,
};

function epithet(n) {
  return ADJ[n % ADJ.length] + " " + NOUN[(n * 7) % NOUN.length];
}
function key(letter, n) { return letter + "-" + n; }

function buildCard() {
  const card = [];
  for (let c = 0; c < 5; c++) {
    const letter = LETTERS[c];
    const [lo, hi] = RANGES[letter];
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let r = 0; r < 5; r++) {
      const idx = r * 5 + c;
      if (c === 2 && r === 2) {
        card[idx] = { letter: "★", n: 0, key: "FREE", epi: "Grackle skull", free: true };
      } else {
        const n = pool.pop();
        card[idx] = { letter, n, key: key(letter, n), epi: epithet(n), free: false };
      }
    }
  }
  return card;
}

function renderCard() {
  const el = $("#card");
  el.innerHTML = "";
  state.card.forEach((sq, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell" + (sq.free ? " free" : "") + (state.daubed[i] ? " daubed" : "") +
      (!sq.free && state.called.has(sq.key) && !state.daubed[i] ? " called" : "");
    b.setAttribute("role", "gridcell");
    b.dataset.i = i;
    b.setAttribute("aria-label", sq.free ? "Free space, grackle skull" :
      `${sq.key}, ${sq.epi}${state.daubed[i] ? ", daubed" : state.called.has(sq.key) ? ", called" : ", not called"}`);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = sq.free ? "☠" : sq.n;
    const epi = document.createElement("span");
    epi.className = "epi";
    epi.textContent = sq.free ? "FREE" : sq.epi;
    b.append(num, epi);
    b.addEventListener("click", () => onDaub(i, b));
    el.appendChild(b);
  });
}

function renderTray() {
  const t = $("#tray");
  t.innerHTML = "";
  if (!state.order.length) {
    const p = document.createElement("p");
    p.className = "tray-empty";
    p.textContent = "No bones exhumed yet — click the skull-egg.";
    t.appendChild(p);
    return;
  }
  state.order.forEach((k, i) => {
    const s = document.createElement("span");
    s.className = "chip" + (i === state.order.length - 1 ? " latest" : "");
    s.textContent = k;
    t.appendChild(s);
  });
  t.scrollTop = t.scrollHeight;
}

function renderStats() {
  $("#statWins").textContent = state.stats.wins;
  $("#statGames").textContent = state.stats.games;
  $("#statCalls").textContent = state.order.length + "/75";
  $("#callCount").textContent = state.order.length === 0
    ? "0 of 75 bones exhumed"
    : `${state.order.length} of 75 bones exhumed · ${75 - state.order.length} still buried`;
}

function pickGrackle() {
  let g = Math.floor(Math.random() * 3);
  if (g === state.lastGrackle) g = (g + 1) % 3;
  state.lastGrackle = g;
  return g;
}
function fill(template, g, call) {
  return template.replace("{g}", NAMES[g]).replace("{call}", call || "");
}
function heckle(kind, extra) {
  const g = extra?.g ?? pickGrackle();
  const pool = HECKLES[kind];
  const line = fill(pool[Math.floor(Math.random() * pool.length)], g, extra?.call);
  const bub = $("#bub" + g);
  bub.textContent = line;
  bub.classList.remove("fresh");
  void bub.offsetWidth;
  bub.classList.add("fresh");
  const wrap = $("#g" + g);
  wrap.classList.remove("hop");
  void wrap.offsetWidth;
  wrap.classList.add("hop");
  const log = $("#heckleLog");
  const li = document.createElement("li");
  const b = document.createElement("b");
  b.textContent = NAMES[g] + ": ";
  li.append(b, document.createTextNode(line));
  log.prepend(li);
  while (log.children.length > 6) log.lastChild.remove();
  if (state.sound && (kind === "call" || kind === "win")) caw(kind === "win");
}
function squawk(g, text) {
  const bub = $("#bub" + g);
  bub.textContent = text;
  const log = $("#heckleLog");
  const li = document.createElement("li");
  const b = document.createElement("b");
  b.textContent = NAMES[g] + ": ";
  li.append(b, document.createTextNode(text));
  log.prepend(li);
  while (log.children.length > 6) log.lastChild.remove();
}

// tiny WebAudio caw — no assets, click-gated
let actx = null;
function caw(big) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    [0, 0.14, big ? 0.28 : -1].forEach((dt, i) => {
      if (dt < 0) return;
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(900 - i * 120, t + dt);
      o.frequency.exponentialRampToValueAtTime(320, t + dt + 0.12);
      gn.gain.setValueAtTime(0.0001, t + dt);
      gn.gain.exponentialRampToValueAtTime(0.12, t + dt + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.13);
      o.connect(gn).connect(actx.destination);
      o.start(t + dt); o.stop(t + dt + 0.15);
    });
  } catch {}
}

function remainingBalls() {
  const all = [];
  for (const L of LETTERS) for (let n = RANGES[L][0]; n <= RANGES[L][1]; n++) {
    const k = key(L, n);
    if (!state.called.has(k)) all.push({ L, n, k });
  }
  return all;
}

function callNext() {
  if (state.over) { heckle("idle"); return; }
  const rest = remainingBalls();
  if (!rest.length) {
    $("#callName").textContent = "The boneyard is empty. Every bone has been called.";
    stopAuto();
    return;
  }
  const { L, n, k } = rest[Math.floor(Math.random() * rest.length)];
  state.called.add(k);
  state.order.push(k);
  state.current = { L, n, k };
  const ball = $("#btnCall");
  ball.classList.remove("pop");
  void ball.offsetWidth;
  ball.classList.add("pop");
  $("#ballLetter").textContent = L;
  $("#ballNumber").textContent = n;
  $("#callName").textContent = `${L}-${n} · the ${epithet(n)}`;
  if (state.sound) caw(false);
  renderTray(); renderStats(); renderCard();
  heckle("call", { call: `${L}-${n}` });
  checkAutoWin();
}

function lines() {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return L;
}
function winningLine() {
  return lines().find((line) => line.every((i) => state.daubed[i])) || null;
}
function lineName(line) {
  const s = new Set(line);
  if ([0, 6, 12, 18, 24].every((i) => s.has(i))) return "claw diagonal";
  if ([4, 8, 12, 16, 20].every((i) => s.has(i))) return "fang diagonal";
  const rows = ["top rib", "second rib", "midrib (free skull row)", "fourth rib", "tail rib"];
  for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => s.has(r * 5 + c))) return rows[r] + " row";
  const cols = ["B spine", "I spine", "N spine", "G spine", "O spine"];
  for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => s.has(r * 5 + c))) return cols[c] + " column";
  return "boneyard line";
}

function onDaub(i, btn) {
  if (state.over) return;
  const sq = state.card[i];
  if (sq.free) { squawk(pickGrackle(), "The skull is already yours. Greedy."); return; }
  if (state.daubed[i]) {
    state.daubed[i] = false; // click toggles off — still click-only
    renderCard();
    return;
  }
  if (!state.called.has(sq.key)) {
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    heckle("bad");
    return;
  }
  state.daubed[i] = true;
  renderCard();
  heckle("daub");
  checkAutoWin(true);
}

function checkAutoWin(celebrate) {
  const w = winningLine();
  if (w && !state.over) {
    state.over = true;
    stopAuto();
    state.stats.wins++;
    store.save(state.stats);
    renderStats();
    [...$("#card").children].forEach((el, i) => { if (w.includes(i)) el.classList.add("winflash"); });
    $("#winLine").textContent = `Completed the ${lineName(w)} in ${state.order.length} calls. The flock is furious.`;
    $("#winBanner").hidden = false;
    heckle("win");
    featherStorm();
    if (state.sound) caw(true);
  } else if (celebrate && !w) {
    // near-win encouragement
    const near = lines().filter((l) => l.filter((i) => state.daubed[i]).length === 4).length;
    if (near > 0) squawk(pickGrackle(), `One bone from glory on ${near} line${near > 1 ? "s" : ""}. Choke.`);
  }
}

function claimBingo() {
  const w = winningLine();
  if (w && !state.over) { checkAutoWin(); return; }
  if (state.over) return;
  heckle("false");
  const card = $("#card");
  card.classList.remove("shake");
  void card.offsetWidth;
  [...card.children].forEach((el) => { el.classList.remove("shake"); });
  const first = card.children[12];
  if (first) { first.classList.add("shake"); setTimeout(() => first.classList.remove("shake"), 450); }
}

function newCard(announce = true) {
  state.card = buildCard();
  state.daubed = new Array(25).fill(false);
  state.daubed[12] = true;
  state.over = false;
  $("#winBanner").hidden = true;
  renderCard();
  if (announce) heckle("newcard");
}

function newRound() {
  stopAuto();
  state.called = new Set();
  state.order = [];
  state.current = null;
  $("#ballLetter").textContent = "B";
  $("#ballNumber").textContent = "?";
  $("#callName").textContent = "Fresh dirt. No bones called yet. The grackles are restless.";
  state.stats.games++;
  store.save(state.stats);
  newCard(false);
  renderTray(); renderStats();
  heckle("newcard");
}

function stopAuto() {
  if (state.auto) { clearInterval(state.auto); state.auto = null; }
  const b = $("#btnAuto");
  b.textContent = "auto: off";
  b.setAttribute("aria-pressed", "false");
}
function toggleAuto() {
  if (state.auto) { stopAuto(); squawk(pickGrackle(), "Auto-caller off. Back to manual labor."); return; }
  if (state.over) return;
  state.auto = setInterval(() => {
    if (!remainingBalls().length || state.over) { stopAuto(); return; }
    callNext();
  }, 3000);
  const b = $("#btnAuto");
  b.textContent = "auto: on";
  b.setAttribute("aria-pressed", "true");
  squawk(pickGrackle(), "Auto-caller on. The skull-egg works alone now.");
}

function featherStorm() {
  const layer = $("#feathers");
  const glyphs = ["🪶", "🦴", "✦", "☠"];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("span");
    s.className = "feather";
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 1.8 + Math.random() * 2.2 + "s";
    s.style.animationDelay = (Math.random() * 0.6) + "s";
    s.style.fontSize = 14 + Math.random() * 22 + "px";
    layer.appendChild(s);
    setTimeout(() => s.remove(), 4500);
  }
}

// wire-up — every control is a click
$("#btnCall").addEventListener("click", callNext);
$("#btnBingo").addEventListener("click", claimBingo);
$("#btnNewCard").addEventListener("click", () => newCard());
$("#btnNewRound").addEventListener("click", newRound);
$("#btnAgain").addEventListener("click", newRound);
$("#btnAuto").addEventListener("click", toggleAuto);
$("#btnHeckle").addEventListener("click", () => heckle("idle"));
$("#btnSound").addEventListener("click", (e) => {
  state.sound = !state.sound;
  e.currentTarget.textContent = state.sound ? "caw: on" : "caw: off";
  e.currentTarget.setAttribute("aria-pressed", String(state.sound));
});
document.querySelectorAll(".bird").forEach((b) =>
  b.addEventListener("click", () => {
    const g = Number(b.dataset.g);
    const wrap = $("#g" + g);
    wrap.classList.remove("hop"); void wrap.offsetWidth; wrap.classList.add("hop");
    squawk(g, fill(HECKLES.idle[Math.floor(Math.random() * HECKLES.idle.length)], g));
    if (state.sound) caw(false);
  })
);

// init
newCard(false);
renderTray(); renderStats();
$("#bub0").textContent = "Welcome to the boneyard, fresh meat.";
$("#bub1").textContent = "Click the skull-egg. Or don't. Coward.";
$("#bub2").textContent = "I hid the good bones. Find them.";
const log = $("#heckleLog");
[["Marlowe", "House rule: the grackles are always right."], ["Beakface", "Five in a row. Try not to embarrass yourself."]].forEach(([n, t]) => {
  const li = document.createElement("li");
  const b = document.createElement("b");
  b.textContent = n + ": ";
  li.append(b, document.createTextNode(t));
  log.append(li);
});
console.log("grackle-boneyard-bingo ready — click only, no external fonts");
