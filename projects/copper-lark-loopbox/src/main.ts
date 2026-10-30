import './index.css';

/* ============ COPPER LARK LOOPBOX — pocket loop station ============
   Web Audio only. No backend. Settings persist to localStorage.
   Every recorded/stamped buffer is fitted to exactly one loop length
   so all 4 tracks stay in hypnotic sync. */

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector(sel);
  if (!el) throw new Error('missing ' + sel);
  return el as T;
};

const LS_KEY = 'copper-lark-loopbox-v1';
const TRACK_NAMES = ['KICK-DIRT', 'SNARE-RUST', 'HISS-LARK', 'DRONE-MOSS'];

interface Persist { bpm: number; beats: number; vols: number[]; mutes: boolean[]; metro: boolean }
interface Track {
  raw: AudioBuffer | null;    // as captured / synthesized
  fitted: AudioBuffer | null; // resampled to exactly loopDur
  gain: GainNode | null;
  srcs: AudioBufferSourceNode[];
  vol: number; muted: boolean;
}

const S = {
  ctx: null as AudioContext | null,
  master: null as GainNode | null,
  tracks: [] as Track[],
  playing: false,
  loopStart: 0,
  bpm: 96,
  beats: 4 as number,
  metro: false,
  metroTimer: 0 as unknown as ReturnType<typeof setInterval> | 0,
  metroNext: 0,
  metroBeat: 0,
  taps: [] as number[],
  micStream: null as MediaStream | null,
  micReady: false,
  recorder: null as MediaRecorder | null,
  recIndex: -1,
  recTimer: 0 as unknown as ReturnType<typeof setTimeout> | 0,
  recTick: 0 as unknown as ReturnType<typeof setInterval> | 0,
  raf: 0,
  analyser: null as AnalyserNode | null,
  exporting: false,
};

const loopDur = () => (S.beats * 60) / S.bpm;

/* ---------------- persistence ---------------- */
function save() {
  try {
    const p: Persist = {
      bpm: S.bpm, beats: S.beats, metro: S.metro,
      vols: S.tracks.map(t => t.vol), mutes: S.tracks.map(t => t.muted),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch { /* private mode — ignore */ }
}
function load(): Partial<Persist> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Persist;
    if (typeof p.bpm === 'number') S.bpm = Math.min(220, Math.max(50, Math.round(p.bpm)));
    if ([2, 4, 8].includes(p.beats)) S.beats = p.beats;
    S.metro = !!p.metro;
    return p;
  } catch { return {}; }
}

/* ---------------- ui helpers ---------------- */
function toast(msg: string) { $('#toast').textContent = msg; }
function fmtLoop() { $('#loopLen').textContent = loopDur().toFixed(2); }
function fmtBpm() { $('#bpmVal').textContent = String(S.bpm); fmtLoop(); }

/* ---------------- audio core ---------------- */
function ensureCtx() {
  if (!S.ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    S.ctx = new AC();
    S.master = S.ctx.createGain();
    S.master.gain.value = 0.9;
    S.master.connect(S.ctx.destination);
    for (const t of S.tracks) {
      t.gain = S.ctx.createGain();
      t.gain.gain.value = t.muted ? 0 : t.vol;
      t.gain.connect(S.master);
    }
  }
  if (S.ctx.state === 'suspended') S.ctx.resume().catch(() => undefined);
  return S.ctx;
}

/* Fit any buffer to exactly loopDur seconds (time-stretch / trim). */
async function fitToLoop(raw: AudioBuffer, dur: number): Promise<AudioBuffer> {
  const sr = (S.ctx ? S.ctx.sampleRate : 44100);
  const len = Math.max(1, Math.floor(dur * sr));
  const off = new OfflineAudioContext(raw.numberOfChannels, len, sr);
  const src = off.createBufferSource();
  src.buffer = raw;
  src.playbackRate.value = raw.duration / dur; // stretch or squeeze into the loop
  src.connect(off.destination);
  src.start(0);
  return off.startRendering();
}

function stopVoices() {
  for (const t of S.tracks) {
    for (const s of t.srcs) { try { s.stop(); } catch { /* already stopped */ } try { s.disconnect(); } catch { /* noop */ } }
    t.srcs = [];
  }
}

function startTransport() {
  const ctx = ensureCtx();
  stopVoices();
  const t0 = ctx.currentTime + 0.08;
  for (const t of S.tracks) {
    if (!t.fitted || !t.gain) continue;
    const src = ctx.createBufferSource();
    src.buffer = t.fitted;
    src.loop = true;
    src.connect(t.gain);
    src.start(t0);
    t.srcs.push(src);
  }
  S.playing = true;
  S.loopStart = t0;
  $('#playBtn').textContent = '❚❚ LOOPING';
  $('#playBtn').classList.add('live');
  startMetro(t0);
  cancelAnimationFrame(S.raf);
  progressTick();
  toast(`looping ${S.beats} beats @ ${S.bpm} bpm — layer it.`);
}

function stopTransport() {
  stopVoices();
  S.playing = false;
  stopMetro();
  $('#playBtn').textContent = '▶ PLAY';
  $('#playBtn').classList.remove('live');
  $('#loopProg').style.width = '0%';
  for (let i = 0; i < 4; i++) progEl(i).style.width = '0%';
}

function restartTransport() {
  if (S.playing) startTransport();
}

function progressTick() {
  if (!S.playing || !S.ctx) return;
  const d = loopDur();
  const pos = ((S.ctx.currentTime - S.loopStart) % d + d) % d;
  const pct = (pos / d) * 100 + '%';
  $('#loopProg').style.width = pct;
  for (let i = 0; i < 4; i++) progEl(i).style.width = pct;
  drawVu();
  S.raf = requestAnimationFrame(progressTick);
}

/* ---------------- metronome ---------------- */
function startMetro(t0: number) {
  stopMetro();
  if (!S.metro || !S.ctx) return;
  S.metroBeat = 0;
  S.metroNext = t0;
  S.metroTimer = setInterval(() => {
    if (!S.ctx || !S.playing) return;
    const beat = 60 / S.bpm;
    while (S.metroNext < S.ctx.currentTime + 0.15) {
      click(S.metroNext, S.metroBeat % S.beats === 0);
      S.metroNext += beat;
      S.metroBeat++;
    }
  }, 30);
}
function stopMetro() { if (S.metroTimer) clearInterval(S.metroTimer); S.metroTimer = 0; }
function click(when: number, accent: boolean) {
  if (!S.ctx || !S.master) return;
  const o = S.ctx.createOscillator();
  const g = S.ctx.createGain();
  o.frequency.value = accent ? 1560 : 1040;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
  o.connect(g); g.connect(S.master);
  o.start(when); o.stop(when + 0.09);
}

/* ---------------- mic ---------------- */
async function enableMic() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) { toast('no mic API in this browser — use STAMP instead.'); return; }
    ensureCtx();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    S.micStream = stream;
    S.micReady = true;
    const ctx = ensureCtx();
    const src = ctx.createMediaStreamSource(stream);
    S.analyser = ctx.createAnalyser();
    S.analyser.fftSize = 256;
    src.connect(S.analyser); // analyser only — no destination, no feedback
    $('#micBtn').textContent = '◉ MIC LIVE';
    $('#micBtn').classList.add('ready');
    const st = $('#micStatus');
    st.textContent = 'mic: LIVE — hit ● on any track to sample one loop';
    st.classList.add('ok');
    toast('mic live. arm a track and make some mouth-noise.');
    cancelAnimationFrame(S.raf);
    vuIdle();
  } catch {
    toast('mic blocked — allow access, or STAMP a groove instead.');
  }
}

function drawVu() {
  const c = $('#vu') as unknown as HTMLCanvasElement;
  const g = c.getContext('2d');
  if (!g) return;
  const W = c.width, H = c.height;
  g.fillStyle = '#12100c'; g.fillRect(0, 0, W, H);
  let lvl = 0;
  if (S.analyser) {
    const d = new Uint8Array(S.analyser.frequencyBinCount);
    S.analyser.getByteTimeDomainData(d);
    let sum = 0;
    for (let i = 0; i < d.length; i++) { const v = (d[i] - 128) / 128; sum += v * v; }
    lvl = Math.min(1, Math.sqrt(sum / d.length) * 3.2);
  } else if (S.playing && S.ctx && S.master) {
    lvl = 0.35 + 0.3 * Math.abs(Math.sin(S.ctx.currentTime * 5));
  }
  const n = 24, lit = Math.round(lvl * n);
  for (let i = 0; i < n; i++) {
    g.fillStyle = i < lit ? (i > n * 0.8 ? '#c1501f' : '#d9a419') : 'rgba(242,236,220,.15)';
    g.fillRect(4 + i * ((W - 8) / n), 4, (W - 8) / n - 2, H - 8);
  }
}
function vuIdle() { if (!S.playing) { drawVu(); requestAnimationFrame(() => { if (!S.playing) vuIdle(); }); } }

/* ---------------- recording (live mic sampling) ---------------- */
async function recordTrack(i: number) {
  if (S.recIndex !== -1) { toast('already sampling — wait for the count.'); return; }
  if (!S.micReady || !S.micStream) { toast('enable the mic first — or STAMP a groove.'); return; }
  const ctx = ensureCtx();
  const dur = loopDur();
  let mime = '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']) {
    if (!m || (window.MediaRecorder && MediaRecorder.isTypeSupported(m))) { mime = m; break; }
  }
  try {
    const rec = mime ? new MediaRecorder(S.micStream, { mimeType: mime }) : new MediaRecorder(S.micStream);
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); });
    S.recorder = rec; S.recIndex = i;
    const card = cardEl(i);
    card.classList.add('armed');
    const rbtn = card.querySelector('.rec') as HTMLButtonElement;
    rbtn.classList.add('busy'); rbtn.textContent = '■ SAMPLING…';
    rec.start(100);
    toast(`sampling track ${i + 1} — ${dur.toFixed(2)}s, go!`);
    // countdown readout
    const t0 = performance.now();
    const cnt = card.querySelector('.rec-count') as HTMLElement;
    S.recTick = setInterval(() => {
      const left = Math.max(0, dur - (performance.now() - t0) / 1000);
      cnt.textContent = `● ${left.toFixed(1)}s — make noise!`;
    }, 100);
    S.recTimer = setTimeout(() => stopRecCapture(), Math.max(200, dur * 1000));
    const blob = await done;
    const ab = await blob.arrayBuffer();
    if (!ab.byteLength) throw new Error('empty take');
    const raw = await ctx.decodeAudioData(ab);
    await takeReady(i, raw, 'mic take');
  } catch {
    toast('take failed — try again, louder this time.');
    resetRecUi(i);
  }
}

function stopRecCapture() {
  try { S.recorder?.state !== 'inactive' && S.recorder?.stop(); } catch { /* noop */ }
}

async function takeReady(i: number, raw: AudioBuffer, label: string) {
  resetRecUi(i);
  S.tracks[i].raw = raw;
  S.tracks[i].fitted = await fitToLoop(raw, loopDur());
  drawWave(i);
  updateBadge(i);
  if (!S.playing) startTransport(); else restartTransport();
  toast(`track ${i + 1} locked — ${label}, quantized to the loop.`);
}

function resetRecUi(i: number) {
  if (S.recTimer) clearTimeout(S.recTimer); S.recTimer = 0;
  if (S.recTick) clearInterval(S.recTick); S.recTick = 0;
  S.recorder = null; S.recIndex = -1;
  const card = cardEl(i);
  card.classList.remove('armed');
  const rbtn = card.querySelector('.rec') as HTMLButtonElement;
  rbtn.classList.remove('busy'); rbtn.textContent = '● REC';
  (card.querySelector('.rec-count') as HTMLElement).textContent = '';
}

/* ---------------- STAMP: procedural grunge groove (no mic needed) ---------------- */
async function stampTrack(i: number) {
  ensureCtx();
  const dur = loopDur();
  const sr = S.ctx!.sampleRate;
  const off = new OfflineAudioContext(2, Math.max(1, Math.floor(dur * sr)), sr);
  const beat = 60 / S.bpm;
  const seed = i * 4 + S.beats;

  if (i === 0) { // KICK-DIRT: blown-out four-floor
    for (let b = 0; b < S.beats; b++) kick(off, b * beat, 0.9);
    noiseHat(off, dur, beat / 2, 0.05, 6000);
  } else if (i === 1) { // SNARE-RUST: backbeat trash
    for (let b = 0; b < S.beats; b++) { if (b % 2 === 1) snare(off, b * beat, 0.8); else kick(off, b * beat, 0.35); }
    noiseHat(off, dur, beat / 4, 0.04, 8000);
  } else if (i === 2) { // HISS-LARK: static wash + ticks
    wash(off, 0, dur, 0.16 + (seed % 5) * 0.01);
    for (let b = 0; b < S.beats * 2; b++) tick(off, b * (beat / 2), 0.22);
  } else { // DRONE-MOSS: detuned low lurch
    drone(off, 0, dur, 55 * Math.pow(2, (seed % 4) / 12), 0.5);
    for (let b = 0; b < S.beats; b++) kick(off, b * beat, 0.25);
  }
  const raw = await off.startRendering();
  S.tracks[i].raw = raw;
  S.tracks[i].fitted = raw; // already exactly loopDur
  drawWave(i);
  updateBadge(i);
  if (!S.playing) startTransport(); else restartTransport();
  toast(`track ${i + 1} stamped — instant ${TRACK_NAMES[i].toLowerCase()} groove.`);
}

function kick(c: OfflineAudioContext, t: number, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.3);
}
function snare(c: OfflineAudioContext, t: number, vol: number) {
  const len = Math.floor(c.sampleRate * 0.18);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = c.createBufferSource(); n.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
  const g = c.createGain(); g.gain.value = vol;
  n.connect(f); f.connect(g); g.connect(c.destination);
  n.start(t);
  const o = c.createOscillator(), g2 = c.createGain();
  o.frequency.value = 210; g2.gain.setValueAtTime(vol * 0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g2); g2.connect(c.destination);
  o.start(t); o.stop(t + 0.12);
}
function noiseHat(c: OfflineAudioContext, dur: number, step: number, vol: number, hp: number) {
  for (let t = 0; t < dur; t += step) {
    const len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(c.destination);
    n.start(t);
  }
}
function tick(c: OfflineAudioContext, t: number, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.value = 2400;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.04);
}
function wash(c: OfflineAudioContext, t: number, dur: number, vol: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = last * 3.2 * vol; }
  }
  const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
  const g = c.createGain(); g.gain.value = 1;
  n.connect(g); g.connect(c.destination);
  n.start(t); n.stop(t + dur);
}
function drone(c: OfflineAudioContext, t: number, dur: number, freq: number, vol: number) {
  for (const det of [0, 4]) {
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = freq; o.detune.value = det;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * 0.4, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur);
  }
}

/* ---------------- tap tempo ---------------- */
function tap() {
  const now = performance.now();
  S.taps.push(now);
  if (S.taps.length > 7) S.taps.shift();
  // drop stale sessions (>2.2s gap restarts)
  if (S.taps.length >= 2) {
    const gap = S.taps[S.taps.length - 1] - S.taps[S.taps.length - 2];
    if (gap > 2200) S.taps = [now];
  }
  const dots = $('#tapDots');
  dots.textContent = '●'.repeat(Math.min(S.taps.length, 6));
  const pad = $('#tapPad');
  pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit');
  if (S.taps.length >= 3) {
    const iv: number[] = [];
    for (let k = 1; k < S.taps.length; k++) iv.push(S.taps[k] - S.taps[k - 1]);
    iv.sort((a, b) => a - b);
    const med = iv[Math.floor(iv.length / 2)];
    void setBpm(Math.round(60000 / med));
  }
}

async function setBpm(next: number) {
  S.bpm = Math.min(220, Math.max(50, next));
  fmtBpm(); save();
  // refit every kept take to the new loop length, then resync
  const jobs = S.tracks.map(async t => {
    if (t.raw) t.fitted = await fitToLoop(t.raw, loopDur());
  });
  await Promise.all(jobs);
  restartTransport();
}

/* ---------------- export (one click → wav) ---------------- */
function encodeWav(buf: AudioBuffer): Blob {
  const nCh = Math.min(2, buf.numberOfChannels);
  const sr = buf.sampleRate;
  const len = buf.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const wstr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE'); wstr(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
  wstr(36, 'data'); v.setUint32(40, len * nCh * 2, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

async function exportMix() {
  if (S.exporting) return;
  const live = S.tracks.filter(t => t.fitted && !t.muted);
  if (!live.length) { $('#exportStatus').textContent = 'nothing to press — record or stamp a track first.'; return; }
  S.exporting = true;
  const btn = $('#exportBtn') as HTMLButtonElement;
  btn.disabled = true; btn.textContent = 'PRESSING…';
  $('#exportStatus').textContent = 'rendering 2 loops…';
  try {
    const d = loopDur(), LOOPS = 2, sr = S.ctx ? S.ctx.sampleRate : 44100;
    const off = new OfflineAudioContext(2, Math.floor(d * LOOPS * sr), sr);
    for (const t of live) {
      const g = off.createGain(); g.gain.value = t.vol; g.connect(off.destination);
      for (let l = 0; l < LOOPS; l++) {
        const s = off.createBufferSource();
        s.buffer = t.fitted;
        s.connect(g); s.start(l * d);
      }
    }
    const mix = await off.startRendering();
    const blob = encodeWav(mix);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `copper-lark-loop-${S.bpm}bpm.wav`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    $('#exportStatus').textContent = `pressed ✓ ${(blob.size / 1024).toFixed(0)} KB wav — check downloads.`;
    toast('mix exported. go press it to cassette.');
  } catch {
    $('#exportStatus').textContent = 'press failed — try again.';
  } finally {
    S.exporting = false;
    btn.disabled = false; btn.textContent = '⬇ EXPORT MIX';
  }
}

/* ---------------- track cards ---------------- */
const cardEl = (i: number) => $('#tracks').children[i] as HTMLElement;
const progEl = (i: number) => cardEl(i).querySelector('.wave-prog') as HTMLElement;

function buildTracks(p: Partial<Persist>) {
  const host = $('#tracks');
  host.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('article');
    el.className = 'track';
    el.setAttribute('aria-label', `Track ${i + 1} ${TRACK_NAMES[i]}`);
    el.innerHTML =
      `<div class="track-top">
        <input class="track-name" value="${TRACK_NAMES[i]}" maxlength="12" aria-label="Track ${i + 1} name" />
        <span class="track-badge">EMPTY</span>
      </div>
      <div class="wave-wrap">
        <canvas class="wave" width="520" height="84"></canvas>
        <div class="wave-prog"></div>
        <div class="wave-empty">— blank tape —</div>
      </div>
      <div class="track-controls">
        <button class="tbtn rec" aria-label="Record track ${i + 1} from microphone">● REC</button>
        <button class="tbtn stamp" aria-label="Stamp synthetic groove on track ${i + 1}">STAMP</button>
        <button class="tbtn mute" aria-label="Mute track ${i + 1}" aria-pressed="false">MUTE</button>
        <button class="tbtn clear" aria-label="Clear track ${i + 1}">✕</button>
      </div>
      <div class="vol-row"><span>VOL</span><input type="range" min="0" max="100" value="85" aria-label="Track ${i + 1} volume" /></div>
      <div class="rec-count" aria-live="polite"></div>`;
    host.appendChild(el);

    S.tracks.push({ raw: null, fitted: null, gain: null, srcs: [], vol: 0.85, muted: false });

    (el.querySelector('.rec') as HTMLButtonElement).onclick = () => void recordTrack(i);
    (el.querySelector('.stamp') as HTMLButtonElement).onclick = () => void stampTrack(i);
    (el.querySelector('.clear') as HTMLButtonElement).onclick = () => clearTrack(i);
    const mbtn = el.querySelector('.mute') as HTMLButtonElement;
    mbtn.onclick = () => {
      const t = S.tracks[i];
      t.muted = !t.muted;
      if (t.gain && S.ctx) t.gain.gain.setTargetAtTime(t.muted ? 0 : t.vol, S.ctx.currentTime, 0.02);
      mbtn.classList.toggle('on', t.muted);
      mbtn.setAttribute('aria-pressed', String(t.muted));
      save();
    };
    const vol = el.querySelector('input[type="range"]') as HTMLInputElement;
    vol.oninput = () => {
      const t = S.tracks[i];
      t.vol = Number(vol.value) / 100;
      if (t.gain && S.ctx && !t.muted) t.gain.gain.setTargetAtTime(t.vol, S.ctx.currentTime, 0.02);
      save();
    };
    const name = el.querySelector('.track-name') as HTMLInputElement;
    name.oninput = () => name.classList.toggle('filled', name.value.trim().length > 0 && name.value !== TRACK_NAMES[i]);
  }
  // restore persisted vols/mutes
  if (p.vols) p.vols.forEach((vv, i) => {
    if (typeof vv !== 'number' || !S.tracks[i]) return;
    S.tracks[i].vol = Math.min(1, Math.max(0, vv));
    (cardEl(i).querySelector('input[type="range"]') as HTMLInputElement).value = String(Math.round(S.tracks[i].vol * 100));
  });
  if (p.mutes) p.mutes.forEach((m, i) => {
    if (!m || !S.tracks[i]) return;
    S.tracks[i].muted = true;
    const b = cardEl(i).querySelector('.mute') as HTMLButtonElement;
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
  });
}

function updateBadge(i: number) {
  const b = cardEl(i).querySelector('.track-badge') as HTMLElement;
  const full = !!S.tracks[i].fitted;
  b.textContent = full ? 'LOADED' : 'EMPTY';
  b.classList.toggle('full', full);
  (cardEl(i).querySelector('.wave-empty') as HTMLElement).style.display = full ? 'none' : 'flex';
}

function drawWave(i: number) {
  const t = S.tracks[i];
  const c = cardEl(i).querySelector('.wave') as unknown as HTMLCanvasElement;
  const g = c.getContext('2d');
  if (!g || !t.fitted) return;
  const W = c.width, H = c.height;
  g.fillStyle = '#12100c'; g.fillRect(0, 0, W, H);
  const d = t.fitted.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / W));
  g.fillStyle = '#d9a419';
  for (let x = 0; x < W; x++) {
    let peak = 0;
    for (let k = x * step; k < (x + 1) * step; k += 4) peak = Math.max(peak, Math.abs(d[k] || 0));
    const h = Math.max(2, peak * H * 0.92);
    g.fillRect(x, (H - h) / 2, 1, h);
  }
  // distressed center line
  g.fillStyle = '#c1501f';
  g.fillRect(0, H / 2 - 1, W, 2);
}

function clearTrack(i: number) {
  S.tracks[i].raw = null; S.tracks[i].fitted = null;
  updateBadge(i);
  const c = cardEl(i).querySelector('.wave') as unknown as HTMLCanvasElement;
  c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  restartTransport();
  toast(`track ${i + 1} wiped. fresh tape.`);
}

/* ---------------- wire up ---------------- */
function init() {
  const p = load();
  fmtBpm();
  $('#metroBtn').textContent = `CLICK: ${S.metro ? 'ON' : 'OFF'}`;
  $('#metroBtn').classList.toggle('on', S.metro);
  ($('#metroBtn') as HTMLButtonElement).setAttribute('aria-pressed', String(S.metro));
  document.querySelectorAll('.beatbtn').forEach(b => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle('on', Number(btn.dataset.beats) === S.beats);
    btn.onclick = () => {
      S.beats = Number(btn.dataset.beats);
      document.querySelectorAll('.beatbtn').forEach(x => (x as HTMLButtonElement).classList.toggle('on', x === btn));
      fmtLoop(); save();
      void setBpm(S.bpm); // refit + resync to new length
    };
  });

  buildTracks(p);

  $('#playBtn').onclick = () => { S.playing ? stopTransport() : startTransport(); };
  $('#stopBtn').onclick = () => { stopTransport(); toast('stopped. tape waits.'); };
  $('#tapPad').onclick = () => tap();
  $('#metroBtn').onclick = () => {
    S.metro = !S.metro; save();
    $('#metroBtn').textContent = `CLICK: ${S.metro ? 'ON' : 'OFF'}`;
    $('#metroBtn').classList.toggle('on', S.metro);
    ($('#metroBtn') as HTMLButtonElement).setAttribute('aria-pressed', String(S.metro));
    if (S.playing && S.ctx) startMetro(S.ctx.currentTime + 0.05);
  };
  $('#micBtn').onclick = () => void enableMic();
  ($('#monChk') as HTMLInputElement).onchange = e => {
    // monitor routes mic → master (warned); default off keeps analyser-only path
    if (!S.ctx || !S.micStream) return;
    const on = (e.target as HTMLInputElement).checked;
    const src = S.ctx.createMediaStreamSource(S.micStream);
    if (on && S.master) {
      const g = S.ctx.createGain(); g.gain.value = 0.6;
      src.connect(g); g.connect(S.master);
      (window as unknown as { __mon?: AudioNode }).__mon = g;
      toast('monitor on — headphones advised.');
    } else {
      try { (window as unknown as { __mon?: AudioNode }).__mon?.disconnect(); } catch { /* noop */ }
    }
  };
  $('#exportBtn').onclick = () => void exportMix();

  document.addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return;
    if (tag === 'INPUT' && (e.target as HTMLInputElement).classList.contains('track-name')) {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      (e.target as HTMLInputElement).blur(); return;
    }
    if (e.code === 'Space') {
      const tag2 = (e.target as HTMLElement)?.tagName;
      if (tag2 === 'BUTTON' || tag2 === 'INPUT') return; // let focused control handle it
      e.preventDefault(); S.playing ? stopTransport() : startTransport();
    }
    else if (e.key === 't' || e.key === 'T') tap();
    else if (e.key === 'm' || e.key === 'M') ($('#metroBtn') as HTMLButtonElement).click();
    else if (e.key === 'e' || e.key === 'E') void exportMix();
    else if (['1', '2', '3', '4'].includes(e.key)) void recordTrack(Number(e.key) - 1);
  });

  vuIdle();
  toast('blank tapes loaded. STAMP a groove or ENABLE MIC.');
}

init();
