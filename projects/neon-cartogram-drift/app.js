/* Neon Cartogram Drift — plain script, no deps, file:// safe.
   drag districts · draw trade routes · fog reveal · daily seed challenge */
(function () {
  "use strict";
  var N = 8, TIDE_MAX = 20, MAX_ROUTES = 6, PULSE_COST = 3;
  var NAMES = ["Moss", "Mycel", "Kelp", "Lichen", "Marrow"];
  var BLOBS = ["#b8ff29", "#2de1a7", "#ff5a1f", "#b8ff29", "#2de1a7"];
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* seeded rng: xmur3 + mulberry32 */
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
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFrom(seed) { return mulberry32(xmur3(seed)()); }
  function ri(rng, n) { return Math.floor(rng() * n); }

  /* dom */
  function $(id) { return document.getElementById(id); }
  var board = $("board"), tilesEl = $("tiles"), piecesEl = $("pieces"), routesEl = $("routes");
  var ui = {
    credits: $("credits"), quota: $("quota"), quotaBar: $("quotaBar"),
    tide: $("tide"), tideMax: $("tideMax"), tideBar: $("tideBar"),
    routeCount: $("routeCount"), fogCount: $("fogCount"), best: $("best"),
    seedChip: $("seedChip"), dailyBadge: $("dailyBadge"), ledger: $("ledger"),
    routeList: $("routeList"), log: $("log"), hint: $("hint"), modeTag: $("modeTag"),
    btnDrift: $("btnDrift"), btnAuto: $("btnAuto"), btnPulse: $("btnPulse"),
    btnDaily: $("btnDaily"), btnNew: $("btnNew"), btnHelp: $("btnHelp"),
    overlay: $("overlay"), ovKicker: $("ovKicker"), ovTitle: $("ovTitle"), ovBody: $("ovBody"),
    streak: $("streak")
  };
  ui.tideMax.textContent = TIDE_MAX;

  /* state */
  var S = null, autoTimer = null, selected = null, won = false, over = false;

  function todaySeed() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function randomSeed() {
    var s = "", c = "abcdefghjkmnpqrstuvwxyz23456789";
    for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  function newGame(seedStr, isDaily) {
    var rng = rngFrom("ncd:" + seedStr);
    var soil = [], revealed = [], i;
    for (i = 0; i < N * N; i++) {
      var r = rng();
      soil.push(r < 0.52 ? 0 : r < 0.82 ? 1 : 2);
      revealed.push(false);
    }
    /* cluster richness: boost neighbours of rich tiles */
    for (i = 0; i < N * N; i++) {
      if (soil[i] === 2) {
        var c = i % N, rr = (i / N) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nc = c + d[0], nr = rr + d[1];
          if (nc >= 0 && nc < N && nr >= 0 && nr < N && rng() < 0.5)
            soil[nr * N + nc] = Math.max(soil[nr * N + nc], 1);
        });
      }
    }
    var taken = {}, districts = [];
    for (i = 0; i < 5; i++) {
      var c0, r0;
      do { c0 = ri(rng, N); r0 = ri(rng, N); } while (taken[r0 * N + c0]);
      taken[r0 * N + c0] = true;
      districts.push({
        id: i, name: NAMES[i], value: 1 + ri(rng, 3),
        c: c0, r: r0, dir: ri(rng, 4), color: BLOBS[i]
      });
    }
    S = {
      seed: seedStr, daily: !!isDaily, rng: rng,
      soil: soil, revealed: revealed, districts: districts,
      routes: [], credits: 0, tide: 0,
      quota: 95 + ri(rng, 41), pulseCd: 0
    };
    selected = null; won = false; over = false;
    districts.forEach(function (d) { revealAround(d.c, d.r); });
    setAuto(false);
    buildTiles(); buildPieces();
    log("map <b>" + esc(seedStr) + "</b> charted — quota " + S.quota + "◦ in " + TIDE_MAX + " tides");
    render();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function idx(c, r) { return r * N + c; }
  function inB(c, r) { return c >= 0 && c < N && r >= 0 && r < N; }
  function occupied(c, r, except) {
    return S.districts.some(function (d) { return d.id !== except && d.c === c && d.r === r; });
  }
  function distAt(c, r) {
    for (var i = 0; i < S.districts.length; i++)
      if (S.districts[i].c === c && S.districts[i].r === r) return S.districts[i];
    return null;
  }
  function revealAround(c, r) {
    for (var dc = -1; dc <= 1; dc++) for (var dr = -1; dr <= 1; dr++) {
      var nc = c + dc, nr = r + dr;
      if (inB(nc, nr)) S.revealed[idx(nc, nr)] = true;
    }
  }
  function revealLine(a, b) {
    var steps = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r), 1);
    for (var i = 0; i <= steps; i++) {
      var c = Math.round(a.c + (b.c - a.c) * i / steps);
      var r = Math.round(a.r + (b.r - a.r) * i / steps);
      revealAround(c, r);
    }
  }
  function distById(id) {
    for (var i = 0; i < S.districts.length; i++)
      if (S.districts[i].id === id) return S.districts[i];
    return null;
  }
  function routeIncome(rt) {
    var a = distById(rt.a), b = distById(rt.b);
    if (!a || !b) return 0;
    var d = Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
    return Math.max(2, a.value + b.value + S.soil[idx(a.c, a.r)] + S.soil[idx(b.c, b.r)] - d);
  }
  function passive() {
    return S.districts.reduce(function (s, d) { return s + S.soil[idx(d.c, d.r)]; }, 0);
  }

  /* ---- tides ---- */
  function driftOnce() {
    if (over) return;
    S.tide++;
    /* districts wander */
    S.districts.forEach(function (d) {
      var rng = S.rng;
      if (rng() < 0.22) d.dir = ri(rng, 4);
      var dd = DIRS[d.dir], nc = d.c + dd[0], nr = d.r + dd[1];
      if (!inB(nc, nr) || occupied(nc, nr, d.id)) {
        var opts = [];
        for (var k = 0; k < 4; k++) {
          var e = DIRS[k], tc = d.c + e[0], tr = d.r + e[1];
          if (inB(tc, tr) && !occupied(tc, tr, d.id)) opts.push(k);
        }
        if (opts.length) { d.dir = opts[ri(rng, opts.length)]; nc = d.c + DIRS[d.dir][0]; nr = d.r + DIRS[d.dir][1]; }
        else { nc = d.c; nr = d.r; }
      }
      d.c = nc; d.r = nr;
      revealAround(nc, nr);
    });
    /* broken routes stay (endpoints moved with blobs); re-light paths */
    S.routes.forEach(function (rt) { revealLine(distById(rt.a), distById(rt.b)); });
    var pay = passive() + S.routes.reduce(function (s, rt) { return s + routeIncome(rt); }, 0);
    S.credits += pay;
    if (S.pulseCd > 0) S.pulseCd--;
    log("tide <b>" + S.tide + "</b> +" + pay + "◦ (" + passive() + "◦ soil, " + (pay - passive()) + "◦ routes)");
    if (S.credits >= S.quota && !won) { won = true; onWin(); }
    else if (S.tide >= TIDE_MAX && S.credits < S.quota) { over = true; onLose(); }
    render();
  }

  function onWin() {
    setAuto(false);
    saveBest();
    showOverlay("quota met ★", "Cartogram complete",
      "Seed " + esc(S.seed) + " cleared with <b>" + S.credits + "◦</b> on tide " + S.tide + "." +
      (S.daily ? " Daily streak: <b>" + streak() + "</b>." : " Best for this map: <b>" + best() + "◦</b>."));
    log("★ quota met with " + S.credits + "◦ on tide " + S.tide);
  }
  function onLose() {
    setAuto(false);
    showOverlay("tide 20 · fog wins", "Adrift",
      "Ended on <b>" + S.credits + "◦</b> of " + S.quota + "◦. Replay the seed or take today's challenge.");
  }

  /* ---- persistence ---- */
  function best() {
    try { return parseInt(localStorage.getItem("ncd-best-" + S.seed) || "0", 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest() {
    try {
      if (S.credits > best()) localStorage.setItem("ncd-best-" + S.seed, String(S.credits));
      if (S.daily) {
        var key = "ncd-streak", st = { last: "", n: 0 };
        try { st = JSON.parse(localStorage.getItem(key) || '{"last":"","n":0}'); } catch (e) {}
        var t = todaySeed(), y = new Date(Date.now() - 864e5);
        function p(n) { return (n < 10 ? "0" : "") + n; }
        var yest = y.getFullYear() + "-" + p(y.getMonth() + 1) + "-" + p(y.getDate());
        st.n = (st.last === yest || st.last === t) ? (st.last === t ? st.n : st.n + 1) : 1;
        st.last = t;
        localStorage.setItem(key, JSON.stringify(st));
      }
    } catch (e) {}
  }
  function streak() {
    try { return (JSON.parse(localStorage.getItem("ncd-streak") || '{"n":0}').n) || 0; }
    catch (e) { return 0; }
  }

  /* ---- rendering ---- */
  var tileDivs = [], pieceEls = {};
  function buildTiles() {
    tilesEl.innerHTML = ""; tileDivs = [];
    for (var i = 0; i < N * N; i++) {
      var t = document.createElement("div");
      t.className = "tile";
      t.innerHTML = '<span class="soil"></span>';
      tilesEl.appendChild(t); tileDivs.push(t);
    }
  }
  function buildPieces() {
    piecesEl.innerHTML = ""; pieceEls = {};
    S.districts.forEach(function (d) {
      var el = document.createElement("div");
      el.className = "district"; el.dataset.id = d.id;
      el.innerHTML = '<div class="blob"><span class="nm"></span><span class="vl"></span></div>';
      el.querySelector(".nm").textContent = d.name;
      el.querySelector(".blob").style.background = d.color;
      el.addEventListener("pointerdown", onPieceDown);
      piecesEl[d.id] = el;
      piecesEl.appendChild(el);
    });
  }
  function render() {
    /* tiles */
    var seen = 0;
    for (var i = 0; i < N * N; i++) {
      var t = tileDivs[i], rev = S.revealed[i];
      if (rev) seen++;
      t.classList.toggle("fog", !rev);
      t.classList.toggle("seen", rev);
      var soil = S.soil[i];
      t.classList.toggle("rich", rev && soil > 0);
      t.classList.toggle("lit", rev && soil === 2);
      t.querySelector(".soil").textContent = soil === 2 ? "◍◍" : soil === 1 ? "◍" : "";
    }
    /* pieces */
    S.districts.forEach(function (d) {
      var el = pieceEls[d.id];
      if (el.classList.contains("dragging")) return;
      el.style.left = (d.c * 12.5) + "%";
      el.style.top = (d.r * 12.5) + "%";
      el.classList.toggle("sel", selected === d.id);
      el.querySelector(".vl").textContent = "▣" + d.value + " ◍" + S.soil[idx(d.c, d.r)];
    });
    /* routes svg */
    while (routesEl.firstChild) routesEl.removeChild(routesEl.firstChild);
    S.routes.forEach(function (rt) {
      var a = distById(rt.a), b = distById(rt.b);
      if (!a || !b) return;
      var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", (a.c + 0.5) * 100); l.setAttribute("y1", (a.r + 0.5) * 100);
      l.setAttribute("x2", (b.c + 0.5) * 100); l.setAttribute("y2", (b.r + 0.5) * 100);
      l.style.pointerEvents = "stroke";
      l.addEventListener("click", function () { cutRoute(rt.a, rt.b); });
      routesEl.appendChild(l);
      [a, b].forEach(function (p) {
        var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", (p.c + 0.5) * 100); c.setAttribute("cy", (p.r + 0.5) * 100);
        c.setAttribute("r", 14);
        routesEl.appendChild(c);
      });
    });
    /* hud */
    ui.credits.textContent = S.credits;
    ui.quota.textContent = S.quota;
    ui.quotaBar.style.width = Math.min(100, S.credits / S.quota * 100) + "%";
    ui.tide.textContent = Math.min(S.tide, TIDE_MAX);
    ui.tideBar.style.width = (S.tide / TIDE_MAX * 100) + "%";
    ui.routeCount.textContent = S.routes.length + "/" + MAX_ROUTES;
    ui.fogCount.textContent = Math.round(seen / (N * N) * 100) + "%";
    ui.seedChip.textContent = "◈ SEED " + S.seed;
    ui.dailyBadge.hidden = !S.daily;
    var b = best();
    ui.best.textContent = b ? b + "◦" : "—";
    var st = streak();
    ui.streak.textContent = st ? "★ streak " + st : "";
    /* ledger */
    ui.ledger.innerHTML = S.districts.map(function (d) {
      return "<li><span>▣ " + esc(d.name) + "·" + d.value + "</span><span>◍" +
        S.soil[idx(d.c, d.r)] + " @" + "abcdefgh".charAt(d.c) + (d.r + 1) + "</span></li>";
    }).join("");
    /* routes list */
    ui.routeList.innerHTML = S.routes.length ? S.routes.map(function (rt) {
      var a = distById(rt.a), c2 = distById(rt.b);
      return '<li data-a="' + rt.a + '" data-b="' + rt.b + '" title="tap to cut">✕ ' +
        esc(a.name) + "↔" + esc(c2.name) + " <span>+" + routeIncome(rt) + "◦</span></li>";
    }).join("") : '<li class="empty">no routes — tap blob → blob</li>';
    Array.prototype.forEach.call(ui.routeList.querySelectorAll("li[data-a]"), function (li) {
      li.addEventListener("click", function () { cutRoute(+li.dataset.a, +li.dataset.b); });
    });
    /* pulse */
    ui.btnPulse.disabled = S.credits < PULSE_COST || S.pulseCd > 0 || over;
    ui.btnPulse.textContent = S.pulseCd > 0 ? "◉ cooldown " + S.pulseCd : "pulse ◉ 3◦";
    ui.btnDrift.disabled = over;
    ui.modeTag.textContent = selected !== null ? "mode: link " + esc(distById(selected).name) + " → tap target" : "mode: plot";
  }

  function log(html) {
    var li = document.createElement("li");
    li.innerHTML = "<b>T" + S.tide + "</b>" + html;
    ui.log.insertBefore(li, ui.log.firstChild);
    while (ui.log.children.length > 40) ui.log.removeChild(ui.log.lastChild);
  }

  /* ---- routes ---- */
  function addRoute(a, b) {
    if (a === b) return;
    if (S.routes.some(function (r) { return (r.a === a && r.b === b) || (r.a === b && r.b === a); })) {
      ui.hint.textContent = "that route already exists";
      return;
    }
    if (S.routes.length >= MAX_ROUTES) { ui.hint.textContent = "route cap reached — tap a line to cut one"; return; }
    S.routes.push({ a: a, b: b });
    revealLine(distById(a), distById(b));
    log("route " + esc(distById(a).name) + "↔" + esc(distById(b).name) + " drawn (+" + routeIncome({ a: a, b: b }) + "◦/tide)");
    selected = null;
    render();
  }
  function cutRoute(a, b) {
    S.routes = S.routes.filter(function (r) { return !((r.a === a && r.b === b) || (r.a === b && r.b === a)); });
    log("route cut — fog keeps what it lit");
    render();
  }
  function tapDistrict(d) {
    if (selected === null) {
      selected = d.id;
      ui.hint.textContent = "linking " + d.name + " — tap another blob to draw the route (tap again to cancel)";
    } else if (selected === d.id) {
      selected = null;
      ui.hint.textContent = "link cancelled";
    } else {
      addRoute(selected, d.id);
      ui.hint.textContent = "drag a blob to move it · tap one blob, then another, to draw a route · tap a route to cut it";
    }
    render();
  }

  /* ---- drag districts ---- */
  var drag = null;
  function boardCellFromPoint(x, y) {
    var r = board.getBoundingClientRect();
    var c = Math.floor((x - r.left) / r.width * N);
    var rr = Math.floor((y - r.top) / r.height * N);
    if (c < 0 || c >= N || rr < 0 || rr >= N) return null;
    return { c: c, r: rr };
  }
  function onPieceDown(e) {
    if (over && won) return;
    var id = +e.currentTarget.dataset.id;
    var d = distById(id);
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    drag = { id: id, x0: e.clientX, y0: e.clientY, moved: false, el: e.currentTarget };
  }
  document.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    drag.moved = true;
    drag.el.classList.add("dragging");
    var r = board.getBoundingClientRect();
    var x = e.clientX - r.left - r.width / N / 2;
    var y = e.clientY - r.top - r.height / N / 2;
    drag.el.style.left = (x / r.width * 100) + "%";
    drag.el.style.top = (y / r.height * 100) + "%";
    var cell = boardCellFromPoint(e.clientX, e.clientY);
    var other = cell && distAt(cell.c, cell.r);
    ui.modeTag.textContent = (other && other.id !== drag.id) ? "mode: drop to link ↔" : "mode: move ▣";
  });
  document.addEventListener("pointerup", function (e) {
    if (!drag) return;
    var d = distById(drag.id);
    var wasDrag = drag.moved;
    drag.el.classList.remove("dragging");
    var info = drag; drag = null;
    if (!wasDrag) { tapDistrict(d); return; }
    var cell = boardCellFromPoint(e.clientX, e.clientY);
    if (!cell) { render(); return; }
    var other = distAt(cell.c, cell.r);
    if (other && other.id !== d.id) { addRoute(d.id, other.id); render(); return; }
    if (cell.c === d.c && cell.r === d.r) { render(); return; }
    if (occupied(cell.c, cell.r, d.id)) {
      ui.hint.textContent = "tile taken — drop on a blob to link instead";
      render(); return;
    }
    d.c = cell.c; d.r = cell.r;
    revealAround(cell.c, cell.r);
    log("▣ " + esc(d.name) + " anchored @" + "abcdefgh".charAt(cell.c) + (cell.r + 1) + " (soil ◍" + S.soil[idx(cell.c, cell.r)] + ")");
    render();
  });

  /* ---- pulse ---- */
  function pulse() {
    if (S.credits < PULSE_COST || S.pulseCd > 0 || over) return;
    var fogged = [];
    for (var i = 0; i < N * N; i++) if (!S.revealed[i]) fogged.push(i);
    if (!fogged.length) { ui.hint.textContent = "no fog left — the grid is bare"; return; }
    S.credits -= PULSE_COST; S.pulseCd = 2;
    var n = Math.min(8, fogged.length);
    for (var k = 0; k < n; k++) {
      var j = Math.floor(S.rng() * fogged.length);
      var t = fogged.splice(j, 1)[0];
      revealAround(t % N, (t / N) | 0);
    }
    log("◉ sonar pulse burned " + PULSE_COST + "◦ — fog thins");
    render();
  }

  /* ---- overlays / auto ---- */
  function showOverlay(kicker, title, body) {
    ui.ovKicker.textContent = kicker; ui.ovTitle.textContent = title; ui.ovBody.innerHTML = body;
    ui.overlay.hidden = false;
  }
  function setAuto(on) {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (on && !over) autoTimer = setInterval(driftOnce, 3500);
    ui.btnAuto.setAttribute("aria-pressed", on ? "true" : "false");
    ui.btnAuto.textContent = on ? "auto: on" : "auto: off";
  }

  /* ---- wire ---- */
  ui.btnDrift.addEventListener("click", driftOnce);
  ui.btnAuto.addEventListener("click", function () { setAuto(!autoTimer); });
  ui.btnPulse.addEventListener("click", pulse);
  ui.btnNew.addEventListener("click", function () { ui.overlay.hidden = true; newGame(randomSeed(), false); });
  ui.btnDaily.addEventListener("click", function () { ui.overlay.hidden = true; newGame(todaySeed(), true); });
  ui.btnHelp.addEventListener("click", function () { $("help").hidden = false; });
  $("btnHelpClose").addEventListener("click", function () { $("help").hidden = true; });
  $("btnAgain").addEventListener("click", function () { ui.overlay.hidden = true; newGame(S.seed, S.daily); });
  $("btnNextDaily").addEventListener("click", function () { ui.overlay.hidden = true; newGame(todaySeed(), true); });
  $("btnClose").addEventListener("click", function () {
    ui.overlay.hidden = true;
    if (over && !won) { over = false; log("free drift — tides beyond 20, no quota pressure"); render(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === " " && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); driftOnce(); }
    if (e.key === "Escape") { ui.overlay.hidden = true; $("help").hidden = true; selected = null; render(); }
  });

  /* boot: daily seed if fresh day, else daily anyway — one polished thing */
  newGame(todaySeed(), true);
})();
