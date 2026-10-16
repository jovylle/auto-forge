// Plover Ash Press — generative retro-wave letterpress.
// Features: ash press · plover poems · print export. Constraint: easter egg(s).
// Works from file:// — no network calls except optional Google Fonts CSS.

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const LEX = {
  shore: ["tideline", "shingle", "dune-grass", "salt-flat", "wrack-line", "lagoon", "sandbar", "oyster-shell", "driftwood", "pebble-choir"],
  ash: ["grey snow", "soft cinder", "pumice-breath", "crater-sugar", "ember-flour", "night pollen", "basalt lace", "smoke-seed"],
  sea: ["the undertow hums", "the surf counts backwards", "a wave folds its letter", "the tide keeps the receipt", "foam signs in triplicate", "the breaker clears its throat"],
  birds: ["three prints, then flight", "a beak like a comma", "quick feet stitch the sand", "the flock is a held breath", "wings like torn envelopes", "one plover keeps the watch"],
  volcano: ["the mountain exhales", "cinder remembers fire", "the crater keeps a diary", "lava writes, then crosses out", "the volcano dreams in red"],
  neon: ["chrome", "neon", "velvet static", "cassette moon", "laser gull", "midnight arcade", "violet highway"],
};

const BIRDS = {
  piping:  { name: "Piping Plover",  glyph: "ᕙ(˵•̀ᴗ•́˵)ᕗ", tone: "wistful", form: [2, 2], bias: ["shore", "sea", "birds"] },
  snowy:   { name: "Snowy Plover",   glyph: "(•̀ᴗ•́)و",     tone: "spare",   form: [3, 3], bias: ["ash", "shore", "sea"] },
  kentish: { name: "Kentish Plover", glyph: "‹(•ᴗ•)›",     tone: "rust-red",form: [4, 2], bias: ["volcano", "ash", "shore"] },
  wilson:  { name: "Wilson's Plover",glyph: "ᕦ(ò_ó)ᕤ",     tone: "brash",   form: [4, 4], bias: ["neon", "volcano", "birds"] },
  ghost:   { name: "Ghost Plover",   glyph: "⋆(◉_◉)⋆",     tone: "phosphor",form: [3, 3], bias: ["neon", "ash", "sea"] },
};

const MOODS = {
  dusk:     { label: "dusk low-tide",     openers: ["At dusk the press runs violet,", "Low tide leaves the page half-bare —", "The sun files its edges down,"] },
  storm:    { label: "storm surge",        openers: ["The storm sets type in thunder,", "Ink black as the breaker’s throat,", "Wind edits every line aloud —"] },
  dawn:     { label: "dawn glass",        openers: ["Dawn rinses the ash pink,", "First light proofs the shoreline,", "Morning lifts a clean sheet —"] },
  midnight: { label: "midnight crater",    openers: ["At midnight the crater glows,", "The grid hums under black water,", "Static blooms on the horizon —"] },
};

const TITLES = ["Tideline Elegy", "Cinder Sonnet for Small Feet", "Proof of the Ninth Wave", "Ashfall Pastoral",
  "The Compositor's Migration", "Platen Song in Grey", "Galley of Gulls", "Impression at Low Water",
  "What the Crater Kept", "Small Press Against the Sea", "Errata for the Undertow", "A Colophon of Cinders"];

const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
function pickLex(key) { const l = LEX[key]; return pick(l); }

function makeLine(birdKey, moodKey, ghost) {
  const b = BIRDS[birdKey];
  const bag = ghost ? ["neon", "ash", "volcano", "sea"] : b.bias;
  const k = pick(bag);
  const n = Math.random();
  if (k === "sea" || n < 0.22) return pick(LEX.sea) + (Math.random() < 0.4 ? "," : Math.random() < 0.5 ? "." : " —");
  if (k === "birds" || n < 0.4) return Math.random() < 0.5 ? pick(LEX.birds) + "." : `the plover ${pick(["proofs", "pecks", "prints", "presses"])} ${pickLex("shore")} ${pick(["softly", "twice", "in grey", "till dawn"])}.`;
  if (k === "volcano") return pick(LEX.volcano) + pick([",", ".", " —", " again."]);
  if (k === "neon") return `a ${pickLex("neon")} ${pick(["gull", "tide", "plover", "moon", "breaker"])} ${pick(["flickers", "signs its name", "keeps time", "won't fade"])} ${pick(["in ash.", "till dawn.", "over the grid.", "in violet."])}`;
  return `${pick(["beneath", "between", "above", "among"])} ${pickLex("shore")} and ${pickLex("ash")}${pick([",", ".", " —", ""])}`;
}

function composePoem({ bird, mood, stanzas, ghost }) {
  const lines = [];
  const m = MOODS[mood];
  lines.push({ t: pick(m.openers), stanza: 0 });
  const form = ghost ? [3, 3] : BIRDS[bird].form;
  for (let s = 0; s < stanzas; s++) {
    const n = form[s % form.length] || 3;
    for (let i = 0; i < n; i++) {
      let line = makeLine(bird, mood, ghost);
      if (s === stanzas - 1 && i === n - 1 && Math.random() < 0.7)
        line = pick(["and the ash keeps what we meant.", "and the sea returns the proof.", "— pull another, the tide is waiting.",
          "signed, in triplicate, by small feet.", "and the crater approves in red."]);
      lines.push({ t: line, stanza: s });
    }
  }
  const title = ghost ? pick(["Ghost Impression Nº 13", "The Phosphor Proof", "Errata from the Undertow", "Midnight Colophon"]) : pick(TITLES);
  return { title, lines };
}

// ---------- state ----------
const store = {
  get edition() { return Number(localStorage.getItem("pap-edition") || 1); },
  set edition(n) { localStorage.setItem("pap-edition", String(n)); },
  get kept() { try { return JSON.parse(localStorage.getItem("pap-kept") || "[]"); } catch { return []; } },
  set kept(v) { localStorage.setItem("pap-kept", JSON.stringify(v.slice(0, 24))); },
};
let current = { bird: "piping", mood: "dusk", stanzas: 3, poem: null, ghost: false };
let printing = false;

// ---------- ash sky canvas ----------
const sky = $("#sky-ash"), sctx = sky.getContext("2d");
let motes = [];
function skySize() {
  sky.width = innerWidth; sky.height = innerHeight;
  const n = Math.min(160, Math.floor(innerWidth / 9));
  motes = Array.from({ length: n }, () => ({
    x: Math.random() * sky.width, y: Math.random() * sky.height,
    r: 0.6 + Math.random() * 2.2, vy: 0.15 + Math.random() * 0.7,
    vx: -0.3 + Math.random() * 0.6, tw: Math.random() * Math.PI * 2,
    c: Math.random() < 0.75 ? "190,180,200" : Math.random() < 0.5 ? "255,120,180" : "120,240,255",
  }));
}
let ashLevel = 0.6;
function skyTick() {
  sctx.clearRect(0, 0, sky.width, sky.height);
  for (const m of motes) {
    m.tw += 0.03; m.y += m.vy * (0.4 + ashLevel); m.x += m.vx + Math.sin(m.tw) * 0.2;
    if (m.y > sky.height + 4) { m.y = -4; m.x = Math.random() * sky.width; }
    const a = (0.12 + ashLevel * 0.5) * (0.6 + 0.4 * Math.sin(m.tw));
    sctx.beginPath(); sctx.arc(m.x, m.y, m.r, 0, 7);
    sctx.fillStyle = `rgba(${m.c},${a.toFixed(3)})`; sctx.fill();
  }
  requestAnimationFrame(skyTick);
}
addEventListener("resize", skySize);

// ---------- grain on the sheet ----------
function dustSheet(pct) {
  const g = $("#grain");
  g.innerHTML = "";
  const c = document.createElement("canvas");
  const sheet = $("#sheet");
  c.width = Math.max(300, sheet.clientWidth); c.height = Math.max(300, sheet.clientHeight);
  const x = c.getContext("2d");
  const n = Math.floor((pct / 100) * 2600);
  for (let i = 0; i < n; i++) {
    const v = 90 + Math.random() * 120;
    x.fillStyle = `rgba(${v|0},${(v*0.92)|0},${(v*0.85)|0},${(Math.random() * 0.35).toFixed(2)})`;
    x.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  c.style.width = "100%"; c.style.height = "100%";
  g.appendChild(c);
}

// ---------- audio (tiny synth, no assets) ----------
let AC = null;
function blipOk() { return $("#sound").checked; }
function tone(freq, dur, type = "sine", gain = 0.12, when = 0) {
  if (!blipOk()) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + when;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio unavailable — fine */ }
}
const clunk = () => { tone(90, 0.28, "square", 0.14); tone(55, 0.4, "sine", 0.2, 0.02); tone(1200, 0.06, "triangle", 0.05, 0.05); };
const surf = () => { tone(320, 0.5, "sine", 0.03, 0.1); tone(480, 0.6, "sine", 0.025, 0.3); };
const ghostChime = () => [660, 830, 990, 1320].forEach((f, i) => tone(f, 0.5, "sine", 0.07, i * 0.12));

// ---------- press sequence ----------
function renderPoem(poem, byline) {
  $("#poem-title").textContent = poem.title;
  $("#poem-byline").textContent = byline;
  const body = $("#poem-body");
  body.innerHTML = "";
  body.classList.remove("reveal");
  const stanzas = [...new Set(poem.lines.map((l) => l.stanza))].sort((a, b) => a - b);
  for (const s of stanzas) {
    const d = document.createElement("div");
    d.className = "stanza";
    poem.lines.filter((l) => l.stanza === s).forEach((l) => {
      const sp = document.createElement("span");
      sp.className = "ln"; sp.textContent = l.t;
      d.appendChild(sp);
    });
    body.appendChild(d);
  }
  requestAnimationFrame(() => body.classList.add("reveal"));
  [...body.querySelectorAll(".ln")].forEach((el, i) => (el.style.animationDelay = `${i * 0.18}s`));
}

function walkPlover(durationMs, done) {
  const w = $("#walker"), beach = $(".beachline");
  $(".beachline").parentElement.classList.add("walking");
  const glyph = BIRDS[current.ghost ? "ghost" : current.bird].glyph;
  $("#walker-glyph").textContent = glyph;
  const max = Math.max(40, beach.clientWidth - 90);
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / durationMs);
    w.style.left = `${8 + k * max}px`;
    if (k < 1) requestAnimationFrame(step);
    else { $(".beachline").parentElement.classList.remove("walking"); done && done(); }
  })(t0);
}

function pullLever() {
  if (printing) return;
  printing = true;
  document.body.classList.add("pressing");
  $("#press-state").textContent = "PRINTING";
  $("#platen").classList.add("slam");
  clunk();
  const burst = () => { ashLevel = Math.min(1.4, ashLevel + 0.5); setTimeout(() => (ashLevel = Number($("#ashfall").value) / 100), 900); };
  setTimeout(burst, 120);

  const ed = store.edition;
  const bird = current.ghost ? "ghost" : current.bird;
  const byline = `set by the ${BIRDS[bird].name} · ${MOODS[current.mood].label}${current.ghost ? " · GHOST EDITION" : ""}`;
  const poem = composePoem({ bird, mood: current.mood, stanzas: current.stanzas, ghost: current.ghost });
  current.poem = poem;

  const lineCount = poem.lines.length;
  walkPlover(Math.max(900, lineCount * 260), () => {});
  $("#status").textContent = `Printing… the ${BIRDS[bird].name} is pecking line by line.`;

  setTimeout(() => {
    renderPoem(poem, byline);
    $("#edition-tag").textContent = `EDITION Nº ${String(ed).padStart(3, "0")}`;
    $("#sheet-no").textContent = `Nº ${String(ed).padStart(3, "0")}`;
    $("#sheet-date").textContent = new Date().toLocaleString();
    $("#sheet-ash").textContent = `ash ${$("#ashfall").value}% · ${BIRDS[bird].name.toLowerCase()}`;
    $("#sheet-press").textContent = current.ghost ? "👻 GHOST PRESS" : "PLOVER ASH PRESS";
    if ($("#ash-dust").checked) dustSheet(Number($("#ashfall").value));
    else $("#grain").innerHTML = "";
    $("#tide-no").textContent = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
    surf();
    $("#status").textContent = current.ghost
      ? "⋆ A ghost impression! The phosphor plover bows and vanishes. ⋆"
      : "Fresh off the platen. Keep it, or export it below.";
    store.edition = ed + 1;
    $("#press-state").textContent = "READY";
    $("#platen").classList.remove("slam");
    document.body.classList.remove("pressing");
    printing = false;
  }, Math.max(1000, lineCount * 260 + 350));
}

// ---------- export ----------
function poemText() {
  if (!current.poem) return "";
  const stanzas = [...new Set(current.poem.lines.map((l) => l.stanza))].sort((a, b) => a - b);
  return [`${current.poem.title}`, `${$("#poem-byline").textContent}`, "",
    ...stanzas.map((s) => current.poem.lines.filter((l) => l.stanza === s).map((l) => l.t).join("\n")).flatMap((s) => [s, ""]),
    `— ${$("#sheet-no").textContent}, ${$("#sheet-date").textContent}`].join("\n");
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportPNG() {
  if (!current.poem) { $("#status").textContent = "Print something first — the poster needs ink."; return; }
  const W = 1080, H = 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0d0621"); sky.addColorStop(0.45, "#2b0f54");
  sky.addColorStop(0.62, "#ff2e88"); sky.addColorStop(0.75, "#ff9a3d"); sky.addColorStop(1, "#12041f");
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  // sun
  x.save(); x.beginPath(); x.arc(W / 2, 640, 220, 0, 7); x.clip();
  const sg = x.createLinearGradient(0, 420, 0, 860);
  sg.addColorStop(0, "#ffe45e"); sg.addColorStop(0.5, "#ff9a3d"); sg.addColorStop(1, "#ff2e88");
  x.fillStyle = sg; x.fillRect(0, 420, W, 440);
  x.fillStyle = "rgba(20,8,40,.85)";
  for (let i = 0; i < 7; i++) x.fillRect(0, 560 + i * 28, W, 6 + i * 2.4);
  x.restore();
  // grid floor
  x.strokeStyle = "rgba(41,243,255,.5)"; x.lineWidth = 2;
  for (let i = 0; i <= 12; i++) { x.beginPath(); x.moveTo(W / 2 + (i - 6) * 40, 880); x.lineTo(W / 2 + (i - 6) * 220, H); x.stroke(); }
  for (let i = 0; i < 8; i++) { const y = 880 + (i * i * 7); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  // paper card
  x.fillStyle = current.ghost ? "#1e1745" : "#f6ecda";
  roundRect(x, 90, 120, W - 180, H - 240, 18); x.fill();
  x.fillStyle = current.ghost ? "#b18cff" : "#2b2135";
  x.textAlign = "center";
  x.font = "700 34px sans-serif";
  x.fillText(current.ghost ? "👻 GHOST PRESS" : "PLOVER ASH PRESS", W / 2, 200);
  x.font = "600 64px Georgia, serif";
  wrap(x, current.poem.title, W / 2, 290, W - 320, 72);
  x.font = "italic 30px Georgia, serif";
  x.fillStyle = current.ghost ? "#9d8bd0" : "#6b5a44";
  x.fillText($("#poem-byline").textContent.slice(0, 64), W / 2, 400);
  x.font = "32px Georgia, serif";
  x.fillStyle = current.ghost ? "#e8ddff" : "#2b2135";
  let y = 470;
  for (const { t, stanza } of current.poem.lines.slice(0, 26)) { if (y > H - 220) break; x.fillText(t.slice(0, 52), W / 2, y); y += 44; }
  x.font = "24px monospace";
  x.fillText(`${$("#sheet-no").textContent} · plover ash press`, W / 2, H - 160);
  const a = document.createElement("a");
  a.download = `plover-ash-${$("#sheet-no").textContent.replace(/\W+/g, "")}.png`;
  a.href = c.toDataURL("image/png"); a.click();
  $("#status").textContent = "Poster rendered — check your downloads.";
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); }
function wrap(x, text, cx, y, max, lh) {
  const words = text.split(" "); let line = "", yy = y;
  for (const w of words) {
    if (x.measureText(line + " " + w).width > max) { x.fillText(line, cx, yy); line = w; yy += lh; }
    else line = line ? line + " " + w : w;
  }
  x.fillText(line, cx, yy);
}

// ---------- drying line ----------
function renderShelf() {
  const kept = store.kept;
  $("#kept-count").textContent = `${kept.length} kept`;
  const ul = $("#shelf"); ul.innerHTML = "";
  if (!kept.length) { ul.innerHTML = `<li class="empty">Nothing pinned yet — print something worth keeping.</li>`; return; }
  kept.forEach((k, i) => {
    const li = document.createElement("li");
    const txt = document.createElement("div");
    txt.innerHTML = `<span class="t"></span><span class="m"></span>`;
    txt.querySelector(".t").textContent = k.title;
    txt.querySelector(".m").textContent = `${k.no} · ${k.bird} · ${k.date}`;
    const btns = document.createElement("div");
    const re = document.createElement("button"); re.textContent = "reprint";
    re.onclick = () => {
      current.poem = k.poem; current.ghost = !!k.ghost;
      document.body.classList.toggle("ghost", current.ghost);
      renderPoem(k.poem, k.byline);
      $("#sheet-no").textContent = k.no; $("#sheet-date").textContent = k.date;
      $("#edition-tag").textContent = `EDITION ${k.no} (REPRINT)`;
      $("#status").textContent = "Reprint hung back on the press.";
      scrollTo({ top: 0, behavior: "smooth" });
    };
    const del = document.createElement("button"); del.textContent = "✕";
    del.setAttribute("aria-label", "Remove kept print");
    del.onclick = () => { const v = store.kept; v.splice(i, 1); store.kept = v; renderShelf(); };
    btns.append(re, del); li.append(txt, btns); ul.appendChild(li);
  });
}

// ---------- easter egg: the ghost edition ----------
// Three ways in: Konami code, typing "ash", or tapping the sun 5 times.
let ghostOn = false;
function setGhost(on) {
  ghostOn = on; current.ghost = on;
  document.body.classList.toggle("ghost", on);
  if (on) {
    ghostChime();
    $("#press-state").textContent = "HAUNTED";
    $("#status").textContent = "⋆ The Ghost Plover takes the composing stick… pull the lever. ⋆";
    console.log("%c⋆ the ghost plover nods at you ⋆", "color:#b18cff;font-size:16px");
  } else {
    $("#press-state").textContent = "READY";
    $("#status").textContent = "The ghost folds back into the ash. Press is ready.";
  }
}
(function eggs() {
  const seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let ki = 0, typed = "";
  addEventListener("keydown", (e) => {
    if (e.key === seq[ki]) { ki++; if (ki === seq.length) { ki = 0; setGhost(!ghostOn); pullLever(); } }
    else ki = e.key === seq[0] ? 1 : 0;
    if (/^[a-z]$/i.test(e.key)) {
      typed = (typed + e.key.toLowerCase()).slice(-3);
      if (typed === "ash") { setGhost(!ghostOn); typed = ""; }
    }
    if (e.code === "Space" && !/INPUT|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); pullLever(); }
    if (e.key === "r" || e.key === "R") { if (!/INPUT|SELECT/.test(document.activeElement.tagName)) pullLever(); }
  });
  let taps = 0, timer = null;
  $("#sun-btn").addEventListener("click", () => {
    taps++; clearTimeout(timer); timer = setTimeout(() => (taps = 0), 1600);
    tone(500 + taps * 90, 0.15, "triangle", 0.08);
    if (taps >= 5) { taps = 0; setGhost(!ghostOn); }
  });
})();

// ---------- wire up ----------
$$(".bird").forEach((b) => b.addEventListener("click", () => {
  $$(".bird").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
  b.classList.add("on"); b.setAttribute("aria-checked", "true");
  current.bird = b.dataset.bird;
  $("#walker-glyph").textContent = BIRDS[current.bird].glyph;
  tone(700, 0.08, "square", 0.05);
  $("#status").textContent = `The ${BIRDS[current.bird].name} takes the composing stick (${BIRDS[current.bird].tone}).`;
}));
$("#mood").addEventListener("change", (e) => { current.mood = e.target.value; });
$("#stanzas").addEventListener("input", (e) => { current.stanzas = Number(e.target.value); $("#stanza-val").textContent = e.target.value; });
$("#ashfall").addEventListener("input", (e) => {
  $("#ash-val").textContent = `${e.target.value}%`;
  ashLevel = Number(e.target.value) / 100;
  if ($("#ash-dust").checked && current.poem) dustSheet(Number(e.target.value));
});
$("#compose").addEventListener("click", pullLever);
$("#pull").addEventListener("click", pullLever);
$("#keep").addEventListener("click", () => {
  if (!current.poem) { $("#status").textContent = "Nothing to keep yet — pull the lever first."; return; }
  const kept = store.kept;
  kept.unshift({ title: current.poem.title, no: $("#sheet-no").textContent, bird: (current.ghost ? "Ghost" : BIRDS[current.bird].name), date: $("#sheet-date").textContent, byline: $("#poem-byline").textContent, poem: current.poem, ghost: current.ghost });
  store.kept = kept; renderShelf();
  $("#status").textContent = "Pinned to the drying line. ♡";
  tone(880, 0.12, "sine", 0.08);
});
$("#clear-kept").addEventListener("click", () => { store.kept = []; renderShelf(); });
$("#print").addEventListener("click", () => {
  if (!current.poem) { $("#status").textContent = "Print something first — the broadside needs ink."; return; }
  $("#pz-title").textContent = current.poem.title;
  $("#pz-by").textContent = `${$("#poem-byline").textContent} · ${$("#sheet-no").textContent} · ${$("#sheet-date").textContent}`;
  $("#pz-body").innerHTML = "";
  const stanzas = [...new Set(current.poem.lines.map((l) => l.stanza))].sort((a, b) => a - b);
  for (const s of stanzas) {
    const p = document.createElement("p");
    p.textContent = current.poem.lines.filter((l) => l.stanza === s).map((l) => l.t).join("\n");
    p.style.whiteSpace = "pre-line"; p.style.margin = "0 0 1em";
    $("#pz-body").appendChild(p);
  }
  $("#pz-foot").textContent = "Set in ash by the Plover Ash Press · plover-ash-press";
  print();
});
$("#dl-txt").addEventListener("click", () => {
  if (!current.poem) { $("#status").textContent = "Nothing to save yet — pull the lever first."; return; }
  download(`plover-ash-${$("#sheet-no").textContent.replace(/\W+/g, "")}.txt`, poemText(), "text/plain");
});
$("#dl-png").addEventListener("click", exportPNG);
$("#copy-link").addEventListener("click", async () => {
  if (!current.poem) { $("#status").textContent = "Nothing to copy yet."; return; }
  try { await navigator.clipboard.writeText(poemText()); $("#status").textContent = "Poem copied — paste it anywhere."; }
  catch { $("#status").textContent = "Clipboard blocked — use the .txt download instead."; }
});

// ---------- init ----------
console.log("%cPLOVER ASH PRESS%c — psst: konami, “ash”, or sun ×5 👀",
  "background:#ff2e88;color:#fff;padding:2px 8px;border-radius:4px", "color:#29f3ff");
skySize(); skyTick();
ashLevel = Number($("#ashfall").value) / 100;
$("#sheet-date").textContent = "awaiting first impression";
$("#edition-tag").textContent = `EDITION Nº ${String(store.edition).padStart(3, "0")}`;
renderShelf();
pullLever(); // first impression on load so the sheet is never empty
