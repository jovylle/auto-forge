// Reed Fox Registry — field ledger. localStorage, WebAudio calls, share/export. No deps.
const KEY = "reed-fox-registry-v1";
const $ = (s, r = document) => r.querySelector(s);
const list = $("#list"), empty = $("#empty"), toast = $("#toast");
const form = $("#foxForm");

const CALLS = {
  yip:   { label: "Sharp yip",  seq: [[880, .09], [1174, .09], [880, .12]] },
  trill: { label: "Reed trill", seq: [[660, .07], [720, .07], [780, .07], [880, .12]] },
  huff:  { label: "Soft huff",  seq: [[220, .16], [180, .2]] },
  yowl:  { label: "Dusk yowl",  seq: [[392, .22], [523, .22], [392, .3]] },
};
let audioCtx = null;
function playCall(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    let t = t0;
    for (const [f, d] of (CALLS[kind] || CALLS.yip).seq) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + d + 0.02);
      t += d + 0.03;
    }
  } catch { /* audio unavailable — ledger still works */ }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Seed the book on first visit
  const seed = [
    { id: uid(), name: "Bramblewick", coat: "Russet", den: "North Reeds", call: "yip", shy: 2, traits: ["white socks", "steals boots"], note: "Seen at golden hour, carrying a stolen feather.", seen: 4, created: Date.now() - 86400000 * 3 },
    { id: uid(), name: "Mossbell", coat: "Cross", den: "Bramble Hollow", call: "trill", shy: 4, traits: ["bushy brush", "sings at dusk"], note: "Answered the reed flute with a trill.", seen: 2, created: Date.now() - 86400000 * 2 },
    { id: uid(), name: "Tallow", coat: "Silver", den: "Mill Pond", call: "huff", shy: 5, traits: ["torn ear", "shy of lanterns"], note: "Only the ears above the mist. Gone by moonrise.", seen: 1, created: Date.now() - 86400000 },
  ];
  save(seed);
  return seed;
}
function save(foxes) { try { localStorage.setItem(KEY, JSON.stringify(foxes)); } catch {} }
function uid() { return "f" + Math.random().toString(36).slice(2, 9); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let foxes = load();
const shyWords = ["bold as brass", "bright-eyed", "wary", "shadow-shy", "a rumour"];

function stats() {
  $("#statFoxes").textContent = foxes.length;
  $("#statSightings").textContent = foxes.reduce((a, f) => a + (f.seen || 0), 0);
  $("#statDens").textContent = new Set(foxes.map((f) => f.den)).size;
  $("#year").textContent = new Date().getFullYear();
  $("#countLabel").textContent = foxes.length ? `· ${foxes.length} entr${foxes.length === 1 ? "y" : "ies"}` : "";
}

function filtered() {
  const q = $("#q").value.trim().toLowerCase();
  const coat = $("#filterCoat").value;
  const sort = $("#sortBy").value;
  let out = foxes.filter((f) =>
    (!coat || f.coat === coat) &&
    (!q || [f.name, f.den, f.coat, f.note, (f.traits || []).join(" ")].join(" ").toLowerCase().includes(q))
  );
  if (sort === "seen") out.sort((a, b) => (b.seen || 0) - (a.seen || 0));
  else if (sort === "az") out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort((a, b) => b.created - a.created);
  return out;
}

function render() {
  stats();
  const rows = filtered();
  empty.hidden = rows.length > 0;
  list.innerHTML = rows.map((f) => `
    <li class="fox" data-id="${f.id}">
      <div class="fox-top">
        <span class="fox-ears coat-${esc(f.coat)}" aria-hidden="true"></span>
        <div>
          <p class="fox-name">${esc(f.name)}</p>
          <p class="fox-meta"><b>${esc(f.coat)}</b> coat · <span class="den">${esc(f.den)}</span> · ${(CALLS[f.call] || CALLS.yip).label.toLowerCase()} · ${esc(shyWords[(f.shy || 3) - 1])}</p>
        </div>
      </div>
      ${f.note ? `<p class="fox-note">“${esc(f.note)}”</p>` : ""}
      ${(f.traits && f.traits.length) ? `<div class="fox-tags">${f.traits.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="fox-actions">
        <span class="seencount" title="Sightings">✦ ${f.seen || 0} seen</span>
        <button data-act="seen" class="primary" type="button">+ sighting</button>
        <button data-act="call" type="button">▶ call</button>
        <button data-act="card" type="button">copy card</button>
        <button data-act="link" type="button">copy link</button>
        <button data-act="release" class="danger" type="button">release</button>
      </div>
    </li>`).join("");
}

let toastT;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove("show"), 2200);
}

function foxCard(f) {
  return `🦊 ${f.name} — ${f.coat} of ${f.den}\nCall: ${(CALLS[f.call] || CALLS.yip).label} · ${shyWords[(f.shy || 3) - 1]} · seen ${f.seen || 0}×\n${f.note ? `“${f.note}”\n` : ""}${(f.traits || []).length ? "Marks: " + f.traits.join(", ") + "\n" : ""}— entered in the Reed Fox Registry`;
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  say(msg);
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const toCSV = (rows) => {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return ["name,coat,den,call,shyness,sightings,traits,note",
    ...rows.map((f) => [f.name, f.coat, f.den, f.call, f.shy, f.seen || 0, (f.traits || []).join("; "), f.note].map(q).join(","))].join("\n");
};

// Add entry
$("#fShy").addEventListener("input", (e) => {
  $("#shyVal").textContent = `${shyWords[e.target.value - 1]} · ${e.target.value}`;
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#fName").value.trim();
  if (!name) { say("Name your fox first."); return; }
  const traits = [...form.querySelectorAll(".traits input:checked")].map((c) => c.value);
  foxes.unshift({ id: uid(), name, coat: $("#fCoat").value, den: $("#fDen").value, call: $("#fCall").value, shy: +$("#fShy").value, traits, note: $("#fNote").value.trim(), seen: 1, created: Date.now() });
  save(foxes); render();
  playCall($("#fCall").value);
  const btn = form.querySelector(".seal-btn");
  btn.classList.remove("stamped"); void btn.offsetWidth; btn.classList.add("stamped");
  form.reset(); $("#shyVal").textContent = "wary · 3";
  say(`${name} pressed into the ledger ❦`);
});

// List actions (delegated)
list.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const li = e.target.closest(".fox");
  const f = foxes.find((x) => x.id === li.dataset.id);
  if (!f) return;
  const act = btn.dataset.act;
  if (act === "seen") { f.seen = (f.seen || 0) + 1; save(foxes); render(); say(`${f.name} seen again ✦`); }
  else if (act === "call") playCall(f.call);
  else if (act === "card") copyText(foxCard(f), "Fox card copied — paste anywhere");
  else if (act === "link") copyText(`${location.href.split("#")[0]}#fox-${f.id}`, "Link to this fox copied");
  else if (act === "release") {
    if (!confirm(`Release ${f.name} back to the reeds?`)) return;
    foxes = foxes.filter((x) => x.id !== f.id);
    save(foxes); render(); say(`${f.name} slipped into the reeds…`);
  }
});

// Search / filter / sort
["q", "filterCoat", "sortBy"].forEach((id) => $("#" + id).addEventListener("input", render));

// Share / export bar
$("#btnCopyLedger").addEventListener("click", () => {
  if (!foxes.length) return say("The book is blank — add a fox first.");
  copyText(`REED FOX REGISTRY — ${foxes.length} foxes, ${foxes.reduce((a, f) => a + (f.seen || 0), 0)} sightings\n` +
    foxes.map((f) => `· ${f.name} (${f.coat}, ${f.den}) — seen ${f.seen || 0}×`).join("\n"), "Ledger tale copied");
});
$("#btnJSON").addEventListener("click", () => {
  download("reed-fox-registry.json", JSON.stringify(foxes, null, 2), "application/json");
  say("Ledger downloaded as JSON");
});
$("#btnCSV").addEventListener("click", () => {
  download("reed-fox-registry.csv", toCSV(foxes), "text/csv");
  say("Ledger downloaded as CSV");
});
$("#btnPrint").addEventListener("click", () => window.print());
$("#btnWipe").addEventListener("click", () => {
  if (!foxes.length || !confirm("Release ALL foxes and blank the book?")) return;
  foxes = []; save(foxes); render(); say("The book is blank. The reeds rustle.");
});
$("#fileImport").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!Array.isArray(data)) throw 0;
      const clean = data.filter((f) => f && f.name).map((f) => ({ id: f.id || uid(), name: String(f.name).slice(0, 24), coat: f.coat || "Russet", den: f.den || "North Reeds", call: CALLS[f.call] ? f.call : "yip", shy: Math.min(5, Math.max(1, +f.shy || 3)), traits: Array.isArray(f.traits) ? f.traits.slice(0, 6) : [], note: String(f.note || "").slice(0, 140), seen: +f.seen || 1, created: +f.created || Date.now() }));
      foxes = clean; save(foxes); render();
      say(`${clean.length} foxes wandered in from file`);
    } catch { say("That file isn't a fox ledger."); }
    e.target.value = "";
  };
  r.readAsText(file);
});

// Deep link: #fox-<id> highlights the entry
function highlightHash() {
  const m = location.hash.match(/^#fox-(.+)$/);
  if (!m) return;
  const li = list.querySelector(`[data-id="${CSS.escape(m[1])}"]`);
  if (li) { li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1700); }
}
window.addEventListener("hashchange", highlightHash);

render();
highlightHash();
