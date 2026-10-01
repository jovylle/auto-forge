// Dewpoint Diner — a diner that opens at dewpoint.
// Sim: mist cools air toward dew; spread <= 0.5 opens doors; serve guests; tips in jar.
// Social: regulars board persisted to localStorage. Sound: WebAudio, no assets.

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- data ---------- */
  var MENU = [
    { id: 'mist-stack', name: 'Mist Stack', desc: 'buttermilk pancakes, condensed fog, maple drizzle', price: 9, drop: '🥞', pops: 0 },
    { id: 'dew-drop', name: 'Dewdrop Refresher', desc: 'cucumber-mint cooler beaded with ice', price: 5, drop: '🧋', pops: 0 },
    { id: 'foggy-joe', name: 'Foggy Joe', desc: 'bottomless diner coffee, extra steam', price: 3, drop: '☕', pops: 0 },
    { id: 'soggy-bottom', name: 'Soggy-Bottom Omelette', desc: 'three eggs, swiss, deliberately damp hash', price: 11, drop: '🍳', pops: 0 },
    { id: 'condensation', name: 'Condensation Burger', desc: 'double smash, pickles sweating on top', price: 13, drop: '🍔', pops: 0 },
    { id: 'puddle-pie', name: 'Puddle Pie', desc: 'blueberry slice with a glossy rain glaze', price: 7, drop: '🥧', pops: 0 },
    { id: 'drizzle-dog', name: 'Drizzle Dog', desc: 'footlong, mustard zigzag like rain on glass', price: 8, drop: '🌭', pops: 0 },
    { id: 'dawn-special', name: 'Dawn-Patrol Special', desc: 'everything above, served to whoever asks', price: 22, drop: '🌅', pops: 0 }
  ];
  var FACES = ['🧑‍🌾', '👵', '🧔', '👩‍🎤', '🧓', '👨‍🍳', '🧕', '👱', '🧙', '👮'];
  var NAMES = ['Mabel', 'Gus', 'Priya', 'Hank', 'Luz', 'Otis', 'Fern', 'Sal', 'June', 'Abe', 'Nia', 'Cole'];
  var MAXP = 60; // patience seconds

  /* ---------- persisted state ---------- */
  var store = { coins: 0, tips: 0, day: 1, muted: false, regulars: {}, menuPops: {} };
  try {
    var raw = localStorage.getItem('dewpoint-diner-v1');
    if (raw) {
      var s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        if (typeof s.coins === 'number') store.coins = s.coins;
        if (typeof s.tips === 'number') store.tips = s.tips;
        if (typeof s.day === 'number') store.day = s.day;
        if (typeof s.muted === 'boolean') store.muted = s.muted;
        if (s.regulars && typeof s.regulars === 'object') {
          Object.keys(s.regulars).forEach(function (k) {
            var r = s.regulars[k];
            if (r && typeof r === 'object') {
              store.regulars[String(k).slice(0, 24)] = {
                visits: typeof r.visits === 'number' && isFinite(r.visits) ? Math.max(0, Math.floor(r.visits)) : 0,
                liked: r.liked === true,
                face: typeof r.face === 'string' ? r.face.slice(0, 8) : FACES[String(k).length % FACES.length],
                note: typeof r.note === 'string' ? r.note.slice(0, 80) : '',
                fav: typeof r.fav === 'string' ? r.fav.slice(0, 40) : null
              };
            }
          });
        }
        if (s.menuPops && typeof s.menuPops === 'object') store.menuPops = s.menuPops;
      }
    }
  } catch (e) { /* fresh start */ }
  MENU.forEach(function (m) { if (store.menuPops[m.id]) m.pops = store.menuPops[m.id]; });
  function save() {
    try { localStorage.setItem('dewpoint-diner-v1', JSON.stringify(store)); } catch (e) {}
  }

  /* ---------- live sim state (not persisted) ---------- */
  var temp = 18, dew = 12, hum = 55;
  var open = false;
  var seats = [null, null, null, null, null, null]; // 0-3 stools, 4-5 booths
  var guestSeq = 0;

  /* ---------- sound: WebAudio, zero assets ---------- */
  var actx = null;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx && actx.state === 'suspended') { try { var p = actx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    return actx;
  }
  document.addEventListener('pointerdown', function () { ac(); }, { once: true });
  function tone(freq, dur, type, when, slideTo) {
    if (store.muted) return;
    var c = ac(); if (!c) return;
    var t = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var sfx = {
    blip: function () { tone(520, 0.09, 'sine'); },
    seat: function () { // filtered noise thump
      if (store.muted) return;
      var c = ac(); if (!c) return;
      var len = Math.floor(c.sampleRate * 0.08), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      src.connect(f); f.connect(c.destination); src.start();
    },
    serve: function () { tone(659, 0.12, 'sine'); tone(880, 0.16, 'sine', 0.09); },
    tip: function () { tone(900, 0.18, 'triangle', 0, 1800); },
    openFanfare: function () { tone(196, 0.5, 'sawtooth'); tone(262, 0.5, 'sawtooth', 0.05); tone(392, 0.6, 'sine', 0.12); },
    close: function () { tone(330, 0.25, 'sine', 0, 160); },
    mist: function () { tone(300, 0.3, 'sine', 0, 600); }
  };

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- regulars ---------- */
  function getReg(name) {
    if (!store.regulars[name]) store.regulars[name] = { visits: 0, liked: false, face: FACES[name.length % FACES.length], note: '', fav: null };
    return store.regulars[name];
  }
  function renderRegulars() {
    var list = $('regulars-list');
    var names = Object.keys(store.regulars);
    names.sort(function (a, b) {
      var ra = store.regulars[a], rb = store.regulars[b];
      if (ra.liked !== rb.liked) return ra.liked ? -1 : 1;
      return rb.visits - ra.visits;
    });
    list.innerHTML = '';
    if (!names.length) {
      var li = document.createElement('li');
      li.className = 'reg-empty';
      li.textContent = 'No regulars yet — open the doors and the damp will bring them.';
      list.appendChild(li);
      return;
    }
    names.slice(0, 12).forEach(function (name) {
      var r = store.regulars[name];
      var li = document.createElement('li');
      li.className = 'reg';
      var av = document.createElement('span');
      av.className = 'avatar'; av.textContent = r.face;
      var who = document.createElement('span');
      who.className = 'who';
      var nm = document.createElement('div');
      nm.className = 'name'; nm.textContent = name;
      var nt = document.createElement('div');
      nt.className = 'note';
      nt.textContent = (r.fav ? 'loves the ' + r.fav + ' · ' : '') + (r.note || (r.visits + (r.visits === 1 ? ' visit' : ' visits')));
      who.appendChild(nm); who.appendChild(nt);
      var vs = document.createElement('span');
      vs.className = 'visits'; vs.textContent = '×' + r.visits;
      var like = document.createElement('button');
      like.type = 'button';
      like.className = 'like-btn' + (r.liked ? ' liked' : '');
      like.textContent = r.liked ? '♥' : '♡';
      like.setAttribute('aria-label', (r.liked ? 'Unpin ' : 'Pin ') + name);
      like.addEventListener('click', function () {
        r.liked = !r.liked; save(); renderRegulars(); sfx.blip();
      });
      li.appendChild(av); li.appendChild(who); li.appendChild(vs); li.appendChild(like);
      list.appendChild(li);
    });
  }
  $('regular-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('regular-name').value.trim().slice(0, 24);
    var note = $('regular-note').value.trim().slice(0, 80);
    if (!name) { toast('Give the regular a name first.'); return; }
    var r = getReg(name);
    if (note) r.note = note;
    save(); renderRegulars(); sfx.seat();
    $('regular-name').value = ''; $('regular-note').value = '';
    toast(name + ' is pinned on the board.');
  });

  /* ---------- menu ---------- */
  function renderMenu() {
    var ul = $('menu-list');
    ul.innerHTML = '';
    MENU.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'dish';
      var drop = document.createElement('span');
      drop.className = 'drop'; drop.textContent = m.drop;
      var info = document.createElement('div');
      info.className = 'info';
      var nm = document.createElement('div');
      nm.className = 'name'; nm.textContent = m.name;
      var ds = document.createElement('div');
      ds.className = 'desc'; ds.textContent = m.desc;
      info.appendChild(nm); info.appendChild(ds);
      var pr = document.createElement('span');
      pr.className = 'price'; pr.textContent = '₵' + m.price;
      var pp = document.createElement('span');
      pp.className = 'pops';
      pp.textContent = m.pops > 0 ? '❋×' + m.pops : 'new';
      li.appendChild(drop); li.appendChild(info); li.appendChild(pp); li.appendChild(pr);
      ul.appendChild(li);
    });
  }

  /* ---------- floor ---------- */
  function seatLabel(i) { return i < 4 ? 'STOOL ' + (i + 1) : 'BOOTH ' + (i - 3); }
  function renderFloor() {
    [['stools', 0], ['booths', 4]].forEach(function (pair) {
      var box = $(pair[0]);
      box.innerHTML = '';
      for (var k = 0; k < (pair[0] === 'stools' ? 4 : 2); k++) {
        (function (i) {
          var g = seats[i];
          var d = document.createElement('div');
          d.className = 'seat' + (g ? ' occupied' : '');
          if (!g) {
            d.innerHTML = '<small>' + seatLabel(i) + '</small><span class="face">·</span><small>empty</small>';
          } else {
            var pct = Math.max(0, Math.round((g.pat / MAXP) * 100));
            d.innerHTML = '<small>' + seatLabel(i) + '</small>' +
              '<span class="face">' + escapeHtml(g.face) + '</span>' +
              '<span class="who">' + escapeHtml(g.name) + '</span>' +
              '<span class="order">' + escapeHtml(g.dish.name) + ' · ₵' + g.dish.price + '</span>' +
              '<span class="pat"><i style="width:' + pct + '%"></i></span>';
            d.setAttribute('role', 'button');
            d.setAttribute('tabindex', '0');
            d.setAttribute('aria-label', 'Serve ' + g.name + ' their ' + g.dish.name);
            var serve = function () { serveGuest(i); };
            d.addEventListener('click', serve);
            d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); serve(); } });
          }
          box.appendChild(d);
        })(pair[1] + k);
      }
    });
    renderRail();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderRail() {
    var rail = $('rail');
    rail.innerHTML = '';
    var waiting = seats.filter(Boolean);
    if (!waiting.length) {
      var p = document.createElement('p');
      p.className = 'rail-empty';
      p.textContent = open ? 'ticket rail is clear — no orders hanging' : 'doors closed — the rail is wiped down';
      rail.appendChild(p);
      return;
    }
    waiting.forEach(function (g) {
      var t = document.createElement('span');
      t.className = 'ticket';
      t.textContent = g.name + ' → ' + g.dish.name;
      rail.appendChild(t);
    });
  }

  function spawnGuest() {
    var free = [];
    for (var i = 0; i < seats.length; i++) if (!seats[i]) free.push(i);
    if (!free.length) return;
    var i = free[Math.floor(Math.random() * free.length)];
    var newcomer = Math.random() < 0.35 || !Object.keys(store.regulars).length;
    var name = newcomer
      ? NAMES[Math.floor(Math.random() * NAMES.length)] + (Math.random() < 0.4 ? '-' + (++guestSeq) : '')
      : Object.keys(store.regulars)[Math.floor(Math.random() * Object.keys(store.regulars).length)];
    var dish = MENU[Math.floor(Math.random() * MENU.length)];
    var reg = getReg(name);
    if (!reg.face) reg.face = FACES[Math.floor(Math.random() * FACES.length)];
    seats[i] = { name: name, face: reg.face, dish: dish, pat: MAXP };
    sfx.seat();
    renderFloor();
  }

  function serveGuest(i) {
    var g = seats[i];
    if (!g) return;
    var warmth = Math.max(0, Math.min(1, g.pat / MAXP));
    var tip = Math.round(g.dish.price * (0.05 + warmth * 0.45));
    store.coins += g.dish.price + tip;
    store.tips += tip;
    g.dish.pops += 1;
    store.menuPops[g.dish.id] = g.dish.pops;
    var reg = getReg(g.name);
    reg.visits += 1;
    if (!reg.fav || Math.random() < 0.3) reg.fav = g.dish.name;
    seats[i] = null;
    save();
    sfx.serve();
    setTimeout(sfx.tip, 180);
    var jar = document.querySelector('.jar');
    if (jar) { jar.classList.remove('bump'); void jar.offsetWidth; jar.classList.add('bump'); }
    $('coins').textContent = store.coins;
    $('tips').textContent = store.tips;
    renderFloor(); renderMenu(); renderRegulars();
    var seatEl = (i < 4 ? $('stools') : $('booths')).children[i < 4 ? i : i - 4];
    if (seatEl) { seatEl.classList.add('served'); }
    toast(g.name + ' served · +' + '₵' + (g.dish.price + tip) + (tip > 0 ? ' (tip ₵' + tip + ')' : ''));
  }

  /* ---------- dewpoint climate ---------- */
  function tickClimate() {
    // night falls: air cools toward ~9°, dew drifts with humidity
    temp += (9.5 - temp) * 0.006 + (Math.random() - 0.5) * 0.06;
    dew += ((hum - 55) * 0.045 + 9 - dew) * 0.01;
    hum += (Math.random() - 0.42) * 0.35; // slow natural rise
    hum = Math.max(30, Math.min(99, hum));
    var spread = temp - dew;
    var shouldOpen = spread <= 0.5;
    if (shouldOpen && !open) {
      open = true;
      document.body.classList.add('open-dawn');
      $('open-sign').className = 'open-sign open';
      $('open-sign').querySelector('.neon').textContent = 'OPEN';
      $('dawn-btn').hidden = false;
      sfx.openFanfare();
      toast('Dewpoint reached — doors are OPEN.');
    } else if (!shouldOpen && open && spread > 1.2) {
      open = false;
      document.body.classList.remove('open-dawn');
      $('open-sign').className = 'open-sign closed';
      $('dawn-btn').hidden = true;
      sfx.close();
      toast('Air dried out — doors closed.');
    }
    // guests arrive / lose patience
    if (open && Math.random() < 0.09) spawnGuest();
    var changed = false;
    for (var i = 0; i < seats.length; i++) {
      if (seats[i]) {
        seats[i].pat -= 1;
        if (seats[i].pat <= 0) {
          var g = seats[i];
          seats[i] = null;
          toast(g.name + ' walked out thirsty…');
          changed = true;
        }
      }
    }
    if (changed) renderFloor();
    else {
      // refresh patience bars cheaply
      var bars = document.querySelectorAll('.seat .pat i');
      var idx = 0;
      for (var j = 0; j < seats.length; j++) {
        if (seats[j] && bars[idx]) bars[idx].style.width = Math.max(0, Math.round((seats[j].pat / MAXP) * 100)) + '%';
        if (seats[j]) idx++;
      }
    }
    renderMeter(spread);
  }

  function renderMeter(spread) {
    $('r-temp').textContent = temp.toFixed(1);
    $('r-dew').textContent = dew.toFixed(1);
    $('r-spread').textContent = Math.max(0, spread).toFixed(1);
    $('r-hum').textContent = Math.round(hum);
    var tube = document.querySelector('.tube');
    // fill = closeness to dew (0 spread -> full)
    var closeness = Math.max(0, Math.min(1, 1 - spread / 8));
    tube.style.setProperty('--fill', Math.round(8 + closeness * 92) + '%');
    tube.style.setProperty('--dew', '88%'); // the line the mist must reach
    tube.classList.toggle('dew', open);
  }

  $('mist-btn').addEventListener('click', function () {
    hum = Math.min(99, hum + 6);
    temp = Math.max(7, temp - 0.7);
    dew = Math.min(temp + 0.4, dew + 0.9);
    sfx.mist();
    tickClimate();
  });
  $('heat-btn').addEventListener('click', function () {
    temp = Math.min(24, temp + 1.2);
    hum = Math.max(30, hum - 4);
    sfx.blip();
    tickClimate();
  });
  $('dawn-btn').addEventListener('click', function () {
    store.day += 1;
    $('day-num').textContent = store.day;
    temp = 18; dew = 12; hum = 55;
    seats = [null, null, null, null, null, null];
    $('dawn-btn').hidden = true;
    save(); renderFloor(); sfx.close();
    toast('Closed up. Night ' + store.day + ' — fresh dry air.');
  });
  $('mute-btn').addEventListener('click', function () {
    store.muted = !store.muted;
    save();
    $('mute-btn').setAttribute('aria-pressed', String(store.muted));
    if (!store.muted) sfx.blip();
  });

  /* ---------- init ---------- */
  $('coins').textContent = store.coins;
  $('tips').textContent = store.tips;
  $('day-num').textContent = store.day;
  $('mute-btn').setAttribute('aria-pressed', String(store.muted));
  if (!Object.keys(store.regulars).length) {
    ['Mabel', 'Gus', 'Priya'].forEach(function (n, k) {
      store.regulars[n] = { visits: 2 - (k === 2 ? 1 : 0), liked: k === 0, face: FACES[(k * 3 + 1) % FACES.length], note: k === 0 ? 'takes extra mist' : '', fav: k === 0 ? 'Foggy Joe' : null };
    });
    save();
  }
  renderMenu(); renderRegulars(); renderFloor(); renderMeter(temp - dew);
  setInterval(tickClimate, 1000);
})();
