// Inkwell Observatory — star notes. Plain ES module, no deps.
const $ = (s) => document.querySelector(s);
const canvas = $('#sky'), ctx = canvas.getContext('2d');
const toastEl = $('#toast'), saveState = $('#save-state');
const LS_KEY = 'inkwell-observatory-v1';
const SOUND_KEY = 'inkwell-sound';

let stars = [];          // {id,x,y,title,body,tag,size,created}
let sel = -1;            // selected index into filtered()
let pendingDrop = null;  // {x,y} normalized from sky click
let editingId = null;
let query = '', tagFilter = '';
let soundOn = (localStorage.getItem(SOUND_KEY) ?? '1') === '1';
let dust = [];           // ambient particles
let meteors = [];
let t0 = performance.now();

/* ---------- sound: synthesized WebAudio, no assets ---------- */
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, dur = 0.12, type = 'sine', gain = 0.08, when = 0, slide = 0) {
  if (!soundOn) return;
  try {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + when);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + when + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + when);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.05);
  } catch { /* audio unavailable: stay silent */ }
}
const sfx = {
  pin()   { tone(392, .14, 'triangle', .09); tone(587.3, .2, 'sine', .07, .07); tone(784, .3, 'sine', .05, .14); },
  select(){ tone(660, .07, 'square', .025); },
  read()  { tone(523, .1, 'triangle', .06); tone(659, .12, 'triangle', .06, .08); },
  burn()  { tone(220, .25, 'sawtooth', .06, 0, -160); },
  err()   { tone(140, .15, 'square', .05); },
  drift() { tone(330 + Math.random() * 300, .18, 'sine', .06, 0, 120); },
  share() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .12, 'triangle', .06, i * .06)); },
  key()   { tone(880, .03, 'square', .012); },
};

/* ---------- persistence + share-hash ---------- */
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(stars));
  saveState.textContent = `saved ✓ ${stars.length} star${stars.length === 1 ? '' : 's'}`;
}
function load() {
  // 1. shared sky in URL hash wins
  if (location.hash.length > 1) {
    try {
      const raw = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
      if (Array.isArray(raw)) { stars = raw.filter(validStar).slice(0, 300); save(); toast('Sky recovered from shared link ★'); return; }
    } catch { /* fall through to localStorage */ }
  }
  try { stars = JSON.parse(localStorage.getItem(LS_KEY) || '[]').filter(validStar); }
  catch { stars = []; }
  if (!stars.length) seed();
}
function validStar(s) { return s && typeof s.x === 'number' && typeof s.y === 'number' && typeof s.title === 'string'; }
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function seed() {
  const samples = [
    ['Vega over the laundry line', 'The night hums when the machines stop. I am small and mostly okay with that.', 'orbit', 4, .22, .3],
    ['Things the ink won\'t say', 'Draft of the apology letter. Version nine. Shorter this time: I was wrong, you were right, the sky agrees.', 'grief', 3, .62, .42],
    ['Grocery constellation', 'Oats. Lamp oil. Black ink. Something green that is still alive on purpose.', 'todo', 2, .78, .66],
    ['Static from Moth Radio', 'Heard a voice between stations reading coordinates. Wrote them here so I don\'t forget: 43°N, look up.', 'static', 5, .4, .68],
  ];
  stars = samples.map(([title, body, tag, size, x, y]) => ({ id: uid(), title, body, tag, size, x, y, created: Date.now() }));
  save();
}

/* ---------- filtering ---------- */
function filtered() {
  const q = query.trim().toLowerCase();
  return stars
    .map((s, i) => ({ s, i }))
    .filter(({ s }) =>
      (!tagFilter || s.tag === tagFilter) &&
      (!q || (s.title + ' ' + s.body + ' ' + (s.tag || '')).toLowerCase().includes(q)));
}
function allTags() { return [...new Set(stars.map(s => (s.tag || '').trim()).filter(Boolean))].sort(); }

/* ---------- canvas ---------- */
function fit() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(300, r.width * dpr); canvas.height = Math.max(200, r.height * dpr);
}
window.addEventListener('resize', () => { fit(); });
function px(s) { return { x: s.x * canvas.width, y: s.y * canvas.height }; }

function initDust() {
  dust = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .3, p: Math.random() * 6.28, sp: .2 + Math.random() * .8 }));
}
function draw(now) {
  const t = (now - t0) / 1000, W = canvas.width, H = canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0a12'); g.addColorStop(.6, '#070608'); g.addColorStop(1, '#0d0906');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // moon smudge
  const mx = W * .84, my = H * .18, mr = Math.min(W, H) * .09;
  const mg = ctx.createRadialGradient(mx, my, mr * .2, mx, my, mr * 3);
  mg.addColorStop(0, 'rgba(232,220,195,.20)'); mg.addColorStop(1, 'transparent');
  ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(232,220,195,.85)'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(7,6,8,.25)'; ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .15, mr * .92, 0, 7); ctx.fill();
  // dust
  ctx.fillStyle = '#fff';
  for (const d of dust) {
    const tw = .25 + .55 * Math.abs(Math.sin(t * d.sp + d.p));
    ctx.globalAlpha = tw * .7; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r * (W / 900 + .6), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const list = filtered();
  const vis = new Map(list.map((e, k) => [e.i, k]));
  // constellation lines: same-tag pairs within range
  ctx.lineWidth = Math.max(1, W / 900);
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const A = list[a].s, B = list[b].s;
    if ((A.tag || '') !== (B.tag || '') || !A.tag) continue;
    const pa = px(A), pb = px(B), d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
    if (d < Math.min(W, H) * .45) {
      ctx.strokeStyle = 'rgba(201,162,39,.35)'; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // stars
  stars.forEach((s, i) => {
    if (!vis.has(i)) return; // filtered out
    const k = vis.get(i), { x, y } = px(s);
    const base = (2 + s.size * 1.7) * (W / 900 + .6);
    const tw = .7 + .3 * Math.sin(t * 2 + i * 1.7);
    // halo
    const halo = ctx.createRadialGradient(x, y, 0, x, y, base * 3.2);
    halo.addColorStop(0, 'rgba(255,233,168,.5)'); halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, base * 3.2, 0, 7); ctx.fill();
    // cross sparkle for big stars
    if (s.size >= 4) {
      ctx.strokeStyle = 'rgba(255,233,168,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - base * 2.4, y); ctx.lineTo(x + base * 2.4, y);
      ctx.moveTo(x, y - base * 2.4); ctx.lineTo(x, y + base * 2.4); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,246,220,${.65 + .35 * tw})`;
    ctx.beginPath(); ctx.arc(x, y, base * .55 * tw + .8, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0a12'; ctx.beginPath(); ctx.arc(x, y, base * .16, 0, 7); ctx.fill(); // ink core
    if (pendingDrop && editingId === null) { /* reticle drawn below */ }
    if (k === sel) {
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, base * 1.5 + 6 + 2 * Math.sin(t * 4), 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  // pending drop reticle
  if (pendingDrop) {
    const x = pendingDrop.x * W, y = pendingDrop.y * H;
    ctx.strokeStyle = '#d0543a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 14 + 3 * Math.sin(t * 5), 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 8, y); ctx.moveTo(x + 8, y); ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 8); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 20); ctx.stroke();
  }
  // meteors
  meteors = meteors.filter(m => m.life > 0);
  for (const m of meteors) {
    m.x += m.vx; m.y += m.vy; m.life -= .02;
    ctx.strokeStyle = `rgba(255,240,200,${Math.max(0, m.life)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8); ctx.stroke();
  }
  if (Math.random() < .004 && !document.hidden) meteors.push({ x: Math.random() * W, y: H * .1, vx: 6 + Math.random() * 5, vy: 2.5 + Math.random() * 2, life: 1 });
  requestAnimationFrame(draw);
}

/* ---------- render DOM ---------- */
function render() {
  const list = filtered();
  if (sel >= list.length) sel = list.length - 1;
  $('#star-count').textContent = stars.length;
  $('#log-count').textContent = list.length === stars.length ? `${stars.length}` : `${list.length}/${stars.length}`;
  // tag dropdown + datalist
  const tags = allTags(), tf = $('#tagfilter'), dl = $('#taglist');
  const cur = tagFilter;
  tf.innerHTML = '<option value="">all</option>' + tags.map(t => `<option ${t === cur ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
  dl.innerHTML = tags.map(t => `<option value="${escapeHtml(t)}">`).join('');
  // logbook
  const ol = $('#logbook'); ol.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = stars.length ? 'No stars match — loosen the search.' : 'The sky is empty. Press N and pin the first star.';
    ol.appendChild(li);
  }
  list.forEach(({ s, i }, k) => {
    const li = document.createElement('li');
    li.tabIndex = 0; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', k === sel ? 'true' : 'false');
    li.dataset.k = k;
    li.innerHTML = `<span class="t">${escapeHtml(s.title || '(untitled)')}</span>
      <span class="m">★ mag ${s.size} · ${escapeHtml(s.tag || 'adrift')} · ${new Date(s.created).toLocaleDateString()}</span>
      <button class="x" aria-label="Burn note ${escapeHtml(s.title || '')}" title="Burn (D)">×</button>`;
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('x')) { burn(i); return; }
      sel = k; sfx.select(); openReader(); render();
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sel = k; sfx.read(); openReader(); render(); }
      if (e.key.toLowerCase() === 'e') { e.preventDefault(); loadIntoEditor(i); }
      if (e.key === 'Delete' || e.key.toLowerCase() === 'd') { e.preventDefault(); burn(i); }
    });
    li.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); burn(i); });
    ol.appendChild(li);
  });
  $('#btn-sound').setAttribute('aria-pressed', String(soundOn));
  $('#btn-sound').firstChild.textContent = soundOn ? '♪ Sound ' : '✕ Muted ';
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- toast + live feedback ---------- */
let toastT;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ---------- editor ---------- */
function loadIntoEditor(i) {
  const s = stars[i]; if (!s) return;
  editingId = s.id;
  $('#editor-title').value = s.title; $('#editor-body').value = s.body;
  $('#editor-tag').value = s.tag || ''; $('#editor-size').value = s.size;
  $('#editor-mode').textContent = 'editing';
  pendingDrop = { x: s.x, y: s.y };
  $('#editor-title').focus(); sfx.key();
  toast('Loaded into editor — Ctrl+Enter re-pins it');
}
function clearEditor() {
  editingId = null; pendingDrop = null;
  $('#editor-title').value = ''; $('#editor-body').value = '';
  $('#editor-tag').value = ''; $('#editor-size').value = 3;
  $('#editor-mode').textContent = 'new star';
}
function pinFromEditor() {
  const title = $('#editor-title').value.trim() || '(untitled star)';
  const body = $('#editor-body').value.trim();
  if (!body && !$('#editor-title').value.trim()) { toast('Write something first — even a fragment.'); sfx.err(); $('#editor-title').focus(); return; }
  const tag = $('#editor-tag').value.trim().toLowerCase().slice(0, 24);
  const size = +$('#editor-size').value || 3;
  if (editingId) {
    const s = stars.find(s => s.id === editingId);
    if (s) { Object.assign(s, { title, body, tag, size }); if (pendingDrop) { s.x = pendingDrop.x; s.y = pendingDrop.y; } toast('Star re-inked ★'); }
    const fk = filtered().findIndex(e => e.s.id === editingId); if (fk >= 0) sel = fk;
  } else {
    const p = pendingDrop ?? { x: .08 + Math.random() * .84, y: .1 + Math.random() * .75 };
    stars.push({ id: uid(), title, body, tag, size, x: +p.x.toFixed(4), y: +p.y.toFixed(4), created: Date.now() });
    const fk = filtered().findIndex(e => e.s.title === title && e.s.body === body);
    sel = fk >= 0 ? fk : filtered().length - 1;
    toast(tag ? `Pinned to constellation “${tag}” ★` : 'Pinned a lone star ★');
  }
  sfx.pin(); clearEditor(); save(); render(); canvas.focus({ preventScroll: true });
}

/* ---------- reader modal ---------- */
function currentEntry() { const l = filtered(); return l[sel] ?? l[0]; }
function openReader() {
  const e = currentEntry(); if (!e) { toast('No star to read — pin one first (N).'); return; }
  sel = filtered().indexOf(e);
  const { s, i } = e;
  $('#reader-kicker').textContent = `★ mag ${s.size} · ${s.tag ? 'constellation ' + s.tag : 'a lone star'}`;
  $('#reader-title').textContent = s.title || '(untitled)';
  $('#reader-body').textContent = s.body || '(this star is silent)';
  $('#reader-meta').textContent = `charted ${new Date(s.created).toLocaleString()} · ${Math.round(s.x * 100)},${Math.round(s.y * 100)} in the inkwell`;
  $('#reader').hidden = false; sfx.read();
  $('#reader-close').focus();
  $('#reader').dataset.idx = i;
}
function closeReader() { $('#reader').hidden = true; canvas.focus({ preventScroll: true }); }
function stepReader(d) {
  const l = filtered(); if (!l.length) return;
  sel = (sel + d + l.length) % l.length; render(); openReaderKeep();
}
function openReaderKeep() {
  const e = currentEntry(); if (!e) return;
  const { s, i } = e;
  $('#reader-kicker').textContent = `★ mag ${s.size} · ${s.tag ? 'constellation ' + s.tag : 'a lone star'}`;
  $('#reader-title').textContent = s.title || '(untitled)';
  $('#reader-body').textContent = s.body || '(this star is silent)';
  $('#reader-meta').textContent = `charted ${new Date(s.created).toLocaleString()} · ${Math.round(s.x * 100)},${Math.round(s.y * 100)} in the inkwell`;
  $('#reader').dataset.idx = i; sfx.select();
}

function burn(i) {
  const s = stars[i]; if (!s) return;
  const doit = () => {
    stars.splice(i, 1); sfx.burn(); toast(`Burned “${s.title || 'untitled'}” — ash to ash`);
    if (!$('#reader').hidden) $('#reader').hidden = true;
    if (editingId === s.id) clearEditor();
    sel = Math.max(0, sel - 1); save(); render();
  };
  // keyboard-friendly confirm: double-press D within 3s burns
  if (burn.armed === s.id) { burn.armed = null; doit(); }
  else { burn.armed = s.id; toast('Press D again (or Burn) to confirm — stars burn forever'); sfx.err(); setTimeout(() => burn.armed = null, 3000); }
}

/* ---------- share / export ---------- */
async function shareLink() {
  history.replaceState(null, '', '#' + btoa(unescape(encodeURIComponent(JSON.stringify(stars)))));
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast(`Share link copied — ${stars.length} stars in the URL ★`); }
  catch { prompt('Copy your sky link:', url); }
  sfx.share();
}
function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportMD() {
  const md = `# Inkwell Observatory — ${stars.length} stars\n\n` + stars.map(s =>
    `## ★ ${s.title || '(untitled)'} *(mag ${s.size}${s.tag ? ' · ' + s.tag : ''})*\n\n${s.body || '_silent_'}\n\n_charted ${new Date(s.created).toLocaleString()}_\n`).join('\n---\n\n');
  download('inkwell-observatory.md', md, 'text/markdown'); toast('Logbook exported as Markdown ⬇'); sfx.share();
}
function exportPNG() {
  const a = document.createElement('a');
  a.download = 'inkwell-sky.png'; a.href = canvas.toDataURL('image/png'); a.click();
  toast('Sky exported as PNG ◩'); sfx.share();
}

/* ---------- sky pointer ---------- */
function evtPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.min(.99, Math.max(.01, (e.clientX - r.left) / r.width)), y: Math.min(.97, Math.max(.03, (e.clientY - r.top) / r.height)) };
}
function starAt(e) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
  let best = -1, bd = 28 * dpr;
  const list = filtered();
  list.forEach(({ s, i }) => { const p = px(s); const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = i; } });
  return best;
}
canvas.addEventListener('click', (e) => {
  const hit = starAt(e);
  if (hit >= 0) {
    const k = filtered().findIndex(en => en.i === hit);
    if (k >= 0) { sel = k; render(); openReader(); }
  } else {
    pendingDrop = evtPos(e);
    sfx.key(); toast('Landing site marked ✒ — write, then pin');
    $('#editor-title').focus();
  }
});
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); openReader(); return; }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const list = filtered(); if (!list.length) { toast('Empty sky — press N.'); return; }
  if (sel < 0) { sel = 0; render(); sfx.select(); return; }
  const cur = px(list[sel].s);
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  let best = -1, bs = -Infinity;
  list.forEach((en, k) => {
    if (k === sel) return;
    const p = px(en.s), dx = p.x - cur.x, dy = p.y - cur.y, len = Math.hypot(dx, dy) || 1;
    const dot = (dx / len) * dir[0] + (dy / len) * dir[1];
    if (dot > .3) { const score = dot * 2 - len / (canvas.width * 1.5); if (score > bs) { bs = score; best = k; } }
  });
  if (best < 0) { // wrap: nearest in that direction anyway
    let bd = Infinity; list.forEach((en, k) => { if (k === sel) return; const p = px(en.s); const d = Math.hypot(p.x - cur.x, p.y - cur.y); if (d < bd) { bd = d; best = k; } });
  }
  if (best >= 0) { sel = best; sfx.select(); render(); }
});

/* ---------- global keyboard (keyboard-only operation) ---------- */
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (e.key === 'Escape') {
    if (!$('#help').hidden) { $('#help').hidden = true; canvas.focus(); return; }
    if (!$('#reader').hidden) { closeReader(); return; }
    if (typing) { e.target.blur(); clearEditor(); render(); canvas.focus(); return; }
  }
  if (typing) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pinFromEditor(); }
    return;
  }
  const k = e.key;
  if (k === '?') { e.preventDefault(); $('#help').hidden = false; $('#help-close').focus(); sfx.key(); }
  else if (k === '/' ) { e.preventDefault(); $('#search').focus(); sfx.key(); }
  else if (k.toLowerCase() === 'n') { e.preventDefault(); clearEditor(); render(); $('#editor-title').focus(); sfx.key(); }
  else if (k.toLowerCase() === 'r') { e.preventDefault(); drift(); }
  else if (k.toLowerCase() === 'm') { e.preventDefault(); toggleSound(); }
  else if (k.toLowerCase() === 's') { e.preventDefault(); shareLink(); }
  else if (k.toLowerCase() === 'p') { e.preventDefault(); exportPNG(); }
  else if (k.toLowerCase() === 'e' && !$('#reader').hidden) { e.preventDefault(); const i = +$('#reader').dataset.idx; $('#reader').hidden = true; loadIntoEditor(i); }
  else if ((k === 'Delete' || k.toLowerCase() === 'd') && !$('#reader').hidden) { e.preventDefault(); burn(+$('#reader').dataset.idx); }
  else if (k === 'ArrowRight' && !$('#reader').hidden) { e.preventDefault(); stepReader(1); }
  else if (k === 'ArrowLeft' && !$('#reader').hidden) { e.preventDefault(); stepReader(-1); }
});
function drift() {
  const words = ['a smudged prayer', 'moth static', 'unsent letter no. 12', 'orbit decay', 'ink weather', 'the quiet between stations'];
  const tags = ['orbit', 'grief', 'todo', 'static', ''];
  stars.push({ id: uid(), title: words[Math.floor(Math.random() * words.length)], body: 'Drifted in on its own. Edit me (E) into something true.', tag: tags[Math.floor(Math.random() * tags.length)], size: 1 + Math.floor(Math.random() * 5), x: .08 + Math.random() * .84, y: .1 + Math.random() * .75, created: Date.now() });
  sel = filtered().length - 1; sfx.drift(); save(); render(); toast('A stray star drifted in ⚄');
}
function toggleSound() {
  soundOn = !soundOn; localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
  render(); toast(soundOn ? 'Sound on ♪' : 'Muted — the sky holds its breath');
  if (soundOn) sfx.key();
}

/* ---------- wire up ---------- */
$('#btn-pin').addEventListener('click', pinFromEditor);
$('#btn-cancel').addEventListener('click', () => { clearEditor(); render(); canvas.focus(); });
$('#btn-new').addEventListener('click', () => { clearEditor(); render(); $('#editor-title').focus(); });
$('#btn-random').addEventListener('click', drift);
$('#btn-share').addEventListener('click', shareLink);
$('#btn-png').addEventListener('click', exportPNG);
$('#btn-md').addEventListener('click', exportMD);
$('#btn-sound').addEventListener('click', toggleSound);
$('#btn-help').addEventListener('click', () => { $('#help').hidden = false; $('#help-close').focus(); });
$('#help-close').addEventListener('click', () => { $('#help').hidden = true; canvas.focus(); });
$('#btn-wipe').addEventListener('click', () => {
  if (!stars.length) return;
  if (confirm(`Burn all ${stars.length} stars? This cannot be undone.`)) {
    stars = []; sel = -1; clearEditor(); history.replaceState(null, '', location.pathname); save(); render(); sfx.burn(); toast('Sky purged. A clean dark.');
  }
});
$('#search').addEventListener('input', (e) => { query = e.target.value; sel = 0; render(); });
$('#tagfilter').addEventListener('change', (e) => { tagFilter = e.target.value; sel = 0; render(); });
$('#reader-close').addEventListener('click', closeReader);
$('#reader-edit').addEventListener('click', () => { const i = +$('#reader').dataset.idx; $('#reader').hidden = true; loadIntoEditor(i); });
$('#reader-burn').addEventListener('click', () => burn(+$('#reader').dataset.idx));
$('#reader-prev').addEventListener('click', () => stepReader(-1));
$('#reader-next').addEventListener('click', () => stepReader(1));
$('#reader').addEventListener('click', (e) => { if (e.target.id === 'reader') closeReader(); });
$('#help').addEventListener('click', (e) => { if (e.target.id === 'help') { $('#help').hidden = true; canvas.focus(); } });

/* ---------- boot ---------- */
load(); fit(); initDust(); render(); requestAnimationFrame(draw);
// keep canvas crisp after fonts/layout settle
setTimeout(fit, 300);
console.log('inkwell observatory ready ★', stars.length, 'stars');
