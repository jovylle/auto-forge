/* Cinder Atlas Arcade — claim tiles, dodge fog, race 3 rival AI in 60s.
   Plain script (file:// safe). No deps. */
(function () {
  "use strict";

  var N = 13;
  var TOTAL = N * N;
  var RUN_SECS = 60;
  var FOG_BLOCK = 0.68; // above this: scorched, cannot claim
  var BEST_KEY = "cinder-atlas-best";

  var board = document.getElementById("board");
  var clockEl = document.getElementById("clock");
  var ringFg = document.getElementById("ringFg");
  var standingsEl = document.getElementById("standings");
  var startBtn = document.getElementById("startBtn");
  var againBtn = document.getElementById("againBtn");
  var muteBtn = document.getElementById("muteBtn");
  var overlay = document.getElementById("overlay");
  var ovKicker = document.getElementById("ovKicker");
  var ovTitle = document.getElementById("ovTitle");
  var ovBody = document.getElementById("ovBody");
  var ovBtn = document.getElementById("ovBtn");
  var toast = document.getElementById("toast");
  var bestEl = document.getElementById("best");
  var runStateEl = document.getElementById("runState");
  var fogFill = document.getElementById("fogFill");
  var surgeLabel = document.getElementById("surgeLabel");

  var BOTS = [
    { id: 2, name: "Bramble", mark: "▲", fogTol: 0.80, every: 750, greedy: 0.4, look: 1 },
    { id: 3, name: "Rust", mark: "◆", fogTol: 0.60, every: 950, greedy: 1.0, look: 2 },
    { id: 4, name: "Wisp", mark: "●", fogTol: 0.95, every: 620, greedy: 0.1, look: 1 }
  ];

  var owner = new Uint8Array(TOTAL); // 0 none, 1 you, 2..4 bots
  var ember = new Uint8Array(TOTAL); // 1..3
  var fog = new Float32Array(TOTAL); // 0..1
  var tiles = [];
  var running = false;
  var timeLeft = RUN_SECS;
  var streak = 0;
  var best = 0;
  var muted = false;
  var timers = [];
  var toastT = null;
  var dragOn = false;

  // deterministic-ish rng so each run differs but stays fair
  var seed = (Date.now() % 100000) + 7;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function idx(x, y) { return y * N + x; }
  function xy(i) { return [i % N, (i / N) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = String(best);

  /* ---------- audio (tiny WebAudio blips, no assets) ---------- */
  var actx = null;
  function tone(freq, dur, type, vol) {
    if (muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "triangle"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.09));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.09));
    } catch (e) { /* silent */ }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("show"); }, 1600);
  }

  /* ---------- board build ---------- */
  function buildBoard() {
    board.innerHTML = "";
    board.style.setProperty("--n", String(N));
    tiles = [];
    for (var i = 0; i < TOTAL; i++) {
      (function (i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tile";
        b.setAttribute("role", "gridcell");
        b.dataset.i = String(i);
        b.innerHTML = '<span class="core"><span class="pips"></span></span><span class="fogveil"></span>';
        b.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          dragOn = true;
          try { b.setPointerCapture(e.pointerId); } catch (err) {}
          playerClaim(i, b);
        });
        b.addEventListener("pointerenter", function () {
          if (dragOn) playerClaim(i, b);
        });
        b.addEventListener("focus", function () { /* keyboard: Enter claims */ });
        b.addEventListener("click", function () { playerClaim(i, b); });
        board.appendChild(b);
        tiles.push(b);
      })(i);
    }
    window.addEventListener("pointerup", function () { dragOn = false; }, { passive: true });
    board.addEventListener("pointerleave", function () { /* keep dragOn until pointerup for touch */ });
    board.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  function fogClass(f) {
    if (f >= FOG_BLOCK) return "fog-choke";
    if (f >= 0.5) return "fog-thick";
    if (f >= 0.3) return "fog-thin";
    return "";
  }

  function renderTile(i) {
    var t = tiles[i];
    var o = owner[i], f = fog[i], v = ember[i];
    var cls = "tile o" + (o === 0 ? "0" : o) + " " + fogClass(f);
    if (o > 0) cls += " owned";
    t.className = cls;
    var pips = t.querySelector(".pips");
    var html = "";
    var dim = fogClass(f) === "fog-choke" ? " dim" : "";
    for (var k = 0; k < v; k++) html += '<span class="pip"></span>';
    pips.className = "pips" + dim;
    pips.innerHTML = html;
    var label = "tile " + (i % N + 1) + "," + (((i / N) | 0) + 1);
    if (o === 1) label += " yours";
    else if (o > 1) label += " " + BOTS[o - 2].name;
    if (f >= FOG_BLOCK) label += ", thick fog";
    t.setAttribute("aria-label", label);
  }

  function renderAll() {
    for (var i = 0; i < TOTAL; i++) renderTile(i);
  }

  function scores() {
    var s = { you: 0, b: [0, 0, 0], tiles: [0, 0, 0, 0] };
    for (var i = 0; i < TOTAL; i++) {
      var o = owner[i];
      if (o === 0) continue;
      s.tiles[o - 1]++;
      var v = ember[i];
      if (o === 1) s.you += v;
      else s.b[o - 2] += v;
    }
    return s;
  }

  function renderStandings() {
    var s = scores();
    var rows = [
      { name: "You", sig: "s1", pts: s.you, id: 1 },
      { name: "▲ Bramble", sig: "s2", pts: s.b[0], id: 2 },
      { name: "◆ Rust", sig: "s3", pts: s.b[1], id: 3 },
      { name: "● Wisp", sig: "s4", pts: s.b[2], id: 4 }
    ].sort(function (a, b) { return b.pts - a.pts; });
    standingsEl.innerHTML = rows.map(function (r, k) {
      return '<li class="' + (k === 0 ? "lead" : "") + '"><span class="sigil ' + r.sig + '"></span>' +
        r.name + '<span class="n">' + r.pts + " ◆</span></li>";
    }).join("");
  }

  /* ---------- procedural fog ---------- */
  var blobs = [];
  function seedFog() {
    blobs = [];
    for (var k = 0; k < 5; k++) {
      blobs.push({ x: rnd() * N, y: rnd() * N, r: 2.2 + rnd() * 2.6, dx: (rnd() - 0.5) * 0.9, dy: (rnd() - 0.5) * 0.9 });
    }
    for (var i = 0; i < TOTAL; i++) {
      var p = xy(i);
      fog[i] = clamp(0.22 + 0.3 * rnd() + 0.18 * Math.sin(p[0] * 0.9 + seed) * Math.cos(p[1] * 0.8), 0, 1);
    }
  }

  function driftFog(surge) {
    for (var b = 0; b < blobs.length; b++) {
      var bl = blobs[b];
      bl.x += bl.dx * (surge ? 2.2 : 1);
      bl.y += bl.dy * (surge ? 2.2 : 1);
      if (bl.x < -1 || bl.x > N) bl.dx *= -1;
      if (bl.y < -1 || bl.y > N) bl.dy *= -1;
      bl.x = clamp(bl.x, -1, N); bl.y = clamp(bl.y, -1, N);
    }
    var sum = 0;
    for (var i = 0; i < TOTAL; i++) {
      var p = xy(i);
      var d = 0;
      for (var k = 0; k < blobs.length; k++) {
        var bl2 = blobs[k];
        var dist = Math.hypot(p[0] - bl2.x, p[1] - bl2.y);
        d += Math.max(0, 1 - dist / bl2.r);
      }
      var target = clamp(0.12 + d * 0.55 + 0.1 * Math.sin(Date.now() / 4000 + p[0] + p[1]), 0, 1);
      fog[i] = clamp(fog[i] + (target - fog[i]) * (surge ? 0.65 : 0.3) + (rnd() - 0.5) * 0.06, 0, 1);
      sum += fog[i];
      renderTile(i);
    }
    var avg = sum / TOTAL;
    fogFill.style.width = Math.round(avg * 100) + "%";
    surgeLabel.textContent = avg > 0.55 ? "surging!" : avg > 0.42 ? "rising" : "calm";
  }

  /* ---------- claiming ---------- */
  function neighbors(i) {
    var p = xy(i), out = [];
    if (p[0] > 0) out.push(i - 1);
    if (p[0] < N - 1) out.push(i + 1);
    if (p[1] > 0) out.push(i - N);
    if (p[1] < N - 1) out.push(i + N);
    return out;
  }

  function playerClaim(i, el) {
    if (!running) return;
    if (owner[i] === 1) return;
    if (fog[i] >= FOG_BLOCK) {
      streak = 0;
      if (el) {
        el.classList.remove("blocked"); void el.offsetWidth; el.classList.add("blocked");
      }
      board.classList.remove("scorching"); void board.offsetWidth; board.classList.add("scorching");
      tone(110, 0.15, "sawtooth", 0.05);
      showToast("Scorched! Too much ash — wait for it to drift.");
      return;
    }
    var wasSteal = owner[i] > 1;
    owner[i] = 1;
    streak++;
    renderTile(i);
    if (el) { el.classList.remove("claimed"); void el.offsetWidth; el.classList.add("claimed"); }
    tone(wasSteal ? 660 : 440 + Math.min(streak, 12) * 24, 0.08, "triangle", 0.06);
    if (wasSteal) showToast("Stole a rival tile! +" + ember[i] + " embers");
    renderStandings();
  }

  function botMove(bot) {
    if (!running) return;
    // frontier: tiles adjacent to bot territory (or anywhere if none yet)
    var mine = [];
    for (var i = 0; i < TOTAL; i++) if (owner[i] === bot.id) mine.push(i);
    var cand = {};
    if (mine.length === 0) {
      for (var r = 0; r < 6; r++) cand[(rnd() * TOTAL) | 0] = true;
    } else {
      for (var m = 0; m < mine.length; m++) {
        var ns = neighbors(mine[m]);
        for (var q = 0; q < ns.length; q++) {
          var t = ns[q];
          if (owner[t] !== bot.id) cand[t] = true;
        }
      }
    }
    var keys = Object.keys(cand);
    if (!keys.length) return;
    var scored = keys.map(function (k) {
      var i = +k;
      var score = ember[i] * (0.6 + bot.greedy) + rnd() * 1.6;
      if (owner[i] === 1) score += 1.4; // raiders love your tiles
      if (owner[i] > 1 && owner[i] !== bot.id) score += 0.7;
      score -= fog[i] * (1.6 - bot.fogTol);
      var p = xy(i);
      if (bot.look === 2) { // Rust snipes far high-ember tiles
        score += (Math.abs(p[0] - N / 2) + Math.abs(p[1] - N / 2)) * 0.02;
      }
      return { i: i, s: score };
    }).filter(function (c) { return fog[c.i] <= bot.fogTol; });
    if (!scored.length) return; // fog too thick — this bot waits (dodge!)
    scored.sort(function (a, b) { return b.s - a.s; });
    var take = bot.id === 4 ? 2 : 1; // Wisp is fast, takes 2
    for (var t2 = 0; t2 < Math.min(take, scored.length); t2++) {
      var ci = scored[t2].i;
      if (fog[ci] <= bot.fogTol) {
        owner[ci] = bot.id;
        renderTile(ci);
      }
    }
    renderStandings();
  }

  /* ---------- run lifecycle ---------- */
  function clearTimers() {
    timers.forEach(clearInterval);
    timers = [];
  }

  function seedRun() {
    seed = (Date.now() % 100000) + 7;
    owner = new Uint8Array(TOTAL);
    ember = new Uint8Array(TOTAL);
    fog = new Float32Array(TOTAL);
    for (var i = 0; i < TOTAL; i++) {
      var r = rnd();
      ember[i] = r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
    }
    seedFog();
    // home seeds: you near center, bots in corners
    var homes = [idx(6, 6), idx(1, 1), idx(N - 2, 1), idx(1, N - 2)];
    for (var h = 0; h < 4; h++) {
      owner[homes[h]] = h + 1;
      var ns = neighbors(homes[h]);
      for (var k = 0; k < Math.min(2, ns.length); k++) owner[ns[k]] = h + 1;
    }
    streak = 0; timeLeft = RUN_SECS;
    clockEl.textContent = String(RUN_SECS);
    renderAll(); renderStandings();
    driftFog(false);
  }

  function tickClock() {
    timeLeft -= 1;
    if (timeLeft <= 0) { timeLeft = 0; endRun(); return; }
    clockEl.textContent = String(timeLeft);
    var frac = timeLeft / RUN_SECS;
    ringFg.style.strokeDashoffset = String(113 * (1 - frac));
    ringFg.style.stroke = timeLeft <= 10 ? "#c73305" : "#ff5a1f";
    if (timeLeft === 30) showToast("Halfway — ash surge incoming!");
    if (timeLeft <= 5) tone(520 - timeLeft * 30, 0.1, "square", 0.05);
  }

  function startRun() {
    clearTimers();
    seedRun();
    running = true;
    overlay.hidden = true;
    startBtn.textContent = "Restart run";
    againBtn.hidden = false;
    runStateEl.textContent = "mapping… drag to claim!";
    tone(523, 0.1, "triangle", 0.07);
    setTimeout(function () { tone(784, 0.12, "triangle", 0.07); }, 110);
    timers.push(setInterval(tickClock, 1000));
    timers.push(setInterval(function () { driftFog(false); }, 1100));
    timers.push(setInterval(function () {
      driftFog(true);
      showToast("Ash surge! The fog shifts.");
      tone(180, 0.25, "sawtooth", 0.04);
    }, 9000));
    BOTS.forEach(function (bot) {
      timers.push(setInterval(function () { botMove(bot); }, bot.every));
    });
  }

  function endRun() {
    running = false;
    clearTimers();
    renderStandings();
    var s = scores();
    var rows = [
      { name: "You", pts: s.you },
      { name: "▲ Bramble", pts: s.b[0] },
      { name: "◆ Rust", pts: s.b[1] },
      { name: "● Wisp", pts: s.b[2] }
    ].sort(function (a, b) { return b.pts - a.pts; });
    var rank = rows.findIndex(function (r) { return r.name === "You"; });
    var titles = ["Atlas Sovereign!", "Runner-up Cartographer", "Third-wheel Mapper", "Fogged Out"];
    if (s.you > best) {
      best = s.you;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      bestEl.textContent = String(best);
    }
    tone(rank === 0 ? 880 : 330, 0.3, "triangle", 0.08);
    ovKicker.textContent = "Run complete — " + titles[rank];
    ovTitle.textContent = rank === 0 ? "You mapped the atlas!" : rows[0].name + " takes the atlas";
    ovBody.innerHTML = '<div class="result-grid">' + rows.map(function (r) {
      return "<div><b>" + r.pts + "</b>" + r.name + " ◆</div>";
    }).join("") + "</div>" + (rank === 0
      ? "Clean lines, hot sigil. The fog remembers your name."
      : "Your sigil covered " + s.tiles[0] + " tiles. Remap and take it back.");
    ovBtn.textContent = "Run it back";
    overlay.hidden = false;
    runStateEl.textContent = "finished — " + titles[rank].toLowerCase();
  }

  /* ---------- wire up ---------- */
  startBtn.addEventListener("click", startRun);
  againBtn.addEventListener("click", startRun);
  ovBtn.addEventListener("click", startRun);
  muteBtn.addEventListener("click", function () {
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-pressed", String(muted));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !overlay.hidden) { startRun(); }
  });

  buildBoard();
  seedRun();          // show a living preview grid behind the briefing
  running = false;    // preview only until start
  clearTimers();
  timers.push(setInterval(function () { driftFog(false); }, 1400)); // ambient drift in preview
})();
