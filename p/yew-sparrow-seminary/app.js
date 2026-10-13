// Yew Sparrow Seminary — 雀の寺
// Perch classes · Sermon trials · Seminary score · scroll-reactive mountain climb.
const $ = (id) => document.getElementById(id);
const store = {
  load() { try { return JSON.parse(localStorage.getItem("yew-sparrow-seminary-v1")); } catch { return null; } },
  save(s) { try { localStorage.setItem("yew-sparrow-seminary-v1", JSON.stringify(s)); } catch {} },
  clear() { try { localStorage.removeItem("yew-sparrow-seminary-v1"); } catch {} },
};

const HALLS = {
  voice:     { name: "Dawn Chant",     stat: "voice",     kanji: "暁" },
  stillness: { name: "Stillness Zazen", stat: "stillness", kanji: "静" },
  wing:      { name: "Wing Liturgy",   stat: "wing",      kanji: "翔" },
};
const STAT_LABEL = { voice: "Voice", stillness: "Stillness", wing: "Wing" };
const NAMES = [
  { name: "Chiyo", kanji: "千代" }, { name: "Sora", kanji: "空" },
  { name: "Mugi", kanji: "麦" },   { name: "Rin", kanji: "鈴" },
  { name: "Uta", kanji: "歌" },    { name: "Kaze", kanji: "風" },
];
const RANKS = [
  [0, "Hatchling", "雛"], [150, "Novice", "新参"], [350, "Acolyte", "侍僧"],
  [600, "Cantor", "詠師"], [900, "Prior", "上座"], [1300, "Abbot", "住職"],
  [1800, "Living Treasure", "国宝"],
];
const ATTEND_CD = 25_000, TICK_MS = 8_000, FEED_COST = 6;
const RECRUIT_COST = [30, 60];

function freshState() {
  return {
    grain: 20, trialTotal: 0, trials: 0, best: 0, honors: [],
    sparrows: NAMES.slice(0, 4).map((n, i) => ({
      ...n, id: "sp" + i,
      voice: 8 + i * 3, stillness: 6 + i * 2, wing: 7 + i * 2,
      perch: ["voice", "stillness", "wing", "voice"][i],
      readyAt: 0,
    })),
  };
}
let S = store.load() || freshState();
if (!S.sparrows || !S.sparrows.length) S = freshState();

const sumStats = () => S.sparrows.reduce((a, b) => a + b.voice + b.stillness + b.wing, 0);
const semScore = () => sumStats() + S.trialTotal;
function rankOf(score) {
  let r = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (score >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  return { cur: r, next };
}

/* ————— toast ————— */
let toastT = 0;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ————— sparrow glyph ————— */
const glyph = (seed) => {
  const hues = [["#c73e2c", "#a87c1f"], ["#3d5a45", "#20211d"], ["#a87c1f", "#c73e2c"], ["#20211d", "#3d5a45"]];
  const [c1, c2] = hues[seed % hues.length];
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="15" cy="18" rx="9" ry="7.5" fill="${c1}"/><circle cx="21" cy="12.5" r="6" fill="${c1}"/><circle cx="23" cy="11.5" r="1.6" fill="#faf6ea"/><path d="M26.5 13.5 30 15l-3.5 1.6z" fill="${c2}"/><path d="M7 16 2.5 13.5 4 19z" fill="${c2}"/><path d="M12 24.5 10 30l5-4z" fill="${c2}"/></svg>`;
};

/* ————— render ————— */
function statBar(key, val) {
  return `<div class="stat"><div class="stat-row"><span>${STAT_LABEL[key]}</span><output>${val}</output></div>
    <div class="bar ${key}"><i style="width:${Math.min(100, val)}%"></i></div></div>`;
}

function render() {
  // chips + hero
  $("chip-grain").textContent = S.grain;
  $("chip-score").textContent = semScore();
  $("stat-birds").textContent = S.sparrows.length;
  $("stat-trials").textContent = S.trials;
  $("stat-best").textContent = S.best;
  const { cur, next } = rankOf(semScore());
  $("stat-rank").textContent = cur[2];
  $("rank-name").textContent = cur[1];
  $("hanko").textContent = cur[2];
  $("score-num").textContent = semScore();
  if (next) {
    const span = next[0] - cur[0], pct = Math.min(100, ((semScore() - cur[0]) / span) * 100);
    $("rank-fill").style.width = pct + "%";
    $("rank-next").textContent = `${next[0] - semScore()} points to ${next[1]} ${next[2]}`;
  } else {
    $("rank-fill").style.width = "100%";
    $("rank-next").textContent = "The yew bows to you. There is no higher seat. 国宝";
  }

  // perches
  for (const key of Object.keys(HALLS)) {
    const box = $("perch-" + key);
    const here = S.sparrows.filter((s) => s.perch === key);
    box.innerHTML = here.length
      ? here.map((s) => `<span class="perch-chip">${s.name}</span>`).join("")
      : `<span class="perch-empty">empty perch…</span>`;
  }

  // roster
  const now = Date.now();
  $("roster").innerHTML = S.sparrows.map((s, i) => {
    const wait = Math.max(0, Math.ceil((s.readyAt - now) / 1000));
    return `<article class="bird" data-kanji="${s.kanji}">
      <div class="bird-top"><span class="bird-glyph">${glyph(i)}</span>
        <div><h4>${s.name} <small>${s.kanji}</small></h4><small>sits in ${HALLS[s.perch].kanji} ${HALLS[s.perch].name}</small></div></div>
      ${statBar("voice", s.voice)}${statBar("stillness", s.stillness)}${statBar("wing", s.wing)}
      <div class="bird-actions">
        <select data-act="perch" data-id="${s.id}" aria-label="Perch class for ${s.name}">
          ${Object.entries(HALLS).map(([k, h]) => `<option value="${k}"${s.perch === k ? " selected" : ""}>${h.kanji} ${h.name}</option>`).join("")}
        </select>
        <button class="mini teach" data-act="attend" data-id="${s.id}"${wait ? " disabled" : ""}>${wait ? `rest ${wait}s` : "📿 attend"}</button>
        <button class="mini" data-act="feed" data-id="${s.id}" title="Feed grain: +2 to all disciplines">🌾 feed</button>
      </div></article>`;
  }).join("");

  // champion select
  const champ = $("champion");
  const prev = champ.value;
  champ.innerHTML = S.sparrows.map((s) =>
    `<option value="${s.id}">${s.name} ${s.kanji} · Voice ${s.voice}</option>`).join("");
  if ([...champ.options].some((o) => o.value === prev)) champ.value = prev;
  updateChampNote();

  // recruit
  const n = S.sparrows.length, maxed = n >= NAMES.length;
  $("btn-recruit").disabled = maxed;
  $("btn-recruit").textContent = maxed ? "The yew is full · 6 sparrows" : `Recruit a sparrow · 🌾${RECRUIT_COST[n - 4] ?? 60}`;
  $("recruit-text").textContent = maxed
    ? "Six sparrows beneath the yew — the seminary is complete."
    : `The yew shelters more lost sparrows… (${NAMES[n].name} ${NAMES[n].kanji} waits at the gate)`;

  // honors
  $("honors").innerHTML = S.honors.length ? S.honors.map((h) =>
    `<li><span class="h-kanji">${h.kanji}</span><span><b>${h.name}</b> preached · ${h.detail}</span><span class="h-score">${h.score}</span></li>`
    ).join("") : `<li class="empty">No sermons yet. The yew waits.</li>`;

  // ledger
  $("ledger").innerHTML = [
    [sumStats(), "training"], [S.trialTotal, "sermons"], [S.best, "best sermon"], [S.grain, "grain"],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");

  store.save(S);
}

function updateChampNote() {
  const s = S.sparrows.find((x) => x.id === $("champion").value) || S.sparrows[0];
  if (s) $("champ-note").textContent =
    `${s.name} carries Voice ${s.voice} · Stillness ${s.stillness} · Wing ${s.wing}. Sermon power ≈ Voice.`;
}

/* ————— roster actions (delegated) ————— */
$("roster").addEventListener("change", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const s = S.sparrows.find((x) => x.id === el.dataset.id); if (!s) return;
  if (el.dataset.act === "perch") {
    s.perch = el.value;
    toast(`${s.name} moves to ${HALLS[s.perch].kanji} ${HALLS[s.perch].name}.`);
    render();
  }
});
$("roster").addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const s = S.sparrows.find((x) => x.id === el.dataset.id); if (!s) return;
  if (el.dataset.act === "attend") {
    if (Date.now() < s.readyAt) return;
    const stat = HALLS[s.perch].stat, gain = 2 + Math.floor(Math.random() * 4);
    s[stat] = Math.min(100, s[stat] + gain);
    s.readyAt = Date.now() + ATTEND_CD;
    toast(`📿 ${s.name} attends ${HALLS[s.perch].name}: +${gain} ${STAT_LABEL[stat]}.`);
    render(); tickCooldowns();
  }
  if (el.dataset.act === "feed") {
    if (S.grain < FEED_COST) { toast("Not enough grain — hold a sermon trial to earn more."); return; }
    S.grain -= FEED_COST;
    for (const k of ["voice", "stillness", "wing"]) s[k] = Math.min(100, s[k] + 2);
    toast(`🌾 ${s.name} is fed: +2 in every discipline.`);
    render();
  }
});
$("champion").addEventListener("change", updateChampNote);

/* attend cooldown countdown */
function tickCooldowns() {
  const waiting = S.sparrows.some((s) => Date.now() < s.readyAt);
  if (!waiting) { render(); return; }
  setTimeout(() => { render(); tickCooldowns(); }, 1000);
}

/* recruit */
$("btn-recruit").addEventListener("click", () => {
  const n = S.sparrows.length;
  if (n >= NAMES.length) return;
  const cost = RECRUIT_COST[n - 4] ?? 60;
  if (S.grain < cost) { toast(`Need 🌾${cost} grain — hold a sermon trial first.`); return; }
  S.grain -= cost;
  S.sparrows.push({ ...NAMES[n], id: "sp" + Date.now(), voice: 5, stillness: 5, wing: 5, perch: "stillness", readyAt: 0 });
  toast(`${NAMES[n].name} ${NAMES[n].kanji} joins the seminary!`);
  render();
});

/* ————— temple tick: perched sparrows grow ————— */
setInterval(() => {
  let grew = false;
  for (const s of S.sparrows) {
    const stat = HALLS[s.perch].stat;
    if (s[stat] < 100 && Math.random() < 0.75) { s[stat] += 1; grew = true; }
  }
  if (grew) { render(); }
}, TICK_MS);

/* ————— morning bell ————— */
$("btn-ring").addEventListener("click", () => {
  const b = $("trial-bell"); b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring");
  document.querySelector("#trials").scrollIntoView({ behavior: "smooth" });
  toast("🔔 The bell echoes down the mountain. The sparrows sit straighter.");
});
$("btn-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
$("btn-reset").addEventListener("click", () => {
  if (!confirm("Disband the seminary? All sparrows, grain and honors will be released.")) return;
  store.clear(); S = freshState(); render();
  toast("The gate stands empty. A new class may begin.");
});

/* ————— sermon trial: 3-round timing game ————— */
const ROUND_WORDS = ["Round one of three", "Round two of three — the light narrows", "Final round — a needle's eye"];
const ZONE_W = [0.24, 0.17, 0.12];
let trial = null;

$("btn-trial").addEventListener("click", () => {
  const s = S.sparrows.find((x) => x.id === $("champion").value) || S.sparrows[0];
  trial = { bird: s, round: 0, scores: [], raf: 0, t0: 0, center: 0.5, live: true };
  $("trial-veil").hidden = false;
  $("trial-title").textContent = `${s.name} ${s.kanji} preaches`;
  $("trial-results").innerHTML = "";
  $("btn-close-trial").hidden = true;
  $("btn-strike").disabled = false;
  document.body.style.overflow = "hidden";
  startRound();
});
function startRound() {
  if (!trial || !trial.live) return;
  $("trial-round").textContent = ROUND_WORDS[trial.round];
  const w = ZONE_W[trial.round];
  trial.center = w / 2 + 0.08 + Math.random() * (1 - w - 0.16);
  const zone = $("zone");
  zone.style.left = (trial.center - w / 2) * 100 + "%";
  zone.style.width = w * 100 + "%";
  trial.t0 = performance.now();
  const speed = 0.55 + trial.round * 0.22; // sweeps per second
  const marker = $("marker");
  cancelAnimationFrame(trial.raf);
  const step = (t) => {
    if (!trial || !trial.live) return;
    const p = ((t - trial.t0) / 1000) * speed % 2;
    const pos = p < 1 ? p : 2 - p; // ping-pong
    trial.pos = pos;
    marker.style.left = `calc(${pos * 100}% - 2px)`;
    trial.raf = requestAnimationFrame(step);
  };
  trial.raf = requestAnimationFrame(step);
}
function strike() {
  if (!trial || !trial.live) return;
  cancelAnimationFrame(trial.raf);
  const w = ZONE_W[trial.round];
  const dist = Math.abs((trial.pos ?? 0) - trial.center);
  const acc = Math.max(0, Math.round(100 * (1 - dist / (w * 1.6))));
  trial.scores.push(acc);
  const li = document.createElement("li");
  li.innerHTML = `<span>${["First", "Second", "Third"][trial.round]} toll</span><b>${acc} / 100</b>`;
  $("trial-results").appendChild(li);
  const b = $("trial-bell"); b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring");
  trial.round++;
  if (trial.round < 3) { setTimeout(startRound, 650); }
  else setTimeout(finishTrial, 650);
}
function finishTrial() {
  if (!trial) return;
  trial.live = false;
  const avg = trial.scores.reduce((a, b) => a + b, 0) / 3;
  const power = 0.5 + trial.bird.voice / 100 + trial.bird.stillness / 400;
  const score = Math.round(avg * power);
  const grain = 4 + Math.round(score / 12);
  S.grain += grain; S.trials++; S.trialTotal += score;
  S.best = Math.max(S.best, score);
  S.honors.unshift({
    name: trial.bird.name, kanji: trial.bird.kanji, score,
    detail: `${Math.round(avg)}% devotion × Voice ${trial.bird.voice}`,
  });
  S.honors = S.honors.slice(0, 6);
  const li = document.createElement("li");
  li.innerHTML = `<span>🌾 +${grain} grain · ⛩ +${score} score</span><b>${score >= 90 ? "国宝！" : score >= 60 ? "見事！" : "合掌"}</b>`;
  $("trial-results").appendChild(li);
  $("trial-round").textContent = `The yew has heard — sermon score ${score}`;
  $("btn-strike").disabled = true;
  $("btn-close-trial").hidden = false;
  $("btn-close-trial").focus();
  render();
}
$("btn-strike").addEventListener("click", strike);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && trial && trial.live && !$("trial-veil").hidden) { e.preventDefault(); strike(); }
});
$("btn-close-trial").addEventListener("click", closeTrial);
$("trial-veil").addEventListener("click", (e) => { if (e.target === $("trial-veil")) closeTrial(); });
function closeTrial() {
  if (trial) { trial.live = false; cancelAnimationFrame(trial.raf); trial = null; }
  $("trial-veil").hidden = true;
  document.body.style.overflow = "";
}

/* ═══════════ SCROLL REACTIONS (the mountain climb) ═══════════ */
const root = document.documentElement;
let lastY = window.scrollY, vel = 0, ticking = false;

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const max = Math.max(1, document.body.scrollHeight - innerHeight);
    const sp = Math.min(1, Math.max(0, y / max));
    root.style.setProperty("--sp", sp.toFixed(4));
    vel = vel * 0.85 + Math.min(30, Math.abs(y - lastY)) * 0.15;
    root.style.setProperty("--vel", vel.toFixed(2));
    lastY = y;
    // rail dots: nearest chapter above middle
    const mid = y + innerHeight * 0.45;
    let active = "hero";
    for (const id of ["hero", "perches", "trials", "score"]) {
      const el = $(id); if (el && el.offsetTop <= mid) active = id;
    }
    document.querySelectorAll(".dot").forEach((d) => d.classList.toggle("lit", d.dataset.ch === active));
    const season = $(active)?.dataset.season;
    if (season) $("chip-season").textContent = season;
    ticking = false;
  });
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);

/* reveal on scroll */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* rail dots jump to chapters */
$("rail-dots").addEventListener("click", (e) => {
  const d = e.target.closest(".dot"); if (!d) return;
  $(d.dataset.ch)?.scrollIntoView({ behavior: "smooth" });
});

/* ————— petal / yew-needle canvas, thickens as you climb ————— */
const cv = $("petals"), ctx = cv.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let flakes = [];
function sizeCanvas() {
  cv.width = Math.min(1200, innerWidth); cv.height = Math.min(900, innerHeight);
}
sizeCanvas(); addEventListener("resize", sizeCanvas);
function seedFlakes() {
  flakes = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 1 + Math.random() * 2.6, vy: 0.0006 + Math.random() * 0.0016,
    ph: Math.random() * Math.PI * 2, sw: 0.2 + Math.random() * 0.8,
    ink: Math.random() < 0.3,
  }));
}
seedFlakes();
function drawPetals(t) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const sp = parseFloat(getComputedStyle(root).getPropertyValue("--sp")) || 0;
  const n = reduced ? 0 : Math.floor(24 + sp * (flakes.length - 24));
  for (let i = 0; i < n; i++) {
    const f = flakes[i];
    f.y += f.vy * (1 + vel * 0.15); if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
    const x = (f.x + Math.sin(t / 1600 + f.ph) * 0.02 * f.sw) * cv.width;
    const y = f.y * cv.height;
    ctx.beginPath();
    ctx.ellipse(x, y, f.r * 1.7, f.r, t / 900 + f.ph, 0, Math.PI * 2);
    ctx.fillStyle = f.ink ? "rgba(32,33,29,.35)" : (i % 3 ? "rgba(199,62,44,.4)" : "rgba(61,90,69,.4)");
    ctx.fill();
  }
  if (!reduced) requestAnimationFrame(drawPetals);
}
if (!reduced) requestAnimationFrame(drawPetals);

/* ————— boot ————— */
render();
onScroll();
tickCooldowns();
console.log("雀の寺 · Yew Sparrow Seminary ready", { sparrows: S.sparrows.length, score: semScore() });
