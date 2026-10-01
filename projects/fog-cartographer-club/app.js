// Fog Cartographer Club — procedural fog-grid islands, drag-claim, A* routes, seeded daily share.
const W = 28, H = 18;
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const seedInput = $('seedInput'), shareMsg = $('shareMsg'), toast = $('toast');

// ---------- seeded RNG ----------
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function rngFrom(seed){const f=xmur3(String(seed));return mulberry32(f());}
const dailySeed = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function seedFromURL(){const m=location.hash.match(/seed=([^&]+)/);return m?decodeURIComponent(m[1]).slice(0,24):null;}

// ---------- state ----------
let SEED = seedFromURL() || dailySeed();
let elev, terrain, fog, revealed, claimed, harbors, routes, ink, fame, mode='claim', routeStart=null, tide=0, time=0;
let krakenUsed=false;

const storeKey = () => 'fcc-'+SEED;
function save(){try{localStorage.setItem(storeKey(),JSON.stringify({claimed,routes,ink,fame,revealed}));}catch(e){}}
function load(){try{const s=JSON.parse(localStorage.getItem(storeKey())||'null');if(s){claimed=s.claimed;routes=s.routes||[];ink=s.ink??30;fame=s.fame??0;revealed=s.revealed;return true;}}catch(e){}return false;}

// ---------- map gen ----------
function genMap(seed){
  const rnd = rngFrom('map:'+seed);
  // value-noise lattice
  const gw=8, gh=6, lat=[];
  for(let y=0;y<=gh;y++){lat[y]=[];for(let x=0;x<=gw;x++)lat[y][x]=rnd();}
  const blobs = 3+Math.floor(rnd()*2);
  const cx=[], cy=[];
  for(let i=0;i<blobs;i++){cx.push(4+rnd()*(W-8)); cy.push(3+rnd()*(H-6));}
  elev=[]; terrain=[]; fog=[]; revealed=[]; claimed=[]; harbors=[];
  for(let y=0;y<H;y++){elev[y]=[];terrain[y]=[];fog[y]=[];revealed[y]=[];claimed[y]=[];
    for(let x=0;x<W;x++){
      const fx=x/(W-1)*gw, fy=y/(H-1)*gh;
      const x0=Math.floor(fx), y0=Math.floor(fy), tx=fx-x0, ty=fy-y0;
      const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
      const n=lat[y0][x0]*(1-sx)*(1-sy)+lat[y0][Math.min(x0+1,gw)]*sx*(1-sy)+lat[Math.min(y0+1,gh)][x0]*(1-sx)*sy+lat[Math.min(y0+1,gh)][Math.min(x0+1,gw)]*sx*sy;
      let m=0; for(let i=0;i<blobs;i++){const dx=(x-cx[i])/7, dy=(y-cy[i])/5; m=Math.max(m,Math.exp(-(dx*dx+dy*dy)*2.2));}
      const e = n*0.45 + m*0.75 - 0.28;
      elev[y][x]=e;
      terrain[y][x] = e<0.02?'deep':e<0.10?'water':e<0.16?'sand':e<0.34?'grass':e<0.46?'forest':'peak';
      fog[y][x]=1; revealed[y][x]=0; claimed[y][x]=0;
    }
  }
  // harbours: coastal sand/grass adjacent to water
  const rnd2 = rngFrom('harb:'+seed);
  const cands=[];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
    if(terrain[y][x]==='sand'||terrain[y][x]==='grass'){
      let water=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const t=terrain[y+dy][x+dx];if(t==='water'||t==='deep')water=true;}
      if(water)cands.push([x,y]);
    }
  }
  const nh=Math.min(5,Math.max(3,cands.length));
  for(let i=0;i<nh && cands.length;i++){const k=Math.floor(rnd2()*cands.length);const [hx,hy]=cands.splice(k,1)[0];harbors.push({x:hx,y:hy});burst(hx,hy,3);}
  if(!harbors.length){harbors.push({x:2,y:2});burst(2,2,3);}
  function burst(bx,by,r){for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(Math.hypot(x-bx,y-by)<=r){revealed[y][x]=1;fog[y][x]=Math.max(0,1-Math.hypot(x-bx,y-by)/r*0.9);}}}
  ink=30; fame=0; routes=[];
}
function landAt(x,y){return x>=0&&y>=0&&x<W&&y<H;}
const isLand=(x,y)=>landAt(x,y)&&['sand','grass','forest'].includes(terrain[y][x]);

// ---------- pathfinder (A*) ----------
function passable(x,y){if(!landAt(x,y))return false;const t=terrain[y][x];return t!=='peak'&&t!=='deep';}
function moveCost(x,y){const t=terrain[y][x];if(t==='water')return 3;if(t==='sand')return 1.4;if(t==='forest')return 2;return 1;}
function findRoute(a,b){
  const K=(x,y)=>y*W+x, open=[[0,a.x,a.y]], gS={[K(a.x,a.y)]:0}, came={};
  const h=(x,y)=>Math.abs(x-b.x)+Math.abs(y-b.y);
  const closed=new Set();
  while(open.length){
    open.sort((p,q)=>p[0]-q[0]);
    const [,x,y]=open.shift(); const k=K(x,y);
    if(closed.has(k))continue; closed.add(k);
    if(x===b.x&&y===b.y){const path=[[x,y]];let c=k;while(came[c]!==undefined){const px=came[c]%W, py=(came[c]-px)/W;path.unshift([px,py]);c=came[c];}return path;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(!passable(nx,ny))continue;
      const nk=K(nx,ny), ng=gS[k]+moveCost(nx,ny);
      if(gS[nk]===undefined||ng<gS[nk]){gS[nk]=ng;came[nk]=k;open.push([ng+h(nx,ny),nx,ny]);}
    }
  }
  return null;
}
function scoreRoute(path,a,b){
  if(!path)return 0;
  let pts=Math.max(0,Math.round(120-path.length*3));
  let fogCross=0, hops=0, prevIsle=null;
  const isle=id=>{ // island id by flood region approx: quantize
    return null;
  };
  let waterTiles=0;
  for(const [x,y] of path){ if(terrain[y][x]==='water')waterTiles++; if(fog[y][x]>0.5)fogCross++; }
  const aH=harbors.some(h=>h.x===a.x&&h.y===a.y), bH=harbors.some(h=>h.x===b.x&&h.y===b.y);
  if(aH&&bH)pts+=60;
  if(claimed[a.y][a.x]&&claimed[b.y][b.x])pts+=25;
  pts+=Math.min(80,fogCross*4);
  pts+=Math.min(40,Math.round(waterTiles*2));
  if(path.length>14)pts+=20; // long haul bonus
  void hops; void prevIsle; void isle;
  return Math.max(10,pts);
}

// ---------- interaction ----------
function tileFromEvent(e){
  const r=canvas.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width*canvas.width, py=(e.clientY-r.top)/r.height*canvas.height;
  const t=canvas.width/W;
  return {x:Math.floor(px/t), y:Math.floor(py/(canvas.height/H))};
}
let dragging=false, dragErase=false;
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);
  const {x,y}=tileFromEvent(e);
  if(mode==='route'){tapRoute(x,y);return;}
  dragging=true; dragErase=(mode==='erase'||e.button===2);
  paint(x,y,dragErase);
});
canvas.addEventListener('pointermove',e=>{if(!dragging||mode==='route')return;const {x,y}=tileFromEvent(e);paint(x,y,dragErase);});
addEventListener('pointerup',()=>{dragging=false;save();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function paint(x,y,erase){
  if(!landAt(x,y))return;
  if(revealed[y][x]<1){reveal(x,y,1.6);toastMsg('sounding fog… +ink'); }
  if(erase){if(claimed[y][x]){claimed[y][x]=0;ink=Math.min(99,ink+0.5);updateHUD();draw();}return;}
  if(!isLand(x,y)){toastMsg(terrain[y][x]==='peak'?'peaks refuse the stamp':'the sea cannot be owned');return;}
  if(claimed[y][x]||ink<1){if(ink<1)toastMsg('out of ink — map fog or scrape claims');return;}
  claimed[y][x]=1; ink-=1; reveal(x,y,1.2);
  updateHUD(); draw(); save();
}
function reveal(cx,cy,r){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=Math.hypot(x-cx,y-cy);if(d<=r){revealed[y][x]=1;fog[y][x]=Math.max(0,fog[y][x]-(1-d/r));}}
  ink=Math.min(99,ink+0.4); updateHUD();
}
function tapRoute(x,y){
  if(!landAt(x,y)||!passable(x,y)){toastMsg('no footing there');return;}
  if(revealed[y][x]<1)reveal(x,y,1.5);
  if(!routeStart){routeStart={x,y};toastMsg(`from (${x},${y}) — tap destination`);draw();return;}
  const dest={x,y};
  const path=findRoute(routeStart,dest);
  if(!path){toastMsg('no passage — reef blocks the way');routeStart=null;draw();return;}
  const pts=scoreRoute(path,routeStart,{x,y});
  routes.push({a:{...routeStart},b:{x,y},path,pts});
  fame+=pts; routeStart=null;
  $('routeReadout').textContent=`last run +${pts} fame · ${path.length} leagues`;
  renderLedger(); updateHUD(); draw(); save();
  toastMsg(`route logged +${pts} fame`);
}

// ---------- rendering ----------
const COL={deep:'#101d1b',water:'#1d3230',sand:'#b99a5e',grass:'#5f7040',forest:'#3c4f31',peak:'#8d8674'};
function draw(){
  const t=canvas.width/W, th=canvas.height/H;
  const rnd=rngFrom('speck:'+SEED);
  const specks=[];for(let i=0;i<260;i++)specks.push([rnd()*canvas.width,rnd()*canvas.height,rnd()]);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const px=x*t, py=y*th;
    ctx.fillStyle=COL[terrain[y][x]];ctx.fillRect(px,py,t+0.5,th+0.5);
    // shoreline shading
    if(terrain[y][x]==='sand'||terrain[y][x]==='grass'){ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(px,py+th-2,t,2);}
    if(terrain[y][x]==='peak'){ctx.fillStyle='#5d574a';ctx.beginPath();ctx.moveTo(px+t*0.2,py+th*0.85);ctx.lineTo(px+t*0.5,py+th*0.2);ctx.lineTo(px+t*0.8,py+th*0.85);ctx.closePath();ctx.fill();ctx.fillStyle='#e8dcc0';ctx.fillRect(px+t*0.44,py+th*0.28,t*0.12,th*0.12);}
    if(terrain[y][x]==='forest'){ctx.fillStyle='rgba(20,30,18,.7)';ctx.beginPath();ctx.arc(px+t*0.35,py+th*0.55,t*0.14,0,7);ctx.arc(px+t*0.65,py+th*0.45,t*0.16,0,7);ctx.fill();}
    if(terrain[y][x]==='water'||terrain[y][x]==='deep'){ctx.strokeStyle='rgba(127,179,201,.16)';ctx.beginPath();ctx.moveTo(px+3,py+th/2+((x*7+y*3)%5));ctx.lineTo(px+t-3,py+th/2+((x*7+y*3)%5));ctx.stroke();}
    // grid
    ctx.strokeStyle='rgba(0,0,0,.22)';ctx.strokeRect(px+0.5,py+0.5,t-1,th-1);
    // claim stamp: red hatch + border
    if(claimed[y][x]){
      ctx.fillStyle='rgba(192,57,43,.34)';ctx.fillRect(px,py,t,th);
      ctx.strokeStyle='rgba(231,76,60,.85)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px+2,py+th-2);ctx.lineTo(px+t-2,py+2);ctx.stroke();
      ctx.strokeStyle='rgba(231,76,60,.5)';ctx.strokeRect(px+1.5,py+1.5,t-3,th-3);
      ctx.lineWidth=1;
    }
    // harbour
    if(harbors.some(h=>h.x===x&&h.y===y)){
      ctx.fillStyle='#0e0b08';ctx.beginPath();ctx.arc(px+t/2,py+th/2,Math.min(t,th)*0.3,0,7);ctx.fill();
      ctx.fillStyle='#d9a441';ctx.font=`${Math.floor(th*0.5)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('⚓',px+t/2,py+th/2+1);
    }
    // fog with scroll-drift + animated shimmer
    const drift=Math.sin((x*0.7+tide*4)+time*0.8)*0.06+Math.cos((y*0.5-tide*3)+time*0.6)*0.06;
    let f=fog[y][x]+drift+tide*0.12*((elev[y][x]<0.16)?1:0.25);
    f=Math.max(0,Math.min(1,f));
    if(f>0.02){
      ctx.fillStyle=`rgba(154,163,155,${(f*0.88).toFixed(3)})`;
      ctx.fillRect(px,py,t,th);
      if(f>0.4){ctx.fillStyle='rgba(232,220,192,.5)';ctx.font=`${Math.floor(th*0.42)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('≈',px+t/2,py+th/2);}
    }
  }
  // routes
  routes.forEach((r,i)=>{
    ctx.strokeStyle=i===routes.length-1?'#e8c85a':'rgba(217,164,65,.55)';
    ctx.lineWidth=i===routes.length-1?3:2;ctx.setLineDash([8,5]);
    ctx.beginPath();
    r.path.forEach(([x,y],j)=>{const cx=x*t+t/2, cy=y*th+th/2;j?ctx.lineTo(cx,cy):ctx.moveTo(cx,cy);});
    ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;
    const [ex,ey]=r.path[r.path.length-1];
    ctx.fillStyle='#e8c85a';ctx.beginPath();ctx.arc(ex*t+t/2,ey*th+th/2,5,0,7);ctx.fill();
    ctx.fillStyle='#000';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),ex*t+t/2,ey*th+th/2);
  });
  if(routeStart){
    ctx.strokeStyle='#e8c85a';ctx.lineWidth=2;
    ctx.strokeRect(routeStart.x*t+2,routeStart.y*th+2,t-4,th-4);ctx.lineWidth=1;
  }
  // speck grime
  ctx.fillStyle='rgba(0,0,0,.25)';
  specks.forEach(([sx,sy])=>{if((sx+sy+time*3)%7<0.4)ctx.fillRect(sx,sy,2,2);});
}

// ---------- HUD / ledger ----------
function claimCount(){let n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)n+=claimed[y][x]?1:0;return n;}
function landCount(){let n=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(isLand(x,y))n++;return n;}
function updateHUD(){
  const c=claimCount(), land=Math.max(1,landCount());
  $('inkVal').textContent=Math.floor(ink);$('inkBar').style.width=Math.min(100,ink)+'%';
  $('claimVal').textContent=c;$('claimBar').style.width=(c/land*100)+'%';
  $('fameVal').textContent=fame;$('fameBar').style.width=Math.min(100,fame/8)+'%';
}
function renderLedger(){
  const ol=$('routeList');$('routeCount').textContent=routes.length;
  if(!routes.length){ol.innerHTML='<li class="empty">No routes yet. Switch to <b>⟿ ROUTE</b>, tap two harbours or claimed tiles.</li>';return;}
  ol.innerHTML='';
  routes.forEach((r,i)=>{
    const li=document.createElement('li');
    li.innerHTML=`<button data-i="${i}" title="strike">✕</button><b>#${i+1}</b> (${r.a.x},${r.a.y}) → (${r.b.x},${r.b.y}) · ${r.path.length} leagues · <span class="pts">+${r.pts}</span>`;
    ol.appendChild(li);
  });
  ol.querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;fame-=routes[i].pts;routes.splice(i,1);renderLedger();updateHUD();draw();save();});
}
let toastT=null;
function toastMsg(m){toast.textContent=m;toast.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>toast.classList.remove('show'),1800);}

// ---------- modes / buttons ----------
function setMode(m){
  mode=m;
  for(const [id,mm] of [['modeClaim','claim'],['modeRoute','route'],['modeErase','erase']]){
    $(id).classList.toggle('active',mm===m);$(id).setAttribute('aria-selected',mm===m);
  }
  $('modeHint').innerHTML=m==='route'
    ?'Tap a <b>start tile</b>, then a <b>destination</b> — the Club plots the cheapest passage and pays fame.'
    :m==='erase'?'Drag over your stamps to <b>scrape them off</b> (refunds a little ink). Right-drag works in any mode.'
    :'Drag across <b>revealed land</b> to stamp your claim. Ink refills as you map fog.';
  routeStart=null;draw();
}
$('modeClaim').onclick=()=>setMode('claim');
$('modeRoute').onclick=()=>setMode('route');
$('modeErase').onclick=()=>setMode('erase');
$('clearRoutes').onclick=()=>{if(!routes.length)return;if(confirm('Burn the whole ledger? Fame resets.')){routes=[];fame=0;renderLedger();updateHUD();draw();save();}};
$('sonarBtn').onclick=()=>{
  if(ink<5){toastMsg('sonar needs 5 ink');return;}
  ink-=5;
  const rnd=rngFrom('sonar:'+SEED+Date.now()%997);
  for(let i=0;i<4;i++)reveal(2+Math.floor(rnd()*(W-4)),2+Math.floor(rnd()*(H-4)),3.5);
  ink=Math.min(99,ink+6);updateHUD();draw();save();toastMsg('☄ sonar pulse — fog thins');
};

// ---------- seeds / share ----------
function boot(newSeed){
  SEED=String(newSeed||dailySeed()).slice(0,24)||dailySeed();
  seedInput.value=SEED;
  genMap(SEED);
  const had=load();
  if(!had){/* fresh */}
  $('mapTitle').textContent=`chart № ${SEED} · ${harbors.length} harbours`;
  $('footSeed').textContent=SEED;
  const isDaily=SEED===dailySeed();
  $('seedBadge').textContent=(isDaily?'DAILY · ':'CUSTOM · ')+SEED;
  history.replaceState(null,'','#seed='+encodeURIComponent(SEED));
  routeStart=null;renderLedger();updateHUD();draw();save();
}
$('applySeed').onclick=()=>boot(seedInput.value.trim()||dailySeed());
seedInput.addEventListener('keydown',e=>{if(e.key==='Enter')boot(seedInput.value.trim()||dailySeed());});
$('dailyBtn').onclick=()=>boot(dailySeed());
$('diceBtn').onclick=()=>{const r=rngFrom('drift:'+Date.now());boot('drift-'+Math.floor(r()*8999+1000));};
$('shareBtn').onclick=async()=>{
  const url=location.href.split('#')[0]+'#seed='+encodeURIComponent(SEED);
  try{await navigator.clipboard.writeText(url);shareMsg.textContent='✓ link copied — same seed, same islands.';}
  catch(e){
    prompt('Copy this chart link:',url);
    shareMsg.textContent='link ready — pass it to your crew.';
  }
  setTimeout(()=>shareMsg.textContent='',3500);
};

// ---------- CONSTRAINT: react to scroll ----------
const fa=document.querySelector('.fog-a'), fb=document.querySelector('.fog-b');
addEventListener('scroll',()=>{
  const max=document.body.scrollHeight-innerHeight||1;
  tide=Math.min(1,scrollY/max*1.4); // 0 low → 1+ high
  if(fa)fa.style.transform=`translateX(${-scrollY*0.25}px)`;
  if(fb)fb.style.transform=`scaleX(-1) translateX(${-scrollY*0.15}px)`;
  $('tideVal').textContent=tide<0.33?'low':tide<0.7?'rising':'HIGH — sandbars drown';
  draw();
},{passive:true});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('lit');}),{threshold:0.2});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// ---------- CONSTRAINT: easter egg (kraken) ----------
let compassTaps=0, typed='';
function kraken(reason){
  if(krakenUsed&&reason==='auto')return;
  krakenUsed=true;
  const k=$('kraken');
  $('krakenMsg').textContent=reason==='type'?'THE KRAKEN ANSWERS ITS NAME':'THE COMPASS WAKES THE KRAKEN';
  k.classList.add('show');
  // kraken claims a random blob + reveals all fog briefly
  const rnd=rngFrom('kraken:'+Date.now());
  const kx=4+Math.floor(rnd()*(W-8)), ky=3+Math.floor(rnd()*(H-6));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(Math.hypot(x-kx,y-ky)<4){revealed[y][x]=1;fog[y][x]=0;if(isLand(x,y))claimed[y][x]=1;}
    else if(rnd()<0.5){revealed[y][x]=1;fog[y][x]=Math.min(fog[y][x],0.15);}
  }
  fame+=66;updateHUD();draw();save();
  toastMsg('🦑 the kraken takes its cut: +66 fame, -your dignity');
  setTimeout(()=>k.classList.remove('show'),2600);
  k.onclick=()=>k.classList.remove('show');
}
$('compass').onclick=(e)=>{compassTaps++;$('compass').classList.remove('spin');void $('compass').offsetWidth;$('compass').classList.add('spin');if(compassTaps>=5){compassTaps=0;kraken('compass');}else toastMsg(`the compass shivers… (${compassTaps}/5)`);};
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  typed=(typed+e.key.toLowerCase()).slice(-6);
  if(typed==='kraken')kraken('type');
  if(e.key==='c')setMode('claim');if(e.key==='r')setMode('route');if(e.key==='e')setMode('erase');
});

// ---------- anim loop (fog shimmer, ink trickle) ----------
let last=performance.now();
function loop(t){
  time=t/1000;
  if(t-last>4000){last=t;ink=Math.min(99,ink+1);updateHUD();draw();}
  else if(Math.floor(t/500)!==Math.floor((t-16)/500)){draw();}
  requestAnimationFrame(loop);
}

// ---------- go ----------
boot(SEED);
requestAnimationFrame(loop);
console.log('fog-cartographer-club ready', SEED);
