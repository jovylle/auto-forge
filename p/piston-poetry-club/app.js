// Piston Poetry Club — steam-driven generative verse forge
// Features: piston meter | verse engine | poetry bellows. No images, canvas steam only.

const $ = (s) => document.querySelector(s);
const pressureNum = $('#pressureNum'), gaugeFill = $('#gaugeFill'),
  pressureState = $('#pressureState'), meterHint = $('#meterHint'),
  engine = $('#engine'), poem = $('#poem'), verseNo = $('#verseNo'),
  verseKpa = $('#verseKpa'), verseMeta = $('#verseMeta'),
  forgeBtn = $('#forgeBtn'), rerollBtn = $('#rerollBtn'),
  pumpBtn = $('#pumpBtn'), ventBtn = $('#ventBtn'), autoBtn = $('#autoBtn'),
  stoke = $('#stoke'), leak = $('#leak'), stokeVal = $('#stokeVal'), leakVal = $('#leakVal'),
  bellowsState = $('#bellowsState'), bellowsVisual = $('#bellowsVisual'),
  shelf = $('#shelf'), emptyNote = $('#emptyNote'), countLabel = $('#countLabel'),
  toast = $('#toast'), clockEl = $('#clock');

let pressure = 8, verses = 0, form = 'haiku', auto = false, pumping = false;
try { verses = JSON.parse(localStorage.getItem('ppc-shelf') || '[]'); } catch { verses = []; }
if (!Array.isArray(verses)) verses = [];

// ---- vocabulary: neon-edo word banks ----
const K5 = ['neon rain','chrome koi','paper crane','lantern smoke','ghost circuit','silent torii','ash blossom','tin temple','midnight train','solder moon','paper fan','rust sparrow','glass river','iron blossom','signal crow'];
const K7 = ['a plasma torii hums softly','steam folds the sleepless ward','the vending god blinks awake','circuits dream of lotus ponds','a fox of wires crosses rain','lanterns drown in data rivers','the piston choir breathes heat','neon moss eats the shrine wall','a kettle sings in binary','ghost drums shake the arcade'];
const KOD = ['overdrive lotus detonates','a chrome dragon eats the grid','plasma blossoms burn the sky','the shogun mainframe bows low','neon koi ignite the river','a ghost reactor blooms red'];
const FREE_A = ['Listen —', 'At 3AM the ward exhales:', 'Transmission from the boiler room —', 'The pistons confessed:'];
const FREE_B = ['the city is a kettle left singing', 'every lantern hides a small reactor', 'rain compiles on the temple roof', 'we soldered our shadows to foxes', 'the night-shift gods drink steam', 'a torii of static guards the alley'];
const FREE_C = ['and still the blossoms compile.', 'bless this beautiful malfunction.', 'the steam remembers your name.', 'wake up, sleeper circuit.', 'pray in binary, bloom in chrome.'];
const KANJI = ['蒸気', '電脳', '俳句', '鉄魂', '灯火', '回路', '桜電', '汽魂'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const kanjiNo = (n) => '第' + ['零','一','二','三','四','五','六','七','八','九'][Math.min(9,n % 10)] + (n > 9 ? n + '号' : '号');

function makeVerse(p) {
  const hot = p >= 75;
  const wild = () => hot && Math.random() < 0.45;
  if (form === 'haiku') {
    return [wild() ? pick(KOD) : pick(K5), wild() ? pick(KOD) : pick(K7), wild() ? pick(KOD) : pick(K5)];
  }
  if (form === 'tanka') {
    return [pick(K5), pick(K7), pick(K5), wild() ? pick(KOD) : pick(K7), wild() ? pick(KOD) : pick(K7)];
  }
  return [pick(FREE_A), wild() ? pick(KOD) : pick(FREE_B), wild() ? pick(KOD) : pick(FREE_C)];
}

let current = null;
function renderVerse(lines, kpa) {
  poem.innerHTML = '';
  lines.forEach((l, i) => {
    const s = document.createElement('span');
    s.className = 'line'; s.style.animationDelay = (i * 0.35) + 's';
    s.textContent = l;
    poem.appendChild(s);
    setTimeout(() => { s.classList.add('struck'); clack(); puff(10); }, i * 350);
  });
  const n = (JSON.parse(localStorage.getItem('ppc-count') || '0')) + 1;
  localStorage.setItem('ppc-count', JSON.stringify(n));
  verseNo.textContent = kanjiNo(n) + ' ' + pick(KANJI);
  verseKpa.textContent = kpa + ' kPa';
  verseMeta.textContent = `— ${form} · forged at ${kpa} kPa · ${new Date().toLocaleTimeString()} —`;
  countLabel.textContent = n + ' verses forged';
}

function forge() {
  if (pressure < 25) { say('Not enough steam — pump past 25 kPa! ふいごを踏め'); buzz(); return; }
  pressure = Math.max(0, pressure - 25);
  current = makeVerse(pressure + 25);
  renderVerse(current, Math.round(pressure + 25));
  say(pressure + 25 >= 75 ? 'OVERDRIVE VERSE! 超電導詠唱' : 'Verse hammered out! ガシャン');
}
function reroll() {
  if (!current) { say('Forge a verse first'); return; }
  current = makeVerse(pressure);
  renderVerse(current, Math.round(pressure));
  say('Re-rolled the same steam ↻');
}

// ---- piston meter loop ----
function tick() {
  const s = +stoke.value / 100, l = +leak.value / 100;
  pressure += (pumping ? 14 + s * 14 : 0) * 0.12;
  pressure += (auto ? 2.2 + s * 2 : 0) * 0.12;
  pressure -= (0.55 + l * 3.2) * 0.12;
  pressure = Math.max(0, Math.min(100, pressure));
  if (pressure >= 97) vent(true); // overpressure blowoff
  paint();
}
function paint() {
  const p = Math.round(pressure);
  pressureNum.textContent = p;
  gaugeFill.style.height = p + '%';
  const spd = Math.max(0.25, 1.8 - p / 60);
  engine.style.setProperty('--spd', 'x');
  engine.querySelectorAll('.piston').forEach(el => el.style.setProperty('--spd', spd + 's'));
  engine.classList.toggle('hot', p >= 75);
  const st = p < 10 ? 'COLD' : p < 30 ? 'WARMING' : p < 75 ? 'HAMMERING' : 'OVERDRIVE';
  pressureState.textContent = st;
  meterHint.textContent =
    p < 10 ? 'Cold iron. Pump the bellows to wake the pistons.' :
    p < 25 ? 'Warming… a few more pumps and you can forge (25 kPa).' :
    p < 75 ? 'Hammering rhythm! Forge now, or push to OVERDRIVE for wild diction.' :
    'OVERDRIVE! 超加圧 — forge for chrome dragons & plasma blossoms, or vent!';
  forgeBtn.disabled = p < 25;
  forgeBtn.innerHTML = p < 25
    ? `⚒ NEED ${25 - p} MORE kPa <small>叩く · space</small>`
    : `⚒ FORGE VERSE <small>叩く · space</small>`;
}
setInterval(tick, 120);

// ---- poetry bellows ----
function pump() { pressure = Math.min(100, pressure + 2.2 + (+stoke.value / 100) * 2.4); puff(3); paint(); }
pumpBtn.addEventListener('click', () => { pump(); say('Puff! シュッ +steam'); });
let holdT = null;
const startHold = (e) => { e.preventDefault(); pumping = true; bellowsState.textContent = '送風 blowing!'; squeeze(true); };
const endHold = () => { pumping = false; bellowsState.textContent = 'ふいご idle'; squeeze(false); };
pumpBtn.addEventListener('pointerdown', startHold);
addEventListener('pointerup', endHold);
bellowsVisual.addEventListener('pointerdown', startHold);
bellowsVisual.addEventListener('pointerup', endHold);
// drag across bellows = pump
let lastX = null;
bellowsVisual.addEventListener('pointermove', (e) => {
  if (!pumping) return;
  if (lastX !== null && Math.abs(e.clientX - lastX) > 6) pump();
  lastX = e.clientX;
});
bellowsVisual.addEventListener('pointerleave', () => lastX = null);
function squeeze(on) {
  bellowsVisual.querySelector('.bellow-ribs').style.transform = on ? 'scaleX(.72)' : 'scaleX(1)';
}
stoke.addEventListener('input', () => stokeVal.textContent = stoke.value);
leak.addEventListener('input', () => leakVal.textContent = leak.value);
function vent(autoBlow = false) {
  pressure = Math.max(0, pressure - (autoBlow ? 45 : 30));
  document.body.classList.remove('venting'); void document.body.offsetWidth;
  document.body.classList.add('venting');
  puff(40); hiss();
  say(autoBlow ? 'OVERPRESSURE BLOWOFF! 暴走排気' : 'Vented. プシュー');
  paint();
}
ventBtn.addEventListener('click', () => vent(false));
autoBtn.addEventListener('click', () => {
  auto = !auto;
  autoBtn.textContent = auto ? '◉ auto-stoker: ON' : '◉ auto-stoker: off';
  autoBtn.setAttribute('aria-pressed', auto);
  say(auto ? 'Auto-stoker engaged 自動送風' : 'Auto-stoker cut');
});
forgeBtn.addEventListener('click', forge);
rerollBtn.addEventListener('click', reroll);

document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); form = b.dataset.form;
  say(`Form: ${form} ${form === 'haiku' ? '俳句' : form === 'tanka' ? '短歌' : '電脳'}`);
}));

// ---- anthology (localStorage) ----
function saveShelf() { localStorage.setItem('ppc-shelf', JSON.stringify(verses)); paintShelf(); }
function paintShelf() {
  shelf.innerHTML = '';
  emptyNote.style.display = verses.length ? 'none' : 'block';
  verses.slice().reverse().forEach((v, ri) => {
    const i = verses.length - 1 - ri;
    const li = document.createElement('li');
    li.innerHTML = `<div class="jp-line">${v.lines.map(l => escapeHtml(l)).join('<br>')}</div>
      <div class="meta"><span>${v.form} · ${v.kpa} kPa</span><button data-i="${i}">burn ✕</button></div>`;
    shelf.appendChild(li);
  });
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
shelf.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  verses.splice(+b.dataset.i, 1); saveShelf(); say('Verse burned 灰');
});
$('#keepBtn').addEventListener('click', () => {
  if (!current) { say('Nothing to keep — forge first'); return; }
  verses.push({ lines: current, form, kpa: verseKpa.textContent, at: Date.now() });
  if (verses.length > 24) verses.shift();
  saveShelf(); say('Pressed into the anthology ♥ 句集入り');
});
$('#copyBtn').addEventListener('click', async () => {
  if (!current) { say('Nothing to copy'); return; }
  try { await navigator.clipboard.writeText(current.join('\n')); say('Copied to clipboard ⧉'); }
  catch { say('Copy blocked — select the verse manually'); }
});
$('#speakBtn').addEventListener('click', () => {
  if (!current) return;
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(current.join('. '))); }
  catch { say('Recital unavailable here'); }
});
$('#exportBtn').addEventListener('click', () => {
  if (!verses.length) { say('Anthology is empty'); return; }
  const txt = verses.map((v, i) => `--- ${i + 1}. [${v.form} ${v.kpa}]\n${v.lines.join('\n')}`).join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['PISTON POETRY CLUB — 句集\n\n' + txt], { type: 'text/plain' }));
  a.download = 'piston-poetry-anthology.txt'; a.click();
  say('Anthology exported ↓');
});
$('#clearBtn').addEventListener('click', () => {
  if (!verses.length || !confirm('Burn the whole anthology?')) return;
  verses = []; saveShelf(); say('Anthology burned to ash 灰');
});

// ---- keyboard ----
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { startHold(e); }
  if (e.key === 'f' || e.key === 'F') forge();
  if (e.key === 'v' || e.key === 'V') vent(false);
});
addEventListener('keyup', (e) => { if (e.code === 'Space') endHold(); });

// ---- steam canvas (CSS/canvas only, no images) ----
const cv = $('#steam'), ctx = cv.getContext('2d');
let parts = [];
function size() { cv.width = innerWidth; cv.height = innerHeight; }
size(); addEventListener('resize', size);
function puff(n = 6) {
  for (let i = 0; i < n; i++) parts.push({
    x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.75,
    vx: (Math.random() - 0.5) * 1.4, vy: -1 - Math.random() * 2,
    r: 6 + Math.random() * 22, a: 0.28, hue: Math.random() < 0.3 ? '255,45,120' : '0,240,255'
  });
  if (parts.length > 220) parts = parts.slice(-220);
}
(function loop() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  parts.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.r += 0.35; p.a *= 0.985;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
    ctx.fillStyle = `rgba(${p.hue},${p.a.toFixed(3)})`; ctx.fill();
  });
  parts = parts.filter(p => p.a > 0.02);
  requestAnimationFrame(loop);
})();

// ---- tiny synth: clack / hiss / buzz (no assets) ----
let AC = null;
const ac = () => (AC ||= new (window.AudioContext || window.webkitAudioContext)());
function clack() {
  try { const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 180 + Math.random() * 300;
    g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.12); } catch {}
}
function hiss() {
  try { const c = ac(), b = c.createBuffer(1, 8000, 8000), d = b.getChannelData(0);
    for (let i = 0; i < 8000; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / 8000);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = 0.12;
    s.connect(g).connect(c.destination); s.start(); } catch {}
}
function buzz() { try { const c = ac(), o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 90; g.gain.value = 0.06; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.18); } catch {} }

// ---- misc ----
let toastT = null;
function say(msg) {
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2200);
}
setInterval(() => {
  const d = new Date();
  clockEl.textContent = '霓 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}, 1000);

paintShelf(); paint();
try { countLabel.textContent = (JSON.parse(localStorage.getItem('ppc-count') || '0')) + ' verses forged'; } catch {}
console.log('piston-poetry-club ready — pump, forge, vent');
