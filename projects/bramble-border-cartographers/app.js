// Bramble Border Cartographers — retro-wave hex duel (no build, canvas only)
const R = 4, MAX_TURNS = 14, START_INK = 3, BRAMBLE_STOCK = 5;
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const key = (q,r) => q + ',' + r;
const $ = id => document.getElementById(id);

const canvas = $('board'), ctx = canvas.getContext('2d');
let LAYOUT=null, AC=null;
const logEl = $('log'), hintEl = $('hint'), toastEl = $('toast');

// ---------- seeds / rng ----------
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function isoWeek(d=new Date()){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-day+3);const first=new Date(Date.UTC(t.getUTCFullYear(),0,4));const fday=(first.getUTCDay()+6)%7;first.setUTCDate(first.getUTCDate()-fday+3);return{year:t.getUTCFullYear(),week:1+Math.round((t-first)/6048e5)}}
function weekSeed(y,w){return `BRMBL-${y}-W${String(w).padStart(2,'0')}`}
function parseWeekSeed(s){const m=/BRMBL-(\d{4})-W(\d{2})/.exec(s);return m?{year:+m[1],week:+m[2]}:null}

// ---------- state ----------
let S = null;
function allHexes(){const h=[];for(let q=-R;q<=R;q++)for(let r=-R;r<=R;r++){const s=-q-r;if(Math.abs(s)<=R)h.push({q,r})}return h}
const HEXES = allHexes();
const HEXSET = new Set(HEXES.map(h=>key(h.q,h.r)));
const nbr = (q,r)=>DIRS.map(([dq,dr])=>key(q+dq,r+dr)).filter(k=>HEXSET.has(k));

function newGame(seedStr){
  const rng = mulberry32(hashStr(seedStr));
  const terrain = {};
  for(const h of HEXES){
    const k=key(h.q,h.r), roll=rng();
    terrain[k]= roll<0.08?'crystal': roll<0.22?'fertile': roll<0.34?'wild':'plain';
  }
  // 3 spread HQs on outer ring
  const ring = HEXES.filter(h=>Math.max(Math.abs(h.q),Math.abs(h.r),Math.abs(-h.q-h.r))>=R-1);
  const shuffled=[...ring].sort(()=>rng()-0.5);
  const hqs={};
  const order=['you','volt','thorn'];
  const chosen=[];
  for(const o of order){
    let picked=null;
    for(const c of shuffled){
      const k=key(c.q,c.r);if(hqs[k])continue;
      let ok=true;for(const tk of Object.keys(hqs)){const[a,b]=tk.split(',').map(Number);
        if(Math.max(Math.abs(c.q-a),Math.abs(c.r-b))<4){ok=false;break}}
      if(ok){picked=c;break}
    }
    picked=picked||shuffled.find(c=>!hqs[key(c.q,c.r)]);
    const k=key(picked.q,picked.r);hqs[k]=o;chosen.push(picked);terrain[k]='plain';
  }
  const owner={};for(const[k,v]of Object.entries(hqs))owner[k]=v;
  S={seedStr,terrain,owner,hqs,brambles:[],routes:[],draft:[],turn:1,ink:START_INK,
     coins:0,rivalCoins:{volt:0,thorn:0},stock:BRAMBLE_STOCK,rivalStock:{volt:3,thorn:3},
     tool:'paint',over:false,painting:false,hover:null,layout:null,flash:{}};
  logEl.innerHTML='';
  log(`Map <b>${seedStr}</b> surveyed. Claim the pulsing hexes!`);
  log('Tip: long winding routes pay bonus coins. Bramble rival frontiers.');
  save();if(LAYOUT)updateHud();
}

// ---------- persistence ----------
function save(){try{localStorage.setItem('bramble-save-v1',JSON.stringify({seedStr:S.seedStr,owner:S.owner,brambles:S.brambles,routes:S.routes,turn:S.turn,ink:S.ink,coins:S.coins,rivalCoins:S.rivalCoins,stock:S.stock,rivalStock:S.rivalStock,over:S.over}))}catch(e){}}
function load(){try{const d=JSON.parse(localStorage.getItem('bramble-save-v1')||'null');return d}catch(e){return null}}
function bestGet(seed){try{return +(localStorage.getItem('bramble-best-'+seed)||0)}catch(e){return 0}}
function bestSet(seed,v){try{if(v>bestGet(seed))localStorage.setItem('bramble-best-'+seed,String(v))}catch(e){}}

// ---------- scoring ----------
function counts(){const c={you:0,volt:0,thorn:0};for(const o of Object.values(S.owner))c[o]++;return c}
function interior(player){
  let n=0;
  for(const[k,o]of Object.entries(S.owner)){if(o!==player)continue;
    const[q,r]=k.split(',').map(Number);
    const allN=DIRS.map(([dq,dr])=>key(q+dq,r+dr));
    if(allN.every(x=>S.owner[x]===player||S.brambles.includes(x)||!HEXSET.has(x)))n++;
  }
  return n;
}
function scoreOf(p){const c=counts()[p];const coins=p==='you'?S.coins:S.rivalCoins[p];return c*10+coins+interior(p)*15}

// ---------- layout / render ----------
function computeLayout(){
  const wrapW=canvas.clientWidth||640, aspectH=wrapW*15/16;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(wrapW*dpr);canvas.height=Math.round(aspectH*dpr);
  const wU=Math.sqrt(3)*(2*R+1)+1, hU=3*R+2;
  const size=Math.min(canvas.width/wU,canvas.height/hU);
  LAYOUT={cx:canvas.width/2,cy:canvas.height/2-4*dpr,size,dpr};
}
function center(q,r){const{size,cx,cy}=LAYOUT;return{x:cx+size*Math.sqrt(3)*(q+r/2),y:cy+size*1.5*r}}
function corners(x,y,size){const p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);p.push([x+size*0.92*Math.cos(a),y+size*0.92*Math.sin(a)])}return p}
function pixelToHex(px,py){const{size,cx,cy}=LAYOUT;const x=px-cx,y=py-cy;
  const q=(Math.sqrt(3)/3*x-1/3*y)/size, r=(2/3*y)/size;
  let cx0=Math.round(q),cy0=Math.round(r),cz0=Math.round(-q-r);
  const dq=Math.abs(cx0-q),dr=Math.abs(cy0-r),ds=Math.abs(cz0+q+r);
  if(dq>dr&&dq>ds)cx0=-cy0-cz0;else if(dr>ds)cy0=-cx0-cz0;
  const k=key(cx0,cy0);return HEXSET.has(k)?{q:cx0,r:cy0,k}:null;
}
const TCOL={plain:'#1c1038',fertile:'#12351f',crystal:'#0b2c3a',wild:'#241a33'};
const OCOL={you:'#ff2e88',volt:'#22e6ff',thorn:'#ffb02e'};

function validPaintTargets(){
  const out=new Set();
  const mine=Object.entries(S.owner).filter(([,o])=>o==='you').map(([k])=>k);
  const frontier=new Set();for(const k of mine){const[q,r]=k.split(',').map(Number);for(const n of nbr(q,r))frontier.add(n)}
  for(const k of frontier){
    if(S.owner[k]||S.brambles.includes(k))continue;
    out.add(k);
  }
  return out;
}
function rivalFrontier(who){
  const mine=Object.entries(S.owner).filter(([,o])=>o===who).map(([k])=>k);
  const out=new Set();for(const k of mine){const[q,r]=k.split(',').map(Number);for(const n of nbr(q,r))out.add(n)}
  return [...out].filter(k=>!S.owner[k]&&!S.brambles.includes(k));
}

let T0=performance.now(), frames=0;
function render(now){
  if(!S||!LAYOUT)return;
  requestAnimationFrame(render);
  const t=((now||performance.now())-T0)/1000;
  const{size,dpr}=LAYOUT;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // horizon glow
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#ff2e8814');g.addColorStop(.5,'#00000000');g.addColorStop(1,'#8a5cff22');
  ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  const valid=S.over?new Set():validPaintTargets();
  const sealedCells=new Set(S.routes.flatMap(r=>r.cells));
  for(const h of HEXES){
    const k=key(h.q,h.r),{x,y}=center(h.q,h.r);
    const c=corners(x,y,size);
    // base
    ctx.beginPath();c.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
    ctx.fillStyle=TCOL[S.terrain[k]];ctx.fill();
    const o=S.owner[k];
    if(o){ctx.save();ctx.shadowColor=OCOL[o];ctx.shadowBlur=18*dpr;ctx.fillStyle=OCOL[o]+'55';ctx.fill();ctx.restore();
      ctx.strokeStyle=OCOL[o];ctx.lineWidth=2.4*dpr;ctx.stroke();
      // inner tint
      ctx.beginPath();c.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
      ctx.fillStyle=OCOL[o]+'2e';ctx.fill();
    }else{
      ctx.strokeStyle=S.brambles.includes(k)?'#7cff2e':'#4a3670';ctx.lineWidth=(S.hover===k?2.6:1.2)*dpr;ctx.stroke();
    }
    // terrain deco (canvas only, no images)
    if(S.terrain[k]==='fertile'&&!o){ctx.fillStyle='#3dff8e';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(x+i*size*.22,y,size*.05,0,7);ctx.fill()}}
    if(S.terrain[k]==='crystal'){ctx.save();ctx.translate(x,y-size*.28);ctx.rotate(Math.PI/4);ctx.fillStyle='#22e6ff';ctx.shadowColor='#22e6ff';ctx.shadowBlur=10*dpr;const d=size*.13;ctx.fillRect(-d,-d,2*d,2*d);ctx.restore()}
    if(S.terrain[k]==='wild'&&!o){ctx.strokeStyle='#6b5a8a';ctx.lineWidth=1*dpr;ctx.beginPath();ctx.moveTo(x-size*.25,y);ctx.lineTo(x+size*.25,y);ctx.moveTo(x,y-size*.25);ctx.lineTo(x,y+size*.25);ctx.stroke()}
    if(S.hqs[k]){ // HQ: bold ring + letter
      ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2*dpr;ctx.shadowColor=OCOL[S.hqs[k]];ctx.shadowBlur=14*dpr;
      ctx.beginPath();ctx.arc(x,y,size*.3,0,7);ctx.stroke();ctx.restore();
      ctx.fillStyle='#fff';ctx.font=`700 ${Math.round(size*.34)}px 'Space Grotesk',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(S.hqs[k]==='you'?'YOU'.slice(0,1):S.hqs[k][0].toUpperCase(),x,y+1);
    }
    if(S.brambles.includes(k)){ // thorn vines: spiky cross-hatch
      ctx.save();ctx.strokeStyle='#7cff2e';ctx.shadowColor='#7cff2e';ctx.shadowBlur=8*dpr;ctx.lineWidth=1.8*dpr;
      for(let i=0;i<3;i++){const a=Math.PI/3*i+t*.3;ctx.beginPath();
        ctx.moveTo(x-Math.cos(a)*size*.4,y-Math.sin(a)*size*.4);
        ctx.quadraticCurveTo(x,y-size*.1,x+Math.cos(a)*size*.4,y+Math.sin(a)*size*.4);ctx.stroke();
        for(let j=-1;j<=1;j+=2){ctx.beginPath();const bx=x+Math.cos(a)*size*.15*j,by=y+Math.sin(a)*size*.15*j;
          ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(a+1.2)*size*.16,by+Math.sin(a+1.2)*size*.16);ctx.stroke()}}
      ctx.restore();
    }
    // route draft + sealed highlight
    if(S.draft.includes(k)){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=3*dpr;ctx.shadowColor='#22e6ff';ctx.shadowBlur=12*dpr;ctx.stroke();ctx.restore()}
    if(sealedCells.has(k)&&S.owner[k]==='you'){ctx.fillStyle='#ffe95e';ctx.beginPath();ctx.arc(x,y+size*.32,size*.06,0,7);ctx.fill()}
    // valid pulse
    if(valid.has(k)&&S.tool==='paint'){
      const p=(Math.sin(t*4+x*.01)+1)/2;
      ctx.save();ctx.strokeStyle=`rgba(255,46,136,${.5+.5*p})`;ctx.lineWidth=(2+2*p)*dpr;ctx.shadowColor='#ff2e88';ctx.shadowBlur=14*dpr;ctx.stroke();ctx.restore();
    }
    if(S.hover===k&&!S.over){ctx.save();ctx.strokeStyle='#fff';ctx.setLineDash([6*dpr,4*dpr]);ctx.lineWidth=1.6*dpr;ctx.stroke();ctx.restore()}
    if(S.flash[k]&&performance.now()<S.flash[k]){ctx.save();ctx.globalAlpha=(S.flash[k]-performance.now())/600;ctx.fillStyle='#fff';ctx.fill();ctx.restore()}
  }
  // sealed routes
  for(const rt of S.routes){strokeRoute(rt.cells,OCOL[rt.by]||'#fff',3.2)}
  if(S.draft.length>1)strokeRoute(S.draft,'#ffffff',2.4,true);
  if(++frames%10===0)updateHud();
}
function strokeRoute(cells,color,w,dash){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w*(LAYOUT?LAYOUT.dpr:1);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor=color;ctx.shadowBlur=12;if(dash)ctx.setLineDash([8,6]);
  ctx.beginPath();cells.forEach((k,i)=>{const[q,r]=k.split(',').map(Number);const{x,y}=center(q,r);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.stroke();ctx.restore();
  // joints
  ctx.save();ctx.fillStyle=color;
  for(const k of cells){const[q,r]=k.split(',').map(Number);const{x,y}=center(q,r);ctx.beginPath();ctx.arc(x,y,3.4*((LAYOUT&&LAYOUT.dpr)||1),0,7);ctx.fill()}
  ctx.restore();
}

// ---------- hud / log / toast ----------
function updateHud(){
  $('statTurn').textContent=S.turn;
  const ink=$('statInk');ink.textContent='●'.repeat(S.ink)+'○'.repeat(Math.max(0,START_INK-S.ink));ink.classList.toggle('low',S.ink<=1);
  const c=counts();
  $('statYou').textContent=c.you;$('statVolt').textContent=c.volt;$('statThorn').textContent=c.thorn;
  $('statCoins').textContent=S.coins+' ⬡';
  $('scoreYou').textContent=scoreOf('you');$('scoreVolt').textContent=scoreOf('volt');$('scoreThorn').textContent=scoreOf('thorn');
  $('seedName').textContent=S.seedStr;
  const w=parseWeekSeed(S.seedStr);
  $('seedMeta').textContent=w?`year ${w.year} · week ${String(w.week).padStart(2,'0')} · 61 hexes`:'custom map · 61 hexes';
  const b=bestGet(S.seedStr);$('bestSeed').textContent=b?b+' pts':'—';
  const canSeal=S.draft.length>=3&&!S.over;
  $('btnSeal').disabled=!canSeal;$('btnCancelRoute').disabled=!S.draft.length||S.over;
  $('btnEndTurn').disabled=S.over;
}
function log(msg){const li=document.createElement('li');li.innerHTML=msg;logEl.prepend(li);while(logEl.children.length>40)logEl.lastChild.remove()}
let toastT=null;
function toast(msg){toastEl.hidden=false;toastEl.textContent=msg;clearTimeout(toastT);toastT=setTimeout(()=>toastEl.hidden=true,2200)}
function blip(f=440,d=.07,type='square',v=.05){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const a=AC,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.stop(a.currentTime+d)}catch(e){}}

// ---------- actions ----------
function tryPaint(k){
  if(S.over)return;
  if(S.owner[k]){toast('Already claimed.');return}
  if(S.brambles.includes(k)){toast('Brambled — impassable.');blip(160,.1,'sawtooth');return}
  const cost=S.terrain[k]==='wild'?2:1;
  if(S.ink<cost){toast(`Need ${cost} ink — end turn to refill.`);blip(160,.12,'sawtooth');return}
  const[q,r]=k.split(',').map(Number);
  const adj=nbr(q,r).some(n=>S.owner[n]==='you');
  if(!adj){toast('Paint next to your territory.');return}
  S.owner[k]='you';S.ink-=cost;S.flash[k]=performance.now()+600;
  if(S.terrain[k]==='fertile'){S.coins+=2;log(`Fertile hex claimed <b>+2⬡</b>`)}
  if(S.terrain[k]==='crystal'){S.coins+=6;log(`Crystal anchor claimed <b>+6⬡</b>`);blip(880,.12,'sine')}
  blip(520+Math.random()*120,.06);
  log(`Claimed hex ${cost} ink.`);
  checkEncircle('you');save();
  if(S.ink<=0)toast('Out of ink — seal routes or end turn.');
}
function routeClick(k){
  if(S.over)return;
  if(S.owner[k]!=='you'){toast('Routes run on YOUR hexes.');return}
  if(S.routes.some(rt=>rt.cells.includes(k))){toast('Hex already in a sealed route.');return}
  if(!S.draft.length){S.draft=[k];blip(660,.06,'sine')}
  else{
    const last=S.draft[S.draft.length-1];
    if(k===last){S.draft.pop();blip(300,.06)}
    else{
      const[lq,lr]=last.split(',').map(Number);
      if(!nbr(lq,lr).includes(k)){toast('Route must step to a neighbor.');return}
      if(S.draft.includes(k)){toast('No loops — pick a new hex.');return}
      S.draft.push(k);blip(660+S.draft.length*40,.06,'sine');
    }
  }
  hint(`Route: ${S.draft.length} links${S.draft.length>=3?' — SEAL it for coins!':S.draft.length?' — add '+(3-S.draft.length)+' more to seal':''}`);
}
function winding(cells){
  if(cells.length<3)return 0;
  let turns=0,prev=null;
  for(let i=1;i<cells.length;i++){
    const[a,b]=cells[i-1].split(',').map(Number),[c,d]=cells[i].split(',').map(Number);
    const dir=(c-a)+','+(d-b);
    if(prev&&prev!==dir)turns++;prev=dir;
  }
  return turns;
}
function sealRoute(){
  if(S.draft.length<3)return;
  const cells=[...S.draft];
  const fertile=cells.filter(k=>S.terrain[k]==='fertile').length;
  const crystal=cells.filter(k=>S.terrain[k]==='crystal').length;
  const coins=cells.length*cells.length+fertile*2+crystal*6+winding(cells)*3;
  S.coins+=coins;S.routes.push({cells,coins,by:'you'});
  log(`Route sealed: ${cells.length} links, ${winding(cells)} bends → <b>+${coins}⬡</b>`);
  toast(`Route sealed +${coins}⬡`);blip(920,.18,'triangle');
  S.draft=[];hint('Route sealed. Paint more, or wind another.');save();
}
function tryBramble(k){
  if(S.over)return;
  if(S.stock<=0){toast('Out of brambles (5 per game).');return}
  if(S.ink<2){toast('Bramble costs 2 ink.');return}
  if(S.owner[k]||S.brambles.includes(k)){toast('Must bramble an OPEN hex.');return}
  S.brambles.push(k);S.ink-=2;S.stock--;S.flash[k]=performance.now()+600;
  blip(220,.12,'sawtooth');log(`Bramble grown (${S.stock} left). Rivals can't cross it.`);
  checkEncircle('you');save();
}
function checkEncircle(who){
  const n=interior(who);
  if(n>0&&who==='you')hint(`Enclosed core: ${n} ringed hex${n>1?'es':''} (+${n*15} pts). Beautiful walls.`);
}
function hint(m){hintEl.textContent=m}

// ---------- rivals ----------
function hexValue(k){return S.terrain[k]==='crystal'?4:S.terrain[k]==='fertile'?3:S.terrain[k]==='plain'?2:1}
function aiTurn(){
  for(const who of ['volt','thorn']){
    if(S.over)break;
    const front=rivalFrontier(who);
    if(!front.length)continue;
    front.sort((a,b)=>hexValue(b)-hexValue(a));
    const c=counts();
    const losing=(who==='volt'?scoreOf('volt')<scoreOf('you'):scoreOf('thorn')<scoreOf('you'));
    let claims=2;
    // aggressive bramble when behind
    if(losing&&S.rivalStock[who]>0&&Math.random()<0.4){
      const prey=rivalFrontier('you').sort((a,b)=>hexValue(b)-hexValue(a))[0];
      if(prey){S.brambles.push(prey);S.rivalStock[who]--;log(`<b>${who.toUpperCase()}</b> brambles your frontier!`);claims=1;}
    }
    for(let i=0;i<claims&&front.length;i++){
      const k=front.shift();
      if(S.owner[k]||S.brambles.includes(k))continue;
      S.owner[k]=who;S.flash[k]=performance.now()+600;
      if(S.terrain[k]==='fertile')S.rivalCoins[who]+=2;
      if(S.terrain[k]==='crystal')S.rivalCoins[who]+=6;
    }
  }
}
function endTurn(){
  if(S.over)return;
  S.draft=[];
  aiTurn();
  S.turn++;S.ink=START_INK;
  blip(330,.1,'square');
  if(S.turn>MAX_TURNS){gameOver();return}
  const c=counts();
  log(`Turn ${S.turn}: you <b>${c.you}</b> · volt <b>${c.volt}</b> · thorn <b>${c.thorn}</b>. Ink refilled.`);
  hint(S.turn>=MAX_TURNS-2?'Final turns — seal a route, close your rings!':'Paint glowing hexes next to your territory.');
  save();
}
function gameOver(){
  S.over=true;save();
  const y=scoreOf('you'),v=scoreOf('volt'),t=scoreOf('thorn');
  bestSet(S.seedStr,y);
  const win=y>=v&&y>=t;
  $('endTitle').textContent=win?'★ YOU WIN ★':(v>=t?'VOLT PREVAILS':'THORN PREVAILS');
  $('endBody').textContent=win
    ?`Master cartographer! ${y} pts seals the week ${S.seedStr}.`
    :`You scored ${y} pts. Rival best ${Math.max(v,t)} pts. Re-survey the seed and try a windier line.`;
  $('endYou').textContent='YOU '+y;$('endVolt').textContent='VOLT '+v;$('endThorn').textContent='THORN '+t;
  $('modalEnd').hidden=false;blip(win?880:220,.3,'triangle');
}

// ---------- input ----------
function evtHex(e){
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)/rect.width*canvas.width;
  const py=(e.clientY-rect.top)/rect.height*canvas.height;
  return pixelToHex(px,py);
}
canvas.addEventListener('pointerdown',e=>{
  if(S.over)return;
  const h=evtHex(e);if(!h)return;
  canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);
  if(S.tool==='paint'){S.painting=true;tryPaint(h.k)}
  else if(S.tool==='route')routeClick(h.k);
  else tryBramble(h.k);
});
canvas.addEventListener('pointermove',e=>{
  const h=evtHex(e);S.hover=h?h.k:null;
  if(S.painting&&S.tool==='paint'&&h)tryPaint(h.k);
});
window.addEventListener('pointerup',()=>S.painting=false);
canvas.addEventListener('pointerleave',()=>{S.hover=null;S.painting=false});

// ---------- toolbar / seed ui ----------
function setTool(t){
  S.tool=t;S.draft=[];
  for(const b of document.querySelectorAll('.tool'))b.classList.toggle('active',b.dataset.tool===t);
  hint(t==='paint'?'Paint glowing hexes next to your territory.':t==='route'?'ROUTE: tap your hexes in a chain, then SEAL (3+ links).':'BRAMBLE: tap any open hex to block rivals (2 ink).');
  blip(500,.05);
}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('btnSeal').addEventListener('click',sealRoute);
$('btnCancelRoute').addEventListener('click',()=>{S.draft=[];hint('Route cleared.')});
$('btnEndTurn').addEventListener('click',endTurn);
$('btnHow').addEventListener('click',()=>$('modalHow').hidden=false);
$('btnCloseHow').addEventListener('click',()=>$('modalHow').hidden=true);
$('modalHow').addEventListener('click',e=>{if(e.target.id==='modalHow')$('modalHow').hidden=true});
$('btnRestart').addEventListener('click',()=>{if(confirm('Restart this map?'))newGame(S.seedStr)});
$('btnAgain').addEventListener('click',()=>{$('modalEnd').hidden=true;newGame(S.seedStr)});
$('btnNextSeed').addEventListener('click',()=>{$('modalEnd').hidden=true;shiftWeek(1)});
window.addEventListener('keydown',e=>{
  if(e.key==='1')setTool('paint');if(e.key==='2')setTool('route');if(e.key==='3')setTool('bramble');
  if(e.key==='Enter'&&$('modalEnd').hidden)endTurn();
  if(e.key==='Escape'){S.draft=[];$('modalHow').hidden=true}
});
function currentWeekSeed(){const{year,week}=isoWeek();return weekSeed(year,week)}
function shiftWeek(d){
  const w=parseWeekSeed(S.seedStr);
  let y,week;
  if(w){y=w.year;week=w.week+d;if(week<1){week=52;y--}if(week>52){week=1;y++}}
  else{const n=isoWeek();y=n.year;week=Math.min(52,Math.max(1,n.week+d))}
  newGame(weekSeed(y,week));
}
$('btnPrevWeek').addEventListener('click',()=>shiftWeek(-1));
$('btnNextWeek').addEventListener('click',()=>shiftWeek(1));
$('btnThisWeek').addEventListener('click',()=>newGame(currentWeekSeed()));
$('btnSeedGo').addEventListener('click',()=>{
  const v=$('seedInput').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,24);
  if(!v){toast('Type a seed first.');return}
  newGame(v);$('seedInput').value='';
});
$('btnSeedRandom').addEventListener('click',()=>newGame('WILD-'+Math.random().toString(36).slice(2,7).toUpperCase()));
$('btnCopySeed').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(S.seedStr);toast('Seed copied: '+S.seedStr)}
  catch(e){prompt('Copy this seed:',S.seedStr)}
});
window.addEventListener('resize',()=>{computeLayout()});

// ---------- boot ----------
(function boot(){
  computeLayout();
  const saved=load();
  const def=currentWeekSeed();
  if(saved&&saved.seedStr&&!saved.over){
    // rebuild terrain deterministically from seed, then overlay save
    newGame(saved.seedStr);
    S.owner=saved.owner||S.owner;S.brambles=saved.brambles||[];S.routes=saved.routes||[];
    S.turn=saved.turn||1;S.ink=(saved.ink??START_INK);S.coins=saved.coins||0;
    S.rivalCoins=saved.rivalCoins||{volt:0,thorn:0};S.stock=(saved.stock??BRAMBLE_STOCK);
    S.rivalStock=saved.rivalStock||{volt:3,thorn:3};
    log(`Restored your survey of <b>${S.seedStr}</b> (turn ${S.turn}).`);
  }else newGame(def);
  updateHud();
  requestAnimationFrame(render);
})();
