// Harbor Vole Verse — tide verses · vole choir · forecast export
// Plain ES module, no deps. localStorage for the logbook. WebAudio for squeaks.

const $ = (id) => document.getElementById(id);
const tideSel = $('tideSel'), cargoSel = $('cargoSel'), moodSel = $('moodSel');
const verseOut = $('verseOut'), telNo = $('telNo'), telTide = $('telTide'), omenLine = $('omenLine');
const gTide = $('gTide'), gWind = $('gWind'), gBoil = $('gBoil'), gVoles = $('gVoles');

/* ---------- generative tide-verse grammar ---------- */
const WINDS = ["Nor'wester", 'Sou\'easterly', 'Harbor-calm', 'Boiler-draft', 'Gull-wing gust', 'Fog-drift'];
const BOILS = ['Steady', 'Stoked', 'Hissing', 'Banked', 'Full-steam'];
const OPEN = {
  Ominous: ['Hush the capstans,', 'Mark the black water,', 'Still your pistons,'],
  Jolly: ['Up with the bunting,', 'Pipe the bright whistle,', 'Dance on the gangway,'],
  Mournful: ['Low sings the foghorn,', 'Weep, little rivets,', 'Dim burns the binnacle,'],
  Mutinous: ['Down with the tariff-man,', 'Hide the good biscuits,', 'Rattle your cages,'],
};
const TIDE_LINE = {
  'Low Water': ['the mud shows its ribs and the chained hulls complain.', 'the crabs audit anchors; the channel runs thin.', 'old bottles confess where the smugglers stepped in.'],
  Ebb: ['the tide drags the moon\'s change purse out to sea.', 'every buoy leans east, gossiping of squalls.', 'the current filches coppers from the quay.'],
  Flood: ['the harbor inhales and the tall ships swing true.', 'the water climbs the pilings to kiss the tar.', 'each wave delivers a letter nobody wrote.'],
  'High Water': ['the docks float proud; the gulls hold their parade.', 'no keel shall kiss bottom till the bell strikes eight.', 'the moon stands surety for every laden hull.'],
  'Storm Surge': ['lash down the hatches! The sea reads the riot act.', 'white horses stampede through the breakwater gap.', 'even the lighthouse chews its electric lip.'],
};
const CARGO_LINE = (c) => [
  `The ${c} sails ${sailVerdict()}.`,
  `Stow the ${c} ${stowHow()}.`,
  `Insure the ${c} — the voles demand a crumb per crate.`,
];
const OMEN = {
  Ominous: ['OMEN: one boot, floating upright. Turn back at dusk.', 'OMEN: three gulls, silent. Reef the topsails.', 'OMEN: the tide-clock skips a tooth. Double the watch.'],
  Jolly: ['OMEN: a brass button gleaming. Fair winds till Thursday.', 'OMEN: voles singing in thirds. Full holds home.', 'OMEN: porpoises racing the pilot-boat. Luck aboard!'],
  Mournful: ['OMEN: fog on the water, fog in the chest. Light a lamp.', 'OMEN: a drowned waltz on the wireless. Sail slow.', 'OMEN: rust weeps from the anchor. Mind the old griefs.'],
  Mutinous: ['OMEN: the captain\'s parrot files a complaint. Share the grog.', 'OMEN: a red rag on the mizzen. Renegotiate everything.', 'OMEN: crumbs missing from the mess. The voles unionize.'],
};
const CLOSE = {
  Ominous: 'So squeak the voles. Heed, or swim.',
  Jolly: 'So squeak the voles. All aboard & tally-ho!',
  Mournful: 'So squeak the voles. The sea keeps what it keeps.',
  Mutinous: 'So squeak the voles. Crumbs to the crew!',
};
const pick = (a) => a[(Math.random() * a.length) | 0];
function sailVerdict() { return pick(['at first bell', 'on the flood', 'when the gulls agree', 'never on a Friday', 'if the boilers hold', 'behind the ice-breaker']); }
function stowHow() { return pick(['high and dry', 'lashed with song', 'beside the cheese', 'under double canvas', 'where the voles can guard it']); }

let counter = Number(localStorage.getItem('hvv_no') || 0);
let current = { verse: '', tide: 'Flood', cargo: '', mood: 'Jolly', wind: '', omen: '' };

function typewrite(el, text) {
  el.innerHTML = '';
  const safe = text; // built from our own grammar — no HTML in it
  let i = 0;
  const caret = document.createElement('span');
  caret.className = 'caret'; caret.innerHTML = '&nbsp;';
  const node = document.createTextNode('');
  el.append(node, caret);
  clearInterval(typewrite.t);
  typewrite.t = setInterval(() => {
    i += 2;
    node.textContent = safe.slice(0, i);
    if (i >= safe.length) { clearInterval(typewrite.t); caret.remove(); }
  }, 18);
}

function generate(announce = true) {
  const tide = tideSel.value, cargo = cargoSel.value, mood = moodSel.value;
  const wind = pick(WINDS), boil = pick(BOILS);
  const verse = `${pick(OPEN[mood])} ${pick(TIDE_LINE[tide])}\n${pick(CARGO_LINE(cargo))}\n${CLOSE[mood]}`;
  const omen = pick(OMEN[mood]);
  counter += 1;
  localStorage.setItem('hvv_no', String(counter));
  current = { verse, tide, cargo, mood, wind, omen, boil, no: counter, at: new Date().toISOString() };
  telNo.textContent = '№ ' + String(counter).padStart(4, '0');
  telTide.textContent = tide.toUpperCase();
  omenLine.textContent = omen;
  gTide.textContent = tide; gWind.textContent = wind; gBoil.textContent = boil;
  verseOut.classList.remove('stamp'); void verseOut.offsetWidth; verseOut.classList.add('stamp');
  if (announce && matchMedia('(prefers-reduced-motion: reduce)').matches) verseOut.textContent = verse;
  else typewrite(verseOut, verse);
  saveDraft();
  return current;
}
function saveDraft() { try { localStorage.setItem('hvv_draft', JSON.stringify(current)); } catch {} }
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('hvv_draft') || 'null');
    if (d && d.verse) {
      current = d; counter = Number(localStorage.getItem('hvv_no') || d.no || 0);
      tideSel.value = d.tide || 'Flood'; cargoSel.value = d.cargo || cargoSel.value; moodSel.value = d.mood || 'Jolly';
      telNo.textContent = '№ ' + String(d.no || 1).padStart(4, '0');
      telTide.textContent = (d.tide || '').toUpperCase(); omenLine.textContent = d.omen || '';
      gTide.textContent = d.tide || '—'; gWind.textContent = d.wind || '—'; gBoil.textContent = d.boil || '—';
      verseOut.textContent = d.verse;
    }
  } catch {}
}

/* ---------- vole choir (WebAudio squeaks) ---------- */
const VOLES = [
  { nm: 'Bosun', ch: '🐭', freq: 660, note: 'E5 · lead' },
  { nm: 'Gasket', ch: '🐭', freq: 550, note: 'C#5 · alto' },
  { nm: 'Pippa', ch: '🐹', freq: 880, note: 'A5 · soprano' },
  { nm: 'Rivets', ch: '🐭', freq: 440, note: 'A4 · tenor' },
  { nm: 'Sump', ch: '🐹', freq: 330, note: 'E4 · basso' },
];
const muted = new Set(JSON.parse(localStorage.getItem('hvv_muted') || '[]'));
let actx = null, shanty = false;
const choirEl = $('choir'), meterFill = $('meterFill'), tempoEl = $('tempo');

function ctx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function squeak(freq, t0, dur = 0.22, vol = 0.16) {
  const ac = ctx(), o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t0);
  o.frequency.linearRampToValueAtTime(freq * 1.18, t0 + dur * 0.5);
  o.frequency.linearRampToValueAtTime(freq * 0.94, t0 + dur);
  v.frequency.value = 28; vg.gain.value = freq * 0.06; v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); v.start(t0); o.stop(t0 + dur + 0.02); v.stop(t0 + dur + 0.02);
}
function syllables(text) {
  const words = text.replace(/[^a-zA-Z' ]/g, '').split(/\s+/).filter(Boolean);
  const out = [];
  words.forEach((w) => { const n = Math.min(3, Math.max(1, Math.round(w.length / 4))); for (let i = 0; i < n; i++) out.push(w); });
  return out.slice(0, 40);
}
function renderChoir() {
  choirEl.innerHTML = '';
  const onDuty = VOLES.filter((_, i) => !muted.has(i)).length;
  gVoles.textContent = `${onDuty} / 5`;
  VOLES.forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'vole' + (muted.has(i) ? ' muted' : '');
    d.setAttribute('role', 'button'); d.tabIndex = 0;
    d.setAttribute('aria-label', `${v.nm}, ${v.note}${muted.has(i) ? ', muted' : ''}. Activate to squeak, Shift to mute.`);
    d.innerHTML = `<span class="face">${v.ch}</span><span class="mouth">· · ·</span><span class="nm">${v.nm}</span><span class="note">${v.note}</span>`;
    const play = (e) => {
      if (e && e.shiftKey) return toggleMute(i);
      const ac = ctx(), t = ac.currentTime;
      squeak(v.freq * (shanty ? 0.89 : 1), t, 0.25);
      squeak(v.freq * 1.5, t + 0.16, 0.2, 0.1);
      d.classList.add('singing'); d.querySelector('.mouth').textContent = '◕ ω ◕';
      setTimeout(() => { d.classList.remove('singing'); d.querySelector('.mouth').textContent = '· · ·'; }, 420);
      pressure(70);
    };
    d.addEventListener('click', play);
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(e); } });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleMute(i); });
    const tag = document.createElement('button');
    tag.className = 'btn ghost'; tag.style.cssText = 'font-size:11px;padding:2px 8px;margin-top:4px';
    tag.textContent = muted.has(i) ? 'unmute' : 'mute';
    tag.setAttribute('aria-label', (muted.has(i) ? 'Unmute ' : 'Mute ') + v.nm);
    tag.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(i); });
    d.append(tag);
    choirEl.append(d);
  });
}
function toggleMute(i) { muted.has(i) ? muted.delete(i) : muted.add(i); localStorage.setItem('hvv_muted', JSON.stringify([...muted])); renderChoir(); }
function pressure(p) { meterFill.style.width = Math.max(8, Math.min(100, p)) + '%'; }

async function conduct() {
  if (!current.verse) generate(false);
  const ac = ctx();
  const syls = syllables(current.verse);
  if (!syls.length) return;
  const tempo = Number(tempoEl.value) || 132;
  const step = 60 / tempo / 2;
  const active = VOLES.map((v, i) => ({ ...v, i })).filter((v) => !muted.has(v.i));
  if (!active.length) { $('copyNote').textContent = 'All voles muted — unmute at least one whiskered singer.'; return; }
  $('copyNote').textContent = `The choir sings telegram ${telNo.textContent}…`;
  const t0 = ac.currentTime + 0.1;
  const scale = shanty ? [0.89, 1, 1.12, 1.33, 1.5, 1.78] : [1, 1.12, 1.26, 1.33, 1.5, 1.68];
  const cards = [...choirEl.children];
  syls.forEach((w, k) => {
    const v = active[k % active.length];
    const mult = scale[(k + (shanty ? 2 : 0)) % scale.length];
    const t = t0 + k * step;
    squeak(v.freq * mult, t, Math.min(0.3, step * 1.15));
    setTimeout(() => {
      cards.forEach((c) => c.classList.remove('singing'));
      const card = cards[v.i];
      if (card) { card.classList.add('singing'); const m = card.querySelector('.mouth'); if (m) m.textContent = '♪ ' + w.slice(0, 6) + ' ♪'; }
      pressure(25 + ((k / syls.length) * 70));
    }, (t - ac.currentTime) * 1000);
  });
  setTimeout(() => { cards.forEach((c) => { c.classList.remove('singing'); const m = c.querySelector('.mouth'); if (m) m.textContent = '· · ·'; }); pressure(30); $('copyNote').textContent = 'Bravo! The boilers applaud in steam.'; }, (syls.length * step + 0.4) * 1000);
}

/* ---------- forecast export + logbook ---------- */
const logbookEl = $('logbook'), logCount = $('logCount'), copyNote = $('copyNote');
const logs = JSON.parse(localStorage.getItem('hvv_logs') || '[]');

function forecastText(f) {
  return [`HARBOR VOLE VERSE — SHIPPING FORECAST ${'№ ' + String(f.no || 0).padStart(4, '0')}`,
    `Tide: ${f.tide} · Wind: ${f.wind} · Boilers: ${f.boil || 'Steady'} · Cargo: ${f.cargo}`, '',
    f.verse, '', f.omen, `Filed: ${f.at || new Date().toISOString()} · Mood: ${f.mood} · Pier IX Vole Bureau`].join('\n');
}
function persistLogs() { try { localStorage.setItem('hvv_logs', JSON.stringify(logs.slice(0, 30))); } catch {} }
function renderLogs() {
  logCount.textContent = `(${logs.length})`;
  logbookEl.innerHTML = '';
  if (!logs.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Logbook empty — file a forecast with “Keep in logbook”.'; logbookEl.append(li); return; }
  logs.forEach((f, idx) => {
    const li = document.createElement('li');
    const top = document.createElement('div'); top.className = 'lb-top';
    const s = document.createElement('span'); s.textContent = `${'№ ' + String(f.no).padStart(4, '0')} · ${f.tide} · ${f.cargo}`;
    const x = document.createElement('button'); x.className = 'lb-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Delete entry ' + f.no);
    x.addEventListener('click', () => { logs.splice(idx, 1); persistLogs(); renderLogs(); });
    top.append(s, x);
    const body = document.createElement('div'); body.textContent = f.verse;
    const load = document.createElement('button'); load.className = 'btn ghost'; load.style.cssText = 'font-size:11px;padding:2px 8px;margin-top:6px';
    load.textContent = 'reload this forecast';
    load.addEventListener('click', () => {
      current = f; tideSel.value = f.tide; moodSel.value = f.mood;
      try { cargoSel.value = f.cargo; } catch {}
      telNo.textContent = '№ ' + String(f.no).padStart(4, '0'); telTide.textContent = f.tide.toUpperCase();
      omenLine.textContent = f.omen; gTide.textContent = f.tide; gWind.textContent = f.wind;
      verseOut.textContent = f.verse; window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    li.append(top, body, load); logbookEl.append(li);
  });
}
function keepLog() {
  if (!current.verse) return;
  if (!logs.some((l) => l.no === current.no)) { logs.unshift({ ...current }); persistLogs(); renderLogs(); }
}
function download(name, text, type) {
  const blob = new Blob([text], { type }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- wire up ---------- */
$('stokeBtn').addEventListener('click', () => { generate(); pressure(85); setTimeout(() => pressure(30), 900); });
$('againBtn').addEventListener('click', () => generate());
$('singBtn').addEventListener('click', conduct);
$('choirBtn').addEventListener('click', conduct);
$('shantyBtn').addEventListener('click', (e) => {
  shanty = !shanty;
  e.currentTarget.textContent = shanty ? 'Shanty: ON ♫' : 'Sea-shanty mode';
  copyNote.textContent = shanty ? 'Shanty mode: low minor droning of the deep.' : 'Parade mode: bright major squeaks.';
});
$('copyBtn').addEventListener('click', async () => {
  if (!current.verse) generate(false);
  keepLog();
  const t = forecastText(current);
  try { await navigator.clipboard.writeText(t); copyNote.textContent = `Forecast ${telNo.textContent} copied — paste it to the harbormaster.`; }
  catch { copyNote.textContent = 'Clipboard blocked (file://). Use the .txt download instead.'; }
});
$('txtBtn').addEventListener('click', () => {
  if (!current.verse) generate(false);
  keepLog(); download(`vole-forecast-${String(current.no).padStart(4, '0')}.txt`, forecastText(current), 'text/plain');
  copyNote.textContent = 'Ship’s log filed to your downloads.';
});
$('jsonBtn').addEventListener('click', () => {
  if (!current.verse) generate(false);
  keepLog(); download(`vole-manifest-${String(current.no).padStart(4, '0')}.json`, JSON.stringify(current, null, 2), 'application/json');
  copyNote.textContent = 'Manifest filed to your downloads.';
});
[tideSel, cargoSel, moodSel].forEach((el) => el.addEventListener('change', () => { gTide.textContent = tideSel.value; }));

// keep-button lives in export row: auto-keep on export; plus explicit keep via double-click on telegram
verseOut.parentElement.addEventListener('dblclick', () => { keepLog(); copyNote.textContent = 'Kept in the logbook (double-click works too).'; });

loadDraft();
if (!current.verse) generate(false); else { counter = Math.max(counter, current.no || 0); }
renderChoir(); renderLogs(); pressure(30);
