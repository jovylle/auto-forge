/* Nettle Coin Laundry — japanese-minimal day-shift game.
   Plain script (no modules) so it works from file:// with zero build.
   Constraints: 3 hues + black/white only (see style.css); all sound via WebAudio. */
(function () {
  "use strict";

  var DAY_LEN = 90;          // seconds per day
  var MACHINES = 5;
  var START_COINS = 6;
  var WASH_S = 8;            // normal wash seconds
  var NETTLE_S = 12;         // nettle wash seconds
  var DONE_GRACE = 5;        // collect within this many sec of done -> combo step
  var MAX_QUEUE = 4;
  var COMBO_WINDOW = 6;      // seconds between collects to keep combo
  var TAP_SAVE = 0.3;        // seconds shaved per agitate tap
  var TAP_COOLDOWN = 0.8;
  var NUMERAL = ["一", "二", "三", "四", "五"];

  /* ---------- tiny store ---------- */
  var store = {
    get: function (k, fb) {
      try {
        var v = window.localStorage.getItem(k);
        return v === null ? fb : v;
      } catch (e) { return fb; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ }
    }
  };

  /* ---------- sound (WebAudio, no assets) ---------- */
  var audio = { ctx: null, muted: store.get("ncl.sound", "on") === "off" };
  function ac() {
    if (audio.ctx) return audio.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    return audio.ctx;
  }
  function tone(freq, dur, type, vol, when, slide) {
    if (audio.muted) return;
    var ctx = ac();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      var t = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  var sfx = {
    unlock: function () { ac(); },
    click: function () { tone(660, 0.07, "triangle", 0.12); },
    coin: function () { tone(1568, 0.09, "sine", 0.16); tone(2093, 0.14, "sine", 0.14, 0.07); },
    load: function () { tone(180, 0.16, "sine", 0.22, 0, 90); tone(520, 0.08, "triangle", 0.1, 0.1); },
    bubble: function () { tone(300 + Math.random() * 500, 0.06, "sine", 0.05, 0, 180); },
    thump: function () { tone(140, 0.1, "sine", 0.2, 0, 70); },
    ding: function () { tone(659, 0.22, "sine", 0.2); tone(880, 0.3, "sine", 0.18, 0.12); tone(1318, 0.4, "sine", 0.12, 0.24); },
    collect: function () { tone(523, 0.09, "triangle", 0.16); tone(784, 0.12, "triangle", 0.16, 0.08); },
    nettle: function () { tone(392, 0.1, "triangle", 0.16); tone(587, 0.1, "triangle", 0.16, 0.09); tone(880, 0.16, "triangle", 0.16, 0.18); },
    sad: function () { tone(330, 0.18, "sine", 0.12, 0, 220); },
    jingle: function () {
      var seq = [523, 659, 784, 1046, 784, 1046];
      for (var i = 0; i < seq.length; i++) tone(seq[i], 0.16, "triangle", 0.15, i * 0.13);
    }
  };

  /* ---------- state ---------- */
  var S = null;
  function freshState() {
    var m = [];
    for (var i = 0; i < MACHINES; i++) m.push({ st: "idle", t: 0, dur: 0, nettle: false, doneAt: 0, tapAt: 0 });
    return {
      running: false, over: false, t: 0, day: 1,
      coins: START_COINS, score: 0,
      best: parseInt(store.get("ncl.best", "0"), 10) || 0,
      queue: [], machines: m,
      loads: 0, nettles: 0, lost: 0,
      combo: 0, bestCombo: 0, lastCollect: -99,
      spawnIn: 1.2, freebieUsed: false
    };
  }

  /* ---------- dom ---------- */
  function $(id) { return document.getElementById(id); }
  var el = {};
  ["machines", "queue", "queueNote", "coins", "score", "best", "combo", "comboN",
   "clock", "sunFill", "sunDot", "openBtn", "soundBtn", "copyBtn", "dlBtn",
   "log", "overlay", "stampKanji", "rankName", "ovScore", "stLoads", "stNettle",
   "stCombo", "stLost", "stCoins", "newBest", "againBtn", "ovCopyBtn", "ovDlBtn",
   "toast", "footBest", "dayNum"].forEach(function (id) { el[id] = $(id); });

  var machineEls = [];
  function buildMachines() {
    el.machines.innerHTML = "";
    machineEls = [];
    for (var i = 0; i < MACHINES; i++) {
      (function (i) {
        var d = document.createElement("div");
        d.className = "machine idle";
        d.setAttribute("role", "button");
        d.setAttribute("tabindex", "0");
        d.setAttribute("aria-label", "Machine " + (i + 1));
        d.innerHTML =
          '<div class="num">' + NUMERAL[i] + '番</div>' +
          '<div class="porthole"><div class="drum"></div><div class="water"></div>' +
          '<div class="steam" style="left:30%">〜</div><div class="steam s2">〜</div></div>' +
          '<span class="status">あき EMPTY</span>' +
          '<div class="prog"><div></div></div>' +
          '<div class="hint"></div>';
        d.addEventListener("click", function () { onMachine(i); });
        d.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onMachine(i); }
        });
        el.machines.appendChild(d);
        machineEls.push({
          root: d,
          status: d.querySelector(".status"),
          prog: d.querySelector(".prog > div"),
          water: d.querySelector(".water"),
          hint: d.querySelector(".hint")
        });
      })(i);
    }
  }

  /* ---------- log ---------- */
  function stamp() {
    var s = Math.max(0, Math.ceil(DAY_LEN - S.t));
    var mm = Math.floor(s / 60), ss = ("0" + (s % 60)).slice(-2);
    return mm + ":" + ss;
  }
  function log(msg, cls) {
    var li = document.createElement("li");
    var a = document.createElement("span");
    a.textContent = msg;
    if (cls) a.className = cls;
    var b = document.createElement("span");
    b.className = "t";
    b.textContent = stamp();
    li.appendChild(a);
    li.appendChild(b);
    el.log.insertBefore(li, el.log.firstChild);
    while (el.log.children.length > 40) el.log.removeChild(el.log.lastChild);
  }

  /* ---------- game actions ---------- */
  function startDay() {
    sfx.unlock(); sfx.click();
    S = freshState();
    S.running = true;
    S.day = parseInt(store.get("ncl.day", "1"), 10) || 1;
    el.overlay.classList.add("hidden");
    el.openBtn.disabled = true;
    el.openBtn.textContent = "営業中 OPEN…";
    el.log.innerHTML = "";
    log("のれんを出した — shop opened", "good");
    render(true);
  }

  function endDay() {
    S.running = false;
    S.over = true;
    // half-pay auto-collect for in-progress loads
    var auto = 0;
    S.machines.forEach(function (m) {
      if (m.st === "washing") {
        auto += m.nettle ? 2 : 1;
        S.loads++;
        if (m.nettle) S.nettles++;
        m.st = "idle";
      }
    });
    if (auto > 0) {
      S.coins += auto;
      log("おまかせ仕上げ +" + auto + " coins (unfinished loads)", "good");
    }
    var isBest = S.score > S.best;
    if (isBest) {
      S.best = S.score;
      store.set("ncl.best", String(S.best));
    }
    store.set("ncl.day", String(S.day + 1));
    sfx.jingle();
    showSheet(isBest);
    el.openBtn.disabled = false;
    el.openBtn.textContent = "開店 OPEN SHOP";
    render(true);
  }

  function rankFor(score) {
    if (score >= 180) return { kanji: "達人", name: "達人 MASTER" };
    if (score >= 120) return { kanji: "職人", name: "職人 ARTISAN" };
    if (score >= 60) return { kanji: "番頭", name: "番頭 CLERK" };
    return { kanji: "見習", name: "見習い APPRENTICE" };
  }

  function onMachine(i) {
    if (!S || !S.running) { sfx.click(); return; }
    var m = S.machines[i];
    var now = S.t;
    if (m.st === "idle") {
      if (S.queue.length === 0) { sfx.click(); flashHint(i, "かごが無い NO BASKET"); return; }
      if (S.coins <= 0 && !S.freebieUsed) {
        S.freebieUsed = true;
        log("おまけ！ on-the-house wash (no coins)", "hot");
      } else if (S.coins <= 0) {
        sfx.sad(); flashHint(i, "コイン不足 NEED COIN"); return;
      } else {
        S.coins--;
        sfx.coin();
      }
      var b = S.queue.shift();
      m.st = "washing";
      m.t = 0;
      m.nettle = b.nettle;
      m.dur = b.nettle ? NETTLE_S : WASH_S;
      m.tapAt = -99;
      sfx.load();
      log((b.nettle ? "イガ nettle load → " + NUMERAL[i] + "番" : "wash started → " + NUMERAL[i] + "番"), b.nettle ? "hot" : "");
    } else if (m.st === "washing") {
      // agitate: shave time, with cooldown
      if (now - m.tapAt >= TAP_COOLDOWN) {
        m.tapAt = now;
        m.t = Math.min(m.t + TAP_SAVE, m.dur);
        sfx.thump();
        wobble(i);
      } else {
        sfx.bubble();
      }
    } else if (m.st === "done") {
      var quick = (now - m.doneAt) <= DONE_GRACE;
      var gapOk = (now - S.lastCollect) <= COMBO_WINDOW;
      S.combo = gapOk ? S.combo + 1 : 1;
      S.lastCollect = now;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      var bonus = Math.min(S.combo - 1, 5) * 2;
      var coins = m.nettle ? 4 : 2;
      var pts = (m.nettle ? 20 : 10) + bonus;
      S.coins += coins;
      S.score += pts;
      S.loads++;
      if (m.nettle) S.nettles++;
      if (m.nettle) sfx.nettle(); else sfx.collect();
      log("受取 +" + coins + "c +" + pts + "pt" + (S.combo > 1 ? " (連x" + S.combo + ")" : "") + (quick ? " ⚡" : ""), m.nettle ? "hot" : "good");
      m.st = "idle";
      m.nettle = false;
    }
    render(true);
  }

  function wobble(i) {
    var r = machineEls[i].root;
    r.style.transform = "rotate(1.5deg) scale(0.98)";
    setTimeout(function () { r.style.transform = ""; }, 120);
  }
  function flashHint(i, msg) {
    machineEls[i].hint.textContent = msg;
    setTimeout(function () { if (S) render(true); }, 900);
  }

  /* ---------- spawner ---------- */
  function spawnBasket() {
    if (S.queue.length >= MAX_QUEUE) {
      S.lost++;
      sfx.sad();
      log("お客が帰った — customer left (counter full)", "hot");
      render(true);
      return;
    }
    var nettle = Math.random() < 0.28;
    S.queue.push({ nettle: nettle, id: Date.now() + Math.random() });
    if (nettle) sfx.bubble();
    render(true);
  }

  /* ---------- tick ---------- */
  var lastTick = 0;
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!S || !S.running) return;
    if (!lastTick) lastTick = ts;
    var dt = Math.min((ts - lastTick) / 1000, 0.5);
    lastTick = ts;
    S.t += dt;
    if (S.t >= DAY_LEN) { endDay(); return; }
    S.spawnIn -= dt;
    if (S.spawnIn <= 0) {
      spawnBasket();
      var hurry = S.t / DAY_LEN; // day gets busier
      S.spawnIn = 5.5 - hurry * 2.2 + Math.random() * 2;
    }
    var anyWash = false;
    S.machines.forEach(function (m) {
      if (m.st === "washing") {
        anyWash = true;
        m.t += dt;
        if (m.t >= m.dur) {
          m.st = "done";
          m.doneAt = S.t;
          sfx.ding();
          log(NUMERAL[S.machines.indexOf(m)] + "番 できあがり！ DONE — collect", "hot");
        }
      }
    });
    if (anyWash && Math.random() < dt * 1.2) sfx.bubble();
    render(false);
  }

  /* ---------- render ---------- */
  function render(force) {
    el.coins.textContent = S.coins;
    el.score.textContent = S.score;
    el.best.textContent = S.best;
    el.footBest.textContent = "best " + S.best;
    el.dayNum.textContent = S.day;
    var left = Math.max(0, DAY_LEN - S.t);
    var mm = Math.floor(left / 60), ss = ("0" + Math.floor(left % 60)).slice(-2);
    el.clock.textContent = S.running ? "あと " + mm + ":" + ss : (S.over ? "閉店 closed" : "—");
    var pct = Math.min(100, (S.t / DAY_LEN) * 100);
    el.sunFill.style.width = pct + "%";
    el.sunDot.style.left = pct + "%";
    if (S.combo > 1 && (S.t - S.lastCollect) <= COMBO_WINDOW) {
      el.combo.classList.remove("hidden");
      el.comboN.textContent = S.combo;
    } else {
      el.combo.classList.add("hidden");
      if (S.running && (S.t - S.lastCollect) > COMBO_WINDOW) S.combo = 0;
    }
    // machines
    S.machines.forEach(function (m, i) {
      var c = machineEls[i];
      c.root.classList.remove("idle", "washing", "done", "nettle");
      c.root.classList.add(m.st);
      if (m.nettle && m.st !== "idle") c.root.classList.add("nettle");
      if (m.st === "idle") {
        c.status.textContent = "あき EMPTY";
        c.prog.style.width = "0%";
        c.water.style.height = "0%";
        c.hint.innerHTML = S.queue.length ? '<span class="jp">いれられます</span> READY' : "";
      } else if (m.st === "washing") {
        var p = Math.min(1, m.t / m.dur);
        c.status.textContent = (m.nettle ? "イガ NETTLE " : "洗濯中 ") + Math.ceil(m.dur - m.t) + "s";
        c.prog.style.width = (p * 100) + "%";
        c.water.style.height = (8 + p * 62) + "%";
        c.hint.innerHTML = '<span class="jp">たたく</span> TAP TO AGITATE';
      } else {
        c.status.textContent = "できあがり DONE!";
        c.prog.style.width = "100%";
        c.water.style.height = "0%";
        c.hint.innerHTML = '<span class="jp">うけとる</span> CLICK TO COLLECT';
      }
    });
    // queue
    el.queue.innerHTML = "";
    if (S.queue.length === 0) {
      el.queueNote.textContent = S.running ? "Counter clear — fresh baskets on the way…" : "The counter is empty. Open the shop to greet the day.";
    } else {
      el.queueNote.textContent = S.queue.length + " basket" + (S.queue.length > 1 ? "s" : "") + " waiting — click an empty machine to load.";
      S.queue.forEach(function (b) {
        var d = document.createElement("div");
        d.className = "basket" + (b.nettle ? " nettle" : "");
        var w = document.createElement("div");
        w.className = "weave";
        var s = document.createElement("small");
        s.textContent = b.nettle ? "イガ NETTLE +4c" : "ふつう +2c";
        d.appendChild(w);
        d.appendChild(s);
        el.queue.appendChild(d);
      });
    }
  }

  /* ---------- share / export ---------- */
  function recordText() {
    var r = rankFor(S ? S.score : 0);
    var sc = S ? S.score : 0;
    var ld = S ? S.loads : 0;
    return "🧺 Nettle Coin Laundry — day record: " + ld + " loads · " + sc + " pts · rank " +
      r.name + ". Wash well, fold kindly. #nettlecoinlaundry";
  }
  function receiptText() {
    var L = [];
    L.push("=====================================");
    L.push("  根 NETTLE COIN LAUNDRY");
    L.push("  ネトル コインランドリー — 本日のお会計");
    L.push("=====================================");
    L.push("  day ............ " + (S ? S.day : 1));
    L.push("  score .......... " + (S ? S.score : 0) + " pts");
    L.push("  rank ........... " + rankFor(S ? S.score : 0).name);
    L.push("  loads finished . " + (S ? S.loads : 0));
    L.push("  nettle loads ... " + (S ? S.nettles : 0));
    L.push("  best combo ..... x" + (S ? S.bestCombo : 0));
    L.push("  customers lost . " + (S ? S.lost : 0));
    L.push("  coins in drawer  " + (S ? S.coins : 0));
    L.push("  best ever ...... " + (S ? S.best : 0));
    L.push("-------------------------------------");
    L.push("  wash well, fold kindly. また明日！");
    L.push("=====================================");
    return L.join("\n");
  }
  function copyText(txt, done) {
    function ok() { if (done) done(true); }
    function fail() {
      // fallback for file:// or no permission
      try {
        var ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var good = document.execCommand("copy");
        document.body.removeChild(ta);
        if (done) done(!!good);
      } catch (e) { if (done) done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, fail);
    } else { fail(); }
  }
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    setTimeout(function () { el.toast.classList.add("hidden"); }, 1600);
  }
  function downloadReceipt() {
    sfx.click();
    try {
      var blob = new Blob([receiptText()], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "nettle-coin-laundry-day" + (S ? S.day : 1) + ".txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      log("receipt printed ↓", "good");
    } catch (e) { log("print failed", "hot"); }
  }

  /* ---------- sheet ---------- */
  function showSheet(isBest) {
    var r = rankFor(S.score);
    el.stampKanji.textContent = r.kanji;
    el.rankName.textContent = r.name;
    el.ovScore.textContent = S.score;
    el.stLoads.textContent = S.loads;
    el.stNettle.textContent = S.nettles;
    el.stCombo.textContent = "x" + S.bestCombo;
    el.stLost.textContent = S.lost;
    el.stCoins.textContent = S.coins;
    el.newBest.classList.toggle("hidden", !isBest);
    // retrigger slam animation
    var st = $("stamp");
    st.style.animation = "none";
    void st.offsetWidth;
    st.style.animation = "";
    el.overlay.classList.remove("hidden");
  }

  /* ---------- wire up ---------- */
  function setSoundBtn() {
    el.soundBtn.textContent = audio.muted ? "♪ SOUND OFF" : "♪ SOUND ON";
    el.soundBtn.setAttribute("aria-pressed", String(!audio.muted));
  }
  el.openBtn.addEventListener("click", function () { startDay(); lastTick = 0; });
  el.againBtn.addEventListener("click", function () { startDay(); lastTick = 0; });
  el.soundBtn.addEventListener("click", function () {
    audio.muted = !audio.muted;
    store.set("ncl.sound", audio.muted ? "off" : "on");
    setSoundBtn();
    if (!audio.muted) sfx.click();
  });
  el.copyBtn.addEventListener("click", function () {
    sfx.click();
    copyText(recordText(), function (ok) { showToast(ok ? "record copied ✓" : "copy blocked — sorry"); });
  });
  el.ovCopyBtn.addEventListener("click", function () {
    sfx.click();
    copyText(recordText(), function (ok) { showToast(ok ? "record copied ✓" : "copy blocked — sorry"); });
  });
  el.dlBtn.addEventListener("click", downloadReceipt);
  el.ovDlBtn.addEventListener("click", downloadReceipt);

  /* ---------- boot ---------- */
  S = freshState();
  S.day = parseInt(store.get("ncl.day", "1"), 10) || 1;
  buildMachines();
  setSoundBtn();
  log("いらっしゃいませ — welcome to Nettle Coin Laundry", "good");
  log("press 開店 to start the 90-second day", "");
  render(true);
  requestAnimationFrame(tick);
})();
