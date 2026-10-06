/* HOLLOW COMPASS CARTEL — hex trade charts, fog, tide-shifted compass, seed sharing.
   Canvas only. No images. Scroll tugs the tide. */
'use strict';

const COLS = 13, ROWS = 11, HEX = 30;
const SQ3 = Math.sqrt(3);
const $ = (id) => document.getElementById(id);
const mapC = $('map'), compC = $('compass');
const mctx = mapC.getContext('2d'), cctx = compC.getContext('2d');

// ---------- seeded rng ----------
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const randSeed = () => Math.random().toString(36).slice(2, 7).toUpperCase();

// ---------- state ----------
let S = null;
function freshState(seed){
  return { seed, credits: 20, supplies: 44, ship: null, explored: {},
    routes: [], selPort: null, mode: 'sail', tide: 0.6, elapsed: 0, won: false, log: [] };
}

function save(){ try{ localStorage.setItem('hcc-save', JSON.stringify({
  seed:S.seed, credits:S.credits, supplies:S.supplies, ship:S.ship,
  explored:S.explored, routes:S.routes.map(r=>({a:r.a,b:r.b,profit:r.profit,path:r.path})), tide:S.tide, elapsed:S.elapsed })); }catch(e){} }
function load(){
  try{ const d = JSON.parse(localStorage.getItem('hcc-save') || 'null'); if(!d || !d.seed) return null;
    const s = freshState(d.seed); Object.assign(s, { credits:d.credits, supplies:d.supplies, ship:d.ship,
      explored:d.explored||{}, tide:d.tide||0, elapsed:d.elapsed||0 });
    s._pendingRoutes = d.routes||[]; return s; }catch(e){ return null; }
}

// ---------- map gen ----------
function genMap(seed){
  const rng = mulberry32(xmur3(String(seed))());
  const key = (c,r) => c+','+r;
  let e = {};
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) e[key(c,r)] = rng();
  for(let p=0;p<3;p++){ // smooth into blobby islands
    const n = {};
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      let s=e[key(c,r)], k=1;
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){ const q=c+dc,w=r+dr;
        if(q>=0&&w>=0&&q<COLS&&w<ROWS){ s+=e[key(q,w)]; k++; } }
      n[key(c,r)] = s/k;
    }
    e = n;
  }
  const cells = [];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const edge = (c===0||r===0||c===COLS-1||r===ROWS-1);
    const land = !edge && e[key(c,r)] > 0.52;
    cells.push({ c, r, land, fog: 1, port: null, depth: e[key(c,r)] });
  }
  const byK = {}; cells.forEach(h=>byK[key(h.c,h.r)]=h);
  const water = cells.filter(h=>!h.land);
  // pick 5 ports: land-adjacent water cells, spread out
  const cands = water.filter(h => neigh(h,byK).some(n=>n.land));
  // shuffle by rng
  for(let i=cands.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [cands[i],cands[j]]=[cands[j],cands[i]]; }
  const names = ['HOLLOW','VEX','MORROW','TALLOW','KETTLE'];
  const ports = [];
  for(const h of cands){
    if(ports.length>=5) break;
    if(ports.every(p => Math.abs(p.c-h.c)+Math.abs(p.r-h.r) > 4)){ h.port = names[ports.length]; ports.push(h); }
  }
  while(ports.length<3){ const h = water[Math.floor(rng()*water.length)];
    if(!h.port){ h.port = names[ports.length]; ports.push(h); } }
  return { cells, byK, ports };
}
function neigh(h, byK){
  const out=[]; const o = (h.r%2===0)
    ? [[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]]
    : [[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]];
  for(const [dc,dr] of o){ const n = byK[(h.c+dc)+','+(h.r+dr)]; if(n) out.push(n); }
  return out;
}
function hexCenter(h){ return { x: HEX*SQ3*(h.c + 0.5*(h.r&1)) + HEX*SQ3*0.6, y: HEX*1.5*h.r + HEX*1.2 }; }
function hexPath(g, x, y, s){
  g.beginPath();
  for(let i=0;i<6;i++){ const a = Math.PI/180*(60*i-30);
    const px=x+s*Math.cos(a), py=y+s*Math.sin(a); i?g.lineTo(px,py):g.moveTo(px,py); }
  g.closePath();
}
function nearestHex(px, py){
  let best=null, bd=1e9;
  for(const h of S.map.cells){ const p=hexCenter(h);
    const d=(p.x-px)**2+(p.y-py)**2; if(d<bd){bd=d;best=h;} }
  return bd < (HEX*1.1)**2 ? best : null;
}
function bfsPath(a, b){
  if(a===b) return [a];
  const prev = new Map([[a,null]]); const q=[a];
  while(q.length){ const h=q.shift();
    for(const n of neigh(h, S.map.byK)){
      if(n.land || prev.has(n)) continue;
      prev.set(n,h); if(n===b){ const path=[n]; let cur=n;
        while(prev.get(cur)){ cur=prev.get(cur); path.unshift(cur); } return path; }
      q.push(n);
    } }
  return null;
}

// ---------- fog ----------
const k2 = (h)=>h.c+','+h.r;
function revealAround(h, rad){
  for(const c of S.map.cells){
    const d = Math.abs(c.c-h.c)+Math.abs(c.r-h.r);
    if(d<=rad){ c.fog = d===0?0:Math.min(c.fog, d/ (rad+1)); S.explored[k2(c)] = 1; }
  }
}
function chartedPct(){
  const t = S.map.cells.length, n = Object.keys(S.explored).length;
  return Math.round(100*n/t);
}

// ---------- log / toast ----------
function log(msg, cls){
  const box = $('log'); const d = document.createElement('div');
  if(cls) d.className = cls; d.textContent = msg; box.prepend(d);
  while(box.children.length>40) box.lastChild.remove();
  S.log.unshift(msg); S.log = S.log.slice(0,40);
}
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2400); }
function setStatus(msg){ $('statusLine').textContent = '▸ ' + msg; }

// ---------- economy ----------
function routeProfit(path){
  const len = path.length;
  const fresh = path.filter(h=>!S.explored[k2(h)]).length;
  const tideBonus = Math.round(6*Math.abs(Math.sin(S.tide)));
  return { profit: len*9 + fresh*7 + tideBonus + 14, fresh, len };
}
function addRoute(a, b){
  if(a===b) return;
  if(S.routes.some(r=>(r.a===k2(a)&&r.b===k2(b))||(r.a===k2(b)&&r.b===k2(a)))){ toast('Route already inked.'); return; }
  const path = bfsPath(a,b);
  if(!path){ toast('No water passage — the fog keeps that toll.'); log('Dead passage sounded between '+a.port+' and '+b.port+'.','tide'); return; }
  const { profit, fresh, len } = routeProfit(path);
  S.routes.push({ a:k2(a), b:k2(b), an:a.port, bn:b.port, path:path.map(k2), profit });
  S.credits += profit;
  path.forEach(h=>{ if(!S.explored[k2(h)]){ S.explored[k2(h)]=1; h.fog=Math.min(h.fog,.25);} });
  log('Route inked: '+a.port+' → '+b.port+' · '+len+' leagues · +'+profit+'cr'+(fresh?' · '+fresh+' unknown waters':'')+'.','gold');
  toast('Route '+a.port+' → '+b.port+' · +'+profit+'cr');
  setStatus('route '+a.port+' → '+b.port+' pays '+profit+'cr. the cartel applauds.');
  renderLedger(); save(); checkWin();
}
function renderLedger(){
  const ol=$('ledger'); ol.innerHTML='';
  if(!S.routes.length){ ol.innerHTML='<li class="empty">No routes inked yet. Switch to CHART, click a lit port, then a second port.</li>'; return; }
  [...S.routes].reverse().forEach((r,i)=>{
    const li=document.createElement('li');
    li.innerHTML='<span>'+r.an+' → '+r.bn+' <span class="dim">'+r.path.length+' lg</span></span><span class="pay">+'+r.profit+'cr</span>';
    ol.appendChild(li);
  });
}
function checkWin(){
  if(!S.won && (S.credits>=400 || (S.routes.length>=4 && chartedPct()>=45))){
    S.won=true; $('winBanner').textContent='◆ CARTEL CROWN SECURED — '+S.credits+'cr';
    log('CARTEL CROWN SECURED at '+S.credits+'cr. Rivals are already forging your signature.','gold');
    toast('◆ CARTEL CROWN SECURED');
  }
}

// ---------- sailing ----------
let anim = null; // {path:[hex], i, t}
function sailTo(h){
  if(!h || h.land){ toast('Ships do not sail on rock.'); return; }
  if(h.fog>0.6 && !S.explored[k2(h)]){ toast('Too fogged — sonar or skirt the lit water.'); return; }
  const from = S.shipHex();
  const path = bfsPath(from,h);
  if(!path){ toast('No water passage.'); return; }
  if(path.length-1 > S.supplies){ toast('Not enough supplies ('+(path.length-1)+' needed).'); return; }
  anim = { path, i:0, acc:0 };
  setStatus('under way — '+(path.length-1)+' leagues to '+ (h.port?('PORT '+h.port):(h.c+','+h.r)) +'.');
}
S_shipHelper();
function S_shipHelper(){ /* bound later */ }
function stepAnim(dt){
  if(!anim) return;
  anim.acc += dt*5.2;
  while(anim.acc>=1 && anim){
    anim.acc-=1; anim.i++;
    const h = anim.path[Math.min(anim.i, anim.path.length-1)];
    S.ship = k2(h); revealAround(h,2); S.supplies=Math.max(0,S.supplies-1);
    if(h.port && !S._hailed?.[k2(h)]){ S._hailed=S._hailed||{}; S._hailed[k2(h)]=1;
      S.credits+=15; S.supplies=Math.min(60,S.supplies+6);
      log('Hailed PORT '+h.port+' · +15cr, +6 supplies.','gold'); }
    if(anim.i>=anim.path.length-1){ anim=null; log('Anchored. Charted '+chartedPct()+'% · '+S.supplies+' supplies left.');
      setStatus('anchored. fog at '+chartedPct()+'%. ink a route or sail on.'); save(); checkWin(); }
  }
}

// ---------- rendering ----------
function fitCanvas(){
  const w = mapC.parentElement.clientWidth, aspect = (HEX*SQ3*(COLS+1.4))/(HEX*1.5*ROWS+HEX*2);
  const cssW = Math.min(w, 1040), cssH = cssW/aspect;
  const dpr = Math.min(2, window.devicePixelRatio||1);
  mapC.style.height = cssH+'px'; mapC.width = cssW*dpr; mapC.height = cssH*dpr;
  mctx.setTransform(dpr,0,0,dpr,0,0);
  S._view = { w:cssW, h:cssH };
}
function scaleMap(){
  const v = S._view; if(!v) return {s:1,ox:0,oy:0};
  const needW = HEX*SQ3*(COLS+1.4), needH = HEX*1.5*ROWS+HEX*2;
  const s = Math.min(v.w/needW, v.h/needH);
  return { s, ox:(v.w-needW*s)/2, oy:(v.h-needH*s)/2 };
}
function drawMap(t){
  const g=mctx, v=S._view; if(!v) return;
  const {s,ox,oy}=scaleMap();
  g.clearRect(0,0,v.w,v.h);
  // abyss
  const bg=g.createLinearGradient(0,0,0,v.h); bg.addColorStop(0,'#07222b'); bg.addColorStop(1,'#03090c');
  g.fillStyle=bg; g.fillRect(0,0,v.w,v.h);
  const decl = Math.sin(S.tide)*24;
  const driftX = Math.sin(S.tide)*4*s, driftY = Math.cos(S.tide*0.7)*3*s;
  g.save(); g.translate(ox+driftX, oy+driftY); g.scale(s,s);
  for(const h of S.map.cells){
    const p=hexCenter(h);
    hexPath(g,p.x,p.y,HEX-1.5);
    if(h.land){ const grd=g.createLinearGradient(p.x,p.y-HEX,p.x,p.y+HEX);
      grd.addColorStop(0,'#0f3d3a'); grd.addColorStop(1,'#081d20');
      g.fillStyle=grd; g.fill();
      g.strokeStyle='rgba(0,255,200,.4)'; g.lineWidth=1.2; g.stroke();
      // island glyph: contour dot
      g.fillStyle='rgba(255,180,84,.5)';
      g.beginPath(); g.arc(p.x,p.y-6,2.2,0,7); g.fill();
    } else {
      const d = Math.max(0,Math.min(1,h.depth));
      g.fillStyle='rgba(6,'+(30+Math.round(d*30))+','+(44+Math.round(d*26))+',1)'; g.fill();
      g.strokeStyle='rgba(56,225,255,.18)'; g.lineWidth=1; g.stroke();
    }
  }
  // routes (under fog? no — routes glow above fog slightly)
  for(const r of S.routes){
    const pts = r.path.map(k=>hexCenter(S.map.byK[k]));
    g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
    g.strokeStyle='rgba(0,255,200,.85)'; g.lineWidth=3; g.lineJoin='round';
    g.shadowColor='#00ffc8'; g.shadowBlur=12; g.stroke(); g.shadowBlur=0;
    g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
    g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=1; g.stroke();
  }
  // selection
  if(S._hover && !S._hover.land){ const p=hexCenter(S._hover);
    hexPath(g,p.x,p.y,HEX-1.5); g.strokeStyle = S.mode==='chart'?'#ffb454':'#00ffc8';
    g.lineWidth=2.5; g.setLineDash([6,4]); g.stroke(); g.setLineDash([]); }
  if(S.selPort){ const p=hexCenter(S.selPort);
    hexPath(g,p.x,p.y,HEX-4); g.strokeStyle='#ffb454'; g.lineWidth=3; g.stroke(); }
  // ship (interpolated)
  let sh = S.shipHex();
  if(anim){ const a=anim.path[Math.min(anim.i,anim.path.length-1)];
    const b=anim.path[Math.min(anim.i+1,anim.path.length-1)];
    const pa=hexCenter(a), pb=hexCenter(b), f=Math.min(1,anim.acc);
    sh={__p:{x:pa.x+(pb.x-pa.x)*f, y:pa.y+(pb.y-pa.y)*f}}; }
  const sp = sh.__p || hexCenter(sh);
  // sonar rings
  if(S._sonar && t-S._sonar<900){ const k=(t-S._sonar)/900;
    g.beginPath(); g.arc(sp.x,sp.y,10+k*HEX*3,0,7); g.strokeStyle='rgba(56,225,255,'+(0.8*(1-k))+')'; g.lineWidth=2; g.stroke(); }
  // tide drift vector near ship
  g.save(); g.translate(sp.x,sp.y); g.rotate((decl)*Math.PI/180);
  g.strokeStyle='rgba(255,79,216,.7)'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(0,-HEX-8); g.lineTo(0,-HEX-18); g.moveTo(-4,-HEX-14); g.lineTo(0,-HEX-18); g.lineTo(4,-HEX-14); g.stroke();
  g.restore();
  // ship glyph: triangle + wake
  g.save(); g.translate(sp.x,sp.y);
  g.shadowColor='#00ffc8'; g.shadowBlur=16;
  g.fillStyle='#eafffa'; g.beginPath();
  g.moveTo(0,-9); g.lineTo(6,7); g.lineTo(0,3); g.lineTo(-6,7); g.closePath(); g.fill();
  g.shadowBlur=0; g.restore();
  // ports
  for(const p of S.map.ports){
    const c=hexCenter(p);
    hexPath(g,c.x,c.y,HEX-1.5); g.fillStyle='rgba(255,180,84,.14)'; g.fill();
    g.strokeStyle = (S.selPort===p)?'#ffb454':'rgba(255,180,84,.75)'; g.lineWidth=1.6; g.stroke();
    g.fillStyle='#ffb454'; g.font='bold 11px monospace'; g.textAlign='center';
    g.fillText('⚓', c.x, c.y-1);
    g.fillStyle='#ffe1ae'; g.font='8px monospace'; g.fillText(p.port, c.x, c.y+12);
  }
  // fog
  for(const h of S.map.cells){
    if(h.fog<=0.02) continue;
    const p=hexCenter(h);
    hexPath(g,p.x,p.y,HEX-1.5);
    const pulse = 0.06*Math.sin(t/700 + h.c + h.r);
    g.fillStyle='rgba(3,9,12,'+Math.min(0.94,h.fog*0.9+pulse).toFixed(3)+')'; g.fill();
    if(h.fog>0.5){ g.fillStyle='rgba(56,225,255,.10)'; g.font='9px monospace'; g.textAlign='center';
      g.fillText('?', p.x, p.y+3); }
  }
  g.restore();
  // vignette scan pulse on sonar
  if(S._sonar && t-S._sonar<900){ const k=1-(t-S._sonar)/900;
    g.fillStyle='rgba(0,255,200,'+(0.05*k)+')'; g.fillRect(0,0,v.w,v.h); }
}
function drawCompass(t){
  const g=cctx, W=220,H=220, cx=110, cy=110;
  g.clearRect(0,0,W,H);
  const decl = Math.sin(S.tide)*24;
  const tideName = Math.cos(S.tide)>0 ? 'FLOOD ▲' : 'EBB ▼';
  // rings
  g.strokeStyle='rgba(0,255,200,.5)'; g.lineWidth=2;
  g.beginPath(); g.arc(cx,cy,92,0,7); g.stroke();
  g.strokeStyle='rgba(0,255,200,.2)';
  g.beginPath(); g.arc(cx,cy,74,0,7); g.stroke();
  for(let i=0;i<72;i++){ const a=i*5*Math.PI/180, big=i%18===0;
    g.strokeStyle=big?'#00ffc8':'rgba(0,255,200,.3)'; g.lineWidth=big?2:1;
    g.beginPath(); g.moveTo(cx+Math.sin(a)*(big?78:84), cy-Math.cos(a)*(big?78:84));
    g.lineTo(cx+Math.sin(a)*90, cy-Math.cos(a)*90); g.stroke(); }
  // cardinal labels rotate with declination (the "living" lie)
  g.save(); g.translate(cx,cy); g.rotate(decl*Math.PI/180);
  g.fillStyle='#00ffc8'; g.font='bold 15px monospace'; g.textAlign='center';
  g.fillText('N',0,-58); g.fillStyle='#8fb8ad'; g.font='12px monospace';
  g.fillText('S',0,70); g.fillText('E',66,4); g.fillText('W',-66,4);
  // needle: true north (dim) vs tide needle (bright, alive)
  g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(0,40); g.lineTo(0,-50); g.stroke();
  const wob = Math.sin(t/400)*3;
  g.save(); g.rotate(wob*Math.PI/180);
  g.shadowColor='#ff4fd8'; g.shadowBlur=12;
  g.fillStyle='#ff4fd8'; g.beginPath(); g.moveTo(0,-56); g.lineTo(7,0); g.lineTo(0,-12); g.lineTo(-7,0); g.closePath(); g.fill();
  g.shadowBlur=0; g.restore();
  g.fillStyle='#04090c'; g.beginPath(); g.arc(0,0,7,0,7); g.fill();
  g.strokeStyle='#00ffc8'; g.beginPath(); g.arc(0,0,7,0,7); g.stroke();
  g.restore();
  // readouts handled in DOM
  $('declVal').textContent=(decl>=0?'+':'')+decl.toFixed(1)+'°';
  $('tideVal').textContent=tideName;
  $('tideChip').textContent='TIDE '+(decl>=0?'+':'')+decl.toFixed(1)+'°';
  const f=(Math.sin(S.tide)+1)/2;
  $('tideFill').style.width=(f*100).toFixed(1)+'%';
}

// ---------- hud ----------
function hud(){
  $('stCredits').textContent=S.credits;
  $('stSup').textContent=S.supplies;
  $('stFog').textContent=chartedPct()+'%';
  $('stRoutes').textContent=S.routes.length;
  $('seedChip').textContent='SEED '+S.seed;
  const mm=String(Math.floor(S.elapsed/60)).padStart(2,'0'), ss=String(Math.floor(S.elapsed%60)).padStart(2,'0');
  $('clockChip').textContent='T+'+mm+':'+ss;
  document.documentElement.style.setProperty('--scroll', (S._scrollP||0).toFixed(3));
}

// ---------- boot ----------
function applySeed(seed, opts={}){
  S = freshState(seed);
  S.map = genMap(seed);
  const saved = opts.saved;
  if(saved){ S.credits=saved.credits; S.supplies=saved.supplies; S.explored=saved.explored||{};
    S.tide=saved.tide; S.elapsed=saved.elapsed;
    S.ship = saved.ship && S.map.byK[saved.ship] ? saved.ship : k2(S.map.ports[0]);
    for(const k of Object.keys(S.explored)){ const h=S.map.byK[k]; if(h) h.fog = h.fog>0.9?0.35:Math.min(h.fog,0.3); }
    revealAround(S.shipHex(),2);
    for(const r of (saved._pendingRoutes||[])){ const a=S.map.byK[r.a], b=S.map.byK[r.b];
      if(a&&b){ S.routes.push({a:r.a,b:r.b,an:a.port||r.a,bn:b.port||r.b,path:r.path.filter(k=>S.map.byK[k]),profit:r.profit}); } }
  } else {
    S.ship = k2(S.map.ports[0]);
    revealAround(S.shipHex(),2);
  }
  S.shipHex = () => S.map.byK[S.ship];
  if(!opts.quiet){ log('Chart '+seed+' unrolled. ' + S.map.ports.length + ' ports sound in the fog.','gold');
    setStatus('chart '+seed+' — sail the lit water, then CHART port-to-port.'); }
  $('seedInput').value = seed;
  history.replaceState(null,'','#'+seed);
  renderLedger(); save(); fitCanvas(); hud();
  if(S.won) $('winBanner').textContent='';
}

function shareLink(){
  const url = location.href.split('#')[0] + '#' + S.seed;
  const done = ()=>toast('Rival link copied — seed '+S.seed);
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done,()=>fallback());
  else fallback();
  function fallback(){ const i=$('seedInput'); i.value=url; i.select();
    try{document.execCommand('copy');}catch(e){} i.value=S.seed; done(); }
  log('Rival link inked for seed '+S.seed+'. Let them beat '+S.credits+'cr if they can.','tide');
}

// ---------- input ----------
function canvasPos(ev){
  const r = mapC.getBoundingClientRect();
  const px = (ev.clientX-r.left), py=(ev.clientY-r.top);
  // invert scaleMap transform
  const {s,ox,oy}=scaleMap();
  // note drift offset is visual only (±few px); ignore for picking
  return { x:(px-ox)/s, y:(py-oy)/s };
}
mapC.addEventListener('mousemove', ev=>{ const p=canvasPos(ev); S._hover=nearestHex(p.x,p.y); });
mapC.addEventListener('click', ev=>{
  const p=canvasPos(ev); const h=nearestHex(p.x,p.y); if(!h) return;
  if(S.mode==='chart'){
    if(!h.port){ toast('CHART needs ports — click a ⚓.'); return; }
    if(h.fog>0.6 && !S.explored[k2(h)]){ toast('That port is still fogged. Sail closer first.'); return; }
    if(!S.selPort){ S.selPort=h; setStatus('from '+h.port+' — now click a second port.'); }
    else { const a=S.selPort; S.selPort=null; addRoute(a,h); }
    return;
  }
  sailTo(h);
});
document.querySelectorAll('.pad button[data-dx]').forEach(b=>b.addEventListener('click',()=>{
  const dx=+b.dataset.dx, dy=+b.dataset.dy;
  const cur=S.shipHex(); if(!cur) return;
  if(dx===0&&dy===0){ revealAround(cur,2); log('Hove to. Soundings taken.'); save(); return; }
  // tide shifts intent: rotate step by declination sign
  const decl = Math.sin(S.tide);
  let nc = cur.c+dx, nr = cur.r+dy;
  if(Math.abs(decl)>0.5){ nc = cur.c+dx - Math.sign(decl)*(dy!==0?1:0); }
  const n = S.map.byK[nc+','+nr];
  if(n) sailTo(n); else toast('Off the chart — the cartel ends there.');
}));
window.addEventListener('keydown', e=>{
  const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key.toLowerCase()];
  if(m){ const cur=S.shipHex(); const n=S.map.byK[(cur.c+m[0])+','+(cur.r+m[1])]; if(n) sailTo(n); }
});
$('modeSail').onclick=()=>{S.mode='sail';S.selPort=null;$('modeSail').classList.add('active');$('modeChart').classList.remove('active');
  $('modeHint').textContent='SAIL: click any lit water hex. Fog lifts as you explore. Supplies burn per league.';};
$('modeChart').onclick=()=>{S.mode='chart';$('modeChart').classList.add('active');$('modeSail').classList.remove('active');
  $('modeHint').textContent='CHART: click a lit port ⚓, then a second port. The cartel pays on delivery.';};
$('btnNew').onclick=()=>applySeed(randSeed());
$('btnShare').onclick=shareLink;
$('btnClear').onclick=()=>{ S.routes=[]; renderLedger(); save(); toast('Routes cut. The fog forgets nothing.'); };
$('btnSonar').onclick=()=>{
  if(S.supplies<4){ toast('No supplies for sonar.'); return; }
  S.supplies-=4; S._sonar=performance.now();
  revealAround(S.shipHex(),4);
  log('Sonar pulse burns 4 supplies — fog recoils.','tide'); save();
};
$('seedInput').addEventListener('change', e=>{
  const v=e.target.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  if(v) applySeed(v); else e.target.value=S.seed;
});

// ---------- scroll reacts: tide tug + reveals ----------
let lastY = window.scrollY;
window.addEventListener('scroll', ()=>{
  const y=window.scrollY, dy=y-lastY; lastY=y;
  S.tide += dy*0.0016; // scrolling drags the moon
  const max=document.documentElement.scrollHeight-innerHeight;
  S._scrollP = max>0 ? y/max : 0;
  if(Math.abs(dy)>2 && Math.random()<0.02) log('The tide slips '+(dy>0?'floodward':'ebbward')+' under your scroll.','tide');
},{passive:true});
const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); }),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// ---------- main loop ----------
let last=performance.now();
function frame(t){
  const dt=Math.min(.05,(t-last)/1000); last=t;
  S.elapsed+=dt; S.tide+=dt*0.12; // living tide
  stepAnim(dt);
  drawMap(t); drawCompass(t);
  if(!frame._n) frame._n=0; if(++frame._n%30===0) hud();
  requestAnimationFrame(frame);
}
window.addEventListener('resize', fitCanvas);

// init: hash seed > saved > fresh
(function init(){
  const hash=(location.hash||'').replace('#','').toUpperCase().slice(0,8);
  const saved=load();
  if(hash) applySeed(hash);
  else if(saved && saved.seed) applySeed(saved.seed,{saved});
  else applySeed(randSeed());
  log('Scroll the page — the tide obeys your thumb. Arrow keys helm the ship.');
  requestAnimationFrame(frame);
})();
