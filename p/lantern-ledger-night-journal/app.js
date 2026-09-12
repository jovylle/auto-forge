/* LANTERN//LEDGER — night journal. No deps. localStorage only. Works from file:// */
(function () {
  "use strict";
  var LS_ENTRIES = "ll.entries.v1";
  var LS_DRAFT = "ll.draft.v1";
  var FLAMES = { 1: "dim", 2: "low", 3: "steady", 4: "bright", 5: "blaze" };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function loadEntries() {
    try { var v = JSON.parse(localStorage.getItem(LS_ENTRIES) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function saveEntries(list) { try { localStorage.setItem(LS_ENTRIES, JSON.stringify(list)); } catch (e) {} }
  function flameDots(f, hot) {
    var s = ""; for (var i = 1; i <= 5; i++) s += i <= f ? "●" : "○";
    return '<span class="flame' + (hot || f >= 4 ? " hot" : "") + '">' + s + "</span>";
  }
  function wordsOf(s) { var t = String(s || "").trim(); return t ? t.split(/\s+/).length : 0; }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return new Date(ts).toString(); }
  }
  function stampName(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function copyText(text, fallbackTitle) {
    function fallback() {
      $("copyText").value = text;
      $("copyModal").hidden = false;
      $("copyText").focus(); $("copyText").select();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("copied to clipboard ◈"); }, fallback);
    } else fallback();
  }
  function entryText(e) {
    return "LANTERN//LEDGER — " + fmtDate(e.ts) + "\nflame: " + e.flame + "/5 (" + FLAMES[e.flame] + ")\n\n" +
      (e.title || "(untitled)") + "\n\n" + (e.body || "");
  }

  /* ---- shared-link view (#ll=base64url json) ---- */
  function b64uEncode(s) {
    var b = btoa(unescape(encodeURIComponent(s)));
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64uDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  (function sharedView() {
    var m = /^#ll=(.+)$/.exec(location.hash || "");
    if (!m) return;
    try {
      var e = JSON.parse(b64uDecode(m[1]));
      $("app").hidden = true;
      var sh = $("shared"); sh.hidden = false;
      $("sharedFlame").outerHTML = flameDots(e.flame || 3);
      $("sharedDate").textContent = e.ts ? fmtDate(e.ts) : "shared entry";
      $("sharedTitle").textContent = e.title || "(untitled)";
      $("sharedBody").textContent = e.body || "";
      document.title = "◈ shared night entry — LANTERN//LEDGER";
    } catch (err) { /* ignore bad hash, show normal app */ }
  })();

  /* ---- boot sequence ---- */
  var bootEl = $("boot"), bootLines = $("bootLines");
  var LINES = ["LANTERN//LEDGER v1.0 — night-link …", "warming phosphor … ok", "local vault … unlocked (this machine only)", "type the night. seal it. burn nothing."];
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function boot(done) {
    if (reduced) { bootLines.textContent = LINES.join("\n"); bootEl.style.display = "none"; done(); return; }
    var i = 0, out = "";
    (function tick() {
      if (i < LINES.length) { out += (i ? "\n" : "") + LINES[i++]; bootLines.textContent = out; setTimeout(tick, 260); }
      else setTimeout(function () { bootEl.style.display = "none"; done(); }, 350);
    })();
  }

  /* ---- state ---- */
  var entries = loadEntries();
  var flame = 3, openedId = null, burnArmed = false;

  var titleEl = $("title"), bodyEl = $("body"), wordsEl = $("words"),
      saveState = $("saveState"), listEl = $("list"), emptyEl = $("empty"),
      countEl = $("count"), streakEl = $("streak"), glowEl = $("glow"),
      flameEl = $("flame"), flameName = $("flameName"), qEl = $("q");

  function setFlame(f) {
    flame = Math.min(5, Math.max(1, f | 0));
    var btns = flameEl.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], on = (+b.getAttribute("data-f")) <= flame;
      b.classList.toggle("on", (+b.getAttribute("data-f")) === flame);
      b.classList.toggle("hot", flame >= 4);
      b.setAttribute("aria-checked", (+b.getAttribute("data-f")) === flame ? "true" : "false");
      void on;
    }
    flameName.textContent = FLAMES[flame] + " · " + flame;
    glowEl.className = "glow f" + flame;
    queueDraft();
  }
  flameEl.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    setFlame(+b.getAttribute("data-f"));
  });

  function streak() {
    var days = {};
    entries.forEach(function (e) { var d = new Date(e.ts); days[d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()] = 1; });
    var n = 0, d = new Date();
    if (!days[d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()]) d.setDate(d.getDate() - 1);
    while (days[d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  var draftT = null;
  function queueDraft() {
    saveState.textContent = "typing…"; saveState.className = "chip warn";
    clearTimeout(draftT);
    draftT = setTimeout(function () {
      try {
        localStorage.setItem(LS_DRAFT, JSON.stringify({ title: titleEl.value, body: bodyEl.value, flame: flame, at: Date.now() }));
        saveState.textContent = "draft saved ✓"; saveState.className = "chip ok";
      } catch (e) { saveState.textContent = "vault full!"; }
    }, 400);
    wordsEl.textContent = wordsOf(bodyEl.value) + " words";
  }
  titleEl.addEventListener("input", queueDraft);
  bodyEl.addEventListener("input", queueDraft);
  (function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(LS_DRAFT) || "null");
      if (d && (d.title || d.body)) {
        titleEl.value = d.title || ""; bodyEl.value = d.body || "";
        flame = d.flame || 3;
        toast("draft restored ◈");
      }
    } catch (e) {}
    setFlame(flame);
    wordsEl.textContent = wordsOf(bodyEl.value) + " words";
  })();

  function render() {
    var q = (qEl.value || "").toLowerCase();
    var shown = entries.filter(function (e) {
      return !q || (e.title + " " + e.body).toLowerCase().indexOf(q) !== -1;
    });
    countEl.textContent = entries.length + (entries.length === 1 ? " entry" : " entries");
    var s = streak();
    streakEl.textContent = s + "-night streak";
    emptyEl.style.display = shown.length ? "none" : "";
    listEl.innerHTML = shown.map(function (e) {
      return '<li data-id="' + e.id + '" tabindex="0">' +
        '<p class="t">' + esc(e.title || "(untitled)") + "</p>" +
        '<div class="meta">' + flameDots(e.flame) +
        "<span>" + esc(fmtDate(e.ts)) + "</span><span>·</span><span>" + wordsOf(e.body) + "w</span></div></li>";
    }).join("");
  }

  function seal() {
    var title = titleEl.value.trim(), body = bodyEl.value.trim();
    if (!title && !body) { toast("empty page — write something first"); bodyEl.focus(); return; }
    var e = { id: "e" + Date.now().toString(36), ts: Date.now(), title: title || "(untitled)", body: body, flame: flame };
    entries.unshift(e); saveEntries(entries);
    titleEl.value = ""; bodyEl.value = "";
    try { localStorage.removeItem(LS_DRAFT); } catch (err) {}
    saveState.textContent = "sealed ◈"; wordsEl.textContent = "0 words";
    render(); toast("entry sealed into the ledger ◈");
  }

  $("save").addEventListener("click", seal);
  $("new").addEventListener("click", function () {
    titleEl.value = ""; bodyEl.value = ""; setFlame(3);
    wordsEl.textContent = "0 words"; titleEl.focus(); toast("fresh page ◈");
  });
  $("dlDraft").addEventListener("click", function () {
    var t = titleEl.value.trim(), b = bodyEl.value.trim();
    if (!t && !b) { toast("nothing to export yet"); return; }
    download("lantern-draft-" + stampName(Date.now()) + ".txt",
      entryText({ ts: Date.now(), title: t || "(untitled draft)", body: b, flame: flame }));
    toast("draft exported ⇩");
  });
  $("copyDraft").addEventListener("click", function () {
    var t = titleEl.value.trim(), b = bodyEl.value.trim();
    if (!t && !b) { toast("nothing to copy yet"); return; }
    copyText(entryText({ ts: Date.now(), title: t || "(untitled draft)", body: b, flame: flame }));
  });
  $("dlJson").addEventListener("click", function () {
    if (!entries.length) { toast("ledger is empty"); return; }
    download("lantern-ledger-" + stampName(Date.now()) + ".json", JSON.stringify(entries, null, 2), "application/json");
    toast("whole journal exported ⇩");
  });
  qEl.addEventListener("input", render);

  /* ---- read modal ---- */
  var modal = $("modal");
  function openEntry(id) {
    var e = null;
    for (var i = 0; i < entries.length; i++) if (entries[i].id === id) e = entries[i];
    if (!e) return;
    openedId = id; burnArmed = false;
    $("burnWarn").hidden = true; $("mBurn").textContent = "burn entry";
    $("mFlame").innerHTML = flameDots(e.flame);
    $("mDate").textContent = fmtDate(e.ts);
    $("mTitle").textContent = e.title;
    $("mBody").textContent = e.body;
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; openedId = null; }
  listEl.addEventListener("click", function (e) {
    var li = e.target.closest("li"); if (li) openEntry(li.getAttribute("data-id"));
  });
  listEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      var li = e.target.closest("li"); if (li) { e.preventDefault(); openEntry(li.getAttribute("data-id")); }
    }
  });
  $("mClose").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  function opened() {
    for (var i = 0; i < entries.length; i++) if (entries[i].id === openedId) return entries[i];
    return null;
  }
  $("mCopy").addEventListener("click", function () { var e = opened(); if (e) copyText(entryText(e)); });
  $("mDl").addEventListener("click", function () {
    var e = opened(); if (!e) return;
    download("lantern-" + stampName(e.ts) + ".txt", entryText(e)); toast("entry exported ⇩");
  });
  $("mShare").addEventListener("click", function () {
    var e = opened(); if (!e) return;
    var link = location.href.split("#")[0] + "#ll=" + b64uEncode(JSON.stringify({ title: e.title, body: e.body, flame: e.flame, ts: e.ts }));
    copyText(link);
    try { history.replaceState(null, "", link); } catch (err) {}
    toast("share link ready — send it ◈");
  });
  $("mBurn").addEventListener("click", function () {
    burnArmed = true; $("burnWarn").hidden = false; $("mBurnYes").focus();
  });
  $("mBurnNo").addEventListener("click", function () { burnArmed = false; $("burnWarn").hidden = true; });
  $("mBurnYes").addEventListener("click", function () {
    entries = entries.filter(function (e) { return e.id !== openedId; });
    saveEntries(entries); closeModal(); render(); toast("entry burned ∴");
  });
  $("copyClose").addEventListener("click", function () { $("copyModal").hidden = true; });

  /* ---- keyboard ---- */
  document.addEventListener("keydown", function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "Enter" || e.key === "s")) { e.preventDefault(); seal(); return; }
    if (e.key === "Escape") {
      if (!$("copyModal").hidden) $("copyModal").hidden = true;
      else if (!modal.hidden) closeModal();
      return;
    }
    if ((e.key === "n" || e.key === "N") && modal.hidden && $("copyModal").hidden &&
        !/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName || "")) {
      titleEl.value = ""; bodyEl.value = ""; setFlame(3); titleEl.focus();
    }
  });

  boot(render);
})();
