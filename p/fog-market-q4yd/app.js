/* Fog Market — keyboard-only pop-art blind-trading game. No deps, file:// safe. */
(function () {
  "use strict";

  var MAX_DAYS = 8;
  var GOAL = 150;
  var START_COINS = 60;
  var START_HORNS = 3;
  var REVEAL_SECS = 6;

  var GOODS = [
    { name: "Silk Lantern", icon: "🏮" },
    { name: "Brass Compass", icon: "🧭" },
    { name: "Clockwork Fish", icon: "🐟" },
    { name: "Neon Geode", icon: "💎" },
    { name: "Paper Engine", icon: "🪁" },
    { name: "Tin Trumpet", icon: "🎺" },
    { name: "Ghost Radio", icon: "📻" },
    { name: "Harbor Bell", icon: "🔔" },
    { name: "Copper Owl", icon: "🦉" },
    { name: "Glass Pickle", icon: "🥒" },
    { name: "Pocket Storm", icon: "⛈️" },
    { name: "Velvet Astrolabe", icon: "🔭" }
  ];

  var RUMORS_GOOD = [
    "Heavy. Smells of copper money.",
    "Vendor winks twice. Suspiciously kind.",
    "Humming faintly. Probably valuable.",
    "Warm to the touch. Collectors whisper."
  ];
  var RUMORS_BAD = [
    "Suspiciously light. Rattles oddly.",
    "Vendor avoids eye contact.",
    "Damp cardboard aroma. Hmm.",
    "Ticking… but there is no clock inside?"
  ];
  var RUMORS_MID = [
    "Thick fog. Could be anything.",
    "Another trader sniffed it and shrugged.",
    "Fog-damp box. Standard mystery.",
    "It sloshes. Or sings? Hard to tell."
  ];

  var state = freshState();

  var elCoins = document.getElementById("coins");
  var elDay = document.getElementById("day");
  var elGoal = document.getElementById("goal");
  var elWorth = document.getElementById("worth");
  var elHorns = document.getElementById("horns");
  var elStalls = document.getElementById("stalls");
  var elSatchel = document.getElementById("satchel");
  var elLog = document.getElementById("log");
  var elAnn = document.getElementById("announcer");
  var elReveal = document.getElementById("reveal-bar");
  var elRevealT = document.getElementById("reveal-t");
  var elFinale = document.getElementById("finale");
  var elFinaleText = document.getElementById("finale-text");

  var audioCtx = null;
  var revealTimer = null;
  var revealLeft = 0;

  function freshState() {
    return {
      coins: START_COINS,
      day: 1,
      horns: START_HORNS,
      stalls: [],
      satchel: [],
      cursor: 0,
      satchelCursor: 0,
      zone: "market",
      muted: false,
      over: false,
      revealed: false,
      tradeCount: 0
    };
  }

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }

  function restock() {
    state.stalls = [];
    var used = {};
    for (var i = 0; i < 5; i++) {
      var g = pick(GOODS);
      var key = g.name + i;
      if (used[g.name]) g = GOODS[(GOODS.indexOf(g) + i + 1) % GOODS.length];
      used[g.name] = true;
      var value = 5 + rnd(56); // 5..60 true value
      // Asking price loosely tied to value but noisy => blind risk
      var noise = rnd(21) - 10; // -10..+10
      var price = Math.max(6, Math.min(48, Math.round(value * 0.7 + 8 + noise)));
      var spread = value - price;
      var rumor = spread >= 8 ? pick(RUMORS_GOOD) : spread <= -8 ? pick(RUMORS_BAD) : pick(RUMORS_MID);
      state.stalls.push({
        id: state.day + "-" + i + "-" + key.length + rnd(999),
        name: g.name, icon: g.icon,
        price: price, value: value, rumor: rumor, sold: false
      });
    }
    state.cursor = 0;
  }

  /* ---------- audio (WebAudio, no files) ---------- */
  function ac() {
    if (state.muted) return null;
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, vol, when) {
    var ctx = ac();
    if (!ctx) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      var t = ctx.currentTime + (when || 0);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* silent */ }
  }
  function sndBuy() { tone(523, 0.12, "square", 0.07, 0); tone(659, 0.12, "square", 0.07, 0.1); tone(784, 0.2, "square", 0.07, 0.2); }
  function sndSell() { tone(784, 0.1, "triangle", 0.09, 0); tone(587, 0.16, "triangle", 0.09, 0.09); }
  function sndBad() { tone(160, 0.22, "sawtooth", 0.08, 0); }
  function sndBlip() { tone(440, 0.06, "square", 0.05, 0); }
  function sndHorn() {
    var ctx = ac();
    if (!ctx) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sawtooth";
      var t = ctx.currentTime;
      o.frequency.setValueAtTime(98, t);
      o.frequency.linearRampToValueAtTime(65, t + 1.1);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 1.5);
      tone(49, 1.2, "triangle", 0.1, 0.05);
    } catch (e) { /* silent */ }
  }

  /* ---------- log + announce ---------- */
  function log(msg, cls) {
    var li = document.createElement("li");
    if (cls) li.className = cls;
    li.textContent = msg;
    elLog.prepend(li);
    while (elLog.children.length > 30) elLog.removeChild(elLog.lastChild);
  }
  function say(msg) { elAnn.textContent = ""; window.setTimeout(function () { elAnn.textContent = msg; }, 30); }

  function worth() {
    var inv = state.satchel.reduce(function (s, it) { return s + it.value; }, 0);
    return state.coins + inv;
  }

  /* ---------- render ---------- */
  function render() {
    elCoins.textContent = String(state.coins);
    elDay.textContent = state.day + " / " + MAX_DAYS;
    elGoal.textContent = String(GOAL);
    elWorth.textContent = String(worth());
    elHorns.textContent = String(state.horns);

    // stalls
    elStalls.innerHTML = "";
    state.stalls.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "stall" + (s.sold ? " soldout" : "");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", state.zone === "market" && state.cursor === i ? "true" : "false");
      b.dataset.index = String(i);
      var spread = s.value - s.price;
      var verdict = state.revealed
        ? (spread >= 5 ? "✔ BARGAIN +" + spread : spread <= -5 ? "✘ TRAP " + spread : "= FAIR " + (spread >= 0 ? "+" : "") + spread)
        : "❓ BLIND LOT";
      b.setAttribute("aria-label",
        "Stall " + (i + 1) + " of 5: " + (s.sold ? "sold out. " : "") +
        s.name + " hidden. Price " + s.price + " coins. Rumor: " + s.rumor + ". " +
        (state.revealed ? "True value " + s.value + ". " + verdict + ". " : "True value hidden in fog. ") +
        "Press Enter to blind-buy.");
      b.innerHTML =
        '<span class="icon" aria-hidden="true">' + escapeHtml(s.sold ? "🕸️" : s.icon) + "</span>" +
        '<span class="name">Stall ' + (i + 1) + " · " + escapeHtml(s.sold ? "SOLD" : "???") + "</span>" +
        '<span class="price">' + (s.sold ? "gone" : s.price + " coins") + "</span>" +
        '<span class="rumor">“' + escapeHtml(s.rumor) + "”</span>" +
        '<span class="verdict">' + escapeHtml(verdict) + "</span>" +
        (state.revealed && !s.sold
          ? '<span class="tag">real ' + s.value + "</span>"
          : "") +
        '<span class="fog" aria-hidden="true">' + (s.sold ? "SOLD OUT" : "🌫 MIST 🌫<br/>value hidden") + "</span>";
      b.addEventListener("click", function () { state.zone = "market"; state.cursor = i; render(); focusStall(i); });
      b.addEventListener("focus", function () { state.zone = "market"; state.cursor = i; paintSelection(); });
      elStalls.appendChild(b);
    });

    // satchel
    elSatchel.innerHTML = "";
    if (!state.satchel.length) {
      var d = document.createElement("div");
      d.className = "empty";
      d.textContent = "Satchel empty — blind-buy a lot with Enter, then sell it here for its true value.";
      elSatchel.appendChild(d);
    } else {
      state.satchel.forEach(function (it, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "loot";
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", state.zone === "satchel" && state.satchelCursor === i ? "true" : "false");
        b.setAttribute("aria-label",
          "Satchel item " + (i + 1) + " of " + state.satchel.length + ": " + it.name +
          ", true value " + it.value + " coins, bought for " + it.buyPrice + ". Press Enter to sell.");
        b.innerHTML =
          '<span class="icon" aria-hidden="true">' + escapeHtml(it.icon) + "</span>" +
          '<span class="name">' + escapeHtml(it.name) + "</span>" +
          '<span class="sellfor">sells ' + it.value + "</span>" +
          "<span class=\"rumor\">bought " + it.buyPrice + " → " + (it.value - it.buyPrice >= 0 ? "+" : "") + (it.value - it.buyPrice) + "</span>";
        b.addEventListener("click", function () { state.zone = "satchel"; state.satchelCursor = i; render(); focusLoot(i); });
        b.addEventListener("focus", function () { state.zone = "satchel"; state.satchelCursor = i; paintSelection(); });
        elSatchel.appendChild(b);
      });
    }
    paintSelection();
    updateHornBtn();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function paintSelection() {
    var stalls = elStalls.querySelectorAll(".stall");
    for (var i = 0; i < stalls.length; i++) {
      stalls[i].setAttribute("aria-selected", state.zone === "market" && state.cursor === i ? "true" : "false");
    }
    var loots = elSatchel.querySelectorAll(".loot");
    for (var j = 0; j < loots.length; j++) {
      loots[j].setAttribute("aria-selected", state.zone === "satchel" && state.satchelCursor === j ? "true" : "false");
    }
  }

  function updateHornBtn() {
    var btn = document.getElementById("btn-horn");
    btn.disabled = state.horns <= 0 || state.revealed || state.over;
    btn.style.opacity = btn.disabled ? "0.55" : "1";
    btn.innerHTML = state.revealed
      ? "Horn sounding…"
      : "Sound fog horn <kbd>H</kbd> (" + state.horns + " left)";
  }

  function focusStall(i) {
    var n = elStalls.querySelectorAll(".stall")[i];
    if (n) n.focus();
  }
  function focusLoot(i) {
    var n = elSatchel.querySelectorAll(".loot")[i];
    if (n) n.focus();
  }

  /* ---------- actions ---------- */
  function buy(i) {
    if (state.over) return;
    var s = state.stalls[i];
    if (!s) return;
    if (s.sold) { deny("Stall " + (i + 1) + " is sold out. Try another."); return; }
    if (state.coins < s.price) {
      deny("Not enough coins for stall " + (i + 1) + ". It costs " + s.price + ", you hold " + state.coins + ".");
      return;
    }
    state.coins -= s.price;
    s.sold = true;
    state.satchel.push({ name: s.name, icon: s.icon, value: s.value, buyPrice: s.price });
    state.satchelCursor = state.satchel.length - 1;
    state.tradeCount++;
    sndBuy();
    var profit = s.value - s.price;
    var msg = "Bought " + s.name + " blind for " + s.price + ". Appraised at " + s.value + " (" + (profit >= 0 ? "+" : "") + profit + ").";
    log((profit >= 0 ? "✔ " : "✘ ") + msg, profit >= 0 ? "good" : "bad");
    say(msg + " Coins: " + state.coins + ".");
    render();
  }

  function sell(i) {
    if (state.over) return;
    var it = state.satchel[i];
    if (!it) { deny("Satchel is empty. Buy a blind lot first."); return; }
    var fee = 2;
    var gain = Math.max(0, it.value - fee);
    state.coins += gain;
    state.satchel.splice(i, 1);
    if (state.satchelCursor >= state.satchel.length) state.satchelCursor = Math.max(0, state.satchel.length - 1);
    sndSell();
    var msg = "Sold " + it.name + " for " + gain + " (fog tax " + fee + "). Coins: " + state.coins + ".";
    log("◉ " + msg, "good");
    say(msg);
    render();
    if (state.satchel.length) focusLoot(state.satchelCursor);
    else { state.zone = "market"; focusStall(state.cursor); }
    checkAutoEnd();
  }

  function deny(msg) {
    sndBad();
    var nodes = elStalls.querySelectorAll(".stall");
    var n = nodes[state.cursor];
    if (n && state.zone === "market") {
      n.classList.remove("shake");
      void n.offsetWidth;
      n.classList.add("shake");
    }
    log("✘ " + msg, "bad");
    say(msg);
  }

  function horn() {
    if (state.over) { say("Market is over. Press R for a new market."); return; }
    if (state.revealed) { say("The horn is still echoing. Look now!"); return; }
    if (state.horns <= 0) { deny("No fog horns left. Trade blind!"); return; }
    state.horns--;
    state.revealed = true;
    document.body.classList.add("revealed");
    elReveal.hidden = false;
    sndHorn();
    var best = -999, bestI = 0;
    state.stalls.forEach(function (s, i) { if (!s.sold && s.value - s.price > best) { best = s.value - s.price; bestI = i; } });
    var tip = state.stalls.some(function (s) { return !s.sold; })
      ? " Best visible deal: stall " + (bestI + 1) + " (" + (best >= 0 ? "+" : "") + best + ")."
      : " All stalls sold — press N for a new day.";
    log("🔊 FOG HORN! Mist lifts for " + REVEAL_SECS + "s. True values exposed." + tip, "horn");
    say("Fog horn! Mist lifts. True values revealed for " + REVEAL_SECS + " seconds." + tip);
    render();
    revealLeft = REVEAL_SECS;
    elRevealT.textContent = String(revealLeft);
    if (revealTimer) window.clearInterval(revealTimer);
    revealTimer = window.setInterval(function () {
      revealLeft--;
      if (revealLeft <= 0) {
        window.clearInterval(revealTimer);
        revealTimer = null;
        state.revealed = false;
        document.body.classList.remove("revealed");
        elReveal.hidden = true;
        log("🌫 Mist rolls back in. Trade blind again.");
        say("Mist rolls back in. Trade blind again.");
        render();
      } else {
        elRevealT.textContent = String(revealLeft);
        render();
      }
    }, 1000);
  }

  function nextDay() {
    if (state.over) return;
    if (state.day >= MAX_DAYS) { endGame(); return; }
    state.day++;
    state.horns = Math.min(START_HORNS, state.horns + 1);
    state.revealed = false;
    document.body.classList.remove("revealed");
    elReveal.hidden = true;
    if (revealTimer) { window.clearInterval(revealTimer); revealTimer = null; }
    restock();
    state.zone = "market";
    sndHorn();
    log("— Day " + state.day + " — distant horn. 5 fresh mist stalls. +1 horn (now " + state.horns + "). Worth: " + worth() + "/" + GOAL + ".");
    say("Day " + state.day + " of " + MAX_DAYS + ". Fresh stalls. Worth " + worth() + " of goal " + GOAL + ".");
    render();
    focusStall(0);
    if (state.day === MAX_DAYS) {
      log("⚠ Final day! Sell everything before pressing N again.");
    }
  }

  function checkAutoEnd() { /* ends only via nextDay past max — keeps keyboard flow explicit */ }

  function endGame() {
    // auto-sell remaining at true value minus tax for final score
    var inv = state.satchel.reduce(function (s, it) { return s + Math.max(0, it.value - 2); }, 0);
    var final = state.coins + inv;
    state.over = true;
    var won = final >= GOAL;
    elFinaleText.textContent = won
      ? "You close the fog with " + final + " coins (goal " + GOAL + "). " + state.tradeCount + " blind trades. The horn salutes you!"
      : "Fog wins. You hold " + final + " coins (goal " + GOAL + ") after " + state.tradeCount + " trades. The mist keeps its secrets.";
    elFinale.hidden = false;
    log(won ? "🏆 GOAL MET: " + final + "/" + GOAL + "!" : "🌫 Market closed: " + final + "/" + GOAL + ".", won ? "good" : "bad");
    say(elFinaleText.textContent + " Press R to trade again.");
    try { if (won) sndBuy(); else sndBad(); } catch (e) { /* ignore */ }
    var again = document.getElementById("btn-again");
    if (again) again.focus();
    render();
  }

  function restart() {
    var keepMute = state.muted;
    state = freshState();
    state.muted = keepMute;
    restock();
    elFinale.hidden = true;
    document.body.classList.remove("revealed");
    elReveal.hidden = true;
    if (revealTimer) { window.clearInterval(revealTimer); revealTimer = null; }
    elLog.innerHTML = "";
    log("🌫 Day 1 at Fog Market. " + START_COINS + " coins. Goal " + GOAL + " in " + MAX_DAYS + " days. Arrows move, Enter buys, H sounds the horn.");
    say("New market. Day 1. " + START_COINS + " coins. Use left and right arrows to browse stalls, Enter to blind-buy, H for fog horn.");
    syncMuteBtn();
    render();
    focusStall(0);
  }

  function toggleMute() {
    state.muted = !state.muted;
    syncMuteBtn();
    say(state.muted ? "Sound off." : "Sound on.");
    if (!state.muted) sndBlip();
  }
  function syncMuteBtn() {
    var b = document.getElementById("btn-mute");
    b.textContent = "";
    b.setAttribute("aria-pressed", state.muted ? "true" : "false");
    var t = document.createTextNode(state.muted ? "Sound: off " : "Sound: on ");
    var k = document.createElement("kbd");
    k.textContent = "M";
    b.appendChild(t); b.appendChild(k);
  }

  function activateFocused() {
    var a = document.activeElement;
    if (!a) return false;
    if (a.classList && a.classList.contains("stall")) { buy(Number(a.dataset.index)); return true; }
    if (a.classList && a.classList.contains("loot")) {
      var loots = elSatchel.querySelectorAll(".loot");
      for (var i = 0; i < loots.length; i++) if (loots[i] === a) { sell(i); return true; }
    }
    return false;
  }

  /* ---------- keyboard (the whole game) ---------- */
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    // Mute / restart / horn / day work from anywhere (except typing — no text inputs exist)
    if (k === "m" || k === "M") { e.preventDefault(); toggleMute(); return; }
    if (k === "r" || k === "R") { e.preventDefault(); ac(); restart(); return; }
    if (k === "h" || k === "H" || k === "f" || k === "F") { e.preventDefault(); ac(); horn(); return; }
    if (k === "n" || k === "N") { e.preventDefault(); ac(); nextDay(); return; }
    if (k === "b" || k === "B") { e.preventDefault(); ac(); state.zone = "market"; buy(state.cursor); focusStall(state.cursor); return; }
    if (k === "v" || k === "V") { e.preventDefault(); ac(); state.zone = "satchel"; sell(state.satchelCursor); return; }

    if (k === "ArrowRight" || k === "d" || k === "D") {
      e.preventDefault(); ac(); sndBlip();
      if (state.zone === "market") { state.cursor = (state.cursor + 1) % state.stalls.length; render(); focusStall(state.cursor); }
      else if (state.satchel.length) { state.satchelCursor = (state.satchelCursor + 1) % state.satchel.length; render(); focusLoot(state.satchelCursor); }
      return;
    }
    if (k === "ArrowLeft" || k === "a" || k === "A") {
      e.preventDefault(); ac(); sndBlip();
      if (state.zone === "market") { state.cursor = (state.cursor + state.stalls.length - 1) % state.stalls.length; render(); focusStall(state.cursor); }
      else if (state.satchel.length) { state.satchelCursor = (state.satchelCursor + state.satchel.length - 1) % state.satchel.length; render(); focusLoot(state.satchelCursor); }
      return;
    }
    if (k === "ArrowDown" || k === "s" || k === "S" || k === "ArrowUp" || k === "w" || k === "W") {
      // Don't hijack S when user meant sell via V; S/W switch rows
      if (k === "s" || k === "S" || k === "w" || k === "W") {
        // allow, these are row-switch keys
      }
      e.preventDefault(); ac(); sndBlip();
      if (state.zone === "market") {
        state.zone = "satchel";
        render();
        if (state.satchel.length) focusLoot(state.satchelCursor);
        else { say("Satchel empty. Buy a blind lot first."); elSatchel.focus(); }
      } else {
        state.zone = "market";
        render();
        focusStall(state.cursor);
      }
      return;
    }
    if ((k === "1" || k === "2" || k === "3" || k === "4" || k === "5") && state.zone !== "satchel") {
      var idx = Number(k) - 1;
      if (idx < state.stalls.length) {
        e.preventDefault(); ac();
        state.zone = "market"; state.cursor = idx; render(); focusStall(idx);
      }
      return;
    }
    if (k === "Enter" || k === " ") {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "BUTTON" && document.activeElement.id && document.activeElement.id.indexOf("btn-") === 0) {
        ac(); // let native button click handle it (buy/horn/day/mute/restart)
        return;
      }
      e.preventDefault(); ac();
      if (state.zone === "market") buy(state.cursor);
      else sell(state.satchelCursor);
      return;
    }
  });

  /* ---------- buttons ---------- */
  document.getElementById("btn-buy").addEventListener("click", function () { state.zone = "market"; buy(state.cursor); focusStall(state.cursor); });
  document.getElementById("btn-horn").addEventListener("click", horn);
  document.getElementById("btn-day").addEventListener("click", nextDay);
  document.getElementById("btn-mute").addEventListener("click", toggleMute);
  document.getElementById("btn-restart").addEventListener("click", restart);
  document.getElementById("btn-again").addEventListener("click", restart);

  /* ---------- boot ---------- */
  elGoal.textContent = String(GOAL);
  restock();
  syncMuteBtn();
  log("🌫 Day 1 at Fog Market. " + START_COINS + " coins. Goal " + GOAL + " in " + MAX_DAYS + " days. Arrows move, Enter buys, H sounds the horn.");
  render();
})();
