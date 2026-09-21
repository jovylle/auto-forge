/* Velvet Metronome Club — 4-track hum looper choir.
   Plain WebAudio, no deps. Works from file:// (hum synth always sings;
   mic layers just need mic permission, i.e. localhost/https ideally). */
'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  power: $('btnPower'), play: $('btnPlay'), tap: $('btnTap'),
  bpm: $('bpmReadout'), dots: [...document.querySelectorAll('#beatDots i')],
  swing: $('swing'), swingVal: $('swingVal'), bars: $('bars'), barsVal: $('barsVal'),
  click: $('clickOn'), scope: $('scope'), presets: $('presets'),
  tracks: $('tracks'), wav: $('btnWav'), status: $('status'),
};

/* ---------- musical data ---------- */
const VOWELS = {
  ah: [730, 1090], oh: [500, 850], oo: [300, 870], eh: [530, 1840], ee: [270, 2290],
};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const nameMidi = (n) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return base + acc + (parseInt(m[3], 10) + 1) * 12;
};
const PRESETS = [
  { id: 'major', name: 'Velvet Major', notes: ['C3', 'E3', 'G3', 'C4'], vowel: 'ah', cls: 'btn-p' },
  { id: 'minor', name: 'Blue Minor', notes: ['A2', 'C3', 'E3', 'A3'], vowel: 'oh', cls: 'btn-c' },
  { id: 'dom7', name: 'Sunset 7', notes: ['G2', 'B2', 'D3', 'F3'], vowel: 'oo', cls: 'btn-y' },
  { id: 'sus', name: 'Cosmic Sus', notes: ['D3', 'G3', 'A3', 'D4'], vowel: 'eh', cls: '' },
  { id: 'cry', name: 'Neon Cry', notes: ['F2', 'Ab2', 'C3', 'Eb3'], vowel: 'ee', cls: 'on' },
];
const TRACK_COLORS = ['#FF2E88', '#B8860B', '#0090C8', '#7B2FF7'];

/* ---------- state ---------- */
const S = {
  ctx: null, master: null, analyser: null, micStream: null, micAnalyser: null,
  ready: false, playing: false,
  bpm: 96, swing: 0.12, bars: 2, clickOn: true,
  step8: 0, nextT: 0, schedTimer: null, loopTimer: null,
  taps: [], recording: null, preset: 'major',
  tracks: [0, 1, 2, 3].map((i) => ({
    mode: 'synth', midi: [48, 52, 55, 60][i], vowel: 'ah',
    cutoff: 2400, level: 0.8, mute: false, solo: false, drop: i % 4,
    buffer: null, live: [],
  })),
};
const beatDur = () => 60 / S.bpm;
const loopDur = () => S.bars * 4 * beatDur();
const audible = (t) => !t.mute && (!S.tracks.some((x) => x.solo) || t.solo);

/* ---------- persistence ---------- */
const LS = 'velvet-metronome-club-v1';
function save() {
  try {
    localStorage.setItem(LS, JSON.stringify({
      bpm: S.bpm, swing: S.swing, bars: S.bars, preset: S.preset,
      tracks: S.tracks.map((t) => ({ mode: t.mode, midi: t.midi, vowel: t.vowel, cutoff: t.cutoff, level: t.level, drop: t.drop })),
    }));
  } catch { /* private mode — fine */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(LS) || 'null');
    if (!d) return;
    S.bpm = d.bpm ?? S.bpm; S.swing = d.swing ?? S.swing; S.bars = d.bars ?? S.bars; S.preset = d.preset ?? S.preset;
    d.tracks?.forEach((s, i) => Object.assign(S.tracks[i], s));
  } catch { /* ignore */ }
}

/* ---------- hum voice (works on any BaseAudioContext) ---------- */
function buildHum(ac, dest, { freq, vowel, cutoff, level, when, dur }) {
  const t = when;
  const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
  const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 1.004;
  const vib = ac.createOscillator(); vib.frequency.value = 5.5;
  const vibG = ac.createGain(); vibG.gain.value = freq * 0.006;
  vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
  const [f1, f2] = VOWELS[vowel] || VOWELS.ah;
  const bp1 = ac.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = f1; bp1.Q.value = 5;
  const bp2 = ac.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = f2; bp2.Q.value = 7;
  const g1 = ac.createGain(); g1.gain.value = 0.6;
  const g2 = ac.createGain(); g2.gain.value = 0.35;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.8;
  const vca = ac.createGain();
  vca.gain.setValueAtTime(0.0001, t);
  vca.gain.exponentialRampToValueAtTime(Math.max(0.001, level * 0.5), t + 0.08);
  vca.gain.setValueAtTime(Math.max(0.001, level * 0.5), Math.max(t + 0.08, t + dur - 0.15));
  vca.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.connect(bp1); o2.connect(bp1); o1.connect(bp2); o2.connect(bp2);
  bp1.connect(g1); bp2.connect(g2); g1.connect(lp); g2.connect(lp);
  lp.connect(vca); vca.connect(dest);
  [o1, o2, vib].forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
  return { lp, vca, stop: (tt) => { try { [o1, o2, vib].forEach((o) => o.stop(tt)); } catch { /* already stopped */ } } };
}
function buildMic(ac, dest, { buffer, cutoff, level, when, dur }) {
  const src = ac.createBufferSource(); src.buffer = buffer; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
  const g = ac.createGain(); g.gain.value = level * 0.9;
  src.connect(lp); lp.connect(g); g.connect(dest);
  src.start(when); src.stop(when + dur + 0.05);
  return { lp, stop: (tt) => { try { src.stop(tt); } catch { /* noop */ } } };
}

/* ---------- audio boot ---------- */
function boot() {
  if (S.ready) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  S.ctx = new AC();
  const comp = S.ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 6;
  S.master = S.ctx.createGain(); S.master.gain.value = 0.9;
  S.analyser = S.ctx.createAnalyser(); S.analyser.fftSize = 1024;
  S.master.connect(S.analyser); S.analyser.connect(comp); comp.connect(S.ctx.destination);
  // dubby feedback delay for extra velvet
  const dl = S.ctx.createDelay(1); dl.delayTime.value = beatDur() * 0.75;
  const fb = S.ctx.createGain(); fb.gain.value = 0.28;
  const wet = S.ctx.createGain(); wet.gain.value = 0.18;
  S.master.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
  S.delay = dl;
  S.ready = true;
  els.power.textContent = '♪ CLUB IS LIVE';
  els.power.classList.add('on');
  [els.play, els.tap, els.wav].forEach((b) => { b.disabled = false; });
  setStatus('Club is live. Hit PLAY, or TAP a tempo.');
  drawAllMinis();
  requestAnimationFrame(scopeLoop);
}

/* ---------- transport: looped voices + swung click ---------- */
function startTransport() {
  const ac = S.ctx; ac.resume();
  S.playing = true; els.play.textContent = '■ STOP'; els.play.classList.add('on');
  if (S.delay) S.delay.delayTime.value = beatDur() * 0.75;
  S.step8 = 0; S.nextT = ac.currentTime + 0.08;
  clearInterval(S.schedTimer);
  S.schedTimer = setInterval(schedule, 25);
  restartVoices();
  clearInterval(S.loopTimer);
  S.loopTimer = setInterval(() => { if (S.playing) restartVoices(); }, loopDur() * 1000);
  setStatus(`Looping ${S.bars} bar(s) at ${S.bpm} BPM — layer your hums!`);
}
function stopTransport() {
  S.playing = false; els.play.textContent = '▶ PLAY LOOP'; els.play.classList.remove('on');
  clearInterval(S.schedTimer); clearInterval(S.loopTimer);
  const now = S.ctx.currentTime;
  S.tracks.forEach((t) => { t.live.forEach((h) => h.stop(now)); t.live = []; });
  els.dots.forEach((d) => d.classList.remove('on', 'bar'));
  setStatus('Stopped. Your layers are kept — press PLAY to hear them again.');
}
function restartVoices() {
  if (!S.playing) return;
  const ac = S.ctx, now = Math.max(ac.currentTime + 0.03, S.nextT - 0.02);
  const dur = loopDur();
  S.tracks.forEach((t) => { t.live.forEach((h) => { try { h.stop(now); } catch { /* noop */ } }); t.live = []; });
  S.tracks.forEach((t) => {
    if (!audible(t)) return;
    const when = now + t.drop * beatDur();
    const d = Math.max(0.2, dur - t.drop * beatDur());
    if (t.mode === 'mic' && t.buffer) t.live.push(buildMic(ac, S.master, { buffer: t.buffer, cutoff: t.cutoff, level: t.level, when, dur: d }));
    else if (t.mode === 'synth') t.live.push(buildHum(ac, S.master, { freq: midiHz(t.midi), vowel: t.vowel, cutoff: t.cutoff, level: t.level, when, dur: d }));
  });
}
function schedule() {
  const ac = S.ctx, eighth = beatDur() / 2;
  while (S.nextT < ac.currentTime + 0.14) {
    const e = S.step8, t = S.nextT + (e % 2 === 1 ? S.swing * eighth : 0);
    if (S.clickOn && S.playing) click(t, e % 8 === 0);
    const q = Math.floor(e / 2) % 4;
    const ms = Math.max(0, (t - ac.currentTime) * 1000);
    setTimeout(() => paintBeat(q), ms);
    S.nextT += eighth; S.step8++;
  }
}
function click(t, accent) {
  const ac = S.ctx, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1900 : 1250;
  g.gain.setValueAtTime(accent ? 0.22 : 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g); g.connect(S.master); o.start(t); o.stop(t + 0.08);
}
function paintBeat(q) {
  els.dots.forEach((d, i) => {
    d.classList.toggle('on', S.playing && i === q);
    d.classList.toggle('bar', i === 0);
  });
}

/* ---------- tap tempo ---------- */
function tap() {
  const now = performance.now();
  S.taps.push(now); S.taps = S.taps.slice(-6);
  els.tap.classList.remove('hit'); void els.tap.offsetWidth; els.tap.classList.add('hit');
  if (S.taps.length < 2) return;
  const iv = [];
  for (let i = 1; i < S.taps.length; i++) iv.push(S.taps[i] - S.taps[i - 1]);
  iv.sort((a, b) => a - b);
  const med = iv[Math.floor(iv.length / 2)];
  if (med > 0) setBpm(Math.round(60000 / med));
}
function setBpm(v) {
  S.bpm = Math.min(220, Math.max(40, v));
  els.bpm.textContent = S.bpm;
  if (S.delay && S.ready) S.delay.delayTime.value = beatDur() * 0.75;
  if (S.playing) { startTransportRefresh(); }
  save();
}
function startTransportRefresh() {
  // re-lock loop + click grid to the new tempo without dropping layers
  clearInterval(S.loopTimer);
  S.step8 = 0; S.nextT = S.ctx.currentTime + 0.08;
  restartVoices();
  S.loopTimer = setInterval(() => { if (S.playing) restartVoices(); }, loopDur() * 1000);
}

/* ---------- mic recording (quantized to the loop) ---------- */
async function ensureMic() {
  if (S.micStream) return S.micStream;
  S.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const src = S.ctx.createMediaStreamSource(S.micStream);
  S.micAnalyser = S.ctx.createAnalyser(); S.micAnalyser.fftSize = 256;
  src.connect(S.micAnalyser);
  return S.micStream;
}
async function recordTrack(i) {
  const t = S.tracks[i];
  if (S.recording) { setStatus('Already recording — wait for the loop to finish.'); return; }
  boot();
  try { await ensureMic(); }
  catch { setStatus('No mic access — the hum synths still sing! Allow the mic to layer your voice.'); return; }
  const rec = new MediaRecorder(S.micStream);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const secs = loopDur();
  S.recording = { i, rec };
  document.querySelector(`[data-track="${i}"]`)?.classList.add('rec');
  setStatus(`● Recording track ${i + 1} for ${secs.toFixed(1)}s — HUM!`);
  rec.start();
  tickCountdown(i, secs);
  await new Promise((res) => { rec.onstop = res; setTimeout(() => rec.state !== 'inactive' && rec.stop(), secs * 1000); });
  S.recording = null;
  document.querySelector(`[data-track="${i}"]`)?.classList.remove('rec');
  try {
    const buf = await S.ctx.decodeAudioData(await new Blob(chunks).arrayBuffer());
    t.buffer = buf; t.mode = 'mic'; syncTrackCard(i); drawMini(i); save();
    setStatus(`Track ${i + 1} loop locked (${secs.toFixed(1)}s). Press PLAY to hear your hum in the choir.`);
    if (S.playing) restartVoices();
  } catch { setStatus('That take got garbled — try humming once more.'); }
}
function tickCountdown(i, secs) {
  const el = document.querySelector(`#pill-${i}`);
  const t0 = performance.now();
  const iv = setInterval(() => {
    const left = secs - (performance.now() - t0) / 1000;
    if (!S.recording || left <= 0) { clearInterval(iv); if (el) el.textContent = pillText(S.tracks[i]); return; }
    if (el) el.textContent = `● REC ${left.toFixed(1)}s`;
  }, 100);
}

/* ---------- WAV export (offline render, no click) ---------- */
function encodeWav(buf) {
  const n = buf.length, ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate;
  const data = new Int16Array(n * ch);
  const c0 = buf.getChannelData(0), c1 = ch > 1 ? buf.getChannelData(1) : c0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, (c ? c1 : c0)[i]));
      data[i * ch + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  const h = new DataView(new ArrayBuffer(44));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); h.setUint32(4, 36 + data.byteLength, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, ch, true);
  h.setUint32(24, sr, true); h.setUint32(28, sr * ch * 2, true); h.setUint16(32, ch * 2, true);
  h.setUint16(34, 16, true); ws(36, 'data'); h.setUint32(40, data.byteLength, true);
  return new Blob([h, data], { type: 'audio/wav' });
}
async function exportWav() {
  boot();
  els.wav.disabled = true;
  setStatus('Rendering your loop to WAV…');
  try {
    const sr = 44100, dur = loopDur();
    const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const m = off.createGain(); m.gain.value = 0.9; m.connect(off.destination);
    S.tracks.forEach((t) => {
      if (!audible(t)) return;
      const when = t.drop * beatDur(), d = Math.max(0.2, dur - when);
      if (t.mode === 'mic' && t.buffer) buildMic(off, m, { buffer: t.buffer, cutoff: t.cutoff, level: t.level, when, dur: d });
      else if (t.mode === 'synth') buildHum(off, m, { freq: midiHz(t.midi), vowel: t.vowel, cutoff: t.cutoff, level: t.level, when, dur: d });
    });
    const rendered = await off.startRendering();
    const url = URL.createObjectURL(encodeWav(rendered));
    const a = document.createElement('a');
    a.href = url; a.download = `velvet-metronome-${S.bpm}bpm.wav`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    setStatus('WAV downloaded — take your choir on tour. ★');
  } catch { setStatus('Render hiccup — try again?'); }
  els.wav.disabled = false;
}

/* ---------- UI: presets ---------- */
function renderPresets() {
  els.presets.innerHTML = '';
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = `btn preset ${p.cls || ''} ${S.preset === p.id ? 'on' : ''}`;
    b.innerHTML = `${p.name}<small>${p.notes.join(' · ')}</small>`;
    b.onclick = () => applyPreset(p.id);
    els.presets.appendChild(b);
  });
}
function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id); if (!p) return;
  S.preset = id;
  p.notes.forEach((n, i) => {
    const t = S.tracks[i];
    t.midi = nameMidi(n); t.vowel = p.vowel; t.mode = 'synth'; t.mute = false;
  });
  renderPresets(); S.tracks.forEach((_, i) => syncTrackCard(i));
  // staggered drops make the chord evolve as the loop cycles
  S.tracks.forEach((t, i) => { t.drop = i % S.bars === 0 && S.bars > 1 ? i % 4 : t.drop; });
  save();
  setStatus(`${p.name} loaded: ${p.notes.join(' – ')}. Press PLAY.`);
  if (S.playing && S.ready) restartVoices();
}

/* ---------- UI: track cards ---------- */
function noteOptions(sel, cur) {
  for (let m = 36; m <= 84; m++) {
    const o = document.createElement('option');
    o.value = m; o.textContent = midiName(m);
    if (m === cur) o.selected = true;
    sel.appendChild(o);
  }
}
function renderTracks() {
  els.tracks.innerHTML = '';
  S.tracks.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'track'; d.dataset.track = i;
    d.innerHTML = `
      <h3>TRACK ${i + 1}</h3>
      <div class="src-tabs" role="group" aria-label="Track ${i + 1} source">
        <button data-src="synth">🎹 HUM SYNTH</button>
        <button data-src="mic">🎤 MIC LOOP</button>
      </div>
      <label>Note <select data-f="midi"></select></label>
      <label>Vowel <select data-f="vowel">
        ${Object.keys(VOWELS).map((v) => `<option>${v}</option>`).join('')}
      </select></label>
      <label>Filter <span data-f="cutoffVal"></span><input data-f="cutoff" type="range" min="300" max="8000" step="50" /></label>
      <label>Level <span data-f="levelVal"></span><input data-f="level" type="range" min="0" max="100" /></label>
      <label>Drop in on beat <select data-f="drop">
        <option value="0">Beat 1</option><option value="1">Beat 2</option>
        <option value="2">Beat 3</option><option value="3">Beat 4</option>
      </select></label>
      <div class="row">
        <button class="btn" data-a="aud">♪</button>
        <button class="btn btn-p" data-a="rec">● REC</button>
        <button class="btn" data-a="mute">MUTE</button>
        <button class="btn" data-a="solo">SOLO</button>
      </div>
      <div class="meter" aria-hidden="true"><i></i></div>
      <canvas class="mini" width="220" height="44"></canvas>
      <span class="pill" id="pill-${i}"></span>`;
    const q = (s) => d.querySelector(s);
    noteOptions(q('[data-f=midi]'), t.midi);
    q('[data-f=midi]').onchange = (e) => { t.midi = +e.target.value; changed(i, true); };
    q('[data-f=vowel]').value = t.vowel;
    q('[data-f=vowel]').onchange = (e) => { t.vowel = e.target.value; t.mode = 'synth'; changed(i, true); };
    q('[data-f=cutoff]').value = t.cutoff;
    q('[data-f=cutoff]').oninput = (e) => {
      t.cutoff = +e.target.value; q('[data-f=cutoffVal]').textContent = t.cutoff + ' Hz';
      t.live.forEach((h) => h.lp && h.lp.frequency.setTargetAtTime(t.cutoff, S.ctx.currentTime, 0.03));
      save();
    };
    q('[data-f=level]').value = Math.round(t.level * 100);
    q('[data-f=level]').oninput = (e) => {
      t.level = +e.target.value / 100; q('[data-f=levelVal]').textContent = e.target.value + '%';
      save();
    };
    q('[data-f=drop]').value = t.drop;
    q('[data-f=drop]').onchange = (e) => { t.drop = +e.target.value; changed(i, true); };
    d.querySelectorAll('[data-src]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.src === 'mic' && !t.buffer) { recordTrack(i); return; }
        t.mode = b.dataset.src; changed(i, true);
      };
    });
    q('[data-a=aud]').onclick = () => audition(i);
    q('[data-a=rec]').onclick = () => recordTrack(i);
    q('[data-a=mute]').onclick = () => { t.mute = !t.mute; changed(i, true); };
    q('[data-a=solo]').onclick = () => { t.solo = !t.solo; changed(i, true); };
    els.tracks.appendChild(d);
    syncTrackCard(i);
  });
}
function syncTrackCard(i) {
  const t = S.tracks[i], d = els.tracks.children[i]; if (!d) return;
  const q = (s) => d.querySelector(s);
  q('[data-f=midi]').value = t.midi;
  q('[data-f=vowel]').value = t.vowel;
  q('[data-f=cutoffVal]').textContent = t.cutoff + ' Hz';
  q('[data-f=levelVal]').textContent = Math.round(t.level * 100) + '%';
  q('[data-f=drop]').value = t.drop;
  d.querySelectorAll('[data-src]').forEach((b) => b.classList.toggle('on', b.dataset.src === t.mode));
  q('[data-a=mute]').classList.toggle('on', t.mute);
  q('[data-a=solo]').classList.toggle('on', t.solo);
  q(`#pill-${i}`) && (d.querySelector('.pill').textContent = pillText(t));
}
function pillText(t) {
  if (t.mode === 'mic') return t.buffer ? `🎤 ${t.buffer.duration.toFixed(1)}s loop` : '🎤 no take yet';
  return `🎹 ${midiName(t.midi)} · ${t.vowel}`;
}
function changed(i, rebuild) {
  syncTrackCard(i); save();
  if (rebuild && S.playing && S.ready) restartVoices();
}
function audition(i) {
  boot();
  const t = S.tracks[i], ac = S.ctx, now = ac.currentTime + 0.02;
  if (t.mode === 'mic' && t.buffer) buildMic(ac, S.master, { buffer: t.buffer, cutoff: t.cutoff, level: t.level, when: now, dur: Math.min(2, t.buffer.duration) });
  else buildHum(ac, S.master, { freq: midiHz(t.midi), vowel: t.vowel, cutoff: t.cutoff, level: t.level, when: now, dur: 1.4 });
}

/* ---------- minis + scope (canvas only, no images) ---------- */
function drawMini(i) {
  const t = S.tracks[i], c = els.tracks.children[i]?.querySelector('.mini');
  if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#14101a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = TRACK_COLORS[i]; g.lineWidth = 2; g.beginPath();
  if (t.mode === 'mic' && t.buffer) {
    const d = t.buffer.getChannelData(0), step = Math.floor(d.length / W);
    for (let x = 0; x < W; x++) {
      const v = d[Math.min(d.length - 1, x * step)] || 0;
      const y = H / 2 - v * H * 0.48;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  } else {
    for (let x = 0; x < W; x++) {
      const y = H / 2 + Math.sin(x * 0.22 + i * 2) * Math.sin(x * 0.031) * H * 0.36;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  }
  g.stroke();
}
function drawAllMinis() { S.tracks.forEach((_, i) => drawMini(i)); }
function scopeLoop() {
  const c = els.scope, g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#14101a'; g.fillRect(0, 0, W, H);
  // halftone dots pulsing with the beat
  const pulse = S.playing ? (0.5 + 0.5 * Math.sin(performance.now() / (60000 / S.bpm) * Math.PI)) : 0.25;
  g.fillStyle = 'rgba(255,46,136,.35)';
  for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) {
    g.beginPath(); g.arc(x, y, 1 + pulse * 2.4, 0, 7); g.fill();
  }
  if (S.ready && S.analyser) {
    const d = new Uint8Array(S.analyser.fftSize);
    S.analyser.getByteTimeDomainData(d);
    g.strokeStyle = '#FFD500'; g.lineWidth = 4; g.shadowColor = '#FF2E88'; g.shadowBlur = 12;
    g.beginPath();
    d.forEach((v, x) => {
      const px = (x / d.length) * W, py = H / 2 + ((v - 128) / 128) * H * 0.42;
      x ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.stroke(); g.shadowBlur = 0;
  } else {
    g.fillStyle = '#FFD500'; g.font = '28px Bangers, cursive'; g.textAlign = 'center';
    g.fillText('PRESS START THE CLUB', W / 2, H / 2 + 10);
  }
  // mic meters
  if (S.micAnalyser && S.recording) {
    const d = new Uint8Array(S.micAnalyser.frequencyBinCount);
    S.micAnalyser.getByteFrequencyData(d);
    const lvl = d.reduce((a, b) => a + b, 0) / d.length / 255;
    const bar = els.tracks.children[S.recording.i]?.querySelector('.meter i');
    if (bar) bar.style.width = Math.min(100, lvl * 260) + '%';
  }
  requestAnimationFrame(scopeLoop);
}

/* ---------- misc ---------- */
function setStatus(m) { els.status.textContent = m; }

/* ---------- wire up ---------- */
function init() {
  load();
  els.bpm.textContent = S.bpm;
  els.swing.value = Math.round(S.swing * 100);
  els.swingVal.textContent = Math.round(S.swing * 100) + '%';
  els.bars.value = S.bars;
  els.barsVal.textContent = `${S.bars} bar${S.bars > 1 ? 's' : ''}`;
  els.click.checked = S.clickOn;
  renderPresets(); renderTracks();

  els.power.onclick = () => { boot(); S.ctx.resume(); };
  els.play.onclick = () => { boot(); S.playing ? stopTransport() : startTransport(); };
  els.tap.onclick = () => { boot(); tap(); };
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.key === 't' || e.key === 'T') { boot(); tap(); }
    if (e.key === ' ') { e.preventDefault(); boot(); S.playing ? stopTransport() : startTransport(); }
  });
  els.swing.oninput = (e) => {
    S.swing = +e.target.value / 100;
    els.swingVal.textContent = e.target.value + '%'; save();
  };
  els.bars.oninput = (e) => {
    S.bars = +e.target.value;
    els.barsVal.textContent = `${S.bars} bar${S.bars > 1 ? 's' : ''}`;
    save();
    if (S.playing) startTransportRefresh();
  };
  els.click.onchange = (e) => { S.clickOn = e.target.checked; save(); };
  els.wav.onclick = exportWav;
  setStatus('Idle. Hit START THE CLUB.');
}
init();
