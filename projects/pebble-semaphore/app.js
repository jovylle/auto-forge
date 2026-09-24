// Pebble Semaphore — vaporwave flag-signal transmitter
// Keyboard-only operable: every action has a key; all controls are native focusables.
const $ = (s) => document.querySelector(s);

const DIRS = [0, 45, 90, 135, 180, 225, 270, 315]; // U UR R DR D DL L UL from up, clockwise
const DIR_GLYPH = { 0: "↑", 45: "↗", 90: "→", 135: "↘", 180: "↓", 225: "↙", 270: "←", 315: "↖" };
const DIR_NAME = { 0: "U", 45: "UR", 90: "R", 135: "DR", 180: "D", 225: "DL", 270: "L", 315: "UL" };

// [leftDeg, rightDeg] — internally consistent codebook (viewer perspective)
const CODE = {
  A: [180, 225], B: [180, 270], C: [180, 315], D: [180, 0], E: [180, 45], F: [180, 90],
  G: [225, 270], H: [225, 315], I: [225, 0], J: [0, 45], K: [225, 90], L: [225, 135],
  M: [270, 315], N: [270, 0], O: [270, 45], P: [270, 90], Q: [270, 135], R: [270, 180],
  S: [270, 225], T: [315, 0], U: [315, 45], V: [0, 135], W: [45, 135], X: [45, 180],
  Y: [45, 225], Z: [90, 225],
};
const DIGIT_OF = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H", 9: "I", 0: "J" };
const REVERSE = new Map(Object.entries(CODE).map(([ch, [l, r]]) => [`${l},${r}`, ch]));
const REST = [180, 180];

const armL = $("#armL"), armR = $("#armR");
const bigLetter = $("#bigLetter"), codeLabel = $("#codeLabel"), statusEl = $("#status");
const lagoon = $("#lagoon"), msgEl = $("#msg"), countEl = $("#count");
const transcriptEl = $("#transcript"), posLEl = $("#posL"), posREl = $("#posR"), decodeEl = $("#decode");
const chartEl = $("#chart"), footCount = $("#footCount"), speedEl = $("#speed");

const store = {
  load() { try { return JSON.parse(localStorage.getItem("pebble-semaphore") || "{}"); } catch { return {}; } },
  save(d) { try { localStorage.setItem("pebble-semaphore", JSON.stringify(d)); } catch {} },
};

let queue = [];      // [{ch, display}]
let idx = -1;
let timer = null;
let pose = { L: 180, R: 180 }; // manual deck pose (degrees)
let dropped = 0;

function armRotation(side, targetDeg) {
  const base = side === "L" ? 270 : 90; // arms drawn pointing W / E
  return targetDeg - base;
}
function setArms(lDeg, rDeg) {
  armL.setAttribute("transform", `rotate(${armRotation("L", lDeg)} 118 210)`);
  armR.setAttribute("transform", `rotate(${armRotation("R", rDeg)} 182 210)`);
}
function codeText(l, r) { return `L${DIR_GLYPH[l]} R${DIR_GLYPH[r]}`; }

function show(ch, display) {
  const pair = ch === " " ? REST : CODE[ch];
  if (!pair) return;
  const [l, r] = pair;
  setArms(l, r);
  bigLetter.textContent = display || ch;
  codeLabel.textContent = ch === " " ? "REST · L↓ R↓" : `${display || ch} · ${codeText(l, r)}`;
  document.querySelectorAll(".cell").forEach((c) => c.classList.toggle("hot", c.dataset.ch === ch));
}

function parseMsg(text) {
  const out = [];
  for (const raw of text.toUpperCase()) {
    if (raw === " ") out.push({ ch: " ", display: "␣" });
    else if (CODE[raw]) out.push({ ch: raw, display: raw });
    else if (DIGIT_OF[raw] !== undefined) out.push({ ch: DIGIT_OF[raw], display: raw });
  }
  return out;
}

function renderLagoon() {
  lagoon.innerHTML = "";
  queue.forEach((q, i) => {
    const s = document.createElement("span");
    s.className = "pebble" + (i < idx ? " done" : "") + (i === idx ? " now" : "");
    s.textContent = q.display;
    s.title = q.ch === " " ? "rest" : `${q.display} (${codeText(...CODE[q.ch])})`;
    lagoon.appendChild(s);
  });
  if (!queue.length) lagoon.innerHTML = '<span style="color:var(--dim);font-size:13px">Lagoon is calm. No pebbles yet — transmit something.</span>';
}

function transcript() {
  return queue.map((q, i) =>
    q.ch === " " ? `${i + 1}. REST` : `${i + 1}. ${q.display} — ${codeText(...CODE[q.ch])}`
  ).join("\n");
}
function syncTranscript() {
  transcriptEl.value = queue.length ? transcript() : "";
  footCount.textContent = `${dropped} pebble${dropped === 1 ? "" : "s"} dropped`;
}

function announce(t) { statusEl.textContent = t; }

function tempoMs() { return Math.max(220, 1400 - Number(speedEl.value) * 120); }

function stop(w = "Held. Press Transmit or Step to continue.") {
  clearInterval(timer); timer = null;
  $("#btnPlay").textContent = "▶ Transmit ⌃↵";
  announce(w);
}
function advance() {
  if (!queue.length) return;
  idx = Math.min(idx + 1, queue.length - 1);
  const q = queue[idx];
  show(q.ch, q.display);
  dropped++;
  renderLagoon(); syncTranscript();
  announce(q.ch === " " ? `Pebble ${idx + 1}/${queue.length}: rest — arms down.` : `Pebble ${idx + 1}/${queue.length}: ${q.display} — ${codeText(...CODE[q.ch])}.`);
  if (idx >= queue.length - 1) stop(`Signal complete — ${queue.length} pebbles in the lagoon. ✦`);
}
function transmit() {
  queue = parseMsg(msgEl.value);
  if (!queue.length) { announce("Nothing transmittable — type A–Z, 0–9 or spaces first."); msgEl.focus(); return; }
  idx = -1; stop();
  renderLagoon(); syncTranscript();
  $("#btnPlay").textContent = "⏸ Hold ␣";
  timer = setInterval(advance, tempoMs());
  advance();
  store.save({ msg: msgEl.value, speed: speedEl.value });
}

// ---- manual signal deck ----
function renderPose() {
  setArms(pose.L, pose.R);
  posLEl.textContent = DIR_NAME[pose.L];
  posREl.textContent = DIR_NAME[pose.R];
  const hit = REVERSE.get(`${pose.L},${pose.R}`);
  const isRest = pose.L === 180 && pose.R === 180;
  decodeEl.textContent = hit || (isRest ? "REST ␣" : "— (no letter)");
  bigLetter.textContent = hit || (isRest ? "～" : "?");
  codeLabel.textContent = (hit || (isRest ? "REST" : "CUSTOM")) + ` · ${codeText(pose.L, pose.R)}`;
}
function nudge(side, dir) {
  const i = DIRS.indexOf(pose[side]);
  pose[side] = DIRS[(i + dir + DIRS.length) % DIRS.length];
  renderPose();
}
function dropPebble() {
  const hit = REVERSE.get(`${pose.L},${pose.R}`);
  const isRest = pose.L === 180 && pose.R === 180;
  if (!hit && !isRest) { announce(`No letter at ${codeText(pose.L, pose.R)} — adjust the arms.`); return; }
  const q = isRest ? { ch: " ", display: "␣" } : { ch: hit, display: hit };
  queue.push(q); idx = queue.length - 1;
  show(q.ch, q.display); dropped++;
  renderLagoon(); syncTranscript();
  announce(`Dropped pebble ${queue.length}: ${isRest ? "rest" : hit}.`);
}

// ---- share / export ----
async function copyText(t, label) {
  try { await navigator.clipboard.writeText(t); announce(`${label} copied to clipboard. ✦`); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
    announce(`${label} copied to clipboard. ✦`);
  }
}
function shareLink() {
  const url = `${location.origin}${location.pathname}#msg=${encodeURIComponent(msgEl.value)}`;
  copyText(url, "Signal link");
}
function shareCodes() {
  if (!queue.length) transmit();
  copyText(transcript() || "(empty)", "Signal codes");
}
function exportTxt() {
  if (!queue.length) transmit();
  const blob = new Blob([`PEBBLE SEMAPHORE — signal transcript\n${"=".repeat(38)}\n${transcript()}\n`], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "pebble-semaphore.txt"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  announce("Transcript downloaded as .txt. ✦");
}
function exportPng() {
  const svg = document.getElementById("figure");
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 640;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, "#1a0b2e"); grad.addColorStop(1, "#0d0221");
    g.fillStyle = grad; g.fillRect(0, 0, 640, 640);
    g.drawImage(img, 70, 60, 500, 500);
    g.fillStyle = "#fffb96"; g.font = "bold 34px sans-serif"; g.textAlign = "center";
    g.fillText($("#bigLetter").textContent + "  ·  " + $("#codeLabel").textContent, 320, 600);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png"); a.download = "pebble-semaphore.png"; a.click();
    announce("Figure exported as PNG. ✦");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

// ---- chart ----
function buildChart() {
  chartEl.innerHTML = "";
  for (const ch of Object.keys(CODE)) {
    const [l, r] = CODE[ch];
    const d = document.createElement("div");
    d.className = "cell"; d.dataset.ch = ch; d.setAttribute("role", "listitem");
    d.tabIndex = 0;
    d.title = `${ch}: left ${DIR_NAME[l]}, right ${DIR_NAME[r]}`;
    d.innerHTML = `<b>${ch}</b><span>L${DIR_GLYPH[l]} R${DIR_GLYPH[r]}</span>`;
    d.addEventListener("focus", () => show(ch, ch));
    d.addEventListener("mouseenter", () => show(ch, ch));
    chartEl.appendChild(d);
  }
}

// ---- events ----
$("#btnPlay").addEventListener("click", () => (timer ? stop() : transmit()));
$("#btnStep").addEventListener("click", () => { stop("Stepped. Press → again or Transmit."); if (!queue.length) queue = parseMsg(msgEl.value); advance(); });
$("#btnPause").addEventListener("click", () => (timer ? stop() : (queue.length && idx < queue.length - 1 ? transmit() : announce("Nothing to hold."))));
$("#btnReset").addEventListener("click", () => { stop("Lagoon cleared. Fresh water."); queue = []; idx = -1; renderLagoon(); syncTranscript(); renderPose(); });
$("#btnDrop").addEventListener("click", dropPebble);
$("#btnLink").addEventListener("click", shareLink);
$("#btnCodes").addEventListener("click", shareCodes);
$("#btnPng").addEventListener("click", exportPng);
$("#btnTxt").addEventListener("click", exportTxt);
document.querySelectorAll("[data-arm]").forEach((b) =>
  b.addEventListener("click", () => nudge(b.dataset.arm, Number(b.dataset.dir))));
speedEl.addEventListener("change", () => {
  store.save({ msg: msgEl.value, speed: speedEl.value });
  if (timer) { clearInterval(timer); timer = setInterval(advance, tempoMs()); }
});
msgEl.addEventListener("input", () => {
  countEl.textContent = `${msgEl.value.length} / 140`;
  store.save({ msg: msgEl.value, speed: speedEl.value });
});

function typingTarget(e) {
  const t = e.target;
  return t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");
}

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && k === "Enter") { e.preventDefault(); transmit(); return; }
  if (typingTarget(e)) { if (k === "Escape") e.target.blur(); return; }
  if (k === " ") { e.preventDefault(); timer ? stop() : (queue.length ? transmit() : (msgEl.focus(), announce("Focused the scribe — type your message, then Ctrl+Enter."))); }
  else if (k === "ArrowRight") { e.preventDefault(); $("#btnStep").click(); $("#btnStep").focus(); }
  else if (k === "Escape") stop("Held.");
  else if (k === "Backspace" && e.shiftKey) $("#btnReset").click();
  else if (k === "z" || k === "Z") nudge("L", -1);
  else if (k === "x" || k === "X") nudge("L", 1);
  else if (k === "n" || k === "N") nudge("R", -1);
  else if (k === "m" || k === "M") nudge("R", 1);
  else if (k === "Enter") { e.preventDefault(); dropPebble(); }
  else if (k === "1") shareLink();
  else if (k === "2") shareCodes();
  else if (k === "3") exportPng();
  else if (k === "4") exportTxt();
  else if (k === "?") { document.querySelector(".keys").scrollIntoView({ behavior: "smooth", block: "center" }); }
  else if (/^[a-z0-9]$/i.test(k) && k.length === 1) {
    const up = k.toUpperCase();
    if (CODE[up]) show(up, up);
    else if (DIGIT_OF[up] !== undefined) show(DIGIT_OF[up], up);
  }
});

// ---- init ----
(function init() {
  buildChart();
  const saved = store.load();
  const hash = new URLSearchParams(location.hash.slice(1)).get("msg");
  msgEl.value = (hash ?? saved.msg ?? "SYNTH WAVES FOREVER").slice(0, 140);
  speedEl.value = saved.speed || 4;
  countEl.textContent = `${msgEl.value.length} / 140`;
  queue = parseMsg(msgEl.value);
  renderLagoon(); syncTranscript(); renderPose();
  if (hash) announce("Signal link loaded — press Transmit to play it. ✦");
})();
