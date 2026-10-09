/* PENDULUM MOSS RELIQUARY
   plant seed-clocks -> chime hourly -> loop history -> prune to remix -> share link
   plain JS, no deps. persists to localStorage. scroll-reactive wind + light. */
'use strict';

const $ = (s) => document.querySelector(s);
const LS_KEY = 'pendulum-moss-reliquary-v1';
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic ladder
const BASE = 196; // G3

const state = {
  trees: [],       // {id,x,plantedAt,phase,branches:[{id,hour,note,pruned,stump}]}
  chimes: [],      // {t, hour, treeId, note, pruned}
  cuts: 0,
  tempo: 84, mist: 35, drone: false, playing: false, muted: false,
  wind: 0,         // 0..1 from scroll
};

// ---------- persistence + share-hash ----------
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      trees: state.trees, chimes: state.chimes.slice(-240),
      cuts: state.cuts, tempo: state.tempo, mist: state.mist,
    }));
  } catch { /* private mode */ }
}
function load() {
  // 1) shared garden in hash wins
  try {
    const m = location.hash.match(/garden=([A-Za-z0-9+/=_-]+)/);
    if (m) {
      const g = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (g && Array.isArray(g.trees)) {
        Object.assign(state, { trees: g.trees, chimes: g.chimes || [], cuts: g.cuts || 0,
          tempo: g.tempo || 84, mist: g.mist ?? 35 });
        toast('A shared garden took root here.');
        return;
      }
    }
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const g = JSON.parse(raw);
      Object.assign(state, { trees: g.trees || [], chimes: g.chimes || [], cuts: g.cuts || 0,
        tempo: g.tempo || 84, mist: g.mist ?? 35 });
      return;
    }
  } catch { /* fresh */ }
  seedYesterday();
  plantTree(true);
  plantTree(true);
}
function seedYesterday() {
  // "yesterday's chimes": one strike per hour, 24 entries
  const now = Date.now(), startOfToday = new Date().setHours(0, 0, 0, 0);
  state.chimes = [];
  for (let h = 0; h < 24; h++) {
    state.chimes.push({ t: startOfToday - 864e5 + h * 36e5, hour: h, treeId: 'yesterday',
      note: noteForHour(h), pruned: false });
  }
}
const noteForHour = (h) => PENTA[h % PENTA.length];

// ---------- audio ----------
let AC = null, master = null, mistFilter = null, droneNodes = null;
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) { toast('No WebAudio in this browser — silent garden.'); return null; }
  AC = new Ctx();
  mistFilter = AC.createBiquadFilter();
  mistFilter.type = 'lowpass'; mistFilter.frequency.value = mistToHz();
  master = AC.createGain(); master.gain.value = state.muted ? 0 : 0.8;
  mistFilter.connect(master); master.connect(AC.destination);
  return AC;
}
const mistToHz = () => 400 + (100 - state.mist) * 45;
function chime(note, when = 0, dur = 2.2, vol = 0.5) {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime + when;
  const f = BASE * Math.pow(2, note / 12);
  // bell = fundamental + partials, mossy slow decay
  [[1, 1], [2.01, 0.35], [2.74, 0.22], [3.76, 0.12]].forEach(([m, g]) => {
    const o = ac.createOscillator(), e = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * m;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(vol * g, t + 0.015);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1 / Math.sqrt(m)));
    o.connect(e); e.connect(mistFilter); o.start(t); o.stop(t + dur + 0.1);
  });
}
function setDrone(on) {
  state.drone = on;
  $('#btnDrone').textContent = 'DRONE: ' + (on ? 'ON' : 'OFF');
  $('#btnDrone').setAttribute('aria-pressed', String(on));
  if (!on && droneNodes) { droneNodes.stop(); droneNodes = null; return; }
  const ac = audio(); if (!ac || !on) return;
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.value = BASE / 2; o2.frequency.value = BASE / 2 * 1.007;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  g.gain.value = 0.05;
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
  o1.start(); o2.start();
  droneNodes = { stop() { try { o1.stop(); o2.stop(); } catch {} g.disconnect(); } };
}

// ---------- generative loop over history ----------
let loopTimer = null, loopIdx = 0;
function liveNotes() {
  // un-pruned branches across trees, ordered low->high; fall back to recent chime history
  const notes = [];
  state.trees.forEach((t) => t.branches.forEach((b) => {
    if (!b.pruned) notes.push({ note: b.note, label: `tree ${t.id.slice(-4)} · hr ${b.hour}` });
  }));
  notes.sort((a, b) => a.note - b.note);
  return notes;
}
function loopStep() {
  if (!state.playing) return;
  const notes = liveNotes();
  const beat = 60 / state.tempo / 2; // eighth notes
  if (notes.length) {
    const n = notes[loopIdx % notes.length];
    chime(n.note, 0, 1.8, 0.4);
    $('#loopNow').textContent = `♪ ${n.label} — note +${n.note} st`;
    loopIdx++;
  } else {
    $('#loopNow').textContent = '…all branches pruned — silence is also a remix. Regrow something.';
  }
  renderDots();
  loopTimer = setTimeout(loopStep, beat * 1000);
}
function setPlaying(p) {
  state.playing = p;
  $('#btnPlay').textContent = p ? '⏸ STOP LOOP' : '▶ LOOP HISTORY';
  if (p) { audio(); loopIdx = 0; loopStep(); toast('History is looping. Scroll to bend it.'); }
  else { clearTimeout(loopTimer); $('#loopNow').textContent = '— press ▶ LOOP HISTORY —'; renderDots(); }
}

// ---------- garden model ----------
const rid = () => Math.random().toString(36).slice(2, 6);
function plantTree(quiet = false) {
  if (state.trees.length >= 7) { toast('The soil is full — fell one first.'); return; }
  const id = 't' + Date.now().toString(36) + rid();
  const x = 0.12 + Math.random() * 0.76;
  const branches = [];
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const hour = Math.floor(Math.random() * 24);
    branches.push({ id: rid(), hour, note: noteForHour(hour) + (Math.random() < 0.3 ? 12 : 0), pruned: false });
  }
  state.trees.push({ id, x, plantedAt: Date.now(), phase: Math.random() * 6.28, branches });
  save(); renderAll();
  if (!quiet) { chime(7, 0, 2.5, 0.45); toast('Seed-clock planted. It will chime on the hour.'); }
}
function ringHour(treeId = null) {
  const hour = new Date().getHours();
  const targets = treeId ? state.trees.filter((t) => t.id === treeId) : state.trees;
  if (!targets.length) { toast('Plant a seed-clock first.'); return; }
  targets.forEach((t, i) => {
    const b = t.branches[Math.floor(Math.random() * t.branches.length)];
    const note = b ? b.note : noteForHour(hour);
    chime(note, i * 0.35, 3, 0.55);
    state.chimes.push({ t: Date.now(), hour, treeId: t.id, note, pruned: false });
  });
  save(); renderLog();
  toast(targets.length > 1 ? `The hour strikes — ${targets.length} trees ring.` : 'The hour strikes.');
}
function pruneAt(bid) {
  for (const t of state.trees) {
    const b = t.branches.find((x) => x.id === bid);
    if (b) {
      b.pruned = !b.pruned;
      state.cuts += b.pruned ? 1 : -1;
      chime(b.pruned ? 2 : b.note, 0, 1.2, 0.35);
      save(); renderAll();
      $('#pruneStat').textContent = b.pruned
        ? `${state.cuts} cut${state.cuts === 1 ? '' : 's'} total — the melody rewrote itself.`
        : 'A branch regrew. The melody forgives.';
      return;
    }
  }
}

// ---------- canvas ----------
const cv = $('#stage'), ctx = cv.getContext('2d');
let hit = []; // {bx,by,r,bid}
function fitCanvas() {
  const w = Math.min(cv.parentElement.clientWidth - 4, 920);
  const scale = window.devicePixelRatio || 1;
  cv.width = w * scale; cv.height = (w * 0.58) * scale;
  cv.style.aspectRatio = 'auto';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
function draw(now) {
  const W = cv.width / (window.devicePixelRatio || 1);
  const H = cv.height / (window.devicePixelRatio || 1);
  hit = [];
  // sky: scroll scrubs night->dawn tint
  const d = state.wind;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${13 + d * 40},${11 + d * 34},${8 + d * 22})`);
  g.addColorStop(1, `rgb(${20 + d * 60},${17 + d * 44},${12 + d * 22})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars fade as you scroll
  ctx.fillStyle = '#FFFDF4';
  for (let i = 0; i < 40; i++) {
    const sx = (i * 173.3) % W, sy = (i * 97.7) % (H * 0.55);
    ctx.globalAlpha = (1 - d) * (0.25 + ((i * 7) % 10) / 18);
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // moon / rust sun
  ctx.fillStyle = '#A83A26';
  ctx.beginPath(); ctx.arc(W * 0.85, H * (0.2 + d * 0.25), 22 + d * 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#E4DCC8'; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(W * 0.85 - 8, H * (0.2 + d * 0.25) - 5, 18, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  // ground
  ctx.fillStyle = '#14110C';
  ctx.fillRect(0, H * 0.86, W, H * 0.14);
  ctx.strokeStyle = '#6F7D2C'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(0, H * 0.86); ctx.lineTo(W, H * 0.86); ctx.stroke();
  ctx.setLineDash([]);

  const t = now / 1000;
  state.trees.forEach((tree) => {
    const bx = tree.x * W, by = H * 0.86;
    const sway = Math.sin(t * 1.1 + tree.phase) * (3 + state.wind * 14);
    const hgt = H * 0.34 + tree.branches.length * H * 0.012;
    // trunk
    ctx.strokeStyle = '#E4DCC8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sway * 0.4, by - hgt * 0.6, bx + sway, by - hgt);
    ctx.stroke();
    // pendulum: swings from top, scroll = wind amplitude
    const px = bx + sway, py = by - hgt;
    const ang = Math.sin(t * (1.4 + state.wind * 1.6) + tree.phase) * (0.35 + state.wind * 0.9);
    const L = 46;
    const bobX = px + Math.sin(ang) * L, bobY = py + Math.cos(ang) * L;
    ctx.strokeStyle = '#E4DCC8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bobX, bobY); ctx.stroke();
    // clock face
    ctx.fillStyle = '#14110C'; ctx.strokeStyle = '#E4DCC8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.fill(); ctx.stroke();
    const hand = (new Date().getMinutes() / 60) * 6.283;
    ctx.strokeStyle = '#A83A26'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(hand) * 9, py - Math.cos(hand) * 9); ctx.stroke();
    // pendulum bob
    ctx.fillStyle = '#A83A26';
    ctx.beginPath(); ctx.arc(bobX, bobY, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFFDF4';
    ctx.beginPath(); ctx.arc(bobX - 2, bobY - 2, 2, 0, 7); ctx.fill();
    // branches
    tree.branches.forEach((b, i) => {
      const f = tree.branches.length <= 1 ? 0.5 : i / (tree.branches.length - 1);
      const ay = by - hgt * (0.35 + f * 0.6);
      const dir = i % 2 ? 1 : -1;
      const len = 26 + (b.note % 12) * 2.4;
      const wob = Math.sin(t * 2 + i + tree.phase) * (1 + state.wind * 6);
      const ex = bx + sway * f + dir * len + wob, ey = ay - 14 - (b.note % 5) * 3;
      if (!b.pruned) {
        ctx.strokeStyle = '#6F7D2C'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bx + sway * f, ay); ctx.quadraticCurveTo(bx + sway * f + dir * len * 0.5, ay - 8, ex, ey); ctx.stroke();
        // moss blobs
        ctx.fillStyle = '#6F7D2C';
        for (let mI = 0; mI < 4; mI++) {
          const mx = ex + Math.sin(mI * 9 + i) * 9, my = ey + Math.cos(mI * 7 + i * 2) * 6;
          ctx.beginPath(); ctx.arc(mx, my, 3.4, 0, 7); ctx.fill();
        }
        // chime bud
        ctx.fillStyle = '#E4DCC8';
        ctx.beginPath(); ctx.arc(ex, ey - 7, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#A83A26';
        ctx.beginPath(); ctx.arc(ex, ey - 7, 2.2, 0, 7); ctx.fill();
        hit.push({ bx: ex, by: ey - 7, r: 14, bid: b.id });
      } else {
        // stump
        ctx.strokeStyle = '#A83A26'; ctx.lineWidth = 4; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(bx + sway * f, ay);
        ctx.lineTo(bx + sway * f + dir * 12, ay - 6); ctx.stroke(); ctx.setLineDash([]);
        hit.push({ bx: bx + sway * f + dir * 12, by: ay - 6, r: 14, bid: b.id });
      }
    });
    // moss at roots
    ctx.fillStyle = '#6F7D2C';
    for (let mI = 0; mI < 6; mI++) {
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(bx - 22 + mI * 8, by + 4 + (mI % 3) * 3, 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  // empty-state ghost
  if (!state.trees.length) {
    ctx.fillStyle = '#E4DCC8'; ctx.font = '16px monospace'; ctx.textAlign = 'center';
    ctx.fillText('— bare soil — plant a seed-clock above —', W / 2, H * 0.5);
  }
  requestAnimationFrame(draw);
}
cv.addEventListener('pointerdown', (e) => {
  const r = cv.getBoundingClientRect();
  const sx = cv.width / (window.devicePixelRatio || 1) / r.width;
  const sy = cv.height / (window.devicePixelRatio || 1) / r.height;
  const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
  const h = hit.find((p) => (p.bx - x) ** 2 + (p.by - y) ** 2 < p.r * p.r);
  if (h) { audio(); pruneAt(h.bid); }
});

// ---------- scroll reactivity ----------
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.wind = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  $('#windLab').textContent = 'WIND ' + Math.round(state.wind * 100) + '%';
  // scroll bends the music: tempo & mist drift with depth
  if (mistFilter && AC) mistFilter.frequency.value = mistToHz() * (1 - state.wind * 0.4);
  document.querySelectorAll('.strata').forEach((s) => {
    const r = s.getBoundingClientRect();
    if (r.top < innerHeight * 0.8) s.classList.add('lit');
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- renders ----------
function renderAll() { renderCounts(); renderLog(); renderDots(); }
function renderCounts() {
  $('#treeCount').textContent = `${state.trees.length} TREE${state.trees.length === 1 ? '' : 'S'}`;
}
function renderLog() {
  const log = $('#chimeLog');
  const items = state.chimes.slice(-60).reverse();
  log.innerHTML = items.map((c) => {
    const d = new Date(c.t);
    const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return `<li class="${c.pruned ? 'pruned' : ''}"><span class="h">HR ${String(c.hour).padStart(2, '0')}</span><span>${hh} · ${c.treeId === 'yesterday' ? 'yesterday' : 'tree ' + String(c.treeId).slice(-4)}</span><span class="n">+${c.note}st</span></li>`;
  }).join('') || '<li>no chimes yet</li>';
}
function renderDots() {
  const notes = liveNotes();
  $('#loopDots').innerHTML = notes.slice(0, 24).map((n, i) =>
    `<i class="${state.playing && i === (loopIdx - 1 + notes.length) % notes.length ? 'on' : ''}" title="${n.label}"></i>`
  ).join('') || '<i class="cut"></i>';
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function tickClock() {
  const d = new Date();
  $('#clockNow').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

// ---------- hourly chime ----------
let lastHour = new Date().getHours();
setInterval(() => {
  tickClock();
  const h = new Date().getHours();
  if (h !== lastHour) { lastHour = h; if (state.trees.length) ringHour(); }
}, 5000);

// ---------- share ----------
function shareLink() {
  const payload = { trees: state.trees, chimes: state.chimes.slice(-60), cuts: state.cuts, tempo: state.tempo, mist: state.mist };
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_');
  const url = location.href.split('#')[0] + '#garden=' + enc;
  $('#shareBox').value = url;
  const done = (ok) => {
    $('#shareStat').textContent = ok
      ? `Link minted · ${state.trees.length} trees · ${liveNotes().length} live notes · tempo ${state.tempo}. Anyone opening it hears your hours.`
      : 'Clipboard blocked — copy the link from the box above.';
    toast(ok ? 'Soundscape link copied.' : 'Link ready in the box.');
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
  else {
    $('#shareBox').select();
    try { done(document.execCommand('copy')); } catch { done(false); }
  }
}

// ---------- wiring ----------
$('#btnPlant').addEventListener('click', () => { audio(); plantTree(); });
$('#btnChime').addEventListener('click', () => { audio(); ringHour(); });
$('#btnPlay').addEventListener('click', () => setPlaying(!state.playing));
$('#btnDrone').addEventListener('click', () => { audio(); setDrone(!state.drone); });
$('#btnMute').addEventListener('click', (e) => {
  state.muted = !state.muted;
  if (master) master.gain.value = state.muted ? 0 : 0.8;
  e.target.textContent = state.muted ? 'UNMUTE' : 'MUTE';
});
$('#tempo').addEventListener('input', (e) => { state.tempo = +e.target.value; $('#tempoVal').textContent = state.tempo; save(); });
$('#mist').addEventListener('input', (e) => {
  state.mist = +e.target.value; $('#mistVal').textContent = state.mist;
  if (mistFilter && AC) mistFilter.frequency.value = mistToHz(); save();
});
$('#btnPruneRand').addEventListener('click', () => {
  audio();
  const live = [];
  state.trees.forEach((t) => t.branches.forEach((b) => { if (!b.pruned) live.push(b.id); }));
  if (!live.length) { toast('Nothing left to snip — regrow.'); return; }
  pruneAt(live[Math.floor(Math.random() * live.length)]);
  toast('✂ snipped. The loop remixed itself.');
});
$('#btnRegrow').addEventListener('click', () => {
  state.trees.forEach((t) => t.branches.forEach((b) => { b.pruned = false; }));
  save(); renderAll(); toast('❋ everything regrew.');
});
$('#btnFell').addEventListener('click', () => {
  const t = state.trees.pop();
  if (!t) { toast('Bare soil already.'); return; }
  chime(0, 0, 1.5, 0.4); save(); renderAll(); toast('🪓 felled. Its hours stay in the strata.');
});
$('#btnReseed').addEventListener('click', () => { seedYesterday(); save(); renderLog(); toast('Yesterday re-pressed into the strata.'); });
$('#btnShare').addEventListener('click', shareLink);
$('#btnScore').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ garden: state.trees, chimes: state.chimes, tempo: state.tempo }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'reliquary-score.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Score downloaded — your hours as JSON.');
});
$('#btnWipe').addEventListener('click', () => {
  if (!confirm('Burn the whole garden?')) return;
  state.trees = []; state.chimes = []; state.cuts = 0;
  setPlaying(false); save(); renderAll(); toast('Ashes. Plant again.');
});

// ---------- boot ----------
load();
$('#tempo').value = state.tempo; $('#tempoVal').textContent = state.tempo;
$('#mist').value = state.mist; $('#mistVal').textContent = state.mist;
fitCanvas();
window.addEventListener('resize', fitCanvas);
tickClock(); renderAll(); onScroll();
requestAnimationFrame(draw);
