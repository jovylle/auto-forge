/* Inkcap Night Market — a grunge mushroom-trading game.
   CSS/canvas only (no images). Plain script so it works from file://.
   Features: fungus stalls · midnight deals · market score (localStorage best). */
(function () {
  'use strict';

  var SAVE_KEY = 'inkcap-night-market-v1';
  var START_COINS = 60;
  var TICK_MS = 3500;          // price twitch interval
  var NIGHT_MS = 90000;        // one full night (23:00 -> 06:00)
  var DEAL_MS = 16000;         // midnight deal window
  var ROT_LIMIT = 6;           // hoarding past this rots overnight

  var SHROOMS = [
    { id: 'inkcap',  name: 'Common Inkcap',    vendor: 'STALL 1 · OLD MOSS',   base: 6,   vol: 0.22, rarity: 'common',   cap: '#5a8a2a', caphi: '#c9f27e', glow: 'rgba(166,255,77,.45)',  capw: '78px', blurb: 'Drips black ink. Writes its own price tags.' },
    { id: 'morel',   name: 'Glow Morel',       vendor: 'STALL 2 · VESPER',     base: 14,  vol: 0.30, rarity: 'uncommon', cap: '#3f9e4d', caphi: '#d6ff7e', glow: 'rgba(166,255,77,.65)',  capw: '66px', blurb: 'Humms in B-flat when prices rise.' },
    { id: 'button',  name: 'Bog Button',       vendor: 'STALL 3 · MIRE SUE',   base: 24,  vol: 0.38, rarity: 'uncommon', cap: '#2e7f8f', caphi: '#9beeff', glow: 'rgba(155,238,255,.6)',  capw: '72px', blurb: 'Smells like rain and bad decisions.' },
    { id: 'wraith',  name: 'Wraith Chanterelle', vendor: 'STALL 4 · PALE JUNE', base: 45,  vol: 0.48, rarity: 'rare',     cap: '#7a4fd0', caphi: '#dcb8ff', glow: 'rgba(183,139,255,.7)',  capw: '88px', blurb: 'Only visible when you stop looking at it.' },
    { id: 'blood',   name: 'Bloodmilk Cap',    vendor: 'STALL 5 · RED IVAN',   base: 80,  vol: 0.60, rarity: 'rare',     cap: '#b03020', caphi: '#ff9a6a', glow: 'rgba(255,122,26,.65)',  capw: '80px', blurb: 'Bleeds red milk. The milk is also currency.' },
    { id: 'void',    name: 'Void Truffle',     vendor: 'STALL 6 · ???',        base: 160, vol: 0.80, rarity: 'mythic',   cap: '#1c1c26', caphi: '#8f8fff', glow: 'rgba(255,210,63,.55)',  capw: '92px', blurb: 'Found once. Whoever found it is gone.' }
  ];

  var RANKS = [
    [0, 'SPORE DRIFTER'], [90, 'CRATE SNIFFER'], [140, 'GILL FLIPPER'],
    [220, 'MIDNIGHT BROKER'], [350, 'MYCELIUM BARON'], [550, 'NIGHT MARKET ROYALTY'], [900, 'MYCELIUM MONARCH']
  ];

  var TICKER_BITS = [
    'FRESH INKCAPS OFF THE DAMP CRATES', 'VOID TRUFFLE SIGHTED — SELLER MISSING',
    'THE HOUSE TAKES 8% ON EVERY SALE', 'HOARDERS BEWARE: CAPS ROT PAST 6 A KIND',
    'MIDNIGHT DEALS STRIKE AT 00:00 SHARP', 'BLOODMILK UP IN STALL 5 (ALLEGEDLY)',
    'NO REFUNDS · NO RECEIPTS · NO QUESTIONS', 'WRAITH CHANTERELLES DENY EXISTENCE'
  ];

  // ---------- state ----------
  var S = {
    coins: START_COINS,
    inv: {},           // id -> qty
    cost: {},          // id -> total paid (for realised profit)
    prices: {}, hist: {},
    stock: {},
    night: 1, nightT: 0, // ms into current night
    trades: 0, deals: 0, realised: 0,
    deal: null, dealT: 0,
    best: null
  };
  SHROOMS.forEach(function (m, i) {
    S.prices[m.id] = m.base;
    S.hist[m.id] = [m.base];
    S.stock[m.id] = 4 + (i % 3);
    S.inv[m.id] = 0; S.cost[m.id] = 0;
  });

  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) S.best = JSON.parse(raw).best || null;
  } catch (e) { /* file:// or private mode: play session-only */ }

  function saveBest() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ best: S.best })); } catch (e) {}
  }

  // ---------- dom ----------
  function $(id) { return document.getElementById(id); }
  var elCoins = $('coins'), elDelta = $('coinsDelta'), elWorth = $('worth'), elRank = $('rank'),
      elClock = $('clock'), elNight = $('nightLabel'), elBest = $('best'),
      elStalls = $('stalls'), elSatchel = $('satchel'), elLog = $('log'),
      elDeal = $('dealBanner'), elDealTitle = $('dealTitle'), elDealText = $('dealText'),
      elDealTimer = $('dealTimer'), elDealFx = $('dealEffect'), elDealGo = $('dealGo'),
      elTrades = $('statTrades'), elDeals = $('statDeals'), elProfit = $('statProfit'), elNights = $('statNights');

  $('ticker').textContent = TICKER_BITS.join(' +++ ') + ' +++ ';

  // ---------- helpers ----------
  function fmt(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)) + '¤'; }
  function fmtSigned(n) { return (n < 0 ? '−' : '+') + Math.abs(Math.round(n)) + '¤'; }
  function priceOf(id) { return S.prices[id]; }
  function bidOf(id) { return Math.max(1, Math.round(S.prices[id] * 0.92)); } // house cut
  function worth() {
    var w = S.coins, k;
    for (k in S.inv) w += S.inv[k] * S.prices[k];
    return w;
  }
  function rankFor(w) {
    var r = RANKS[0][1], i;
    for (i = 0; i < RANKS.length; i++) if (w >= RANKS[i][0]) r = RANKS[i][1];
    return r;
  }
  function log(msg, cls) {
    var li = document.createElement('li');
    if (cls) li.className = cls;
    li.innerHTML = '<span class="t">' + clockStr() + '</span>' + msg;
    elLog.insertBefore(li, elLog.firstChild);
    while (elLog.children.length > 30) elLog.removeChild(elLog.lastChild);
  }
  var toastTimer = null;
  function toast(msg, bad) {
    var t = $('toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 2400);
  }

  // night clock: night runs 23:00 -> 06:00 across NIGHT_MS
  var MID_FRAC = 1 / 7; // 23:00 + 1h = 00:00
  function clockStr() {
    var frac = Math.min(1, S.nightT / NIGHT_MS);
    var mins = 23 * 60 + frac * 7 * 60; // 23:00 + up to 7h
    if (mins >= 24 * 60) mins -= 24 * 60;
    var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function isMidnightWindow() { return S.deal !== null; }

  // ---------- stalls render ----------
  var stallEls = {};
  function rarityLabel(r) {
    return { common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE', mythic: 'MYTHIC' }[r];
  }
  function buildStalls() {
    elStalls.innerHTML = '';
    SHROOMS.forEach(function (m) {
      var d = document.createElement('article');
      d.className = 'stall'; d.id = 'stall-' + m.id;
      d.innerHTML =
        '<div class="vendor">' + m.vendor + '</div>' +
        '<h3>' + m.name + '<span class="rar ' + m.rarity + '">' + rarityLabel(m.rarity) + '</span></h3>' +
        '<div class="shroom" style="--cap:' + m.cap + ';--caphi:' + m.caphi + ';--glow:' + m.glow + ';--capw:' + m.capw + '">' +
        '<div class="m"><div class="stem"></div><div class="gills"></div><div class="cap"></div></div></div>' +
        '<div class="price-row"><span class="price"></span><span class="trend"></span></div>' +
        '<div class="spark" aria-hidden="true"></div>' +
        '<div class="stock"></div><div class="own"></div>' +
        '<div class="buyrow"><button class="buy" type="button">BUY</button>' +
        '<button class="sell" type="button">SELL</button></div>' +
        '<div class="blurb" style="font-size:11px;color:var(--paper-dim);margin-top:6px;font-style:italic">“' + m.blurb + '”</div>';
      var buyBtn = d.querySelector('.buy'), sellBtn = d.querySelector('.sell');
      buyBtn.addEventListener('click', function () { buy(m.id); bump(d); });
      sellBtn.addEventListener('click', function () { sell(m.id); bump(d); });
      elStalls.appendChild(d);
      stallEls[m.id] = { root: d, price: d.querySelector('.price'), trend: d.querySelector('.trend'),
        spark: d.querySelector('.spark'), stock: d.querySelector('.stock'), own: d.querySelector('.own'),
        buy: buyBtn, sell: sellBtn };
    });
  }
  function bump(node) {
    node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
  }

  function renderStalls() {
    SHROOMS.forEach(function (m) {
      var E = stallEls[m.id], p = S.prices[m.id], h = S.hist[m.id];
      var prev = h.length > 1 ? h[h.length - 2] : p;
      E.price.textContent = fmt(p);
      var d = p - prev;
      E.trend.textContent = d > 0 ? '▲ +' + Math.abs(Math.round(d)) : d < 0 ? '▼ −' + Math.abs(Math.round(d)) : '● flat';
      E.trend.className = 'trend ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');
      var mn = Math.min.apply(null, h), mx = Math.max.apply(null, h), rg = Math.max(1, mx - mn);
      E.spark.innerHTML = '';
      h.slice(-12).forEach(function (v, i, a) {
        var bar = document.createElement('i');
        bar.style.height = (4 + ((v - mn) / rg) * 20) + 'px';
        if (i === a.length - 1) bar.className = 'hot';
        E.spark.appendChild(bar);
      });
      E.stock.innerHTML = 'CRATE: <b>' + S.stock[m.id] + '</b> left · bid <b>' + fmt(bidOf(m.id)) + '</b>';
      E.own.textContent = S.inv[m.id] > 0 ? 'YOU HOLD: ' + S.inv[m.id] : '';
      E.buy.disabled = S.stock[m.id] <= 0 || S.coins < p;
      E.sell.disabled = S.inv[m.id] <= 0;
      E.root.classList.toggle('deal-hot', !!(S.deal && S.deal.id === m.id));
    });
  }

  // ---------- satchel / hud ----------
  function renderSatchel() {
    elSatchel.innerHTML = '';
    var any = false;
    SHROOMS.forEach(function (m) {
      var q = S.inv[m.id];
      if (!q) return;
      any = true;
      var li = document.createElement('li');
      li.innerHTML = '<span><span class="dot" style="color:' + m.caphi + '"></span>' + m.name +
        ' × <b>' + q + '</b></span><span class="mono">≈ ' + fmt(q * S.prices[m.id]) + '</span>';
      elSatchel.appendChild(li);
    });
    if (!any) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Empty pockets. The night is young — buy something glowing.';
      elSatchel.appendChild(li);
    }
    $('dumpAll').disabled = !any;
  }

  var lastCoins = START_COINS;
  function renderHud() {
    var w = worth();
    elCoins.textContent = fmt(S.coins);
    elWorth.textContent = fmt(w);
    elRank.textContent = 'RANK: ' + rankFor(w);
    elClock.textContent = clockStr();
      elNight.textContent = 'NIGHT ' + S.night + (isMidnightWindow() ? ' · ★ MIDNIGHT DEAL LIVE' : (S.nightT / NIGHT_MS < MID_FRAC ? ' · PRE-MIDNIGHT' : ' · PAST MIDNIGHT'));
    var dc = S.coins - lastCoins;
    elDelta.textContent = dc === 0 ? '' : (fmtSigned(dc) + ' since tick');
    elDelta.className = 'delta ' + (dc > 0 ? 'up' : dc < 0 ? 'down' : '');
    lastCoins = S.coins;
    elTrades.textContent = S.trades;
    elDeals.textContent = S.deals;
    elProfit.textContent = fmtSigned(S.realised);
    elNights.textContent = (S.night - 1);
    if (S.best === null) { elBest.textContent = '—'; }
    else { elBest.textContent = fmt(S.best); }
    if (w > (S.best || 0)) {
      S.best = Math.round(w);
      saveBest();
      elBest.textContent = fmt(S.best) + ' ★';
    }
  }

  function renderAll() { renderStalls(); renderSatchel(); renderHud(); }

  // ---------- trading ----------
  function effPrice(m, isDealId) {
    if (S.deal && S.deal.id === m.id && S.deal.kind === 'firesale') return S.deal.price;
    return S.prices[m.id];
  }
  function buy(id) {
    var m = SHROOMS.filter(function (x) { return x.id === id; })[0];
    var p = effPrice(m, true);
    if (S.stock[id] <= 0) { toast('Crate is empty. The vendor just shrugs.', true); return; }
    if (S.coins < p) { toast('Not enough coin. The mushrooms laugh.', true); return; }
    S.coins -= p; S.inv[id]++; S.cost[id] += p; S.stock[id]--; S.trades++;
    if (S.deal && S.deal.id === id && S.deal.kind === 'firesale') {
      S.deals++;
      log('MIDNIGHT DEAL caught: <b>' + m.name + '</b> for ' + fmt(p) + '!', 'deal');
      toast('★ MIDNIGHT DEAL: ' + m.name + ' for ' + fmt(p));
      clearDeal(false);
    } else {
      log('Bought <b>' + m.name + '</b> for ' + fmt(p) + '.');
    }
    renderAll();
  }
  function sell(id, silent) {
    var m = SHROOMS.filter(function (x) { return x.id === id; })[0];
    if (S.inv[id] <= 0) { if (!silent) toast('Nothing to sell. Pockets full of lint.', true); return 0; }
    var surge = (S.deal && S.deal.id === id && S.deal.kind === 'frenzy');
    var p = surge ? S.deal.price : bidOf(id);
    S.inv[id]--; S.stock[id]++;
    S.coins += p; S.trades++;
    var avg = S.cost[id] / Math.max(1, S.inv[id] + 1);
    S.realised += (p - avg);
    S.cost[id] = Math.max(0, S.cost[id] - avg);
    if (surge) {
      S.deals++;
      log('MIDNIGHT FRENZY: sold <b>' + m.name + '</b> for ' + fmt(p) + '!', 'deal');
      toast('★ FRENZY SALE: ' + m.name + ' for ' + fmt(p));
      clearDeal(false);
    } else if (!silent) {
      log('Sold <b>' + m.name + '</b> for ' + fmt(p) + (p - avg >= 0 ? ' <span style="color:var(--ok)">(' + fmtSigned(p - avg) + ')</span>' : ' <span style="color:var(--bad)">(' + fmtSigned(p - avg) + ')</span>') + '.', (p - avg >= 0 ? 'good' : 'bad'));
    }
    if (!silent) renderAll();
    return p;
  }

  $('dumpAll').addEventListener('click', function () {
    var total = 0, n = 0;
    SHROOMS.forEach(function (m) { while (S.inv[m.id] > 0) { total += sell(m.id, true); n++; } });
    if (!n) return;
    log('Dumped the whole satchel: <b>' + n + ' caps</b> for ' + fmt(total) + '.', 'good');
    toast('Satchel emptied: ' + fmt(total));
    renderAll();
  });

  // ---------- midnight deals ----------
  var EVENT_FLAVOR = [
    'A bell rings thirteen times. Nobody else hears the thirteenth.',
    'The lanterns gutter. Something in stall 6 smiles.',
    'Rain starts falling UP. Prices disagree about what this means.'
  ];
  function strikeMidnight() {
    var pool = SHROOMS.slice();
    var m = pool[Math.floor(Math.random() * pool.length)];
    var kind = Math.random() < 0.55 ? 'firesale' : 'frenzy';
    if (kind === 'firesale') {
      var fp = Math.max(1, Math.round(S.prices[m.id] * (0.35 + Math.random() * 0.25)));
      S.deal = { id: m.id, kind: kind, price: fp, was: S.prices[m.id] };
      elDealTitle.textContent = 'FIRE SALE: ' + m.name + ' — ' + fmt(fp) + ' (was ' + fmt(S.prices[m.id]) + ')';
      elDealText.textContent = m.vendor + ' is practically giving them away. One crate, one deal, gone when the bell stops.';
      elDealFx.textContent = 'BUY 1 AT ' + fmt(fp);
      elDealGo.textContent = 'GRAB IT →';
    } else {
      var need = 1;
      var sp = Math.round(S.prices[m.id] * (1.5 + Math.random() * 0.6));
      S.deal = { id: m.id, kind: kind, price: sp, need: need };
      elDealTitle.textContent = 'BUYING FRENZY: ' + m.name + ' wanted at ' + fmt(sp);
      elDealText.textContent = 'A cloaked figure at ' + m.vendor + ' pays over the odds — but ONLY if you hold one to sell. ' + (S.inv[m.id] > 0 ? 'You have ' + S.inv[m.id] + '. Move!' : 'You hold NONE. Buy fast, then flip!');
      elDealFx.textContent = 'SELL 1 FOR ' + fmt(sp);
      elDealGo.textContent = S.inv[m.id] > 0 ? 'FLIP IT →' : 'BUY & FLIP →';
    }
    S.dealT = DEAL_MS;
    elDeal.classList.remove('hidden');
    log(EVENT_FLAVOR[Math.floor(Math.random() * EVENT_FLAVOR.length)] + ' <b>MIDNIGHT DEAL:</b> ' + elDealTitle.textContent, 'deal');
    toast('★ MIDNIGHT STRIKES — a deal screams out of the dark!');
    renderStalls();
  }
  function clearDeal(expired) {
    if (expired && S.deal) log('The midnight deal spoils into black sludge. Too slow.', 'bad');
    S.deal = null;
    elDeal.classList.add('hidden');
    renderStalls();
  }
  elDealGo.addEventListener('click', function () {
    if (!S.deal) return;
    if (S.deal.kind === 'firesale') buy(S.deal.id);
    else {
      if (S.inv[S.deal.id] > 0) sell(S.deal.id);
      else { buy(S.deal.id); if (S.deal && S.inv[S.deal.id] > 0) sell(S.deal.id); }
    }
  });

  // ---------- night cycle ----------
  function endNight() {
    // rot: hoards past ROT_LIMIT lose 1 each
    var rotted = [];
    SHROOMS.forEach(function (m) {
      if (S.inv[m.id] > ROT_LIMIT) { S.inv[m.id]--; rotted.push(m.name); }
      // restock crates a little
      S.stock[m.id] = Math.min(9, S.stock[m.id] + 1 + Math.floor(Math.random() * 2));
    });
    S.night++;
    S.nightT = 0;
    if (rotted.length) {
      log('Dawn rot claims one cap each of: <b>' + rotted.join(', ') + '</b>. Stop hoarding.', 'bad');
      toast('Dawn rot! Over-hoarded caps turned to sludge.', true);
    } else {
      log('Night ' + (S.night - 1) + ' closes. The stalls sweep up the glow and start again.', '');
    }
  }

  // ---------- simulation tick ----------
  var lastT = performance.now(), acc = 0;
  function frame(now) {
    var dt = Math.min(250, now - lastT);
    lastT = now;
    S.nightT += dt;
    if (S.deal) {
      S.dealT -= dt;
      var s = Math.max(0, Math.ceil(S.dealT / 1000));
      elDealTimer.textContent = (s < 10 ? '0' : '') + s + 's';
      if (S.dealT <= 0) clearDeal(true);
    }
    acc += dt;
    if (acc >= TICK_MS) { acc = 0; twitch(); }
    // clock + timer repaint (cheap parts only, ~4fps not needed every frame: throttle)
    if (!frame.n || ++frame.n % 20 === 0) {
      elClock.textContent = clockStr();
    elNight.textContent = 'NIGHT ' + S.night + (isMidnightWindow() ? ' · ★ MIDNIGHT DEAL LIVE' : (S.nightT / NIGHT_MS < MID_FRAC ? ' · PRE-MIDNIGHT' : ' · PAST MIDNIGHT'));
    var dc = S.coins - lastCoins;
    }
    // midnight strikes when the clock hits 00:00 (1/7 through the night)
    if (!S.midStruck && S.nightT >= NIGHT_MS / 7) { S.midStruck = true; strikeMidnight(); }
    if (S.nightT >= NIGHT_MS) { S.midStruck = false; if (S.deal) clearDeal(true); endNight(); renderAll(); }
    requestAnimationFrame(frame);
  }

  function twitch() {
    SHROOMS.forEach(function (m) {
      var shock = (Math.random() - 0.5) * 2 * m.vol;
      // rare moon-tide: all glow together
      if (Math.random() < 0.04) shock += 0.35;
      var np = Math.max(1, Math.round(S.prices[m.id] * (1 + shock)));
      // clamp to sane band around base
      np = Math.max(1, Math.min(Math.round(m.base * 4), np));
      if (np < 1) np = 1;
      S.prices[m.id] = np;
      S.hist[m.id].push(np);
      if (S.hist[m.id].length > 24) S.hist[m.id].shift();
    });
    $('tickNote').textContent = 'last twitch ' + new Date().toLocaleTimeString();
    renderAll();
  }

  // ---------- buttons ----------
  $('newRun').addEventListener('click', function () {
    if (!window.confirm('Abandon this night and start fresh with 60¤? (Best score is kept.)')) return;
    S.coins = START_COINS; S.night = 1; S.nightT = 0; S.trades = 0; S.deals = 0; S.realised = 0;
    S.deal = null; S.midStruck = false;
    elDeal.classList.add('hidden');
    SHROOMS.forEach(function (m, i) {
      S.prices[m.id] = m.base; S.hist[m.id] = [m.base];
      S.stock[m.id] = 4 + (i % 3); S.inv[m.id] = 0; S.cost[m.id] = 0;
    });
    lastCoins = START_COINS;
    log('A new night begins. Fresh purse: <b>60¤</b>. The ink is still wet.', '');
    renderAll();
  });
  $('resetSave').addEventListener('click', function () {
    S.best = Math.round(worth());
    saveBest(); renderHud();
    toast('Ledger burned. Best reset to current worth.');
  });

  // ---------- spore canvas (grain + drifting glowing spores) ----------
  var cv = $('spores'), ctx = cv.getContext('2d'), spores = [];
  function sizeCanvas() {
    cv.width = Math.floor(window.innerWidth * Math.min(2, window.devicePixelRatio || 1));
    cv.height = Math.floor(window.innerHeight * Math.min(2, window.devicePixelRatio || 1));
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  var COLORS = ['166,255,77', '183,139,255', '255,210,63', '255,122,26', '155,238,255'];
  function spawn(n) {
    for (var i = 0; i < n; i++) {
      spores.push({
        x: Math.random() * cv.width, y: Math.random() * cv.height,
        r: 1 + Math.random() * 3.2,
        vx: (Math.random() - 0.5) * 0.35, vy: -0.12 - Math.random() * 0.4,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        a: 0.25 + Math.random() * 0.6, ph: Math.random() * 6.28
      });
    }
  }
  spawn(90);
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function paint(t) {
    requestAnimationFrame(paint);
    if (reduced) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var time = (t || 0) / 1000;
    for (var i = 0; i < spores.length; i++) {
      var p = spores[i];
      p.x += p.vx; p.y += p.vy;
      if (p.y < -8) { p.y = cv.height + 8; p.x = Math.random() * cv.width; }
      if (p.x < -8) p.x = cv.width + 8; if (p.x > cv.width + 8) p.x = -8;
      var tw = p.a * (0.6 + 0.4 * Math.sin(time * 2 + p.ph));
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, 'rgba(' + p.c + ',' + tw.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + p.c + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
    }
  })();

  // ---------- go ----------
  buildStalls();
  log('The market creaks open. <b>60¤</b> in your purse. Six stalls, one midnight.', '');
  log('Tip: buy when a sparkline dips, sell the spike. Watch for <b>00:00</b>.', '');
  renderAll();
  requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });
})();
