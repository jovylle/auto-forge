/* Century Echo Dial — spin a clock dial to remix centuries into ambient loops.
   All sound is synthesized live with WebAudio (no samples, no network).
   Works from file:// — plain classic script, no imports. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var dial = $("dial"), needle = $("needle"), ticks = $("ticks");
  var eraLabel = $("eraLabel"), eraName = $("eraName"), eraSub = $("eraSub"), yearOut = $("yearReadout");
  var btnPlay = $("btnPlay"), btnExport = $("btnExport"), centerBtn = $("centerBtn"), centerGlyph = $("centerGlyph");
  var btnChime = $("btnChime"), btnTick = $("btnTick"), btnWash = $("btnWash");
  var volEl = $("vol"), statusEl = $("status"), meterFill = $("meterFill");
  var egg = $("egg"), eggClose = $("eggClose"), eggDot = $("eggDot");

  var MIN = 1500, MAX = 2026, SPAN = MAX - MIN;
  var NS = "http://www.w3.org/2000/svg";

  /* Six eras, one per century. pat[] = 16 steps of scale-degrees (-1 = rest). */
  var ERAS = [
    { tag: "INK & VELLUM", name: "Ink & Vellum", sub: "Quill scratch & chapel stone.", root: 45, scale: [0, 3, 5, 7, 10], bpm: 56, wave: "triangle", tickEvery: 4, wash: [33, 40, 45], crackle: 0.0,
      pat: [0, -1, 2, -1, 1, -1, 0, -1, 3, -1, 2, 1, 0, -1, -1, -1] },
    { tag: "BAROQUE PLUCK", name: "Baroque Pluck", sub: "Catgut strings & candle smoke.", root: 50, scale: [0, 2, 4, 7, 9], bpm: 72, wave: "triangle", tickEvery: 3, wash: [38, 45, 50], crackle: 0.0,
      pat: [0, 1, 2, 1, 3, 2, 1, 0, 2, -1, 1, -1, 0, -1, -1, -1] },
    { tag: "CLOCKWORK WALTZ", name: "Clockwork Waltz", sub: "Brass gears in three-quarter time.", root: 48, scale: [0, 2, 4, 7, 9], bpm: 96, wave: "sine", tickEvery: 2, wash: [36, 43, 48], crackle: 0.0,
      pat: [0, -1, -1, 2, -1, -1, 4, -1, -1, 3, -1, -1, 2, -1, 1, -1] },
    { tag: "IRON CHOIR", name: "Iron Choir", sub: "Steam hymns & iron bells.", root: 43, scale: [0, 3, 5, 7, 10], bpm: 66, wave: "sawtooth", tickEvery: 4, wash: [31, 38, 43], crackle: 0.05,
      pat: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, 0, -1, -1, -1, 3, -1] },
    { tag: "STATIC AGE", name: "Static Age", sub: "Shellac crackle & midnight radio.", root: 46, scale: [0, 3, 5, 6, 7, 10], bpm: 84, wave: "square", tickEvery: 2, wash: [34, 41, 46], crackle: 0.5,
      pat: [0, -1, 1, 2, -1, 3, -1, 2, 4, -1, 2, -1, 1, -1, 0, -1] },
    { tag: "GLASS SIGNAL", name: "Glass Signal", sub: "Fibre-optic shimmer, always on.", root: 57, scale: [0, 2, 4, 7, 9, 11], bpm: 104, wave: "sine", tickEvery: 4, wash: [45, 52, 57], crackle: 0.0,
      pat: [4, -1, 3, -1, 2, 1, 2, -1, 0, -1, 1, -1, 2, -1, 5, -1] }
  ];

  var state = { year: 1643, playing: false, vol: 0.7,
    layers: { chime: true, tick: true, wash: true }, eggFound: false };

  function load() {
    try {
      var raw = localStorage.getItem("century-echo-dial");
      if (!raw) return;
      var s = JSON.parse(raw);
      if (typeof s.year === "number") state.year = Math.min(MAX, Math.max(MIN, s.year));
      if (s.layers) for (var k in state.layers) if (typeof s.layers[k] === "boolean") state.layers[k] = s.layers[k];
      if (typeof s.vol === "number") state.vol = Math.min(1, Math.max(0, s.vol));
      if (s.eggFound) state.eggFound = true;
    } catch (e) { /* private mode etc — ignore */ }
  }
  function save() {
    try {
      localStorage.setItem("century-echo-dial", JSON.stringify(
        { year: Math.round(state.year), layers: state.layers, vol: state.vol, eggFound: state.eggFound }));
    } catch (e) { /* ignore */ }
  }

  /* ---------- dial face ---------- */
  function buildTicks() {
    if (!ticks) return;
    while (ticks.firstChild) ticks.removeChild(ticks.firstChild);
    for (var i = 0; i < 60; i++) {
      var a = (i / 60) * Math.PI * 2;
      var major = i % 10 === 0;
      var r1 = major ? 78 : 86, r2 = 92;
      var l = document.createElementNS(NS, "line");
      l.setAttribute("x1", 100 + r1 * Math.sin(a)); l.setAttribute("y1", 100 - r1 * Math.cos(a));
      l.setAttribute("x2", 100 + r2 * Math.sin(a)); l.setAttribute("y2", 100 - r2 * Math.cos(a));
      l.setAttribute("stroke", "currentColor");
      l.setAttribute("stroke-width", major ? 1.4 : 0.7);
      l.setAttribute("opacity", major ? 0.9 : 0.4);
      l.setAttribute("data-i", i);
      ticks.appendChild(l);
    }
    var labels = ["16", "17", "18", "19", "20", "21"];
    for (var c = 0; c < 6; c++) {
      var midY = Math.min(1550 + c * 100, 2000); // true dial position of each century
      var la = ((midY - MIN) / SPAN) * Math.PI * 2; // 0 = top, clockwise (matches needle)
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", 100 + 62 * Math.sin(la)); t.setAttribute("y", 100 - 62 * Math.cos(la) + 3.5);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "9");
      t.setAttribute("font-family", "IBM Plex Mono, monospace");
      t.setAttribute("fill", "currentColor"); t.setAttribute("opacity", "0.55");
      t.textContent = labels[c];
      ticks.appendChild(t);
    }
  }

  function eraFloat() { return (state.year - MIN) / 100; } // 0..~5.26
  function eraIndex() { return Math.min(ERAS.length - 1, Math.max(0, Math.round(eraFloat()))); }

  var shownEra = -1;
  function render() {
    var ang = ((state.year - MIN) / SPAN) * 360;
    if (needle) needle.style.rotate = ang.toFixed(2) + "deg";
    var y = Math.round(state.year);
    if (yearOut) yearOut.textContent = String(y).split("").join(" ");
    if (dial) dial.setAttribute("aria-valuenow", String(y));
    if (dial) dial.setAttribute("aria-valuetext", y + ", " + ERAS[eraIndex()].name);
    var ei = eraIndex(), e = ERAS[ei];
    if (ei !== shownEra) {
      shownEra = ei;
      if (eraName) {
        eraName.classList.add("fade");
        setTimeout(function () {
          eraName.textContent = e.name;
          eraLabel.textContent = e.tag + " · C.";
          eraSub.textContent = e.sub;
          eraName.classList.remove("fade");
        }, 160);
      } else {
        eraLabel.textContent = e.tag + " · C.";
        eraSub.textContent = e.sub;
      }
    }
  }

  /* ---------- audio ---------- */
  var ctx = null, master = null, analyser = null, analyserData = null;
  var busChime = null, busTick = null, busWash = null, crackleSrc = null, crackleGain = null, noiseBuf = null;
  var schedTimer = null, step = 0, nextT = 0;

  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensureAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setStatus("audio not supported in this browser"); return false; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = state.vol;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    analyserData = new Uint8Array(analyser.fftSize);
    master.connect(analyser); analyser.connect(ctx.destination);
    busChime = ctx.createGain(); busTick = ctx.createGain(); busWash = ctx.createGain();
    busChime.gain.value = state.layers.chime ? 0.9 : 0.0;
    busTick.gain.value = state.layers.tick ? 0.5 : 0.0;
    busWash.gain.value = state.layers.wash ? 0.35 : 0.0;
    busChime.connect(master); busTick.connect(master); busWash.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function pluck(dest, freq, t, vel, dur, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    var o2 = ctx.createOscillator(), g2 = ctx.createGain(); // faint octave shimmer
    o2.type = "sine"; o2.frequency.value = freq * 2;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.25), t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
    o2.connect(g2); g2.connect(dest);
    o2.start(t); o2.stop(t + dur + 0.05);
  }

  function click(dest, t, vel) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 3200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + 0.08);
  }

  function pad(dest, midis, t, dur, vel) {
    for (var i = 0; i < midis.length; i++) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sine"; o.frequency.value = mf(midis[i]); o.detune.value = (i - 1) * 5;
      f.type = "lowpass"; f.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  function blendParams() {
    var f = Math.min(ERAS.length - 1.001, Math.max(0, eraFloat()));
    var i = Math.floor(f), fr = f - i;
    var a = ERAS[i], b = ERAS[Math.min(ERAS.length - 1, i + 1)];
    return { a: a, b: b, wa: 1 - fr, wb: fr, bpm: a.bpm * (1 - fr) + b.bpm * fr,
             crackle: a.crackle * (1 - fr) + b.crackle * fr };
  }

  function voice(era, w, s, t) {
    if (w <= 0.02) return;
    if (state.layers.chime) {
      var deg = era.pat[s % 16];
      if (deg >= 0) {
        var midi = era.root + 12 + era.scale[deg % era.scale.length];
        pluck(busChime, mf(midi), t, 0.32 * w + 0.04, 1.4, era.wave);
        if (s % 16 === 0) pluck(busChime, mf(midi - 12), t, 0.2 * w, 2.2, "sine");
      }
    }
    if (state.layers.tick && s % era.tickEvery === 0) click(busTick, t, 0.5 * w + 0.03);
  }

  function scheduleStep(s, t) {
    var p = blendParams();
    voice(p.a, p.wa, s, t);
    voice(p.b, p.wb, s, t);
    if (state.layers.wash && s % 32 === 0) {
      var spb = 60 / p.bpm, bar = spb * 8;
      pad(busWash, p.a.wash, t, bar, 0.20 * p.wa + 0.01);
      pad(busWash, p.b.wash, t, bar, 0.20 * p.wb + 0.01);
    }
  }

  function schedulerTick() {
    if (!ctx) return;
    var p = blendParams(), spb = 60 / p.bpm, stepDur = spb / 4;
    while (nextT < ctx.currentTime + 0.28) {
      scheduleStep(step, nextT);
      nextT += stepDur; step++;
    }
    if (crackleGain) {
      var target = state.playing ? Math.min(0.5, p.crackle) * 0.35 : 0;
      crackleGain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    }
  }

  function startLoop() {
    if (!ensureAudio()) return;
    step = 0; nextT = ctx.currentTime + 0.08;
    crackleSrc = ctx.createBufferSource(); crackleSrc.buffer = noiseBuf; crackleSrc.loop = true;
    var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 4200; f.Q.value = 0.6;
    crackleGain = ctx.createGain(); crackleGain.gain.value = 0;
    crackleSrc.connect(f); f.connect(crackleGain); crackleGain.connect(master);
    crackleSrc.start();
    schedTimer = setInterval(schedulerTick, 90);
    state.playing = true;
    paintTransport();
    setStatus("looping " + ERAS[eraIndex()].name.toLowerCase() + " · c. " + Math.round(state.year));
  }

  function stopLoop() {
    state.playing = false;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    if (crackleSrc) { try { crackleSrc.stop(); } catch (e) {} crackleSrc = null; }
    paintTransport();
    setStatus("stopped · drag the ring");
  }

  function paintTransport() {
    btnPlay.textContent = state.playing ? "STOP" : "PLAY";
    centerGlyph.textContent = state.playing ? "❚❚" : "▶";
    centerBtn.classList.toggle("live", state.playing);
    centerBtn.setAttribute("aria-label", state.playing ? "Pause the loop" : "Play the loop");
  }

  function setStatus(s) { if (statusEl) statusEl.textContent = s; }

  /* level meter */
  setInterval(function () {
    if (!meterFill) return;
    if (!ctx || !state.playing) { meterFill.style.width = "0%"; return; }
    analyser.getByteTimeDomainData(analyserData);
    var peak = 0;
    for (var i = 0; i < analyserData.length; i += 4) {
      var v = Math.abs(analyserData[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    meterFill.style.width = Math.min(100, Math.round(peak * 260)) + "%";
  }, 120);

  /* ---------- export 30s WAV ---------- */
  function encodeWAV(ctx2, buffer) {
    var nCh = 2, sr = ctx2.sampleRate, n = buffer.length;
    var bytes = 44 + n * nCh * 2;
    var ab = new ArrayBuffer(bytes), v = new DataView(ab);
    function wstr(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    wstr(0, "RIFF"); v.setUint32(4, bytes - 8, true); wstr(8, "WAVE");
    wstr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, nCh, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * nCh * 2, true); v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
    wstr(36, "data"); v.setUint32(40, n * nCh * 2, true);
    var ch0 = buffer.getChannelData(0), ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
    var o = 44;
    for (var i = 0; i < n; i++) {
      var a = Math.max(-1, Math.min(1, ch0[i])), b = Math.max(-1, Math.min(1, ch1[i]));
      v.setInt16(o, a * 32767, true); v.setInt16(o + 2, b * 32767, true); o += 4;
    }
    return new Blob([ab], { type: "audio/wav" });
  }

  function renderOffline(OC, dest) {
    var dur = 30, p = blendParams(), spb = 60 / p.bpm, stepDur = spb / 4;
    var nSteps = Math.floor(dur / stepDur);
    var gC = OC.createGain(); gC.gain.value = state.layers.chime ? 0.9 : 0;
    var gT = OC.createGain(); gT.gain.value = state.layers.tick ? 0.5 : 0;
    var gW = OC.createGain(); gW.gain.value = state.layers.wash ? 0.35 : 0;
    var m = OC.createGain(); m.gain.value = state.vol;
    gC.connect(m); gT.connect(m); gW.connect(m); m.connect(dest);
    var nb = OC.createBuffer(1, OC.sampleRate * 2, OC.sampleRate);
    var dd = nb.getChannelData(0);
    var seed = 22222;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; }
    for (var i = 0; i < dd.length; i++) dd[i] = rnd();
    function opluck(dst, fr, t, vel, du, ty) {
      var o = OC.createOscillator(), g = OC.createGain();
      o.type = ty; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + du);
      o.connect(g); g.connect(dst); o.start(t); o.stop(t + du + 0.05);
    }
    function oclick(dst, t, vel) {
      var s = OC.createBufferSource(); s.buffer = nb;
      var f = OC.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 3200;
      var g = OC.createGain();
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      s.connect(f); f.connect(g); g.connect(dst); s.start(t, rnd() + 1); s.stop(t + 0.08);
    }
    function opad(dst, midis, t, du, vel) {
      for (var k = 0; k < midis.length; k++) {
        var o = OC.createOscillator(), g = OC.createGain();
        o.type = "sine"; o.frequency.value = mf(midis[k]);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vel, t + du * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + du);
        o.connect(g); g.connect(dst); o.start(t); o.stop(t + du + 0.05);
      }
    }
    function ovoice(era, w, s, t) {
      if (w <= 0.02) return;
      var deg = era.pat[s % 16];
      if (deg >= 0 && state.layers.chime) {
        var midi = era.root + 12 + era.scale[deg % era.scale.length];
        opluck(gC, mf(midi), t, 0.32 * w + 0.04, 1.4, era.wave);
      }
      if (state.layers.tick && s % era.tickEvery === 0) oclick(gT, t, 0.5 * w + 0.03);
    }
    for (var s = 0; s < nSteps; s++) {
      var t = 0.1 + s * stepDur;
      if (t > dur - 0.2) break;
      ovoice(p.a, p.wa, s, t);
      ovoice(p.b, p.wb, s, t);
      if (s % 32 === 0 && state.layers.wash) {
        opad(gW, p.a.wash, t, spb * 8, 0.2 * p.wa + 0.01);
        opad(gW, p.b.wash, t, spb * 8, 0.2 * p.wb + 0.01);
      }
    }
    if (p.crackle > 0.02) { // era hiss bed for 1900s blends
      var cs = OC.createBufferSource(); cs.buffer = nb; cs.loop = true;
      var cf = OC.createBiquadFilter(); cf.type = "bandpass"; cf.frequency.value = 4200;
      var cg = OC.createGain(); cg.gain.value = p.crackle * 0.12;
      cs.connect(cf); cf.connect(cg); cg.connect(m); cs.start(0); cs.stop(dur);
    }
  }

  function doExport() {
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) { setStatus("offline render not supported here"); return; }
    btnExport.disabled = true;
    btnExport.textContent = "RENDERING…";
    setStatus("rendering 30s of c. " + Math.round(state.year) + "…");
    try {
      var sr = 44100, off = new OC(2, sr * 30, sr);
      renderOffline(off, off.destination);
      off.startRendering().then(function (buf) {
        var blob = encodeWAV(off, buf);
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "century-echo-" + Math.round(state.year) + ".wav";
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        btnExport.disabled = false;
        btnExport.textContent = "EXPORT 30S LOOP";
        setStatus("exported 30s wav · c. " + Math.round(state.year));
      }).catch(function () {
        btnExport.disabled = false;
        btnExport.textContent = "EXPORT 30S LOOP";
        setStatus("render failed — try again");
      });
    } catch (e) {
      btnExport.disabled = false;
      btnExport.textContent = "EXPORT 30S LOOP";
      setStatus("render failed — try again");
    }
  }

  /* ---------- easter egg: 1776 ---------- */
  var spinAccum = 0, spinWindowT = 0, centerClicks = [];
  function triggerEgg() {
    state.eggFound = true; save();
    if (eggDot) eggDot.hidden = false;
    if (egg) egg.hidden = false;
    document.body.classList.add("egg");
    bellToll();
    try { if (eggClose) eggClose.focus(); } catch (e) {}
  }
  function dismissEgg() {
    if (egg) egg.hidden = true;
    document.body.classList.remove("egg");
  }
  function noteSpin(delta) {
    var now = Date.now();
    if (now - spinWindowT > 4000) { spinAccum = 0; spinWindowT = now; }
    if (delta > 0) spinAccum += delta; else spinAccum = Math.max(0, spinAccum + delta);
    if (spinAccum >= 360 * 3) { spinAccum = 0; triggerEgg(); }
  }
  function bellToll() {
    if (!ensureAudio()) return;
    var t0 = ctx.currentTime + 0.05;
    var base = mf(41); // F2-ish, cracked-bell territory
    for (var n = 0; n < 3; n++) {
      var t = t0 + n * 1.6;
      [1, 2.02, 2.74, 3.76].forEach(function (mult, k) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = base * mult * (k === 1 ? 1.003 : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3 / (k + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.6);
      });
    }
  }

  /* ---------- input: drag / wheel / keys ---------- */
  function angleOf(ev) {
    var r = dial.getBoundingClientRect();
    var x = ev.clientX - (r.left + r.width / 2), y = ev.clientY - (r.top + r.height / 2);
    return Math.atan2(x, -y) * 180 / Math.PI; // 0 = top, clockwise positive
  }
  var dragging = false, lastAng = 0;
  if (dial) {
    dial.addEventListener("pointerdown", function (ev) {
      if (ev.target === centerBtn || centerBtn.contains(ev.target)) return;
      dragging = true; lastAng = angleOf(ev);
      try { dial.setPointerCapture(ev.pointerId); } catch (e) {}
      dial.focus();
    });
    dial.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var a = angleOf(ev), d = a - lastAng;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      lastAng = a;
      state.year = Math.min(MAX, Math.max(MIN, state.year + (d / 360) * SPAN));
      noteSpin(d);
      render(); save();
      if (state.playing) setStatus("looping " + ERAS[eraIndex()].name.toLowerCase() + " · c. " + Math.round(state.year));
    });
    function endDrag() { dragging = false; }
    dial.addEventListener("pointerup", endDrag);
    dial.addEventListener("pointercancel", endDrag);
    dial.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      state.year = Math.min(MAX, Math.max(MIN, state.year - Math.sign(ev.deltaY) * 3));
      render(); save();
    }, { passive: false });
    dial.addEventListener("keydown", function (ev) {
      var handled = true;
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") state.year -= ev.shiftKey ? 10 : 1;
      else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") state.year += ev.shiftKey ? 10 : 1;
      else if (ev.key === "Home") state.year = MIN;
      else if (ev.key === "End") state.year = MAX;
      else handled = false;
      if (handled) {
        ev.preventDefault();
        state.year = Math.min(MAX, Math.max(MIN, state.year));
        render(); save();
      }
    });
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.code === "Space" && !/INPUT|TEXTAREA/.test((ev.target && ev.target.tagName) || "")) {
      ev.preventDefault();
      togglePlay();
    }
  });

  function togglePlay() {
    if (state.playing) stopLoop(); else startLoop();
  }

  function wireToggle(btn, key, bus) {
    btn.addEventListener("click", function () {
      state.layers[key] = !state.layers[key];
      btn.classList.toggle("on", state.layers[key]);
      btn.setAttribute("aria-pressed", String(state.layers[key]));
      if (ctx && bus) bus.gain.setTargetAtTime(state.layers[key] ? (key === "tick" ? 0.5 : key === "wash" ? 0.35 : 0.9) : 0.0, ctx.currentTime, 0.1);
      save();
    });
  }

  if (centerBtn) centerBtn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    var now = Date.now();
    centerClicks.push(now);
    centerClicks = centerClicks.filter(function (t) { return now - t < 700; });
    if (centerClicks.length >= 3) { centerClicks = []; triggerEgg(); return; }
    togglePlay();
  });
  if (btnPlay) btnPlay.addEventListener("click", togglePlay);
  if (btnExport) btnExport.addEventListener("click", doExport);
  if (eggClose) eggClose.addEventListener("click", dismissEgg);
  if (egg) egg.addEventListener("click", function (ev) { if (ev.target === egg) dismissEgg(); });
  if (volEl) volEl.addEventListener("input", function () {
    state.vol = volEl.value / 100;
    if (ctx && master) master.gain.setTargetAtTime(state.vol, ctx.currentTime, 0.05);
    save();
  });
  wireToggle(btnChime, "chime", null);
  wireToggle(btnTick, "tick", null);
  wireToggle(btnWash, "wash", null);
  // buses exist only after first ensureAudio; sync gains lazily in toggle via ctx check:
  // (re-wire with live buses once audio starts)
  var origToggle = togglePlay;

  /* ---------- init ---------- */
  load();
  buildTicks();
  btnChime.classList.toggle("on", state.layers.chime);
  btnTick.classList.toggle("on", state.layers.tick);
  btnWash.classList.toggle("on", state.layers.wash);
  btnChime.setAttribute("aria-pressed", String(state.layers.chime));
  btnTick.setAttribute("aria-pressed", String(state.layers.tick));
  btnWash.setAttribute("aria-pressed", String(state.layers.wash));
  volEl.value = Math.round(state.vol * 100);
  if (state.eggFound && eggDot) eggDot.hidden = false;
  shownEra = -1;
  // paint first era synchronously (skip fade on load)
  var e0 = ERAS[eraIndex()];
  eraName.textContent = e0.name; eraLabel.textContent = e0.tag + " · C."; eraSub.textContent = e0.sub;
  shownEra = eraIndex();
  render();
  paintTransport();
  // keep live bus gains in sync for toggles pressed before/after audio init
  setInterval(function () {
    if (!ctx) return;
    if (busChime) busChime.gain.setTargetAtTime(state.layers.chime ? 0.9 : 0, ctx.currentTime, 0.1);
    if (busTick) busTick.gain.setTargetAtTime(state.layers.tick ? 0.5 : 0, ctx.currentTime, 0.1);
    if (busWash) busWash.gain.setTargetAtTime(state.layers.wash ? 0.35 : 0, ctx.currentTime, 0.1);
  }, 500);
  console.log("century-echo-dial ready");
})();
