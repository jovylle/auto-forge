// Yarrow Yodel Yard — yodel herbs into harmony.
// Inputs: mic pitch (autocorrelation) + built-in yodel voice (button/slider/keys).
// Game: match each phrase note within tolerance; wobble wide for YODEL x2.

'use strict';

const HERBS = [
  { name: 'Yarrow',  note: 'C', key: 'A', freq: 261.63 },
  { name: 'Sage',    note: 'D', key: 'S', freq: 293.66 },
  { name: 'Thyme',   note: 'E', key: 'D', freq: 329.63 },
  { name: 'Nettle',  note: 'G', key: 'F', freq: 392.0 },
  { name: 'Mugwort', note: 'A', key: 'G', freq: 440.0 },
];
const PHRASE_LEN = 8;
const HIT_CENTS = 60;
const PERFECT_CENTS = 25;
const NOTE_TIMEOUT_MS = 9000;
const BEST_KEY = 'yarrow-yard-best-v1';

const $ = (id) => document.getElementById(id);
const els = {
  score: $('score'), streak: $('streak'), round: $('round'), best: $('best'),
  harmonyFill: $('harmonyFill'), harmonyPct: $('harmonyPct'),
  yodelBadge: $('yodelBadge'), phrase: $('phrase'), phraseTitle: $('phraseTitle'),
  targetNote: $('targetNote'), targetHerb: $('targetHerb'),
  choir: $('choir'), pitchName: $('pitchName'), pitchHz: $('pitchHz'),
  meter: $('meter'), needle: $('needle'), targetZone: $('targetZone'), cents: $('cents'),
  yodelBtn: $('yodelBtn'), slider: $('pitchSlider'), keys: $('keys'),
  micBtn: $('micBtn'), micStatus: $('micStatus'), soundBtn: $('soundBtn'),
  freeBtn: $('freeBtn'), newPhraseBtn: $('newPhraseBtn'),
  howBtn: $('howBtn'), howDialog: $('howDialog'), howClose: $('howClose'),
  toast: $('toast'), resetBest: $('resetBest'),
};

const state = {
  score: 0, streak: 0, best: 0, round: 1,
  phrase: [], idx: 0, freestyle: false,
  hits: 0, attempts: 0,
  noteDeadline: 0,
  pitchHist: [],
};
try { state.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { /* private mode */ }
els.best.textContent = state.best;

/* ---------------- choir DOM ---------------- */
const herbEls = HERBS.map((h, i) => {
  const art = document.createElement('article');
  art.className = 'herb';
  art.innerHTML = `
    <span class="bloom" aria-hidden="true">✿</span>
    <svg class="stem" viewBox="0 0 60 86" aria-hidden="true">
      <g class="frond">
        <path d="M30 82V30" stroke="#171410" stroke-width="4" stroke-linecap="round"/>
        <path d="M30 52C20 52 15 44 14 34c10 1 15 7 16 18z" fill="#3E6B2F" stroke="#171410" stroke-width="2.5"/>
        <path d="M30 44c10 0 15-8 16-18-10 1-15 7-16 18z" fill="#3E6B2F" stroke="#171410" stroke-width="2.5"/>
        <path d="M30 34C24 34 21 29 21 23c6 0 9 4 9 11z" fill="#C2481F" stroke="#171410" stroke-width="2.5"/>
        <circle cx="30" cy="18" r="7" fill="#C2481F" stroke="#171410" stroke-width="2.5"/>
      </g>
    </svg>
    <h3>${h.name}</h3>
    <span class="note">${h.note} · ${h.key}</span>
    <div class="mouth"></div>
    <div class="pot"></div>`;
  els.choir.appendChild(art);
  const mouth = art.querySelector('.mouth');
  art.addEventListener('pointerdown', (e) => { e.preventDefault(); singHerb(i); });
  art.addEventListener('pointerup', stopVoice);
  art.addEventListener('pointercancel', stopVoice);
  art.addEventListener('pointerleave', stopVoice);
  return { art, mouth, awakeTimer: 0 };
});

HERBS.forEach((h, i) => {
  const b = document.createElement('button');
  b.className = 'key';
  b.type = 'button';
  b.innerHTML = `${h.note}<small>${h.key} · ${Math.round(h.freq)}Hz</small>`;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); singHerb(i); markKey(i, true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    b.addEventListener(ev, () => { markKey(i, false); stopVoice(); }));
  els.keys.appendChild(b);
});

/* ---------------- audio engine ---------------- */
let actx = null, master = null, voice = null, soundOn = true;
let micStream = null, micAnalyser = null, micBuf = null, micLive = false;

function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = soundOn ? 0.9 : 0;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}

function sliderFreq() {
  const t = Number(els.slider.value) / 100; // 0..1
  return 180 * Math.pow(620 / 180, t); // 180..620 Hz log
}

function startVoice() {
  if (!audio() || voice) return;
  const osc = actx.createOscillator();
  osc.type = 'sawtooth';
  const filt = actx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 1400; filt.Q.value = 2;
  const g = actx.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(soundOn ? 0.22 : 0, actx.currentTime, 0.03);
  osc.connect(filt); filt.connect(g); g.connect(master);
  osc.start();
  voice = { osc, gain: g, flip: false, flipAt: 0, bend: 0, bendStartY: null, yodelBreak: false };
}

function stopVoice() {
  if (!voice || !actx) { voice = null; return; }
  const v = voice; voice = null;
  v.gain.gain.setTargetAtTime(0, actx.currentTime, 0.05);
  setTimeout(() => { try { v.osc.stop(); } catch { /* already stopped */ } }, 300);
}

function updateVoice(now) {
  if (!voice || !actx) return sliderFreq();
  let f = sliderFreq() * Math.pow(2, voice.bend / 12);
  if (voice.yodelBreak && now > voice.flipAt) {
    voice.flip = !voice.flip;
    voice.flipAt = now + 150;
  }
  if (voice.flip) f *= 1.5; // chest/head yodel break, a fifth up
  voice.osc.frequency.setTargetAtTime(f, actx.currentTime, 0.02);
  return f;
}

function choirTone(freq, perfect) {
  if (!soundOn || !audio()) return;
  const t = actx.currentTime;
  [[freq, 0.2], [freq * 1.5, 0.08]].forEach(([f, vol]) => {
    const o = actx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (perfect ? 0.9 : 0.55));
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1);
  });
}

/* ---------------- mic pitch (autocorrelation) ---------------- */
function autoPitch(buf, sampleRate) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[i];
  const mean = sum / n;
  const minLag = Math.floor(sampleRate / 900), maxLag = Math.ceil(sampleRate / 70);
  let best = -Infinity, bestLag = -1, prev = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i + lag < n; i += 2) c += (buf[i] - mean) * (buf[i + lag] - mean);
    if (c > prev && c > best) { best = c; bestLag = lag; }
    prev = c;
  }
  return bestLag < 0 ? null : sampleRate / bestLag;
}

async function toggleMic() {
  if (micLive) {
    micLive = false;
    try { micStream?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    micStream = micAnalyser = null;
    els.micBtn.textContent = '🎙 enable mic';
    els.micBtn.setAttribute('aria-pressed', 'false');
    els.micStatus.textContent = 'Mic off — the slider, big button & keys yodel with the built-in voice. Mic adds real singing.';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('No mic API here — yodel with the slider + keys instead.');
    return;
  }
  try {
    if (!audio()) throw new Error('no webaudio');
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const src = actx.createMediaStreamSource(micStream);
    micAnalyser = actx.createAnalyser();
    micAnalyser.fftSize = 2048;
    src.connect(micAnalyser);
    micBuf = new Float32Array(micAnalyser.fftSize);
    micLive = true;
    els.micBtn.textContent = '🎙 mic live — tap to stop';
    els.micBtn.setAttribute('aria-pressed', 'true');
    els.micStatus.textContent = 'Mic live! Hum or yodel a note — watch the needle follow your voice.';
  } catch {
    toast('Mic blocked — yodel with the slider + keys instead.');
  }
}

/* ---------------- game ---------------- */
function randPhrase() {
  state.phrase = Array.from({ length: PHRASE_LEN }, () => Math.floor(Math.random() * HERBS.length));
  state.idx = 0;
  state.noteDeadline = performance.now() + NOTE_TIMEOUT_MS;
  renderPhrase();
}

function renderPhrase() {
  els.phrase.innerHTML = '';
  state.phrase.forEach((hi, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${HERBS[hi].note}<small>${HERBS[hi].name}</small>`;
    if (i < state.idx) li.className = 'hit';
    if (i === state.idx && !state.freestyle) li.classList.add('next');
    els.phrase.appendChild(li);
  });
  if (state.freestyle) {
    els.phraseTitle.textContent = 'Freestyle yard';
    els.targetNote.textContent = 'any';
    els.targetHerb.textContent = 'wake any herb to score';
  } else {
    const t = HERBS[state.phrase[state.idx]];
    els.phraseTitle.textContent = `Sing this phrase · round ${state.round}`;
    els.targetNote.textContent = t ? t.note : '✓';
    els.targetHerb.textContent = t ? `· sing like ${t.name}` : '';
  }
  positionTargetZone();
}

function hzToPct(f) {
  const lo = Math.log2(150), hi = Math.log2(700);
  const c = Math.min(700, Math.max(150, f));
  return Math.min(100, Math.max(0, ((Math.log2(c) - lo) / (hi - lo)) * 100));
}

function positionTargetZone() {
  if (state.freestyle || state.idx >= state.phrase.length) {
    els.targetZone.style.left = '0%';
    els.targetZone.style.width = '100%';
    return;
  }
  const t = HERBS[state.phrase[state.idx]].freq;
  const lo = t * Math.pow(2, -HIT_CENTS / 1200), hi = t * Math.pow(2, HIT_CENTS / 1200);
  els.targetZone.style.left = hzToPct(lo) + '%';
  els.targetZone.style.width = Math.max(4, hzToPct(hi) - hzToPct(lo)) + '%';
}

function nearestNote(freq) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const n = Math.round(12 * Math.log2(freq / 440)) + 69;
  return names[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

const centsOf = (f, target) => 1200 * Math.log2(f / target);

function burst(perfect) {
  const n = perfect ? 14 : 7;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'petal';
    s.textContent = perfect ? '✿' : '❋';
    s.style.left = 20 + Math.random() * 60 + 'vw';
    s.style.top = '38vh';
    s.style.color = perfect ? '#C2481F' : '#3E6B2F';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

let toastTimer = 0;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function onHit(hi, cents, yodel) {
  const perfect = Math.abs(cents) <= PERFECT_CENTS;
  const pts = (perfect ? 150 : 100) + state.streak * 10;
  const gained = yodel ? pts * 2 : pts;
  state.score += gained;
  state.streak += 1;
  state.hits += 1; state.attempts += 1;
  choirTone(HERBS[hi].freq, perfect);
  const h = herbEls[hi];
  h.art.classList.remove('hitpop'); void h.art.offsetWidth;
  h.art.classList.add('awake', 'hitpop');
  clearTimeout(h.awakeTimer);
  h.awakeTimer = setTimeout(() => h.art.classList.remove('awake'), 1600);
  burst(perfect);
  toast(`${perfect ? 'Perfect' : 'Hit'}! ${HERBS[hi].name} sings ${HERBS[hi].note}${yodel ? ' · YODEL ×2' : ''} +${gained}`);
  if (!state.freestyle) {
    state.idx += 1;
    if (state.idx >= state.phrase.length) {
      const bonus = 200 + state.streak * 5;
      state.score += bonus;
      state.round += 1;
      toast(`Round complete! +${bonus} harmony bonus ✿`);
      setTimeout(randPhrase, 900);
    } else {
      state.noteDeadline = performance.now() + NOTE_TIMEOUT_MS;
    }
    renderPhrase();
  }
  saveBest();
  renderStats();
}

function onMiss(hi) {
  state.streak = 0;
  state.attempts += 1;
  const h = herbEls[hi];
  h.art.classList.remove('shake'); void h.art.offsetWidth;
  h.art.classList.add('shake');
  toast(`${HERBS[hi].name} wilted… streak reset.`);
  state.idx += 1;
  if (state.idx >= state.phrase.length) {
    state.round += 1;
    setTimeout(randPhrase, 700);
  } else {
    state.noteDeadline = performance.now() + NOTE_TIMEOUT_MS;
  }
  renderPhrase();
  renderStats();
}

function renderStats() {
  els.score.textContent = state.score;
  els.streak.textContent = '×' + state.streak;
  els.round.textContent = state.round;
  const pct = state.attempts ? Math.round((state.hits / state.attempts) * 100) : 0;
  els.harmonyFill.style.width = pct + '%';
  els.harmonyPct.textContent = pct + '%';
}

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    els.best.textContent = state.best;
    try { localStorage.setItem(BEST_KEY, String(state.best)); } catch { /* private mode */ }
  }
}

// key/pointer singing: steer the slider voice to the herb's note
function singHerb(i) {
  startVoice();
  els.slider.value = String(Math.round((100 * Math.log(HERBS[i].freq / 180)) / Math.log(620 / 180)));
}

function markKey(hi, on) {
  els.keys.children[hi]?.classList.toggle('held', on);
}

/* ---------------- input wiring ---------------- */
let holding = false;

els.yodelBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { els.yodelBtn.setPointerCapture(e.pointerId); } catch { /* noop */ }
  holding = true;
  els.yodelBtn.classList.add('held');
  startVoice();
  if (voice) voice.bendStartY = e.clientY;
});
els.yodelBtn.addEventListener('pointermove', (e) => {
  if (holding && voice && voice.bendStartY != null) {
    voice.bend = Math.max(-4, Math.min(4, (voice.bendStartY - e.clientY) / 40));
  }
});
const release = () => {
  holding = false;
  els.yodelBtn.classList.remove('held');
  if (voice) voice.bend = 0;
  stopVoice();
};
els.yodelBtn.addEventListener('pointerup', release);
els.yodelBtn.addEventListener('pointercancel', release);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) {
      startVoice();
      if (voice) voice.yodelBreak = true;
      els.yodelBtn.classList.add('held');
    }
    return;
  }
  if (e.repeat) return;
  const hi = HERBS.findIndex((h) => h.key.toLowerCase() === e.key.toLowerCase());
  if (hi >= 0) { singHerb(hi); markKey(hi, true); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    if (voice) voice.yodelBreak = false;
    els.yodelBtn.classList.remove('held');
    if (!holding) stopVoice();
    return;
  }
  const hi = HERBS.findIndex((h) => h.key.toLowerCase() === e.key.toLowerCase());
  if (hi >= 0) { markKey(hi, false); stopVoice(); }
});

els.slider.addEventListener('input', () => { audio(); });
els.micBtn.addEventListener('click', toggleMic);
els.soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  els.soundBtn.textContent = soundOn ? '🔊 sound on' : '🔇 muted';
  els.soundBtn.setAttribute('aria-pressed', String(soundOn));
  if (master && actx) master.gain.setTargetAtTime(soundOn ? 0.9 : 0, actx.currentTime, 0.02);
});
els.newPhraseBtn.addEventListener('click', () => { randPhrase(); toast('Fresh phrase planted — sing it!'); });
els.freeBtn.addEventListener('click', () => {
  state.freestyle = !state.freestyle;
  els.freeBtn.textContent = 'freestyle: ' + (state.freestyle ? 'on' : 'off');
  els.freeBtn.setAttribute('aria-pressed', String(state.freestyle));
  state.idx = 0;
  state.noteDeadline = performance.now() + NOTE_TIMEOUT_MS;
  renderPhrase();
});
els.howBtn.addEventListener('click', () => els.howDialog.showModal());
els.howClose.addEventListener('click', () => els.howDialog.close());
els.resetBest.addEventListener('click', () => {
  state.best = 0;
  try { localStorage.removeItem(BEST_KEY); } catch { /* noop */ }
  els.best.textContent = '0';
  toast('Best score composted.');
});

/* ---------------- main loop ---------------- */
let lastHitAt = 0;

function readPitch(now) {
  if (micLive && micAnalyser && actx) {
    micAnalyser.getFloatTimeDomainData(micBuf);
    const p = autoPitch(micBuf, actx.sampleRate);
    if (p && p > 70 && p < 900) return { freq: p, source: 'mic' };
  }
  if (voice) return { freq: updateVoice(now), source: 'voice' };
  return null;
}

function wobbleIsYodel() {
  const w = state.pitchHist.slice(-12);
  if (w.length < 6) return false;
  const ratio = Math.max(...w) / Math.max(1e-9, Math.min(...w));
  return isFinite(ratio) && 1200 * Math.log2(ratio) > 120;
}

function frame(now) {
  const reading = readPitch(now);
  const freq = reading?.freq ?? null;

  if (freq != null) {
    state.pitchHist.push(freq);
    if (state.pitchHist.length > 24) state.pitchHist.shift();

    if (now - lastHitAt > 300) {
      if (state.freestyle) {
        let bestI = -1, bestC = Infinity;
        HERBS.forEach((h, i) => {
          const c = Math.abs(centsOf(freq, h.freq));
          if (c < bestC) { bestC = c; bestI = i; }
        });
        if (bestI >= 0 && bestC <= HIT_CENTS && now - lastHitAt > 420) {
          lastHitAt = now;
          const yodel = wobbleIsYodel();
          els.yodelBadge.classList.toggle('lit', yodel);
          onHit(bestI, bestC, yodel);
          state.pitchHist.length = 0;
        }
      } else if (state.idx < state.phrase.length) {
        const hi = state.phrase[state.idx];
        const c = centsOf(freq, HERBS[hi].freq);
        if (Math.abs(c) <= HIT_CENTS) {
          lastHitAt = now;
          const yodel = wobbleIsYodel();
          els.yodelBadge.classList.toggle('lit', yodel);
          onHit(hi, c, yodel);
        } else if (reading.source === 'mic' && now > state.noteDeadline) {
          onMiss(hi);
        }
      }
    }
  } else {
    els.yodelBadge.classList.remove('lit');
  }

  renderMeter(freq, reading?.source);
  herbEls.forEach((h, i) => {
    if (freq == null) {
      if (!els.keys.children[i]?.classList.contains('held')) h.mouth.style.height = '';
      return;
    }
    const closeness = Math.max(0, 1 - Math.abs(centsOf(freq, HERBS[i].freq)) / 400);
    h.mouth.style.height = 4 + closeness * (6 + ((freq % 60) / 60) * 18) + 'px';
  });

  requestAnimationFrame(frame);
}

function renderMeter(freq, source) {
  if (freq == null) {
    els.pitchName.textContent = '—';
    els.pitchHz.textContent = micLive ? 'listening…' : 'hold to yodel';
    els.cents.textContent = '±0¢';
    els.needle.style.left = '50%';
    return;
  }
  els.pitchName.textContent = nearestNote(freq);
  els.pitchHz.textContent = `${Math.round(freq)} Hz${source === 'mic' ? ' · mic' : ''}`;
  els.needle.style.left = hzToPct(freq) + '%';
  if (!state.freestyle && state.idx < state.phrase.length) {
    const c = Math.round(centsOf(freq, HERBS[state.phrase[state.idx]].freq));
    els.cents.textContent = (c >= 0 ? '+' : '') + c + '¢';
  } else {
    els.cents.textContent = '';
  }
}

/* ---------------- boot ---------------- */
randPhrase();
renderStats();
renderMeter(null);
requestAnimationFrame(frame);
