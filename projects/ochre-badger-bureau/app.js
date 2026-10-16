// Ochre Badger Bureau — Field Dossier Desk (no deps, file:// safe)
const LS_KEY = "ochre-badger-bureau-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const queueEl = $("#queue"), detailEl = $("#detail"), emptyEl = $("#empty"),
  searchEl = $("#search"), sortEl = $("#sort"), toastsEl = $("#toasts"),
  dlgNew = $("#dlg-new"), formNew = $("#form-new"), dlgHelp = $("#dlg-help");

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "d" + Date.now() + Math.random().toString(16).slice(2));
const nowISO = () => new Date().toISOString();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stars = (p) => "★".repeat(p) + "☆".repeat(3 - p);

function seeds() {
  const t = Date.now();
  return [
    { id: uid(), title: "The Case of the Vanishing Biscuits", dept: "Snacks & Crumbs", prio: 3, notes: "Three digestives vanished from the break-room tin between 14:00 and 14:07. Only crumbs remain. Jenkins claims innocence; Jenkins always claims innocence.", verdict: "open", created: new Date(t - 86400000 * 2).toISOString(), updated: new Date(t - 86400000 * 2).toISOString() },
    { id: uid(), title: "Pigeon #47 Seen Wearing Tiny Hat", dept: "Suspicious Pigeons", prio: 2, notes: "Witness reports a pigeon on the ledge wearing what appeared to be a miniature bowler. Surveillance (Gloria, 3rd floor) confirms. Motive unknown.", verdict: "open", created: new Date(t - 86400000).toISOString(), updated: new Date(t - 86400000).toISOString() },
    { id: uid(), title: "Hum in the Basement Archive", dept: "Midnight Noises", prio: 2, notes: "Low hum, roughly B-flat, every night at 23:40. Stops when investigated. Badger suspects the pipes. Pipes suspect the badger.", verdict: "shelved", created: new Date(t - 86400000 * 5).toISOString(), updated: new Date(t - 86400000 * 4).toISOString() },
    { id: uid(), title: "Found: One Left Glove, Smug", dept: "Lost & Found", prio: 1, notes: "A single left glove, leather, faintly smug. Awaiting its rightful hand or a matching tragedy.", verdict: "approved", created: new Date(t - 86400000 * 9).toISOString(), updated: new Date(t - 86400000 * 8).toISOString() },
    { id: uid(), title: "Cloud Shaped Exactly Like a Badger", dept: "Weather Grumbles", prio: 1, notes: "Reported over the car park at noon. Dissipated before the sketch artist arrived. Denied by meteorology, believed by all.", verdict: "denied", created: new Date(t - 86400000 * 12).toISOString(), updated: new Date(t - 86400000 * 11).toISOString() },
  ];
}

let dossiers = load();
let filter = "all", query = "", sortMode = "newest";
let selectedId = null, focusIdx = 0, lastDeleted = null;

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { const s = seeds(); localStorage.setItem(LS_KEY, JSON.stringify(s)); return s; }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : seeds();
  } catch { return seeds(); }
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(dossiers)); } catch {} }

function visible() {
  let list = dossiers.filter((d) =>
    (filter === "all" || d.verdict === filter) &&
    (!query || (d.title + " " + d.dept + " " + (d.notes || "")).toLowerCase().includes(query)));
  const by = {
    newest: (a, b) => b.created.localeCompare(a.created),
    oldest: (a, b) => a.created.localeCompare(b.created),
    priority: (a, b) => b.prio - a.prio || b.created.localeCompare(a.created),
    az: (a, b) => a.title.localeCompare(b.title),
  }[sortMode];
  return [...list].sort(by);
}

function counts() {
  const c = { all: dossiers.length, open: 0, approved: 0, shelved: 0, denied: 0 };
  for (const d of dossiers) if (c[d.verdict] !== undefined) c[d.verdict]++;
  return c;
}

function render() {
  const c = counts();
  for (const k of ["all", "open", "approved", "shelved", "denied"]) $("#count-" + k).textContent = c[k];
  const list = visible();
  $("#queue-count").textContent = list.length;
  if (!list.some((d) => d.id === selectedId)) selectedId = list[0]?.id ?? null;
  focusIdx = Math.max(0, list.findIndex((d) => d.id === selectedId));
  queueEl.innerHTML = "";
  for (const d of list) {
    const li = document.createElement("li");
    li.className = "q-item";
    li.setAttribute("role", "option");
    li.id = "q-" + d.id;
    li.tabIndex = -1;
    li.dataset.id = d.id;
    const sel = d.id === selectedId;
    li.setAttribute("aria-selected", sel ? "true" : "false");
    li.setAttribute("aria-label", `${d.title}, ${d.dept}, priority ${d.prio}, ${d.verdict}`);
    li.innerHTML = `<div class="q-top"><p class="q-title">${esc(d.title)}</p><span class="badge-verdict v-${esc(d.verdict)}">${esc(d.verdict)}</span></div>
      <p class="q-meta"><span class="prio" aria-hidden="true">${stars(d.prio)}</span> · ${esc(d.dept)} · ${esc(new Date(d.created).toLocaleDateString())}</p>`;
    li.addEventListener("click", () => { select(d.id); focusQueueItem(d.id); });
    queueEl.append(li);
  }
  emptyEl.hidden = list.length > 0;
  queueEl.style.display = list.length ? "" : "none";
  queueEl.setAttribute("aria-activedescendant", selectedId ? "q-" + selectedId : "");
  renderDetail();
}

function getSel() { return dossiers.find((d) => d.id === selectedId) ?? null; }

function renderDetail() {
  const d = getSel();
  $$(".q-item", queueEl).forEach((el) => el.setAttribute("aria-selected", el.dataset.id === selectedId ? "true" : "false"));
  if (!d) {
    detailEl.innerHTML = `<div class="detail-blank"><span class="big" aria-hidden="true">🦡</span>
      <h2>No dossier selected</h2><p>File one with <kbd>N</kbd>, or pick a case from the in-tray.</p></div>`;
    return;
  }
  const date = new Date(d.created).toLocaleString();
  detailEl.innerHTML = `
    <span class="d-dept">${esc(d.dept)}</span>
    <h2 class="d-title">${esc(d.title)}</h2>
    <p class="d-sub"><span aria-hidden="true">${stars(d.prio)}</span> priority ${d.prio} · filed ${esc(date)} · id <code>${esc(d.id.slice(0, 8))}</code></p>
    <div class="d-notes">${esc(d.notes || "No field notes yet.")}</div>
    <div class="d-stamp"><span class="stamp s-${esc(d.verdict)}" id="stamp">${esc(d.verdict === "open" ? "awaiting stamp" : d.verdict)}</span></div>
    <div class="stamp-row" role="group" aria-label="Stamp verdict">
      <p>Stamp this dossier</p>
      <button class="btn ${d.verdict === "approved" ? "is-current" : ""}" data-stamp="approved" type="button">✔ Approve <kbd>1</kbd></button>
      <button class="btn ${d.verdict === "shelved" ? "is-current" : ""}" data-stamp="shelved" type="button">▤ Shelve <kbd>2</kbd></button>
      <button class="btn ${d.verdict === "denied" ? "is-current" : ""}" data-stamp="denied" type="button">✘ Deny <kbd>3</kbd></button>
    </div>
    <div class="d-actions">
      <button class="btn btn-ghost" id="d-copy" type="button">Copy case note</button>
      <button class="btn btn-danger" id="d-shred" type="button">Shred dossier <kbd>X</kbd></button>
    </div>`;
  $$("[data-stamp]", detailEl).forEach((b) => b.addEventListener("click", () => stamp(d.id, b.dataset.stamp)));
  $("#d-copy", detailEl).addEventListener("click", () => copyText(caseMarkdown(d), "Case note copied."));
  $("#d-shred", detailEl).addEventListener("click", () => shred(d.id));
}

function select(id) { selectedId = id; renderDetail(); $$(".q-item", queueEl).forEach((el) => el.setAttribute("aria-selected", el.dataset.id === id ? "true" : "false")); }
function focusQueueItem(id) { const el = id && $("#q-" + CSS.escape(id)); if (el) el.focus({ preventScroll: false }); else queueEl.focus(); }
function moveFocus(dir) {
  const list = visible(); if (!list.length) return;
  focusIdx = (focusIdx + dir + list.length) % list.length;
  select(list[focusIdx].id); focusQueueItem(list[focusIdx].id);
}

function stamp(id, verdict) {
  const d = dossiers.find((x) => x.id === id); if (!d) return;
  d.verdict = verdict; d.updated = nowISO(); save(); render();
  const el = $("#stamp"); if (el) { el.classList.remove("slam"); void el.offsetWidth; el.classList.add("slam"); }
  flash(verdict);
  toast(`Stamped “${d.title}” → ${verdict.toUpperCase()}.`, "ok");
}

function shred(id) {
  const i = dossiers.findIndex((x) => x.id === id); if (i < 0) return;
  lastDeleted = { doc: dossiers[i], idx: i };
  dossiers.splice(i, 1); save(); render(); queueEl.focus();
  toast(`Shredded “${lastDeleted.doc.title}”.`, "warn", { label: "Undo", fn: () => {
    dossiers.splice(Math.min(lastDeleted.idx, dossiers.length), 0, lastDeleted.doc);
    selectedId = lastDeleted.doc.id; save(); render(); toast("Restored.", "ok");
  }});
}

function flash(verdict) {
  const f = $("#stamp-flash"), w = $("#stamp-word");
  w.textContent = verdict.toUpperCase();
  f.className = "stamp-flash f-" + verdict;
  void f.offsetWidth; f.classList.add("show");
  clearTimeout(flash._t); flash._t = setTimeout(() => f.classList.remove("show"), 850);
}

function toast(msg, kind = "", action) {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.innerHTML = `<span></span>`;
  t.firstChild.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.className = "btn btn-ghost"; b.type = "button"; b.style.marginLeft = "10px"; b.textContent = action.label;
    b.addEventListener("click", () => { action.fn(); t.remove(); });
    t.append(b); setTimeout(() => b.focus({ preventScroll: true }), 50);
  }
  toastsEl.append(t);
  setTimeout(() => t.remove(), action ? 8000 : 3500);
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg, "ok"); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(okMsg, "ok"); } catch { toast("Copy failed — select manually.", "err"); }
    ta.remove();
  }
}

/* ---- share / export ---- */
const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));

function shareLink() {
  const payload = b64e(JSON.stringify(dossiers));
  return location.href.split("#")[0] + "#d=" + payload;
}
function caseMarkdown(d) {
  return `## ${d.title}\n- Dept: ${d.dept} · Priority: ${"★".repeat(d.prio)} · Verdict: ${d.verdict.toUpperCase()}\n- Filed: ${d.created}\n\n${d.notes || "_No notes._"}\n`;
}
function ledgerMarkdown() {
  return `# Ochre Badger Bureau — ledger (${dossiers.length} dossiers)\n\n` + dossiers.map(caseMarkdown).join("\n---\n\n");
}
const csvCell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
function ledgerCSV() {
  return ["id,title,dept,prio,verdict,created,updated,notes"]
    .concat(dossiers.map((d) => [d.id, d.title, d.dept, d.prio, d.verdict, d.created, d.updated, (d.notes || "").replaceAll("\n", " ")].map(csvCell).join(",")))
    .join("\n");
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function buildPrintLedger() {
  $("#print-ledger").innerHTML = `<h1>Ochre Badger Bureau — ledger</h1>` +
    dossiers.map((d) => `<hr><h2>${esc(d.title)} [${esc(d.verdict)}]</h2><p>${esc(d.dept)} · ${stars(d.prio)} · ${esc(d.created)}</p><p>${esc(d.notes || "")}</p>`).join("");
}

/* ---- events ---- */
$("#btn-new").addEventListener("click", () => { dlgNew.showModal(); $("#f-title").focus(); });
$("#btn-empty-new").addEventListener("click", () => { dlgNew.showModal(); $("#f-title").focus(); });
$("#btn-cancel-new").addEventListener("click", () => dlgNew.close());
formNew.addEventListener("submit", (e) => {
  const title = $("#f-title").value.trim();
  if (!title) { e.preventDefault(); $("#f-title").focus(); toast("A title is required.", "err"); return; }
  const d = { id: uid(), title, dept: $("#f-dept").value, prio: +$("#f-prio").value,
    notes: $("#f-notes").value.trim(), verdict: "open", created: nowISO(), updated: nowISO() };
  dossiers.unshift(d); selectedId = d.id; save(); render();
  formNew.reset(); $("#f-prio").value = "2";
  toast(`Filed “${title}”.`, "ok"); focusQueueItem(d.id);
});
$("#btn-help").addEventListener("click", () => dlgHelp.showModal());
$("#btn-close-help").addEventListener("click", () => dlgHelp.close());
for (const dlg of [dlgNew, dlgHelp]) dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

searchEl.addEventListener("input", () => { query = searchEl.value.trim().toLowerCase(); render(); });
searchEl.addEventListener("keydown", (e) => { if (e.key === "Escape") { searchEl.value = ""; query = ""; render(); searchEl.blur(); } });
sortEl.addEventListener("change", () => { sortMode = sortEl.value; render(); });
$$(".chip").forEach((ch) => ch.addEventListener("click", () => {
  $$(".chip").forEach((c) => c.classList.remove("is-on"));
  ch.classList.add("is-on"); filter = ch.dataset.filter; render();
}));

queueEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); moveFocus(1); }
  else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); moveFocus(-1); }
  else if (e.key === "Enter") { e.preventDefault(); focusQueueItem(selectedId); }
});
queueEl.addEventListener("focus", () => { if (selectedId) queueEl.setAttribute("aria-activedescendant", "q-" + selectedId); });

$("#btn-link").addEventListener("click", () => copyText(shareLink(), "Share link copied — opens with this ledger."));
$("#btn-md").addEventListener("click", () => copyText(ledgerMarkdown(), "Ledger summary copied as Markdown."));
$("#btn-json").addEventListener("click", () => { download("badger-ledger.json", JSON.stringify(dossiers, null, 2), "application/json"); toast("JSON downloaded.", "ok"); });
$("#btn-csv").addEventListener("click", () => { download("badger-ledger.csv", ledgerCSV(), "text/csv"); toast("CSV downloaded.", "ok"); });
$("#btn-print").addEventListener("click", () => { buildPrintLedger(); window.print(); });
$("#btn-wipe").addEventListener("click", () => { dossiers = seeds(); selectedId = null; save(); render(); toast("Demo data restored.", "ok"); });
$("#file-import").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const arr = JSON.parse(r.result);
      if (!Array.isArray(arr)) throw 0;
      dossiers = arr.filter((d) => d && d.title).map((d) => ({ verdict: "open", prio: 2, dept: "Other Oddities", notes: "", created: nowISO(), updated: nowISO(), ...d, id: String(d.id || uid()) }));
      selectedId = null; save(); render(); toast(`Imported ${dossiers.length} dossiers.`, "ok");
    } catch { toast("Import failed — not a bureau JSON file.", "err"); }
  };
  r.readAsText(f); e.target.value = "";
});

/* global keyboard shortcuts (ignored while typing, except Esc) */
document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
  if (e.key === "Escape") { if (dlgNew.open) dlgNew.close(); if (dlgHelp.open) dlgHelp.close(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "n" || e.key === "N") { e.preventDefault(); dlgNew.showModal(); $("#f-title").focus(); }
  else if (e.key === "/") { e.preventDefault(); searchEl.focus(); }
  else if (e.key === "?") { e.preventDefault(); dlgHelp.showModal(); }
  else if (e.key === "j") moveFocus(1);
  else if (e.key === "k") moveFocus(-1);
  else if (e.key === "1" && selectedId) stamp(selectedId, "approved");
  else if (e.key === "2" && selectedId) stamp(selectedId, "shelved");
  else if (e.key === "3" && selectedId) stamp(selectedId, "denied");
  else if ((e.key === "x" || e.key === "X") && selectedId) shred(selectedId);
});

/* shared-ledger deep link: #d=<base64url json> */
(function deepLink() {
  if (!location.hash.startsWith("#d=")) return;
  try {
    const arr = JSON.parse(b64d(location.hash.slice(3)));
    if (!Array.isArray(arr) || !arr.length) throw 0;
    const ok = window.confirm(`This link carries a shared ledger (${arr.length} dossiers). Load it into your bureau? (Your current ledger stays until you confirm.)`);
    if (ok) {
      dossiers = arr.filter((d) => d && d.title).map((d) => ({ verdict: "open", prio: 2, dept: "Other Oddities", notes: "", created: nowISO(), updated: nowISO(), ...d, id: String(d.id || uid()) }));
      selectedId = null; save(); render();
      history.replaceState(null, "", location.pathname + location.search);
      toast(`Loaded shared ledger (${dossiers.length} dossiers).`, "ok");
    }
  } catch { toast("Share link unreadable.", "err"); }
})();

render();
