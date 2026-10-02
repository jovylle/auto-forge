// QUARTZ CANTINA — terminal social board.
// Dock at a sector, broadcast 140-char transmissions, buy rounds (cheers).
// Persists to localStorage. Share/export via URL hash, .txt, .json. WebAudio synth blips.

const $ = (s) => document.querySelector(s);
const LS_KEY = 'quartz-cantina-v1';
const COLS = 8, ROWS = 8;
const TONE_ICON = { toast: '🥂', rumor: '👁', request: '⚠', signal: '✦' };
const HOUSE_NAME = { void: 'VOIDRUNNERS', solar: 'SOLARIS', rouge: 'ROUGE SIGNAL' };

const SEED = [
  { who: 'DJ_QUARTZ', house: 'void', sector: 'C·3', tone: 'signal', text: 'House band tuning up. Requests from docked souls only. No slow songs before the second meteor shower.', cheers: 12, ts: Date.now() - 1000 * 60 * 42, seed: true },
  { who: 'MAROON_KID', house: 'rouge', sector: 'F·7', tone: 'rumor', text: 'Heard the coreward gate unsealed a derelict full of pre-Collapse vinyl. Bring ion masks.', cheers: 7, ts: Date.now() - 1000 * 60 * 31, seed: true },
  { who: 'AUNTIE_VEX', house: 'solar', sector: 'A·1', tone: 'toast', text: 'Round on me for anyone who just made port. You look thirsty, spacer. All of you. Always.', cheers: 21, ts: Date.now() - 1000 * 60 * 19, seed: true },
  { who: 'NULL_POET', house: 'void', sector: 'D·5', tone: 'request', text: 'Lost: one (1) left grav-boot, magnetized, answers to “Lefty”. Reward: a poem + a drink.', cheers: 4, ts: Date.now() - 1000 * 60 * 8, seed: true },
  { who: 'CAPT_BRASS', house: 'solar', sector: 'H·8', tone: 'toast', text: 'To the bartender droid who remembers my order after six years. To memory! To quartz!', cheers: 15, ts: Date.now() - 1000 * 60 * 3, seed: true },
];

let state = load() || { callsign: '', house: 'void', sector: 'D·4', sound: true, msgs: structuredClone(SEED), cheered: [] };

// merge shared bundle from URL hash (#c=<base64url json>)
(function importHash() {
  try {
    if (!location.hash.startsWith('#c=')) return;
    const data = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')))));
    if (Array.isArray(data)) {
      const known = new Set(state.msgs.map((m) => m.ts + '|' + m.who + '|' + m.text));
      let n = 0;
      for (const m of data) {
        if (m && typeof m.text === 'string' && !known.has(m.ts + '|' + m.who + '|' + m.text)) {
          state.msgs.push({ ...m, cheers: m.cheers | 0 });
          n++;
        }
      }
      toast(n ? `⇩ UPLINK MERGED — ${n} incoming transmission${n > 1 ? 's' : ''}` : '⇩ bundle already on your wire');
    }
    history.replaceState(null, '', location.pathname);
  } catch { /* corrupt hash: ignore */ }
})();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

/* ---------- audio: tiny synth, no assets ---------- */
let AC = null;
function blip(freq = 660, dur = 0.07, type = 'square', vol = 0.04) {
  if (!state.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g).connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch { /* audio unavailable */ }
}
const sfx = {
  key: () => blip(880 + Math.random() * 220, 0.03, 'square', 0.015),
  dock: () => { blip(392, 0.08); setTimeout(() => blip(587, 0.1), 90); },
  send: () => { blip(523, 0.07); setTimeout(() => blip(784, 0.09), 80); setTimeout(() => blip(1046, 0.12), 170); },
  cheer: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.1, 'triangle', 0.05), i * 70)); },
  boot: () => { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => blip(f, 0.09, 'sawtooth', 0.03), i * 110)); },
};

/* ---------- boot line typing ---------- */
(function boot() {
  const el = $('#bootline');
  const msg = 'uplink established — welcome back, spacer';
  let i = 0;
  el.innerHTML = '<span class="typed"></span><span class="caret">▌</span>';
  const t = el.querySelector('.typed');
  const tick = () => { if (i <= msg.length) { t.textContent = msg.slice(0, i++); setTimeout(tick, 28); } };
  tick();
  sfx.boot();
})();

/* ---------- clock + ticker ---------- */
setInterval(() => {
  $('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC';
}, 500);
$('#clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC';

function refreshTicker() {
  const items = state.msgs.slice(-8).map((m) => `${TONE_ICON[m.tone] || '✦'} ${m.who}: ${m.text}`);
  $('#ticker').textContent = (' ✦ QUARTZ CANTINA — DEEP-FIELD RELAY ✦ ' + items.join('  ///  ') + '  ///  ').repeat(2);
}

/* ---------- sector map ---------- */
function sectorName(c, r) {
  return String.fromCharCode(65 + c) + '·' + (r + 1);
}
function buildMap() {
  const map = $('#map');
  map.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const name = sectorName(c, r);
      const b = document.createElement('button');
      b.className = 'sector';
      b.setAttribute('role', 'gridcell');
      b.dataset.sector = name;
      b.title = 'dock at sector ' + name;
      b.innerHTML = `<span>${name}</span><span class="blips"></span>`;
      b.addEventListener('click', () => dock(name));
      map.appendChild(b);
    }
  }
  paintMap();
}
function paintMap() {
  const counts = {};
  for (const m of state.msgs) counts[m.sector] = (counts[m.sector] || 0) + 1;
  const mine = new Set(state.msgs.filter((m) => m.mine).map((m) => m.sector));
  document.querySelectorAll('.sector').forEach((el) => {
    const s = el.dataset.sector;
    const n = counts[s] || 0;
    el.classList.toggle('docked', s === state.sector);
    el.classList.toggle('has-blips', n > 0);
    el.classList.toggle('hot', n >= 3);
    el.querySelector('.blips').textContent = n ? '●'.repeat(Math.min(n, 5)) : '';
    if (mine.has(s) && s !== state.sector) el.style.borderStyle = 'double';
    else el.style.borderStyle = '';
  });
  $('#sectorReadout').textContent = '▚ ' + state.sector;
}
function dock(name) {
  if (state.sector === name) return;
  state.sector = name;
  save(); paintMap();
  sfx.dock();
  toast(`◈ DOCKED AT SECTOR ${name}`);
}
$('#randomDock').addEventListener('click', () => {
  dock(sectorName(Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)));
});

/* ---------- identity ---------- */
const callInput = $('#callsign');
callInput.value = state.callsign || '';
callInput.addEventListener('input', () => {
  state.callsign = callInput.value.toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 16);
  if (callInput.value !== state.callsign) callInput.value = state.callsign;
  save(); updatePatrons();
});
document.querySelectorAll('.house').forEach((b) => {
  const on = b.dataset.house === state.house;
  b.classList.toggle('is-on', on);
  b.setAttribute('aria-checked', on);
  b.addEventListener('click', () => {
    state.house = b.dataset.house; save();
    document.querySelectorAll('.house').forEach((x) => {
      const o = x === b;
      x.classList.toggle('is-on', o);
      x.setAttribute('aria-checked', o);
    });
    sfx.dock();
    toast(`◍ HOUSE OF ${HOUSE_NAME[state.house]} CLAIMS YOU`);
  });
});

/* ---------- composer ---------- */
let tone = 'toast';
document.querySelectorAll('.tone').forEach((b) => {
  b.addEventListener('click', () => {
    tone = b.dataset.tone;
    document.querySelectorAll('.tone').forEach((x) => {
      const o = x === b;
      x.classList.toggle('is-on', o);
      x.setAttribute('aria-checked', o);
    });
    sfx.key();
  });
});
const composer = $('#composer');
composer.addEventListener('input', () => {
  $('#charCount').textContent = 140 - composer.value.length;
  if (composer.value.length % 7 === 1) sfx.key();
});
composer.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
});
$('#sendBtn').addEventListener('click', send);

function myName() {
  return state.callsign || ('GUEST-' + Math.floor(1000 + Math.random() * 9000));
}
function send() {
  const text = composer.value.trim();
  if (!text) { toast('⚠ empty hail — say something, spacer', true); return; }
  state.msgs.push({
    who: myName(), house: state.house, sector: state.sector,
    tone, text: text.slice(0, 140), cheers: 0, ts: Date.now(), mine: true,
  });
  composer.value = '';
  $('#charCount').textContent = 140;
  save(); render(); sfx.send();
  toast('▶ TRANSMISSION BROADCAST');
}

/* ---------- feed ---------- */
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(5, 10) + ' ' + d.toISOString().slice(11, 16);
}
function render() {
  const q = $('#search').value.trim().toLowerCase();
  const hf = $('#houseFilter').value;
  const list = [...state.msgs].reverse().filter((m) =>
    (hf === 'all' || m.house === hf) &&
    (!q || m.text.toLowerCase().includes(q) || m.who.toLowerCase().includes(q) || m.sector.toLowerCase().includes(q))
  );
  const feed = $('#feed');
  feed.innerHTML = '';
  $('#emptyFeed').hidden = list.length > 0;
  $('#feedCount').textContent = state.msgs.length;
  for (const m of list) {
    const li = document.createElement('li');
    li.className = 'msg' + (m.mine ? ' mine' : '');
    li.dataset.house = m.house;
    const key = m.ts + '|' + m.who + '|' + m.text;
    const cheered = state.cheered.includes(key);
    li.innerHTML = `
      <div class="msg-head">
        <span class="who">${escapeHtml(m.who)}</span>
        <span class="tone-tag">${TONE_ICON[m.tone] || '✦'} ${escapeHtml((m.tone || 'signal').toUpperCase())}</span>
        <span class="meta">SEC ${escapeHtml(m.sector)} · ${fmtTime(m.ts)}${m.mine ? ' · YOU' : ''}</span>
      </div>
      <div class="msg-text"></div>
      <div class="msg-foot">
        <button class="cheer${cheered ? ' cheered' : ''}">🥂 buy a round · ${m.cheers | 0}</button>
        <button class="quote" title="copy as quote">⧉ quote</button>
      </div>`;
    li.querySelector('.msg-text').textContent = m.text;
    li.querySelector('.cheer').addEventListener('click', (ev) => {
      m.cheers = (m.cheers | 0) + 1;
      if (!state.cheered.includes(key)) state.cheered.push(key);
      save(); render(); sfx.cheer();
      toast(`🥂 round bought for ${m.who}!`);
      ev.currentTarget.blur();
    });
    li.querySelector('.quote').addEventListener('click', () => {
      copyText(`❝${m.text}❞ — ${m.who}, Quartz Cantina sec ${m.sector}`, 'QUOTE COPIED TO CLIPBOARD');
    });
    feed.appendChild(li);
  }
  paintMap();
  updatePatrons();
  refreshTicker();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function updatePatrons() {
  const names = new Set(state.msgs.map((m) => m.who));
  if (state.callsign) names.add(state.callsign);
  $('#patronCount').textContent = names.size;
}
$('#search').addEventListener('input', render);
$('#houseFilter').addEventListener('change', render);

/* ---------- share / export ---------- */
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast('⧉ ' + okMsg);
  } catch {
    // file:// or no permission: show selectable fallback
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99;width:min(90vw,500px);height:120px';
    document.body.appendChild(t);
    t.select();
    toast('⚠ clipboard blocked — copy the highlighted text', true);
    t.addEventListener('blur', () => t.remove(), { once: true });
  }
}
function b64url(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
$('#copyLink').addEventListener('click', () => {
  const mine = state.msgs.filter((m) => m.mine);
  const url = location.href.split('#')[0] + '#c=' + b64url(mine.length ? mine : state.msgs.slice(-10));
  copyText(url, mine.length ? `SHARE LINK COPIED — carries your ${mine.length} transmission${mine.length > 1 ? 's' : ''}` : 'SHARE LINK COPIED — carries the latest wire');
  blip(1046, 0.12, 'sine', 0.05);
});
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#exportTxt').addEventListener('click', () => {
  const lines = [
    '◈ QUARTZ CANTINA — WIRE LOG ◈',
    `exported ${new Date().toISOString()} · ${state.msgs.length} transmissions`,
    '═'.repeat(52),
    ...[...state.msgs].reverse().map((m) =>
      `[${fmtTime(m.ts)}] [SEC ${m.sector}] [${HOUSE_NAME[m.house]}] ${(TONE_ICON[m.tone] || '✦')}${m.who}: ${m.text}  (🥂${m.cheers | 0})`),
  ];
  download('quartz-cantina-log.txt', lines.join('\n'), 'text/plain');
  toast('⧉ LOG EXPORTED AS .TXT');
});
$('#exportJson').addEventListener('click', () => {
  download('quartz-cantina-wire.json', JSON.stringify(state.msgs, null, 2), 'application/json');
  toast('⧉ WIRE EXPORTED AS .JSON');
});
$('#wipeBtn').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (btn.dataset.armed) {
    const n = state.msgs.filter((m) => m.mine).length;
    state.msgs = state.msgs.filter((m) => !m.mine);
    state.cheered = [];
    save(); render();
    btn.dataset.armed = '';
    btn.textContent = '✕ BURN';
    toast(n ? `✕ BURNED ${n} OF YOUR TRANSMISSIONS` : '✕ nothing of yours to burn');
    blip(196, 0.25, 'sawtooth', 0.05);
  } else {
    btn.dataset.armed = '1';
    btn.textContent = '✕ SURE?';
    toast('⚠ press BURN again to torch your transmissions', true);
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = '✕ BURN'; }, 4000);
  }
});

/* ---------- sound toggle ---------- */
const soundBtn = $('#soundBtn');
function paintSound() {
  soundBtn.textContent = state.sound ? '♪ SOUND:ON' : '♪ SOUND:OFF';
  soundBtn.setAttribute('aria-pressed', state.sound);
}
soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  save(); paintSound();
  if (state.sound) sfx.dock();
});
paintSound();

/* ---------- toasts ---------- */
function toast(msg, warn = false) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------- go ---------- */
buildMap();
render();
