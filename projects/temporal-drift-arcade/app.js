// Temporal Drift Arcade — Swiss neon time-loop maze (no deps, file:// safe)
const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const ui = { score:$('score'), shards:$('shards'), combo:$('combo'), time:$('time'), charges:$('charges'),
  seed:$('seedLabel'), clock:$('clockLabel'), buf:$('bufPct'), scrub:$('scrub'), overlay:$('overlay'),
  daily:$('dailyInfo'), bestD:$('bestDaily'), bestS:$('bestSeed'), log:$('log'), foot:$('footSeed') };

// ---------- utils ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function todaySeed(){const d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate()}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function log(msg,good){const li=document.createElement('li');if(good)li.className='good';li.textContent=msg;ui.log.prepend(li);while(ui.log.children.length>8)ui.log.lastChild.remove()}

// ---------- config ----------
const COLS=19, ROWS=19, N=760, CELL=N/COLS, TIME_LIMIT=90, REWIND_SEC=10, MAX_CHARGES=5;
const INK='#141414', PAPER='#F4F0E6', RED='#E30613', BLUE='#0B24FB';

// ---------- state ----------
let seed = Number(new URLSearchParams(location.search).get('seed')) || todaySeed();
let rng, grid, shards=[], clocks=[], exit={x:COLS-2,y:ROWS-2};
let player={x:1.5,y:1.5,px:1.5,py:1.5};
let running=false, dead=false, won=false, rewinding=false;
let score=0, combo=1, comboStreak=0, lastGrab=-99, elapsed=0, timeLeft=TIME_LIMIT, charges=3, collected=0;
let buffer=[]; // ring: {x,y,score,combo,collected,mask,t}
let keys={}, dpad={x:0,y:0}, clockT=0;

function genMaze(s){
  rng = mulberry32(s);
  grid = Array.from({length:ROWS},()=>Array(COLS).fill(1));
  const carve=(cx,cy)=>{grid[cy][cx]=0;const dirs=[[2,0],[-2,0],[0,2],[0,-2]].sort(()=>rng()-.5);
    for(const[dx,dy]of dirs){const nx=cx+dx,ny=cy+dy;
      if(nx>0&&ny>0&&nx<COLS-1&&ny<ROWS-1&&grid[ny][nx]===1){grid[cy+dy/2][cx+dx/2]=0;carve(nx,ny)}}};
  carve(1,1);
  // braid: knock a few extra loops so patrols have routes
  for(let i=0;i<26;i++){const x=1+Math.floor(rng()*(COLS-2)),y=1+Math.floor(rng()*(ROWS-2));if(grid[y][x]===1&&!(x<=2&&y<=2))grid[y][x]=0;}
  const floors=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(grid[y][x]===0&&(x>2||y>2)&&!(x>=COLS-3&&y>=ROWS-3))floors.push({x,y});
  const pick=()=>floors.splice(Math.floor(rng()*floors.length),1)[0];
  shards=[];for(let i=0;i<14&&floors.length;i++){const c=pick();if(c)shards.push({cx:c.x,cy:c.y,taken:false,phase:rng()*6});}
  clocks=[];for(let i=0;i<5&&floors.length;i++){const c=pick();if(!c)break;
    clocks.push({x:c.x+.5,y:c.y+.5,tx:c.x+.5,ty:c.y+.5,speed:2.2+ (s%7)*0.25 + i*0.35,hand:rng()*6,face:rng()*6});}
  exit={x:COLS-2,y:ROWS-2};grid[exit.y][exit.x]=0;
}

function reset(s){
  seed=s; genMaze(s);
  player={x:1.5,y:1.5};score=0;combo=1;comboStreak=0;lastGrab=-99;elapsed=0;timeLeft=TIME_LIMIT;
  charges=3;collected=0;buffer=[];running=false;dead=false;won=false;rewinding=false;clockT=0;
  ui.scrub.value=100;ui.overlay.classList.add('hidden');
  $('btnRewind').disabled=true;$('btnStart').textContent='Start loop ↵';
  ui.seed.textContent='SEED '+s;ui.foot.textContent='SEED '+s;
  $('helpSeed').textContent=todaySeed();
  const isD = s===todaySeed();
  ui.daily.textContent=(isD?'TODAY — everyone plays this maze. ':'CUSTOM SEED '+s+'. ')+'14 shards · 5 clocks · 90s on the loop.';
  ui.bestD.textContent=localStorage.getItem('tda-best-'+todaySeed())||0;
  ui.bestS.textContent=localStorage.getItem('tda-best-'+s)||0;
  log('Maze '+s+' generated — '+(isD?'daily challenge.':'custom seed.'),true);
  draw(0);
}

function isWall(px,py){
  const x=Math.floor(px),y=Math.floor(py);
  if(x<0||y<0||x>=COLS||y>=ROWS)return true;
  // circle-ish collision: check 4 corners of small hitbox
  const r=0.28;
  for(const[ox,oy]of[[-r,-r],[r,-r],[-r,r],[r,r]]){
    const cx=Math.floor(px+ox),cy=Math.floor(py+oy);
    if(cx<0||cy<0||cx>=COLS||cy>=ROWS||grid[cy][cx]===1)return true;
  }
  return false;
}
function tryMove(nx,ny){ // axis-separated slide
  if(!isWall(nx,player.y))player.x=nx;
  if(!isWall(player.x,ny))player.y=ny;
}

function snapshot(){buffer.push({x:player.x,y:player.y,score,combo,collected,mask:shards.map(s=>s.taken?1:0).join(''),t:elapsed,charges});if(buffer.length>REWIND_SEC*60)buffer.shift();}
function restore(i){
  const s=buffer[Math.max(0,Math.min(i,buffer.length-1))];if(!s)return;
  player.x=s.x;player.y=s.y;score=s.score;combo=s.combo;collected=s.collected;charges=s.charges;
  shards.forEach((sh,k)=>sh.taken=s.mask[k]==='1');
  elapsed=s.t;timeLeft=Math.max(0,TIME_LIMIT-elapsed);
}

function startRun(){ if(running&&!dead&&!won)return; if(dead||won)reset(seed); running=true;rewinding=false;ui.overlay.classList.add('hidden');$('btnStart').textContent='Looping…';$('btnRewind').disabled=false;log('Loop started. Good luck, drifter.',true);}
function gameOver(reason){
  running=false;dead=reason==='dead';won=reason==='win';
  if(won){const bonus=Math.floor(timeLeft)*10+charges*150;score+=bonus;
    const k1='tda-best-'+seed,k2='tda-best-'+todaySeed();
    if(score>+(localStorage.getItem(k1)||0))localStorage.setItem(k1,score);
    if(seed===todaySeed()&&score>+(localStorage.getItem(k2)||0))localStorage.setItem(k2,score);
    ui.bestD.textContent=localStorage.getItem('tda-best-'+todaySeed())||0;
    ui.bestS.textContent=localStorage.getItem('tda-best-'+seed)||0;
    showOverlay('ESCAPED ✓','Score <b>'+score+'</b> · shards '+collected+'/14 · time left '+timeLeft.toFixed(1)+'s<br><br><button class="btn solid" id="ovAgain">Run it again ↵</button>');
    log('Escaped! '+score+' pts.',true);
  } else if(dead){
    if(charges>0){ enterRewind(true); }
    else { showOverlay('LOOP COLLAPSED','No rewinds left. Score '+score+'.<br><br><button class="btn solid" id="ovAgain">Retry seed '+seed+'</button>');log('Died with no rewinds. '+score+' pts.'); }
  }
  $('btnStart').textContent='Start loop ↵';wireOverlayBtn();
}
function showOverlay(h,p){ui.overlay.innerHTML='<h2 class="'+(h.includes('REWIND')?'rew':'')+'">'+h+'</h2><p>'+p+'</p>';ui.overlay.classList.remove('hidden');}
function wireOverlayBtn(){const b=$('ovAgain');if(b)b.onclick=()=>{reset(seed);startRun();};const c=$('ovResume');if(c)c.onclick=exitRewind;const d=$('ovCancel');if(d)d.onclick=cancelRewind;}

// ---- rewind ----
function enterRewind(auto){
  if(!buffer.length||charges<=0||rewinding)return;
  rewinding=true;running=false;
  window._rewIdx=buffer.length-1;
  showOverlay('⟲ REWIND','<b>'+(auto?'Killed by a clock — scrub back ≤10s and resume.':'Time frozen.')+'</b> Drag the slider, then resume.<br>Costs 1 charge.<br><br><button class="btn solid" id="ovResume">Resume ✓ (Enter)</button> <button class="btn" id="ovCancel">Cancel (Esc)</button>');
  wireOverlayBtn();log('Rewind opened — 10s buffer ready.');
}
function exitRewind(){
  if(!rewinding)return;charges=Math.max(0,charges-1);
  restore(window._rewIdx??buffer.length-1);
  buffer=buffer.slice(0,(window._rewIdx??buffer.length-1)+1);
  rewinding=false;running=true;dead=false;ui.overlay.classList.add('hidden');
  $('btnRewind').disabled=charges<=0;log('Resumed — 1 charge spent ('+charges+' left).',true);
}
function cancelRewind(){ if(!rewinding)return; rewinding=false;
  if(dead&&charges<=0){showOverlay('LOOP COLLAPSED','No rewinds left. Score '+score+'.<br><br><button class="btn solid" id="ovAgain">Retry</button>');wireOverlayBtn();}
  else{running=true;ui.overlay.classList.add('hidden');} }

ui.scrub.addEventListener('input',e=>{
  if(!rewinding||!buffer.length)return;
  const f=Number(e.target.value)/100;
  window._rewIdx=Math.floor(f*(buffer.length-1));
  const s=buffer[window._rewIdx];
  if(s){player.x=s.x;player.y=s.y;}
});

// ---- input ----
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  keys[e.key.toLowerCase()]=true;
  if(e.key==='r'||e.key==='R'){rewinding?exitRewind():(running&&!dead?enterRewind(false):(dead&&charges>0?enterRewind(true):null));}
  if(e.key==='Enter'){if(!running&&ui.overlay.classList.contains('hidden'))startRun();else if(rewinding)exitRewind();}
  if(e.key==='Escape'&&rewinding)cancelRewind();
});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll('.dpad button').forEach(b=>{
  const dx=+b.dataset.dx,dy=+b.dataset.dy;
  const on=e=>{e.preventDefault();dpad.x=dx;dpad.y=dy;};
  const off=()=>{dpad.x=0;dpad.y=0;};
  b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);
});
$('btnStart').onclick=startRun;
$('btnRewind').onclick=()=>rewinding?exitRewind():enterRewind(false);
$('btnDaily').onclick=()=>{reset(todaySeed());startRun();};
$('btnRandom').onclick=()=>{reset(Math.floor(Math.random()*90000000)+10000000);};
$('btnSeed').onclick=()=>{const v=parseInt($('seedInput').value,10);if(v>0){reset(v);}else log('Enter a numeric seed.');};
$('btnCopy').onclick=async()=>{const u=location.href.split('?')[0]+'?seed='+seed;try{await navigator.clipboard.writeText(u);log('Link copied: ?seed='+seed,true);}catch{prompt('Copy link:',u);}};
$('btnHelp').onclick=()=>$('help').classList.remove('hidden');
$('btnCloseHelp').onclick=()=>$('help').classList.add('hidden');
$('help').addEventListener('click',e=>{if(e.target.id==='help')$('help').classList.add('hidden')});
canvas.addEventListener('pointerdown',()=>{if(!running&&!dead&&!won)startRun();});

// ---- sim ----
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(running&&!rewinding){step(dt);}
  draw(now/1000);
  requestAnimationFrame(frame);
}
function step(dt){
  elapsed+=dt;timeLeft=TIME_LIMIT-elapsed;clockT+=dt;
  if(timeLeft<=0){timeLeft=0;gameOver(dead?'dead':'timeout');if(!dead&&!won){showOverlay('OUT OF TIME','The loop collapsed at 90s. Score '+score+'.<br><br><button class="btn solid" id="ovAgain">Retry</button>');wireOverlayBtn();running=false;}updateHUD();return;}
  // move
  let dx=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0)+dpad.x;
  let dy=(keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0)+dpad.y;
  if(dx||dy){const l=Math.hypot(dx,dy);const sp=4.4*dt;tryMove(player.x+dx/l*sp,player.y+dy/l*sp);}
  snapshot();
  // shards
  for(const s of shards){
    if(!s.taken&&Math.hypot(player.x-(s.cx+.5),player.y-(s.cy+.5))<0.5){
      s.taken=true;collected++;
      if(elapsed-lastGrab<2.5){combo=Math.min(9,combo+1);}else combo=1;
      comboStreak++;lastGrab=elapsed;
      const pts=100*combo;score+=pts;
      if(comboStreak%8===0&&charges<MAX_CHARGES){charges++;log('+1 rewind charge ('+comboStreak+' streak)',true);}
      log('Shard +'+pts+' (×'+combo+')');
      if(combo>=3)ui.combo.classList.add('hot');else ui.combo.classList.remove('hot');
    }
  }
  if(elapsed-lastGrab>2.5&&combo!==1){combo=1;ui.combo.classList.remove('hot');}
  // clocks
  for(const c of clocks){
    c.hand+=dt*3;
    if(Math.hypot(c.x-c.tx,c.y-c.ty)<0.08){
      // pick neighbour floor cell
      const opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([ox,oy])=>{const nx=Math.floor(c.x)+ox,ny=Math.floor(c.y)+oy;return nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&grid[ny][nx]===0;});
      const o=opts[Math.floor(rng()*opts.length)]||[0,0];
      c.tx=Math.floor(c.x)+o[0]+.5;c.ty=Math.floor(c.y)+o[1]+.5;
    }
    const vx=c.tx-c.x,vy=c.ty-c.y,l=Math.hypot(vx,vy)||1;
    c.x+=vx/l*Math.min(l,c.speed*dt);c.y+=vy/l*Math.min(l,c.speed*dt);
    if(Math.hypot(player.x-c.x,player.y-c.y)<0.55){gameOver('dead');return;}
  }
  // win
  if(Math.floor(player.x)===exit.x&&Math.floor(player.y)===exit.y){gameOver('win');return;}
  updateHUD();
}
function updateHUD(){
  ui.score.textContent=score;ui.shards.textContent=collected+'/'+shards.length;
  ui.combo.textContent='×'+combo;ui.time.textContent=timeLeft.toFixed(1);
  ui.charges.textContent=charges;ui.clock.textContent='T+'+elapsed.toFixed(1);
  ui.buf.textContent=Math.round(buffer.length/(REWIND_SEC*60)*100)+'%';
  $('btnRewind').disabled=!(running||dead)||charges<=0||!buffer.length;
  if(!rewinding&&buffer.length)ui.scrub.value=100;
}

// ---- render (Swiss poster: paper field, ink walls, red/blue neon) ----
function draw(t){
  ctx.fillStyle=PAPER;ctx.fillRect(0,0,N,N);
  // grid lines faint
  ctx.strokeStyle='rgba(20,20,20,.08)';ctx.lineWidth=1;ctx.beginPath();
  for(let i=0;i<=COLS;i++){ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,N);ctx.moveTo(0,i*CELL);ctx.lineTo(N,i*CELL);}ctx.stroke();
  // walls as ink blocks
  ctx.fillStyle=INK;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]===1)ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
  // exit gate (blue)
  ctx.fillStyle=BLUE;ctx.shadowColor=BLUE;ctx.shadowBlur=18;
  ctx.fillRect(exit.x*CELL+4,exit.y*CELL+4,CELL-8,CELL-8);
  ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font=`900 ${CELL*0.5}px Archivo,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('→',exit.x*CELL+CELL/2,exit.y*CELL+CELL/2+1);
  // shards (red diamonds, neon)
  for(const s of shards){if(s.taken)continue;const cx=s.cx*CELL+CELL/2,cy=s.cy*CELL+CELL/2+Math.sin(t*3+s.phase)*3;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.fillStyle=RED;ctx.shadowColor=RED;ctx.shadowBlur=14;
    const r=CELL*0.2;ctx.fillRect(-r/1.4,-r/1.4,r*1.4,r*1.4);ctx.restore();}
  // clocks (red rings, white face, ink hands)
  for(const c of clocks){const cx=c.x*CELL,cy=c.y*CELL,r=CELL*0.42;
    ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=4;ctx.strokeStyle=RED;ctx.shadowColor=RED;ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(c.hand)*r*0.7,cy+Math.sin(c.hand)*r*0.7);ctx.stroke();
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(-c.hand*0.7)*r*0.5,cy+Math.sin(-c.hand*0.7)*r*0.5);ctx.stroke();
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(cx,cy,3,0,7);ctx.fill();}
  // rewind trail (blue ghosts from buffer)
  if(buffer.length>4){ctx.fillStyle='rgba(11,36,251,.25)';for(let i=0;i<buffer.length;i+=12){const b=buffer[i];ctx.beginPath();ctx.arc(b.x*CELL,b.y*CELL,7,0,7);ctx.fill();}}
  // player (blue square, white core, neon)
  const px=player.x*CELL,py=player.y*CELL;
  ctx.fillStyle=BLUE;ctx.shadowColor=BLUE;ctx.shadowBlur=20;
  ctx.fillRect(px-11,py-11,22,22);ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.fillRect(px-5,py-5,10,10);
  ctx.fillStyle=INK;ctx.fillRect(px-2,py-2,4,4);
  // vignette frame + corner marks (swiss registration)
  ctx.strokeStyle=INK;ctx.lineWidth=8;ctx.strokeRect(4,4,N-8,N-8);
  ctx.fillStyle=RED;ctx.shadowColor=RED;ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(24,24,9,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=INK;ctx.font='700 20px Archivo,sans-serif';ctx.textAlign='left';
  ctx.fillText('TDA/'+String(seed).slice(-4),34,N-18);
  if(rewinding&&buffer.length){ // ghost preview handled via player pos already; draw scanline
    ctx.fillStyle='rgba(227,6,19,.12)';for(let y=0;y<N;y+=8)ctx.fillRect(0,y,N,2);
  }
  if(!running&&!dead&&!won&&elapsed===0){
    ctx.fillStyle='rgba(20,20,20,.55)';ctx.fillRect(0,0,N,N);
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='900 54px Archivo,sans-serif';
    ctx.fillText('PRESS START',N/2,N/2-10);
    ctx.font='400 22px "Space Grotesk",sans-serif';ctx.fillText('collect → dodge → rewind',N/2,N/2+30);
  }
}

reset(seed);
updateHUD();
requestAnimationFrame(frame);
console.log('tda ready', seed);
