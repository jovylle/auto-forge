// Waxwing Weather Station — flock radar + log + sky export. No deps. Keyboard-first.
const $ = (s) => document.querySelector(s);
const canvas = $("#radar");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, CX = W / 2, CY = H / 2;

const state = {
  windAngle: 45, windSpeed: 1.2, hour: 10,
  paused: false, gust: 0, sweep: 0, t: 0,
  birds: [], log: [],
};
const LS_KEY = "waxwing-log-v1";

/* ---------- flock ---------- */
function spawn(n) {
  while (state.birds.length < n) {
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 200;
    state.birds.push({
      x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      ph: Math.random() * Math.PI * 2, s: 0.8 + Math.random() * 0.5,
    });
  }
  state.birds.length = n;
}
spawn(70);

function windVec() {
  const r = (state.windAngle * Math.PI) / 180;
  // wind blows TOWARD angle; birds drift with it slightly
  return { x: Math.cos(r) * state.windSpeed * 0.35, y: Math.sin(r) * state.windSpeed * 0.35 };
}

function step() {
  if (state.paused) return;
  state.t += 1 / 60;
  state.gust *= 0.96;
  state.sweep = (state.sweep + 0.012) % (Math.PI * 2);
  const w = windVec();
  const bs = state.birds, n = bs.length;
  let cx = 0, cy = 0;
  for (const b of bs) { cx += b.x; cy += b.y; }
  cx /= n; cy /= n;
  for (const b of bs) {
    let ax = 0, ay = 0, nx = 0, ny = 0, cnt = 0;
    for (const o of bs) {
      if (o === b) continue;
      const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90) {
        cnt++;
        nx += o.vx; ny += o.vy;
        if (d2 < 26 * 26 && d2 > 0.01) { const d = Math.sqrt(d2); ax -= dx / d * 0.5; ay -= dy / d * 0.5; }
        else { ax += dx * 0.0004; ay += dy * 0.0004; }
      }
    }
    if (cnt) { ax += (nx / cnt - b.vx) * 0.06; ay += (ny / cnt - b.vy) * 0.06; }
    // wheel around centre (murmuration swirl) + wind + gust turbulence
    const dx = b.x - cx, dy = b.y - cy;
    ax += -dy * 0.00045 + w.x * 0.02;
    ay += dx * 0.00045 + w.y * 0.02;
    if (state.gust > 0.02) {
      ax += Math.sin(state.t * 7 + b.ph) * state.gust * 0.12;
      ay += Math.cos(state.t * 6 + b.ph) * state.gust * 0.12;
    }
    b.vx += ax; b.vy += ay;
    const sp = Math.hypot(b.vx, b.vy), max = 2.6 + state.windSpeed * 0.5 + state.gust * 2;
    if (sp > max) { b.vx = b.vx / sp * max; b.vy = b.vy / sp * max; }
    if (sp < 0.6) { b.vx *= 1.03; b.vy *= 1.03; }
    b.x += b.vx; b.y += b.vy;
    // soft radar dish containment
    const ox = b.x - CX, oy = b.y - CY, d = Math.hypot(ox, oy), R = 272;
    if (d > R) { b.x = CX + ox / d * R; b.y = CY + oy / d * R; const dot = (b.vx * ox + b.vy * oy) / d; b.vx -= dot * ox / d * 1.6; b.vy -= dot * oy / d * 1.6; }
  }
}

function metrics() {
  const bs = state.birds, n = bs.length;
  let cx = 0, cy = 0, sp = 0;
  for (const b of bs) { cx += b.x; cy += b.y; sp += Math.hypot(b.vx, b.vy); }
  cx /= n; cy /= n; sp /= n;
  let spread = 0, angX = 0, angY = 0;
  for (const b of bs) {
    spread += Math.hypot(b.x - cx, b.y - cy);
    const s = Math.hypot(b.vx, b.vy) || 1;
    angX += b.vx / s; angY += b.vy / s;
  }
  spread /= n;
  const align = Math.hypot(angX, angY) / n; // 1 = arrow, 0 = swirl
  const cohesion = Math.max(0, Math.min(1, 1 - spread / 240));
  const altitude = Math.max(0, Math.min(1, 1 - (cy - 90) / (H - 180))); // higher on screen = higher
  const swirl = 1 - align;
  const pace = Math.max(0, Math.min(1, sp / 3.4));
  return { cohesion, altitude, swirl, pace };
}

/* ---------- forecast reading ---------- */
function forecast(m) {
  // Rule poetry from flock shape — deterministic, explainable
  if (m.swirl > 0.62 && m.cohesion > 0.55 && m.altitude < 0.45)
    return { kanji: "雨", code: "AME · RAIN BY DUSK", title: "Low wheel — rain on its way",
      haiku: "tight wheel turning low —\njuniper berries wait,\nclouds gather at dusk.", conf: "high",
      advice: "carry an umbrella; file the flock." };
  if (m.pace > 0.62 && m.cohesion > 0.5)
    return { kanji: "風", code: "KAZE · WIND RISING", title: "Fast arrow — wind rising",
      haiku: "wings lean into east —\nthe pine boughs answer back,\nhold your hat, walker.", conf: "high",
      advice: "gusts within the hour; secure laundry." };
  if (m.altitude > 0.62 && m.cohesion > 0.45)
    return { kanji: "晴", code: "HARE · FAIR & CLEAR", title: "High glide — fair and clear",
      haiku: "high V in pale blue —\nberry-red tips catch sunlight,\ntomorrow is clear.", conf: "high",
      advice: "good drying weather; walk far." };
  if (m.cohesion < 0.38)
    return { kanji: "曇", code: "KUMORI · OVERCAST DRIFT", title: "Loose drift — grey overcast",
      haiku: "scattered, unhurried —\ngrey paper sky all day long,\ntea tastes better now.", conf: "medium",
      advice: "no rain yet; flat light for reading." };
  if (state.gust > 0.35)
    return { kanji: "嵐", code: "ARASHI · GUST FRONT", title: "Burst climb — gust front passing",
      haiku: "sudden lift! hold on —\nthe storm claps overhead,\nthen silence again.", conf: "medium",
      advice: "brief squall; wait ten minutes." };
  return { kanji: "凪", code: "NAGI · CALM INTERVAL", title: "Calm circuit — a held breath",
    haiku: "round and round they go —\nthe sky holds its breathing in,\nsoft light on washi.", conf: "medium",
    advice: "stable for now; watch the next wheel." };
}

/* ---------- paint ---------- */
function skyColors() {
  // hour 5..19 maps dawn -> noon -> dusk
  const h = state.hour;
  if (h <= 7) return { bg: "#f2ddc4", ring: "rgba(143,42,20,.5)", glow: "#e8a06a" };
  if (h >= 17) return { bg: "#efd9cf", ring: "rgba(143,42,20,.55)", glow: "#d97f56" };
  if (h >= 11 && h <= 14) return { bg: "#f8f2e3", ring: "rgba(46,64,87,.5)", glow: "#9db3c8" };
  return { bg: "#f6efdd", ring: "rgba(28,26,22,.4)", glow: "#d8cdb4" };
}

function draw() {
  const sk = skyColors();
  ctx.fillStyle = sk.bg; ctx.fillRect(0, 0, W, H);
  // paper flecks
  ctx.fillStyle = "rgba(28,26,22,.05)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 173 + state.t * 0) % W, y = (i * 97) % H;
    ctx.fillRect(x, y, 2, 1);
  }
  // enso rings
  for (const [r, a] of [[272, 1], [205, 0.7], [138, 0.55], [70, 0.4]]) {
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(28,26,22,${0.35 * a})`; ctx.lineWidth = r === 272 ? 2.5 : 1.2; ctx.stroke();
  }
  // crosshair
  ctx.strokeStyle = "rgba(28,26,22,.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CX - 272, CY); ctx.lineTo(CX + 272, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY - 272); ctx.lineTo(CX, CY + 272); ctx.stroke();
  // N/E/S/W
  ctx.fillStyle = "rgba(28,26,22,.6)"; ctx.font = "600 15px system-ui"; ctx.textAlign = "center";
  ctx.fillText("N", CX, CY - 280 + 18); ctx.fillText("S", CX, CY + 280 - 6);
  ctx.fillText("E", CX + 272 - 12, CY + 5); ctx.fillText("W", CX - 272 + 12, CY + 5);
  // sweep
  const g = ctx.createConicGradient ? ctx.createConicGradient(state.sweep, CX, CY) : null;
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(state.sweep);
  const grad = ctx.createLinearGradient(0, 0, 272, 0);
  grad.addColorStop(0, "rgba(185,58,31,.35)"); grad.addColorStop(1, "rgba(185,58,31,0)");
  ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 272, -0.35, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(185,58,31,.8)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(272, 0); ctx.stroke(); ctx.restore();
  // wind arrow
  const wr = (state.windAngle * Math.PI) / 180;
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(wr);
  ctx.strokeStyle = "#2e4057"; ctx.lineWidth = 2.5;
  const wl = 40 + state.windSpeed * 22;
  ctx.beginPath(); ctx.moveTo(-wl, 0); ctx.lineTo(wl, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wl, 0); ctx.lineTo(wl - 12, -7); ctx.moveTo(wl, 0); ctx.lineTo(wl - 12, 7); ctx.stroke();
  ctx.restore();
  // sun/moon dot by hour
  const dayT = (state.hour - 5) / 14;
  const sx = CX - 220 + dayT * 440, sy = CY - 200 + Math.sin(dayT * Math.PI) * -60 + 120;
  ctx.fillStyle = state.hour <= 7 || state.hour >= 17 ? "#b93a1f" : "#a8842c";
  ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(sx, sy, state.hour <= 7 || state.hour >= 17 ? 16 : 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // birds: brush-stroke waxwings
  for (const b of state.birds) {
    const a = Math.atan2(b.vy, b.vx);
    const flap = Math.sin(state.t * 10 + b.ph) * (state.paused ? 0.15 : 1);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.scale(b.s, b.s);
    ctx.strokeStyle = "#1c1a16"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    const w = 5 + flap * 2.2;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-1, -w, 7, -w - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-1, w, 7, w + 2); ctx.stroke();
    ctx.fillStyle = "#b93a1f"; ctx.beginPath(); ctx.arc(5.5, 0, 1.8, 0, Math.PI * 2); ctx.fill(); // wax red tip
    ctx.restore();
  }
  // centre seal
  ctx.save(); ctx.translate(CX + 196, CY + 196); ctx.rotate(-0.06);
  ctx.fillStyle = "#b93a1f"; ctx.fillRect(-26, -26, 52, 52);
  ctx.fillStyle = "#fdf6ea"; ctx.font = "700 19px system-ui"; ctx.textAlign = "center";
  ctx.fillText("空", 0, -2); ctx.fillText("写", 0, 19);
  ctx.restore();
}

function compass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

let lastAnnounce = 0;
function render() {
  step(); draw();
  const m = metrics(), f = forecast(m);
  $("#m-coh").style.width = (m.cohesion * 100) + "%";
  $("#m-alt").style.width = (m.altitude * 100) + "%";
  $("#m-swi").style.width = (m.swirl * 100) + "%";
  $("#m-pac").style.width = (m.pace * 100) + "%";
  $("#m-coh-v").textContent = Math.round(m.cohesion * 100);
  $("#m-alt-v").textContent = Math.round(m.altitude * 100);
  $("#m-swi-v").textContent = Math.round(m.swirl * 100);
  $("#m-pac-v").textContent = Math.round(m.pace * 100);
  $("#fc-kanji").textContent = f.kanji; $("#fc-code").textContent = f.code;
  $("#fc-title").textContent = f.title; $("#fc-haiku").textContent = f.haiku;
  $("#fc-conf").textContent = f.conf; $("#fc-advice").textContent = f.advice;
  $("#meta-reading").textContent = f.code.toLowerCase();
  $("#auto-forecast").textContent = f.title;
  state._forecast = f; state._metrics = m;
  const now = performance.now();
  if (now - lastAnnounce > 5000) {
    lastAnnounce = now;
    $("#sr-status").textContent = `${f.title}. Wind ${compass(state.windAngle)} at ${state.windSpeed.toFixed(1)}. ${state.birds.length} waxwings.`;
  }
  requestAnimationFrame(render);
}

/* ---------- controls ---------- */
function syncLabels() {
  $("#wind-dir-v").textContent = `${compass(state.windAngle)} · ${state.windAngle}°`;
  $("#wind-spd-v").textContent = state.windSpeed.toFixed(1);
  $("#flock-v").textContent = state.birds.length;
  $("#hour-v").textContent = String(state.hour).padStart(2, "0") + ":00";
  $("#bird-count-label").textContent = state.birds.length;
}
function bindControls() {
  const wd = $("#wind-dir"), ws = $("#wind-spd"), hr = $("#hour"), fl = $("#flock");
  wd.addEventListener("input", () => { state.windAngle = +wd.value; syncLabels(); });
  ws.addEventListener("input", () => { state.windSpeed = +ws.value; syncLabels(); });
  hr.addEventListener("input", () => { state.hour = +hr.value; syncLabels(); });
  fl.addEventListener("input", () => { spawn(+fl.value); syncLabels(); });
  $("#btn-gust").addEventListener("click", gust);
  $("#btn-pause").addEventListener("click", togglePause);
  $("#btn-dawn").addEventListener("click", advHour);
  $("#btn-calm").addEventListener("click", () => {
    state.windSpeed = 0; state.gust = 0; ws.value = 0; syncLabels(); say("Air stilled.");
  });
  document.querySelectorAll("[data-wind]").forEach((b) =>
    b.addEventListener("click", () => { state.windAngle = +b.dataset.wind; wd.value = state.windAngle; syncLabels(); }));
}
function gust() { state.gust = Math.min(1.4, state.gust + 0.9); say("Gust released through the flock."); }
function togglePause() {
  state.paused = !state.paused;
  $("#btn-pause").setAttribute("aria-pressed", String(state.paused));
  $("#btn-pause").firstChild.textContent = state.paused ? "▶ Resume " : "❚❚ Pause ";
  say(state.paused ? "Murmuration held still." : "Murmuration resumes.");
}
function advHour() {
  state.hour = state.hour >= 19 ? 5 : state.hour + 1;
  $("#hour").value = state.hour; syncLabels();
}
function say(msg) { $("#export-msg").textContent = msg; }

/* keyboard — full operation without pointer */
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
  if (e.key === "?" && !typing) { e.preventDefault(); $("#keys").open = !$("#keys").open; return; }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    if (document.activeElement && $("#log-form").contains(document.activeElement)) { e.preventDefault(); $("#log-form").requestSubmit(); }
    return;
  }
  if (typing) return;
  const k = e.key;
  if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
    e.preventDefault();
    const stepDeg = e.shiftKey ? 15 : 5;
    if (k === "ArrowLeft") state.windAngle = (state.windAngle - stepDeg + 360) % 360;
    if (k === "ArrowRight") state.windAngle = (state.windAngle + stepDeg) % 360;
    if (k === "ArrowUp") state.windSpeed = Math.min(3, +(state.windSpeed + 0.2).toFixed(1));
    if (k === "ArrowDown") state.windSpeed = Math.max(0, +(state.windSpeed - 0.2).toFixed(1));
    $("#wind-dir").value = state.windAngle; $("#wind-spd").value = state.windSpeed;
    syncLabels(); return;
  }
  switch (k.toLowerCase()) {
    case "r": gust(); break;
    case " ": if (tag === "button") break; e.preventDefault(); togglePause(); break;
    case "+": case "=": spawn(Math.min(160, state.birds.length + 10)); $("#flock").value = state.birds.length; syncLabels(); break;
    case "-": case "_": spawn(Math.max(12, state.birds.length - 10)); $("#flock").value = state.birds.length; syncLabels(); break;
    case "d": advHour(); break;
    case "1": state.windAngle = 0; $("#wind-dir").value = 0; syncLabels(); break;
    case "2": state.windAngle = 90; $("#wind-dir").value = 90; syncLabels(); break;
    case "3": state.windAngle = 180; $("#wind-dir").value = 180; syncLabels(); break;
    case "4": state.windAngle = 270; $("#wind-dir").value = 270; syncLabels(); break;
    case "e": exportPNG(); break;
    case "j": exportJSON(); break;
    case "c": exportCSV(); break;
    case "p": copyPoem(); break;
    case "l": e.preventDefault(); $("#f-count").focus(); break;
    case "delete": case "backspace":
      if (document.activeElement && document.activeElement.matches("#log-list li")) {
        e.preventDefault(); removeEntry(document.activeElement.dataset.id);
      }
      break;
  }
});

/* ---------- log ---------- */
function loadLog() {
  try { state.log = JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { state.log = []; }
}
function saveLog() { localStorage.setItem(LS_KEY, JSON.stringify(state.log)); }
function addEntry(count, behavior, note, f) {
  state.log.unshift({
    id: "w" + Date.now().toString(36) + Math.floor(Math.random() * 99),
    at: new Date().toISOString(), count, behavior, note: note || "",
    forecast: f ? f.title : "",
  });
  saveLog(); renderLog();
}
function removeEntry(id) {
  state.log = state.log.filter((e) => e.id !== id);
  saveLog(); renderLog(); say("Entry removed from the log.");
}
function renderLog() {
  const ol = $("#log-list"); ol.innerHTML = "";
  $("#log-empty").style.display = state.log.length ? "none" : "block";
  for (const e of state.log) {
    const li = document.createElement("li");
    li.tabIndex = 0; li.dataset.id = e.id;
    li.setAttribute("aria-label", `${e.count} waxwings, ${e.behavior}, forecast ${e.forecast}. Press Delete to remove.`);
    const d = new Date(e.at);
    li.innerHTML = `<span class="li-top"><span class="li-count">${e.count}羽</span><b></b><span class="li-f"></span><span class="li-date"></span></span><button type="button" class="li-del" aria-label="Delete this entry">✕</button><span class="li-note"></span>`;
    li.querySelector("b").textContent = e.behavior;
    li.querySelector(".li-f").textContent = e.forecast;
    li.querySelector(".li-date").textContent = d.toLocaleString();
    li.querySelector(".li-note").textContent = e.note || "— no sky note —";
    li.querySelector(".li-del").addEventListener("click", () => removeEntry(e.id));
    ol.appendChild(li);
  }
}
function bindLog() {
  $("#log-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const count = Math.max(1, Math.min(500, +$("#f-count").value || 1));
    addEntry(count, $("#f-behavior").value, $("#f-note").value.trim(), state._forecast);
    $("#f-note").value = "";
    say(`Filed: ${count} waxwings — ${state._forecast.title}.`);
    $("#f-count").focus();
  });
  $("#btn-sample").addEventListener("click", () => {
    addEntry(24 + Math.floor(Math.random() * 30), $("#f-behavior").value, "pale sun, juniper berries, east breeze", state._forecast);
    say("Sample entry filed.");
  });
  $("#btn-clear").addEventListener("click", () => {
    if (!state.log.length) return;
    if (confirm("Clear the whole waxwing log?")) { state.log = []; saveLog(); renderLog(); say("Log cleared. Fresh paper."); }
  });
}

/* ---------- export ---------- */
function download(name, href) {
  const a = document.createElement("a");
  a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function exportPNG() {
  // offscreen washi card with radar + seal + forecast text
  const c = document.createElement("canvas"); c.width = 900; c.height = 1060;
  const g = c.getContext("2d");
  g.fillStyle = "#f5efe2"; g.fillRect(0, 0, 900, 1060);
  g.fillStyle = "#1c1a16"; g.font = "600 15px system-ui";
  g.fillText("レンジャク気象台 · WAXWING WEATHER STATION", 50, 55);
  g.font = "600 44px Georgia, serif";
  const f = state._forecast;
  g.fillText(f.title, 50, 105);
  g.drawImage(canvas, 50, 140, 800, 800);
  g.strokeStyle = "#1c1a16"; g.lineWidth = 3; g.strokeRect(50, 140, 800, 800);
  g.font = "italic 22px Georgia, serif"; g.fillStyle = "#4c463c";
  f.haiku.split("\n").forEach((line, i) => g.fillText(line, 50, 975 + i * 30));
  g.fillStyle = "#b93a1f"; g.fillRect(790, 955, 60, 60);
  g.fillStyle = "#fdf6ea"; g.font = "700 21px system-ui"; g.textAlign = "center";
  g.fillText("空", 820, 980); g.fillText("写", 820, 1003);
  download(`waxwing-sky-${Date.now()}.png`, c.toDataURL("image/png"));
  say("Sky exported as PNG — check your downloads.");
}
function exportJSON() {
  const blob = new Blob([JSON.stringify({ station: "waxwing", exportedAt: new Date().toISOString(), forecast: state._forecast, log: state.log }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(`waxwing-log-${Date.now()}.json`, url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  say(`Log exported as JSON (${state.log.length} entries).`);
}
function exportCSV() {
  const rows = [["at", "count", "behavior", "note", "forecast"]];
  for (const e of state.log) rows.push([e.at, e.count, `"${(e.behavior || "").replace(/"/g, '""')}"`, `"${(e.note || "").replace(/"/g, '""')}"`, `"${(e.forecast || "").replace(/"/g, '""')}"`]);
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  download(`waxwing-log-${Date.now()}.csv`, url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  say(`Log exported as CSV (${state.log.length} entries).`);
}
async function copyPoem() {
  const f = state._forecast, m = state._metrics;
  const text = `Waxwing Weather Station — ${f.code}\n${f.title}\n${f.haiku}\n(cohesion ${Math.round(m.cohesion * 100)} · altitude ${Math.round(m.altitude * 100)} · swirl ${Math.round(m.swirl * 100)} · pace ${Math.round(m.pace * 100)} · wind ${compass(state.windAngle)} ${state.windSpeed.toFixed(1)})`;
  try { await navigator.clipboard.writeText(text); say("Forecast poem copied to clipboard."); }
  catch { say("Copy blocked — select the haiku and copy by hand (Ctrl+C)."); }
}
function bindExport() {
  $("#btn-png").addEventListener("click", exportPNG);
  $("#btn-json").addEventListener("click", exportJSON);
  $("#btn-csv").addEventListener("click", exportCSV);
  $("#btn-copy").addEventListener("click", copyPoem);
}

/* ---------- clock ---------- */
function tickClock() {
  const d = new Date();
  $("#clock").textContent = d.toLocaleTimeString();
  $("#today").textContent = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", weekday: "short" });
}
setInterval(tickClock, 1000); tickClock();

/* ---------- init ---------- */
loadLog(); renderLog(); bindControls(); bindLog(); bindExport(); syncLabels();
requestAnimationFrame(render);
console.log("waxwing station live — press ? for keys");
