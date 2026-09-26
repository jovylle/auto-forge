/* Glasswing Market — a cottagecore trading game.
   Glass stalls · wing trade · market score. No build, no backend.
   Progress persists in localStorage. */
(function () {
  "use strict";

  var SAVE_KEY = "glasswing-market-save-v1";
  var BEST_KEY = "glasswing-market-best-v1";
  var LAST_DAY = 7;

  var GOODS = [
    { id: "shard",   name: "Glasswing Shard",    rar: "common",    base: 6,  hue: 175, desc: "a pane of wing, light as breath" },
    { id: "lace",    name: "Dewdrop Lacewing",   rar: "common",    base: 9,  hue: 195, desc: "morning dew spun into lace" },
    { id: "suncap",  name: "Petalwing Suncap",   rar: "uncommon",  base: 14, hue: 35,  desc: "petals pressed with pollen gold" },
    { id: "moss",    name: "Mossfall Chrysalis", rar: "uncommon",  base: 18, hue: 110, desc: "a cocoon nested in soft moss" },
    { id: "honey",   name: "Honeyveil Swallowtail", rar: "rare",   base: 26, hue: 45,  desc: "amber wings, honey-glazed" },
    { id: "fern",    name: "Fernskipper Trinket",rar: "rare",      base: 32, hue: 140, desc: "a fern-curled keepsake" },
    { id: "moon",    name: "Moonmoth Lantern",   rar: "mythic",    base: 45, hue: 265, desc: "glows faintly after dusk" },
    { id: "amber",   name: "Amber Skipper Jam",  rar: "mythic",    base: 60, hue: 15,  desc: "sealed in a thimble of amber" }
  ];

  var STALLS = [
    { id: "bramble", name: "Bramble & Dew",      keeper: "Old Maren",   awning: "#8aa37e", blurb: "Foraged goods, still cool from the hedgerow.", goods: ["shard", "lace", "moss"] },
    { id: "petal",   name: "Petalwing Pantry",   keeper: "Sister Wren", awning: "#c9837b", blurb: "Preserves, suncaps & sweet things.",            goods: ["suncap", "honey", "amber"] },
    { id: "chrys",   name: "Chrysalis Curios",   keeper: "Tommick",     awning: "#7fa3b8", blurb: "Odd cocoons, stranger stories. No refunds.",    goods: ["moss", "fern", "moon"] },
    { id: "moonmoth",name: "Moonmoth Provisions",keeper: "Auntie Vesper",awning: "#9a86b8", blurb: "Night-market wares for patient collectors.",   goods: ["lace", "moon", "amber"] }
  ];

  var VILLAGERS = ["Baker Poppy", "Miller Ash", "Weaver Linnet", "Beekeeper Bram", "Herbalist Rue", "Fiddler Nettle", "Dyer Sorrel", "Shepherd Tam"];

  var QUIPS = {
    charmed: ["“For you, friend — a kinder price.”", "“Ah, you flatter an old keeper!”", "“Fine, fine… the wings whisper yes.”"],
    annoyed: ["“Hmph! The price RISES for cheek.”", "“My wings, my rules.”", "“Ask again tomorrow, magpie.”"]
  };

  function goodById(id) {
    for (var i = 0; i < GOODS.length; i++) if (GOODS[i].id === id) return GOODS[i];
    return null;
  }

  /* deterministic-ish daily randomness so reloads keep the same market day */
  function rand(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function wingSVG(hue, size) {
    var w = size || 40, h = Math.round((size || 40) * 0.85);
    return '<svg class="wing" width="' + w + '" height="' + h + '" viewBox="0 0 100 85" aria-hidden="true">' +
      '<g fill="hsla(' + hue + ',55%,78%,.65)" stroke="hsl(' + hue + ',35%,42%)" stroke-width="3">' +
      '<ellipse cx="30" cy="30" rx="26" ry="21" transform="rotate(-24 30 30)"/>' +
      '<ellipse cx="70" cy="30" rx="26" ry="21" transform="rotate(24 70 30)"/>' +
      '<ellipse cx="37" cy="63" rx="15" ry="11" transform="rotate(-14 37 63)"/>' +
      '<ellipse cx="63" cy="63" rx="15" ry="11" transform="rotate(14 63 63)"/>' +
      "</g>" +
      '<rect x="47.5" y="14" width="5" height="58" rx="2.5" fill="#5c4a33"/>' +
      '<circle cx="50" cy="11" r="4.5" fill="#5c4a33"/>' +
      '<circle cx="38" cy="34" r="4" fill="hsla(' + hue + ',70%,92%,.9)"/>' +
      '<circle cx="62" cy="34" r="4" fill="hsla(' + hue + ',70%,92%,.9)"/>' +
      "</svg>";
  }

  function defaultState() {
    return {
      day: 1,
      coins: 42,
      renown: 0,
      inv: { shard: 2, lace: 1 },
      seen: { shard: true, lace: true },
      prices: {},   // stallId -> { goodId -> {buy, sell, trend} }
      stock: {},    // stallId -> { goodId -> n }
      charmed: {},  // stallId -> 'up' | 'down' (haggle result today)
      haggled: {},  // stallId -> true (used haggle today)
      orders: [],   // {id, villager, goodId, qty, reward, renown}
      orderSeq: 0,
      over: false
    };
  }

  var state = load() || defaultState();
  if (!state.prices || !state.prices.bramble) genDayMarket();

  function genDayMarket() {
    var r = rand(1234 + state.day * 777 + state.orderSeq);
    STALLS.forEach(function (st) {
      if (!state.prices[st.id]) state.prices[st.id] = {};
      if (!state.stock[st.id]) state.stock[st.id] = {};
      st.goods.forEach(function (gid) {
        var g = goodById(gid);
        var prev = state.prices[st.id][gid];
        var prevBuy = prev ? prev.buy : g.base;
        var drift = 0.78 + r() * 0.5; // 0.78x .. 1.28x
        var buy = Math.max(2, Math.round(g.base * drift));
        if (state.charmed[st.id] === "down") buy = Math.max(2, Math.round(buy * 0.85));
        if (state.charmed[st.id] === "up") buy = Math.round(buy * 1.05);
        var sell = Math.max(1, Math.round(buy * 0.72));
        var trend = buy > prevBuy ? "up" : buy < prevBuy ? "down" : "flat";
        state.prices[st.id][gid] = { buy: buy, sell: sell, trend: trend };
        if (state.stock[st.id][gid] == null || state.dayChanged) {
          state.stock[st.id][gid] = 2 + Math.floor(r() * 4); // 2..5
        }
      });
      state.haggled[st.id] = false;
    });
    state.dayChanged = false;
    // keep 3 open orders, top up
    while (state.orders.length < 3) state.orders.push(makeOrder(r));
  }

  function makeOrder(r) {
    state.orderSeq += 1;
    var g = GOODS[Math.floor(r() * GOODS.length)];
    var qty = g.rar === "common" ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
    var reward = Math.round(g.base * qty * (1.25 + r() * 0.5));
    var ren = (g.rar === "mythic" ? 6 : g.rar === "rare" ? 4 : g.rar === "uncommon" ? 3 : 2) + Math.floor(r() * 2);
    return {
      id: "o" + state.orderSeq + "d" + state.day,
      villager: VILLAGERS[Math.floor(r() * VILLAGERS.length)],
      goodId: g.id, qty: qty, reward: reward, renown: ren
    };
  }

  /* ---------- persistence ---------- */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s.day !== "number" || s.over) return null;
      return s;
    } catch (e) { return null; }
  }
  function best() {
    try { return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) { return 0; }
  }
  function setBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {}
  }

  /* ---------- ui helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg, kind) {
    var box = $("toasts");
    var el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.classList.add("out"); }, 2400);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
  }
  function popHud(id) {
    var el = $(id);
    if (!el) return;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }
  function trendArrow(t) {
    if (t === "up") return '<span class="trend up" title="pricier than yesterday">▲</span>';
    if (t === "down") return '<span class="trend down" title="cheaper than yesterday">▼</span>';
    return '<span class="trend flat" title="steady">•</span>';
  }

  /* ---------- actions ---------- */
  function buy(stallId, gid) {
    var p = state.prices[stallId][gid];
    var left = state.stock[stallId][gid] || 0;
    if (left <= 0) { toast("Sold out at this stall — come back tomorrow.", "bad"); return; }
    if (state.coins < p.buy) { toast("Not enough dew coins for that.", "bad"); return; }
    state.coins -= p.buy;
    state.stock[stallId][gid] = left - 1;
    state.inv[gid] = (state.inv[gid] || 0) + 1;
    state.seen[gid] = true;
    save(); render();
    popHud("hud-coins");
    toast("Bought " + goodById(gid).name + " for " + p.buy + " dew.", "good");
  }

  function sell(gid) {
    if ((state.inv[gid] || 0) <= 0) return;
    // best stall bid for this good
    var bestBid = 0, bestStall = null;
    STALLS.forEach(function (st) {
      var p = state.prices[st.id] && state.prices[st.id][gid];
      if (p && p.sell > bestBid) { bestBid = p.sell; bestStall = st; }
    });
    if (!bestStall) { toast("No stall buys that today.", "bad"); return; }
    state.inv[gid] -= 1;
    state.coins += bestBid;
    state.renown += 1;
    save(); render();
    popHud("hud-coins"); popHud("hud-renown");
    toast("Sold " + goodById(gid).name + " to " + bestStall.name + " (+" + bestBid + " dew, +1 renown).", "good");
  }

  function haggle(stallId) {
    if (state.haggled[stallId]) return;
    state.haggled[stallId] = true;
    var r = rand(Date.now() % 2147483647 + stallId.length * 991);
    var luck = r();
    var st = STALLS.filter(function (s) { return s.id === stallId; })[0];
    if (luck < 0.6) {
      state.charmed[stallId] = "down";
      Object.keys(state.prices[stallId]).forEach(function (gid) {
        state.prices[stallId][gid].buy = Math.max(2, Math.round(state.prices[stallId][gid].buy * 0.85));
      });
      state.renown += 1;
      toast(st.name + " — " + QUIPS.charmed[Math.floor(luck * 10) % 3] + " Prices fall 15%.", "good");
    } else {
      state.charmed[stallId] = "up";
      Object.keys(state.prices[stallId]).forEach(function (gid) {
        state.prices[stallId][gid].buy = Math.round(state.prices[stallId][gid].buy * 1.05);
      });
      toast(st.name + " — " + QUIPS.annoyed[Math.floor(luck * 10) % 3], "bad");
    }
    save(); render();
    popHud("hud-renown");
  }

  function fillOrder(oid) {
    var idx = -1;
    for (var i = 0; i < state.orders.length; i++) if (state.orders[i].id === oid) idx = i;
    if (idx < 0) return;
    var o = state.orders[idx];
    if ((state.inv[o.goodId] || 0) < o.qty) {
      toast("You need " + o.qty + "× " + goodById(o.goodId).name + " — the stalls may have some.", "bad");
      return;
    }
    state.inv[o.goodId] -= o.qty;
    state.coins += o.reward;
    state.renown += o.renown;
    state.orders.splice(idx, 1);
    var r = rand(Date.now() % 2147483647 + state.orderSeq * 131);
    if (state.orders.length < 3) state.orders.push(makeOrder(r));
    save(); render();
    popHud("hud-coins"); popHud("hud-renown");
    toast(o.villager + " is delighted! +" + o.reward + " dew, +" + o.renown + " renown.", "good");
  }

  function nextDay() {
    if (state.day >= LAST_DAY) { finale(); return; }
    state.day += 1;
    state.dayChanged = true;
    state.charmed = {};
    genDayMarket();
    save(); render();
    toast("Day " + state.day + " dawns. New prices, new stock, new wishes.", "good");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function rankFor(score) {
    if (score >= 900) return "Glasswing Royalty";
    if (score >= 600) return "Master of the Market";
    if (score >= 400) return "Beloved Trader";
    if (score >= 250) return "Stallfriend";
    if (score >= 120) return "Peddler of Petals";
    return "Wandering Forager";
  }

  function scoreOf() {
    var coll = Object.keys(state.seen).length;
    return { coins: state.coins, ren: state.renown * 10, coll: coll * 15, collN: coll, total: state.coins + state.renown * 10 + coll * 15 };
  }

  function finale() {
    state.over = true;
    var s = scoreOf();
    var prevBest = best();
    var isBest = s.total > prevBest;
    if (isBest) setBest(s.total);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    $("t-coins").textContent = s.coins;
    $("t-renown").textContent = s.ren + " (" + state.renown + ")";
    $("t-coll").textContent = "+" + s.coll + " (" + s.collN + "/8)";
    $("t-score").textContent = s.total;
    $("finale-title-rank").textContent = rankFor(s.total);
    $("finale-note").textContent = isBest
      ? "A new legend! Best market score yet."
      : "Best market score so far: " + prevBest + ". The wings remember you kindly.";
    $("finale").classList.remove("hidden");
    renderBest();
  }

  function newGame() {
    state = defaultState();
    genDayMarket();
    save(); render();
    $("finale").classList.add("hidden");
    toast("A new season opens. 42 dew coins and an empty satchel — make them sing.", "good");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- render ---------- */
  function render() {
    $("hud-day").textContent = state.day;
    $("hud-coins").textContent = state.coins;
    $("hud-renown").textContent = state.renown;
    $("hud-coll").textContent = Object.keys(state.seen).length;
    var bell = $("btn-bell");
    bell.innerHTML = state.day >= LAST_DAY
      ? "🔔 Close the market <small>final tally</small>"
      : "🔔 Ring the bell <small>day " + state.day + " → " + (state.day + 1) + "</small>";

    // stalls
    var sh = "";
    STALLS.forEach(function (st) {
      sh += '<article class="stall" style="--awning:' + st.awning + '">';
      sh += '<div class="stall-head"><h3>' + esc(st.name) + '</h3>';
      sh += '<p class="keeper">kept by ' + esc(st.keeper) + '</p>';
      sh += '<p class="blurb">' + esc(st.blurb) + '</p></div><div class="goods">';
      st.goods.forEach(function (gid) {
        var g = goodById(gid);
        var p = state.prices[st.id][gid];
        var left = state.stock[st.id][gid] || 0;
        var can = left > 0 && state.coins >= p.buy;
        sh += '<div class="good">' + wingSVG(g.hue) +
          '<div><div class="good-name">' + esc(g.name) + ' ' + trendArrow(p.trend) +
          ' <span class="rar">' + g.rar + '</span></div>' +
          '<div class="good-sub">' + esc(g.desc) + '</div>' +
          '<div class="stock">' + (left > 0 ? left + " on the shelf · buys back " + p.sell : "sold out today") + "</div></div>" +
          '<div class="good-buy"><span class="price">' + p.buy + ' dew</span>' +
          '<button class="buy-btn" data-buy="' + st.id + "|" + gid + '"' + (can ? "" : " disabled") + ">" +
          (left <= 0 ? "Gone" : "Buy") + "</button></div></div>";
      });
      sh += "</div>";
      var hg = state.haggled[st.id];
      sh += '<div class="haggle-row"><button class="haggle-btn" data-haggle="' + st.id + '"' + (hg ? " disabled" : "") + ">" +
        (hg ? (state.charmed[st.id] === "down" ? "✿ Charmed!" : "Annoyed…") : "✿ Haggle") + "</button>" +
        '<span class="haggle-note' + (state.charmed[st.id] === "down" ? " charmed" : "") + '">' +
        (hg ? (state.charmed[st.id] === "down" ? "15% off today" : "prices +5%… oops") : "once per stall, per day") + "</span></div>";
      sh += "</article>";
    });
    $("stalls").innerHTML = sh;

    // orders
    var oh = "";
    if (!state.orders.length) oh = '<div class="empty">The board is bare — every wish fulfilled. ❧</div>';
    state.orders.forEach(function (o) {
      var g = goodById(o.goodId);
      var have = state.inv[o.goodId] || 0;
      var ok = have >= o.qty;
      oh += '<div class="order"><p><span class="villager">' + esc(o.villager) + "</span> wishes for " +
        o.qty + "× " + wingSVG(g.hue, 26) + " <strong>" + esc(g.name) + "</strong> " +
        "(you hold " + have + ")</p>" +
        '<div class="order-foot"><span class="reward">+' + o.reward + " dew · +" + o.renown + ' renown</span>' +
        '<button class="fill-btn" data-fill="' + o.id + '"' + (ok ? "" : " disabled") + ">" +
        (ok ? "Deliver" : "Need more") + "</button></div></div>";
    });
    $("orders").innerHTML = oh;

    // satchel
    var keys = Object.keys(state.inv).filter(function (k) { return state.inv[k] > 0; });
    var sath = "";
    if (!keys.length) sath = '<div class="empty">Empty satchel. The stalls glitter — go browse. ❧</div>';
    keys.forEach(function (gid) {
      var g = goodById(gid);
      var bestBid = 0;
      STALLS.forEach(function (st) {
        var p = state.prices[st.id] && state.prices[st.id][gid];
        if (p && p.sell > bestBid) bestBid = p.sell;
      });
      sath += '<div class="satchel-row">' + wingSVG(g.hue) +
        '<div><div class="good-name">' + esc(g.name) + ' <span class="rar">' + g.rar + "</span></div>" +
        '<div class="good-sub">' + esc(g.desc) + '</div></div>' +
        '<div class="sell-box"><span class="qty">' + state.inv[gid] + " <small>held</small></span>" +
        (bestBid > 0
          ? '<button class="sell-btn" data-sell="' + gid + '">Sell ' + bestBid + "</button>"
          : '<span class="sell-price">no buyer today</span>') +
        "</div></div>";
    });
    var totalHeld = keys.reduce(function (a, k) { return a + state.inv[k]; }, 0);
    sath += '<div class="satchel-total">' + totalHeld + " treasures nestled in fern leaves</div>";
    $("satchel").innerHTML = sath;
  }

  function renderBest() {
    var b = best();
    $("best").textContent = b > 0 ? b : "—";
  }

  /* ---------- events (delegated, file:// safe) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var b = t.getAttribute("data-buy");
    if (b) { var parts = b.split("|"); buy(parts[0], parts[1]); return; }
    var s = t.getAttribute("data-sell");
    if (s) { sell(s); return; }
    var f = t.getAttribute("data-fill");
    if (f) { fillOrder(f); return; }
    var h = t.getAttribute("data-haggle");
    if (h) { haggle(h); return; }
  });
  $("btn-bell").addEventListener("click", nextDay);
  $("btn-new").addEventListener("click", function () {
    if (state.day === 1 && state.coins === 42 && state.renown === 0) return;
    newGame();
  });
  $("btn-again").addEventListener("click", newGame);

  renderBest();
  render();
})();
