/* Second Hand Orchestra — generative clock ensemble.
   Plain script (works from file://). WebAudio only, no samples, no network. */
(function () {
"use strict";

/* ---------- utils ---------- */
function $(sel) { return document.querySelector(sel); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function b64urlEncode(obj) {
  var json = JSON.stringify(obj);
  var bin = unescape(encodeURIComponent(json));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  try {
    var b = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch (e) { return null; }
}

/* ---------- constants ---------- */
var LS_KEY = "sho-state-v1";
var WIN = 60; // history window seconds
var PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
var ROOTS = [110, 87.31, 130.81, 98]; // Am F C G
var LAYER_DEFS = [
  { id: "pulse",   name: "Pulse",   desc: "bass heartbeat on the beats", color: "#8b5cf6" },
  { id: "arp",     name: "Arp",     desc: "restless 16th-note wanderer", color: "#22d3ee" },
  { id: "shimmer", name: "Shimmer", desc: "sparse high glass bells",     color: "#fbbf24" },
  { id: "drift",   name: "Drift",   desc: "one noise-swell per bar",     color: "#8b5cf6" },
  { id: "second",  name: "Second",  desc: "a new pitched tick, every second", color: "#fbbf24" }
];
var LANES = ["clock", "pulse", "arp", "shimmer", "drift", "second"];
var LANE_COLOR = { clock: "#ffffff", pulse: "#8b5cf6", arp: "#22d3ee", shimmer: "#fbbf24", drift: "#8b5cf6", second: "#fbbf24" };

/* ---------- state ---------- */
var state = {
  running: false,
  bpm: 96,
  taps: [],
  seed: (Math.random() * 1e9) | 0,
  ensemble: { tick: true, tock: true, bell: true },
  layers: {},
  symphonies: [],
  symCount: 0,
  mode: "live" // 'live' | 'replay'
};
LAYER_DEFS.forEach(function (d, i) {
  state.layers[d.id] = { on: true, vol: i === 0 ? 0.8 : 0.7, mute: false, solo: false };
});
function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      bpm: state.bpm, seed: state.seed, ensemble: state.ensemble,
      layers: state.layers, symphonies: state.symphonies, symCount: state.symCount
    }));
  } catch (e) {}
}
function restore() {
  try {
    var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!s) return;
    if (s.bpm) state.bpm = clamp(s.bpm | 0, 50, 180);
    if (s.seed != null) state.seed = s.seed;
    if (s.ensemble) state.ensemble = s.ensemble;
    if (s.layers) Object.keys(s.layers).forEach(function (k) { if (state.layers[k]) state.layers[k] = s.layers[k]; });
    if (s.symphonies) state.symphonies = s.symphonies;
    if (s.symCount) state.symCount = s.symCount;
  } catch (e) {}
}

/* ---------- audio graph ---------- */
var ctx = null, master = null, layerGain = {}, noiseBuf = null;
function ensureCtx() {
  if (ctx) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  ["clock", "pulse", "arp", "shimmer", "drift", "second"].forEach(function (id) {
    var g = ctx.createGain(); g.gain.value = 0.8; g.connect(master);
    layerGain[id] = g;
  });
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  var d = noiseBuf.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function now() { return ctx ? ctx.currentTime : 0; }
function audible(id) {
  var L = state.layers[id];
  if (id === "clock") {
    var anySolo = LAYER_DEFS.some(function (x) { return state.layers[x.id].solo; });
    return !anySolo; // clock voice toggles live in state.ensemble
  }
  if (!L || !L.on || L.mute) return false;
  var anySolo = LAYER_DEFS.some(function (x) { return state.layers[x.id].solo; });
  return !anySolo || L.solo;
}
function applyGains() {
  if (!ctx) return;
  LAYER_DEFS.forEach(function (def) {
    var L = state.layers[def.id];
    var target = (!L.on || L.mute) ? 0 : L.vol;
    var anySolo = LAYER_DEFS.some(function (x) { return state.layers[x.id].solo; });
    if (anySolo && !L.solo) target = 0;
    layerGain[def.id].gain.setTargetAtTime(target, now(), 0.03);
  });
}

/* --- primitive voices (all record into history for the scrubber) --- */
var history = []; // {t, lane, freq, dur, vol}
function logEvent(t, lane, freq, dur, vol) {
  history.push({ t: t, lane: lane, freq: +freq.toFixed(2), dur: +dur.toFixed(3), vol: +vol.toFixed(3) });
  if (history.length > 4000) history.splice(0, history.length - 4000);
}
function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(t, lane, freq, dur, vol, type) {
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "sine"; o.frequency.value = freq;
  env(g, t, vol, dur);
  o.connect(g); g.connect(layerGain[lane]);
  o.start(t); o.stop(t + dur + 0.05);
  logEvent(t, lane, freq, dur, vol);
}
function bell(t, lane, freq, dur, vol) {
  [1, 2.01, 2.74].forEach(function (m, i) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq * m;
    env(g, t, vol / (i * 1.6 + 1), dur / (1 + i * 0.4));
    o.connect(g); g.connect(layerGain[lane]);
    o.start(t); o.stop(t + dur + 0.1);
  });
  logEvent(t, lane, freq, dur, vol);
}
function click(t, which) {
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "square"; o.frequency.value = which === "tick" ? 1900 : 1250;
  env(g, t, 0.22, 0.05);
  o.connect(g); g.connect(layerGain.clock);
  o.start(t); o.stop(t + 0.1);
  logEvent(t, "clock", o.frequency.value, 0.05, 0.22);
}
function swell(t, dur) {
  var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.4;
  f.frequency.setValueAtTime(380, t);
  f.frequency.exponentialRampToValueAtTime(2500, t + dur * 0.55);
  f.frequency.exponentialRampToValueAtTime(500, t + dur);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(layerGain.drift);
  src.start(t); src.stop(t + dur + 0.05);
  logEvent(t, "drift", 0, dur, 0.32);
}
function resynth(ev, t) {
  // re-play one recorded event through the live graph (used by replay/scrub)
  if (ev.lane === "clock") {
    if (ev.freq > 1500 && state.ensemble.tick) click(t, "tick");
    else if (ev.freq <= 1500 && ev.freq > 10 && state.ensemble.tock) click(t, "tock");
    else if (ev.freq > 10) click(t, "tick");
    else if (state.ensemble.bell) bell(t, "clock", 880, 1.1, 0.14);
    return;
  }
  if (ev.lane === "drift") { swell(t, ev.dur); return; }
  if (ev.lane === "shimmer" || ev.lane === "second") bell(t, ev.lane, ev.freq, ev.dur, ev.vol);
  else tone(t, ev.lane, ev.freq, ev.dur, ev.vol, ev.lane === "pulse" ? "triangle" : "sawtooth");
}

/* ---------- generative scheduler ---------- */
var rng = mulberry32(state.seed);
var step = 0, nextT = 0, timer = null, curSecond = -1, arpWalk = 2;
var LOOKAHEAD = 0.12, TICK_MS = 25;
function stepDur() { return 60 / state.bpm / 4; }

function liveStep(s, t) {
  var beat = Math.floor(s / 4) % 4, bar = Math.floor(s / 16);
  var sd = stepDur(), barDur = sd * 16;
  // ensemble clocks
  if (s % 4 === 0 && state.ensemble.tick) click(t, "tick");
  if (s % 4 === 2 && state.ensemble.tock) click(t, "tock");
  if (s % 16 === 0 && state.ensemble.bell) { bell(t, "clock", 880, 1.2, 0.13); logEvent(t, "clock", 1, 1.2, 0.13); }
  // layers
  if (audible("pulse") && (s % 8 === 0 || s % 8 === 5))
    tone(t, "pulse", ROOTS[bar % 4] * (s % 8 === 5 ? 1.5 : 1), 0.3, 0.5, "triangle");
  if (audible("arp")) {
    var density = 0.25 + 0.5 * ((curSecond < 0 ? 0 : curSecond % 16) / 16);
    if (rng() < density) {
      arpWalk = clamp(arpWalk + ((rng() * 5) | 0) - 2, 0, PENTA.length - 1);
      var oct = (curSecond >= 0 && curSecond % 32 >= 16) ? 2 : 1;
      tone(t, "arp", PENTA[arpWalk] * oct, 0.16, 0.26, "sawtooth");
    }
  }
  if (audible("shimmer") && s % 8 === 6 && rng() < 0.75) {
    var n = PENTA[(rng() * PENTA.length) | 0] * 2;
    bell(t, "shimmer", n, 1.6, 0.12);
  }
  if (audible("drift") && s % 16 === 0) swell(t, barDur);
  // second-hand pitched tick is scheduled by onSecond(), not here
}
function onSecond(sec, t) {
  curSecond = sec;
  $("#sec-num").textContent = (sec < 10 ? "0" : "") + sec;
  if (!state.running || state.mode !== "live") return;
  if (audible("second")) {
    var f = PENTA[sec % PENTA.length] * (sec % 32 >= 16 ? 2 : 1);
    bell(t, "second", f, 0.5, 0.2);
  } else {
    logEvent(t, "second", 0, 0.01, 0); // keep lane honest even when muted
  }
}
function schedulerTick() {
  if (!state.running) return;
  if (state.mode === "live") {
    while (nextT < now() + LOOKAHEAD) { liveStep(step, nextT); step++; nextT += stepDur(); }
  } else {
    replayTick();
  }
  // prune history + second tracking
  var n = now();
  while (history.length && history[0].t < n - (WIN + 15)) history.shift();
  var sec = Math.floor(n) % 60;
  if (sec !== lastDrawnSec) { lastDrawnSec = sec; onSecond(sec, n + 0.01); }
  updateTlMeta();
}

/* ---------- replay engine (scrub + symphonies) ---------- */
var replay = null; // {events:[{dt,...}], dur, pos, nextIdx, endAt}
function startReplay(events, dur, startAt) {
  replay = { events: events.slice().sort(function (a, b) { return a.dt - b.dt; }), dur: dur, nextIdx: 0 };
  seekReplay(startAt || 0);
  state.mode = "replay";
  $("#btn-live").classList.remove("hidden");
  $("#tl-label").textContent = "replay · drag to scrub";
  $("#tl-label").classList.add("replay");
}
function seekReplay(offset) {
  if (!replay) return;
  replay.base = now();
  replay.offset = clamp(offset, 0, replay.dur);
  replay.nextIdx = 0;
  while (replay.nextIdx < replay.events.length && replay.events[replay.nextIdx].dt < replay.offset)
    replay.nextIdx++;
}
function replayTick() {
  if (!replay) return;
  var elapsed = (now() - replay.base) + replay.offset;
  if (elapsed >= replay.dur) { seekReplay(0); elapsed = 0; } // loop the minute
  replay.elapsed = elapsed;
  var horizon = elapsed + LOOKAHEAD + 0.05;
  while (replay.nextIdx < replay.events.length && replay.events[replay.nextIdx].dt <= horizon) {
    var ev = replay.events[replay.nextIdx++];
    var at = replay.base + (ev.dt - replay.offset);
    if (at < now() - 0.02) continue;
    resynth(ev, Math.max(at, now() + 0.005));
  }
}
function stopReplay() {
  replay = null;
  state.mode = "live";
  step = 0; nextT = now() + 0.05;
  $("#btn-live").classList.add("hidden");
  $("#tl-label").textContent = "live · last 60s";
  $("#tl-label").classList.remove("replay");
}

/* ---------- transport / tempo ---------- */
function setBpm(v, fromSlider) {
  state.bpm = clamp(Math.round(v), 50, 180);
  $("#bpm-num").textContent = state.bpm;
  if (!fromSlider) $("#bpm-range").value = state.bpm;
  persist();
}
function tap() {
  var t = performance.now();
  state.taps.push(t);
  state.taps = state.taps.filter(function (x) { return t - x < 3000; }).slice(-6);
  var btn = $("#btn-tap");
  btn.classList.remove("pulse"); void btn.offsetWidth; btn.classList.add("pulse");
  if (state.taps.length >= 2) {
    var iv = [];
    for (var i = 1; i < state.taps.length; i++) iv.push(state.taps[i] - state.taps[i - 1]);
    var avg = iv.reduce(function (a, b) { return a + b; }, 0) / iv.length;
    if (avg > 200) setBpm(60000 / avg);
  }
}
function setPower(on) {
  ensureCtx();
  var btn = $("#btn-power");
  if (on) {
    ctx.resume();
    state.running = true;
    step = 0; nextT = now() + 0.06;
    rng = mulberry32(state.seed + ((Math.random() * 1e6) | 0));
    timer = setInterval(schedulerTick, TICK_MS);
    btn.textContent = "⏸ Stop the clock";
    btn.classList.add("playing");
    btn.setAttribute("aria-pressed", "true");
    ["btn-tap", "btn-capture", "btn-copy", "bpm-range"].forEach(function (id) { $("#" + id).disabled = false; });
    $("#audio-hint").textContent = "The clock is running — every second adds a new layer.";
  } else {
    state.running = false;
    clearInterval(timer); timer = null;
    if (replay) stopReplay();
    ctx.suspend();
    btn.textContent = "▶ Start the clock";
    btn.classList.remove("playing");
    btn.setAttribute("aria-pressed", "false");
    $("#audio-hint").textContent = "Paused. Press start to conduct again.";
  }
}

/* ---------- mixer UI ---------- */
function renderMixer() {
  var mx = $("#mixer"); mx.innerHTML = "";
  LAYER_DEFS.forEach(function (def) {
    var L = state.layers[def.id];
    var el = document.createElement("div");
    el.className = "chan" + (L.mute || !L.on ? " muted" : "");
    el.dataset.layer = def.id;
    el.innerHTML =
      '<div class="chan-top"><span class="dot"></span>' +
      '<div><span class="chan-name">' + def.name + '</span>' +
      '<span class="chan-desc">' + def.desc + '</span></div></div>' +
      '<div class="chan-btns">' +
      '<button class="mini mute" aria-pressed="' + L.mute + '" title="mute">M</button>' +
      '<button class="mini solo" aria-pressed="' + L.solo + '" title="solo">S</button></div>' +
      '<input type="range" min="0" max="100" value="' + Math.round(L.vol * 100) + '" aria-label="' + def.name + ' volume" />';
    el.querySelector(".chan-top").style.cursor = "pointer";
    el.querySelector(".chan-top").title = "click to enable/disable layer";
    el.querySelector(".chan-top").addEventListener("click", function () {
      L.on = !L.on; applyGains(); persist(); renderMixer();
    });
    el.querySelector(".mute").addEventListener("click", function (e) {
      e.stopPropagation(); L.mute = !L.mute; applyGains(); persist(); renderMixer();
    });
    el.querySelector(".solo").addEventListener("click", function (e) {
      e.stopPropagation(); L.solo = !L.solo; applyGains(); persist(); renderMixer();
    });
    el.querySelector('input[type="range"]').addEventListener("input", function (e) {
      L.vol = e.target.value / 100;
      if (L.vol > 0 && L.mute) L.mute = false;
      applyGains(); persist();
      el.classList.toggle("muted", L.mute || !L.on);
    });
    mx.appendChild(el);
  });
}
function flashLane(lane) {
  var map = { pulse: "pulse", arp: "arp", shimmer: "shimmer", drift: "drift", second: "second" };
  var id = map[lane]; if (!id) return;
  var el = document.querySelector('.chan[data-layer="' + id + '"]');
  if (!el) return;
  el.classList.add("lit", "hit");
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove("lit", "hit"); }, 180);
}
// flash mixer lanes on recent events (visual only, cheap)
setInterval(function () {
  if (!state.running || !ctx) return;
  var n = now();
  for (var i = history.length - 1; i >= 0; i--) {
    if (n - history[i].t > 0.12) break;
    if (Math.abs(n - history[i].t) < 0.1) flashLane(history[i].lane);
  }
}, 120);

/* ---------- ring (second hand) ---------- */
var ring = $("#ring"), rctx = ring.getContext("2d"), lastDrawnSec = -1;
function drawRing() {
  var W = ring.width, H = ring.height, cx = W / 2, cy = H / 2, R = 84;
  rctx.clearRect(0, 0, W, H);
  var sec = state.running && ctx ? Math.floor(now()) % 60 : (lastDrawnSec < 0 ? 0 : lastDrawnSec);
  var frac = state.running && ctx ? (now() % 1) : 0;
  for (var s = 0; s < 60; s++) {
    var a = (s / 60) * Math.PI * 2 - Math.PI / 2;
    var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    var isCur = s === sec, isPast = s < sec || (!state.running && s <= sec);
    rctx.beginPath();
    rctx.arc(x, y, isCur ? 5 : s % 5 === 0 ? 3.4 : 2.2, 0, Math.PI * 2);
    if (isCur) { rctx.fillStyle = "#fbbf24"; rctx.shadowColor = "#fbbf24"; rctx.shadowBlur = 12; }
    else if (isPast) { rctx.fillStyle = "rgba(139,92,246,.85)"; rctx.shadowBlur = 0; }
    else { rctx.fillStyle = "rgba(255,255,255,.28)"; rctx.shadowBlur = 0; }
    rctx.fill(); rctx.shadowBlur = 0;
  }
  // sweep hand
  var ha = ((sec + frac) / 60) * Math.PI * 2 - Math.PI / 2;
  rctx.beginPath(); rctx.moveTo(cx, cy);
  rctx.lineTo(cx + Math.cos(ha) * (R - 8), cy + Math.sin(ha) * (R - 8));
  rctx.strokeStyle = "#22d3ee"; rctx.lineWidth = 2; rctx.stroke();
  rctx.beginPath(); rctx.arc(cx, cy, 4, 0, Math.PI * 2); rctx.fillStyle = "#22d3ee"; rctx.fill();
}

/* ---------- timeline ---------- */
var tl = $("#timeline"), tctx = tl.getContext("2d");
function sizeTimeline() {
  var r = tl.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  tl.width = Math.max(300, r.width * dpr); tl.height = 148 * dpr;
}
window.addEventListener("resize", sizeTimeline);
function visibleEvents() {
  // what the timeline shows right now: {list, winStart, cursor}
  if (state.mode === "replay" && replay && replay.src === "symphony") {
    return { list: replay.events, winStart: 0, dur: replay.dur, cursor: replay.elapsed || 0, loop: true };
  }
  var n = now();
  if (state.mode === "replay" && replay && replay.src === "history") {
    return { list: replay.events, winStart: replay.winStart, dur: WIN, cursor: replay.winStart + (replay.elapsed || 0), loop: true };
  }
  return { list: history, winStart: n - WIN, dur: WIN, cursor: n, loop: false, live: true };
}
function drawTimeline() {
  var W = tl.width, H = tl.height;
  tctx.clearRect(0, 0, W, H);
  var v = visibleEvents();
  var laneH = H / LANES.length;
  tctx.font = (10 * Math.min(window.devicePixelRatio || 1, 2)) + "px Space Grotesk, sans-serif";
  LANES.forEach(function (lane, li) {
    var y = li * laneH;
    tctx.fillStyle = "rgba(255,255,255,.10)";
    tctx.fillRect(0, y + laneH - 1, W, 1);
    tctx.fillStyle = "rgba(255,255,255,.38)";
    tctx.fillText(lane, 6, y + 14 * Math.min(window.devicePixelRatio || 1, 2));
  });
  function x(t) { return ((t - v.winStart) / v.dur) * W; }
  v.list.forEach(function (ev) {
    var t = ev.dt != null && v.loop ? v.winStart + ev.dt : ev.t;
    if (t < v.winStart || t > v.winStart + v.dur) return;
    var li = LANES.indexOf(ev.lane); if (li < 0) return;
    var y = li * laneH + laneH / 2;
    tctx.beginPath();
    tctx.arc(x(t), y, (ev.lane === "second" ? 3.4 : 2.6) * Math.min(window.devicePixelRatio || 1, 2), 0, Math.PI * 2);
    tctx.fillStyle = LANE_COLOR[ev.lane] || "#fff";
    tctx.globalAlpha = ev.vol <= 0 ? 0.15 : 0.9;
    tctx.fill(); tctx.globalAlpha = 1;
  });
  // playhead
  var px = x(v.cursor);
  tctx.strokeStyle = v.live ? "#22d3ee" : "#fbbf24";
  tctx.lineWidth = 2 * Math.min(window.devicePixelRatio || 1, 2);
  tctx.beginPath(); tctx.moveTo(px, 0); tctx.lineTo(px, H); tctx.stroke();
}
function updateTlMeta() {
  var n = history.length;
  $("#tl-count").textContent = n + " events";
}
var scrubbing = false;
function scrubTo(clientX) {
  var r = tl.getBoundingClientRect();
  var frac = clamp((clientX - r.left) / r.width, 0, 1);
  if (state.mode !== "replay" || !replay || replay.src !== "history") {
    // enter scrub mode from live history
    var n = now();
    var slice = history.filter(function (e) { return e.t >= n - WIN; })
      .map(function (e) { return { dt: e.t - (n - WIN), lane: e.lane, freq: e.freq, dur: e.dur, vol: e.vol }; });
    if (!slice.length) return;
    replay = null;
    startReplay(slice, WIN, 0);
    replay.src = "history";
    replay.winStart = n - WIN;
  }
  seekReplay(frac * replay.dur);
}
tl.addEventListener("pointerdown", function (e) {
  if (!state.running) return;
  scrubbing = true; tl.setPointerCapture(e.pointerId); scrubTo(e.clientX);
});
tl.addEventListener("pointermove", function (e) { if (scrubbing) scrubTo(e.clientX); });
tl.addEventListener("pointerup", function () { scrubbing = false; });

/* ---------- symphonies ---------- */
var LANE_IDX = { clock: 0, pulse: 1, arp: 2, shimmer: 3, drift: 4, second: 5 };
var LANE_FROM_IDX = ["clock", "pulse", "arp", "shimmer", "drift", "second"];
function packEvents(evs) {
  return evs.map(function (e) { return [e.dt, LANE_IDX[e.lane] != null ? LANE_IDX[e.lane] : 2, e.freq, e.dur, e.vol]; });
}
function unpackEvents(packed) {
  return packed.map(function (a) {
    if (Array.isArray(a)) return { dt: a[0], lane: LANE_FROM_IDX[a[1]] || "arp", freq: a[2], dur: a[3], vol: a[4] };
    return { dt: a.dt, lane: a.lane, freq: a.freq, dur: a.dur, vol: a.vol };
  });
}
function snapshotLayers() {
  var o = {};
  Object.keys(state.layers).forEach(function (k) { o[k] = { on: state.layers[k].on, vol: state.layers[k].vol }; });
  return o;
}
function captureMinute() {
  var n = now();
  var evs = history.filter(function (e) { return e.t >= n - WIN; })
    .map(function (e) {
      return { dt: +((e.t - (n - WIN)).toFixed(3)), lane: e.lane, freq: e.freq, dur: e.dur, vol: e.vol };
    });
  if (!evs.length) return null;
  state.symCount++;
  var sym = {
    name: "Symphony №" + state.symCount,
    created: new Date().toLocaleString(),
    bpm: state.bpm, seed: state.seed,
    ensemble: JSON.parse(JSON.stringify(state.ensemble)),
    layers: snapshotLayers(),
    events: evs, dur: WIN
  };
  state.symphonies.unshift(sym);
  state.symphonies = state.symphonies.slice(0, 12);
  persist(); renderSyms();
  return sym;
}
function playSymphony(sym) {
  ensureCtx(); ctx.resume();
  if (!state.running) setPower(true);
  state.ensemble = JSON.parse(JSON.stringify(sym.ensemble));
  syncEnsembleUI();
  startReplay(sym.events, sym.dur, 0);
  replay.src = "symphony";
  $("#tl-label").textContent = "replay · " + sym.name;
}
function shareSymphony(sym) {
  var payload = {
    v: 2, name: sym.name, bpm: sym.bpm, seed: sym.seed,
    ensemble: sym.ensemble, layers: sym.layers, events: packEvents(sym.events), dur: sym.dur
  };
  var url = location.href.split("#")[0] + "#s=" + b64urlEncode(payload);
  var box = $("#share-link");
  box.classList.remove("hidden");
  var a = $("#share-url"); a.href = url; a.textContent = url;
  return url;
}
function renderSyms() {
  var ul = $("#sym-list"); ul.innerHTML = "";
  state.symphonies.forEach(function (sym, i) {
    var li = document.createElement("li");
    li.className = "sym";
    li.innerHTML = "<b></b><small></small><span class='spacer'></span>";
    li.querySelector("b").textContent = sym.name;
    li.querySelector("small").textContent = sym.events.length + " events · " + sym.bpm + "bpm · " + sym.created;
    [["▶ Play", function () { playSymphony(sym); }],
     ["⧉ Link", function () {
        var url = shareSymphony(sym);
        copyText(url);
      }],
     ["✕", function () { state.symphonies.splice(i, 1); persist(); renderSyms(); }]
    ].forEach(function (pair) {
      var b = document.createElement("button");
      b.className = "btn ghost"; b.textContent = pair[0];
      b.addEventListener("click", pair[1]);
      li.appendChild(b);
    });
    ul.appendChild(li);
  });
}
function copyText(t) {
  function done() {
    var b = $("#btn-copy"); var orig = b.textContent;
    b.textContent = "✓ Copied!"; setTimeout(function () { b.textContent = orig; }, 1600);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, function () { fallback(); });
  } else fallback();
  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
}

/* ---------- ensemble UI ---------- */
function syncEnsembleUI() {
  document.querySelectorAll("#ensemble .voice").forEach(function (b) {
    var on = !!state.ensemble[b.dataset.voice];
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on);
  });
}

/* ---------- rAF loop ---------- */
function frame() {
  drawRing();
  drawTimeline();
  requestAnimationFrame(frame);
}

/* ---------- wire up ---------- */
function init() {
  restore();
  setBpm(state.bpm);
  $("#bpm-range").value = state.bpm;
  renderMixer(); renderSyms(); syncEnsembleUI();
  sizeTimeline();
  updateTlMeta();

  $("#btn-power").addEventListener("click", function () { setPower(!state.running); });
  $("#btn-tap").addEventListener("click", tap);
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); tap(); }
  });
  $("#bpm-range").addEventListener("input", function (e) { setBpm(+e.target.value, true); });
  document.querySelectorAll("#ensemble .voice").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.dataset.voice;
      state.ensemble[v] = !state.ensemble[v];
      b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
      syncEnsembleUI(); persist();
    });
  });
  $("#btn-live").addEventListener("click", stopReplay);
  $("#btn-capture").addEventListener("click", function () {
    var sym = captureMinute();
    if (sym) shareSymphony(sym);
  });
  $("#btn-copy").addEventListener("click", function () {
    var sym = state.symphonies[0] || captureMinute();
    if (sym) copyText(shareSymphony(sym));
  });

  // shared symphony via URL hash
  if (location.hash.indexOf("#s=") === 0) {
    var data = b64urlDecode(location.hash.slice(3));
    if (data && data.events && data.events.length) {
      var evs = unpackEvents(data.events);
      setBpm(data.bpm || 96);
      if (data.layers) Object.keys(data.layers).forEach(function (k) {
        if (state.layers[k]) { state.layers[k].on = data.layers[k].on; state.layers[k].vol = data.layers[k].vol; }
      });
      if (data.ensemble) state.ensemble = data.ensemble;
      state.symCount++;
      var sym = {
        name: (data.name || "Shared symphony") + " (link)",
        created: new Date().toLocaleString(),
        bpm: state.bpm, seed: data.seed || 0,
        ensemble: state.ensemble, layers: snapshotLayers(),
        events: evs, dur: data.dur || WIN
      };
      state.symphonies.unshift(sym);
      renderMixer(); renderSyms(); syncEnsembleUI(); persist();
      shareSymphony(sym);
      $("#audio-hint").textContent = "A shared symphony arrived — press start, then play it from the list.";
    }
  }
  requestAnimationFrame(frame);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
