// DRIFTLINE Territory Looper — vaporwave grid arcade. No assets, canvas + WebAudio only.
const N = 16, SIZE = 640, CELL = SIZE / N;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const clockEl = $('clock'), timerPill = $('timerPill'),
  scoreYou = $('scoreYou'), scoreRival = $('scoreRival'),
  toastEl = $('toast'), countdownEl = $('countdown'), gameoverEl = $('gameover'),
  seedLabel = $('seedLabel'), seedLabel2 = $('seedLabel2'), footSeed = $('footSeed'),
  bestLabel = $('bestLabel'), fogNote = $('fogNote');

// ---------- seeded rng ----------
function hashStr(s){ let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619);} return h>>>0; }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function isoWeek(){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-((d.getDay()+6)%7));
  const w1=new Date(d.getFullYear(),0,4); return d.getFullYear()+'-W'+String(1+Math.round(((d-w1)/864e5-3+((w1.getDay()+6)%7))/7)).padStart(2,'0'); }

// ---------- audio (WebAudio, no assets) ----------
let AC=null, muted=false;
function ac(){ if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); } if(AC.state==='suspended') AC.resume(); return AC; }
function tone(f=440,d=.08,type='square',v=.06,when=0,slide=0){
  if(muted) return; try{
    const c=ac(), o=c.createOscillator(), g=c.createGain(), t=c.currentTime+when;
    o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
  }catch(e){}
}
const sfx = {
  step(){ tone(300+Math.random()*300,.05,'square',.03); },
  anchor(){ tone(660,.09,'triangle',.07); },
  claim(n){ const base=[523,659,784,1046]; base.forEach((f,i)=>tone(f,.12,'square',.06,i*.07)); if(n>8) tone(1318,.25,'sawtooth',.05,.3); },
  steal(){ tone(220,.18,'sawtooth',.06,0,-140); },
  cut(){ tone(180,.22,'square',.07,0,-100); tone(120,.2,'square',.06,.08,-60); },
  fog(){ [880,1174,1568].forEach((f,i)=>tone(f,.15,'sine',.05,i*.08)); },
  tick(){ tone(880,.07,'square',.07); },
  go(){ tone(523,.12,'square',.07); tone(784,.2,'square',.07,.12); },
  over(win){ (win?[523,659,784,1046,1318]:[392,330,262,196]).forEach((f,i)=>tone(f,.18,'triangle',.07,i*.11)); },
};
$('muteBtn').onclick = (e)=>{ muted=!muted; e.target.classList.toggle('off',muted); if(!muted) sfx.anchor(); };
window.addEventListener('pointerdown', ()=>{ try{ac();}catch(e){} }, {once:true});

// ---------- state ----------
let seedStr = isoWeek(), rng = mulberry32(hashStr(seedStr));
let owner = new Uint8Array(N*N);   // 0 neutral 1 you 2 vex 3 null
let fog = new Uint8Array(N*N);     // 1 = fogged
let trail = [];                    // [{x,y}]
let trailSet = new Set();
let cursor = {x:8,y:8};
let rivals = [];
let particles = [];
let state = 'idle';                // idle | countdown | playing | over
let timeLeft = 60, lastT = 0, rivalAcc = 0, fogCount = 0;
let best = JSON.parse(localStorage.getItem('driftline-best')||'{}');
const idx = (x,y)=>y*N+x;
const inB = (x,y)=>x>=0&&y>=0&&x<N&&y<N;

function genMap(){
  owner.fill(0); fog.fill(0); trail=[]; trailSet=new Set(); particles=[];
  rng = mulberry32(hashStr(seedStr));
  // fog zones: 3 seeded rects
  fogCount = 0;
  for(let z=0; z<3; z++){
    const w = 3+Math.floor(rng()*2), h = 3+Math.floor(rng()*2);
    const x0 = 1+Math.floor(rng()*(N-w-2)), y0 = 1+Math.floor(rng()*(N-h-2));
    for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++){ if(!fog[idx(x,y)]){ fog[idx(x,y)]=1; fogCount++; } }
  }
  // home turf: player 2x2 center (reveals fog there)
  cursor = {x:8,y:8};
  [[7,7],[8,7],[7,8],[8,8]].forEach(([x,y])=>{ owner[idx(x,y)]=1; revealAround(x,y); });
  rivals = [
    {x:1,y:1,dx:1,dy:0,own:2,color:'#ff9e00',t:rng()*9,name:'VEX'},
    {x:N-2,y:N-2,dx:-1,dy:0,own:3,color:'#05ffa1',t:rng()*9+4,name:'NULL'},
  ];
  rivals.forEach(r=>{ owner[idx(r.x,r.y)]=r.own; });
  seedLabel.textContent = seedStr; seedLabel2.textContent = seedStr;
  footSeed.textContent = 'seed '+seedStr+' · '+fogCount+' fog tiles';
  const b = best[seedStr] ?? best.__global ?? null;
  bestLabel.textContent = b==null ? '—' : b+'%';
}
function revealAround(x,y){
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    const nx=x+dx, ny=y+dy; if(!inB(nx,ny)) continue;
    if(fog[idx(nx,ny)]){ fog[idx(nx,ny)]=0; }
  }
}

// ---------- loop claiming ----------
function pushTrail(x,y){
  if(!inB(x,y) || state!=='playing') return;
  const last = trail.length? trail[trail.length-1] : cursor;
  // walk stepwise toward target (orthogonal)
  let cx = last.x, cy = last.y;
  const steps=[];
  while(cx!==x || cy!==y){
    if(cx!==x) cx += Math.sign(x-cx); else cy += Math.sign(y-cy);
    steps.push([cx,cy]);
    if(steps.length>32) break;
  }
  for(const [sx,sy] of steps) stepTo(sx,sy);
}
function stepTo(x,y){
  if(!inB(x,y)) return;
  const k = idx(x,y);
  // caught by rival?
  if(rivals.some(r=>r.x===x&&r.y===y)){ severTrail('caught by '+rivals.find(r=>r.x===x&&r.y===y).name+'!'); return; }
  if(trailSet.has(k)){
    closeLoop(x,y); return;
  }
  if(owner[k]===1 && trail.length>=3){ trail.push({x,y}); trailSet.add(k); closeLoop(x,y); return; }
  trail.push({x,y}); trailSet.add(k); cursor={x,y};
  sfx.step();
}
function closeLoop(lx,ly){
  // find loop segment from first occurrence
  const k = idx(lx,ly);
  let start = trail.findIndex(p=>idx(p.x,p.y)===k);
  if(start<0) start = 0;
  const loop = trail.slice(start); loop.push({x:lx,y:ly});
  const wall = new Set(loop.map(p=>idx(p.x,p.y)));
  // flood fill outside
  const seen = new Uint8Array(N*N);
  const q=[];
  for(let x=0;x<N;x++){ q.push([x,0],[x,N-1]); }
  for(let y=0;y<N;y++){ q.push([0,y],[N-1,y]); }
  while(q.length){
    const [x,y]=q.pop(); if(!inB(x,y)) continue; const i=idx(x,y);
    if(seen[i]||wall.has(i)) continue; seen[i]=1;
    q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  let claimed=0, stolen=0, fogged=0;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const i=idx(x,y);
    if(wall.has(i)){ if(owner[i]!==1){ if(owner[i]===2||owner[i]===3) stolen++; claimed++; } owner[i]=1; if(fog[i]){fog[i]=0;fogged++;} revealAround(x,y); }
    else if(!seen[i]){ if(owner[i]===2||owner[i]===3) stolen++; if(owner[i]!==1) claimed++; owner[i]=1; if(fog[i]){fog[i]=0;fogged++;} burst(x,y,'#ff71ce'); }
  }
  burst(lx,ly,'#01cdfe',14);
  trail=[]; trailSet=new Set(); cursor={x:lx,y:ly};
  const total = claimed+fogged;
  if(claimed<=1){ toast('loop too small — go bigger'); sfx.cut(); return; }
  sfx.claim(claimed);
  toast(`+${claimed} tiles${stolen?` · stole ${stolen} back`:''}${fogged?` · fog burned ${fogged}`:''}`);
  if(fogged>0) sfx.fog();
}
function severTrail(msg){
  if(!trail.length) return;
  trail=[]; trailSet=new Set(); sfx.cut(); toast(msg||'route severed!');
}

// ---------- rivals ----------
function moveRivals(dt){
  rivalAcc += dt;
  const speed = timeLeft<15 ? .26 : .38;
  if(rivalAcc < speed) return;
  rivalAcc = 0;
  for(const r of rivals){
    r.t += .7;
    // drift: momentum + sine wobble + hunt player edges
    const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>inB(r.x+dx,r.y+dy));
    // nearest player tile direction
    let bx=0,by=0,bd=1e9;
    for(let y=0;y<N;y+=2) for(let x=0;x<N;x+=2){ if(owner[idx(x,y)]===1){ const d=Math.abs(x-r.x)+Math.abs(y-r.y); if(d<bd){bd=d;bx=x;by=y;} } }
    const scored = opts.map(([dx,dy])=>{
      let s = Math.random()*1.2;
      if(dx===r.dx&&dy===r.dy) s+=1.1;                                   // momentum
      s += Math.sin(r.t+dx*2+dy)*0.5;                                     // drift wobble
      if(bd<1e9){ if(Math.sign(bx-r.x)===dx) s+=1.4; if(Math.sign(by-r.y)===dy) s+=1.4; } // hunt
      if(fog[idx(r.x+dx,r.y+dy)]) s-=.4;
      return {dx,dy,s};
    }).sort((a,b)=>b.s-a.s);
    const m = scored[0]; r.dx=m.dx; r.dy=m.dy;
    r.x+=r.dx; r.y+=r.dy;
    const i=idx(r.x,r.y);
    if(owner[i]===1){ owner[i]=r.own; sfx.steal(); burst(r.x,r.y,r.color,4); if(Math.random()<.3) toast(`${r.name} stole an edge!`); }
    else if(owner[i]===0){ owner[i]=r.own; }
    else if(owner[i]!==r.own && Math.random()<.25){ owner[i]=r.own; }      // rivals fight each other
    // sever player trail on contact
    const tk = trail.findIndex(p=>p.x===r.x&&p.y===r.y);
    if(tk>=0){ severTrail(r.name+' cut your route!'); }
  }
}

// ---------- particles ----------
function burst(gx,gy,color,n=6){
  for(let i=0;i<n;i++) particles.push({x:(gx+.5)*CELL,y:(gy+.5)*CELL,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.6,color});
}

// ---------- render ----------
function draw(t){
  // bg
  const g = ctx.createLinearGradient(0,0,0,SIZE);
  g.addColorStop(0,'#120826'); g.addColorStop(.6,'#1b0b38'); g.addColorStop(1,'#2b0f4f');
  ctx.fillStyle=g; ctx.fillRect(0,0,SIZE,SIZE);
  // perspective grid glow lines
  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
  for(let i=0;i<=N;i++){ ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,SIZE);ctx.stroke(); ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(SIZE,i*CELL);ctx.stroke(); }
  // cells
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const o=owner[idx(x,y)], px=x*CELL, py=y*CELL, pad=2.5;
    if(o===1){ const gg=ctx.createLinearGradient(px,py,px,py+CELL); gg.addColorStop(0,'#ff71ce'); gg.addColorStop(1,'#b967ff');
      ctx.fillStyle=gg; ctx.globalAlpha=.92; roundRect(px+pad,py+pad,CELL-pad*2,CELL-pad*2,7); ctx.fill(); ctx.globalAlpha=1; }
    else if(o===2){ ctx.fillStyle='#ff9e00'; ctx.globalAlpha=.85; roundRect(px+pad,py+pad,CELL-pad*2,CELL-pad*2,7); ctx.fill(); ctx.globalAlpha=1; }
    else if(o===3){ ctx.fillStyle='#05ffa1'; ctx.globalAlpha=.8; roundRect(px+pad,py+pad,CELL-pad*2,CELL-pad*2,7); ctx.fill(); ctx.globalAlpha=1; }
    // fog hatch
    if(fog[idx(x,y)]){
      ctx.fillStyle='rgba(10,5,24,.72)'; ctx.fillRect(px,py,CELL,CELL);
      ctx.strokeStyle='rgba(1,205,254,.5)'; ctx.lineWidth=1;
      for(let d=-CELL;d<CELL*2;d+=8){ ctx.beginPath();ctx.moveTo(px+d,py+CELL);ctx.lineTo(px+d+CELL,py);ctx.stroke(); }
    }
  }
  // trail
  if(trail.length){
    ctx.strokeStyle='#01cdfe'; ctx.lineWidth=7; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.shadowColor='#01cdfe'; ctx.shadowBlur=14;
    ctx.beginPath();
    trail.forEach((p,i)=>{ const cx=(p.x+.5)*CELL, cy=(p.y+.5)*CELL; i?ctx.lineTo(cx,cy):ctx.moveTo(cx,cy); });
    ctx.stroke(); ctx.shadowBlur=0;
    for(const p of trail){ ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc((p.x+.5)*CELL,(p.y+.5)*CELL,3.4,0,7); ctx.fill(); }
  }
  // cursor
  const cx=(cursor.x+.5)*CELL, cy=(cursor.y+.5)*CELL;
  const pulse = 3+Math.sin(t/180)*1.5;
  ctx.strokeStyle='#fff'; ctx.lineWidth=2.5; ctx.shadowColor='#ff71ce'; ctx.shadowBlur=12;
  ctx.strokeRect(cx-CELL/2+4,cy-CELL/2+4,CELL-8,CELL-8); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,pulse,0,7); ctx.fill();
  // rivals
  for(const r of rivals){
    const rx=(r.x+.5)*CELL, ry=(r.y+.5)*CELL;
    ctx.shadowColor=r.color; ctx.shadowBlur=18;
    ctx.fillStyle=r.color; ctx.beginPath(); ctx.arc(rx,ry,11,0,7); ctx.fill();
    ctx.shadowBlur=0; ctx.fillStyle='#0d0620'; ctx.font='bold 11px Orbitron,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(r.own===2?'V':'N',rx,ry+1);
    ctx.strokeStyle=r.color; ctx.globalAlpha=.5; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(rx,ry,15+Math.sin(t/150+r.t)*3,0,7); ctx.stroke(); ctx.globalAlpha=1;
  }
  // particles
  particles = particles.filter(p=>p.life>0);
  for(const p of particles){ ctx.globalAlpha=Math.max(0,p.life*1.6); ctx.fillStyle=p.color; ctx.fillRect(p.x-2,p.y-2,4,4); }
  ctx.globalAlpha=1;
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---------- hud / flow ----------
let toastTimer=null;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1800); }
function scores(){
  let you=0,riv=0;
  for(let i=0;i<N*N;i++){ if(owner[i]===1)you++; else if(owner[i]===2||owner[i]===3)riv++; }
  return {you:Math.round(you/N/N*100), riv:Math.round(riv/N/N*100), youN:you, rivN:riv};
}
function endRound(){
  state='over'; sfx.over(scores().you>=scores().riv);
  const s=scores();
  const prevBest = best[seedStr] ?? best.__global ?? 0;
  const nb = Math.max(prevBest, s.you);
  best[seedStr]=nb; best.__global=Math.max(best.__global||0,s.you);
  localStorage.setItem('driftline-best',JSON.stringify(best));
  bestLabel.textContent=nb+'%';
  $('goYou').textContent=s.you+'%'; $('goRival').textContent=s.riv+'%'; $('goBest').textContent=nb+'%';
  const win = s.you>s.riv;
  $('goKicker').textContent = win? 'BLITZ WON — GRID CLAIMED' : 'BLITZ COMPLETE — RIVALS ATE';
  $('goTitle').textContent = win? 'Chrome forever.' : 'Drift harder.';
  $('goNote').textContent = s.you>prevBest? '✨ new best for '+seedStr+'!' : 'seed '+seedStr+' · best '+nb+'%';
  gameoverEl.classList.remove('hidden');
}
function startRound(){
  if(state==='countdown'||state==='playing') return;
  genMap(); gameoverEl.classList.add('hidden');
  state='countdown'; sfx.go();
  let c=3; countdownEl.textContent=c; countdownEl.classList.remove('hidden');
  const iv=setInterval(()=>{ c--; sfx.tick(); if(c<=0){ clearInterval(iv); countdownEl.classList.add('hidden'); state='playing'; timeLeft=60; lastT=performance.now(); toast('draw a loop — go!'); } else countdownEl.textContent=c; },650);
}
$('startBtn').onclick=()=>{ ac(); startRound(); };
$('againBtn').onclick=()=>{ startRound(); };
$('copySeedBtn').onclick=async()=>{ try{ await navigator.clipboard.writeText(seedStr); toast('seed copied: '+seedStr);}catch(e){ toast('seed: '+seedStr);} tone(700,.1,'sine',.06); };
$('seedBtn').onclick=()=>{ seedStr='DICE-'+Math.random().toString(36).slice(2,7).toUpperCase(); genMap(); draw(0); updateHUD(); toast('fresh map: '+seedStr); sfx.fog(); };

// ---------- input ----------
function cellFromEvent(e){
  const r=canvas.getBoundingClientRect();
  const x=Math.floor((e.clientX-r.left)/r.width*N), y=Math.floor((e.clientY-r.top)/r.height*N);
  return {x:Math.max(0,Math.min(N-1,x)), y:Math.max(0,Math.min(N-1,y))};
}
let dragging=false;
canvas.addEventListener('pointerdown',e=>{ ac(); dragging=true; canvas.setPointerCapture(e.pointerId); const c=cellFromEvent(e);
  if(state!=='playing'){ toast('hit start 60s blitz first'); tone(200,.1,'square',.05); return; }
  cursor={...c}; trail=[{...c}]; trailSet=new Set([idx(c.x,c.y)]); sfx.anchor(); });
canvas.addEventListener('pointermove',e=>{ if(!dragging||state!=='playing')return; const c=cellFromEvent(e); const l=trail.length?trail[trail.length-1]:cursor; if(c.x!==l.x||c.y!==l.y) pushTrail(c.x,c.y); });
addEventListener('pointerup',()=>dragging=false);
addEventListener('keydown',e=>{
  if(state!=='playing'){ if(e.key==='Enter') startRound(); return; }
  const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]}[e.key];
  if(d){ e.preventDefault(); if(!trail.length){ trail=[{...cursor}]; trailSet=new Set([idx(cursor.x,cursor.y)]); } pushTrail(cursor.x+d[0],cursor.y+d[1]); }
  if(e.key===' '){ e.preventDefault(); severTrail('anchor lifted'); }
});

// ---------- main loop ----------
function updateHUD(){
  const s=scores(); scoreYou.textContent=s.you+'%'; scoreRival.textContent=s.riv+'%';
}
function frame(t){
  requestAnimationFrame(frame);
  const dt=Math.min(.1,(t-lastT)/1000||0); lastT=t;
  if(state==='playing'){
    timeLeft-=dt;
    clockEl.textContent=Math.max(0,timeLeft).toFixed(1);
    timerPill.classList.toggle('urgent',timeLeft<10);
    if(timeLeft<=10&&timeLeft>0 && Math.floor(timeLeft*2)!==Math.floor((timeLeft+dt)*2)) sfx.tick();
    moveRivals(dt);
    for(const p of particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; }
    updateHUD();
    if(timeLeft<=0){ timeLeft=0; clockEl.textContent='0.0'; endRound(); }
  }
  draw(t||0);
}

// ---------- boot ----------
genMap(); updateHUD(); clockEl.textContent='60.0';
requestAnimationFrame(frame);
