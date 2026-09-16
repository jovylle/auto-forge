// Slab Serif Speedway — vaporwave variable-font drag strip
// Features: font-fueled controls | live wght/wdth morph | photo-finish posters | shareable replays
// Constraint: must react to scroll (slipstream + parallax + optional scroll-throttle)

const $ = (s) => document.querySelector(s);

const ROSTER = [
  { name: "MEGA",   color: "#ff2fb3", font: '"Roboto Slab",serif', axisNote: "wght 100–900", base: 1.00, jitter: 0.22 },
  { name: "CHROME", color: "#22e6ff", font: '"Archivo",sans-serif', axisNote: "wght + wdth", base: 0.97, jitter: 0.26 },
  { name: "TURBO",  color: "#ffe94a", font: '"Fraunces",serif', axisNote: "wght + opsz", base: 1.03, jitter: 0.30 },
  { name: "NEON",   color: "#9d7bff", font: '"Roboto Slab",serif', axisNote: "wght 100–900", base: 0.94, jitter: 0.18 },
];
const DIST = 1000; // meters
const LS_KEY = "slab-speedway-history-v1";

const state = {
  running: false, finished: false, ghost: false,
  t: 0, seed: (Math.random() * 1e9) | 0,
  player: 0, throttle: 62, ink: 100, slip: 0,
  racers: [], order: [], lastTick: 0, winner: null,
  history: [], raf: 0,
};

// ---------- utils ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}
function loadHistory() {
  try { state.history = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { state.history = []; }
}
function saveHistory() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.history.slice(0, 24))); } catch {}
}

// ---------- build DOM ----------
function buildLanes() {
  const pick = $("#driver-pick"); pick.innerHTML = "";
  ROSTER.forEach((r, i) => {
    const d = document.createElement("div");
    d.className = "driver"; d.setAttribute("role", "radio");
    d.setAttribute("aria-checked", i === state.player ? "true" : "false");
    d.tabIndex = 0;
    d.innerHTML = `<b style="color:${r.color};font-family:${r.font}">${r.name}</b><small>${r.axisNote} · ${i === state.player ? "YOU" : "AI"}</small>`;
    const choose = () => { state.player = i; buildLanes(); toast(`You're driving ${r.name}`); };
    d.onclick = choose;
    d.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } };
    pick.appendChild(d);
  });
  const lanes = $("#lanes"); lanes.innerHTML = "";
  ROSTER.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "lane"; li.id = `lane-${i}`;
    li.innerHTML = `<span class="lane-tag">LANE ${i + 1} · ${r.axisNote}</span>
      <span class="lane-pos" id="pos-${i}">0 m</span>
      <div class="racer" id="racer-${i}" style="color:${r.color}">
        <span class="glyph" id="glyph-${i}" style="font-family:${r.font}">${r.name} ▸</span><span class="boost-flame">🔥</span>
      </div>`;
    lanes.appendChild(li);
  });
  buildReadout();
}
function buildReadout() {
  $("#live-readout").innerHTML = ROSTER.map((r, i) =>
    `<div class="readout" id="read-${i}"><b style="color:${r.color}">${r.name}</b><br><span>—</span></div>`).join("");
}

// ---------- race core ----------
function resetRace(seed = (Math.random() * 1e9) | 0, keepPlayer = true) {
  cancelAnimationFrame(state.raf);
  state.seed = seed; state.t = 0; state.order = [];
  state.running = false; state.finished = false; state.ghost = false; state.winner = null;
  if (!keepPlayer) state.player = 0;
  const rng = mulberry32(seed);
  state.racers = ROSTER.map((r, i) => ({
    ...r, pos: 0, speed: 0, wght: 200, wdth: 85, boost: 0,
    phase: rng() * Math.PI * 2, luck: 0.85 + rng() * 0.3, aiTarget: 0.5 + rng() * 0.5,
  }));
  state.ink = 100;
  updateMeters(); setStatus("● idle — press START or scroll hard to wake the grid");
  $("#race-clock").textContent = "⏱ 0.0s";
  renderFrame(0);
}
function startRace(ghost = false) {
  if (state.running) return;
  if (state.finished && !ghost) resetRace();
  state.running = true; state.ghost = ghost; state.lastTick = performance.now();
  setStatus(ghost ? "👻 ghost replay rolling…" : "● RACING — type to fuel, scroll to slipstream, BOOST to send it");
  state.raf = requestAnimationFrame(tick);
}
function setStatus(s) { $("#race-status").textContent = s; }

function tick(now) {
  const dt = Math.min(0.05, (now - state.lastTick) / 1000 || 0.016);
  state.lastTick = now;
  state.t += dt;
  state.slip = Math.max(0, state.slip - dt * 0.45); // decay

  const rngT = state.t;
  state.racers.forEach((r, i) => {
    const isPlayer = i === state.player && !state.ghost;
    // driver input
    let drive;
    if (state.ghost || !isPlayer) {
      // deterministic AI: sine wander + seeded luck, slipstream helps all
      drive = r.aiTarget * r.luck + 0.18 * Math.sin(rngT * (0.7 + i * 0.23) + r.phase) + 0.3;
      if (state.ghost) drive = ghostDrive(i, state.t); // replay overrides
    } else {
      drive = state.throttle / 100;
      if ($("#scroll-throttle").checked) drive += state.slip * 0.9;
    }
    drive = Math.max(0.05, drive + state.slip * 0.55);
    // boost
    if (r.boost > 0) { r.boost -= dt; drive += 1.6; }
    const target = (46 + i * 2) * ROSTER[i].base * drive * (0.9 + 0.2 * Math.sin(rngT * 3 + r.phase));
    r.speed += (target - r.speed) * Math.min(1, dt * 2.2);
    r.pos += r.speed * dt * (state.ghost ? 1 : 1);
    // finish
    if (r.pos >= DIST && !state.order.includes(i)) {
      state.order.push(i);
      if (!state.winner) onWinner(i);
    }
    // live variable morph
    const norm = Math.min(1, r.speed / 130);
    r.wght = Math.round(180 + norm * 720 + (r.boost > 0 ? 60 : 0));
    r.wdth = Math.round(78 + norm * 47);
  });

  renderFrame(dt);
  $("#race-clock").textContent = `⏱ ${state.t.toFixed(1)}s`;
  updateMeters();

  if (state.order.length < ROSTER.length && state.t < 90) {
    state.raf = requestAnimationFrame(tick);
  } else {
    finishRace();
  }
}

// Deterministic ghost: recompute AI drive purely from seed+time (no live input)
function ghostDrive(i, t) {
  const rng = mulberry32(state.seed + i * 999);
  const a = rng(), b = rng(), c = rng();
  return 0.55 + 0.25 * Math.sin(t * (0.6 + a * 0.5) + b * 6.28) + c * 0.2 + state.slip * 0.2;
}

function renderFrame() {
  const wrap = $("#track-wrap");
  const trackW = wrap.clientWidth - 90;
  const leader = Math.max(...state.racers.map((r) => r.pos), 1);
  state.racers.forEach((r, i) => {
    const frac = Math.min(1, r.pos / DIST);
    const el = $(`#racer-${i}`);
    el.style.left = `calc(${8 + frac * 100}% * 0 + ${8 + frac * (trackW - 40)}px)`;
    const g = $(`#glyph-${i}`);
    const norm = Math.min(1, r.speed / 130);
    const scaleX = 0.82 + norm * 0.45;
    const skew = r.boost > 0 ? -4 : norm * -6;
    g.style.fontVariationSettings = `"wght" ${Math.min(900, r.wght)}`;
    g.style.fontStretch = `${Math.min(125, Math.max(62, r.wdth))}%`;
    g.style.transform = `scaleX(${scaleX.toFixed(3)}) skewX(${skew.toFixed(1)}deg)`;
    g.style.fontWeight = Math.min(900, r.wght);
    el.classList.toggle("boosting", r.boost > 0);
    $(`#pos-${i}`).textContent = `${Math.min(DIST, r.pos | 0)} m · ${r.speed.toFixed(0)} km/h`;
    const read = $(`#read-${i}`);
    if (read) read.innerHTML = `<b style="color:${r.color}">${r.name}</b><br>wght ${Math.min(900, r.wght)} · wd ${Math.min(125, Math.max(62, r.wdth))} · ${r.speed.toFixed(0)}km/h`;
    $(`#lane-${i}`).classList.toggle("leader", r.pos === leader && state.running);
  });
  const done = Math.min(1, leader / DIST);
  $("#dist-bar").style.width = `${done * 100}%`;
  // chrome-cam: subtle track shake with leader speed
  if ($("#auto-cam").checked && state.running) {
    const s = Math.max(...state.racers.map((r) => r.speed));
    wrap.style.transform = `translateX(${(-s * 0.02).toFixed(1)}px)`;
  } else wrap.style.transform = "";
}

function updateMeters() {
  $("#ink-bar").style.width = `${state.ink}%`;
  $("#ink-label").textContent = `(ink ${Math.round(state.ink)})`;
  $("#slip-bar").style.width = `${Math.min(100, state.slip * 100)}%`;
  const sv = state.slip > 0.6 ? "OVERDRIVE 🌊" : state.slip > 0.15 ? "slipstreaming…" : "scroll to charge";
  $("#slip-val").textContent = sv;
  $("#scroll-slip").style.width = `${Math.min(100, state.slip * 100)}%`;
}

function onWinner(i) {
  state.winner = i;
  const flash = $("#cam-flash");
  flash.classList.remove("show"); void flash.offsetWidth; flash.classList.add("show");
  setStatus(`📸 ${ROSTER[i].name} takes it in ${state.t.toFixed(1)}s!`);
}

function finishRace() {
  state.running = false; state.finished = true;
  // anyone not finished gets ranked by position
  const ranked = [...state.racers.keys()].sort((a, b) =>
    (state.order.indexOf(a) === -1 ? 99 : state.order.indexOf(a)) - (state.order.indexOf(b) === -1 ? 99 : state.order.indexOf(b)) ||
    state.racers[b].pos - state.racers[a].pos);
  state.order = ranked;
  const w = state.racers[state.winner ?? ranked[0]];
  setStatus(`🏁 ${ROSTER[ranked[0]].name} wins in ${state.t.toFixed(1)}s — poster ready below`);
  renderPoster(ranked);
  mintReplay(ranked);
  pushHistory(ranked);
}

function boost() {
  if (!state.running) startRace(false);
  const r = state.racers[state.player];
  if (state.ink < 25) { toast("⛽ out of ink — type to refuel!"); return; }
  state.ink -= 25; r.boost = 1.4;
  toast(`⚡ ${ROSTER[state.player].name} BOOST — wght 900!`);
}

// ---------- scroll reaction (constraint) ----------
let lastY = window.scrollY, lastT = performance.now();
function onScroll() {
  const now = performance.now();
  const dy = Math.abs(window.scrollY - lastY);
  const dt = Math.max(16, now - lastT);
  const vel = dy / dt; // px per ms
  lastY = window.scrollY; lastT = now;
  if (vel > 0.15) {
    state.slip = Math.min(1.2, state.slip + vel * 0.55);
    if (!state.running && !state.finished && vel > 0.9) startRace(false); // scroll wakes grid
  }
  // parallax sun + grid
  const y = window.scrollY;
  const sun = $("#sun");
  if (sun) sun.style.transform = `translateX(-50%) translateY(${Math.min(160, y * 0.12)}px) scale(${1 + Math.min(0.25, state.slip * 0.2)})`;
  updateMeters();
}

// ---------- poster ----------
function renderPoster(ranked) {
  const cv = $("#poster"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const win = ROSTER[ranked[0]];
  const chrome = $("#poster-chrome").checked, grid = $("#poster-grid").checked;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0d0221"); sky.addColorStop(0.42, "#3d0a54");
  sky.addColorStop(0.58, "#ff2fb3"); sky.addColorStop(0.66, "#1a0533"); sky.addColorStop(1, "#0d0221");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // sun
  const sx = W / 2, sy = H * 0.52, sr = 240;
  const sunG = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sunG.addColorStop(0, "#ffe94a"); sunG.addColorStop(0.55, "#ff2fb3"); sunG.addColorStop(1, "#7b2ff7");
  ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, Math.PI, 0); ctx.fillStyle = sunG; ctx.fill();
  ctx.fillStyle = "#0d0221";
  for (let i = 0; i < 6; i++) ctx.fillRect(sx - sr - 10, sy - 40 + i * 26 + i * i * 1.6, sr * 2 + 20, 8 + i * 2);
  ctx.restore();
  // grid
  if (grid) {
    ctx.strokeStyle = "#22e6ff88"; ctx.lineWidth = 2;
    for (let i = 0; i <= 14; i++) {
      ctx.beginPath(); ctx.moveTo(W / 2, sy + 20);
      ctx.lineTo(W / 2 + (i - 7) * 160, H); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const y = sy + 24 + i * i * 6 + i * 14;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }
  // text
  ctx.textAlign = "center";
  ctx.fillStyle = "#22e6ff"; ctx.font = "700 34px monospace";
  ctx.fillText("★ S L A B  S E R I F  S P E E D W A Y ★", W / 2, 90);
  ctx.fillStyle = "#fff"; ctx.font = "700 30px monospace";
  ctx.fillText(`PHOTO FINISH · ${new Date().toLocaleDateString()} · ${state.t.toFixed(1)}s`, W / 2, 135);
  const title = `${win.name} WINS`;
  ctx.font = `900 150px "Roboto Slab", serif`;
  if (chrome) {
    const g = ctx.createLinearGradient(0, 300, 0, 520);
    g.addColorStop(0, "#fff"); g.addColorStop(0.45, "#9be9ff");
    g.addColorStop(0.5, "#0b1035"); g.addColorStop(0.55, "#ff9de2"); g.addColorStop(1, "#fff");
    ctx.fillStyle = g;
  } else ctx.fillStyle = win.color;
  // horizontal-condense to fit
  let size = 150;
  while (ctx.measureText(title).width > W - 80 && size > 40) { size -= 8; ctx.font = `900 ${size}px "Roboto Slab", serif`; }
  ctx.fillText(title, W / 2, 470);
  ctx.font = `900 64px "Roboto Slab", serif`; ctx.fillStyle = win.color;
  ctx.fillText("▸▸▸ " + "━".repeat(12), W / 2, 560);
  // standings with final weights baked in
  ctx.textAlign = "left"; let y = 700;
  ctx.font = "700 34px monospace"; ctx.fillStyle = "#ffe94a";
  ctx.fillText("FINAL STANDINGS — weight reflects top speed:", 60, y); y += 54;
  ranked.forEach((ri, pos) => {
    const r = state.racers[ri];
    const medal = ["🥇", "🥈", "🥉", "4."][pos];
    ctx.font = "400 30px monospace"; ctx.fillStyle = "#fff";
    ctx.fillText(`${medal} ${ROSTER[ri].name} — ${(DIST / Math.max(1, state.t - pos * 0.4)).toFixed(0)} km/h avg · wght ${Math.min(900, r.wght)}`, 60, y);
    y += 48;
  });
  y += 30;
  ctx.fillStyle = "#22e6ff"; ctx.font = "400 26px monospace";
  ctx.fillText("scroll = slipstream · typing = ink · speed warps type", W / 2 - 380, y);
  ctx.fillText(`replay seed ${state.seed} · slab-serif-speedway`, W / 2 - 380, y + 40);

  $("#poster-title").textContent = `🏆 ${win.name} takes the photo finish!`;
  $("#poster-sub").textContent = `Seed ${state.seed} · ${state.t.toFixed(1)}s · order ${ranked.map((i) => ROSTER[i].name).join(" › ")}`;
  $("#poster-stats").innerHTML = ranked.map((ri, k) =>
    `<div>${["🥇", "🥈", "🥉", "4."][k]} <b style="color:${ROSTER[ri].color}">${ROSTER[ri].name}</b> — pos ${Math.min(DIST, state.racers[ri].pos | 0)}m · top wght ${Math.min(900, state.racers[ri].wght)}</div>`).join("");
}

// ---------- replay share ----------
function encodeReplay(ranked) {
  const payload = { v: 1, seed: state.seed, player: state.player, order: ranked, t: +state.t.toFixed(1) };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeReplay(s) {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch { return null; }
}
function mintReplay(ranked) {
  const code = encodeReplay(ranked);
  const url = `${location.origin}${location.pathname}#r=${code}`;
  const link = $("#replay-link");
  link.value = location.protocol === "file:" ? `${location.href.split("#")[0]}#r=${code}` : url;
  $("#replay-meta").textContent = `seed ${state.seed} · driver ${ROSTER[state.player].name} · ${state.t.toFixed(1)}s · open the link anywhere to ghost-replay`;
}
function pushHistory(ranked) {
  loadHistory();
  state.history.unshift({
    when: Date.now(), seed: state.seed, player: state.player,
    order: ranked, t: +state.t.toFixed(1), code: encodeReplay(ranked),
  });
  saveHistory(); renderHistory();
}
function renderHistory() {
  const h = $("#history");
  $("#history-count").textContent = state.history.length;
  h.innerHTML = state.history.length ? "" : `<li class="muted">No races yet — your finishes archive here + persist via localStorage.</li>`;
  state.history.forEach((r, idx) => {
    const li = document.createElement("li");
    const d = new Date(r.when).toLocaleString();
    li.innerHTML = `<span>🏁 ${r.order.map((i) => ROSTER[i].name).join("›")} · ${r.t}s<br><small class="muted">${d} · seed ${r.seed}</small></span>`;
    const b = document.createElement("button"); b.textContent = "replay";
    b.onclick = () => loadReplayCode(r.code);
    li.appendChild(b); h.appendChild(li);
  });
}
function loadReplayCode(code) {
  const p = decodeReplay(code);
  if (!p) { toast("bad replay link"); return; }
  state.player = p.player ?? 0; buildLanes();
  resetRace(p.seed);
  document.querySelector("#track-section").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => startRace(true), 600);
  toast(`👻 ghost replay — seed ${p.seed}`);
}

// ---------- events ----------
function bind() {
  $("#btn-start").onclick = () => startRace(false);
  $("#btn-reset").onclick = () => { resetRace(); toast("grid reset"); };
  $("#btn-boost").onclick = boost;
  $("#cta-replay-top").onclick = () => {
    if (state.history[0]) loadReplayCode(state.history[0].code);
    else toast("no races yet — run one first");
  };
  $("#cta-race").addEventListener("click", () => setTimeout(() => startRace(false), 500));
  $("#throttle").oninput = (e) => { state.throttle = +e.target.value; $("#throttle-val").textContent = `${state.throttle}%`; };
  const fuel = $("#fuel-input");
  fuel.addEventListener("input", () => {
    state.ink = Math.min(100, state.ink + 2.5);
    const r = state.racers[state.player];
    if (r && state.running) { r.boost = Math.max(r.boost, 0.25); }
    updateMeters();
    if (fuel.value.length > 40) fuel.value = "";
  });
  fuel.addEventListener("keydown", (e) => { if (e.key === "Enter") boost(); });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== fuel) { e.preventDefault(); state.running ? boost() : startRace(false); }
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => renderFrame());

  $("#btn-poster").onclick = () => {
    if (!state.finished) { toast("finish a race first"); return; }
    renderPoster(state.order); toast("🖨 poster rendered");
  };
  ["poster-chrome", "poster-grid"].forEach((id) => $(`#${id}`).onchange = () => { if (state.finished) renderPoster(state.order); });
  $("#btn-download").onclick = () => {
    if (!state.finished) { toast("finish a race first"); return; }
    const a = document.createElement("a");
    a.download = `slab-speedway-${state.seed}.png`;
    a.href = $("#poster").toDataURL("image/png"); a.click();
    toast("⬇ poster saved");
  };
  $("#btn-copy-text").onclick = async () => {
    const txt = state.finished
      ? `🏁 SLAB SERIF SPEEDWAY — ${state.order.map((i) => ROSTER[i].name).join(" › ")} in ${state.t.toFixed(1)}s (seed ${state.seed}) ${$("#replay-link").value}`
      : "Run a race first!";
    try { await navigator.clipboard.writeText(txt); toast("⧉ results copied"); }
    catch { toast("copy blocked — select the link manually"); }
  };
  $("#btn-copy-link").onclick = async () => {
    try { await navigator.clipboard.writeText($("#replay-link").value); toast("🔗 replay link copied"); }
    catch { $("#replay-link").select(); toast("select + copy the link"); }
  };
  $("#btn-ghost").onclick = () => {
    const m = $("#replay-link").value.match(/#r=([A-Za-z0-9\-_]+)/);
    if (m) loadReplayCode(m[1]);
    else if (state.history[0]) loadReplayCode(state.history[0].code);
    else toast("no replay yet");
  };
  $("#btn-clear-history").onclick = () => {
    state.history = []; saveHistory(); renderHistory(); toast("archive cleared");
  };

  // reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

// ---------- init ----------
loadHistory();
buildLanes();
resetRace();
renderHistory();
bind();
// poster placeholder
(() => {
  const ctx = $("#poster").getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, "#0d0221"); g.addColorStop(0.5, "#3d0a54"); g.addColorStop(0.62, "#ff2fb3"); g.addColorStop(1, "#0d0221");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#22e6ff"; ctx.textAlign = "center"; ctx.font = "700 44px monospace";
  ctx.fillText("YOUR PHOTO FINISH", 540, 640);
  ctx.fillStyle = "#ffe94a"; ctx.font = "900 90px 'Roboto Slab', serif";
  ctx.fillText("APPEARS HERE", 540, 740);
})();
// deep-link replay?
if (location.hash.includes("r=")) {
  const code = location.hash.split("r=")[1].split("&")[0];
  setTimeout(() => loadReplayCode(code), 800);
}
console.log("slab-serif-speedway ready — scroll = slipstream, type = fuel");
