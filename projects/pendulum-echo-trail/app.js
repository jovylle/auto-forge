/* Pendulum Echo Trail — a pendulum whose fading echoes paint time's passage. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var canvas = $("c");
  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;

  var timeReadout = $("timeReadout");
  var hourReadout = $("hourReadout");
  var statusEl = $("status");
  var btnPlay = $("btnPlay");
  var btnRewind = $("btnRewind");
  var btnExport = $("btnExport");
  var speedSel = $("speed");
  var scrub = $("scrub");
  var egg = $("egg");
  var eggClose = $("eggClose");

  var state = {
    time: 0,           // simulated seconds
    playing: true,
    speed: 1,
    points: [],        // {x,y,t}
    eggFound: false
  };

  var W = 0, H = 0;
  var pivot = { x: 0, y: 0 };
  var L = 0;
  var OMEGA = 1.35;
  var AMP = Math.PI / 3.2;
  var TRAIL_SEC = 30;

  function baseHue() {
    return (new Date().getHours() / 24) * 360;
  }

  function pendulumPos(t) {
    var theta = AMP * Math.cos(OMEGA * t);
    return {
      x: pivot.x + L * Math.sin(theta),
      y: pivot.y + L * Math.cos(theta),
      theta: theta
    };
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pivot.x = W / 2;
    pivot.y = H * 0.16;
    L = Math.min(W, H) * 0.34;
    // reset trail on resize (positions no longer valid)
    state.points = [];
  }

  function fmtTime(t) {
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    return String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0");
  }

  function render() {
    // background
    ctx.fillStyle = "#06060c";
    ctx.fillRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = "rgba(0,240,255,0.05)";
    ctx.lineWidth = 1;
    var step = 40;
    for (var x = 0; x <= W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y <= H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    var bh = baseHue();
    var pts = state.points;
    // trail
    if (pts.length > 1) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1];
        var b = pts[i];
        var age = state.time - b.t;
        if (age < 0) continue;
        var alpha = Math.max(0, 1 - age / TRAIL_SEC);
        if (alpha <= 0.01) continue;
        var hue = (bh + b.t * 14) % 360;
        ctx.strokeStyle = "hsla(" + hue + ",92%,62%," + (alpha * 0.85) + ")";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // rod
    var p = pendulumPos(state.time);
    ctx.strokeStyle = "rgba(200,210,240,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // pivot
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // bob
    var hue = (bh + state.time * 14) % 360;
    ctx.fillStyle = "hsl(" + hue + ",92%,62%)";
    ctx.shadowColor = "hsl(" + hue + ",92%,62%)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // readout
    timeReadout.textContent = fmtTime(state.time);
    hourReadout.textContent = "HUE " + Math.round(bh) + "° · " + new Date().getHours() + ":00";
    statusEl.textContent = state.playing ? "PLAYING" : "PAUSED";
    btnPlay.textContent = state.playing ? "PAUSE" : "PLAY";
    btnPlay.setAttribute("aria-pressed", state.playing ? "true" : "false");

    // keep scrubber roughly in sync when playing? only update value display; avoid fighting user
  }

  var lastTs = null;
  function loop(ts) {
    if (lastTs === null) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (state.playing) {
      state.time += dt * state.speed;
      var p = pendulumPos(state.time);
      var pts = state.points;
      if (pts.length === 0 || Math.hypot(pts[pts.length - 1].x - p.x, pts[pts.length - 1].y - p.y) > 0.4) {
        pts.push({ x: p.x, y: p.y, t: state.time });
      }
      var cutoff = state.time - TRAIL_SEC;
      while (pts.length && pts[0].t < cutoff) pts.shift();
      // scrubber follow
      if (document.activeElement !== scrub) {
        scrub.value = String(Math.min(600, state.time));
      }
    } else {
      // keep lastTs fresh
    }
    render();
    requestAnimationFrame(loop);
  }

  // controls
  btnPlay.addEventListener("click", function () {
    state.playing = !state.playing;
    lastTs = null;
  });
  btnRewind.addEventListener("click", function () {
    state.time = 0;
    state.points = [];
    scrub.value = "0";
  });
  btnExport.addEventListener("click", function () {
    // render once more to be safe
    render();
    var url = canvas.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = url;
    a.download = "pendulum-echo-trail.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  speedSel.addEventListener("change", function () {
    state.speed = parseFloat(speedSel.value) || 1;
  });
  scrub.addEventListener("input", function () {
    state.playing = false;
    state.time = parseFloat(scrub.value) || 0;
    // trim future points
    var pts = state.points;
    while (pts.length && pts[pts.length - 1].t > state.time) pts.pop();
  });

  // keyboard
  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    if (e.code === "Space") { e.preventDefault(); btnPlay.click(); }
    else if (e.key === "r" || e.key === "R") btnRewind.click();
    else if (e.key === "e" || e.key === "E") btnExport.click();
  });

  // easter egg: konami code
  var konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  var buf = [];
  document.addEventListener("keydown", function (e) {
    buf.push(e.key);
    if (buf.length > konami.length) buf.shift();
    if (buf.join("|") === konami.join("|")) {
      egg.hidden = false;
      state.eggFound = true;
      try { localStorage.setItem("pet-egg", "1"); } catch (er) {}
    }
  });
  eggClose.addEventListener("click", function () { egg.hidden = true; });

  // load egg state
  try { if (localStorage.getItem("pet-egg") === "1") state.eggFound = true; } catch (er) {}

  // resize handling
  var ro = new ResizeObserver(function () { resize(); });
  ro.observe(canvas.parentElement);
  resize();

  requestAnimationFrame(loop);
})();
