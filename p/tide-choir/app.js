/* Tide Choir — a harbor that sings the tide in voices.
   Interaction: TYPE ONLY (keyboard). No click/drag listeners anywhere.
   Features: voice waves (canvas) · tide choir (6 WebAudio voices) · harbor mix (tide/fog/harbor + presets + ritual + hymns)
*/
(() => {
"use strict";

const VOICES = [
  { key: "a", name: "Buoy Bell",   rune: "ᛒ", freq: 110.00, wave: "sawtooth", color: "#39e6c3", desc: "deep iron bell" },
  { key: "s", name: "Salt Siren",   rune: "ᛋ", freq: 130.81, wave: "triangle", color: "#8b7cf6", desc: "salt siren" },
  { key: "d", name: "Drowned Cantor", rune: "ᛞ", freq: 146.83, wave: "sawtooth", color: "#5fd0ff", desc: "drowned cantor" },
  { key: "f", name: "Gull Witch",   rune: "ᚷ", freq: 164.81, wave: "square",   color: "#f4e8c9", desc: "gull witch" },
  { key: "g", name: "Iron Foghorn", rune: "ᚠ", freq: 196.00, wave: "sawtooth", color: "#c9a45c", desc: "iron foghorn" },
  { key: "h", name: "Moon Oyster",  rune: "ᛗ", freq: 220.00, wave: "sine",     color: "#e5484d", desc: "moon oyster" },
];
const KEY2VOICE = Object.fromEntries(VOICES.map((v, i) => [v.key, i]));
const STORE_KEY = "tide-choir-v1";

const state = {
  tide: 50, fog: 45, harbor: 40,
  muted: false, ritual: false, surge: false,
  active: new Set(), hymns: 0,
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    for (const k of ["tide", "fog", "harbor", "hymns"]) {
      if (typeof s[k] === "number") state[k] = Math.max(0, Math.min(100, s[k]));
    }
  } catch { /* sea forgets */ }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ tide: state.tide, fog: state.fog, harbor: state.harbor, hymns: state.hymns })); } catch {}
}
load();

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const wakeEl = $("wake"), stallsEl = $("stalls"), canvas = $("waves");
const ctx = canvas.getContext("2d");

stallsEl.innerHTML = VOICES.map((v, i) => `
  <li class="stall" id="stall-${i}">
    <span class="key">${v.key.toUpperCase()}</span>
    <div class="rune" aria-hidden="true">${v.rune}</div>
    <p class="vname">${v.name}</p>
    <p class="vfreq">${v.freq.toFixed(1)} Hz · hold to sing</p>
    <div class="vbars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  </li>`).join("");

const stallEls = VOICES.map((_, i) => $("stall-" + i));
stallEls.forEach((el) => {
  const bars = el.querySelectorAll(".vbars i");
  bars.forEach((b, j) => { b.style.height = (4 + j * 2) + "px"; });
});

function say(msg) { wakeEl.innerHTML = msg; }
function refreshMeters() {
  $("v-tide").textContent = Math.round(state.tide);
  $("v-fog").textContent = Math.round(state.fog);
  $("v-harbor").textContent = Math.round(state.harbor);
  $("b-tide").style.width = state.tide + "%";
  $("b-fog").style.width = state.fog + "%";
  $("b-harbor").style.width = state.harbor + "%";
  $("tide-fill").style.height = (8 + state.tide * 0.84) + "%";
  $("tide-read").textContent = `tide ${Math.round(state.tide)} · fog ${Math.round(state.fog)} · harbor ${Math.round(state.harbor)}${state.ritual ? " · ritual" : ""}${state.muted ? " · muted" : ""}`;
  $("hymn-count").textContent = `${state.hymns} hymn${state.hymns === 1 ? "" : "s"} cast`;
}
refreshMeters();
$("hymn-count").textContent = `${state.hymns} hymn${state.hymns === 1 ? "" : "s"} cast`;

// ---------- AUDIO ----------
let AC = null, master, verb, verbGain, tideNodes = null, harborNodes = null;
const live = new Map(); // voiceIndex -> nodes

function ensureAudio() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = state.muted ? 0 : 0.8;
  const comp = AC.createDynamicsCompressor();
  master.connect(comp); comp.connect(AC.destination);
  // generated-impulse convolver for fog
  verb = AC.createConvolver();
  verb.buffer = impulse(2.8, 2.2);
  verbGain = AC.createGain(); verbGain.gain.value = state.fog / 100 * 0.9;
  verb.connect(verbGain); verbGain.connect(master);
  startTideBed(); startHarborBed();
}
function impulse(dur, decay) {
  const rate = AC.sampleRate, buf = AC.createBuffer(2, rate * dur, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
  }
  return buf;
}
function noiseBuffer() {
  const rate = AC.sampleRate, buf = AC.createBuffer(1, rate * 2, rate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  return buf;
}
let sharedNoise = null;

function startTideBed() {
  sharedNoise = noiseBuffer();
  const g = AC.createGain(); g.gain.value = 0.05 + state.tide / 100 * 0.12;
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320 + state.tide * 6;
  const src = AC.createBufferSource(); src.buffer = sharedNoise; src.loop = true;
  src.connect(f); f.connect(g); g.connect(master);
  const o1 = AC.createOscillator(); o1.type = "sine"; o1.frequency.value = 55;
  const o2 = AC.createOscillator(); o2.type = "sine"; o2.frequency.value = 55.6;
  const dg = AC.createGain(); dg.gain.value = 0.05 + state.tide / 100 * 0.1;
  o1.connect(dg); o2.connect(dg); dg.connect(master);
  src.start(); o1.start(); o2.start();
  tideNodes = { g, f, dg };
}
function startHarborBed() {
  const g = AC.createGain(); g.gain.value = state.harbor / 100 * 0.16;
  const f = AC.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.6;
  const src = AC.createBufferSource(); src.buffer = sharedNoise; src.loop = true; src.playbackRate.value = 0.6;
  src.connect(f); f.connect(g); g.connect(master); g.connect(verb);
  src.start();
  harborNodes = { g };
  scheduleBell();
}
function scheduleBell() {
  if (!AC) return;
  const wait = 9000 + Math.random() * 14000;
  setTimeout(() => {
    if (AC && state.harbor > 5 && !state.muted) fogBell();
    scheduleBell();
  }, wait);
}
function fogBell() {
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = "sine";
  o.frequency.value = [196, 164.81, 146.83, 130.81][Math.floor(Math.random() * 4)];
  const g = AC.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.08 * (state.harbor / 60 + 0.3), t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  o.connect(g); g.connect(master); g.connect(verb);
  o.start(t); o.stop(t + 3.4);
}

function voiceOn(i, auto = false) {
  ensureAudio();
  if (live.has(i)) return;
  const v = VOICES[i], t = AC.currentTime;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  const peak = 0.22 * (state.surge ? 1.5 : 1);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + (auto ? 0.35 : 0.12));
  const flt = AC.createBiquadFilter(); flt.type = "lowpass";
  flt.frequency.value = 500 + state.tide * 14 + state.fog * 6;
  flt.Q.value = 2.2;
  const o1 = AC.createOscillator(); o1.type = v.wave; o1.frequency.value = v.freq;
  const o2 = AC.createOscillator(); o2.type = "sine"; o2.frequency.value = v.freq * 2.001; // ghost octave
  const g2 = AC.createGain(); g2.gain.value = 0.35;
  const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.4 + (i * 0.13);
  const lfoG = AC.createGain(); lfoG.gain.value = 220;
  lfo.connect(lfoG); lfoG.connect(flt.frequency);
  o1.connect(flt); o2.connect(g2); g2.connect(flt);
  flt.connect(g); g.connect(master); g.connect(verb);
  o1.detune.value = -4; o2.detune.value = 5;
  o1.start(); o2.start(); lfo.start();
  live.set(i, { o1, o2, lfo, g, flt });
  state.active.add(i);
  stallEls[i].classList.add("singing");
  if (!auto) say(`<lit>${v.rune} ${v.name}</lit> sings — ${v.desc} · ${v.freq.toFixed(1)} Hz`);
}
function voiceOff(i) {
  const n = live.get(i);
  state.active.delete(i);
  stallEls[i].classList.remove("singing");
  if (!n) return;
  const t = AC.currentTime;
  try {
    n.g.gain.cancelScheduledValues(t);
    n.g.gain.setValueAtTime(Math.max(n.g.gain.value, 0.001), t);
    n.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); } catch {} n.g.disconnect(); }, 800);
  } catch {}
  live.delete(i);
}
function applyMix() {
  if (!AC) return;
  const t = AC.currentTime;
  if (tideNodes) {
    tideNodes.g.gain.setTargetAtTime(0.05 + state.tide / 100 * 0.12 * (state.surge ? 1.6 : 1), t, 0.2);
    tideNodes.f.frequency.setTargetAtTime(320 + state.tide * 6, t, 0.2);
    tideNodes.dg.gain.setTargetAtTime(0.05 + state.tide / 100 * 0.1, t, 0.2);
  }
  if (harborNodes) harborNodes.g.gain.setTargetAtTime(state.harbor / 100 * 0.16, t, 0.2);
  if (verbGain) verbGain.gain.setTargetAtTime(state.fog / 100 * 0.9, t, 0.2);
  live.forEach((n) => n.flt.frequency.setTargetAtTime(500 + state.tide * 14 + state.fog * 6, t, 0.2));
}

// ---------- generative ritual + hymns ----------
let ritualTimer = null;
function setRitual(on) {
  state.ritual = on;
  say(on ? "❖ the ritual begins — the harbor sings itself ❖" : "the ritual ends — the water returns to you");
  if (on) {
    ensureAudio();
    const step = () => {
      if (!state.ritual) return;
      // tide breathes on its own
      state.tide = Math.max(5, Math.min(100, state.tide + (Math.random() * 14 - 7)));
      // 1–3 voices, weighted to low voices at low tide
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const idx = Math.floor(Math.pow(Math.random(), 1.3) * VOICES.length);
        voiceOn(idx, true);
        setTimeout(() => { if (state.ritual || state.active.has(idx)) voiceOff(idx); }, 900 + Math.random() * 2200);
      }
      applyMix(); refreshMeters(); save();
      ritualTimer = setTimeout(step, 1400 + Math.random() * 2200);
    };
    step();
  } else {
    clearTimeout(ritualTimer);
    [...state.active].forEach(voiceOff);
  }
  refreshMeters();
}
function castHymn() {
  ensureAudio();
  const len = 4 + Math.floor(Math.random() * 4);
  const seq = Array.from({ length: len }, () => Math.floor(Math.pow(Math.random(), 1.2) * VOICES.length));
  say(`❖ hymn of ${len} voices cast: ${seq.map((i) => VOICES[i].rune).join(" ")} ❖`);
  seq.forEach((idx, k) => {
    setTimeout(() => voiceOn(idx, true), k * 520);
    setTimeout(() => voiceOff(idx), k * 520 + 620);
  });
  state.hymns++; save(); refreshMeters();
}
function preset(n) {
  if (n === 1) { state.tide = 18; state.fog = 30; state.harbor = 25; say("low-tide vigil — bare sand and one bell"); }
  if (n === 2) { state.tide = 88; state.fog = 70; state.harbor = 75; say("storm vigil — the harbor howls in six throats"); }
  if (n === 3) { state.tide = 55; state.fog = 80; state.harbor = 45; say("moon crossing — thick fog, silver water"); }
  ensureAudio(); applyMix(); refreshMeters(); save();
}

// ---------- keyboard: the ONLY interaction ----------
const HELD = new Set();
window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return; // keep browser chords free
  const k = e.key.toLowerCase();
  if (["a", "s", "d", "f", "g", "h", " "].includes(k)) e.preventDefault();
  if (e.repeat) return;

  if (k in KEY2VOICE) { voiceOn(KEY2VOICE[k]); HELD.add(k); return; }
  switch (k) {
    case "q": ensureAudio(); state.tide = Math.max(0, state.tide - 7); applyMix(); refreshMeters(); save(); say("the tide ebbs…"); break;
    case "w": ensureAudio(); state.tide = Math.min(100, state.tide + 7); applyMix(); refreshMeters(); save(); say("the tide floods…"); break;
    case "z": ensureAudio(); state.fog = Math.max(0, state.fog - 7); applyMix(); refreshMeters(); save(); say("the fog thins…"); break;
    case "x": ensureAudio(); state.fog = Math.min(100, state.fog + 7); applyMix(); refreshMeters(); save(); say("the fog thickens…"); break;
    case "v": ensureAudio(); state.harbor = Math.max(0, state.harbor - 7); applyMix(); refreshMeters(); save(); say("the harbor hushes…"); break;
    case "b": ensureAudio(); state.harbor = Math.min(100, state.harbor + 7); applyMix(); refreshMeters(); save(); say("the harbor wakes…"); break;
    case " ": state.surge = true; ensureAudio(); applyMix(); say("❖ STORM SURGE — hold! ❖"); break;
    case "r": setRitual(!state.ritual); break;
    case "c": castHymn(); break;
    case "1": preset(1); break;
    case "2": preset(2); break;
    case "3": preset(3); break;
    case "m":
      ensureAudio(); state.muted = !state.muted;
      if (master) master.gain.setTargetAtTime(state.muted ? 0 : 0.8, AC.currentTime, 0.05);
      refreshMeters(); say(state.muted ? "the sea is silenced (M to wake)" : "the sea returns");
      break;
    case "?": {
      const line = `Six voices A S D F G H. Tide Q W. Fog Z X. Harbor V B. Space surge. R ritual. C hymn. 1 2 3 mixes. M mute. Currently tide ${Math.round(state.tide)}, fog ${Math.round(state.fog)}, harbor ${Math.round(state.harbor)}.`;
      say(line); try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(line)); } catch {}
      break;
    }
  }
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === " ") { state.surge = false; applyMix(); if (!state.active.size) say("the surge passes…"); return; }
  if (k in KEY2VOICE) { HELD.delete(k); voiceOff(KEY2VOICE[k]); if (!state.active.size && !state.ritual) say("the water stills — hold a letter to sing"); }
});
window.addEventListener("blur", () => { [...HELD].forEach((k) => voiceOff(KEY2VOICE[k])); HELD.clear(); state.surge = false; });

// ---------- voice waves canvas ----------
let t = 0;
function fit() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(320, Math.round(r.width * dpr));
  canvas.height = Math.round(canvas.width * 340 / 960);
}
window.addEventListener("resize", fit); fit();

function draw() {
  t += 0.016;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // moon reflection
  const mg = ctx.createLinearGradient(0, 0, 0, H);
  mg.addColorStop(0, "rgba(244,232,201,0.10)");
  mg.addColorStop(0.5, "rgba(57,230,195,0.05)");
  mg.addColorStop(1, "rgba(4,8,18,0.4)");
  ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.78;
  ctx.save(); ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const y = H * 0.12 + i * (H * 0.032);
    const wob = Math.sin(t * 1.4 + i * 0.7) * (4 + i * 0.8);
    ctx.fillStyle = `rgba(244,232,201,${0.16 - i * 0.005})`;
    const ww = (W * 0.05) * (0.4 + i * 0.06) + Math.abs(wob);
    ctx.fillRect(cx - ww / 2 + wob * 0.3, y, ww, 2);
  }
  ctx.restore();

  const tideH = H * (0.55 + state.tide / 100 * 0.25);
  const baseAmp = H * (0.02 + state.tide / 100 * 0.06) * (state.surge ? 1.7 : 1);

  // tide body wave (always)
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) {
    const y = tideH + Math.sin(x * 0.008 + t * 1.1) * baseAmp + Math.sin(x * 0.02 - t * 0.7) * baseAmp * 0.4;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(57,230,195,0.5)"; ctx.lineWidth = Math.max(2, W / 480); ctx.stroke();
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = "rgba(26,143,122,0.16)"; ctx.fill();

  // each voice = a wave; silent voices are faint dotted ghosts
  VOICES.forEach((v, i) => {
    const on = state.active.has(i);
    const y0 = H * (0.30 + i * 0.075);
    const amp = (on ? baseAmp * (1.6 + i * 0.18) : baseAmp * 0.35) * (state.surge ? 1.5 : 1);
    const f = v.freq / 110;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = y0 + Math.sin(x * 0.006 * f + t * (1.2 + f * 0.5) + i) * amp
                  + Math.sin(x * 0.017 - t * 2 + i * 2) * amp * 0.25;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    if (on) {
      ctx.shadowColor = v.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = v.color; ctx.lineWidth = Math.max(2.5, W / 380);
      ctx.stroke(); ctx.shadowBlur = 0;
      // rune crest markers
      ctx.fillStyle = v.color;
      for (let k = 1; k <= 3; k++) {
        const x = (W / 4) * k + Math.sin(t * 2 + k + i) * 10;
        const y = y0 + Math.sin(x * 0.006 * f + t * (1.2 + f * 0.5) + i) * amp;
        ctx.font = `${Math.round(H * 0.07)}px serif`;
        ctx.fillText(v.rune, x, y - 8);
      }
    } else {
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = "rgba(154,163,184,0.30)"; ctx.lineWidth = 1.2;
      ctx.stroke(); ctx.setLineDash([]);
    }
    // stall mini-bars pulse
    const bars = stallEls[i].querySelectorAll(".vbars i");
    bars.forEach((b, j) => {
      b.style.height = on
        ? (6 + Math.abs(Math.sin(t * 6 + j * 1.3 + i)) * 14) + "px"
        : (4 + j * 1.2) + "px";
    });
  });

  // fog veil
  ctx.fillStyle = `rgba(154,163,184,${state.fog / 100 * 0.14})`;
  ctx.fillRect(0, 0, W, H * 0.5);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

say(state.hymns > 0
  ? `the sea remembers you — <lit>${state.hymns} hymns cast</lit>. Hold <lit>A S D F G H</lit> to sing.`
  : `press &amp; hold <lit>A S D F G H</lit> to wake the six voices — <lit>Q/W</lit> moves the tide`);
})();
