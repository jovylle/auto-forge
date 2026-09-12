// ============================================================
//  BRINE CLOCK — 潮汐時計 | tide timer
//  synthetic tide model (M2 + S2 + K1) · canvas dial · time warp
//  share/export · hidden Kraken easter egg
// ============================================================

const TAU = Math.PI * 2;

// ---- harmonic tide model (periods in hours, normalized to [-1, 1]) ----
const PERIODS = { M2: 12.4206, S2: 12.0, K1: 23.9345 };
const OM = {
  M2: TAU / PERIODS.M2,
  S2: TAU / PERIODS.S2,
  K1: TAU / PERIODS.K1,
};
const AMP = { M2: 1.0, S2: 0.42, K1: 0.16 };
const PHASE = { M2: 0.4, S2: 0.9, K1: 1.4 };
const AMP_TOTAL = AMP.M2 + AMP.S2 + AMP.K1;

function tide(ms) {
  const h = ms / 3600000;
  return (
    AMP.M2 * Math.cos(OM.M2 * h + PHASE.M2) +
    AMP.S2 * Math.cos(OM.S2 * h + PHASE.S2) +
    AMP.K1 * Math.cos(OM.K1 * h + PHASE.K1)
  ) / AMP_TOTAL;
}
function level(ms) { return (tide(ms) + 1) / 2; } // 0..1

function springNeapDay(ms) {
  // beat of M2 vs S2 = ~14.77 days; returns 0..1 position in cycle
  const beatH = (PERIODS.M2 * PERIODS.S2) / Math.abs(PERIODS.M2 - PERIODS.S2);
  return ((ms / 3600000) % beatH) / beatH;
}

// ---- simulated clock (time warp) ----
let offsetMs = 0;
let warpOn = false;
let speed = 60; // sim-seconds per real-second
const simNow = () => Date.now() + offsetMs;

// ---- dom ----
const dial = document.getElementById("dial");
const ctx = dial.getContext("2d");
const $ = (id) => document.getElementById(id);
const el = {
  modeBadge: $("modeBadge"), simClock: $("simClock"),
  levelPct: $("levelPct"), levelTrend: $("levelTrend"), phaseLabel: $("phaseLabel"), levelBar: $("levelBar"),
  nextHighTime: $("nextHighTime"), nextHighIn: $("nextHighIn"),
  nextLowTime: $("nextLowTime"), nextLowIn: $("nextLowIn"),
  warpSlider: $("warpSlider"), warpValue: $("warpValue"),
  btnWarp: $("btnWarp"), btnLive: $("btnLive"), speedSelect: $("speedSelect"),
  btnCopy: $("btnCopy"), btnPng: $("btnPng"), btnJson: $("btnJson"),
  kanjiEgg: $("kanjiEgg"), toast: $("toast"),
};

// ---- canvas sizing ----
let L = 600, cx = 300, cy = 300, dpr = 1;
function fit() {
  const size = Math.max(10, dial.getBoundingClientRect().width || 600);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  dial.width = Math.round(size * dpr);
  dial.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L = size; cx = size / 2; cy = size / 2;
}
window.addEventListener("resize", fit);

// ---- tide extrema ----
function findExtrema(fromMs, horizonH = 26, stepMin = 1) {
  const step = stepMin * 60000;
  const n = Math.floor((horizonH * 3600000) / step);
  const highs = [], lows = [];
  let prev = level(fromMs), cur = level(fromMs + step);
  for (let i = 1; i < n - 1; i++) {
    const next = level(fromMs + (i + 1) * step);
    if (cur > prev && cur >= next) highs.push(fromMs + i * step);
    if (cur < prev && cur <= next) lows.push(fromMs + i * step);
    prev = cur; cur = next;
  }
  return { highs, lows };
}

function nextEvent(list, nowMs) {
  for (const t of list) if (t > nowMs + 2 * 60000) return t;
  return list[0];
}

// ---- readouts ----
let cached = null;
function compute() {
  const now = simNow();
  const { highs, lows } = findExtrema(now);
  const nextHigh = nextEvent(highs, now);
  const nextLow = nextEvent(lows, now);
  const lv = level(now);
  const trend = level(now + 5 * 60000) > lv; // true = rising
  let phase = trend ? "RISING 満ち" : "FALLING 引き";
  const dH = Math.abs(nextHigh - now), dL = Math.abs(nextLow - now);
  if (dH < 18 * 60000) phase = "HIGH TIDE 満潮";
  else if (dL < 18 * 60000) phase = "LOW TIDE 干潮";
  cached = { now, lv, trend, phase, nextHigh, nextLow, highs, lows };
  return cached;
}

const pad = (n) => String(n).padStart(2, "0");
function fmtHM(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtHMS(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDur(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}
function fmtOffset() {
  const h = offsetMs / 3600000;
  if (Math.abs(h) < 0.001) return "NOW";
  const sign = h < 0 ? "−" : "+";
  const a = Math.abs(h);
  const hh = Math.floor(a), mm = Math.round((a - hh) * 60);
  return `${sign}${hh}h ${pad(mm)}m`;
}

function paintReadouts() {
  const c = compute();
  const pct = Math.round(c.lv * 100);
  el.levelPct.textContent = pct + "%";
  el.levelTrend.textContent = c.trend ? "▲ 満ち · rising" : "▼ 引き · falling";
  el.levelTrend.className = "trend " + (c.trend ? "rising" : "falling");
  el.phaseLabel.textContent = c.phase;
  el.levelBar.style.width = pct + "%";
  el.nextHighTime.textContent = fmtHM(c.nextHigh);
  el.nextHighIn.textContent = "in " + fmtDur(c.nextHigh - c.now);
  el.nextLowTime.textContent = fmtHM(c.nextLow);
  el.nextLowIn.textContent = "in " + fmtDur(c.nextLow - c.now);
  el.simClock.textContent = fmtHMS(c.now);
  const warped = Math.abs(offsetMs) > 500 || warpOn;
  el.modeBadge.textContent = warped ? "WARP" : "LIVE";
  el.modeBadge.className = "badge " + (warped ? "badge-warp" : "badge-live");
  el.warpValue.textContent = fmtOffset();
  return c;
}

// ---- canvas: dial ----
let krakenMode = false;
let last = performance.now();

function angleForTime(tMs) {
  const dh = (tMs - simNow()) / 3600000;
  const frac = ((dh / PERIODS.M2) % 1 + 1) % 1;
  return (-Math.PI / 2) + frac * TAU; // 0 phase (M2 high) points up
}

function drawDial(c, tSec) {
  const r = L * 0.5 * 0.92;
  ctx.clearRect(0, 0, L, L);

  // faint grid
  ctx.strokeStyle = "rgba(0,234,255,0.05)";
  ctx.lineWidth = 1;
  for (const rr of [r * 0.34, r * 0.51, r * 0.68]) {
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath(); ctx.moveTo(r * 0.84, 0); ctx.lineTo(r * 0.9, 0); ctx.stroke();
  }
  ctx.restore();

  // ---- water fill (inner disc) ----
  const wr = r * 0.68;
  const waterY = cy + wr * (1 - 2 * c.lv);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, wr, 0, TAU); ctx.clip();
  const wg = ctx.createLinearGradient(0, cy - wr, 0, cy + wr);
  wg.addColorStop(0, "rgba(0,234,255,0.02)");
  wg.addColorStop(0.65, "rgba(0,234,255,0.28)");
  wg.addColorStop(1, "rgba(255,46,136,0.34)");
  ctx.fillStyle = wg;
  ctx.fillRect(cx - wr, waterY, wr * 2, cy + wr - waterY);
  // animated wave crests
  const waves = 3;
  for (let w = 0; w < waves; w++) {
    ctx.beginPath();
    const amp = 5 + w * 3;
    const speedW = 1.6 + w * 0.5;
    for (let x = cx - wr; x <= cx + wr; x += 4) {
      const rel = (x - (cx - wr)) / (wr * 2);
      const y = waterY + Math.sin(rel * TAU * 2 + tSec * speedW + w * 1.7) * amp;
      x === cx - wr ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${w === 1 ? "255,46,136" : "0,234,255"},${0.22 + w * 0.12})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // ---- ring sparkline: one tide cycle ----
  const nS = 220;
  const band = r * 0.13, base = r * 0.79;
  ctx.beginPath();
  for (let i = 0; i <= nS; i++) {
    const tMs = c.now + (i / nS) * PERIODS.M2 * 3600000;
    const ang = angleForTime(tMs);
    const rad = base + level(tMs) * band;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(0,234,255,0.75)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,234,255,0.7)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // current point on ring
  const curAng = angleForTime(c.now);
  const curRad = base + c.lv * band;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(curAng) * curRad, cy + Math.sin(curAng) * curRad, 5, 0, TAU);
  ctx.fillStyle = "#c6ff3e";
  ctx.shadowColor = "rgba(198,255,62,0.9)"; ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // next high / low markers on the ring
  for (const [tt, col] of [[c.nextHigh, "255,176,0"], [c.nextLow, "0,234,255"]]) {
    const a = angleForTime(tt);
    const rr = r * 0.9;
    const pulse = 0.5 + 0.5 * Math.sin(tSec * 4);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3 + pulse * 2, 0, TAU);
    ctx.fillStyle = `rgba(${col},${0.55 + pulse * 0.45})`;
    ctx.shadowColor = `rgba(${col},0.9)`; ctx.shadowBlur = 10;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // ---- hand: M2 phase ----
  const hh = c.now / 3600000;
  const phase = ((OM.M2 * hh + PHASE.M2) % TAU + TAU) % TAU;
  const handAng = phase - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(handAng) * r * 0.72, cy + Math.sin(handAng) * r * 0.72);
  ctx.strokeStyle = "rgba(255,46,136,0.9)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(255,46,136,0.8)"; ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // hub
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU);
  ctx.fillStyle = "#e8f6ff"; ctx.shadowColor = "rgba(0,234,255,0.9)"; ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // ---- kraken ----
  if (krakenMode) drawKraken(tSec, r);
}

function drawKraken(tSec, r) {
  const base = cy + r * 0.8;
  const cols = [[255, 46, 136], [0, 234, 255], [198, 255, 62], [255, 46, 136], [0, 234, 255]];
  for (let i = 0; i < 5; i++) {
    const x0 = cx + (i - 2) * r * 0.24;
    const p = i * 1.15;
    const ex = x0 + Math.sin(tSec * 1.5 + p) * r * 0.14;
    const ey = base - r * 1.02 - Math.abs(Math.sin(tSec * 2.1 + p)) * r * 0.1;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.bezierCurveTo(
      x0 + Math.sin(tSec * 0.8 + p) * r * 0.3, base - r * 0.45 - Math.sin(tSec * 1.6 + p) * r * 0.15,
      x0 + Math.sin(tSec * 1.1 + p + 1) * r * 0.26, base - r * 0.85 - Math.cos(tSec * 1.2 + p) * r * 0.1,
      ex, ey
    );
    const c = cols[i];
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
    ctx.lineWidth = Math.max(3, r * 0.075 - i * 0.006);
    ctx.lineCap = "round";
    ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
    ctx.shadowBlur = 16;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // the eye
  const ex = cx, ey = base - r * 0.62 + Math.sin(tSec * 1.4) * r * 0.05;
  ctx.beginPath();
  ctx.ellipse(ex, ey, r * 0.1, r * 0.16, 0, 0, TAU);
  ctx.fillStyle = "#ff2e88";
  ctx.shadowColor = "rgba(255,46,136,1)"; ctx.shadowBlur = 26;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex, ey, r * 0.045, 0, TAU);
  ctx.fillStyle = "#04060f";
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---- main loop ----
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (warpOn) {
    offsetMs += speed * 1000 * dt;
    if (!sliderDragging) el.warpSlider.value = Math.round((offsetMs / 3600000) * 10) / 10;
  }
  const c = compute();
  drawDial(c, now / 1000);
  requestAnimationFrame(loop);
}

// ---- warp controls ----
let sliderDragging = false;
el.warpSlider.addEventListener("input", () => {
  sliderDragging = true;
  offsetMs = parseFloat(el.warpSlider.value) * 3600000;
  warpOn = false;
});
el.warpSlider.addEventListener("change", () => { sliderDragging = false; });
el.btnLive.addEventListener("click", () => {
  offsetMs = 0; warpOn = false;
  el.warpSlider.value = 0;
  el.btnWarp.textContent = "▶ WARP";
  toast("LIVE — synced to real time");
});
el.btnWarp.addEventListener("click", () => {
  warpOn = !warpOn;
  el.btnWarp.textContent = warpOn ? "⏸ PAUSE" : "▶ WARP";
  if (warpOn && Math.abs(offsetMs) < 500) offsetMs = speed * 1000; // step out of LIVE
});
el.speedSelect.addEventListener("change", () => {
  speed = parseInt(el.speedSelect.value, 10);
  localStorage.setItem("brineSpeed", String(speed));
});

// ---- toast ----
let toastTimer = null;
function toast(msg, pink = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle("pink", pink);
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}

// ---- export helpers ----
function download(name, href) {
  const a = document.createElement("a");
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

function snapshotText(c) {
  const d = new Date(c.now);
  const day = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
  const sn = springNeapDay(c.now);
  const kind = sn < 0.25 ? "SPRING" : sn < 0.75 ? "NEAP-ish" : "SPRING";
  return [
    "BRINE CLOCK — 潮汐時計",
    "tide snapshot @ " + fmtHMS(c.now) + " (" + day + ")",
    "",
    "level  : " + Math.round(c.lv * 100) + "% of range — " + (c.trend ? "RISING 満ち" : "FALLING 引き"),
    "phase  : " + c.phase,
    "next HIGH : " + fmtHM(c.nextHigh) + " (in " + fmtDur(c.nextHigh - c.now) + ")",
    "next LOW  : " + fmtHM(c.nextLow) + " (in " + fmtDur(c.nextLow - c.now) + ")",
    "cycle  : " + Math.round(springNeapDay(c.now) * 14.77) + "d into " + kind + " (14.77d spring/neap)",
    "model  : M2 + S2 + K1 harmonic tide (synthetic)",
  ].join("\n");
}

el.btnCopy.addEventListener("click", async () => {
  const txt = snapshotText(compute());
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; }
  catch { ok = copyFallback(txt); }
  toast(ok ? "SNAPSHOT COPIED ⧉" : "SNAPSHOT READY — press Ctrl/Cmd+V in a text field");
});
function copyFallback(txt) {
  try {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.cssText = "position:fixed;opacity:0;top:0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove(); return ok;
  } catch { return false; }
}

// 24h chart PNG
el.btnPng.addEventListener("click", () => {
  const W = 960, H = 380;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const now = simNow();
  const padX = 60, padY = 44, top = 30;
  const plotW = W - padX * 2, plotH = H - padY - top;

  g.fillStyle = "#04060f";
  g.fillRect(0, 0, W, H);
  // border
  g.strokeStyle = "rgba(0,234,255,0.4)"; g.lineWidth = 1.5;
  g.strokeRect(1.5, 1.5, W - 3, H - 3);

  g.font = "22px 'Zen Tokyo Zoo', sans-serif";
  g.fillStyle = "#00eaff";
  g.fillText("BRINE CLOCK — 24H TIDE", padX, 24);
  g.font = "12px 'Share Tech Mono', monospace";
  g.fillStyle = "#6a7ba6";
  g.fillText("M2 + S2 + K1 synthetic tide · from " + fmtHMS(now) + "  「潮汐時計」", padX, H - 12);

  // grid + y labels
  for (let i = 0; i <= 4; i++) {
    const y = top + plotH - (i / 4) * plotH;
    g.strokeStyle = "rgba(0,234,255,0.12)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(padX, y); g.lineTo(W - padX, y); g.stroke();
    g.fillStyle = "#6a7ba6"; g.font = "11px 'Share Tech Mono', monospace";
    g.fillText((i * 25) + "%", 12, y + 4);
  }
  // x labels every 4h
  for (let hh = 0; hh <= 24; hh += 4) {
    const x = padX + (hh / 24) * plotW;
    g.strokeStyle = "rgba(0,234,255,0.08)";
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + plotH); g.stroke();
    const t = new Date(now + hh * 3600000);
    g.fillStyle = "#6a7ba6";
    g.fillText(pad(t.getHours()) + ":00", x - 12, H - padY + 14);
  }
  // mean line
  const my = top + plotH - 0.5 * plotH;
  g.strokeStyle = "rgba(255,46,136,0.25)"; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(padX, my); g.lineTo(W - padX, my); g.stroke();
  g.setLineDash([]);

  // curve
  const n = 240;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = now + (i / n) * 24 * 3600000;
    const lv = level(t);
    const x = padX + (i / n) * plotW;
    const y = top + plotH - lv * plotH;
    pts.push([x, y]);
  }
  g.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? g.moveTo(x, y) : g.lineTo(x, y));
  g.strokeStyle = "#00eaff"; g.lineWidth = 2.5;
  g.shadowColor = "rgba(0,234,255,0.8)"; g.shadowBlur = 12;
  g.stroke();
  g.shadowBlur = 0;

  // gradient fill under curve
  g.lineTo(W - padX, top + plotH); g.lineTo(padX, top + plotH); g.closePath();
  const fg = g.createLinearGradient(0, top, 0, top + plotH);
  fg.addColorStop(0, "rgba(0,234,255,0.25)");
  fg.addColorStop(1, "rgba(255,46,136,0.05)");
  g.fillStyle = fg; g.fill();

  // current marker
  const clv = level(now);
  g.beginPath();
  g.arc(padX, top + plotH - clv * plotH, 5, 0, TAU);
  g.fillStyle = "#c6ff3e"; g.shadowColor = "rgba(198,255,62,0.9)"; g.shadowBlur = 12;
  g.fill(); g.shadowBlur = 0;
  g.fillStyle = "#c6ff3e"; g.font = "11px 'Share Tech Mono', monospace";
  g.fillText("NOW " + Math.round(clv * 100) + "%", padX + 9, top + plotH - clv * plotH - 6);

  // highs/lows
  const { highs, lows } = findExtrema(now, 24);
  for (const tt of highs.slice(0, 4)) {
    const x = padX + ((tt - now) / (24 * 3600000)) * plotW;
    const y = top + plotH - level(tt) * plotH;
    g.beginPath(); g.arc(x, y, 4, 0, TAU);
    g.fillStyle = "#ffb000"; g.fill();
  }
  for (const tt of lows.slice(0, 4)) {
    const x = padX + ((tt - now) / (24 * 3600000)) * plotW;
    const y = top + plotH - level(tt) * plotH;
    g.beginPath(); g.arc(x, y, 4, 0, TAU);
    g.fillStyle = "#00eaff"; g.fill();
  }

  download("brine-tide-chart.png", cv.toDataURL("image/png"));
  toast("CHART EXPORTED ▤");
});

// forecast JSON
el.btnJson.addEventListener("click", () => {
  const now = simNow();
  const { highs, lows } = findExtrema(now, 24);
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const t = now + i * 30 * 60000;
    const d = new Date(t);
    points.push({
      t: d.toISOString(),
      label: fmtHM(t),
      level: Math.round(level(t) * 1000) / 1000,
      pct: Math.round(level(t) * 100),
    });
  }
  const out = {
    app: "Brine Clock 潮汐時計",
    generatedAt: new Date(now).toISOString(),
    model: "M2 + S2 + K1 harmonic tide (synthetic)",
    springNeapCycleDays: 14.77,
    intervalMinutes: 30,
    horizonHours: 24,
    nextHighs: highs.slice(0, 6).map((t) => ({ at: new Date(t).toISOString(), label: fmtHM(t), pct: Math.round(level(t) * 100) })),
    nextLows: lows.slice(0, 6).map((t) => ({ at: new Date(t).toISOString(), label: fmtHM(t), pct: Math.round(level(t) * 100) })),
    points,
  };
  download("brine-tide-forecast.json", "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out, null, 2)));
  toast("FORECAST EXPORTED ⬇");
});

// ---- easter egg: KRAKEN ----
let eggClicks = 0;
let typeBuf = "";
const KRAKEN_DURATION = 12000;

function triggerKraken() {
  krakenMode = true;
  document.body.classList.add("kraken");
  toast("海神目覚め — KRAKEN AWAKENS", true);
  eggClicks = 0;
  el.kanjiEgg.classList.remove("egg-charge");
  setTimeout(() => {
    krakenMode = false;
    document.body.classList.remove("kraken");
    toast("the sea calms…");
  }, KRAKEN_DURATION);
}

el.kanjiEgg.addEventListener("click", () => {
  if (krakenMode) {
    krakenMode = false;
    document.body.classList.remove("kraken");
    toast("the sea calms…");
    eggClicks = 0;
    el.kanjiEgg.classList.remove("egg-charge");
    return;
  }
  eggClicks++;
  if (eggClicks >= 5) { triggerKraken(); return; }
  if (eggClicks >= 3) el.kanjiEgg.classList.add("egg-charge");
  toast("the seal stirs… (" + eggClicks + "/5)", eggClicks >= 3);
});

window.addEventListener("keydown", (e) => {
  if (e.key.length === 1) {
    typeBuf = (typeBuf + e.key.toLowerCase()).slice(-12);
    if (typeBuf.includes("kraken")) {
      typeBuf = "";
      triggerKraken();
    }
  }
});

// ---- boot ----
(function init() {
  const saved = localStorage.getItem("brineSpeed");
  if (saved) { speed = parseInt(saved, 10) || 60; el.speedSelect.value = String(speed); }
  fit();
  requestAnimationFrame(loop);
  paintReadouts();
  setInterval(paintReadouts, 500);
  console.log("brine-clock ready — tide timer · 潮汐時計");
})();