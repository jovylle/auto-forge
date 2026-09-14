// Glyph Drift — Bauhaus kinetic poetry engine
// cursor vortex + typed word particles + font morph + PNG/SVG export + presets
const canvas = document.getElementById('stage');
const box = document.getElementById('stageBox');
const ctx = canvas.getContext('2d');
const vortexEl = document.getElementById('vortex');
const wordline = document.getElementById('wordline');
const countEl = document.getElementById('count');
const poemEl = document.getElementById('poem');
const typer = document.getElementById('typer');
const morphSlider = document.getElementById('morph');
const morphVal = document.getElementById('morphVal');
const trailSlider = document.getElementById('trail');
const trailVal = document.getElementById('trailVal');
const marquee = document.getElementById('marqueeInner');

// Palette: 3 colours + black/white ONLY
const RED = '#E30613', BLUE = '#1A56CC', YEL = '#F2B705', INK = '#111111';
const COLORS = [RED, BLUE, INK, RED, YEL, BLUE, INK];

const PRESETS = {
  manifest: 'form light dance circle square triangle colour rhythm build play space line mass motion'.split(' '),
  night: 'moon static hollow velvet orbit drift echo smoke quiet tide ember shadow'.split(' '),
  concrete: 'steel grid rhythm beam span joint bolt concrete signal order module'.split(' '),
  dada: 'noise chance zipp zopp brr klang dada flip whirr plip absurd'.split(' '),
};
const MARQUEE = 'GLYPH DRIFT ✳ KINESTHESIA OF LETTERS ✳ TYPE TO SPAWN ✳ MOVE TO STIR ✳ BAUHAUS Nº 19 ✳ ';
marquee.textContent = (MARQUEE + MARQUEE).repeat(2);

let presetName = localStorage.getItem('glyphdrift.preset') || 'manifest';
let morph = +(localStorage.getItem('glyphdrift.morph') ?? 50);
let flowOn = true, swirlOn = true, autoMorph = false, autoDir = 1;
let trail = +(localStorage.getItem('glyphdrift.trail') ?? 18);
morphSlider.value = morph; morphVal.textContent = morph;
trailSlider.value = trail; trailVal.textContent = trail;
document.querySelectorAll('.preset').forEach(b => b.classList.toggle('is-active', b.dataset.preset === presetName));
wordline.textContent = 'preset: ' + presetName.toUpperCase() + ' — move to stir, type to spawn';

// ---- field state ----
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = box.clientWidth; H = box.clientHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
new ResizeObserver(resize).observe(box);
resize();

const mouse = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, down: false, seen: false, speed: 0 };
function toLocal(e) {
  const r = box.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: Math.max(0, Math.min(W, cx)), y: Math.max(0, Math.min(H, cy)) };
}
function pointAt(x, y) {
  mouse.px = mouse.x; mouse.py = mouse.y;
  mouse.x = x; mouse.y = y; mouse.seen = true;
  mouse.speed = Math.min(30, Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py));
  vortexEl.style.left = x + 'px'; vortexEl.style.top = y + 'px';
  vortexEl.style.opacity = '1';
  const s = 54 + mouse.speed * 1.6;
  vortexEl.style.width = vortexEl.style.height = s + 'px';
  vortexEl.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
}
box.addEventListener('pointermove', e => { const p = toLocal(e); pointAt(p.x, p.y); spawnStir(1); });
box.addEventListener('pointerdown', e => { mouse.down = true; const p = toLocal(e); pointAt(p.x, p.y); burst(p.x, p.y, 14); box.setPointerCapture?.(e.pointerId); });
addEventListener('pointerup', () => (mouse.down = false));
box.addEventListener('touchmove', e => { e.preventDefault(); const p = toLocal(e); pointAt(p.x, p.y); }, { passive: false });

// ---- particles ----
const MAX = 650;
const parts = [];
let wordBuf = '', poemWords = [], presetIdx = 0, tick = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

function mk(ch, x, y, big = false) {
  if (parts.length >= MAX) parts.splice(0, parts.length - MAX + 1);
  const m = morph / 100;
  parts.push({
    ch, x, y,
    vx: rnd(-1.6, 1.6), vy: rnd(-1.8, -0.2),
    size: big ? rnd(26, 64) : rnd(13, 34),
    rot: rnd(-0.6, 0.6), vr: rnd(-0.03, 0.03),
    color: pick(COLORS),
    shape: Math.random() < 0.28 + m * 0.2 ? pick(['circle', 'square', 'tri', 'none']) : 'none',
    life: 1, decay: rnd(0.0009, 0.0032),
    wob: rnd(0, Math.PI * 2), wobSp: rnd(0.01, 0.05),
    face: Math.random() < 0.35 + m * 0.3 ? 'black' : 'grot',
    weight: 400 + m * 500,
  });
}
function spawnWord(word, x, y) {
  if (!word) return;
  const chars = [...word].slice(0, 18);
  chars.forEach((ch, i) => {
    const a = (i / Math.max(1, chars.length)) * Math.PI * 2 + rnd(-0.3, 0.3);
    mk(ch, x + Math.cos(a) * rnd(4, 26), y + Math.sin(a) * rnd(4, 26), chars.length <= 5);
    const p = parts[parts.length - 1];
    p.vx += Math.cos(a) * rnd(1, 3.4); p.vy += Math.sin(a) * rnd(1, 3.4) - 1;
  });
  poemWords.push(word);
  if (poemWords.length > 60) poemWords.shift();
  renderPoem();
}
function burst(x, y, n = 10) {
  const w = pick(PRESETS[presetName]);
  for (let i = 0; i < n; i++) mk(pick([...w]), x + rnd(-30, 30), y + rnd(-30, 30));
}
function spawnStir(n) {
  if (parts.length > MAX - 4 || !swirlOn) return;
  for (let i = 0; i < n; i++) {
    const w = PRESETS[presetName][presetIdx % PRESETS[presetName].length];
    mk(pick(w), mouse.x + rnd(-40, 40), mouse.y + rnd(-40, 40));
  }
}
function renderPoem() {
  poemEl.innerHTML = poemWords.map((w, i) => (i === poemWords.length - 1 ? `<b>${esc(w)}</b>` : esc(w))).join(' · ');
  poemEl.scrollTop = poemEl.scrollHeight;
  wordline.textContent = '“' + poemWords.slice(-6).join(' ') + '”' || 'move to stir — type to spawn';
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- typing: spawn on the canvas wherever focus is ----
let buf = '';
function commitBuf(asWord = true) {
  const w = buf.trim();
  if (w) spawnWord(asWord ? w : w, mouse.seen ? mouse.x : W / 2, mouse.seen ? mouse.y : H / 2);
  buf = ''; wordBuf = '';
}
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' || e.key === 'Enter') { commitBuf(true); typer.value = ''; e.preventDefault?.(); return; }
  if (e.key === 'Backspace') { buf = buf.slice(0, -1); return; }
  if (e.key.length === 1) {
    buf += e.key; wordBuf = buf;
    if (/[a-zA-Z0-9]/.test(e.key)) mk(e.key, (mouse.seen ? mouse.x : W / 2) + rnd(-14, 14), (mouse.seen ? mouse.y : H / 2) + rnd(-14, 14));
    if (buf.length > 24) commitBuf(true);
  }
});
typer.addEventListener('input', () => {
  const v = typer.value;
  if (/\s$/.test(v)) { buf = v.trim(); commitBuf(true); typer.value = ''; }
  else buf = v.replace(/\s/g, '');
});
document.getElementById('burstBtn').addEventListener('click', () => burst(mouse.seen ? mouse.x : W / 2, mouse.seen ? mouse.y : H / 2, 26));

// ---- ambient flow ----
setInterval(() => {
  if (!flowOn || document.hidden) return;
  const list = PRESETS[presetName];
  const w = list[presetIdx++ % list.length];
  const edge = (Math.random() * 4) | 0;
  const x = edge === 0 ? rnd(0, W) : edge === 1 ? rnd(0, W) : edge === 2 ? 20 : W - 20;
  const y = edge === 0 ? 20 : edge === 1 ? H - 20 : rnd(0, H);
  spawnWord(w, x, y);
}, 1400);

// ---- physics + render ----
function frame() {
  tick++;
  if (autoMorph) {
    morph += autoDir * 0.6;
    if (morph >= 100) { morph = 100; autoDir = -1; }
    if (morph <= 0) { morph = 0; autoDir = 1; }
    morphSlider.value = morph; morphVal.textContent = Math.round(morph);
  }
  const m = morph / 100;
  // fade trail: translucent paper wash
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(251,250,246,1)';
  if (trail < 60) {
    ctx.fillStyle = `rgba(251,250,246,${Math.max(0.06, 1 - trail / 34)})`;
  }
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    // global slow orbit around centre
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    if (swirlOn) {
      const sw = 26 / (d + 60);
      p.vx += (-dy / d) * sw * 0.16 - dx / d * 0.008;
      p.vy += (dx / d) * sw * 0.16 - dy / d * 0.008;
    }
    // cursor vortex: tangential + repulsion + click attraction
    if (mouse.seen) {
      const mx = p.x - mouse.x, my = p.y - mouse.y;
      const md = Math.hypot(mx, my) || 1;
      const R = mouse.down ? 260 : 170;
      if (md < R) {
        const f = 1 - md / R;
        const tang = (mouse.down ? -1 : 1) * (2.2 + mouse.speed * 0.06);
        p.vx += ((-my / md) * tang * f * 0.5) + (mx / md) * f * (mouse.down ? -1.4 : 1.1);
        p.vy += ((mx / md) * tang * f * 0.5) + (my / md) * f * (mouse.down ? -1.4 : 1.1);
      }
    }
    p.vx *= 0.985; p.vy *= 0.985; p.vy -= 0.008; // faint lift
    p.x += p.vx; p.y += p.vy;
    p.wob += p.wobSp; p.rot += p.vr;
    p.life -= p.decay;
    if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) { parts.splice(i, 1); continue; }

    const near = mouse.seen ? Math.max(0, 1 - Math.hypot(p.x - mouse.x, p.y - mouse.y) / 200) : 0;
    const size = p.size * (1 + near * 0.7 + Math.sin(p.wob) * 0.06 * (0.4 + m));
    const alpha = Math.min(1, p.life * 1.6);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    // bauhaus backdrop shape
    if (p.shape !== 'none') {
      ctx.fillStyle = p.shape === 'circle' ? YEL : p.shape === 'square' ? BLUE : RED;
      ctx.globalAlpha = alpha * 0.9;
      const s = size * 1.15;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); }
      else if (p.shape === 'square') ctx.fillRect(-s / 2, -s / 2, s, s);
      else { ctx.beginPath(); ctx.moveTo(0, -s / 1.8); ctx.lineTo(s / 1.6, s / 2.2); ctx.lineTo(-s / 1.6, s / 2.2); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha = alpha;
    }
    ctx.rotate(p.rot + Math.sin(p.wob) * 0.18 * m);
    const slant = m * 0.22 * Math.sin(p.wob * 0.7);
    ctx.transform(1, 0, slant, 1, 0, 0);
    ctx.font = `${p.face === 'black' ? 900 : Math.round(p.weight)} ${size}px ${p.face === 'black' ? "'Archivo Black',sans-serif" : "'Space Grotesk',sans-serif"}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // paper halo for dark glyphs on shapes, ink for light ones
    ctx.fillStyle = p.color === INK ? INK : p.color;
    if (p.shape !== 'none' && p.color !== '#fff') { ctx.fillStyle = p.shape === 'circle' ? INK : '#FBFAF6'; }
    if (p.color === INK && p.shape === 'none') ctx.fillStyle = INK;
    if (p.shape !== 'none' && (p.shape === 'square' || p.shape === 'tri')) ctx.fillStyle = '#FBFAF6';
    ctx.fillText(p.ch, 0, 0);
    ctx.restore();
  }
  // vortex ring pulse
  if (mouse.seen && (tick & 1) === 0) {
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = RED; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 26 + Math.sin(tick * 0.08) * 6 + mouse.speed, 0, 7); ctx.stroke();
    ctx.restore();
  }
  countEl.textContent = parts.length + ' glyphs';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- controls ----
document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => {
  presetName = b.dataset.preset; presetIdx = 0;
  localStorage.setItem('glyphdrift.preset', presetName);
  document.querySelectorAll('.preset').forEach(x => x.classList.toggle('is-active', x === b));
  wordline.textContent = 'preset: ' + presetName.toUpperCase() + ' — move to stir, type to spawn';
  burst(mouse.seen ? mouse.x : W / 2, mouse.seen ? mouse.y : H / 2, 18);
  typer.focus({ preventScroll: true });
}));
morphSlider.addEventListener('input', () => { morph = +morphSlider.value; morphVal.textContent = morph; localStorage.setItem('glyphdrift.morph', morph); });
trailSlider.addEventListener('input', () => { trail = +trailSlider.value; trailVal.textContent = trail; localStorage.setItem('glyphdrift.trail', trail); });

const btnFlow = document.getElementById('btnFlow');
btnFlow.addEventListener('click', () => {
  flowOn = !flowOn;
  btnFlow.classList.toggle('is-on', flowOn);
  btnFlow.textContent = flowOn ? 'FLOW ● ON' : 'FLOW ○ OFF';
  btnFlow.setAttribute('aria-pressed', flowOn);
});
const btnSwirl = document.getElementById('btnSwirl');
btnSwirl.addEventListener('click', () => {
  swirlOn = !swirlOn;
  btnSwirl.classList.toggle('is-on', swirlOn);
  btnSwirl.textContent = swirlOn ? 'SWIRL ● ON' : 'SWIRL ○ OFF';
});
const btnAuto = document.getElementById('btnAuto');
btnAuto.addEventListener('click', () => {
  autoMorph = !autoMorph;
  btnAuto.classList.toggle('is-on', autoMorph);
  btnAuto.textContent = autoMorph ? 'AUTO-MORPH ●' : 'AUTO-MORPH ○';
});
document.getElementById('btnClear').addEventListener('click', () => { parts.length = 0; poemWords = []; renderPoem(); });
document.getElementById('btnCopy').addEventListener('click', async () => {
  const t = poemWords.join(' ') || '(empty field — type some words first)';
  try { await navigator.clipboard.writeText(t); wordline.textContent = 'poem copied ✓ — ' + t.slice(0, 60); }
  catch { wordline.textContent = t.slice(0, 80); }
});

// ---- exporters ----
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
document.getElementById('btnPng').addEventListener('click', () => {
  // stamp paper background (trail washes are translucent) then snapshot
  const off = document.createElement('canvas');
  off.width = canvas.width; off.height = canvas.height;
  const c = off.getContext('2d');
  c.fillStyle = '#FBFAF6'; c.fillRect(0, 0, off.width, off.height);
  c.drawImage(canvas, 0, 0);
  c.fillStyle = INK; c.font = `700 ${13 * DPR}px 'Space Grotesk',sans-serif`;
  c.fillText(('GLYPH DRIFT · ' + presetName.toUpperCase() + ' · MORPH ' + Math.round(morph)).slice(0, 80), 14 * DPR, off.height - 14 * DPR);
  download(off.toDataURL('image/png'), `glyph-drift-${presetName}-${Date.now()}.png`);
  wordline.textContent = 'PNG exported ✓ — ' + parts.length + ' glyphs frozen';
});
document.getElementById('btnSvg').addEventListener('click', () => {
  const m = morph / 100;
  const texts = parts.map(p => {
    const fs = p.size.toFixed(1);
    const fam = p.face === 'black' ? 'Archivo Black, sans-serif' : 'Space Grotesk, sans-serif';
    const w = p.face === 'black' ? 900 : Math.round(p.weight);
    const fill = (p.shape !== 'none' && p.shape !== 'circle') ? '#FBFAF6' : p.color;
    let bg = '';
    if (p.shape === 'circle') bg = `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.size * 0.58).toFixed(1)}" fill="${YEL}"/>`;
    if (p.shape === 'square') { const s = (p.size * 1.15).toFixed(1); bg = `<rect x="${(p.x - p.size * 0.575).toFixed(1)}" y="${(p.y - p.size * 0.575).toFixed(1)}" width="${s}" height="${s}" fill="${BLUE}"/>`; }
    if (p.shape === 'tri') { const s = (p.size * 1.15).toFixed(1); bg = `<polygon points="${p.x.toFixed(1)},${(p.y - p.size / 1.8).toFixed(1)} ${(p.x + p.size / 1.6).toFixed(1)},${(p.y + p.size / 2.2).toFixed(1)} ${(p.x - p.size / 1.6).toFixed(1)},${(p.y + p.size / 2.2).toFixed(1)}" fill="${RED}"/>`; }
    void m; void fs;
    return `${bg}<text x="${p.x.toFixed(1)}" y="${(p.y + p.size * 0.35).toFixed(1)}" font-family="${fam}" font-weight="${w}" font-size="${fs}" text-anchor="middle" fill="${fill}">${esc(p.ch)}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#FBFAF6"/>${texts}<text x="14" y="${H - 14}" font-family="monospace" font-size="12" fill="${INK}">GLYPH DRIFT · ${presetName.toUpperCase()} · MORPH ${Math.round(morph)}</text></svg>`;
  download('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), `glyph-drift-${presetName}-${Date.now()}.svg`);
  wordline.textContent = 'SVG exported ✓ — vector letterforms saved';
});

// seed + focus
spawnWord(presetName === 'dada' ? 'dada' : 'form', W / 2 - 60, H / 2 - 20);
spawnWord(presetName === 'dada' ? 'klang' : 'light', W / 2 + 60, H / 2 + 30);
renderPoem();
console.log('glyph-drift ready', { presetName, morph });
