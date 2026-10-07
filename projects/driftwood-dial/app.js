/* Driftwood Dial — Patent Drift Computer No. 1887
   Plain JS, no deps. Canvas + CSS only, no images. */
(function () {
  "use strict";

  var LS_KEY = "driftwood-dial-v1";
  var DEFAULTS = { heading: 45, knots: 6, current: 2, hours: 12, seed: 1887, waypoints: [] };

  // ── state ──────────────────────────────────────────────
  function loadState() {
    var s = Object.assign({}, DEFAULTS);
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
    // URL hash overrides storage (share links win)
    try {
      var h = location.hash.replace(/^#/, "");
      if (h) {
        var p = new URLSearchParams(h);
        ["heading", "knots", "current", "hours", "seed"].forEach(function (k) {
          if (p.get(k) !== null) s[k] = parseFloat(p.get(k));
        });
        if (p.get("wp")) {
          try {
            s.waypoints = JSON.parse(decodeURIComponent(p.get("wp")));
            if (!Array.isArray(s.waypoints)) s.waypoints = [];
          } catch (e) { s.waypoints = []; }
        }
      }
    } catch (e) { /* file:// quirks */ }
    s.heading = norm360(s.heading || 0);
    s.knots = clamp(parseFloat(s.knots) || 6, 1, 14);
    s.current = clamp(parseFloat(s.current) || 0, 0, 6);
    s.hours = clamp(Math.round(s.hours) || 12, 2, 48);
    s.seed = Math.abs(Math.round(s.seed)) || 1887;
    if (!Array.isArray(s.waypoints)) s.waypoints = [];
    return s;
  }
  var state = loadState();
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
      renderShareUrl();
    }, 250);
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  function $(id) { return document.getElementById(id); }

  var WINDS = ["North", "North-North-East", "North-East", "East-North-East", "East",
    "East-South-East", "South-East", "South-South-East", "South", "South-South-West",
    "South-West", "West-South-West", "West", "West-North-West", "North-West", "North-North-West"];
  function pointName(h) { return WINDS[Math.round(h / 22.5) % 16]; }

  // ── seeded RNG (mulberry32) ────────────────────────────
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var ISLE_NAMES = ["Cinder Quay", "Gull's Lament", "Brass Widow Reef", "Tallow Isle",
    "The Kettle", "Verdigris Cay", "Hermit's Button", "Sootfall Rock", "Lantern Deep",
    "Marrow Bank", "Cogwheel Cay", "Ashen Twins"];
  var islands = [];
  function genIslands(seed) {
    var rnd = mulberry32(seed), out = [], i;
    for (i = 0; i < 8; i++) {
      var x = 120 + rnd() * 660, y = 90 + rnd() * 500;
      // keep fairway near start port & center lane mostly clear
      if (Math.hypot(x - 95, y - 430) < 120) { x += 160; }
      out.push({
        name: ISLE_NAMES[i % ISLE_NAMES.length],
        x: x, y: y,
        r: 22 + rnd() * 46,
        wob: 0.25 + rnd() * 0.45,
        seed: Math.floor(rnd() * 1e9),
        reef: rnd() > 0.45
      });
    }
    return out;
  }

  // ── dom refs ───────────────────────────────────────────
  var dial = $("dial"), needle = $("needle"), ticksEl = $("ticks"),
    headingVal = $("headingVal"), pointEl = $("pointName"),
    knotsEl = $("knots"), currentEl = $("current"), hoursEl = $("hours"),
    knotsVal = $("knotsVal"), currentVal = $("currentVal"), hoursVal = $("hoursVal"),
    gSpeed = $("gSpeed"), gDrift = $("gDrift"), gBoiler = $("gBoiler"),
    boilerFill = $("boilerFill"), boilerPct = $("boilerPct"),
    plaqueRoute = $("plaqueRoute"), plaqueLandfall = $("plaqueLandfall"),
    wpList = $("wpList"), toastEl = $("toast"), shareUrlEl = $("shareUrl"),
    canvas = $("chart"), ctx = canvas.getContext("2d");

  var CW = canvas.width, CH = canvas.height;
  var PORT = { x: 95, y: 430 };        // Cinder Quay anchorage
  var PX_PER_KNH = 9;                  // chart scale
  var soundOn = false, audioCtx = null;
  var helmTween = null;                // scroll-driven heading animation
  var ghostProgress = 0;               // 0..1 sailed fraction (scroll-driven)
  var boiler = 0;                      // 0..1 page scroll fraction

  // ── build dial ticks ───────────────────────────────────
  (function buildTicks() {
    var frag = document.createDocumentFragment();
    for (var d = 0; d < 360; d += 6) {
      var major = d % 30 === 0;
      var t = document.createElement("div");
      t.className = "tick" + (major ? " major" : "");
      var r = dialRadius() - (major ? 26 : 20);
      t.style.height = (major ? 15 : 9) + "px";
      t.style.transform = "rotate(" + d + "deg) translateY(-" + r + "px)";
      t.style.transformOrigin = "50% 0";
      // position at center then rotate out
      t.style.left = "calc(50% - 1px)";
      t.style.top = "50%";
      frag.appendChild(t);
      if (major && d % 90 !== 0) {
        var lab = document.createElement("div");
        lab.className = "tick-label";
        var lr = r - 22, rad = (d - 90) * Math.PI / 180;
        lab.style.left = (50 + (lr / dialRadius() * 50) * Math.cos(rad)) + "%";
        lab.style.top = (50 + (lr / dialRadius() * 50) * Math.sin(rad)) + "%";
        lab.textContent = d;
        frag.appendChild(lab);
      }
    }
    ticksEl.appendChild(frag);
  })();
  function dialRadius() {
    var w = dial.getBoundingClientRect().width || 240;
    return w / 2;
  }

  // ── heading control ────────────────────────────────────
  var lastDetent = Math.round(state.heading / 15);
  function setHeading(h, fromUser) {
    h = norm360(h);
    var det = Math.round(h / 15);
    state.heading = h;
    needle.style.transform = "rotate(" + h + "deg)";
    dial.setAttribute("aria-valuenow", Math.round(h));
    headingVal.textContent = String(Math.round(h)).padStart(3, "0");
    pointEl.textContent = pointName(h);
    if (fromUser && helmTween) { cancelAnimationFrame(helmTween); helmTween = null; }
    if (fromUser && soundOn && det !== lastDetent) click();
    lastDetent = det;
    refresh();
    save();
  }
  // ease heading toward target (scroll chapters use this)
  function easeHeadingTo(target, knots) {
    if (helmTween) cancelAnimationFrame(helmTween);
    var from = state.heading, to = norm360(target);
    var delta = ((to - from + 540) % 360) - 180; // shortest way
    var t0 = performance.now(), dur = 900;
    function step(t) {
      var k = clamp((t - t0) / dur, 0, 1);
      k = 1 - Math.pow(1 - k, 3);
      setHeading(from + delta * k, false);
      if (k < 1) helmTween = requestAnimationFrame(step);
      else {
        helmTween = null;
        if (typeof knots === "number") { state.knots = knots; knotsEl.value = knots; refresh(); save(); }
      }
    }
    helmTween = requestAnimationFrame(step);
  }

  // drag to turn
  var dragging = false;
  function angleFromEvent(e) {
    var r = dial.getBoundingClientRect();
    var x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) - (r.left + r.width / 2);
    var y = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) - (r.top + r.height / 2);
    return norm360(Math.atan2(x, -y) * 180 / Math.PI);
  }
  dial.addEventListener("pointerdown", function (e) {
    dragging = true; dial.setPointerCapture(e.pointerId);
    setHeading(angleFromEvent(e), true);
  });
  dial.addEventListener("pointermove", function (e) {
    if (dragging) setHeading(angleFromEvent(e), true);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    dial.addEventListener(ev, function () { dragging = false; });
  });
  dial.addEventListener("wheel", function (e) {
    e.preventDefault();
    setHeading(state.heading + (e.deltaY > 0 ? 2 : -2), true);
  }, { passive: false });
  dial.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { setHeading(state.heading + 1, true); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setHeading(state.heading - 1, true); e.preventDefault(); }
  });
  $("nudgeMinus").addEventListener("click", function () { setHeading(state.heading - 5, true); });
  $("nudgePlus").addEventListener("click", function () { setHeading(state.heading + 5, true); });

  knotsEl.addEventListener("input", function () { state.knots = parseFloat(knotsEl.value); refresh(); save(); });
  currentEl.addEventListener("input", function () { state.current = parseFloat(currentEl.value); refresh(); save(); });
  hoursEl.addEventListener("input", function () { state.hours = parseInt(hoursEl.value, 10); refresh(); save(); });

  // ── sound (tiny brass click) ───────────────────────────
  function click() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = 1900 + Math.random() * 500;
      g.gain.setValueAtTime(0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.06);
    } catch (e) {}
  }
  $("btnSound").addEventListener("click", function () {
    soundOn = !soundOn;
    this.textContent = soundOn ? "🔔 Sound on" : "🔔 Sound off";
    this.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) click();
    toast(soundOn ? "Dial clicks engaged." : "Dial clicks silenced.");
  });

  // ── route math ─────────────────────────────────────────
  function routePoints() {
    var rad = state.heading * Math.PI / 180;
    var vx = Math.sin(rad) * state.knots * PX_PER_KNH + state.current * PX_PER_KNH; // easterly set
    var vy = -Math.cos(rad) * state.knots * PX_PER_KNH;
    var pts = [{ x: PORT.x, y: PORT.y }], aground = null;
    var dt = 0.25, steps = Math.round(state.hours / dt);
    var x = PORT.x, y = PORT.y;
    for (var i = 0; i < steps; i++) {
      x = pts[pts.length - 1].x + (vx * dt);
      y = pts[pts.length - 1].y + (vy * dt);
      if (x < 8 || x > CW - 8 || y < 8 || y > CH - 8) {
        pts.push({ x: clamp(x, 8, CW - 8), y: clamp(y, 8, CH - 8), edge: true });
        break;
      }
      var hit = null;
      for (var j = 0; j < islands.length; j++) {
        var isl = islands[j];
        if (Math.hypot(x - isl.x, y - isl.y) < isl.r * 0.92) { hit = isl; break; }
      }
      pts.push({ x: x, y: y });
      if (hit) { aground = hit; pts[pts.length - 1].aground = true; break; }
    }
    return { pts: pts, aground: aground, vx: vx, vy: vy };
  }
  var route = null;

  // ── chart rendering (canvas, no images) ────────────────
  function islandPath(c, isl) {
    var rnd = mulberry32(isl.seed), n = 14;
    c.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = isl.r * (1 + isl.wob * 0.4 * Math.sin(3 * a + isl.seed % 7) + (rnd() - 0.5) * 0.22);
      var x = isl.x + Math.cos(a) * rr, y = isl.y + Math.sin(a) * rr * 0.82;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }

  function drawCompass(c, x, y, r, t) {
    c.save(); c.translate(x, y);
    c.strokeStyle = "rgba(43,29,14,.65)"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.stroke();
    for (var i = 0; i < 16; i++) {
      var a = i * Math.PI / 8, long = i % 4 === 0;
      c.save(); c.rotate(a);
      c.fillStyle = i === 0 ? "#b3402a" : "rgba(43,29,14,.8)";
      c.beginPath();
      c.moveTo(0, -r * (long ? 0.98 : 0.8)); c.lineTo(3.5, 0); c.lineTo(-3.5, 0);
      c.closePath(); c.fill(); c.restore();
    }
    c.fillStyle = "#2b1d0e"; c.font = "bold 13px Georgia,serif"; c.textAlign = "center";
    c.fillText("N", 0, -r - 6);
    c.restore();
  }

  function drawChart(t) {
    var i, j;
    // parchment
    var g = ctx.createRadialGradient(CW / 2, CH / 2, 80, CW / 2, CH / 2, 620);
    g.addColorStop(0, "#efdfae"); g.addColorStop(0.7, "#dec78e"); g.addColorStop(1, "#b99c62");
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    // aged blotches (seeded, stable)
    var brnd = mulberry32(99);
    ctx.fillStyle = "rgba(120,85,30,.07)";
    for (i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(brnd() * CW, brnd() * CH, 20 + brnd() * 60, 0, Math.PI * 2);
      ctx.fill();
    }
    // lat/long grid
    ctx.strokeStyle = "rgba(90,60,20,.28)"; ctx.lineWidth = 1;
    ctx.setLineDash([7, 6]);
    for (i = 1; i < 9; i++) {
      ctx.beginPath(); ctx.moveTo(i * CW / 9, 0); ctx.lineTo(i * CW / 9, CH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CH / 9); ctx.lineTo(CW, i * CH / 9); ctx.stroke();
    }
    ctx.setLineDash([]);
    // rhumb lines from two roses
    ctx.strokeStyle = "rgba(120,70,30,.30)"; ctx.lineWidth = 1;
    [[200, 170], [690, 500]].forEach(function (p) {
      for (j = 0; j < 12; j++) {
        var a = j * Math.PI / 6;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + Math.cos(a) * 700, p[1] + Math.sin(a) * 700); ctx.stroke();
      }
    });
    // current arrows (animated drift eastward)
    ctx.strokeStyle = "rgba(60,110,160,.55)"; ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(60,110,160,.6)";
    for (i = 0; i < 5; i++) {
      for (j = 0; j < 4; j++) {
        var yy = 100 + i * 120, off = ((t / 40 + j * 0.25 + i * 0.13) % 1) * 200;
        var xx = 60 + j * 200 + off * 0.4;
        if (xx > CW - 40) continue;
        var len = 20 + state.current * 7;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xx + len, yy); ctx.lineTo(xx + len - 7, yy - 4); ctx.lineTo(xx + len - 7, yy + 4);
        ctx.closePath(); ctx.fill();
      }
    }
    // islands
    islands.forEach(function (isl) {
      if (isl.reef) { // reef dashed ring = hazard
        ctx.save();
        ctx.strokeStyle = "#8a2f1d"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(isl.x, isl.y, isl.r * 1.25, isl.r * 1.05, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); ctx.setLineDash([]);
      }
      islandPath(ctx, isl);
      ctx.fillStyle = "#7fae6a"; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#8a6b32"; ctx.stroke();
      islandPath(ctx, isl);
      ctx.save(); ctx.clip();
      ctx.fillStyle = "rgba(60,90,40,.35)";
      ctx.fillRect(isl.x - isl.r, isl.y - isl.r * 0.4, isl.r * 2, isl.r * 1.4);
      ctx.restore();
      // peak mark
      ctx.fillStyle = "#3c5a2e";
      ctx.beginPath(); ctx.arc(isl.x, isl.y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      // label
      ctx.fillStyle = "#3a2410"; ctx.font = "italic 13px Georgia,serif"; ctx.textAlign = "center";
      ctx.fillText(isl.name, isl.x, isl.y + isl.r * 0.82 + 16);
    });
    // start port
    ctx.fillStyle = "#2b1d0e"; ctx.textAlign = "center";
    ctx.font = "bold 15px Georgia,serif";
    ctx.fillText("⚓", PORT.x, PORT.y - 12);
    ctx.font = "italic 13px Georgia,serif";
    ctx.fillText("Cinder Quay", PORT.x, PORT.y + 24);
    ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(PORT.x, PORT.y, 9, 0, Math.PI * 2); ctx.stroke();

    // route
    var pts = route.pts;
    if (pts.length > 1) {
      // projected (dashed rust)
      ctx.save();
      ctx.strokeStyle = "#b3402a"; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); ctx.restore();
      // sailed portion (verdigris, scroll-driven)
      var cut = Math.floor(ghostProgress * (pts.length - 1));
      if (cut >= 1) {
        ctx.save();
        ctx.strokeStyle = "#1f7a5f"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.shadowColor = "rgba(31,122,95,.6)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (i = 1; i <= cut; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke(); ctx.restore();
      }
      // waypoint flags
      state.waypoints.forEach(function (wp, k) {
        var f = clamp((k + 1) / (state.waypoints.length + 1), 0, 1);
        var idx = Math.floor(f * (pts.length - 1));
        var p = pts[idx];
        ctx.fillStyle = "#c9a227"; ctx.strokeStyle = "#5e460f"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#2b1d0e"; ctx.font = "bold 11px Georgia,serif"; ctx.textAlign = "center";
        ctx.fillText(String(k + 1), p.x, p.y + 4);
      });
      // ghost ship at sailed head
      var hp = pts[clamp(cut, 0, pts.length - 1)];
      var bob = Math.sin(t / 450) * 3;
      ctx.save(); ctx.translate(hp.x, hp.y + bob);
      ctx.rotate(Math.atan2(route.vy, route.vx) + Math.PI / 2);
      ctx.fillStyle = "#2b1d0e";
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(8, 9); ctx.lineTo(4, 12); ctx.lineTo(-4, 12); ctx.lineTo(-8, 9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#2b1d0e"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, -22); ctx.stroke();
      ctx.fillStyle = "#e9d8a6";
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(11, -14); ctx.lineTo(0, -14); ctx.closePath(); ctx.fill();
      ctx.restore();
      // X marks aground / edge flag
      var last = pts[pts.length - 1];
      if (last.aground || last.edge) {
        ctx.save();
        ctx.strokeStyle = last.aground ? "#8a1010" : "#1f5a7a"; ctx.lineWidth = 4; ctx.lineCap = "round";
        var s = 10;
        ctx.beginPath();
        ctx.moveTo(last.x - s, last.y - s); ctx.lineTo(last.x + s, last.y + s);
        ctx.moveTo(last.x + s, last.y - s); ctx.lineTo(last.x - s, last.y + s);
        ctx.stroke(); ctx.restore();
      }
    }
    drawCompass(ctx, 790, 120, 52, t);
    drawCompass(ctx, 120, 160, 34, t);
    // cartouche
    ctx.save();
    ctx.fillStyle = "rgba(233,216,166,.9)";
    ctx.strokeStyle = "#5e460f"; ctx.lineWidth = 2;
    roundRect(ctx, CW - 268, CH - 52, 252, 38, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#2b1d0e"; ctx.font = "italic 14px Georgia,serif"; ctx.textAlign = "center";
    ctx.fillText("❧ The Verdigris Reach ❧", CW - 142, CH - 27);
    ctx.restore();
    // vignette
    var v = ctx.createRadialGradient(CW / 2, CH / 2, 260, CW / 2, CH / 2, 640);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(30,15,0,.42)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, CW, CH);
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ── refresh readouts + route ───────────────────────────
  function landfallText() {
    var last = route.pts[route.pts.length - 1];
    if (route.aground) return "Ran aground on " + route.aground.name + "!";
    if (last.edge) {
      var edge = last.x <= 9 ? "west" : last.x >= CW - 9 ? "east" : last.y <= 9 ? "north" : "south";
      return "Sailed off the " + edge + " edge of the chart.";
    }
    var best = null, bd = 1e9, i;
    for (i = 0; i < islands.length; i++) {
      var d = Math.hypot(last.x - islands[i].x, last.y - islands[i].y);
      if (d < bd) { bd = d; best = islands[i]; }
    }
    var nm = (bd / PX_PER_KNH).toFixed(0);
    return "Holding " + nm + " nm " + bearingWord(last, best) + " of " + best.name + ".";
  }
  function bearingWord(from, isl) {
    var dx = from.x - isl.x, dy = from.y - isl.y;
    var vert = dy < -20 ? "north" : dy > 20 ? "south" : "";
    var horiz = dx < -20 ? "west" : dx > 20 ? "east" : "";
    return (vert + (vert && horiz ? "-" : "") + horiz) || "abeam";
  }
  function refresh() {
    knotsVal.textContent = state.knots.toFixed(1) + " kn";
    currentVal.textContent = state.current.toFixed(1) + " kn E";
    hoursVal.textContent = state.hours + " h";
    gSpeed.style.transform = "rotate(" + (-120 + (state.knots / 14) * 240) + "deg)";
    gDrift.style.transform = "rotate(" + (-120 + (state.current / 6) * 240) + "deg)";
    route = routePoints();
    plaqueRoute.textContent = "H " + String(Math.round(state.heading)).padStart(3, "0") +
      "° · " + state.knots.toFixed(1) + " kn · " + state.hours + " h";
    plaqueLandfall.textContent = "Landfall: " + landfallText();
    renderWaypoints();
  }

  // ── waypoints ──────────────────────────────────────────
  function renderWaypoints() {
    wpList.innerHTML = "";
    if (!state.waypoints.length) {
      var li = document.createElement("li");
      li.className = "wp-empty";
      li.textContent = "No fixes yet — set the dial & press “Fix from dial”.";
      wpList.appendChild(li);
      return;
    }
    state.waypoints.forEach(function (wp, k) {
      var li = document.createElement("li");
      var s = document.createElement("span");
      s.textContent = (k + 1) + ". H " + String(Math.round(wp.h)).padStart(3, "0") +
        "° · " + wp.k.toFixed(1) + " kn";
      var b = document.createElement("button");
      b.textContent = "✕"; b.title = "Remove fix " + (k + 1);
      b.setAttribute("aria-label", "Remove fix " + (k + 1));
      b.addEventListener("click", function () {
        state.waypoints.splice(k, 1); refresh(); save();
      });
      li.appendChild(s); li.appendChild(b);
      li.title = "Click to apply this fix to the dial";
      li.style.cursor = "pointer";
      li.addEventListener("click", function (e) {
        if (e.target === b) return;
        easeHeadingTo(wp.h, wp.k);
        toast("Fix " + (k + 1) + " laid to the dial.");
      });
      wpList.appendChild(li);
    });
  }
  $("btnAddWp").addEventListener("click", function () {
    state.waypoints.push({ h: Math.round(state.heading), k: state.knots });
    if (state.waypoints.length > 8) state.waypoints.shift();
    refresh(); save(); click();
    toast("Fix " + state.waypoints.length + " pricked onto the chart.");
  });
  $("btnClearWp").addEventListener("click", function () {
    state.waypoints = []; refresh(); save();
    toast("Voyage plan wiped clean.");
  });

  // ── share / export ─────────────────────────────────────
  function shareParams() {
    var p = new URLSearchParams();
    p.set("h", Math.round(state.heading));
    p.set("k", state.knots); p.set("c", state.current);
    p.set("t", state.hours); p.set("seed", state.seed);
    if (state.waypoints.length) p.set("wp", encodeURIComponent(JSON.stringify(state.waypoints)));
    return p.toString();
  }
  function shareLink() {
    return location.href.split("#")[0] + "#" + shareParams();
  }
  function renderShareUrl() { shareUrlEl.textContent = shareLink(); }
  function copyText(txt, msg) {
    function done() { toast(msg); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("Copy failed — long-press the link instead."); }
      document.body.removeChild(ta);
    }
  }
  $("btnCopyLink").addEventListener("click", function () { copyText(shareLink(), "Share link copied — settings ride in the URL."); });
  $("btnCopyLink2").addEventListener("click", function () { copyText(shareLink(), "Share link copied — settings ride in the URL."); });
  function settingsJson() {
    return JSON.stringify({ app: "driftwood-dial", heading: Math.round(state.heading),
      knots: state.knots, current_kn_east: state.current, horizon_h: state.hours,
      seed: state.seed, waypoints: state.waypoints, landfall: landfallText() }, null, 2);
  }
  $("btnCopyJson").addEventListener("click", function () { copyText(settingsJson(), "Settings JSON copied."); });
  $("btnCopyJson2").addEventListener("click", function () { copyText(settingsJson(), "Settings JSON copied."); });
  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(name + " dispatched to your downloads.");
  }
  function doPng() {
    canvas.toBlob(function (b) { if (b) download("driftwood-dial-chart.png", b); });
  }
  $("btnPng").addEventListener("click", doPng);
  $("btnPng2").addEventListener("click", doPng);
  function logText() {
    var L = [];
    L.push("DRIFTWOOD DIAL — CAPTAIN'S LOG");
    L.push("Patent Drift Computer No. 1887 · Cinder Quay Works");
    L.push("Date: " + new Date().toUTCString());
    L.push("");
    L.push("SETTINGS  heading " + String(Math.round(state.heading)).padStart(3, "0") + "° (" +
      pointName(state.heading) + ") · throttle " + state.knots.toFixed(1) + " kn · current " +
      state.current.toFixed(1) + " kn E · horizon " + state.hours + " h · waters seed " + state.seed);
    L.push("LANDFALL  " + landfallText());
    L.push("");
    L.push("VOYAGE PLAN (" + state.waypoints.length + " fixes)");
    state.waypoints.forEach(function (wp, k) {
      L.push("  " + (k + 1) + ". H " + String(Math.round(wp.h)).padStart(3, "0") + "° · " + wp.k.toFixed(1) + " kn");
    });
    L.push("");
    L.push("SHARE  " + shareLink());
    return L.join("\n");
  }
  $("btnLog").addEventListener("click", function () { download("captains-log.txt", logText()); });
  $("btnLog2").addEventListener("click", function () { download("captains-log.txt", logText()); });
  $("btnNewChart").addEventListener("click", function () {
    state.seed = Math.floor(Math.random() * 90000) + 1000;
    islands = genIslands(state.seed);
    refresh(); save();
    toast("New waters surveyed — seed " + state.seed + ".");
  });
  $("btnReset").addEventListener("click", function () {
    state = Object.assign({}, DEFAULTS, { waypoints: [] });
    islands = genIslands(state.seed);
    knotsEl.value = state.knots; currentEl.value = state.current; hoursEl.value = state.hours;
    setHeading(state.heading, false); refresh(); save();
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    location.hash = "";
    toast("Instrument reset to factory trim.");
  });

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = "✦ " + msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.textContent = ""; }, 3200);
  }

  // ── scroll reactions (constraint: must react to scroll) ─
  var chapters = Array.prototype.slice.call(document.querySelectorAll(".chapter"));
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      boiler = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      var pct = Math.round(boiler * 100);
      boilerFill.style.width = pct + "%";
      boilerPct.textContent = pct + "%";
      gBoiler.style.transform = "rotate(" + (-120 + boiler * 240) + "deg)";
      document.documentElement.style.setProperty("--gear-rotation", (boiler * 360) + "deg");
      // ghost ship sails the logbook: progress through logbook section
      var log = $("logbook");
      var r = log.getBoundingClientRect();
      var total = r.height + window.innerHeight;
      var passed = window.innerHeight - r.top;
      ghostProgress = clamp(passed / total, 0, 1);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // chapters take the helm as they scroll into view
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        chapters.forEach(function (c) { c.classList.remove("active"); });
        en.target.classList.add("active");
        var h = parseFloat(en.target.getAttribute("data-heading"));
        var k = parseFloat(en.target.getAttribute("data-knots"));
        easeHeadingTo(h, isNaN(k) ? undefined : k);
        var title = en.target.querySelector("h3").textContent;
        toast("Logbook: “" + title + "” — helm answers " + h + "°.");
      });
    }, { threshold: 0.55 });
    chapters.forEach(function (c) { obs.observe(c); });
  }

  // ── main loop ──────────────────────────────────────────
  function frame(t) {
    drawChart(t || 0);
    requestAnimationFrame(frame);
  }

  // ── init ───────────────────────────────────────────────
  islands = genIslands(state.seed);
  knotsEl.value = state.knots; currentEl.value = state.current; hoursEl.value = state.hours;
  setHeading(state.heading, false);
  onScroll();
  renderShareUrl();
  requestAnimationFrame(frame);
})();
