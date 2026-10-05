// Sable Meridian Outpost — async hex conquest. No deps. localStorage only.
"use strict";

const $ = (id) => document.getElementById(id);
const LS_KEY = "smo-season-v1";
const CLAIMS_PER_DAY = 3;
const RADIUS = 3; // 37 tiles
const INK = "#0E0D0B", SAND = "#E3D5B8", RUST = "#C75B39", SAGE = "#7E8F7B";

// Axial neighbours
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const key = (q,r) => `${q},${r}`;
const neighbors = (q,r) => DIRS.map(([dq,dr]) => key(q+dq, r+dr));

// Deterministic RNG (mulberry32) so every season's map is stable
function rng(seed){ let a = seed >>> 0; return () => { a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

function allTiles(){
  const out = [];
  for(let q=-RADIUS; q<=RADIUS; q++)
    for(let r=Math.max(-RADIUS,-q-RADIUS); r<=Math.min(RADIUS,-q+RADIUS); r++)
      out.push({q, r});
  return out;
}

// ---- state ----
function newSeason(){
  const rand = rng((Date.now()%2147483647) || 7);
  const tiles = {};
  for(const {q,r} of allTiles()){
    const dist = (Math.abs(q)+Math.abs(r)+Math.abs(-q-r))/2;
    // depots: home (you) + two rival outposts
    let depot = null;
    if(q===0&&r===3) depot = "you";
    if(q===-3&&r===0) depot = "vesper";
    if(q===3&&r===-3) depot = "halcyon";
    tiles[key(q,r)] = {
      owner: depot,                 // 'you' | 'vesper' | 'halcyon' | null
      depot,                        // depot marker or null
      yield: 1 + Math.floor(rand()*3), // 1..3 trade value
      seen: !!depot || dist <= 1 && false, // visibility computed below
      scouted: false,
    };
  }
  const s = { day:1, claimsLeft:CLAIMS_PER_DAY, tiles, log:[`Season charted. Home depot raised at 0,3.`], hotseat:false, winner:null };
  computeFog(s);
  // home depot + its ring start visible
  return s;
}

function computeFog(s){
  const visible = new Set();
  for(const [k,t] of Object.entries(s.tiles)){
    if(t.owner){
      visible.add(k);
      const [q,r] = k.split(",").map(Number);
      for(const n of neighbors(q,r)) if(s.tiles[n]) visible.add(n);
    }
    if(t.scouted) visible.add(k);
  }
  for(const [k,t] of Object.entries(s.tiles)) t.seen = visible.has(k);
}

function save(s){ try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch{} }
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s.tiles || !s.day) return null;
    return s;
  }catch{ return null; }
}

// ---- scoring ----
function counts(s){
  const c = { you:0, vesper:0, halcyon:0 };
  for(const t of Object.values(s.tiles)) if(t.owner) c[t.owner]++;
  return c;
}

// Longest contiguous chain of `who` tiles (BFS diameter approx: BFS from each depot/end is overkill;
// board is tiny — do BFS-longest via DFS with pruning, capped).
function longestRoute(s, who){
  const owned = new Set(Object.entries(s.tiles).filter(([,t])=>t.owner===who).map(([k])=>k));
  if(owned.size === 0) return { len:0, value:0 };
  let best = { len:0, value:0 };
  for(const start of owned){
    // DFS longest simple path, depth-cap for perf (board tiny anyway)
    const stack = [{ k:start, path:[start], val:s.tiles[start].yield }];
    const seenPaths = new Set();
    let iter = 0;
    while(stack.length && iter++ < 4000){
      const cur = stack.pop();
      const [q,r] = cur.k.split(",").map(Number);
      if(cur.path.length > best.len || (cur.path.length===best.len && cur.val>best.value))
        best = { len:cur.path.length, value:cur.val };
      if(cur.path.length >= 12) continue;
      for(const n of neighbors(q,r)){
        if(!owned.has(n) || cur.path.includes(n)) continue;
        const sig = cur.k+">"+n;
        if(seenPaths.has(sig)) continue;
        seenPaths.add(sig);
        stack.push({ k:n, path:[...cur.path,n], val:cur.val + s.tiles[n].yield });
      }
    }
  }
  return best;
}

function score(s, who){
  const c = counts(s);
  const route = longestRoute(s, who);
  const depotsHeld = Object.values(s.tiles).filter(t=>t.depot===who&&t.owner===who).length
    + Object.values(s.tiles).filter(t=>t.depot&&t.depot!==who&&t.owner===who).length*2; // capturing a depot = 2
  const territory = c[who]*2 + Object.values(s.tiles).filter(t=>t.owner===who).reduce((a,t)=>a+t.yield,0);
  const routePts = route.len>=2 ? route.value*2 + route.len : 0;
  return { territory, routePts, depotsHeld, total: territory+routePts+depotsHeld*3, route, count:c[who] };
}

// ---- rivals (async simulated) ----
const RIVALS = [
  { id:"vesper", name:"Vesper", note:"patient · expands along high yield" },
  { id:"halcyon", name:"Halcyon", note:"erratic · strikes toward you" },
];

function rivalMove(s, who){
  // frontier: unowned tiles adjacent to rival's land
  const owned = new Set(Object.entries(s.tiles).filter(([,t])=>t.owner===who).map(([k])=>k));
  const cands = new Map();
  for(const k of owned){
    const [q,r] = k.split(",").map(Number);
    for(const n of neighbors(q,r)){
      const t = s.tiles[n];
      if(!t || t.owner) continue;
      // Halcyon prefers tiles near player; Vesper prefers high yield
      let w = t.yield + Math.random()*1.5;
      if(who==="halcyon"){
        const nearYou = neighbors(...n.split(",").map(Number)).some(m=>s.tiles[m]?.owner==="you");
        if(nearYou) w += 2;
      }
      if(!cands.has(n) || cands.get(n) < w) cands.set(n, w);
    }
  }
  if(cands.size===0) return null;
  const pick = [...cands.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  const t = s.tiles[pick];
  const stole = false;
  t.owner = who;
  return pick;
}

// ---- rendering ----
const svg = $("board");
const HEX_R = 30;
const SQ3 = Math.sqrt(3);
function center(q,r){ return [HEX_R*SQ3*(q + r/2), HEX_R*1.5*r]; }
function points(cx,cy){
  // pointy-top
  const p = [];
  for(let i=0;i<6;i++){
    const a = Math.PI/180*(60*i - 30);
    p.push(`${(cx+ (HEX_R-2)*Math.cos(a)).toFixed(1)},${(cy+(HEX_R-2)*Math.sin(a)).toFixed(1)}`);
  }
  return p.join(" ");
}

let state = load() || newSeason();
let scoutMode = false;
save(state);

function claimable(k){
  const t = state.tiles[k];
  if(!t || t.owner || !t.seen) return false;
  if(state.claimsLeft<=0) return false;
  const [q,r] = k.split(",").map(Number);
  // must border your land, or be scouted-adjacent (scouted counts as reachable)
  return neighbors(q,r).some(n => state.tiles[n]?.owner==="you" || state.tiles[n]?.scouted);
}

function render(){
  computeFog(state);
  const mine = score(state,"you");
  $("hudDay").textContent = String(state.day).padStart(2,"0");
  $("hudClaims").textContent = state.claimsLeft;
  $("hudYou").textContent = counts(state).you;
  $("hudRoute").textContent = mine.route.len;
  $("hudScore").textContent = mine.total;

  // board
  svg.innerHTML = "";
  const NS = "http://www.w3.org/2000/svg";
  for(const [k,t] of Object.entries(state.tiles)){
    const [q,r] = k.split(",").map(Number);
    const [cx,cy] = center(q,r);
    const g = document.createElementNS(NS,"g");
    g.setAttribute("class","hex");
    g.dataset.k = k;

    const poly = document.createElementNS(NS,"polygon");
    poly.setAttribute("points", points(cx,cy));

    if(!t.seen){
      poly.setAttribute("fill","transparent");
      poly.setAttribute("stroke","rgba(255,255,255,.10)");
      poly.setAttribute("stroke-dasharray","3 4");
      g.appendChild(poly);
      const tx = document.createElementNS(NS,"text");
      tx.setAttribute("x",cx); tx.setAttribute("y",cy+4);
      tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-size","11");
      tx.setAttribute("fill","rgba(255,255,255,.22)");
      tx.textContent = "?";
      g.appendChild(tx);
      g.style.cursor = "default";
    } else if(t.owner==="you"){
      poly.setAttribute("fill", t.depot==="you" ? RUST : "rgba(199,91,57,.28)");
      poly.setAttribute("stroke", RUST);
      g.classList.add("claimed-you");
      g.appendChild(poly);
      if(t.depot){ dot(g,NS,cx,cy-9,RUST); }
      yieldMarks(g,NS,cx,cy,t,SAND);
      if(t.depot) label(g,NS,cx,cy+16,"HOME");
    } else if(t.owner==="vesper"||t.owner==="halcyon"){
      poly.setAttribute("fill","rgba(126,143,123,.30)");
      poly.setAttribute("stroke",SAGE);
      g.appendChild(poly);
      yieldMarks(g,NS,cx,cy,t,"rgba(255,255,255,.55)");
      if(t.depot) label(g,NS,cx,cy+16,t.owner.toUpperCase().slice(0,3));
    } else {
      const can = claimable(k);
      poly.setAttribute("fill", can ? "rgba(227,213,184,.16)" : "transparent");
      poly.setAttribute("stroke", can ? SAND : "rgba(255,255,255,.22)");
      poly.setAttribute("stroke-dasharray", can ? "" : "3 4");
      if(can) g.classList.add("claimable");
      g.appendChild(poly);
      if(t.scouted) yieldMarks(g,NS,cx,cy,t,SAND);
      else {
        const tx = document.createElementNS(NS,"text");
        tx.setAttribute("x",cx); tx.setAttribute("y",cy+4);
        tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-size","10");
        tx.setAttribute("fill", can ? SAND : "rgba(255,255,255,.25)");
        tx.textContent = can ? "+" : "·";
        g.appendChild(tx);
      }
    }
    g.addEventListener("click", () => onHex(k));
    svg.appendChild(g);
  }

  // score panel
  const v = score(state,"vesper"), h = score(state,"halcyon");
  $("scoreBody").innerHTML =
    scoreRow("Territory (tiles × 2 + yields)", mine.territory) +
    scoreRow(`Trade route — longest chain ${mine.route.len} hex · value ${mine.route.value}`, mine.routePts) +
    scoreRow("Depots held × 3", mine.depotsHeld*3) +
    `<div class="score-line total"><span>Your total</span><b>${mine.total}</b></div>
     <p class="route-note">Routes pay only for chains of 2+ connected hexes. Captured rival depots count double. Vesper ${v.total} · Halcyon ${h.total}.</p>`;

  // rivals
  $("rivalList").innerHTML =
    rivalRow("you","You (rust)", counts(state).you, mine.total) +
    RIVALS.map(rv => rivalRow(rv.id, rv.name+" — "+rv.note, counts(state)[rv.id], score(state,rv.id).total)).join("");

  // log
  $("log").innerHTML = state.log.slice(0,14).map(l=>`<li>${escapeHtml(l)}</li>`).join("");

  $("btnEndDay").disabled = state.claimsLeft>0 && !allBlocked();
  $("hint").textContent = hintText();
  $("hint").classList.toggle("calm", scoutMode);
}

function rivalRow(id,name,n,pts){
  return `<li><span class="pip ${id}"></span><span>${escapeHtml(name)}</span><span class="n">${n} · ${pts}</span></li>`;
}
function scoreRow(k,v){ return `<div class="score-line"><span>${escapeHtml(k)}</span><b>${v}</b></div>`; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function dot(g,NS,cx,cy,fill){ const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",cx); c.setAttribute("cy",cy); c.setAttribute("r",3); c.setAttribute("fill",fill); g.appendChild(c); }
function label(g,NS,cx,cy,txt){ const t=document.createElementNS(NS,"text"); t.setAttribute("x",cx); t.setAttribute("y",cy); t.setAttribute("text-anchor","middle"); t.setAttribute("font-size","7.5"); t.setAttribute("letter-spacing","1.5"); t.setAttribute("fill","rgba(255,255,255,.6)"); t.textContent=txt; g.appendChild(t); }
function yieldMarks(g,NS,cx,cy,t,color){
  for(let i=0;i<t.yield;i++){
    const c = document.createElementNS(NS,"circle");
    c.setAttribute("cx", cx + (i-(t.yield-1)/2)*8); c.setAttribute("cy", cy+7);
    c.setAttribute("r",1.8); c.setAttribute("fill",color);
    g.appendChild(c);
  }
}

function hintText(){
  if(state.winner) return state.winner;
  if(scoutMode) return "Scout mode — tap a “?” hex touching your sight to reveal its yield for free.";
  if(state.claimsLeft<=0) return "Out of claims. End the day — rivals will move overnight.";
  if(allBlocked()) return "No reachable hexes. Scout outward or end the day.";
  return `Day ${state.day} — ${state.claimsLeft} claim${state.claimsLeft>1?"s":""} left. Glowing hexes border your land.`;
}
function allBlocked(){
  return !Object.keys(state.tiles).some(claimable);
}

// ---- actions ----
function log(msg){ state.log.unshift(`D${state.day} — ${msg}`); state.log = state.log.slice(0,40); }

function onHex(k){
  const t = state.tiles[k];
  if(!t) return;
  if(!t.seen){
    if(scoutMode){ t.scouted = true; computeFog(state); log(`Scouted ${k} — yield ${t.yield}.`); save(state); render(); }
    else flash("That hex is still fog. Enable Scout, or claim beside your land.");
    return;
  }
  if(t.owner){ flash(t.owner==="you" ? "Yours. Chains of 2+ score trade routes." : `Held by ${t.owner}. Claim around them, not through.`); return; }
  if(scoutMode){ t.scouted = true; t.seen = true; log(`Scouted ${k} — yield ${t.yield}.`); save(state); render(); return; }
  if(state.claimsLeft<=0){ flash("No claims left today. End the day."); return; }
  if(!claimable(k)){ flash("Too far — claim a hex touching your territory first."); return; }
  t.owner = "you"; t.scouted = true;
  state.claimsLeft--;
  log(`Claimed ${k} (yield ${t.yield}).`);
  checkWin();
  save(state); render();
}

let flashTimer = 0;
function flash(msg){
  $("hint").textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(render, 2200);
}

function endDay(){
  const moves = [];
  for(const rv of RIVALS){
    const m = rivalMove(state, rv.id);
    if(m) moves.push(`${rv.name} took ${m}`);
  }
  computeFog(state);
  state.day++;
  state.claimsLeft = CLAIMS_PER_DAY;
  log(moves.length ? `Night passes. ${moves.join("; ")}.` : "Night passes. Rivals found no ground.");
  checkWin();
  save(state);
  // day transition veil
  $("dayVeilText").textContent = "DAY " + String(state.day).padStart(2,"0");
  $("dayVeil").classList.add("show");
  setTimeout(()=>$("dayVeil").classList.remove("show"), 750);
  render();
}

function checkWin(){
  const c = counts(state);
  const total = c.you + c.vesper + c.halcyon;
  if(total >= 30 || state.day > 24){
    const scores = { you:score(state,"you").total, vesper:score(state,"vesper").total, halcyon:score(state,"halcyon").total };
    const win = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
    state.winner = win==="you" ? `Season closed on day ${state.day} — you hold the meridian with ${scores.you} pts.` : `Season closed — ${win} takes the meridian (${scores[win]} pts vs your ${scores.you}). Reset to try again.`;
    log(state.winner);
  }
}

// ---- async: share-link + hot-seat ----
function encodeState(){
  const lite = { d:state.day, c:state.claimsLeft, t:Object.entries(state.tiles).map(([k,t])=>[k,t.owner?1:0,t.owner||"",t.scouted?1:0,t.yield]) };
  return "smo1." + btoa(unescape(encodeURIComponent(JSON.stringify(lite)))).replace(/=+$/,"");
}
function decodeState(str){
  const raw = str.trim().replace(/^smo1\./,"");
  const lite = JSON.parse(decodeURIComponent(escape(atob(raw))));
  const base = newSeason();
  base.day = lite.d; base.claimsLeft = lite.c;
  for(const [k,owned,owner,sc,y] of lite.t){
    if(base.tiles[k]){ base.tiles[k].owner = owned?owner:null; base.tiles[k].scouted = !!sc; base.tiles[k].yield = y; }
  }
  // depots re-asserted
  base.tiles["0,3"].owner = base.tiles["0,3"].owner || "you";
  computeFog(base); base.log = [`Rival map loaded (day ${base.day}).`]; base.winner = null;
  return base;
}

$("btnEndDay").addEventListener("click", endDay);
$("btnScoutMode").addEventListener("click", (e)=>{
  scoutMode = !scoutMode;
  e.currentTarget.textContent = `Scout: ${scoutMode?"on":"off"}`;
  e.currentTarget.setAttribute("aria-pressed", String(scoutMode));
  render();
});
$("btnCopyLink").addEventListener("click", async ()=>{
  const code = encodeState();
  const url = `${location.origin}${location.pathname}#${code}`;
  try{ await navigator.clipboard.writeText(url); $("hotseatMsg").textContent = "Rival link copied — a friend opening it loads your exact map and plays on."; }
  catch{ $("linkBox").value = url; $("hotseatMsg").textContent = "Clipboard blocked — link placed in the box above. Copy it manually."; }
});
$("btnLoadLink").addEventListener("click", ()=>{
  try{
    const v = $("linkBox").value.includes("#") ? $("linkBox").value.split("#")[1] : $("linkBox").value;
    state = decodeState(v); save(state); render();
    $("hotseatMsg").textContent = "Rival map loaded. Your claims continue from here — truly async.";
  }catch{ $("hotseatMsg").textContent = "That link didn't parse. Check it starts with smo1."; }
});
$("btnHotseat").addEventListener("click", ()=>{
  state.hotseat = !state.hotseat;
  $("hotseatMsg").textContent = state.hotseat
    ? "Hot-seat on: hand the device over — your friend plays Vesper's next expansion as their own claims, then hand back."
    : "Hot-seat off.";
});
$("btnReset").addEventListener("click", ()=>{
  if(!confirm("Reset the season? The map is re-charted.")) return;
  state = newSeason(); scoutMode = false;
  $("btnScoutMode").textContent = "Scout: off";
  save(state); render();
});

// deep-link load
if(location.hash && location.hash.includes("smo1.")){
  try{ state = decodeState(location.hash.slice(1)); save(state); }catch{}
}

render();
console.log("sable-meridian-outpost ready");
