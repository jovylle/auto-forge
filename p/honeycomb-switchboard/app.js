// Honeycomb Switchboard — a quiet hex-path puzzle. No deps, no images, file:// safe.
const $ = (id) => document.getElementById(id);
const boardEl = $("board"), stampEl = $("stamp");
const levelNumEl = $("levelNum"), levelNameEl = $("levelName");
const statMoves = $("statMoves"), statPar = $("statPar"), statTime = $("statTime"), statStars = $("statStars");
const flowMsg = $("flowMsg"), logEl = $("log"), hintCountEl = $("hintCount");
const bestLine = $("bestLine"), shareCodeInput = $("shareCode"), shareMsg = $("shareMsg"), toastEl = $("toast");

const LEVEL_NAMES = ["朝露 · morning dew", "薄墨 · light ink", "蝉時 · cicada hour", "夕凪 · evening calm", "月見 · moon viewing", "雪待 · waiting for snow", "初釜 · first tea", "奥山 · deep mountains"];
const STORE_KEY = "honeycomb-switchboard-v1";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sizeForLevel(lv) {
  const n = Math.min(4 + Math.floor((lv - 1) / 1), 7);
  return { rows: n, cols: n < 6 ? n + 1 : n };
}

// odd-r offset neighbours (our odd rows are shifted right)
function neighbors(r, c, rows, cols) {
  const even = r % 2 === 0;
  const d = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const out = [];
  for (const [dr, dc] of d) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
  }
  return out;
}

function randomWalkPath(rand, rows, cols, enterC) {
  // walk from top row to bottom row, mostly downward
  let r = 0, c = enterC;
  const path = [[r, c]];
  const seen = new Set(["0," + c]);
  let guard = 0;
  while (r < rows - 1 && guard++ < 500) {
    const opts = [];
    opts.push([r + 1, c - 1], [r + 1, c], [r + 1, c + 1]);
    opts.push([r, c - 1], [r, c + 1]);
    if (rand() < 0.25) opts.push([r - 1, c]);
    const valid = opts.filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && !seen.has(nr + "," + nc));
    const step = valid.length ? valid[(rand() * valid.length) | 0] : [Math.min(rows - 1, r + 1), Math.max(0, Math.min(cols - 1, c + (rand() < 0.5 ? -1 : 1)))];
    r = step[0]; c = step[1];
    seen.add(r + "," + c);
    path.push([r, c]);
  }
  return path;
}

function generate(level, seed) {
  const rand = mulberry32(seed);
  const { rows, cols } = sizeForLevel(level);
  const enterC = (rand() * cols) | 0;
  let exitC = (rand() * cols) | 0;
  if (cols > 1 && exitC === enterC) exitC = (exitC + 1 + ((rand() * (cols - 1)) | 0)) % cols;
  const path = randomWalkPath(rand, rows, cols, enterC);
  // force last cell into bottom row near exitC
  path.push([rows - 1, exitC]);
  const pathSet = new Set(path.map(([r, c]) => r + "," + c));
  const mid = path.filter(([r]) => r > 0 && r < rows - 1);
  const relayCount = Math.min(2 + Math.floor(level / 2), 4);
  const relays = [];
  const stride = Math.max(1, Math.floor(mid.length / relayCount));
  for (let i = 0; i < relayCount && mid.length; i++) {
    const idx = Math.min(mid.length - 1, i * stride + ((rand() * stride) | 0));
    const cell = mid[idx];
    if (cell && !relays.some(([r, c]) => r === cell[0] && c === cell[1])) relays.push(cell);
  }
  // blocks: off-path cells only, density grows with level
  const density = Math.min(0.08 + level * 0.015, 0.2);
  const blocks = new Set();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r + "," + c;
    if (pathSet.has(k)) continue;
    if ((r === 0 && c === enterC) || (r === rows - 1 && c === exitC)) continue;
    if (relays.some(([rr, cc]) => rr === r && cc === c)) continue;
    if (rand() < density) blocks.add(k);
  }
  const par = pathSet.size + relayCount; // rough fair par
  return { rows, cols, enterC, exitC, relays, blocks, solution: [...pathSet], par };
}

// ---------- state ----------
let G = null; // {level, seed, gen, lit:Set, moves, hintsUsed, startT, elapsed, won, timerId, cursor}
let soundOn = true;
let best = {};

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const d = JSON.parse(raw); best = d.best || {}; soundOn = d.soundOn !== false; }
  } catch { /* private mode */ }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ best, soundOn })); } catch { /* ignore */ }
}

// ---------- audio (tiny koto-ish pluck, no assets) ----------
let actx = null;
function pluck(freq = 520, dur = 0.25, vol = 0.12) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch { /* no audio */ }
}
const sfx = {
  on() { pluck(660, 0.22); setTimeout(() => pluck(990, 0.3, 0.08), 60); },
  off() { pluck(330, 0.18, 0.09); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => pluck(f, 0.4, 0.12), i * 130)); },
  hint() { pluck(440, 0.3, 0.1); },
};

// ---------- core flow ----------
function bfsEnergized() {
  const visited = new Set();
  const q = [[0, G.gen.enterC]];
  visited.add("0," + G.gen.enterC);
  while (q.length) {
    const [r, c] = q.pop();
    for (const [nr, nc] of neighbors(r, c, G.gen.rows, G.gen.cols)) {
      const k = nr + "," + nc;
      if (visited.has(k)) continue;
      const isExit = nr === G.gen.rows - 1 && nc === G.gen.exitC;
      if (isExit || G.lit.has(k)) { visited.add(k); q.push([nr, nc]); }
    }
  }
  return visited;
}

function checkWin(visited) {
  const { rows, exitC, relays } = G.gen;
  const exitK = (rows - 1) + "," + exitC;
  if (!visited.has(exitK)) return false;
  return relays.every(([r, c]) => G.lit.has(r + "," + c) && visited.has(r + "," + c));
}

function stars() {
  if (G.moves <= G.gen.par) return 3;
  if (G.moves <= G.gen.par + 4) return 2;
  return 1;
}

// ---------- rendering ----------
function render() {
  const { rows, cols, enterC, exitC, relays, blocks } = G.gen;
  const relaySet = new Set(relays.map(([r, c]) => r + "," + c));
  const visited = bfsEnergized();
  const won = checkWin(visited);

  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cols", cols);
  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div");
    row.className = "brow" + (r % 2 === 1 ? " offset" : "");
    row.setAttribute("role", "row");
    for (let c = 0; c < cols; c++) {
      const k = r + "," + c;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell";
      b.dataset.r = r; b.dataset.c = c;
      b.setAttribute("role", "gridcell");
      const isEnter = r === 0 && c === enterC;
      const isExit = r === rows - 1 && c === exitC;
      const isRelay = relaySet.has(k);
      const isBlock = blocks.has(k);
      let label = "", aria = `cell row ${r + 1} col ${c + 1}`;
      if (isBlock) { b.classList.add("block"); label = "✕"; aria += ", broken"; }
      else {
        if (isEnter) { b.classList.add("enter"); label = "繋"; aria += ", entrance"; }
        else if (isExit) { b.classList.add("exit"); label = "巣"; aria += ", exit"; }
        else if (isRelay) { b.classList.add("relay"); aria += ", relay, must connect"; }
        if (G.lit.has(k)) { b.classList.add("lit"); aria += ", lit"; }
        if (visited.has(k)) { b.classList.add("energized"); aria += ", energized"; }
      }
      b.setAttribute("aria-label", aria);
      b.disabled = isBlock;
      const s = document.createElement("span");
      s.className = "mk"; s.textContent = label;
      b.appendChild(s);
      if (G.cursor && G.cursor[0] === r && G.cursor[1] === c) b.classList.add("cursor");
      b.addEventListener("click", () => toggle(r, c, b));
      row.appendChild(b);
    }
    boardEl.appendChild(row);
  }

  statMoves.textContent = G.moves;
  statPar.textContent = "par " + G.gen.par;
  statStars.textContent = G.won ? "★".repeat(G.finalStars) + "☆".repeat(3 - G.finalStars) : "☆☆☆";
  levelNumEl.textContent = G.level;
  levelNameEl.textContent = LEVEL_NAMES[(G.level - 1) % LEVEL_NAMES.length];
  hintCountEl.textContent = G.hintsUsed > 0 ? `(${G.hintsUsed} used)` : "";

  if (won && !G.won) onWin(visited);
  else if (!won) {
    const need = G.gen.relays.filter(([r, c]) => !visited.has(r + "," + c)).length;
    const exitOk = visited.has((rows - 1) + "," + exitC);
    flowMsg.textContent = exitOk
      ? `出口は開いた — exit reached. ${need} relay${need === 1 ? "" : "s"} still dark.`
      : `${visited.size} cell${visited.size === 1 ? "" : "s"} glowing · ${need} relay${need === 1 ? "" : "s"} to join · reach the 巣 at the bottom.`;
  }
  if (G.won) {
    flowMsg.textContent = `完成 — circuit complete in ${G.moves} moves · ${fmtTime(G.elapsed)} · ${"★".repeat(G.finalStars)}`;
  }
  updateShareCode();
  renderBest();
}

function toggle(r, c, el) {
  if (G.won) return;
  const k = r + "," + c;
  if (G.gen.blocks.has(k)) return;
  if (r === 0 && c === G.gen.enterC) { toast("入口は常についている — entrance is always lit."); return; }
  if (r === G.gen.rows - 1 && c === G.gen.exitC) { toast("出口はつなぐもの — reach the exit, don't switch it."); return; }
  if (G.moves === 0) startTimer();
  if (G.lit.has(k)) { G.lit.delete(k); sfx.off(); }
  else { G.lit.add(k); sfx.on(); }
  G.moves++;
  G.cursor = [r, c];
  if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  render();
}

function startTimer() {
  stopTimer();
  G.startT = Date.now() - (G.elapsed || 0) * 1000;
  G.timerId = setInterval(() => {
    G.elapsed = Math.floor((Date.now() - G.startT) / 1000);
    statTime.textContent = fmtTime(G.elapsed);
  }, 500);
}
function stopTimer() { if (G && G.timerId) clearInterval(G.timerId); G.timerId = null; }
function fmtTime(s) { s = s || 0; return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

function onWin() {
  G.won = true;
  G.elapsed = G.startT ? Math.floor((Date.now() - G.startT) / 1000) : G.elapsed;
  G.finalStars = stars();
  stopTimer();
  sfx.win();
  stampEl.classList.add("show");
  setTimeout(() => stampEl.classList.remove("show"), 2600);
  const key = "lv" + G.level;
  const prev = best[key];
  if (!prev || G.moves < prev.moves) {
    best[key] = { moves: G.moves, time: G.elapsed, stars: G.finalStars, when: Date.now() };
    saveStore();
  }
  addLog(`第${G.level}局完成 — solved in ${G.moves} moves, ${fmtTime(G.elapsed)}, ${"★".repeat(G.finalStars)}`, true);
  saveProgress();
  render();
  toast(`完成！ ${"★".repeat(G.finalStars)} — solved in ${G.moves} moves.`);
}

function newGame(level, seed) {
  stopTimer();
  level = Math.max(1, Math.min(24, level || 1));
  seed = (seed == null ? (Math.random() * 2 ** 31) | 0 : seed) >>> 0;
  const gen = generate(level, seed);
  // relays start unlit; entrance pre-lit
  G = { level, seed, gen, lit: new Set(), moves: 0, hintsUsed: 0, elapsed: 0, startT: null, timerId: null, won: false, finalStars: 0, cursor: [0, gen.enterC] };
  // pre-light nothing (player discovers); entrance implicit
  statTime.textContent = "0:00";
  stampEl.classList.remove("show");
  addLog(`第${level}局 — new board (seed ${seed.toString(36)}), par ${gen.par}.`);
  saveProgress();
  render();
}

function resetBoard() {
  if (!G) return;
  stopTimer();
  G.lit.clear(); G.moves = 0; G.hintsUsed = 0; G.elapsed = 0; G.startT = null; G.won = false;
  statTime.textContent = "0:00";
  addLog("盤を戻す — board reset.");
  render();
}

function hint() {
  if (!G || G.won) return;
  if (G.moves === 0) startTimer();
  const visited = bfsEnergized();
  // suggest first solution cell (top-down) that is lit-able, unlit, not blocked
  const cand = G.gen.solution.find((k) => {
    if (visited.has(k)) return false;
    if (G.lit.has(k)) return false;
    if (G.gen.blocks.has(k)) return false;
    const [r, c] = k.split(",").map(Number);
    if (r === 0 && c === G.gen.enterC) return false;
    if (r === G.gen.rows - 1 && c === G.gen.exitC) return false;
    return true;
  });
  if (!cand) { toast("もうすぐ — almost there, just connect it up."); return; }
  const [r, c] = cand.split(",").map(Number);
  G.lit.add(cand); G.moves += 2; G.hintsUsed++;
  G.cursor = [r, c];
  sfx.hint();
  addLog(`手がかり — hint lit a cell (+2 moves).`);
  render();
  requestAnimationFrame(() => {
    const el = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (el) { el.classList.add("hint-flash"); setTimeout(() => el.classList.remove("hint-flash"), 2000); }
  });
}

// ---------- log / toast / best ----------
function addLog(text, win = false) {
  const li = document.createElement("li");
  if (win) li.className = "win";
  const t = document.createElement("span");
  t.className = "t";
  t.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  li.appendChild(t);
  li.appendChild(document.createTextNode(text));
  logEl.prepend(li);
  while (logEl.children.length > 30) logEl.lastChild.remove();
}
let toastT = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
}
function renderBest() {
  const keys = Object.keys(best).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
  if (!keys.length) { bestLine.textContent = "No completed boards yet. 一局どうぞ。"; return; }
  const total = keys.length;
  const starsTotal = keys.reduce((s, k) => s + (best[k].stars || 0), 0);
  bestLine.textContent = `${total} board${total === 1 ? "" : "s"} solved · ${starsTotal} stars ★ · best here: ${best["lv" + (G ? G.level : 1)] ? best["lv" + G.level].moves + " moves" : "—"}`;
}

// ---------- share / export ----------
function bitsFromLit() {
  const { rows, cols } = G.gen;
  let n = 0n;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    n <<= 1n;
    if (G.lit.has(r + "," + c)) n |= 1n;
  }
  return n.toString(36);
}
function litFromBits(bits36, rows, cols) {
  try {
    let n = 0n;
    const clean = (bits36 || "").trim().toLowerCase();
    for (const ch of clean) { n = n * 36n + BigInt(parseInt(ch, 36)); }
    const total = rows * cols;
    const lit = new Set();
    for (let i = total - 1; i >= 0; i--) {
      if ((n & 1n) === 1n) {
        const r = Math.floor(i / cols), c = i % cols;
        lit.add(r + "," + c);
      }
      n >>= 1n;
    }
    return lit;
  } catch { return new Set(); }
}
function encodeCode() {
  return `hcb1.${G.level}.${G.seed.toString(36)}.${bitsFromLit()}`;
}
function decodeCode(code) {
  const m = String(code || "").trim().match(/^hcb1\.(\d+)\.([0-9a-z]+)\.([0-9a-z]*)$/i);
  if (!m) return null;
  return { level: Math.max(1, Math.min(24, parseInt(m[1], 10))), seed: parseInt(m[2], 36) >>> 0, bits: m[3] || "" };
}
function updateShareCode() {
  if (!G) return;
  if (document.activeElement !== shareCodeInput) shareCodeInput.value = encodeCode();
  try {
    history.replaceState(null, "", "#" + encodeCode());
  } catch { /* file:// may restrict */ }
}
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    shareMsg.textContent = okMsg; toast(okMsg);
    return true;
  } catch {
    // fallback: select the share box
    shareCodeInput.value = text;
    shareCodeInput.focus(); shareCodeInput.select();
    shareMsg.textContent = "Copy manually: text selected above (clipboard blocked).";
    return false;
  }
}
function asciiBoard() {
  const { rows, cols, enterC, exitC, relays, blocks } = G.gen;
  const relaySet = new Set(relays.map(([r, c]) => r + "," + c));
  const visited = bfsEnergized();
  let out = `Honeycomb Switchboard — level ${G.level} (seed ${G.seed.toString(36)})\n`;
  for (let r = 0; r < rows; r++) {
    out += (r % 2 === 1 ? "  " : "");
    for (let c = 0; c < cols; c++) {
      const k = r + "," + c;
      let ch = "·";
      if (blocks.has(k)) ch = "✕";
      else if (r === 0 && c === enterC) ch = "繋";
      else if (r === rows - 1 && c === exitC) ch = "巣";
      else if (relaySet.has(k)) ch = visited.has(k) ? "◆" : "◇";
      else if (G.lit.has(k)) ch = visited.has(k) ? "●" : "○";
      out += ch + " ";
    }
    out += "\n";
  }
  out += `moves ${G.moves} · code ${encodeCode()}\n${location.href.split("#")[0]}#${encodeCode()}`;
  return out;
}
function exportPNG() {
  // CSS/canvas-only render: draw the hex board to an offscreen canvas
  const { rows, cols } = G.gen;
  const S = 56, w = S * 1.1 * cols + S, h = S * 1.05 * rows + S * 1.6;
  const cv = document.createElement("canvas");
  const scale = 2;
  cv.width = w * scale; cv.height = h * scale;
  const ctx = cv.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f6f1e5"; ctx.fillRect(0, 0, w, h);
  ctx.font = "700 13px serif"; ctx.fillStyle = "#1c1a16";
  ctx.fillText(`Honeycomb Switchboard — level ${G.level} · ${G.moves} moves`, 16, 24);
  const visited = bfsEnergized();
  const relaySet = new Set(G.gen.relays.map(([r, c]) => r + "," + c));
  const hexPath = (x, y, s) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      const px = x + s * Math.cos(a), py = y + s * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r + "," + c;
    const x = S * 0.7 + c * S * 1.02 + (r % 2 ? S * 0.51 : 0);
    const y = S * 0.9 + r * S * 0.88;
    hexPath(x, y, S * 0.48);
    if (G.gen.blocks.has(k)) ctx.fillStyle = "#3a3935";
    else if (visited.has(k)) ctx.fillStyle = "#d9a441";
    else if (G.lit.has(k)) ctx.fillStyle = "#e9e0cb";
    else if (relaySet.has(k)) ctx.fillStyle = "#cfd8c8";
    else ctx.fillStyle = "#e4dac2";
    ctx.fill();
    ctx.strokeStyle = "#1c1a16"; ctx.lineWidth = 1.2; ctx.stroke();
    if (r === 0 && c === G.gen.enterC) { ctx.fillStyle = "#1c1a16"; ctx.font = "12px serif"; ctx.fillText("entrance", x - 22, y + 4); }
    if (r === rows - 1 && c === G.gen.exitC) { ctx.fillStyle = "#c8402a"; ctx.font = "bold 12px serif"; ctx.fillText("exit", x - 10, y + 4); }
  }
  ctx.fillStyle = "#c8402a";
  ctx.strokeStyle = "#c8402a"; ctx.lineWidth = 3;
  ctx.strokeRect(w - 66, 12, 50, 50);
  ctx.font = "bold 20px serif"; ctx.fillText("蜂", w - 52, 44);
  const a = document.createElement("a");
  a.download = `honeycomb-switchboard-lv${G.level}.png`;
  a.href = cv.toDataURL("image/png");
  a.click();
  shareMsg.textContent = "PNG saved — CSS/canvas render, no images used.";
  toast("PNG saved.");
}

// ---------- persistence of in-progress ----------
function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY + "-progress", JSON.stringify({ level: G.level, seed: G.seed, bits: bitsFromLit(), moves: G.moves }));
  } catch { /* ignore */ }
}
setInterval(() => { if (G && !G.won && G.moves > 0) saveProgress(); }, 5000);

function loadFromURL() {
  const h = (location.hash || "").replace(/^#/, "");
  if (h.startsWith("hcb1.")) {
    const d = decodeCode(h);
    if (d) {
      newGame(d.level, d.seed);
      const lit = litFromBits(d.bits, G.gen.rows, G.gen.cols);
      // sanitize: drop blocks / endpoints
      for (const k of [...lit]) {
        const [r, c] = k.split(",").map(Number);
        if (G.gen.blocks.has(k) || (r === 0 && c === G.gen.enterC) || (r === G.gen.rows - 1 && c === G.gen.exitC)) lit.delete(k);
      }
      G.lit = lit;
      addLog("Shared board loaded from link.");
      render();
      return true;
    }
  }
  return false;
}

// ---------- events ----------
$("btnNew").addEventListener("click", () => newGame(G ? G.level : 1));
$("btnReset").addEventListener("click", resetBoard);
$("btnHint").addEventListener("click", hint);
$("btnPrevLv").addEventListener("click", () => newGame(Math.max(1, G.level - 1)));
$("btnNextLv").addEventListener("click", () => newGame(Math.min(24, G.level + 1)));
$("btnCopyLink").addEventListener("click", () => {
  const url = location.href.split("#")[0] + "#" + encodeCode();
  copyText(url, "Link copied — send it to a friend.");
});
$("btnCopyAscii").addEventListener("click", () => copyText(asciiBoard(), "Board copied as text."));
$("btnPng").addEventListener("click", exportPNG);
$("btnLoadCode").addEventListener("click", () => {
  const d = decodeCode(shareCodeInput.value);
  if (!d) { shareMsg.textContent = "That code doesn't look right (hcb1.level.seed.bits)."; return; }
  newGame(d.level, d.seed);
  const lit = litFromBits(d.bits, G.gen.rows, G.gen.cols);
  for (const k of [...lit]) {
    const [r, c] = k.split(",").map(Number);
    if (G.gen.blocks.has(k) || (r === 0 && c === G.gen.enterC) || (r === G.gen.rows - 1 && c === G.gen.exitC)) lit.delete(k);
  }
  G.lit = lit;
  addLog("Board loaded from code.");
  render();
  shareMsg.textContent = "Board loaded.";
});
$("btnWipe").addEventListener("click", () => {
  best = {};
  try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(STORE_KEY + "-progress"); } catch { /* ignore */ }
  saveStore(); renderBest();
  toast("Memory erased. 真っ白 — a clean slate.");
});
const howModal = $("howModal");
$("btnHow").addEventListener("click", () => { howModal.hidden = false; });
$("btnCloseHow").addEventListener("click", () => { howModal.hidden = true; });
$("btnStartPlay").addEventListener("click", () => { howModal.hidden = true; });
howModal.addEventListener("click", (e) => { if (e.target === howModal) howModal.hidden = true; });
$("btnSound").addEventListener("click", (e) => {
  soundOn = !soundOn; saveStore();
  e.currentTarget.textContent = soundOn ? "♪ on" : "♪ off";
  e.currentTarget.setAttribute("aria-pressed", String(soundOn));
});

document.addEventListener("keydown", (e) => {
  if (!howModal.hidden) { if (e.key === "Escape") howModal.hidden = true; return; }
  if (document.activeElement === shareCodeInput) return;
  if (!G) return;
  const k = e.key.toLowerCase();
  if (k === "n") { newGame(G.level); return; }
  if (k === "r") { resetBoard(); return; }
  if (k === "h") { hint(); return; }
  if (k === "escape") { shareCodeInput.blur(); document.activeElement?.blur?.(); return; }
  const [r, c] = G.cursor || [0, 0];
  let nr = r, nc = c;
  if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
  else if (e.key === "ArrowDown") nr = Math.min(G.gen.rows - 1, r + 1);
  else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
  else if (e.key === "ArrowRight") nc = Math.min(G.gen.cols - 1, c + 1);
  else if (e.key === " " || e.key === "Enter") {
    const cell = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (cell && !cell.disabled) { e.preventDefault(); toggle(r, c, cell); }
    return;
  } else return;
  e.preventDefault();
  G.cursor = [nr, nc];
  render();
  boardEl.querySelector(`[data-r="${nr}"][data-c="${nc}"]`)?.focus?.();
});

// ---------- boot ----------
loadStore();
$("btnSound").textContent = soundOn ? "♪ on" : "♪ off";
$("btnSound").setAttribute("aria-pressed", String(soundOn));
if (!loadFromURL()) {
  let resumed = false;
  try {
    const raw = localStorage.getItem(STORE_KEY + "-progress");
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.level && p.seed != null) {
        newGame(p.level, p.seed);
        const lit = litFromBits(p.bits || "", G.gen.rows, G.gen.cols);
        G.lit = lit; G.moves = p.moves || 0;
        if (G.moves > 0) addLog("前回の続き — resumed your unfinished board.");
        render();
        resumed = true;
      }
    }
  } catch { /* ignore */ }
  if (!resumed) newGame(1);
}
