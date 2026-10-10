// Fossil Clockwork Menagerie — hatch · time-loop breed · fossilize · chime
// Keyboard-first. WebAudio chimes. localStorage persistence. Easter egg: type "ticktock".

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const BODIES = ['orb', 'tri', 'blob', 'box'];
const PALETTES = [
  ['#ff2e88', '#ffd02e'], ['#00c2a8', '#14101f'], ['#6c3bff', '#ffd02e'],
  ['#2e9bff', '#ff2e88'], ['#ffd02e', '#6c3bff'], ['#00c2a8', '#ff2e88'],
];
const PATTERNS = ['dots', 'stripes', 'zig', 'plain'];
const NAMES = ['Gearpaw', 'Ticklet', 'Sprocket', 'Cogwhirr', 'Pendula', 'Mainspring', 'Escapa', 'Ratchette', 'Boinggear', 'Chronokit', 'Wobblepin', 'Tockling'];
const EPOCHS = ['Dawn Gears', 'Brass Meadows', 'Copper Tides', 'Neon Strata', 'Velvet Rust', 'Chrome Bloom', 'Silent Cogs'];
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5]; // C major-ish chimes
const MAXAGE = 5; // stages 0..5, fossilize at 5 (elder waits one extra loop)

let S = load() || { creatures: [], fossils: [], tick: 0, loop: 1, drone: false, sound: true, vol: .7, echo: .35, tempo: 132, seq: 0 };
let selected = new Set();
let eggSeq = '';
let hatchedGolden = false;

function load() { try { return JSON.parse(localStorage.getItem('fcm-v1')); } catch { return null; } }
function save() { try { localStorage.setItem('fcm-v1', JSON.stringify(S)); } catch {} }

// ---------- audio ----------
let AC = null, master = null, delaySend = null;
function audio() {
  if (AC) return AC;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = S.vol; master.connect(AC.destination);
  const dl = AC.createDelay(1); dl.delayTime.value = .28;
  const fb = AC.createGain(); fb.gain.value = S.echo;
  const wet = AC.createGain(); wet.gain.value = .35;
  delaySend = AC.createGain();
  delaySend.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  return AC;
}
function chime(freq, when = 0, dur = 1.1, type = 'sine') {
  if (!S.sound) return;
  audio(); if (AC.state === 'suspended') AC.resume();
  const t = AC.currentTime + when;
  [[1, 1], [2.01, .35], [2.94, .18]].forEach(([m, g]) => {
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.value = freq * m;
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(.5 * g, t + .012);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); gn.connect(master); gn.connect(delaySend);
    o.start(t); o.stop(t + dur + .1);
  });
}
function tickSound(c) { chime(SCALE[c.note % SCALE.length] / 4, 0, .35, 'triangle'); }
function fanfare() { [0, 2, 4, 5, 7].forEach((n, i) => chime(SCALE[n % SCALE.length], i * .11, 1.2)); }

let droneNodes = null;
function setDrone(on) {
  S.drone = on; save();
  const b = $('#btnDrone');
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = `🌊 Drone <kbd>D</kbd>: ${on ? 'ON' : 'OFF'}`;
  if (!on && droneNodes) { droneNodes.forEach(n => { try { n.stop(); } catch {} }); droneNodes = null; return; }
  if (on && S.sound) {
    audio();
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
    o1.frequency.value = 130.8; o2.frequency.value = 196; o1.type = o2.type = 'sine';
    g.gain.value = .05; o1.connect(g); o2.connect(g); g.connect(master);
    o1.start(); o2.start(); droneNodes = [o1, o2];
    // slow generative chime rain
    const rain = setInterval(() => {
      if (!S.drone || !S.sound) { clearInterval(rain); return; }
      chime(SCALE[Math.floor(Math.random() * SCALE.length)], 0, 2.2);
    }, 2600);
    droneNodes.push({ stop: () => clearInterval(rain) });
  }
}

// ---------- creatures ----------
const rnd = a => a[Math.floor(Math.random() * a.length)];
function mkCreature(parents = null) {
  S.seq++;
  const pick = k => parents ? (Math.random() < .5 ? parents[0][k] : parents[1][k]) : null;
  const mutate = (v, opts) => (!parents || Math.random() < .22) ? rnd(opts) : v;
  const c = {
    id: 'c' + Date.now().toString(36) + S.seq,
    name: parents ? spliceName(parents[0].name, parents[1].name) : rnd(NAMES) + '-' + S.seq,
    body: mutate(pick('body'), BODIES),
    colors: parents && Math.random() > .3 ? [pick('colors')[0], parents[Math.floor(Math.random() * 2)].colors[1]] : rnd(PALETTES).slice(),
    pattern: mutate(pick('pattern'), PATTERNS),
    note: parents ? (parents[0].note + parents[1].note + (Math.random() < .5 ? 1 : -1) + SCALE.length) % SCALE.length : Math.floor(Math.random() * 5),
    legs: parents ? Math.max(0, Math.min(6, parents[Math.floor(Math.random() * 2)].legs + (Math.random() < .3 ? (Math.random() < .5 ? 1 : -1) : 0))) : 2 + Math.floor(Math.random() * 4),
    gen: parents ? Math.max(parents[0].gen, parents[1].gen) + 1 : 1,
    parents: parents ? parents.map(p => p.name) : [],
    age: 0, born: S.tick,
    gold: false,
  };
  return c;
}
function spliceName(a, b) {
  a = a.split('-')[0]; b = b.split('-')[0];
  return (a.slice(0, Math.max(2, a.length >> 1)) + b.slice(Math.max(1, b.length >> 1))).replace(/^./, c => c.toUpperCase());
}
function stageOf(c) { return c.age <= 0 ? 'egg' : c.age === 1 ? 'hatch' : c.age <= 3 ? 'adult' : 'elder'; }
const STAGE_LBL = { egg: '🥚 egg', hatch: '🐣 hatchling', adult: '⚙ adult', elder: '🦴 elder' };

function gearSVG(x, y, r, fill) {
  return `<g class="gear${Math.random() < .5 ? ' rev' : ''}" opacity=".85">
    <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#14101f" stroke-width="2.5"/>
    ${[0, 60, 120, 180, 240, 300].map(a => `<rect x="${x - 2}" y="${y - r - 5}" width="4" height="7" fill="${fill}" stroke="#14101f" stroke-width="1.4" transform="rotate(${a} ${x} ${y})"/>`).join('')}
    <circle cx="${x}" cy="${y}" r="${r * .35}" fill="#fff" stroke="#14101f" stroke-width="2"/></g>`;
}
function creatureSVG(c, fossil = false) {
  const [a, b] = c.colors;
  const body = c.body === 'orb' ? `<circle cx="60" cy="52" r="30" fill="${a}" stroke="#14101f" stroke-width="3"/>`
    : c.body === 'tri' ? `<polygon points="60,20 90,78 30,78" fill="${a}" stroke="#14101f" stroke-width="3" stroke-linejoin="round"/>`
    : c.body === 'box' ? `<rect x="32" y="28" width="56" height="50" rx="10" fill="${a}" stroke="#14101f" stroke-width="3"/>`
    : `<path d="M35 60 Q40 28 62 32 Q88 36 84 60 Q80 84 58 80 Q36 78 35 60Z" fill="${a}" stroke="#14101f" stroke-width="3"/>`;
  const pat = c.pattern === 'dots' ? `<circle cx="50" cy="48" r="4" fill="${b}"/><circle cx="66" cy="58" r="4" fill="${b}"/><circle cx="58" cy="66" r="3" fill="${b}"/>`
    : c.pattern === 'stripes' ? `<rect x="40" y="44" width="40" height="5" fill="${b}" transform="rotate(-12 60 52)"/><rect x="40" y="56" width="40" height="5" fill="${b}" transform="rotate(-12 60 52)"/>`
    : c.pattern === 'zig' ? `<polyline points="40,60 48,50 56,60 64,50 72,60" stroke="${b}" stroke-width="4" fill="none"/>` : '';
  const legs = Array.from({ length: c.legs }, (_, i) => {
    const x = 38 + i * (44 / Math.max(1, c.legs - 1 || 1));
    return `<line x1="${x}" y1="76" x2="${x - 4}" y2="88" stroke="#14101f" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');
  const eyes = stageOf(c) === 'egg' ? `<path d="M52 52 q8 8 16 0" stroke="#14101f" stroke-width="2.5" fill="none"/>`
    : `<circle cx="52" cy="50" r="5" fill="#fff" stroke="#14101f" stroke-width="2"/><circle cx="68" cy="50" r="5" fill="#fff" stroke="#14101f" stroke-width="2"/><circle cx="53" cy="51" r="2" fill="#14101f"/><circle cx="69" cy="51" r="2" fill="#14101f"/>`;
  const col = fossil ? '#8a7f6a' : a;
  return `<svg viewBox="0 0 120 96" role="img" aria-label="${c.name} creature">${legs}${body.replaceAll(a, col)}${pat}${eyes}
    ${fossil ? '' : gearSVG(94, 26, 10, b) + gearSVG(26, 70, 7, b)}</svg>`;
}

// ---------- render ----------
function render() {
  $('#hudTick').textContent = S.tick;
  $('#hudLoop').textContent = S.loop;
  $('#hudEpoch').textContent = EPOCHS[Math.floor(S.tick / 24) % EPOCHS.length];
  $('#hudPop').textContent = S.creatures.length;
  $('#fossilCount').textContent = `${S.fossils.length} fossil${S.fossils.length === 1 ? '' : 's'}`;
  $('#tempoVal').textContent = S.tempo + 'ms';

  const m = $('#meadow'); m.innerHTML = '';
  S.creatures.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'creature ticking' + (selected.has(c.id) ? ' selected' : '');
    d.setAttribute('role', 'listitem'); d.tabIndex = 0;
    d.style.setProperty('--tick', (S.tempo * (1 + (c.note % 3) * .12)) + 'ms');
    d.setAttribute('aria-label', `${c.name}, ${STAGE_LBL[stageOf(c)]}, gen ${c.gen}, age ${c.age}. Press Enter to ${selected.has(c.id) ? 'deselect' : 'select'}.`);
    const st = stageOf(c);
    d.innerHTML = `${creatureSVG(c)}
      <div class="cname">${i + 1}. ${c.name}${c.gold ? ' 👑' : ''}</div>
      <div class="cmeta">gen ${c.gen} · ♪${'ABCDEFGH'[c.note % 8]} · ${c.legs} legs</div>
      <span class="stage-pill st-${c.gold ? 'gold' : st}">${c.gold ? '✨ chrono-gold' : STAGE_LBL[st]}</span>
      <div class="agebar" aria-hidden="true"><i style="width:${(c.age / MAXAGE) * 100}%"></i></div>`;
    d.addEventListener('click', () => toggleSelect(c.id));
    d.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(c.id); }
    });
    m.appendChild(d);
  });

  const [a, b] = [...selected].map(id => S.creatures.find(c => c.id === id)).filter(Boolean);
  $('#slotA').innerHTML = a ? `A: ${a.name} <small>(gen ${a.gen})</small>` : 'A: —';
  $('#slotB').innerHTML = b ? `B: ${b.name} <small>(gen ${b.gen})</small>` : 'B: —';
  $('#slotA').classList.toggle('filled', !!a); $('#slotB').classList.toggle('filled', !!b);
  $('#breedMsg').textContent = a && b ? `Ready: ${a.name} ⟳ ${b.name} — press B to collapse the loop.`
    : a ? 'One parent locked. Select a second creature.' : 'Select 2 creatures to splice their gears.';

  const tl = $('#timeline'); tl.innerHTML = '';
  [...S.fossils].reverse().forEach(f => {
    const li = document.createElement('li'); li.tabIndex = 0;
    li.setAttribute('aria-label', `Fossil ${f.name}, generation ${f.gen}, ${f.epoch}`);
    li.innerHTML = `<div class="diorama" style="background:${f.bg}">${f.glyph}</div>
      <div class="fossil-body"><span class="epoch-tag">${f.epoch}</span>
      <h3>🦴 ${f.name}</h3>
      <p>gen ${f.gen} · loop ${f.loop} · tick ${f.tick}</p>
      <p>♪ motif ${f.motif.join('-')} · ${f.parents.length ? 'child of ' + f.parents.join(' × ') : 'wild-hatched'}</p></div>`;
    tl.appendChild(li);
  });
  save();
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2400);
}

// ---------- actions ----------
function hatch(n = 1, golden = false) {
  for (let i = 0; i < n; i++) {
    if (S.creatures.length >= 24) { toast('Meadow full — fossilize (F) or release (X).'); break; }
    const c = mkCreature();
    if (golden) { c.gold = true; c.name = 'Aurelius, the Chrono-Squid'; c.body = 'blob'; c.colors = ['#ffd02e', '#ff2e88']; c.pattern = 'zig'; c.legs = 6; c.note = 7; }
    S.creatures.push(c);
    chime(SCALE[c.note % SCALE.length], i * .09, 1.2);
  }
  render();
  toast(golden ? '✨ EASTER EGG: Aurelius, the Chrono-Squid hatches in gold!' : n > 1 ? `A clutch of ${n} ticking creatures hatches!` : `${S.creatures[S.creatures.length - 1].name} hatches, ticking!`);
}
function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else { selected.add(id); if (selected.size > 2) selected.delete([...selected][0]); }
  const c = S.creatures.find(x => x.id === id);
  if (c) chime(SCALE[c.note % SCALE.length] / 2, 0, .4, 'square');
  render();
}
function breed() {
  const pair = [...selected].map(id => S.creatures.find(c => c.id === id)).filter(Boolean);
  if (pair.length < 2) { toast('Select exactly 2 creatures first (keys 1–9).'); return; }
  const kid = mkCreature(pair);
  S.creatures.push(kid);
  pair.forEach(p => p.age = Math.max(0, p.age - 2)); // the loop gives time back
  S.loop++;
  const fl = $('#loopFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  fanfare(); render();
  selected = new Set([kid.id]);
  render();
  toast(`⟳ Loop ${S.loop}: ${kid.name} condenses from the time-loop (gen ${kid.gen})!`);
}
function fossilizeOne(c, auto = false) {
  S.creatures = S.creatures.filter(x => x.id !== c.id);
  selected.delete(c.id);
  const glyphs = ['🪨', '🦕', '🐚', '🌀', '🏛️', '💠'];
  const bgs = ['linear-gradient(135deg,#ffd02e,#ff2e88)', 'linear-gradient(135deg,#00c2a8,#2e9bff)', 'linear-gradient(135deg,#6c3bff,#ff2e88)', 'linear-gradient(135deg,#14101f,#6c3bff)'];
  S.fossils.push({
    name: c.name, gen: c.gen, loop: S.loop, tick: S.tick, parents: c.parents,
    epoch: EPOCHS[Math.floor(S.tick / 24) % EPOCHS.length],
    motif: [c.note, (c.note + 2) % 8, (c.note + 4) % 8],
    glyph: c.gold ? '👑' : glyphs[(c.gen + S.fossils.length) % glyphs.length],
    bg: bgs[S.fossils.length % bgs.length],
  });
  [0, 2, 4].forEach((n, i) => chime(SCALE[(c.note + n) % SCALE.length] / 2, i * .14, 1.4));
  render();
  if (!auto) toast(`🦴 ${c.name} fossilizes into the ${S.fossils[S.fossils.length - 1].epoch}!`);
}
function fossilizeCmd() {
  const sel = [...selected].map(id => S.creatures.find(c => c.id === id)).filter(Boolean);
  if (sel.length) { fossilizeOne(sel[0]); return; }
  if (!S.creatures.length) { toast('Nothing living to fossilize.'); return; }
  const oldest = [...S.creatures].sort((x, y) => y.age - x.age || x.born - y.born)[0];
  fossilizeOne(oldest);
}
function exportRecord() {
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), fossils: S.fossils, tick: S.tick, loop: S.loop }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'fossil-record.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('⬇ Fossil record exported.');
}

// ---------- easter egg ----------
function goldenEgg() {
  if (hatchedGolden) return;
  hatchedGolden = true;
  hatch(1, true); fanfare(); setTimeout(fanfare, 500);
  document.body.style.setProperty('--pink', '#ffb700');
}

// ---------- clock ----------
let acc = 0, last = performance.now();
function loop(t) {
  const dt = t - last; last = t; acc += dt;
  if (acc >= S.tempo * 8) { // one "tick" every 8 tempo units so creatures tick visibly but age slowly
    acc = 0; S.tick++;
    S.creatures.forEach(c => {
      c.age++;
      if (Math.random() < .3) tickSound(c);
      if (c.age > MAXAGE) fossilizeOne(c, true);
    });
    render();
  }
  requestAnimationFrame(loop);
}

// ---------- wiring ----------
function wire() {
  $('#btnHatch').addEventListener('click', () => hatch(1));
  $('#btnHatch3').addEventListener('click', () => hatch(3));
  $('#btnBreed').addEventListener('click', breed);
  $('#btnRewind').addEventListener('click', () => { S.creatures.forEach(c => c.age = Math.max(0, c.age - 1)); S.loop++; render(); chime(392, 0, .8); toast('⏪ The loop rewinds — all creatures grow younger.'); });
  $('#btnFossil').addEventListener('click', fossilizeCmd);
  $('#btnExport').addEventListener('click', exportRecord);
  $('#btnWipe').addEventListener('click', () => { S.creatures = []; selected.clear(); render(); toast('☁ The meadow exhales. All released.'); });
  $('#btnSound').addEventListener('click', toggleSound);
  $('#btnDrone').addEventListener('click', () => setDrone(!S.drone));
  $('#btnHelp').addEventListener('click', openHelp);
  $('#btnCloseHelp').addEventListener('click', closeHelp);
  $('#tempo').value = S.tempo;
  $('#tempo').addEventListener('input', e => { S.tempo = +e.target.value; render(); });
  $('#vol').value = S.vol * 100;
  $('#vol').addEventListener('input', e => { S.vol = +e.target.value / 100; if (master) master.gain.value = S.vol; save(); });
  $('#echo').addEventListener('input', e => { S.echo = +e.target.value / 100; save(); });
  $$('.pad').forEach(p => p.addEventListener('click', () => chime(SCALE[+p.dataset.note], 0, 1.4)));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeHelp(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' && e.key !== 'Escape') return; // let sliders keep arrows
    const k = e.key;
    if (k === '?') { openHelp(); return; }
    if (k === 'H' && e.shiftKey) { hatch(3); return; }
    switch (k.toLowerCase()) {
      case 'h': hatch(1); break;
      case 'b': breed(); break;
      case 'r': $('#btnRewind').click(); break;
      case 'f': fossilizeCmd(); break;
      case 'x': $('#btnWipe').click(); break;
      case 'c': S.fossils = []; render(); toast('Timeline swept clean.'); break;
      case 'm': toggleSound(); break;
      case 'd': setDrone(!S.drone); break;
      case 'p': exportRecord(); break;
      case '[': S.tempo = Math.min(400, S.tempo + 12); $('#tempo').value = S.tempo; render(); break;
      case ']': S.tempo = Math.max(60, S.tempo - 12); $('#tempo').value = S.tempo; render(); break;
      case 'q': case 'w': case 'e': case 'r': case 't': {
        const i = 'qwert'.indexOf(k.toLowerCase()); chime(SCALE[i], 0, 1.4); break;
      }
      case '0': selected.clear(); render(); break;
      default:
        if (/^[1-9]$/.test(k)) {
          const c = S.creatures[+k - 1];
          if (c) toggleSelect(c.id);
        } else if (/^[a-z]$/i.test(k)) {
          eggSeq = (eggSeq + k.toLowerCase()).slice(-8);
          if (eggSeq === 'ticktock') goldenEgg();
        }
    }
  });
  // init sound button + drone from storage
  if (!S.sound) { const b = $('#btnSound'); b.textContent = '🔕 Sound OFF'; b.setAttribute('aria-pressed', 'false'); }
  if (S.drone) { S.drone = false; } // start drone off for autoplay policy; user can press D
}
function toggleSound() {
  S.sound = !S.sound; save();
  const b = $('#btnSound');
  b.textContent = S.sound ? '🔔 Sound ON' : '🔕 Sound OFF';
  b.setAttribute('aria-pressed', String(S.sound));
  if (S.sound) chime(880, 0, .8);
  if (!S.sound && droneNodes) { droneNodes.forEach(n => { try { n.stop(); } catch {} }); droneNodes = null; S.drone = false; $('#btnDrone').innerHTML = '🌊 Drone <kbd>D</kbd>: OFF'; }
}
function openHelp() { $('#helpDlg').hidden = false; $('#btnCloseHelp').focus(); }
function closeHelp() { if (!$('#helpDlg').hidden) { $('#helpDlg').hidden = true; $('#btnHatch').focus(); } }

wire();
if (!S.creatures.length && !S.fossils.length) { hatch(3); selected.clear(); render(); }
else render();
requestAnimationFrame(loop);
console.log('Fossil Clockwork Menagerie ready — press ? for keys');
