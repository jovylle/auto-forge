// VERVAIN RAT RELAY — one-button timing relay through rat-run tunnels.
// Features: tunnel legs (4) · herb batons (3) · relay score (freshness + ratings + time).
// Constraints: 3 colors + black/white · system fonts only · no deps · file:// safe.

const HERBS = {
  vervain:  { name: "VERVAIN",   glyph: "🌿", speed: 0.115, wilt: 1.35, blurb: "steady classic" },
  moonmint: { name: "MOONMINT",  glyph: "🍃", speed: 0.148, wilt: 2.10, blurb: "fast but fragile" },
  sageshade:{ name: "SAGESHADE", glyph: "🪻", speed: 0.095, wilt: 0.85, blurb: "slow and sturdy" },
};
const LEGS = [
  { name: "LEG ① — NEON BURROW",  rat: "sprinter rat 🐀" },
  { name: "LEG ② — CHROME SEWER",  rat: "drifter rat 🐀" },
  { name: "LEG ③ — MIST ARCADE",   rat: "night rat 🐀" },
  { name: "LEG ④ — PALM FINALE",   rat: "anchor rat 🐀" },
];
const GATE_AT = 0.78;        // handoff gate starts (fraction of leg)
const PERFECT_AT = 0.90;     // perfect window starts
const PERFECT_TO = 0.965;    // perfect window ends
const BEST_KEY = "vervain-rat-relay-best";

const $ = (id) => document.getElementById(id);
const els = {
  hudLeg: $("hudLeg"), hudFresh: $("hudFresh"), hudTime: $("hudTime"), hudScore: $("hudScore"),
  freshFill: $("freshFill"), herbPick: $("herbPick"), track: $("track"),
  actionRow: $("actionRow"), passBtn: $("passBtn"), toast: $("toast"),
  result: $("result"), finalScore: $("finalScore"), resultLine: $("resultLine"),
  legLog: $("legLog"), bestScore: $("bestScore"), newBest: $("newBest"),
  startBtn: $("startBtn"), againBtn: $("againBtn"), resultTitle: $("resultTitle"),
};

const state = {
  herb: "vervain",
  running: false,
  leg: 0,
  progress: 0,       // 0..1 within current leg
  fresh: 100,
  time: 0,
  score: 0,
  ratings: [],
  last: 0,
  runners: [],
  toastTimer: 0,
};

function best() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* file:// private mode */ }
}

// --- herb select ---
document.querySelectorAll(".herb").forEach((b) => {
  b.addEventListener("click", () => {
    if (state.running) return;
    document.querySelectorAll(".herb").forEach((x) => {
      x.classList.remove("selected");
      x.setAttribute("aria-checked", "false");
    });
    b.classList.add("selected");
    b.setAttribute("aria-checked", "true");
    state.herb = b.dataset.herb;
    blip(520, 0.06);
  });
});

// --- track build (tunnel legs) ---
function buildTrack() {
  els.track.innerHTML = "";
  state.runners = [];
  LEGS.forEach((leg, i) => {
    const div = document.createElement("div");
    div.className = "leg";
    div.id = "leg" + i;
    div.innerHTML =
      '<div class="leg-top"><span class="leg-name">' + leg.name + '</span>' +
      '<span class="leg-rat" data-rat>💤 ' + leg.rat + '</span></div>' +
      '<div class="tunnel"><div class="gate"></div><div class="perfect"></div>' +
      '<span class="wait hidden" data-wait>PASS NOW!</span>' +
      '<span class="runner" data-run>🐀</span></div>';
    els.track.appendChild(div);
    state.runners.push({
      root: div,
      run: div.querySelector("[data-run]"),
      rat: div.querySelector("[data-rat]"),
      wait: div.querySelector("[data-wait]"),
    });
  });
}

function markLegs() {
  state.runners.forEach((r, i) => {
    r.root.classList.toggle("active", state.running && i === state.leg);
    r.root.classList.toggle("done", i < state.leg);
    if (i < state.leg) r.rat.textContent = "✔ delivered " + HERBS[state.herb].glyph;
    else if (i === state.leg && state.running) r.rat.textContent = "carrying " + HERBS[state.herb].glyph + " — " + LEGS[i].rat;
  });
}

// --- tiny synth (no assets) ---
let ac = null;
function blip(freq, dur = 0.08, type = "square", gain = 0.05) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch { /* audio unavailable — silent mode */ }
}
const sfx = {
  perfect: () => { blip(880, 0.09); setTimeout(() => blip(1320, 0.12), 70); },
  good: () => blip(660, 0.1),
  late: () => blip(440, 0.1),
  fumble: () => blip(160, 0.2, "sawtooth", 0.07),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.14), i * 110)),
};

// --- game flow ---
function start() {
  buildTrack();
  Object.assign(state, {
    running: true, leg: 0, progress: 0, fresh: 100,
    time: 0, score: 0, ratings: [], last: performance.now(),
  });
  els.herbPick.classList.add("hidden");
  els.result.classList.add("hidden");
  els.track.classList.remove("hidden");
  els.actionRow.classList.remove("hidden");
  markLegs();
  toast("🐀 LEG ① — GO GO GO");
  blip(440, 0.08); setTimeout(() => blip(660, 0.08), 90); setTimeout(() => blip(880, 0.12), 180);
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!state.running) return;
  const dt = Math.min((now - state.last) / 1000, 0.1);
  state.last = now;
  const herb = HERBS[state.herb];

  // rat auto-runs; caps at gate end until a clean pass
  state.progress = Math.min(state.progress + herb.speed * dt, 0.999);
  state.fresh = Math.max(0, state.fresh - herb.wilt * dt);
  state.time += dt;

  const r = state.runners[state.leg];
  r.run.style.left = "calc(" + (state.progress * 100).toFixed(2) + "% - 13px)";
  r.wait.classList.toggle("hidden", state.progress < 0.985);

  if (state.fresh <= 0) return finish(true); // herbs fully wilted — relay failed
  renderHud();
  requestAnimationFrame(tick);
}

function ratePass() {
  const p = state.progress;
  if (p >= PERFECT_AT && p <= PERFECT_TO) return { k: "PERFECT", pts: 500 };
  if (p >= GATE_AT) return { k: "GOOD", pts: 300 };
  if (p >= GATE_AT - 0.12) return { k: "EARLY", pts: 120 };
  return null; // fumble
}

function pass() {
  if (!state.running) return;
  const r = state.runners[state.leg];
  const rating = ratePass();
  if (!rating) {
    // fumble: rat trips, herbs bruise
    state.progress = Math.max(0, state.progress - 0.09);
    state.fresh = Math.max(0, state.fresh - 7);
    state.score = Math.max(0, state.score - 50);
    r.root.classList.remove("fumble");
    void r.root.offsetWidth;
    r.root.classList.add("fumble");
    toast("💥 FUMBLE! too early — herbs bruised");
    sfx.fumble();
    renderHud();
    return;
  }
  const freshBonus = Math.round(state.fresh * 2);
  const gained = rating.pts + freshBonus;
  state.score += gained;
  state.ratings.push({ leg: state.leg + 1, rating: rating.k, pts: gained });

  r.root.classList.add(rating.k === "PERFECT" ? "flash-perfect" : "flash-good");
  setTimeout(() => r.root.classList.remove("flash-perfect", "flash-good"), 450);
  toast(rating.k === "PERFECT" ? "✶ PERFECT HANDOFF ✶ +" + gained : rating.k + " handoff +" + gained);
  if (rating.k === "PERFECT") sfx.perfect();
  else if (rating.k === "GOOD") sfx.good();
  else sfx.late();

  state.leg += 1;
  state.progress = 0;
  if (state.leg >= LEGS.length) return finish(false);
  markLegs();
  toast2("🐀 LEG " + ["①", "②", "③", "④"][state.leg] + " — GO!");
  renderHud();
}

function finish(wilted) {
  state.running = false;
  const timeBonus = wilted ? 0 : Math.max(0, Math.round(1200 - state.time * 22));
  state.score += timeBonus;
  if (!wilted && state.ratings.filter((r) => r.k === "PERFECT").length === LEGS.length) {
    state.score += 750; // all-perfect relay bonus
  }
  renderHud();
  markLegs();
  els.actionRow.classList.add("hidden");
  els.result.classList.remove("hidden");

  const h = HERBS[state.herb];
  els.finalScore.textContent = state.score.toLocaleString();
  els.resultLine.textContent = wilted
    ? "🥀 The " + h.name.toLowerCase() + " wilted in the tunnels… the rats eat it anyway. Run it back!"
    : "🌿 " + h.name + " delivered in " + state.time.toFixed(1) + "s at " +
      Math.round(state.fresh) + "% freshness (+" + timeBonus + " time bonus).";
  els.resultTitle.textContent = wilted ? "🥀 RELAY WILTED 🥀" : "🏁 RELAY COMPLETE 🏁";
  els.legLog.innerHTML = state.ratings.map((r) =>
    "<li>leg " + r.leg + " — <strong>" + r.rating + "</strong> · +" + r.pts + "</li>"
  ).join("") || "<li>no clean handoffs… the tunnel wins this round</li>";

  const prev = best();
  const isBest = state.score > prev;
  if (isBest) saveBest(state.score);
  els.bestScore.textContent = Math.max(prev, state.score).toLocaleString();
  els.newBest.classList.toggle("hidden", !isBest);
  els.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (!wilted) sfx.win(); else sfx.fumble();
}

function renderHud() {
  els.hudLeg.textContent = Math.min(state.leg + 1, 4) + " / 4";
  els.hudFresh.textContent = Math.round(state.fresh) + "%";
  els.hudTime.textContent = state.time.toFixed(1) + "s";
  els.hudScore.textContent = state.score.toLocaleString();
  els.freshFill.style.width = state.fresh + "%";
}

let toastSolo = 0;
function toast(msg) {
  els.toast.textContent = msg;
  clearTimeout(toastSolo);
  toastSolo = setTimeout(() => { if (state.running) els.toast.textContent = "･ﾟ✶ keep the herbs moving ✶ﾟ･"; }, 1400);
}
function toast2(msg) {
  setTimeout(() => { els.toast.textContent = msg; }, 1450);
}

// --- wiring ---
els.startBtn.addEventListener("click", start);
els.againBtn.addEventListener("click", () => {
  els.herbPick.classList.remove("hidden");
  start();
});
els.passBtn.addEventListener("click", pass);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "Enter") {
    if (!els.actionRow.classList.contains("hidden")) { e.preventDefault(); pass(); }
  }
});

els.bestScore.textContent = best().toLocaleString();
buildTrack();
console.log("vervain-rat-relay ready 🐀🌿");
