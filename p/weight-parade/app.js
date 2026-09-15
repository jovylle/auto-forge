// Weight Parade — 行列 · typing rhythm → variable-font weight
// Single-file spirit: no deps, no network except Google Fonts (graceful offline).
// All four features + keyboard-only constraint live here.
'use strict';

const $ = (id) => document.getElementById(id);
const parade = $('parade'), empty = $('empty'), typebox = $('typebox');
const wpmEl = $('wpm'), nelEl = $('nel'), clockEl = $('clock');
const beatfill = $('beatfill'), beatticks = $('beatticks');
const promptline = $('promptline'), prompttext = $('prompttext'), promptscore = $('promptscore');

/* ---------- persisted state ---------- */
const LS = 'weight-parade-v1';
const S = Object.assign({
  wght: 400, wdth: 100, opsz: 40, slant: 0, velo: true, decay: 2.4,
  bpm: 90, phrase: 0, pair: 0, text: ''
}, JSON.parse(localStorage.getItem(LS) || '{}'));
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };

/* ---------- curated pairings ---------- */
const PAIRS = [
  { name: 'Matsuri 祭', fonts: 'Fraunces · Zen Kaku', disp: '"Fraunces","Zen Old Mincho",Georgia,serif', body: '"Zen Kaku Gothic New",system-ui,sans-serif', swatch: 'Aaあ', d: { wght: 400, wdth: 100, opsz: 40 } },
  { name: 'Sumi 墨', fonts: 'Zen Mincho · Plex Mono', disp: '"Zen Old Mincho","Fraunces",Georgia,serif', body: '"IBM Plex Mono",ui-monospace,monospace', swatch: '墨Aa', d: { wght: 700, wdth: 100, opsz: 20 } },
  { name: 'Ai 藍', fonts: 'Fraunces Wonk · Zen Kaku', disp: '"Fraunces",Georgia,serif', body: '"Zen Kaku Gothic New",system-ui,sans-serif', swatch: '藍Wm', d: { wght: 560, wdth: 110, opsz: 100, wonk: 1 } },
  { name: 'Washi 和紙', fonts: 'Zen Kaku · Fraunces', disp: '"Zen Kaku Gothic New","Fraunces",system-ui,sans-serif', body: '"Fraunces",Georgia,serif', swatch: '和Aa', d: { wght: 900, wdth: 100, opsz: 14 } },
];
const pairsEl = $('pairs');
PAIRS.forEach((p, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pair' + (i === S.pair ? ' is-on' : '');
  b.setAttribute('aria-pressed', i === S.pair ? 'true' : 'false');
  b.innerHTML = `<span class="swatch" style="font-family:${p.disp}" aria-hidden="true">${p.swatch}</span>
    <span><span class="pname">${i + 1} · ${p.name}</span><br /><span class="pfonts">${p.fonts}</span></span>`;
  b.addEventListener('click', () => applyPair(i, true));
  pairsEl.appendChild(b);
});
function applyPair(i, focus) {
  S.pair = i; save();
  const p = PAIRS[i];
  document.documentElement.style.setProperty('--disp', p.disp);
  parade.style.fontFamily = p.disp;
  document.body.style.fontFamily = p.body;
  Object.assign(S, p.d);
  syncControls();
  [...pairsEl.children].forEach((el, j) => {
    el.classList.toggle('is-on', j === i);
    el.setAttribute('aria-pressed', j === i ? 'true' : 'false');
  });
  $('coloPair').textContent = p.fonts;
  toast(`pairing ${i + 1} · ${p.name}`);
  if (focus) pairsEl.children[i].focus({ preventScroll: true });
}

/* ---------- controls ---------- */
const C = { wght: $('wght'), wdth: $('wdth'), opsz: $('opsz'), slant: $('slant'), velo: $('velo'), decay: $('decay'), bpm: $('bpm'), phrase: $('phrase') };
function syncControls() {
  C.wght.value = S.wght; $('o-wght').textContent = S.wght;
  C.wdth.value = S.wdth; $('o-wdth').textContent = S.wdth;
  C.opsz.value = S.opsz; $('o-opsz').textContent = S.opsz;
  C.slant.value = S.slant; $('o-slant').textContent = S.slant;
  C.velo.checked = S.velo; $('o-velo').textContent = S.velo ? 'on' : 'off';
  C.decay.value = S.decay; $('o-decay').textContent = Number(S.decay).toFixed(1) + 's';
  C.bpm.value = S.bpm; $('o-bpm').textContent = S.bpm + ' bpm'; $('bpmEcho').textContent = S.bpm;
  C.phrase.value = String(S.phrase);
}
C.wght.oninput = e => { S.wght = +e.target.value; $('o-wght').textContent = S.wght; save(); restyleAll(); };
C.wdth.oninput = e => { S.wdth = +e.target.value; $('o-wdth').textContent = S.wdth; save(); restyleAll(); };
C.opsz.oninput = e => { S.opsz = +e.target.value; $('o-opsz').textContent = S.opsz; save(); restyleAll(); };
C.slant.oninput = e => { S.slant = +e.target.value; $('o-slant').textContent = S.slant; save(); restyleAll(); };
C.velo.onchange = e => { S.velo = e.target.checked; $('o-velo').textContent = S.velo ? 'on' : 'off'; save(); restyleAll(); };
C.decay.oninput = e => { S.decay = +e.target.value; $('o-decay').textContent = S.decay.toFixed(1) + 's'; save(); };
C.bpm.oninput = e => { S.bpm = +e.target.value; $('o-bpm').textContent = S.bpm + ' bpm'; $('bpmEcho').textContent = S.bpm; save(); buildTicks(); };
C.phrase.onchange = e => { S.phrase = +e.target.value; save(); if (rhythm.on) startRhythm(false); };

/* ---------- parade model ---------- */
// chars: {el, peak:{w,t,lift}, cur, hit}
let chars = [], lastT = 0, gaps = [], peaks = [], hitIdx = new Set(), pending = null;
function gapToWeight(ms) {
  if (ms <= 0) return S.wght;
  if (ms < 80) return 900; if (ms < 140) return 770; if (ms < 220) return 640;
  if (ms < 350) return 520; if (ms < 600) return 390; if (ms < 1100) return 280;
  return 180;
}
function styleFor(peak, now) {
  let w = S.velo ? peak : S.wght;
  if (S.decay > 0 && S.velo) {
    const age = (now - peak.t) / 1000;
    const k = Math.max(0, 1 - age / S.decay);
    w = S.wght + (peak.w - S.wght) * (k * k);
  }
  w = Math.max(100, Math.min(900, Math.round(w)));
  return { w, fv: `"wght" ${w},"wdth" ${S.wdth},"opsz" ${S.opsz},"SOFT" 50,"WONK" ${PAIRS[S.pair].d.wonk ? 1 : 0}` };
}
function restyleAll() {
  const now = performance.now();
  for (const c of chars) {
    const { w, fv } = styleFor(c.peak, now);
    c.el.style.fontVariationSettings = fv;
    c.el.style.transform = `translateY(${c.peak.lift}px)`;
    c.cur = w;
  }
  clockEl.textContent = 'weight ' + S.wght;
}
function rebuild() {
  parade.innerHTML = ''; chars = [];
  const now = performance.now();
  [...S.text].forEach((g, i) => {
    const el = document.createElement('span');
    el.className = 'ch' + (g === ' ' || g === '\n' ? ' space' : '') + (hitIdx.has(i) ? ' hit' : '');
    el.textContent = g === ' ' ? ' ' : (g === '\n' ? '↵' : g);
    const pk = peaks[i] || { w: S.wght, t: now - (S.text.length - i) * 30, lift: 0 };
    peaks[i] = pk;
    const { fv } = styleFor(pk, now);
    el.style.fontVariationSettings = fv;
    el.style.fontSize = `clamp(${20 + S.opsz / 6}px, ${2 + S.opsz / 12}vw, ${28 + S.opsz}px)`;
    if (S.slant) el.style.transform = `skewX(${-S.slant}deg)`;
    parade.appendChild(el);
    chars.push({ el, peak: pk, cur: pk.w });
  });
  peaks.length = S.text.length;
  empty.style.display = S.text ? 'none' : 'grid';
}
/* ---------- typing + rhythm scoring ---------- */
const PHRASES = [
  'old pond frog jumps in sound of water',
  'snow moon flowers drums at setsubun',
  'ink stone paper brush breathe',
  'matsuri lanterns sway in june rain',
];
const rhythm = { on: false, t0: 0, idx: 0, hit: 0, early: 0, late: 0, best: 0, streak: 0 };
let audio = null, metroTimer = null, metroOn = false;

function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
}
function click(freq = 880, dur = 0.05, gain = 0.15) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = freq; o.type = 'sine';
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur);
}
function setMetro(on) {
  metroOn = on;
  $('beatBtn').setAttribute('aria-pressed', String(on));
  $('beatBtn').firstChild.textContent = on ? 'Metronome on ' : 'Metronome ';
  clearInterval(metroTimer); metroTimer = null;
  if (on) {
    ensureAudio();
    const beat = () => click(660, 0.05, 0.12);
    beat(); metroTimer = setInterval(beat, 60000 / S.bpm);
  }
}
C.bpm.addEventListener('change', () => { if (metroOn) setMetro(true); });

function startRhythm(announce = true) {
  ensureAudio();
  rhythm.on = true; rhythm.t0 = performance.now(); rhythm.idx = 0;
  rhythm.hit = rhythm.early = rhythm.late = 0; rhythm.best = 0; rhythm.streak = 0;
  promptline.hidden = false;
  renderPrompt();
  $('rhythmBtn').textContent = 'Stop the walk ⏹ (R)';
  setMetro(true);
  updateStats();
  if (announce) toast('rhythm walk — type the prompt on the beat');
  typebox.focus();
}
function stopRhythm(announce = true) {
  rhythm.on = false;
  promptline.hidden = true;
  $('rhythmBtn').textContent = 'Start rhythm walk (R)';
  setMetro(false);
  if (announce) toast(`walk over — ${rhythm.hit} on-beat, best streak ${rhythm.best}`);
  $('tab-play').focus({ preventScroll: true });
}
function renderPrompt() {
  const p = PHRASES[S.phrase];
  prompttext.innerHTML = [...p].map((g, i) =>
    `<span class="${i < rhythm.idx ? 'done' : (i === rhythm.idx ? 'todo' : '')}">${g === ' ' ? '·' : g}</span>`).join('');
  const total = rhythm.hit + rhythm.early + rhythm.late;
  promptscore.textContent = total ? `${rhythm.hit}/${total} on-beat · streak ${rhythm.streak}` : 'listen… then type';
}
function updateStats() {
  $('st-hit').textContent = rhythm.hit; $('st-early').textContent = rhythm.early;
  $('st-late').textContent = rhythm.late; $('st-best').textContent = rhythm.best || '—';
}
function scoreKey() {
  if (!rhythm.on) return false;
  const p = PHRASES[S.phrase];
  const beatMs = 60000 / S.bpm;
  const now = performance.now();
  const beats = (now - rhythm.t0) / beatMs;
  const frac = beats - Math.floor(beats);
  const offMs = Math.min(frac, 1 - frac) * beatMs; // distance to nearest beat
  const onBeat = offMs <= 90;
  const early = frac > 0.5;
  if (rhythm.idx < p.length) rhythm.idx++;
  if (onBeat) { rhythm.hit++; rhythm.streak++; rhythm.best = Math.max(rhythm.best, rhythm.streak); click(990, 0.07, 0.18); }
  else if (early) { rhythm.early++; rhythm.streak = 0; click(330, 0.06, 0.1); }
  else { rhythm.late++; rhythm.streak = 0; click(330, 0.06, 0.1); }
  renderPrompt(); updateStats();
  return onBeat;
}

typebox.value = S.text || '';
rebuild();

typebox.addEventListener('beforeinput', (e) => {
  // keep model in sync on all edits (incl. IME, paste, delete);
  // reconcile per-char peaks so velocity weights survive re-render
  queueMicrotask(() => {
    const next = typebox.value.slice(0, 280);
    const prev = S.text;
    if (next.length > prev.length && pending) {
      const added = next.length - prev.length;
      for (let k = 0; k < added; k++) {
        peaks.splice(prev.length + k, 0, { w: pending.w, t: pending.t, lift: -4 - Math.random() * 10 });
        if (pending.hit) {
          const ni = [...hitIdx].map(i => i >= prev.length + k ? i + 1 : i);
          hitIdx = new Set(ni); hitIdx.add(prev.length + k);
        }
      }
      pending = null;
    } else if (next.length < prev.length) {
      peaks.splice(next.length);
      hitIdx = new Set([...hitIdx].filter(i => i < next.length));
    }
    S.text = next; save();
    rebuild();
  });
});
typebox.addEventListener('keydown', (e) => {
  if (e.key.length === 1 || e.key === 'Enter') {
    const now = performance.now();
    const gap = lastT ? now - lastT : 0; lastT = now;
    gaps.push(gap); if (gaps.length > 40) gaps.shift();
    const hit = scoreKey();
    const w = hit ? 900 : (S.velo ? gapToWeight(gap) : S.wght);
    pending = { w, hit, t: now }; // consumed by beforeinput→rebuild
    const recent = gaps.filter(g => g > 0).slice(-12);
    const wpm = recent.length > 2
      ? Math.round(60000 / (recent.reduce((a, b) => a + b, 0) / recent.length) / 5)
      : 0;
    wpmEl.textContent = `${wpm} wpm`;
    nelEl.textContent = gap ? `last gap ${Math.round(gap)} ms` : 'last gap — ms';
    clockEl.textContent = 'weight ' + w;
  }
});
$('clearBtn').addEventListener('click', () => {
  S.text = ''; typebox.value = ''; save(); peaks = []; hitIdx = new Set(); pending = null;
  rebuild(); lastT = 0; gaps = [];
  wpmEl.textContent = '0 wpm'; nelEl.textContent = 'last gap — ms';
  toast('parade cleared'); typebox.focus();
});
$('beatBtn').addEventListener('click', () => setMetro(!metroOn));
$('rhythmBtn').addEventListener('click', () => rhythm.on ? stopRhythm() : startRhythm());

/* ---------- rAF: decay + beat sweep ---------- */
function buildTicks() {
  beatticks.innerHTML = '';
  for (let i = 0; i < S.bpm / 5; i++) beatticks.appendChild(document.createElement('i'));
}
buildTicks();
(function loop() {
  const now = performance.now();
  if (S.velo && S.decay > 0) {
    let dirty = false, maxW = S.wght;
    for (const c of chars) {
      const age = (now - c.peak.t) / 1000;
      if (age < S.decay + 0.1) {
        const k = Math.max(0, 1 - age / S.decay);
        const w = Math.round(S.wght + (c.peak.w - S.wght) * k * k);
        if (w !== c.cur) {
          c.cur = w; dirty = true;
          c.el.style.fontVariationSettings = `"wght" ${w},"wdth" ${S.wdth},"opsz" ${S.opsz}`;
        }
        maxW = Math.max(maxW, w);
      }
    }
    if (dirty) clockEl.textContent = 'weight ' + maxW;
  }
  if (metroOn || rhythm.on) {
    const beatMs = 60000 / S.bpm;
    const t = (now - (rhythm.on ? rhythm.t0 : now - (now % beatMs))) % (beatMs * 4);
    beatfill.style.width = ((t / (beatMs * 4)) * 100).toFixed(1) + '%';
  } else beatfill.style.width = '0%';
  requestAnimationFrame(loop);
})();

/* ---------- tabs (keyboard: arrows move) ---------- */
const tabs = [...document.querySelectorAll('.tab')];
const sections = { playground: '.panel:nth-of-type(1)', rhythm: '.panel:nth-of-type(2)', export: '.panel:nth-of-type(3)' };
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t, true));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      selectTab(tabs[n], true);
    }
  });
});
function selectTab(t, focusPanel) {
  tabs.forEach(x => { x.classList.remove('is-on'); x.setAttribute('aria-selected', 'false'); });
  t.classList.add('is-on'); t.setAttribute('aria-selected', 'true');
  if (focusPanel) {
    const sel = sections[t.dataset.mode];
    const panel = document.querySelector(sel);
    const f = panel && panel.querySelector('input,select,button');
    if (f) f.focus({ preventScroll: false });
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ---------- GIF export: pure-JS GIF89a, no deps ---------- */
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false; t.classList.toggle('err', err);
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2600);
}
// Fixed 8-color palette: washi, paper, sumi x2, shu, ai, stone, moss
const PAL = [[245, 239, 226], [251, 247, 236], [28, 27, 23], [58, 56, 47], [200, 64, 42], [36, 54, 94], [139, 134, 122], [91, 107, 76]];
function nearestIdx(r, g, b) {
  let bi = 0, bd = 1e12;
  for (let i = 0; i < PAL.length; i++) {
    const d = (PAL[i][0] - r) ** 2 + (PAL[i][1] - g) ** 2 + (PAL[i][2] - b) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}
function lzwEncode(minCode, pixels) {
  const out = []; let cur = 0, bits = 0;
  const put = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>= 8; bits -= 8; } };
  const flush = () => { if (bits) { out.push(cur & 255); cur = 0; bits = 0; } };
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, dict = new Map(), next = eoi + 1;
  put(clear, size);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i], key = prefix * 256 + k;
    if (dict.has(key)) prefix = dict.get(key);
    else {
      put(prefix < 256 ? prefix : prefix, size);
      if (next < 4096) { dict.set(key, next++); if (next === (1 << size) + 1 && size < 12) size++; }
      else { put(clear, size); dict = new Map(); size = minCode + 1; next = eoi + 1; }
      prefix = k;
    }
  }
  put(prefix, size); put(eoi, size); flush();
  return out;
}
function encodeGIF(w, h, frames, delayCs) {
  const bytes = [];
  const str = (s) => { for (const c of s) bytes.push(c.charCodeAt(0)); };
  const u16 = (v) => { bytes.push(v & 255, (v >> 8) & 255); };
  str('GIF89a'); u16(w); u16(h);
  bytes.push(0xF0 | 0, 0, 0); // GCT flag, 2^1=2 entries→ use 2^(N+1): N=2 → 8 colors
  for (const c of PAL) bytes.push(...c);
  bytes.push(0x21, 0xFF, 0x0B);
  str('NETSCAPE2.0'); bytes.push(3, 1, 0, 0, 0);
  for (const px of frames) {
    bytes.push(0x21, 0xF9, 4, 0, delayCs & 255, (delayCs >> 8) & 255, 0, 0);
    bytes.push(0x2C, 0, 0, 0, 0); u16(w); u16(h); bytes.push(0);
    const minCode = 3;
    bytes.push(minCode);
    const data = lzwEncode(minCode, px);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      bytes.push(chunk.length, ...chunk);
    }
    bytes.push(0);
  }
  bytes.push(0x3B);
  return new Uint8Array(bytes);
}
$('gifBtn').addEventListener('click', async () => {
  const status = $('gifStatus'), link = $('gifLink');
  const text = (S.text || PHRASES[S.phrase] || 'weight parade').slice(0, 42) || 'weight parade';
  status.textContent = 'rendering 24 frames…';
  link.hidden = true;
  try {
    await new Promise(r => setTimeout(r, 30)); // let status paint (keyboard users get live region)
    await document.fonts.ready;
    const W = 600, H = 240, N = 24;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const frames = [];
    const p = PAIRS[S.pair];
    for (let f = 0; f < N; f++) {
      cx.fillStyle = '#F5EFE2'; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = '#C9BFA6'; cx.setLineDash([8, 8]);
      cx.beginPath(); cx.moveTo(0, H * 0.68); cx.lineTo(W, H * 0.68); cx.stroke();
      cx.setLineDash([]);
      cx.textBaseline = 'alphabetic';
      const fs = Math.min(64, (W - 60) / Math.max(6, text.length) * 1.7);
      let x = 30;
      [...text].forEach((g, i) => {
        const wave = Math.sin((i / text.length) * Math.PI * 2 + f / N * Math.PI * 2);
        const w = Math.round(300 + 320 * (0.5 + 0.5 * wave) + (i % 5 === 0 ? 120 : 0));
        cx.font = `${Math.max(100, Math.min(900, w))} ${fs}px ${p.disp}`;
        cx.fillStyle = (i + f) % 9 === 0 ? '#C8402A' : '#1C1B17';
        const y = H * 0.62 + Math.sin(f / N * Math.PI * 2 + i * 0.7) * 12;
        const ch = g === ' ' ? '\u00a0' : g;
        cx.fillText(ch, x, y);
        x += cx.measureText(ch).width + 1;
        if (x > W - 20) return;
      });
      cx.fillStyle = '#8B867A'; cx.font = '600 15px monospace';
      cx.fillText(`weight parade · frame ${f + 1}/${N}`, 18, H - 18);
      cx.fillStyle = '#C8402A'; cx.fillRect(W - 64, H - 44, 44, 30);
      cx.fillStyle = '#FBF7EC'; cx.font = '900 17px serif'; cx.fillText('重列', W - 58, H - 21);
      const img = cx.getImageData(0, 0, W, H).data;
      const px = new Array(W * H);
      for (let i = 0, j = 0; i < img.length; i += 4, j++) px[j] = nearestIdx(img[i], img[i + 1], img[i + 2]);
      frames.push(px);
    }
    const gif = encodeGIF(W, H, frames, 8);
    const url = URL.createObjectURL(new Blob([gif], { type: 'image/gif' }));
    link.href = url; link.hidden = false;
    status.textContent = `done — ${(gif.length / 1024).toFixed(0)} KB, 24 frames, loops forever. Tab to Download and press Enter.`;
    toast('GIF ready — Download link is focused');
    link.focus();
  } catch (err) {
    console.error(err);
    status.textContent = 'export failed in this browser — try Chrome/Edge/Safari.';
    toast('GIF export failed', true);
  }
});

/* ---------- global keyboard map (keyboard-only constraint) ---------- */
document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement || {}).tagName || '';
  const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(tag);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); $('clearBtn').click(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); $('gifBtn').click(); return; }
  if (typing) {
    if (e.key === 'Escape') document.activeElement.blur();
    return; // never hijack letters while typing
  }
  const k = e.key;
  if (k === '?') { e.preventDefault(); const d = $('keys'); d.open = !d.open; if (d.open) d.querySelector('summary').focus(); }
  else if (k.toLowerCase() === 'b') { e.preventDefault(); setMetro(!metroOn); toast(metroOn ? `metronome ${S.bpm} bpm` : 'metronome off'); }
  else if (k.toLowerCase() === 'r') { e.preventDefault(); rhythm.on ? stopRhythm() : startRhythm(); }
  else if (k === '[') { e.preventDefault(); S.wght = Math.max(100, S.wght - 20); save(); syncControls(); restyleAll(); }
  else if (k === ']') { e.preventDefault(); S.wght = Math.min(900, S.wght + 20); save(); syncControls(); restyleAll(); }
  else if (['1', '2', '3', '4'].includes(k)) { e.preventDefault(); applyPair(+k - 1, false); }
});

/* ---------- init ---------- */
applyPair(S.pair, false);
syncControls();
rebuild();
prompttext.textContent = PHRASES[S.phrase];
console.log('%cWeight Parade 行列 ready', 'font-weight:bold', '| keyboard: ? B R 1-4 [ ] ^K ^Enter');
