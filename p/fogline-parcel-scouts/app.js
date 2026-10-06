// Fogline Parcel Scouts — fog-of-war territory game. No deps. Canvas only.
const N = 15, MAXT = 140, WINPCT = 0.45, VISION = 3;
const cv = document.getElementById('map'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const logEl = $('log'), banner = $('banner');

let S; // state
const store = { get best(){ try{return JSON.parse(localStorage.getItem('fogline-best')||'null')}catch{return null} }, set best(v){ try{localStorage.setItem('fogline-best',JSON.stringify(v))}catch{} } };

// --- seeded rng ---
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return(h^=h>>>16)>>>0}}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd=(r,min,max)=>min+Math.floor(r()*(max-min+1));

// --- audio (tiny, mutable) ---
let muted=false, AC=null;
function beep(f=440,d=.07,type='square',g=.05){ if(muted) return; try{ AC=AC||new (window.AudioContext||window.webkitAudioContext)(); const o=AC.createOscillator(),gn=AC.createGain(); o.type=type;o.frequency.value=f; gn.gain.value=g; o.connect(gn);gn.connect(AC.destination); o.start(); gn.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d); o.stop(AC.currentTime+d);}catch{} }

// --- map gen ---
function genMap(seedStr){
  const seed=xmur3(seedStr)(), r=mulberry32(seed);
  const t=[]; // 0 plain 1 forest 2 water 3 rubble
  for(let y=0;y<N;y++){t[y]=[];for(let x=0;x<N;x++){
    const n=Math.sin(x*.7+seed%9)*Math.cos(y*.6+seed%7)+ (r()*1.2-.6);
    let v = n>1.05?2 : n>.45?1 : (r()<.07?3:0);
    t[y][x]=v;
  }}
  // keep corners walkable
  const corners=[[1,1],[N-2,1],[1,N-2]];
  for(const [x,y] of corners){ t[y][x]=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx=x+dx,ny=y+dy; if(nx>0&&ny>0&&nx<N-1&&ny<N-1&&t[ny][nx]===2) t[ny][nx]=0; } }
  return t;
}

function newGame(seedStr){
  const terrain=genMap(seedStr);
  S={ seed:seedStr, terrain, turn:0, ink:8, over:false,
      seen:new Uint8Array(N*N), owner:new Int8Array(N*N), // 0 none 1 you 2 r1 3 r2
      you:{x:1,y:1}, r1:{x:N-2,y:1}, r2:{x:1,y:N-2},
      r1cool:0, r2cool:0 };
  S.owner.fill(0);
  claim(1,1,1,true); claim(N-2,1,2,true); claim(1,N-2,3,true);
  reveal(1,1); reveal(N-2,1); reveal(1,N-2);
  banner.classList.add('hidden');
  say(`New survey pinned — seed "${seedStr}". Fog is thick. Move, scout.`,'info');
  update(); draw();
}

const idx=(x,y)=>y*N+x;
const inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
const walk=(x,y)=>inB(x,y)&&S.terrain[y][x]!==2;

function reveal(cx,cy){
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const d=Math.max(Math.abs(x-cx),Math.abs(y-cy));
    if(d<=VISION){ if(!S.seen[idx(x,y)] && S.terrain[y][x]!==undefined){ onFirstSeen(x,y); } S.seen[idx(x,y)]=1; }
  }
}
function onFirstSeen(x,y){
  const t=S.terrain[y][x];
  if(t===1){S.ink+=2; say(`Timber cache charted (+2 ink).`,'good');}
  else if(t===3){S.ink+=2; say(`Rubble cache cracked open (+2 ink).`,'good');}
  else S.ink+=1;
}
function claim(x,y,who,silent){
  if(!inB(x,y)||S.terrain[y][x]===2) return false;
  S.owner[idx(x,y)]=who; return true;
}

// --- rival AI ---
function frontierTargets(self, poach){
  // candidate cells: unclaimed walkable seen-or-adjacent, scored by value
  const scored=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!walk(x,y)) continue;
    const o=S.owner[idx(x,y)];
    if(poach){ if(o!==1) continue; }
    else if(o!==0) continue;
    // prefer near self + near fog edge + bonus terrain
    const d=Math.abs(x-self.x)+Math.abs(y-self.y);
    const t=S.terrain[y][x];
    let v=(t===1||t===3?4:0) - d*.6 + Math.random()*1.5;
    // frontier bonus: adjacent to fog
    let fogAdj=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy; if(inB(nx,ny)&&!S.seen[idx(nx,ny)]) fogAdj+=2;}
    scored.push({x,y,v:v+fogAdj});
  }
  scored.sort((a,b)=>b.v-a.v);
  return scored.slice(0,6);
}
function stepToward(u, tx, ty){
  const opts=[[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dy])=>walk(u.x+dx,u.y+dy));
  if(!opts.length) return;
  opts.sort((a,b)=>(Math.abs(u.x+a[0]-tx)+Math.abs(u.y+a[1]-ty))-(Math.abs(u.x+b[0]-tx)+Math.abs(u.y+b[1]-ty)));
  // jackals: greedy best; magpies: slight wander
  const pick = Math.random()<.18 ? opts[rnd(Math.random,0,opts.length-1)]||opts[0] : opts[0];
  u.x+=pick[0]; u.y+=pick[1];
  return pick;
}
function rivalMove(u, who, aggressive){
  const poach = aggressive && Math.random()<.45;
  const cands=frontierTargets(u, poach);
  let tx,ty;
  if(cands.length){ const c=cands[Math.floor(Math.random()*Math.min(3,cands.length))]; tx=c.x;ty=c.y; }
  else { tx=Math.floor(N/2); ty=Math.floor(N/2); }
  stepToward(u,tx,ty);
  const i=idx(u.x,u.y);
  if(S.terrain[u.y][u.x]!==2){
    const prev=S.owner[i];
    S.owner[i]=who;
    reveal(u.x,u.y);
    if(poach&&prev===1) say(`${who===2?'Rust Jackals':'Violet Magpies'} POACHED your paint at ${colName(u.x)},${u.y+1}!`,'bad');
  }
}
function colName(x){return String.fromCharCode(65+x)}

// --- turns ---
function playerMove(dx,dy){
  if(!S||S.over) return;
  const nx=S.you.x+dx, ny=S.you.y+dy;
  if(!walk(nx,ny)){ beep(120,.08,'sawtooth'); say('Blocked — water swallows that parcel. Chart around it.','bad'); shake(); return; }
  S.you.x=nx; S.you.y=ny;
  const prev=S.owner[idx(nx,ny)];
  claim(nx,ny,1);
  reveal(nx,ny);
  beep(prev===1?520:760,.06);
  if(prev===2||prev===3) say(`Reclaimed ${prev===2?'Jackal':'Magpie'} paint at ${colName(nx)},${ny+1}. Sweet.`,'good');
  S.turn++;
  rivalMove(S.r1,2,false);           // jackals: steady expanders
  if(S.turn%2===0||S.turn>90) rivalMove(S.r2,3,true); // magpies: lurk then swoop
  else { // magpie drift toward player border
    stepToward(S.r2,S.you.x,S.you.y); if(S.terrain[S.r2.y][S.r2.x]!==2){S.owner[idx(S.r2.x,S.r2.y)]=3; reveal(S.r2.x,S.r2.y);}
  }
  update(); draw();
  checkEnd();
}
function stake(){
  if(!S||S.over) return;
  if(S.ink<6){ say('Not enough ink for a stake (need 6). Chart fog to earn more.','bad'); beep(140,.1,'sawtooth'); return; }
  S.ink-=6;
  let n=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const x=S.you.x+dx,y=S.you.y+dy;
    if(walk(x,y)){S.owner[idx(x,y)]=1;n++;}
  }
  reveal(S.you.x,S.you.y);
  S.turn++;
  rivalMove(S.r1,2,false); rivalMove(S.r2,3,true);
  beep(300,.12,'square'); setTimeout(()=>beep(600,.12,'square'),90);
  say(`STAKE slammed — ${n} parcels blasted acid yellow.`,'good');
  update(); draw(); checkEnd();
}
function counts(){
  let you=0,r1=0,r2=0,seen=0,land=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(S.terrain[y][x]!==2) land++;
    if(S.seen[idx(x,y)]) seen++;
    const o=S.owner[idx(x,y)];
    if(o===1)you++;else if(o===2)r1++;else if(o===3)r2++;
  }
  return{you,r1,r2,seen,land};
}
function checkEnd(){
  const c=counts();
  const lead = c.you>=c.r1&&c.you>=c.r2;
  const youPct=c.you/c.land;
  if(youPct>=WINPCT){ end(true,`DOMINION — you hold ${Math.round(youPct*100)}% of dry land. The fog signs your name.`); return; }
  if(S.turn>=MAXT){
    const win = lead && c.you>0;
    const order=[['YOU',c.you],['JACKALS',c.r1],['MAGPIES',c.r2]].sort((a,b)=>b[1]-a[1]);
    end(win,`${win?'SURVEY WON':'OUTSCOUTED'} — final: you ${c.you} · jackals ${c.r1} · magpies ${c.r2}. Winner: ${order[0][0]}.`);
  }
}
function end(win,msg){
  S.over=true;
  const c=counts();
  const best=store.best;
  if(!best||c.you>best.you){ store.best={you:c.you,seed:S.seed,when:Date.now()}; }
  renderBest();
  banner.innerHTML=`<div><div class="big">${win?'★ CLAIMED ★':'FOG TAKES IT'}</div><p>${msg}</p><button id="btnAgain">↻ SURVEY AGAIN</button></div>`;
  banner.classList.remove('hidden');
  $('btnAgain').onclick=()=>{ newGame($('seed').value.trim()||('FOG-'+Math.floor(Math.random()*9999))); };
  beep(win?880:200,.3,'square');
  say(msg, win?'good':'bad'); update(); draw();
}

// --- render ---
function update(){
  const c=counts();
  $('mChart').textContent=Math.round(100*c.seen/(N*N))+'%';
  $('mYou').textContent=c.you; $('mR1').textContent=c.r1; $('mR2').textContent=c.r2;
  $('mInk').textContent=S.ink; $('mTurn').textContent=`${S.turn}/${MAXT}`;
}
function renderBest(){
  const b=store.best;
  $('best').textContent=b?`${b.you} parcels (seed ${b.seed})`:'—';
}
function say(msg,cls){
  const li=document.createElement('li'); if(cls)li.className=cls;
  li.textContent=`T${S?S.turn:0} — ${msg}`;
  logEl.prepend(li);
  while(logEl.children.length>40) logEl.lastChild.remove();
}

let shakeT=0; function shake(){shakeT=8;}
function draw(){
  const W=cv.width, cell=W/N;
  ctx.save();
  if(shakeT>0){ ctx.translate((Math.random()-.5)*shakeT,(Math.random()-.5)*shakeT); shakeT--; }
  // base
  ctx.fillStyle='#0c0b09'; ctx.fillRect(-10,-10,W+20,W+20);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const px=x*cell, py=y*cell, i=idx(x,y), seen=S.seen[i], o=S.owner[i], t=S.terrain[y][x];
    if(!seen){
      // fog: layered static
      ctx.fillStyle=(x+y)%2?'#131109':'#100e0b'; ctx.fillRect(px,py,cell,cell);
      ctx.fillStyle='rgba(168,154,125,.06)';
      for(let k=0;k<3;k++){ ctx.fillRect(px+((x*7+y*13+k*17)%Math.max(4,cell-4)), py+((y*11+x*5+k*23)%Math.max(4,cell-4)), 2,2); }
      ctx.strokeStyle='rgba(168,154,125,.12)'; ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);
      continue;
    }
    // ground
    let g = t===2?'#1c2a30': t===1?'#2a2b1a': t===3?'#2e2620':'#26221b';
    ctx.fillStyle=g; ctx.fillRect(px,py,cell,cell);
    if(t===1){ ctx.fillStyle='rgba(93,140,60,.55)'; ctx.fillRect(px+cell*.2,py+cell*.15,3,6); ctx.fillRect(px+cell*.6,py+cell*.4,3,6); }
    if(t===3){ ctx.fillStyle='rgba(200,50,30,.4)'; ctx.fillRect(px+cell*.3,py+cell*.3,cell*.35,cell*.35); }
    if(t===2){ ctx.fillStyle='rgba(120,180,200,.25)'; ctx.fillRect(px+2,py+cell/2-1,cell-4,2); ctx.fillRect(px+cell/2-1,py+2,2,cell-4); }
    // owner paint: grunge splat
    if(o>0){
      const col=o===1?'216,255,61':o===2?'255,74,45':'157,123,255';
      ctx.fillStyle=`rgba(${col},.78)`;
      const m=cell*.12;
      ctx.fillRect(px+m,py+m,cell-2*m,cell-2*m);
      ctx.fillStyle=`rgba(${col},.35)`;
      ctx.fillRect(px+1,py+1,5,3); ctx.fillRect(px+cell-7,py+cell-5,6,3);
      // hatch
      ctx.strokeStyle=`rgba(0,0,0,.35)`; ctx.beginPath();
      ctx.moveTo(px+3,py+cell-3); ctx.lineTo(px+cell-3,py+3); ctx.stroke();
    }
    // grid torn line
    ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);
  }
  // reachable highlights
  if(!S.over){
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=S.you.x+dx,y=S.you.y+dy;
      if(walk(x,y)){ ctx.strokeStyle='rgba(216,255,61,.9)'; ctx.lineWidth=2;
        ctx.strokeRect(x*cell+3,y*cell+3,cell-6,cell-6); ctx.lineWidth=1; }
    }
  }
  // scouts
  const dot=(u,col,label)=>{
    const cx=u.x*cell+cell/2, cy=u.y*cell+cell/2, r=cell*.3;
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(cx+1,cy+2,r,0,7); ctx.fill();
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fill();
    ctx.fillStyle='#111'; ctx.font=`900 ${Math.max(10,cell*.32)}px "Courier New",monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(label,cx,cy+1);
  };
  dot(S.you,'#d8ff3d','Y'); dot(S.r1,'#ff4a2d','J'); dot(S.r2,'#9d7bff','M');
  ctx.restore();
}

// --- input ---
function cellFromEvent(e){
  const r=cv.getBoundingClientRect();
  const cx=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX)-r.left;
  const cy=(e.touches&&e.touches[0]?e.touches[0].clientY:e.clientY)-r.top;
  return {x:Math.floor(cx/r.width*N), y:Math.floor(cy/r.height*N)};
}
cv.addEventListener('click',e=>{
  const {x,y}=cellFromEvent(e);
  const dx=x-S.you.x, dy=y-S.you.y;
  if(Math.abs(dx)+Math.abs(dy)===1) playerMove(dx,dy);
  else if(dx===0&&dy===0) stake();
  else say(`Too far, scout — one parcel per step. (${colName(S.you.x)},${S.you.y+1} → ${inB(x,y)?colName(x)+','+(y+1):'void'})`,'info');
});
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  const mv={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
  if(mv){ e.preventDefault(); playerMove(mv[0],mv[1]); }
  else if(k===' '){ e.preventDefault(); stake(); }
  else if(k==='n'){ newGame('FOG-'+Math.floor(Math.random()*99999)); $('seed').value=S.seed; }
  else if(k==='m'){ toggleMute(); }
  else if(k==='escape'){ $('help').classList.add('hidden'); }
});
document.querySelectorAll('.dpad button').forEach(b=>b.addEventListener('click',()=>playerMove(+b.dataset.dx,+b.dataset.dy)));
$('btnStake').onclick=stake;
$('btnRestart').onclick=()=>{ newGame($('seed').value.trim()||('FOG-'+Math.floor(Math.random()*9999))); };
$('btnReseed').onclick=()=>{ const s=$('seed').value.trim()||'FOG-1987'; newGame(s.toUpperCase()); $('seed').value=S.seed; };
$('btnDice').onclick=()=>{ const s='FOG-'+Math.floor(Math.random()*99999); $('seed').value=s; newGame(s); };
function toggleMute(){ muted=!muted; $('btnMute').textContent=muted?'✕':'♪'; }
$('btnMute').onclick=toggleMute;
$('btnHelp').onclick=()=>$('help').classList.remove('hidden');
$('btnCloseHelp').onclick=()=>$('help').classList.add('hidden');
$('help').addEventListener('click',e=>{ if(e.target.id==='help')$('help').classList.add('hidden'); });
$('seed').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.stopPropagation(); $('btnReseed').click();} });

// fit canvas backing store to display for crispness
function fit(){ const r=cv.getBoundingClientRect(); const s=Math.min(720,Math.max(300,Math.floor(r.width))); if(cv.width!==s){cv.width=s;cv.height=s;} draw(); }
new ResizeObserver(fit).observe(cv);

renderBest();
newGame((document.getElementById('seed').value||'FOG-1987').toUpperCase());
fit();
console.log('fogline parcel scouts ready');
