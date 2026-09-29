/* Springtide Particle Loft — gravity wells + spring-linked trails + seed codes + poster export.
   Plain script (no modules) so it works from file://. Canvas only, no images. */
(function () {
"use strict";

var LS_KEY = "springtide-loft-v1";
var TAU = Math.PI * 2;

// ---------- seeded RNG ----------
function xmur3(str) {
  var h = 1779033703 ^ str.length;
  for (var i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var SEED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomSeed() {
  var s = "";
  for (var i = 0; i < 4; i++) s += SEED_CHARS[(Math.random() * SEED_CHARS.length) | 0];
  var n = 10 + ((Math.random() * 89) | 0);
  return "TIDE-" + s + "-" + n;
}
function normSeed(s) {
  s = String(s || "").toUpperCase().trim().replace(/[^A-Z0-9-]/g, "");
  if (/^TIDE-[A-Z0-9]{4}-\d{2}$/.test(s)) return s;
  // accept bare codes like "4F8K" or "4F8K12" and wrap them
  var bare = s.replace(/-/g, "").replace(/^TIDE/, "");
  if (bare.length >= 4) {
    var core = bare.slice(0, 4), num = bare.slice(4, 6) || "42";
    num = (num + "42").slice(0, 2).replace(/[^0-9]/g, "4");
    return "TIDE-" + core + "-" + num;
  }
  return null;
}
function rngFromSeed(seed) {
  var f = xmur3(seed);
  return mulberry32(f());
}

// ---------- dom ----------
function $(id) { return document.getElementById(id); }
var canvas = $("stage"), ctx = canvas.getContext("2d");
var seedReadout = $("seedReadout"), seedInput = $("seedInput");
var wellCountEl = $("wellCount"), bodyCountEl = $("bodyCount"), runStateEl = $("runState");
var wellListEl = $("wellList"), fpsEl = $("fps"), liveDot = $("liveDot");
var dropHint = $("dropHint"), copyHint = $("copyHint"), exportHint = $("exportHint");

// ---------- state ----------
var state = {
  seed: randomSeed(),
  tool: "well",           // "well" | "toss"
  running: true,
  gravity: 1.0,
  spring: 0.02,
  damping: 0.985,
  trail: 0.22,            // fade alpha: lower = longer trails
  flow: true,
  links: true,
  grid: true,
  wells: [],              // {x,y (css px in canvas space), s (strength), r (radius)}
  bodies: [],             // {x,y,vx,vy,life,max,red}
  selected: -1
};
var W = 900, H = 640, DPR = 1;
var MAX_BODIES = 420;

// ---------- seed -> wells ----------
function buildWellsFromSeed(seed) {
  var rnd = rngFromSeed(seed);
  var n = 3 + Math.floor(rnd() * 3); // 3..5 wells
  var wells = [];
  for (var i = 0; i < n; i++) {
    wells.push({
      x: W * (0.15 + rnd() * 0.7),
      y: H * (0.18 + rnd() * 0.64),
      s: 900 + rnd() * 2600,
      r: 90 + rnd() * 130
    });
  }
  return wells;
}
function spawnBodies(n, rnd, burst) {
  for (var i = 0; i < n; i++) {
    if (state.bodies.length >= MAX_BODIES) state.bodies.shift();
    var r = rnd || Math.random;
    var edge = (r() * 4) | 0;
    var p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 500 + r() * 700, red: r() < 0.14 };
    if (burst) {
      p.x = W * (0.3 + r() * 0.4); p.y = H * (0.25 + r() * 0.3);
      var a = r() * TAU, sp = 1 + r() * 4;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    } else if (edge === 0)      { p.x = r() * W; p.y = -6; p.vx = (r() - 0.5); p.vy = 0.6 + r(); }
    else if (edge === 1)        { p.x = r() * W; p.y = -6; p.vx = (r() - 0.5); p.vy = 0.6 + r(); }
    else if (edge === 2)        { p.x = -6; p.y = r() * H; p.vx = 0.8 + r(); p.vy = (r() - 0.5); }
    else                        { p.x = W + 6; p.y = r() * H; p.vx = -0.8 - r(); p.vy = (r() - 0.5); }
    state.bodies.push(p);
  }
}

// ---------- persistence / url ----------
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      seed: state.seed, gravity: state.gravity, spring: state.spring,
      damping: state.damping, trail: state.trail, flow: state.flow,
      links: state.links, grid: state.grid, tool: state.tool,
      wells: state.wells.map(function (w) { return { x: w.x / W, y: w.y / H, s: w.s, r: w.r }; })
    }));
  } catch (e) { /* private mode — ignore */ }
}
function load() {
  var q = null;
  try { q = new URLSearchParams(location.hash.replace(/^#/, "")).get("s"); } catch (e) {}
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
  if (q) {
    var ns = normSeed(q);
    if (ns) { state.seed = ns; state.wells = buildWellsFromSeed(ns); return; }
  }
  if (saved) {
    if (normSeed(saved.seed)) state.seed = normSeed(saved.seed);
    ["gravity","spring","damping","trail"].forEach(function (k) {
      if (typeof saved[k] === "number" && isFinite(saved[k])) state[k] = saved[k];
    });
    ["flow","links","grid"].forEach(function (k) { if (typeof saved[k] === "boolean") state[k] = saved[k]; });
    if (saved.tool === "well" || saved.tool === "toss") state.tool = saved.tool;
    if (Array.isArray(saved.wells) && saved.wells.length) {
      state.wells = saved.wells.slice(0, 12).map(function (w) {
        return { x: w.x * W, y: w.y * H, s: +w.s || 1500, r: +w.r || 120 };
      });
      return;
    }
  }
  state.wells = buildWellsFromSeed(state.seed);
}
function syncHash() {
  try { history.replaceState(null, "", "#s=" + encodeURIComponent(state.seed)); }
  catch (e) { try { location.hash = "s=" + state.seed; } catch (e2) {} }
}

// ---------- canvas sizing ----------
function fitCanvas() {
  var rect = canvas.getBoundingClientRect();
  var cssW = Math.max(280, rect.width || 900);
  var cssH = Math.round(cssW * (H / W));
  DPR = Math.min(2, window.devicePixelRatio || 1);
  // keep logical space fixed; rescale wells/body coords proportionally
  var sx = cssW / (canvas._cw || cssW), sy = cssH / (canvas._ch || cssH);
  if (canvas._cw && (sx !== 1 || sy !== 1)) {
    state.wells.forEach(function (w) { w.x *= sx; w.y *= sy; });
    state.bodies.forEach(function (b) { b.x *= sx; b.y *= sy; b.vx *= sx; b.vy *= sy; });
    W = cssW; H = cssH;
  } else { W = cssW; H = cssH; }
  canvas._cw = cssW; canvas._ch = cssH;
  canvas.width = Math.round(cssW * DPR); canvas.height = Math.round(cssH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  paintBase(true);
}
function paintBase(hard) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#FBFAF6";
  ctx.fillRect(0, 0, W, H);
  if (state.grid) drawGrid();
  if (hard) drawBodies(true);
}
function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(20,20,20,0.07)"; ctx.lineWidth = 1;
  var step = 44;
  ctx.beginPath();
  for (var x = step; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (var y = step; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = "rgba(227,6,19,0.35)";
  ctx.beginPath(); ctx.moveTo(W / 2 + 0.5, 0); ctx.lineTo(W / 2 + 0.5, H);
  ctx.moveTo(0, H / 2 + 0.5); ctx.lineTo(W, H / 2 + 0.5); ctx.stroke();
  ctx.restore();
}

// ---------- physics ----------
function step(dt) {
  var i, j, b, w, dx, dy, d2, d, f;
  var G = state.gravity * 2600 * dt;
  // gravity wells
  for (i = 0; i < state.bodies.length; i++) {
    b = state.bodies[i];
    for (j = 0; j < state.wells.length; j++) {
      w = state.wells[j];
      dx = w.x - b.x; dy = w.y - b.y;
      d2 = dx * dx + dy * dy + 900;
      d = Math.sqrt(d2);
      if (d > w.r * 2.2) continue;
      f = (w.s * G / 2600) / d2 * 60 * dt * 16;
      f = Math.min(f, 3.2);
      b.vx += (dx / d) * f; b.vy += (dy / d) * f;
    }
  }
  // spring links along spawn chain
  if (state.links && state.spring > 0) {
    var k = state.spring, rest = 26;
    for (i = 1; i < state.bodies.length; i++) {
      var a = state.bodies[i - 1], c = state.bodies[i];
      dx = c.x - a.x; dy = c.y - a.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1 || d > 220) continue;
      f = (d - rest) * k;
      var ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f;
      c.vx -= ux * f; c.vy -= uy * f;
    }
  }
  // integrate + age
  for (i = state.bodies.length - 1; i >= 0; i--) {
    b = state.bodies[i];
    b.vx *= state.damping; b.vy *= state.damping;
    // gentle tide drift
    b.vx += Math.sin((b.y + tick * 2) * 0.01) * 0.004;
    b.x += b.vx * dt * 60; b.y += b.vy * dt * 60;
    b.life += dt * 60;
    if (b.life > b.max || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) {
      state.bodies.splice(i, 1);
    }
  }
  if (state.flow && state.running && state.bodies.length < MAX_BODIES - 40) {
    if ((tick % 4) === 0) spawnBodies(2);
  }
}

// ---------- render ----------
var tick = 0;
function drawBodies(staticPass) {
  var i, b;
  // springs first (under dots)
  if (state.links) {
    ctx.lineWidth = 1;
    for (i = 1; i < state.bodies.length; i++) {
      var a = state.bodies[i - 1]; b = state.bodies[i];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 160) continue;
      var alpha = Math.max(0, 0.55 - d / 300);
      ctx.strokeStyle = (a.red || b.red) ? "rgba(227,6,19," + alpha.toFixed(3) + ")"
                                         : "rgba(20,20,20," + alpha.toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  for (i = 0; i < state.bodies.length; i++) {
    b = state.bodies[i];
    var fade = 1 - b.life / b.max;
    if (b.red) {
      ctx.fillStyle = "rgba(227,6,19," + (0.35 + 0.65 * fade).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(20,20,20," + (0.3 + 0.7 * fade).toFixed(3) + ")";
      ctx.fillRect(b.x - 1.3, b.y - 1.3, 2.6, 2.6);
    }
  }
  if (!staticPass) drawWells();
}
function drawWells(target) {
  var c = target || ctx;
  for (var i = 0; i < state.wells.length; i++) {
    var w = state.wells[i], sel = (i === state.selected);
    c.save();
    c.strokeStyle = sel ? "#1B3BFF" : "#141414";
    c.lineWidth = sel ? 2.5 : 1.5;
    c.beginPath(); c.arc(w.x, w.y, 7, 0, TAU); c.stroke();
    c.beginPath();
    c.moveTo(w.x - 14, w.y); c.lineTo(w.x + 14, w.y);
    c.moveTo(w.x, w.y - 14); c.lineTo(w.x, w.y + 14);
    c.stroke();
    c.strokeStyle = sel ? "rgba(27,59,255,0.5)" : "rgba(20,20,20,0.28)";
    c.lineWidth = 1;
    c.setLineDash([5, 5]);
    c.beginPath(); c.arc(w.x, w.y, Math.min(w.r, 400), 0, TAU); c.stroke();
    c.setLineDash([]);
    c.fillStyle = sel ? "#1B3BFF" : "#E30613";
    c.font = "700 11px 'Space Grotesk', monospace";
    c.fillText("W" + (i + 1), w.x + 11, w.y - 10);
    c.restore();
  }
  // drag preview
  if (drag && drag.mode === "create-well") {
    c.save();
    c.strokeStyle = "#E30613"; c.lineWidth = 2; c.setLineDash([6, 4]);
    c.beginPath(); c.arc(drag.x0, drag.y0, Math.max(12, drag.rad), 0, TAU); c.stroke();
    c.setLineDash([]);
    c.beginPath(); c.moveTo(drag.x0 - 10, drag.y0); c.lineTo(drag.x0 + 10, drag.y0);
    c.moveTo(drag.x0, drag.y0 - 10); c.lineTo(drag.x0, drag.y0 + 10); c.stroke();
    c.restore();
  }
}

// ---------- main loop ----------
var last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += 1 / Math.max(dt, 1e-4); fpsN++;
  if (now - fpsT > 500) {
    fpsEl.textContent = Math.round(fpsAcc / Math.max(1, fpsN)) + " FPS";
    fpsAcc = 0; fpsN = 0; fpsT = now;
    bodyCountEl.textContent = state.bodies.length;
    wellCountEl.textContent = state.wells.length;
  }
  if (!state.running) return;
  tick++;
  step(dt);
  // trail fade
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(251,250,246," + state.trail.toFixed(3) + ")";
  ctx.fillRect(0, 0, W, H);
  if (state.grid && tick % 60 === 0) drawGrid();
  drawBodies(false);
}

// ---------- pointer: drag to spawn wells / toss ----------
var drag = null;
function pos(e) {
  var r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
function wellAt(p, pad) {
  for (var i = state.wells.length - 1; i >= 0; i--) {
    var w = state.wells[i];
    if (Math.hypot(p.x - w.x, p.y - w.y) < 22 + (pad || 0)) return i;
  }
  return -1;
}
canvas.addEventListener("pointerdown", function (e) {
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  var p = pos(e);
  var idx = wellAt(p);
  if (state.tool === "well" && idx >= 0) {
    drag = { mode: "move-well", idx: idx, dx: state.wells[idx].x - p.x, dy: state.wells[idx].y - p.y, moved: false };
    state.selected = idx;
    refreshWellList();
    return;
  }
  if (state.tool === "well") {
    drag = { mode: "create-well", x0: p.x, y0: p.y, x1: p.x, y1: p.y, rad: 0 };
  } else {
    drag = { mode: "toss", pts: [p], t: performance.now() };
    fling(p, p, 6);
  }
  hideHint();
  e.preventDefault();
});
canvas.addEventListener("pointermove", function (e) {
  if (!drag) return;
  var p = pos(e);
  if (drag.mode === "create-well") {
    drag.x1 = p.x; drag.y1 = p.y;
    drag.rad = Math.hypot(p.x - drag.x0, p.y - drag.y0);
  } else if (drag.mode === "move-well") {
    var w = state.wells[drag.idx];
    w.x = Math.max(0, Math.min(W, p.x + drag.dx));
    w.y = Math.max(0, Math.min(H, p.y + drag.dy));
    drag.moved = true;
  } else if (drag.mode === "toss") {
    var prev = drag.pts[drag.pts.length - 1];
    drag.pts.push(p);
    if (drag.pts.length > 8) drag.pts.shift();
    fling(prev, p, 4);
  }
});
canvas.addEventListener("pointerup", function (e) {
  if (!drag) return;
  var p = pos(e);
  if (drag.mode === "create-well") {
    var rad = Math.hypot(p.x - drag.x0, p.y - drag.y0);
    if (rad < 8) {
      state.wells.push({ x: drag.x0, y: drag.y0, s: 1700, r: 130 });
    } else {
      state.wells.push({
        x: drag.x0, y: drag.y0,
        s: Math.min(5200, Math.max(700, rad * 16)),
        r: Math.min(320, Math.max(50, rad))
      });
    }
    if (state.wells.length > 12) state.wells.shift();
    state.selected = state.wells.length - 1;
    save(); refreshWellList();
  } else if (drag.mode === "toss" && drag.pts.length > 1) {
    var a = drag.pts[0], b2 = drag.pts[drag.pts.length - 1];
    var vx = (b2.x - a.x) * 0.12, vy = (b2.y - a.y) * 0.12;
    for (var i = 0; i < 14; i++) {
      if (state.bodies.length >= MAX_BODIES) state.bodies.shift();
      state.bodies.push({
        x: b2.x + (Math.random() - 0.5) * 14, y: b2.y + (Math.random() - 0.5) * 14,
        vx: vx * (0.6 + Math.random() * 0.8), vy: vy * (0.6 + Math.random() * 0.8),
        life: 0, max: 500 + Math.random() * 700, red: Math.random() < 0.14
      });
    }
  } else if (drag.mode === "move-well" && drag.moved) {
    save();
  }
  drag = null;
  if (state.running === false) { paintBase(false); drawBodies(false); }
});
canvas.addEventListener("dblclick", function (e) {
  var idx = wellAt(pos(e));
  if (idx >= 0) {
    state.wells.splice(idx, 1);
    if (state.selected >= state.wells.length) state.selected = state.wells.length - 1;
    save(); refreshWellList();
    if (!state.running) { paintBase(false); drawBodies(false); }
  }
});
function fling(a, b, n) {
  var vx = (b.x - a.x) * 0.55, vy = (b.y - a.y) * 0.55;
  for (var i = 0; i < n; i++) {
    if (state.bodies.length >= MAX_BODIES) state.bodies.shift();
    state.bodies.push({
      x: b.x + (Math.random() - 0.5) * 10, y: b.y + (Math.random() - 0.5) * 10,
      vx: vx + (Math.random() - 0.5), vy: vy + (Math.random() - 0.5),
      life: 0, max: 500 + Math.random() * 700, red: Math.random() < 0.14
    });
  }
}
function hideHint() {
  if (state.wells.length || state.bodies.length) dropHint.classList.add("gone");
}

// ---------- controls ----------
function setTool(t) {
  state.tool = t;
  $("toolWell").classList.toggle("active", t === "well");
  $("toolToss").classList.toggle("active", t === "toss");
  $("toolWell").setAttribute("aria-pressed", t === "well");
  $("toolToss").setAttribute("aria-pressed", t === "toss");
  canvas.style.cursor = t === "well" ? "crosshair" : "grab";
  save();
}
$("toolWell").addEventListener("click", function () { setTool("well"); });
$("toolToss").addEventListener("click", function () { setTool("toss"); });
$("tossBurst").addEventListener("click", function () {
  spawnBodies(60, Math.random, true); hideHint();
});
var freezeBtn = $("freezeBtn");
function setRunning(r) {
  state.running = r;
  freezeBtn.textContent = r ? "Freeze" : "Resume";
  freezeBtn.setAttribute("aria-pressed", String(!r));
  runStateEl.textContent = r ? "RUNNING" : "FROZEN";
  liveDot.classList.toggle("paused", !r);
  if (!r) { drawBodies(false); } // stamp wells crisply on the frozen frame
}
freezeBtn.addEventListener("click", function () { setRunning(!state.running); });

function bindSlider(id, vid, key, fmt) {
  var el = $(id);
  el.value = state[key];
  $(vid).textContent = fmt(state[key]);
  el.addEventListener("input", function () {
    state[key] = parseFloat(el.value);
    $(vid).textContent = fmt(state[key]);
    save();
  });
}
bindSlider("sGravity", "vGravity", "gravity", function (v) { return (+v).toFixed(2); });
bindSlider("sSpring", "vSpring", "spring", function (v) { return (+v).toFixed(3); });
bindSlider("sDamp", "vDamp", "damping", function (v) { return (+v).toFixed(3); });
bindSlider("sTrail", "vTrail", "trail", function (v) { return (+v).toFixed(2); });
[["cFlow", "flow"], ["cLinks", "links"], ["cGrid", "grid"]].forEach(function (pair) {
  var el = $(pair[0]);
  el.checked = state[pair[1]];
  el.addEventListener("change", function () {
    state[pair[1]] = el.checked; save();
    if (pair[1] === "grid") paintBase(false);
  });
});

$("clearWells").addEventListener("click", function () {
  state.wells = []; state.selected = -1; save(); refreshWellList();
  if (!state.running) { paintBase(false); drawBodies(false); }
});
$("clearBodies").addEventListener("click", function () {
  state.bodies = []; paintBase(false);
  if (!state.running) drawBodies(false);
});
$("reseed").addEventListener("click", function () {
  state.wells = buildWellsFromSeed(state.seed);
  state.selected = -1; save(); refreshWellList(); hideHint();
  if (!state.running) { paintBase(false); drawBodies(false); }
});
$("shuffleWells").addEventListener("click", function () {
  var rnd = Math.random;
  state.wells = state.wells.length ? state.wells : buildWellsFromSeed(state.seed);
  state.wells.forEach(function (w) {
    w.x = W * (0.1 + rnd() * 0.8); w.y = H * (0.12 + rnd() * 0.76);
    w.s = 900 + rnd() * 2600; w.r = 90 + rnd() * 130;
  });
  save(); refreshWellList();
  if (!state.running) { paintBase(false); drawBodies(false); }
});

// ---------- seed ui ----------
function applySeedUI() {
  seedReadout.textContent = state.seed;
  seedInput.value = state.seed;
  document.title = "Springtide Particle Loft — " + state.seed;
}
function setSeed(s, rebuild) {
  var ns = normSeed(s);
  if (!ns) { copyHint.textContent = "Seed needs 4 chars — try TIDE-7Q2K-42."; return false; }
  state.seed = ns;
  if (rebuild !== false) { state.wells = buildWellsFromSeed(ns); state.selected = -1; }
  state.bodies = [];
  paintBase(false);
  spawnBodies(80, rngFromSeed(ns + ":dust"), false);
  applySeedUI(); syncHash(); save(); refreshWellList(); hideHint();
  copyHint.textContent = "Planted " + ns + " — same code regrows this sky.";
  return true;
}
$("remixSeed").addEventListener("click", function () { setSeed(randomSeed(), true); });
$("applySeed").addEventListener("click", function () { setSeed(seedInput.value, true); });
seedInput.addEventListener("keydown", function (e) { if (e.key === "Enter") setSeed(seedInput.value, true); });
$("copySeed").addEventListener("click", function () {
  var link = location.href.split("#")[0] + "#s=" + encodeURIComponent(state.seed);
  var text = state.seed + " " + link;
  function done() { copyHint.textContent = "Copied " + state.seed + " + link."; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { fallback(); });
  } else fallback();
  function fallback() {
    seedInput.value = text; seedInput.select();
    try { document.execCommand("copy"); done(); } catch (e) { copyHint.textContent = link; }
    seedInput.value = state.seed;
  }
});

// ---------- well list ----------
function refreshWellList() {
  if (!state.wells.length) { wellListEl.textContent = "No wells yet — drag anywhere."; return; }
  wellListEl.textContent = state.wells.length + " well" + (state.wells.length > 1 ? "s" : "") +
    " — " + state.wells.map(function (w, i) { return "W" + (i + 1); }).join(" · ");
}

// ---------- poster export ----------
function exportPoster() {
  var wasRunning = state.running;
  var PW = 1600, PH = 2000;
  var off = document.createElement("canvas");
  off.width = PW; off.height = PH;
  var g = off.getContext("2d");
  // paper
  g.fillStyle = "#F2EFE9"; g.fillRect(0, 0, PW, PH);
  g.fillStyle = "#141414"; g.fillRect(0, 0, PW, 26);
  g.fillStyle = "#E30613"; g.fillRect(0, 26, PW, 14);
  // masthead
  g.fillStyle = "#141414";
  g.font = "900 118px Archivo, Helvetica, Arial, sans-serif";
  g.fillText("SPRINGTIDE", 110, 200);
  g.save();
  g.strokeStyle = "#141414"; g.lineWidth = 2;
  g.font = "900 118px Archivo, Helvetica, Arial, sans-serif";
  g.strokeText("PARTICLE LOFT", 110, 318);
  g.restore();
  g.font = "700 30px 'Space Grotesk', monospace";
  g.fillStyle = "#E30613";
  g.fillText("GRAVITY FIELD · " + state.seed, 112, 372);
  // field frame
  var fx = 110, fy = 420, fw = PW - 220, fh = 1240;
  g.fillStyle = "#FBFAF6"; g.fillRect(fx, fy, fw, fh);
  g.save();
  g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
  // grid
  g.strokeStyle = "rgba(20,20,20,0.08)"; g.lineWidth = 1;
  g.beginPath();
  for (var x = fx + 44; x < fx + fw; x += 44) { g.moveTo(x, fy); g.lineTo(x, fy + fh); }
  for (var y = fy + 44; y < fy + fh; y += 44) { g.moveTo(fx, y); g.lineTo(fx + fw, y); }
  g.stroke();
  // scale live scene into frame
  var s = Math.min(fw / W, fh / H);
  var ox = fx + (fw - W * s) / 2, oy = fy + (fh - H * s) / 2;
  // springs
  if (state.links) {
    for (var i = 1; i < state.bodies.length; i++) {
      var a = state.bodies[i - 1], b = state.bodies[i];
      var d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > 160) continue;
      var al = Math.max(0, 0.55 - d / 300);
      g.strokeStyle = (a.red || b.red) ? "rgba(227,6,19," + al.toFixed(3) + ")" : "rgba(20,20,20," + al.toFixed(3) + ")";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(ox + a.x * s, oy + a.y * s);
      g.lineTo(ox + b.x * s, oy + b.y * s);
      g.stroke();
    }
  }
  state.bodies.forEach(function (b) {
    var fade = 1 - b.life / b.max;
    if (b.red) {
      g.fillStyle = "rgba(227,6,19," + (0.35 + 0.65 * fade).toFixed(3) + ")";
      g.beginPath(); g.arc(ox + b.x * s, oy + b.y * s, 2.6 * s + 1, 0, TAU); g.fill();
    } else {
      g.fillStyle = "rgba(20,20,20," + (0.3 + 0.7 * fade).toFixed(3) + ")";
      var r = 1.6 * s + 0.6;
      g.fillRect(ox + b.x * s - r / 2, oy + b.y * s - r / 2, r, r);
    }
  });
  state.wells.forEach(function (w, wi) {
    var wx = ox + w.x * s, wy = oy + w.y * s;
    g.strokeStyle = "#141414"; g.lineWidth = 2;
    g.beginPath(); g.arc(wx, wy, 8, 0, TAU); g.stroke();
    g.beginPath();
    g.moveTo(wx - 15, wy); g.lineTo(wx + 15, wy);
    g.moveTo(wx, wy - 15); g.lineTo(wx, wy + 15);
    g.stroke();
    g.strokeStyle = "rgba(20,20,20,0.35)"; g.lineWidth = 1;
    g.setLineDash([6, 5]);
    g.beginPath(); g.arc(wx, wy, Math.min(w.r * s, 420), 0, TAU); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#E30613";
    g.font = "700 22px 'Space Grotesk', monospace";
    g.fillText("W" + (wi + 1), wx + 14, wy - 12);
  });
  g.restore();
  g.strokeStyle = "#141414"; g.lineWidth = 6; g.strokeRect(fx, fy, fw, fh);
  // footer meta
  var date = new Date().toISOString().slice(0, 10);
  g.fillStyle = "#141414";
  g.font = "700 28px 'Space Grotesk', monospace";
  g.fillText("SEED " + state.seed + "   ·   " + state.wells.length + " WELLS   ·   " + state.bodies.length + " BODIES", 110, 1740);
  g.font = "400 24px 'Space Grotesk', monospace";
  g.fillStyle = "#3d3d3d";
  g.fillText("G " + state.gravity.toFixed(2) + "   S " + state.spring.toFixed(3) + "   D " + state.damping.toFixed(3) + "   ·   " + date, 110, 1784);
  g.fillStyle = "#E30613"; g.fillRect(110, 1820, 220, 26);
  g.fillStyle = "#141414";
  g.font = "700 24px 'Space Grotesk', monospace";
  g.fillText("SPRINGTIDE PARTICLE LOFT — CANVAS ONLY · NO IMAGES", 110, 1880);
  // download
  var aEl = document.createElement("a");
  aEl.download = "springtide-" + state.seed.toLowerCase() + ".png";
  aEl.href = off.toDataURL("image/png");
  document.body.appendChild(aEl); aEl.click(); aEl.remove();
  exportHint.textContent = "Saved " + aEl.download + " (1600×2000).";
  if (wasRunning !== state.running) setRunning(wasRunning);
}
$("exportBtn").addEventListener("click", exportPoster);
$("exportBtn2").addEventListener("click", exportPoster);

// ---------- keyboard ----------
document.addEventListener("keydown", function (e) {
  if (/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName || "")) return;
  var k = e.key.toLowerCase();
  if (k === "f") setRunning(!state.running);
  else if (k === "r") setSeed(randomSeed(), true);
  else if (k === "e") exportPoster();
  else if (k === "w") setTool("well");
  else if (k === "t") setTool("toss");
  else if ((k === "backspace" || k === "delete") && state.selected >= 0) {
    state.wells.splice(state.selected, 1);
    state.selected = state.wells.length - 1;
    save(); refreshWellList();
    if (!state.running) { paintBase(false); drawBodies(false); }
    e.preventDefault();
  }
});

// ---------- boot ----------
$("year").textContent = new Date().getFullYear();
load();
applySeedUI(); syncHash();
setTool(state.tool);
setRunning(true);
refreshWellList();
// sync slider DOM to loaded values
[["sGravity","vGravity","gravity",2],["sSpring","vSpring","spring",3],["sDamp","vDamp","damping",3],["sTrail","vTrail","trail",2]].forEach(function (t) {
  $(t[0]).value = state[t[2]];
  $(t[1]).textContent = (+state[t[2]]).toFixed(t[3]);
});
[["cFlow","flow"],["cLinks","links"],["cGrid","grid"]].forEach(function (p) { $(p[0]).checked = state[p[1]]; });
fitCanvas();
window.addEventListener("resize", fitCanvas);
spawnBodies(110, rngFromSeed(state.seed + ":dust"), false);
hideHint();
if (!state.wells.length && !state.bodies.length) dropHint.classList.remove("gone");
requestAnimationFrame(function (n) { last = n; requestAnimationFrame(frame); });
window.addEventListener("beforeunload", save);

console.log("springtide-particle-loft ready", state.seed);
})();
