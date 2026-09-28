// Opal Ferry Terminal — living board + bay viz + crossing bell
// Keyboard-only operable. No deps. Works from file://.

const $ = (s) => document.querySelector(s);
const boardList = $("#board-list");
const canvas = $("#bay");
const ctx = canvas.getContext("2d");
const clockEl = $("#clock");
const tallyEl = $("#tally-crossings");
const liveEl = $("#bay-live");
const detailEl = $("#detail");
const logEl = $("#log");
const toastEl = $("#toast");
const bellBtn = $("#bell-btn");
const bellFlash = $("#bell-flash");
const muteBox = $("#mute");
const autoBellBox = $("#auto-bell");

const LS_KEY = "opal-ferry-terminal-v1";
const store = load() || { crossings: 0, log: [], muted: false };
function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch {} }

const BOATS = ["⛴", "🚢", "🛥", "⛵", "🛶"];
const NAMES = ["Opal Queen", "Kelp Runner", "Gullwing", "Barnacle Belle", "Driftwood"];
const ROUTES = [
  { from: "Opal Terminal", to: "Kelp Point", dur: 46 },
  { from: "Kelp Point", to: "Opal Terminal", dur: 46 },
  { from: "Opal Terminal", to: "Gull Rock", dur: 64 },
  { from: "Gull Rock", to: "Opal Terminal", dur: 64 },
  { from: "Kelp Point", to: "Gull Rock", dur: 38 },
];
const STATUSES = ["boarding", "enroute", "enroute", "docked", "delayed"];

let ferries = NAMES.map((name, i) => ({
  id: i, name, boat: BOATS[i % BOATS.length],
  route: { ...ROUTES[i % ROUTES.length] },
  progress: [0.1, 0.45, 0.7, 0.9, 0.3][i],
  dir: i % 2 === 0 ? 1 : -1,
  speed: [0.022, 0.03, 0.018, 0.026, 0.034][i],
  status: STATUSES[i],
  dockTimer: 0,
  eta: 0,
}));

let selected = 0;
let paused = false;
let muted = !!store.muted;
let t = 0;
muteBox.checked = muted;
tallyEl.textContent = store.crossings;
renderLog();

// ---------- clock ----------
function tickClock() {
  const d = new Date();
  clockEl.textContent = d.toLocaleTimeString("en-GB");
}
tickClock(); setInterval(tickClock, 1000);

// ---------- toast ----------
let toastT = null;
function toast(msg) {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => (toastEl.hidden = true), 2200);
}

// ---------- bell (WebAudio, lazy init on first gesture/key) ----------
let actx = null;
function ensureAudio() {
  if (actx) return actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  return actx;
}
function bellTone(freq, when, dur = 1.4, gain = 0.22) {
  const ac = ensureAudio();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(ac.destination);
  o.start(when);
  o.stop(when + dur + 0.1);
  // strike partial
  const o2 = ac.createOscillator();
  const g2 = ac.createGain();
  o2.type = "triangle";
  o2.frequency.value = freq * 2.76;
  g2.gain.setValueAtTime(0.0001, when);
  g2.gain.exponentialRampToValueAtTime(gain * 0.25, when + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
  o2.connect(g2).connect(ac.destination);
  o2.start(when); o2.stop(when + 0.7);
}
function ringBell(reason = "Manual ring") {
  bellBtn.classList.remove("ringing");
  void bellBtn.offsetWidth;
  bellBtn.classList.add("ringing");
  bellFlash.classList.add("show");
  setTimeout(() => bellFlash.classList.remove("show"), 1200);
  if (!muted) {
    const ac = ensureAudio();
    if (ac && ac.state === "suspended") ac.resume();
    const now = ac ? ac.currentTime : 0;
    if (ac) { bellTone(659.25, now); bellTone(987.77, now + 0.28, 1.8, 0.18); }
  }
  const f = ferries[selected];
  addLog(reason, f ? f.name : "");
  toast(muted ? `🔕 ${reason} (muted)` : `🔔 ${reason}`);
}
function addLog(reason, boat, silentCount) {
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (!silentCount) {
    store.crossings++;
    tallyEl.textContent = store.crossings;
  }
  store.log.unshift(`${time} — ${reason}${boat ? " · " + boat : ""}`);
  store.log = store.log.slice(0, 12);
  save();
  renderLog();
}
function renderLog() {
  logEl.innerHTML = "";
  if (!store.log.length) {
    const li = document.createElement("li");
    li.textContent = "No rings yet — press B to ring the bell.";
    logEl.appendChild(li);
    return;
  }
  for (const entry of store.log) {
    const li = document.createElement("li");
    const [time, rest] = entry.split(" — ");
    li.innerHTML = "";
    const b = document.createElement("b");
    b.textContent = time;
    li.append(b, document.createTextNode(" — " + (rest || "")));
    logEl.appendChild(li);
  }
}

// ---------- board ----------
function statusFor(f) {
  if (f.status === "delayed") return "delayed";
  if (f.status === "docked" || f.status === "boarding") return f.status;
  return "enroute";
}
function fmtETA(f) {
  if (f.status === "docked") return "DOCKED";
  if (f.status === "boarding") return "BOARDING";
  if (f.status === "delayed") return "DELAYED";
  const secs = Math.max(1, Math.round((1 - f.progress) * f.route.dur));
  return secs > 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
}
function renderBoard() {
  boardList.innerHTML = "";
  ferries.forEach((f, i) => {
    const b = document.createElement("button");
    b.className = "ferry-row";
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", i === selected ? "true" : "false");
    b.tabIndex = i === selected ? 0 : -1;
    b.dataset.id = i;
    b.setAttribute("aria-label", `${f.name}, ${f.route.from} to ${f.route.to}, ${statusFor(f)}, ETA ${fmtETA(f)}. Press Enter to hail.`);
    const st = statusFor(f);
    b.innerHTML = `<span class="hull" aria-hidden="true">${f.boat}</span>
      <span><span class="name">${f.name} <span class="status ${st}">${st}</span></span>
      <span class="route">${f.route.from} ⇆ ${f.route.to}</span>
      <span class="meta"><span class="eta">ETA ${fmtETA(f)}</span><span>· ${(f.progress * 100).toFixed(0)}% across</span></span>
      <span class="progress" aria-hidden="true"><i style="width:${(f.progress * 100).toFixed(1)}%"></i></span></span>
      <span class="meta" aria-hidden="true"><kbd>${i + 1}</kbd></span>`;
    b.addEventListener("click", () => select(i, true));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); select((i + 1) % ferries.length, true); }
      if (e.key === "ArrowUp") { e.preventDefault(); select((i - 1 + ferries.length) % ferries.length, true); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hail(i); }
    });
    boardList.appendChild(b);
  });
  const f = ferries[selected];
  detailEl.innerHTML = `<strong>${f.boat} ${f.name}</strong> — ${f.route.from} → ${f.route.to} · <strong>${statusFor(f).toUpperCase()}</strong> · ${Math.round(f.progress * 100)}% across · ETA ${fmtETA(f)}`;
  const enroute = ferries.filter((x) => statusFor(x) === "enroute").length;
  liveEl.textContent = paused
    ? `Tide held. ${enroute} en route · ${ferries.length} ferries on the board. Selected: ${f.name}.`
    : `${enroute} en route · ${ferries.length} ferries on the bay. Selected: ${f.name}, ${Math.round(f.progress * 100)}% across.`;
}
function select(i, focus) {
  selected = (i + ferries.length) % ferries.length;
  renderBoard();
  if (focus) {
    const el = boardList.querySelector(`[data-id="${selected}"]`);
    if (el) el.focus();
  }
}
function hail(i = selected) {
  const f = ferries[i];
  ensureAudio();
  if (f.status === "docked" || f.status === "boarding") {
    f.status = "enroute"; f.dockTimer = 0;
    toast(`📣 ${f.name} casting off — ${f.route.from} → ${f.route.to}`);
  } else if (f.status === "delayed") {
    f.status = "enroute";
    toast(`📣 ${f.name} back underway — delay cleared`);
  } else {
    toast(`📣 ${f.name} sounds its horn — ${Math.round(f.progress * 100)}% across`);
    horn();
  }
  renderBoard();
}
function horn() {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  const now = ac.currentTime;
  [174, 174].forEach((fr, k) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sawtooth"; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, now + k * 0.02);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.05 + k * 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.connect(g).connect(ac.destination);
    o.start(now + k * 0.02); o.stop(now + 0.7);
  });
}
function dispatch() {
  ensureAudio();
  const docked = ferries.find((f) => f.status === "docked" || f.status === "boarding");
  if (docked) {
    docked.status = "enroute"; docked.dockTimer = 0;
    select(docked.id, false);
    toast(`＋ ${docked.name} dispatched — ${docked.route.to} bound`);
  } else {
    // relaunch the most-progressed ferry back the other way
    const f = [...ferries].sort((a, b) => b.progress - a.progress)[0];
    f.progress = 0; f.dir = f.dir === 1 ? -1 : 1;
    const tmp = f.route.from; f.route.from = f.route.to; f.route.to = tmp;
    f.status = "enroute";
    select(f.id, false);
    toast(`＋ ${f.name} turned around — now ${f.route.from} → ${f.route.to}`);
  }
  renderBoard();
}

// ---------- sim ----------
function step(dt) {
  if (paused) return;
  t += dt;
  let changed = false;
  for (const f of ferries) {
    if (f.status === "delayed") {
      if (Math.random() < dt * 0.05) { f.status = "enroute"; toast(`✅ ${f.name} delay cleared`); }
      continue;
    }
    if (f.status === "docked" || f.status === "boarding") {
      f.dockTimer += dt;
      if (f.dockTimer > 5) {
        // cast off again, swap direction
        f.progress = 0;
        f.dir = f.dir === 1 ? -1 : 1;
        const tmp = f.route.from; f.route.from = f.route.to; f.route.to = tmp;
        f.status = "enroute"; f.dockTimer = 0;
      }
      changed = true;
      continue;
    }
    f.progress += f.speed * dt * (f.dir === 1 ? 1 : 1);
    if (Math.random() < dt * 0.008 && f.status === "enroute") {
      f.status = "delayed";
      toast(`🌫 ${f.name} delayed — gull strike on the bow`);
    }
    if (f.progress >= 1) {
      f.progress = 1;
      f.status = "docked";
      f.dockTimer = 0;
      if (autoBellBox.checked) ringBell(`Docking — ${f.name} reached ${f.route.to}`);
      else { store.crossings++; tallyEl.textContent = store.crossings; save(); toast(`⚓ ${f.name} docked at ${f.route.to}`); }
    }
    changed = true;
  }
  if (changed) renderBoard();
}

// ---------- bay viz (canvas) ----------
function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(600, Math.round(r.width * dpr));
  canvas.height = Math.round(canvas.width * 0.575);
}
window.addEventListener("resize", fitCanvas);

function draw() {
  const W = canvas.width, H = canvas.height;
  // water
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#175153"); g.addColorStop(0.55, "#0e2a2b"); g.addColorStop(1, "#071314");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun / opal shimmer
  const sx = W * 0.5 + Math.sin(t * 0.1) * W * 0.05, sy = H * 0.22;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, W * 0.22);
  glow.addColorStop(0, "rgba(255,211,182,.85)");
  glow.addColorStop(0.35, "rgba(168,230,207,.35)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffd3b6";
  ctx.beginPath(); ctx.arc(sx, sy, H * 0.045, 0, 7); ctx.fill();
  // wave lines
  ctx.lineWidth = Math.max(1.5, W / 500);
  for (let r = 0; r < 7; r++) {
    const y = H * (0.42 + r * 0.08);
    ctx.strokeStyle = `rgba(168,230,207,${0.28 - r * 0.025})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const yy = y + Math.sin(x / (W * 0.06) + t * (1 + r * 0.15) + r) * (3 + r * 1.6);
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // islands / docks
  const westX = W * 0.08, eastX = W * 0.92, dockY = H * 0.52;
  drawDock(westX, dockY, "OPAL", "#4a7c59", true);
  drawDock(eastX, dockY, "KELP", "#e9b44c", false);
  drawRock(W * 0.5, H * 0.78, W * 0.05, "GULL ROCK");
  // route lane
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = "rgba(236,227,208,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(westX, dockY + 26); ctx.quadraticCurveTo(W / 2, dockY + H * 0.22, eastX, dockY + 26); ctx.stroke();
  ctx.setLineDash([]);
  // ferries
  ferries.forEach((f, i) => {
    const x = westX + (eastX - westX) * (f.dir === 1 ? f.progress : 1 - f.progress);
    const laneOff = (i - 2) * H * 0.035;
    const y = dockY + 26 + Math.sin(f.progress * Math.PI) * H * 0.16 + laneOff + Math.sin(t * 2 + i * 1.7) * 3;
    drawWake(x, y, f.dir, i);
    drawFerry(x, y, f, i === selected, W);
  });
  // gulls
  ctx.strokeStyle = "rgba(236,227,208,.8)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const gx = (t * 30 * (1 + k * 0.2) + k * W * 0.3) % (W + 80) - 40;
    const gy = H * (0.14 + k * 0.05) + Math.sin(t * 2 + k) * 6;
    const w = 10 + (k % 3) * 4;
    ctx.beginPath();
    ctx.arc(gx - w / 2, gy, w / 2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.arc(gx + w / 2, gy, w / 2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  if (paused) {
    ctx.fillStyle = "rgba(8,25,26,.55)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ece3d0";
    ctx.font = `700 ${Math.round(W / 22)}px "Space Mono", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("❚❚  TIDE HELD — press P to release", W / 2, H / 2);
  }
}
function drawDock(x, y, label, color, left) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#10201f"; ctx.lineWidth = 4;
  const w = 90, h = 26;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 40, w, 40, 6);
  ctx.fill(); ctx.stroke();
  // pilings
  ctx.fillStyle = "#10201f";
  for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * 30 - 3, y, 6, 26);
  // pier arm
  ctx.fillStyle = "#d8d2c4";
  ctx.strokeStyle = "#10201f";
  ctx.beginPath(); ctx.roundRect(left ? x - 8 : x - 62, y, 70, 12, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#10201f";
  ctx.font = `700 ${Math.max(11, canvas.width / 55)}px "Space Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - 48);
}
function drawRock(x, y, r, label) {
  ctx.fillStyle = "#2e5339";
  ctx.strokeStyle = "#10201f"; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, 7);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ece3d0";
  ctx.font = `700 ${Math.max(10, canvas.width / 60)}px "Space Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - r * 0.85);
}
function drawWake(x, y, dir, i) {
  const f = ferries[i];
  const len = 20 + f.progress * 60;
  const grad = ctx.createLinearGradient(x, 0, x - dir * len, 0);
  grad.addColorStop(0, "rgba(236,227,208,.5)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x - dir * len / 2, y + 10, len / 2, 6 + Math.sin(t * 3 + i) * 1.5, 0, 0, 7);
  ctx.fill();
}
function drawFerry(x, y, f, sel, W) {
  const s = Math.max(0.8, W / 800);
  ctx.save();
  ctx.translate(x, y);
  if (sel) {
    ctx.strokeStyle = "#e9b44c"; ctx.lineWidth = 4;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.ellipse(0, 4, 44 * s, 20 * s, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  }
  // smoke
  ctx.fillStyle = "rgba(236,227,208,.5)";
  for (let k = 0; k < 3; k++) {
    const px = -6 * s + Math.sin(t * 2 + k + f.id) * 4;
    const py = -30 * s - k * 10 * s + ((t * 14 + k * 22) % 26);
    ctx.beginPath(); ctx.arc(px, py - 12, (7 - k * 1.5) * s, 0, 7); ctx.fill();
  }
  // hull
  ctx.fillStyle = f.status === "delayed" ? "#c1502e" : "#ece3d0";
  ctx.strokeStyle = "#10201f"; ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(-34 * s, -10 * s, 68 * s, 24 * s, [4, 4, 12, 12]);
  ctx.fill(); ctx.stroke();
  // cabin
  ctx.fillStyle = "#4a7c59";
  ctx.beginPath(); ctx.roundRect(-22 * s, -26 * s, 44 * s, 18 * s, 4); ctx.fill(); ctx.stroke();
  // windows
  ctx.fillStyle = "#ffd3b6";
  for (let k = -1; k <= 1; k++) ctx.fillRect(k * 13 * s - 4 * s, -22 * s, 8 * s, 8 * s);
  // funnel
  ctx.fillStyle = "#c1502e";
  ctx.fillRect(8 * s, -36 * s, 10 * s, 12 * s);
  ctx.strokeRect(8 * s, -36 * s, 10 * s, 12 * s);
  // flag + name
  ctx.fillStyle = "#10201f";
  ctx.font = `700 ${Math.round(13 * s)}px "Space Mono", monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${f.boat} ${f.id + 1}`, 0, 30 * s);
  // delay mark
  if (f.status === "delayed") {
    ctx.font = `${Math.round(18 * s)}px sans-serif`;
    ctx.fillText("⚠", 0, -40 * s);
  }
  ctx.restore();
}

// ---------- main loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- wiring ----------
$("#btn-dispatch").addEventListener("click", dispatch);
$("#btn-pause").addEventListener("click", togglePause);
function togglePause() {
  paused = !paused;
  $("#btn-pause").setAttribute("aria-pressed", String(paused));
  $("#btn-pause").innerHTML = paused ? `▶ Release tide <kbd>P</kbd>` : `❚❚ Hold tide <kbd>P</kbd>`;
  toast(paused ? "❚❚ Tide held — sim paused" : "▶ Tide released");
  renderBoard();
}
bellBtn.addEventListener("click", () => ringBell(`Manual ring — ${ferries[selected].name}`));
muteBox.addEventListener("change", () => {
  muted = muteBox.checked; store.muted = muted; save();
  toast(muted ? "🔕 Bell muted" : "🔔 Bell live");
});
$("#btn-reset").addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  store.crossings = 0; store.log = [];
  tallyEl.textContent = "0"; renderLog();
  toast("Terminal memory cleared");
});

boardList.addEventListener("focus", () => {
  const el = boardList.querySelector(`[data-id="${selected}"]`);
  if (el && document.activeElement === boardList) el.focus();
});
canvas.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(selected + 1, false); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(selected - 1, false); }
  if (e.key === "Enter") { e.preventDefault(); hail(); }
});

document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea";
  if (e.key === " " && tag !== "button" && !typing) { e.preventDefault(); togglePause(); return; }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === "n") { dispatch(); }
  else if (k === "p") { togglePause(); }
  else if (k === "b") { ringBell(`Manual ring — ${ferries[selected].name}`); }
  else if (k === "m") { muteBox.checked = !muteBox.checked; muteBox.dispatchEvent(new Event("change")); }
  else if (k >= "1" && k <= String(ferries.length)) { select(Number(k) - 1, true); }
  else if (e.key === "ArrowDown" && !boardList.contains(document.activeElement) && tag !== "button") { e.preventDefault(); select(selected + 1, false); }
  else if (e.key === "ArrowUp" && !boardList.contains(document.activeElement) && tag !== "button") { e.preventDefault(); select(selected - 1, false); }
});

// init
fitCanvas();
renderBoard();
setTimeout(fitCanvas, 60);
requestAnimationFrame(loop);
console.log("opal ferry terminal ready — press B to ring, N to dispatch, P to hold tide");
