// Fable Foundry — steampunk generative fable press. No deps. localStorage only.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const moralEl = $('#moral'), countEl = $('#moralCount');
const pressBtn = $('#pressBtn'), restokeBtn = $('#restokeBtn'), saveBtn = $('#saveBtn');
const copyBtn = $('#copyBtn'), readBtn = $('#readBtn');
const storyEl = $('#story'), storyMeta = $('#storyMeta'), pressState = $('#pressState');
const needle = $('#needle'), gaugeArc = $('#gaugeArc'), steamBox = $('#steam');
const ingotsEl = $('#ingots'), ingotCount = $('#ingotCount');
const exportBtn = $('#exportBtn'), meltAllBtn = $('#meltAllBtn');
const toast = $('#toast');
const LEDGER_KEY = 'fable-foundry-ingots-v1', DRAFT_KEY = 'fable-foundry-draft-v1';

const PRESET_MORALS = [
  'Slow and steady outlasts haste.',
  'Pride clogs the finest gears.',
  'A small kindness keeps the boiler lit.',
  'Greed melts the hand that grabs.',
  'Listen before you tighten.',
  'Courage is fear, oiled and moving.',
  'Share your coal and the winter shortens.',
  'A polished gear still needs its teeth.',
];

// ---- seeded rng ----
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return(h^=h>>>16)>>>0}}
function sfc32(a,b,c,d){return()=>{a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=c<<21|c>>>11;c=c+t|0;return(t>>>0)/4294967296}}
function rngFrom(seed){const f=xmur3(seed);return sfc32(f(),f(),f(),f())}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---- story atoms ----
const CAST = {
  brass: ['the Brass Fox', 'Captain Mole of the dawn airship', 'the Gearwright Badger', 'the Lighthouse Tortoise', 'the Chimney Swift sisters', 'the young stoker Pip'],
  soot: ['the Soot Imp', 'the Rustwater Rat', 'the widowed boiler-widow Wren', 'old Furnace Grim', 'the ash-collecting orphan Nib', 'the blind ticket-clerk Mole'],
  aether: ['the Clockwork Nightingale', 'the Dirigible Spider', 'Professor Teacup', 'the automaton Owl', 'the cloud-shepherd Mouse', 'Baron von Balloon'],
};
const RIVALS = {
  brass: ['the impatient Hare of the express line', 'the boastful Iron Magpie', 'the toll-keeper Golem'],
  soot: ['the coal-baron Vex', 'the hunger that lived in the pipes', 'the landlord Engine'],
  aether: ['the hiccuping Weather Engine', 'the Very Serious Committee of Umbrellas', 'the mischievous Wind Sprites'],
};
const PLACES = ['the Cogwick Shipyards', 'the Emberlight Bazaar', 'the Sootfall Tunnels', 'the Aether Docks at dawn', 'the Brassbound Library', 'the Rustwater Canals', 'the Clocktower Undercroft'];
const RELICS = ['a cracked pressure gauge', 'an unlit storm lantern', 'a left-handed wrench', 'a bottle of last summer\u2019s lightning', 'a gear that turned backwards', 'a ticket to the city nobody built', 'a kettle that whistled in minor key'];
const OPENERS = [
  'In {place}, where the fog smells of oil and rain, {hero} found {relic}.',
  'Every whistle at {place} meant shift-change — except the one nobody blew. {Hero} followed it, and found {relic}.',
  'The papers said {place} ran like clockwork. {Hero} knew better: clockwork needs winding, and someone had stopped.',
];
const MIDDLES = {
  brass: [
    '{Rival} demanded the {relicShort} by nightfall, promising brass and threatening rust. {Hero} refused to hurry. Instead they oiled it, studied it, and carried it up the long stair one honest step at a time.',
    '{Rival} laughed at such slow work. “The foundry rewards the swift!” {Hero} only tightened one bolt, then the next — each true, each tested.',
  ],
  soot: [
    '{Rival} offered a bargain: warmth now for the {relicShort} forever. The pipes knocked like hungry knuckles. {Hero} sat with the cold a while, and chose the harder road home.',
    'So the winter came early, and {rival} collected debts in coal and tears. {Hero} gave away half their own ration to keep a stranger\u2019s lamp alive — and the dark noticed.',
  ],
  aether: [
    '{Rival} declared the {relicShort} “irregular” and scheduled it for deflation. {Hero} packed it with wishes, wound it backwards, and let it misbehave beautifully.',
    'There followed a chase involving three umbrellas, one runaway dirigible, and a very confused pigeon constable. Through it all {hero} held tight to the {relicShort} and giggled.',
  ],
};
const ENDINGS = {
  brass: [
    'At dawn the great engine coughed, seized — and turned. One true bolt held where a hundred hasty ones had stripped. {Place} breathed again, slow and certain.',
    'The {relicShort} did not make {hero} rich. It made them reliable — and when the storm came, everyone knocked on the door that always opened.',
  ],
  soot: [
    'Nothing gleamed the next morning. But the lamp was still lit, the debt unpaid yet unforgiven — and {hero} slept the deep sleep of the unashamed.',
    'The frost took its toll regardless. Yet in the thaw, neighbours remembered who had shared coal, and no lock could keep {hero} out in the cold again.',
  ],
  aether: [
    'The {relicShort} burst into a flock of brass butterflies, each carrying a different Tuesday. {Place} applauded, the pigeons filed a report, and teatime was declared eternal.',
    'From then on the clocks at {place} ran five minutes kind — fast enough for adventure, slow enough for cake.',
  ],
};
const TITLES = [
  'The {HeroShort} and the {RelicShort}',
  'What the {RelicShort} Taught',
  'Steam for {HeroShort}',
  'The Night the {PlaceShort} Stopped',
  'A Fable, Cast in {TemperWord}',
];

function temperWord(t){ return t === 'brass' ? 'Brass' : t === 'soot' ? 'Soot' : 'Aether'; }
function shortName(s){ return s.replace(/^(the|a|an)\s+/i,'').split(' of ')[0].split(' ').slice(-2).join(' '); }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function smelt(moral, temper, size, nonce){
  const seed = `${moral}||${temper}||${size}||${nonce}`;
  const r = rngFrom(seed);
  const hero = pick(r, CAST[temper]), rival = pick(r, RIVALS[temper]);
  const place = pick(r, PLACES), relic = pick(r, RELICS);
  const relicShort = relic.replace(/^a(n)?\s+/,'');
  const heroShort = shortName(hero), rivalShort = shortName(rival), placeShort = place.replace(/^the\s+/,'');
  const fill = (t) => t
    .replaceAll('{place}', place).replaceAll('{Place}', place).replaceAll('{PlaceShort}', placeShort)
    .replaceAll('{hero}', hero).replaceAll('{Hero}', cap(hero)).replaceAll('{HeroShort}', cap(heroShort))
    .replaceAll('{rival}', rival).replaceAll('{Rival}', cap(rival))
    .replaceAll('{relic}', relic).replaceAll('{relicShort}', relicShort)
    .replaceAll('{RelicShort}', cap(relicShort)).replaceAll('{TemperWord}', temperWord(temper));
  const title = fill(cap(pick(r, TITLES)));
  const paras = [fill(pick(r, OPENERS)), fill(pick(r, MIDDLES[temper]))];
  if (size !== 'spark') paras.push(fill(pick(r, MIDDLES[temper])));
  paras.push(fill(pick(r, ENDINGS[temper])));
  if (size === 'epic') paras.splice(2, 0, fill(pick(r, MIDDLES[temper])));
  // weave a keyword from the moral in, lightly
  const kw = (moral.replace(/[^\w\s]/g,'').split(/\s+/).filter(w => w.length > 3)[0] || 'steady').toLowerCase();
  paras[1] += ` Whatever ${kw} means, ${hero} carried it like coal: carefully, and without dropping it.`;
  const words = paras.join(' ').split(/\s+/).length;
  return { title, paras, moral: moral.trim(), temper, size, words, nonce };
}

// ---- state ----
let pressCount = 0;
let current = null;
let ingots = [];
try { ingots = JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]'); } catch { ingots = []; }
try {
  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (d) {
    if (d.moral) moralEl.value = d.moral;
    if (d.temper) $(`input[name="temper"][value="${d.temper}"]`)?.click();
    if (d.size) $(`input[name="size"][value="${d.size}"]`)?.click();
  }
} catch {}

function persistDraft(){
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ moral: moralEl.value, temper: temper(), size: size() }));
}
function persistIngots(){ localStorage.setItem(LEDGER_KEY, JSON.stringify(ingots)); }

const temper = () => ($('input[name="temper"]:checked') || {}).value || 'brass';
const size = () => ($('input[name="size"]:checked') || {}).value || 'ingot';

// ---- ui helpers ----
let toastT;
function say(msg){ toast.hidden = false; toast.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => toast.hidden = true, 2600); }
function updateCount(){ countEl.textContent = `${moralEl.value.length} / 220`; }
function puff(n = 10){
  for (let i = 0; i < n; i++){
    const p = document.createElement('span');
    p.className = 'puff';
    p.style.left = (8 + Math.random() * 84) + '%';
    p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    p.style.animationDelay = (Math.random() * .5) + 's';
    steamBox.append(p);
    setTimeout(() => p.remove(), 2400);
  }
}
function clank(){
  try {
    const ctx = clank.ctx || (clank.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const t = ctx.currentTime;
    [[160, .25], [90, .4], [1200, .06]].forEach(([f, g], i) => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = i === 2 ? 'square' : 'triangle'; o.frequency.value = f;
      gn.gain.setValueAtTime(g, t + i * .09); gn.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .35);
      o.connect(gn).connect(ctx.destination); o.start(t + i * .09); o.stop(t + i * .09 + .4);
    });
    // steam hiss
    const buf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * .12;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    src.connect(f).connect(ctx.destination); src.start(t);
  } catch {}
}

// ---- the press sequence ----
let pressing = false;
function smeltNow(variant = false){
  const moral = moralEl.value.trim();
  if (!moral) { say('The boiler needs moral ore — type or roll one first.'); moralEl.focus(); return; }
  if (pressing) return;
  pressing = true;
  if (!variant) pressCount = 0;
  document.body.classList.add('stoking');
  pressBtn.disabled = true;
  puff(12); clank();
  const steps = ['Stoking the boiler…', 'Pressure rising…', 'Gears at full spin…', 'Pouring the story…'];
  let s = 0, p = 0;
  pressState.textContent = steps[0];
  const tick = setInterval(() => {
    p = Math.min(100, p + 9 + Math.random() * 12);
    needle.style.transform = `rotate(${-70 + p * 1.5}deg)`;
    gaugeArc.style.strokeDashoffset = String(267 - (p / 100) * 220);
    if (s < steps.length - 1 && p > (s + 1) * 24) { s++; pressState.textContent = steps[s]; puff(4); }
    if (p >= 100) {
      clearInterval(tick);
      pressCount++;
      current = smelt(moral, temper(), size(), pressCount + (variant ? 0.5 : 0));
      reveal(current);
      document.body.classList.remove('stoking');
      pressing = false; pressBtn.disabled = false;
      needle.style.transform = 'rotate(-70deg)';
      setTimeout(() => gaugeArc.style.strokeDashoffset = '200', 600);
      pressState.textContent = `Cast № ${pressCount} — ${current.words} words, ${temperWord(current.temper)} temper.`;
      restokeBtn.disabled = saveBtn.disabled = copyBtn.disabled = readBtn.disabled = false;
    }
  }, 110);
}

function reveal(f){
  storyEl.classList.add('typing');
  storyEl.innerHTML = `<h3>${escapeHtml(f.title)}</h3><div class="body"></div>
    <p class="moral-stamp">⚙ Moral, stamped in brass: “${escapeHtml(f.moral)}”</p>`;
  const body = $('.body', storyEl);
  const full = f.paras.map(escapeHtml);
  let pi = 0, ci = 0, html = '';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    body.innerHTML = full.map(p => `<p>${p}</p>`).join('');
    storyEl.classList.remove('typing');
  } else {
    const iv = setInterval(() => {
      if (pi >= full.length) { clearInterval(iv); storyEl.classList.remove('typing'); return; }
      ci += 3;
      const slice = full[pi].slice(0, ci);
      body.innerHTML = html + `<p>${slice}▌</p>`;
      if (ci >= full[pi].length) { html += `<p>${full[pi]}</p>`; body.innerHTML = html; pi++; ci = 0; }
    }, 24);
  }
  storyMeta.textContent = `${f.words} words · ~${Math.max(1, Math.round(f.words / 180))} min read · ${temperWord(f.temper)} / ${f.size}`;
  storyEl.focus({ preventScroll: false });
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---- ingots ----
function renderIngots(){
  ingotCount.textContent = String(ingots.length);
  exportBtn.disabled = meltAllBtn.disabled = ingots.length === 0;
  if (!ingots.length) {
    ingotsEl.innerHTML = '<li class="ingot-empty">No ingots yet — smelt a fable and press “Cast ingot” (S).</li>';
    return;
  }
  ingotsEl.innerHTML = '';
  ingots.slice().reverse().forEach((g) => {
    const li = document.createElement('li');
    li.className = 'ingot'; li.tabIndex = 0;
    li.dataset.id = g.id;
    li.setAttribute('aria-label', `Ingot ${g.no}: ${g.title}. Moral: ${g.moral}`);
    li.innerHTML = `<span class="ingot-no">INGOT № ${g.no}</span><h3></h3>
      <p class="ingot-moral"></p><span class="ingot-date"></span>
      <div class="ingot-btns">
        <button type="button" class="btn" data-act="read">Read ⏎</button>
        <button type="button" class="btn" data-act="copy">Copy</button>
        <button type="button" class="btn" data-act="melt">Melt ⌫</button>
      </div>`;
    $('h3', li).textContent = g.title;
    $('.ingot-moral', li).textContent = '“' + g.moral + '”';
    $('.ingot-date', li).textContent = new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` · ${g.words} wds`;
    li.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) { readIngot(g.id); return; }
      ingotAction(g.id, b.dataset.act);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target === li) { e.preventDefault(); readIngot(g.id); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === li) { e.preventDefault(); meltIngot(g.id, li); }
    });
    ingotsEl.append(li);
  });
}
function ingotAction(id, act){
  if (act === 'read') readIngot(id);
  else if (act === 'copy') {
    const g = ingots.find(x => x.id === id);
    copyText(`${g.title}\n\n${g.paras.join('\n\n')}\n\nMoral: ${g.moral}`);
  }
  else if (act === 'melt') meltIngot(id, $(`[data-id="${id}"]`));
}
function readIngot(id){
  const g = ingots.find(x => x.id === id);
  if (!g) return;
  current = g;
  reveal(g);
  restokeBtn.disabled = saveBtn.disabled = copyBtn.disabled = readBtn.disabled = false;
  say(`Ingot № ${g.no} back on the reading stand.`);
}
function meltIngot(id, node){
  ingots = ingots.filter(x => x.id !== id);
  persistIngots(); renderIngots();
  say('Ingot melted back into the crucible.');
  if (node?.nextElementSibling) node.nextElementSibling.focus?.();
  else if (node?.previousElementSibling) node.previousElementSibling.focus?.();
}
function castIngot(){
  if (!current) { say('Nothing to cast — smelt a fable first.'); return; }
  const no = (ingots.at(-1)?.no || 0) + 1;
  ingots.push({ ...current, id: 'g' + Date.now().toString(36), no, at: Date.now() });
  persistIngots(); renderIngots();
  puff(6);
  say(`Cast as ingot № ${no}.`);
}
async function copyText(t){
  try { await navigator.clipboard.writeText(t); say('Copied to clipboard.'); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); say('Copied to clipboard.'); }
    catch { say('Copy blocked — select the story text manually.'); }
    ta.remove();
  }
}

// ---- events ----
moralEl.addEventListener('input', () => { updateCount(); persistDraft(); });
$$('input[name="temper"], input[name="size"]').forEach(i => i.addEventListener('change', persistDraft));
pressBtn.addEventListener('click', () => smeltNow(false));
restokeBtn.addEventListener('click', () => smeltNow(true));
saveBtn.addEventListener('click', castIngot);
copyBtn.addEventListener('click', () => current && copyText(`${current.title}\n\n${current.paras.join('\n\n')}\n\nMoral: ${current.moral}`));
readBtn.addEventListener('click', () => {
  if (!current) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`${current.title}. ${current.paras.join(' ')} Moral: ${current.moral}`);
  u.rate = .95; speechSynthesis.speak(u); say('Reading aloud — Esc to stop.');
});
$('#randomMoral').addEventListener('click', () => {
  moralEl.value = pick(Math.random, PRESET_MORALS);
  updateCount(); persistDraft(); moralEl.focus(); say('Fresh moral ore loaded.');
});
$$('.chip').forEach(c => c.addEventListener('click', () => {
  moralEl.value = c.dataset.moral; updateCount(); persistDraft(); moralEl.focus();
}));
exportBtn.addEventListener('click', () => {
  const txt = ingots.map(g => `INGOT № ${g.no} — ${g.title}\nMoral: ${g.moral}\n${g.paras.join('\n\n')}\n${'—'.repeat(40)}`).join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'fable-foundry-ingots.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  say('Ingots exported as .txt.');
});
meltAllBtn.addEventListener('click', () => {
  if (!ingots.length) return;
  if (confirm('Melt ALL ingots back into the crucible?')) {
    ingots = []; persistIngots(); renderIngots(); say('All ingots melted.');
  }
});

// ledger
const ledgerToggle = $('#ledgerToggle'), ledgerBody = $('#ledgerBody');
function setLedger(open){
  ledgerBody.hidden = !open;
  ledgerToggle.setAttribute('aria-expanded', String(open));
  ledgerToggle.innerHTML = `Shortcut ledger <kbd>?</kbd> ${open ? '▴' : '▾'}`;
}
ledgerToggle.addEventListener('click', () => setLedger(ledgerBody.hidden));

// ---- keyboard map (full keyboard-only operation) ----
function cycleRadio(name){
  const opts = $$((`input[name="${name}"]`));
  const i = opts.findIndex(o => o.checked);
  opts[(i + 1) % opts.length].click();
  say(`${name === 'temper' ? 'Temper' : 'Size'}: ${opts[(i + 1) % opts.length].value}.`);
}
function focusIngot(dir){
  const items = $$('#ingots .ingot');
  if (!items.length) { say('No ingots yet.'); return; }
  const idx = items.indexOf(document.activeElement);
  const next = items[(idx + dir + items.length) % items.length];
  next.focus();
}
document.addEventListener('keydown', (e) => {
  const inField = /^(TEXTAREA|INPUT)$/.test(document.activeElement?.tagName || '');
  if (e.key === 'Escape') {
    speechSynthesis?.cancel?.();
    if (!ledgerBody.hidden) setLedger(false);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); smeltNow(false); return; }
  if (inField) return; // single-letter shortcuts only outside text fields
  const k = e.key.toLowerCase();
  if (e.key === '/') { e.preventDefault(); moralEl.focus(); moralEl.select(); }
  else if (e.key === '?') setLedger(ledgerBody.hidden);
  else if (k === 'r') $('#randomMoral').click();
  else if (k === 't') cycleRadio('temper');
  else if (k === 'l') cycleRadio('size');
  else if (k === 'x') { if (!restokeBtn.disabled) smeltNow(true); }
  else if (k === 's') { if (!saveBtn.disabled) castIngot(); }
  else if (k === 'c') { if (!copyBtn.disabled) copyBtn.click(); }
  else if (e.key === '[') focusIngot(-1);
  else if (e.key === ']') focusIngot(1);
  else if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.classList?.contains('ingot')) {
    // handled on the node itself
  }
});

// ---- init ----
updateCount();
renderIngots();
console.log('Fable Foundry ready — keyboard: / R T L X S C [ ] ? Esc, Ctrl+Enter to smelt.');
