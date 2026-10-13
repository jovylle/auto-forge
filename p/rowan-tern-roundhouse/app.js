/* Rowan Tern Roundhouse — a click-only vaporwave harbor game.
   Calm the terns (click) so each scheduled spin finds a STABLE bird.
   Easter egg: the sun is watching. Click it 7 times. */
(function () {
  'use strict';

  var SPIN_EVERY = 14;          // seconds per spin
  var NEED = 3;                 // feathers for STABLE
  var DECAY_EVERY = 8;          // seconds per feather decay
  var ORDER = [0, 3, 6, 1, 4, 7, 2, 5]; // spin rotation order
  var NAMES = ['ROWAN', 'ZEPHYR', 'CORAL', 'MISTRAL', 'VESPER', 'HALCYON', 'SORA', 'NAMI'];
  var HUES = [320, 185, 15, 265, 120, 205, 55, 150];
  var RANKS = [
    [0, 'Driftwood'], [300, 'Foam'], [800, 'Spray'], [1500, 'Swell'],
    [2500, 'Tidecaller'], [4000, 'Harbormaster'], [6000, 'Neon Legend']
  ];
  var BEST_KEY = 'rowan-tern-best-v1';
  var EGG_KEY = 'rowan-tern-egg-v1';

  // ---------- state ----------
  var terns = NAMES.map(function (n, i) {
    return { name: n, hue: HUES[i], calm: i % 3 === 0 ? 2 : 1, cool: 0 };
  });
  var score = 0, streak = 0, good = 0, total = 0, spinIndex = 0;
  var best = 0, eggFound = false, midnight = false;
  var spinAt = Date.now() + SPIN_EVERY * 1000;
  var lastDecay = Date.now();
  var soundOn = true, rot = 0, bursting = 0;
  try {
    best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    eggFound = localStorage.getItem(EGG_KEY) === '1';
  } catch (e) { /* file:// privacy mode: play without persistence */ }

  // ---------- dom ----------
  function $(id) { return document.getElementById(id); }
  var house = $('house'), disc = $('disc'), hubTimer = $('hubTimer'),
      scoreEl = $('score'), rankEl = $('rank'), streakEl = $('streak'),
      goodEl = $('good'), totalEl = $('total'), bestEl = $('best'),
      tideEl = $('tide'), clockEl = $('clock'), schedEl = $('schedule'),
      logEl = $('log'), popEl = $('pop'), toasts = $('toasts'),
      sun = $('sun'), midnightEl = $('midnight');

  // ---------- audio (tiny synth blips, click-only world) ----------
  var AC = null;
  function beep(freq, dur, type, vol) {
    if (!soundOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + (dur || 0.15));
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + (dur || 0.15));
    } catch (e) { /* no audio, no problem */ }
  }

  // ---------- helpers ----------
  function log(msg, cls) {
    var li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = msg;
    logEl.insertBefore(li, logEl.firstChild);
    while (logEl.children.length > 24) logEl.removeChild(logEl.lastChild);
  }
  function toast(msg, gold) {
    var d = document.createElement('div');
    d.className = 'toast' + (gold ? ' gold' : '');
    d.textContent = msg;
    toasts.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }
  function rankFor(s) {
    var r = RANKS[0][1];
    for (var i = 0; i < RANKS.length; i++) if (s >= RANKS[i][0]) r = RANKS[i][1];
    return r;
  }
  function saveBest() {
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    bestEl.textContent = best;
  }
  function spinStall(k) { return ORDER[(spinIndex + k) % ORDER.length]; }

  // ---------- build stalls (click is the ONLY interaction) ----------
  var stallEls = terns.map(function (t, i) {
    var b = document.createElement('button');
    b.className = 'stall';
    b.style.setProperty('--a', (i * 45) + 'deg');
    b.setAttribute('aria-label', 'Settle tern ' + t.name);
    b.innerHTML = '<span class="no">STALL 0' + (i + 1) + '</span>' +
      '<span class="bird">🕊️</span>' +
      '<span class="nm"></span><span class="pips"></span><span class="tag"></span>';
    b.querySelector('.bird').style.filter =
      'hue-rotate(' + (t.hue - 200) + 'deg) drop-shadow(0 0 6px #01cdfe)';
    b.querySelector('.nm').textContent = t.name;
    b.addEventListener('click', function () { settle(i, b); });
    house.appendChild(b);
    return b;
  });

  function renderStall(i) {
    var t = terns[i], el = stallEls[i];
    var pips = '';
    for (var f = 0; f < NEED; f++) pips += f < t.calm ? '🪶' : '·';
    el.querySelector('.pips').textContent = pips;
    var stable = t.calm >= NEED;
    el.classList.toggle('stable', stable);
    el.querySelector('.tag').textContent = stable ? 'STABLE ✓' : (t.calm === 0 ? 'WILD' : 'RESTLESS');
    el.classList.toggle('next', spinStall(0) === i);
  }
  function renderAll() { for (var i = 0; i < 8; i++) renderStall(i); }

  function featherBurst(el) {
    var s = document.createElement('span');
    s.className = 'feather';
    s.textContent = '🪶';
    s.style.left = (30 + Math.random() * 16) + 'px';
    s.style.top = '6px';
    el.appendChild(s);
    setTimeout(function () { s.remove(); }, 850);
  }

  // ---------- the one interaction: CLICK ----------
  function settle(i, el) {
    var t = terns[i], now = Date.now();
    if (now < t.cool) return;
    t.cool = now + 350;
    if (t.calm < NEED) {
      t.calm++;
      beep(520 + t.calm * 160 + i * 24, 0.12, 'triangle');
      featherBurst(el);
      el.classList.remove('clicked');
      void el.offsetWidth;
      el.classList.add('clicked');
      if (t.calm >= NEED) {
        log(t.name + ' is STABLE ✓ ready for the wheel.', 'good');
        toast('✨ ' + t.name + ' IS STABLE', false);
      }
    } else {
      beep(880, 0.07, 'sine', 0.04); // already stable: soft tick
    }
    renderStall(i);
  }

  // ---------- spin resolution ----------
  function resolveSpin() {
    var idx = spinStall(0), t = terns[idx];
    total++;
    bursting = Date.now();
    house.classList.remove('burst');
    void house.offsetWidth;
    house.classList.add('burst');
    if (t.calm >= NEED || midnight) {
      var gain = 100 + Math.min(streak, 8) * 25 + (midnight ? 100 : 0);
      score += gain;
      streak++;
      good++;
      t.calm = 1; // spin takes it out of her; needs settling again
      pop('+' + gain, false);
      beep(660, 0.12, 'square', 0.06);
      setTimeout(function () { beep(990, 0.18, 'square', 0.06); }, 110);
      log('✔ Spin ' + (total) + ' — ' + t.name + ' rode the wheel +' + gain + '.', 'good');
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
    } else {
      streak = 0;
      pop('WOBBLE', true);
      beep(180, 0.35, 'sawtooth', 0.07);
      log('✘ Spin ' + total + ' — ' + t.name + ' was RESTLESS (' + t.calm + '/3). The harbor groans.', 'bad');
      toast('🌊 ' + t.name + ' WOBBLED — click to settle!', false);
    }
    spinIndex++;
    if (spinIndex % 8 === 0) {
      var bonus = 150;
      score += bonus;
      log('🌊 Tide ' + (spinIndex / 8 + 1) + ' rolls in! Harbor bonus +' + bonus + '.', 'secret');
      toast('🌊 TIDE BONUS +' + bonus, true);
    }
    spinAt = Date.now() + SPIN_EVERY * 1000;
    saveBest();
    paintScore();
    renderAll();
  }

  function pop(txt, bad) {
    popEl.textContent = txt;
    popEl.classList.toggle('bad', !!bad);
    popEl.classList.remove('hidden');
    setTimeout(function () { popEl.classList.add('hidden'); }, 1000);
  }

  function paintScore() {
    scoreEl.textContent = score;
    rankEl.textContent = 'rank: ' + rankFor(score);
    streakEl.textContent = streak;
    goodEl.textContent = good;
    totalEl.textContent = total;
    tideEl.textContent = Math.floor(spinIndex / 8) + 1;
  }

  // ---------- schedule panel ----------
  function paintSchedule(left) {
    var html = '';
    for (var k = 0; k < 4; k++) {
      var idx = spinStall(k), t = terns[idx];
      var stable = t.calm >= NEED;
      var secs = k === 0 ? left : k * SPIN_EVERY + left;
      var mm = Math.floor(secs / 60), ss = Math.floor(secs % 60);
      var clock = (mm > 0 ? mm + 'm ' : '') + ss + 's';
      var pct = k === 0 ? Math.max(0, Math.min(100, 100 - (left / SPIN_EVERY) * 100)) : 0;
      html += '<li class="' + (k === 0 ? 'first ' : '') + (stable ? 'ok' : 'risky') + '">' +
        '<span class="t">' + (k === 0 ? '▶ NOW' : 'T+' + clock) + '</span>' +
        '<span class="who">STALL 0' + (idx + 1) + ' · ' + t.name + '</span>' +
        '<span class="st">' + (stable ? 'STABLE ✓' : t.calm + '/3 …') + '</span>' +
        (k === 0 ? '<span class="bar"><i style="width:' + pct + '%"></i></span>' : '') +
        '</li>';
    }
    schedEl.innerHTML = html;
  }

  // ---------- easter egg: the sun ----------
  var sunClicks = 0;
  if (eggFound) sun.classList.add('shades');
  sun.addEventListener('click', function () {
    sunClicks++;
    beep(300 + sunClicks * 90, 0.15, 'sine');
    if (!eggFound && sunClicks >= 7) {
      eggFound = true;
      midnight = true;
      try { localStorage.setItem(EGG_KEY, '1'); } catch (e) {}
      sun.textContent = '🕶';
      sun.classList.add('shades');
      midnightEl.classList.remove('hidden');
      score += 500;
      saveBest(); paintScore();
      log('🌙 EASTER EGG — the MIDNIGHT TERN descends! +500. All spins blessed for 60s.', 'secret');
      toast('🌙 MIDNIGHT TERN! +500 — 60s of blessed spins', true);
      setTimeout(function () {
        midnight = false;
        midnightEl.classList.add('hidden');
        log('🌙 The Midnight Tern melts back into the static…', '');
      }, 60000);
    } else if (!eggFound) {
      var left = 7 - sunClicks;
      log('☀ the sun blinks… (' + left + ' more?)', '');
    } else {
      toast('🕶 the sun remembers you', true);
      beep(1200, 0.1, 'sine', 0.05);
    }
  });

  // ---------- buttons (still just clicks) ----------
  $('soundBtn').addEventListener('click', function () {
    soundOn = !soundOn;
    this.textContent = soundOn ? '🔊 sound: on' : '🔇 sound: off';
  });
  $('resetBtn').addEventListener('click', function () {
    best = 0;
    try { localStorage.removeItem(BEST_KEY); } catch (e) {}
    bestEl.textContent = '0';
    toast('↺ best score washed out to sea', false);
  });

  // ---------- main loop ----------
  var startT = Date.now();
  function frame() {
    var now = Date.now();
    var left = Math.max(0, (spinAt - now) / 1000);
    // decay
    if (now - lastDecay >= DECAY_EVERY * 1000) {
      lastDecay = now;
      var changed = false;
      for (var i = 0; i < 8; i++) {
        if (terns[i].calm > 0 && spinStall(0) !== i) { terns[i].calm--; changed = true; }
      }
      if (changed) renderAll();
      log('〜 feathers fade on the sea wind…', '');
    }
    if (left <= 0) { resolveSpin(); left = SPIN_EVERY; }
    // visuals
    rot = (rot + (bursting && now - bursting < 900 ? 9 : 0.6)) % 360;
    disc.style.transform = 'rotate(' + rot + 'deg)';
    hubTimer.textContent = left.toFixed(1);
    var el = Math.floor((now - startT) / 1000);
    clockEl.textContent = ('0' + Math.floor(el / 60)).slice(-2) + ':' + ('0' + (el % 60)).slice(-2);
    paintSchedule(left);
    requestAnimationFrame(frame);
  }

  // ---------- init ----------
  bestEl.textContent = best;
  paintScore();
  renderAll();
  log('◉ Welcome to the Roundhouse. 8 terns, 1 wheel, 14 seconds.', '');
  log('◉ Click terns to settle them — 3 feathers = STABLE.', '');
  if (eggFound) log('🕶 the sun remembers you…', 'secret');
  requestAnimationFrame(frame);
})();
