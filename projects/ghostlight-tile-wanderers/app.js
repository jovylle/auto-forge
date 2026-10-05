// Ghostlight Tile Wanderers — fog-of-war maze, territory paint/steal, daily seed, beacon shortcuts.
// Keyboard only: arrows/WASD move, B beacon, 1-3 blink, E carve wall, R restart, N today.
const N = 15, RADIUS = 3, LANTERNS = 6, WIN_PCT = 55, MAX_BEACONS = 3, MAX_CARVE = 3;
const board = document.getElementById("board");
board.style.setProperty("--n", N);
const $ = (id) => document.getElementById(id);
const msgEl = $("msg"), seedDateEl = $("seedDate"), seedNumEl = $("seedNum");

let S = null; // state

// --- seeded rng (mulberry32 + xmur3) ---
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return(h^=h>>>16)>>>0}}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const dayKey = (d) => d.toISOString().slice(0,10);
const seedOf = (k) => xmur3("ghostlight-"+k)();

// --- maze gen: randomized DFS on odd grid, seeded ---
function genMaze(seed){
  const rnd = mulberry32(seed);
  const wall = Array.from({length:N},()=>Array(N).fill(1));
  const stack=[[1,1]]; wall[1][1]=0;
  const dirs=[[2,0],[-2,0],[0,2],[0,-2]];
  while(stack.length){
    const [cx,cy]=stack[stack.length-1];
    const opts=[];
    for(const[dx,dy]of dirs){const nx=cx+dx,ny=cy+dy;
      if(nx>0&&ny>0&&nx<N-1&&ny<N-1&&wall[ny][nx]===1)opts.push([dx,dy]);}
    if(!opts.length){stack.pop();continue}
    const[dx,dy]=opts[(rnd()*opts.length)|0];
    wall[cy+dy/2][cx+dx/2]=0; wall[cy+dy][cx+dx]=0;
    stack.push([cx+dx,cy+dy]);
  }
  // knock a few extra loops so territory routes exist
  let extra = 14;
  while(extra-->0){const x=1+((rnd()*(N-2))|0),y=1+((rnd()*(N-2))|0);
    if(wall[y][x]===1&&!(x===1&&y===1))wall[y][x]=0;}
  return wall;
}
const openTiles = (wall) => {const t=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!wall[y][x])t.push([x,y]);return t};

function newGame(dateKey){
  const seed = seedOf(dateKey);
  const wall = genMaze(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const open = openTiles(wall);
  const far = [...open].sort((a,b)=>(Math.hypot(b[0]-1,b[1]-1))-(Math.hypot(a[0]-1,a[1]-1)));
  const lanterns = new Map();
  for(let i=0;i<LANTERNS && i<far.length;i++){
    const [x,y]=far[(i*7+3)%far.length];
    lanterns.set(x+","+y,{x,y,lit:false});
  }
  S = {
    dateKey, seed, wall, open: open.length,
    px:1, py:1, wx:N-2, wy:N-2,
    owner:new Map(), explored:new Set(), vis:new Set(),
    beacons:[], carves:MAX_CARVE, moves:0, lanternsLit:0, lanterns,
    turn:0, won:false, wispTick:0,
  };
  S.owner.set("1,1","you");
  loadProgress();
  computeVis();
  paintInitial();
  render(); updateHud();
  say(`Seed ${dateKey} wakes. Claim ${WIN_PCT}% + ${LANTERNS} lanterns. Arrows/WASD to wander.`);
  board.focus({preventScroll:true});
}

function paintInitial(){
  // wisp starts with a small home blot so stealing matters immediately
  const cands = S.open ? neighbors(S.wx,S.wy).concat([[S.wx,S.wy]]) : [];
  for(const [x,y] of cands) if(!S.wall[y][x]) S.owner.set(x+","+y,"wisp");
}

// --- fog of war: radius + Bresenham line-of-sight through walls ---
function los(x0,y0,x1,y1){
  let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0);
  let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx+dy, x=x0, y=y0;
  while(!(x===x1&&y===y1)){
    if(!(x===x0&&y===y0)&&!(x===x1&&y===y1)&&S.wall[y]&&S.wall[y][x])return false;
    const e2=2*err;
    if(e2>=dy){err+=dy;x+=sx} if(e2<=dx){err+=dx;y+=sy}
  }
  return true;
}
function computeVis(){
  S.vis.clear();
  for(let y=Math.max(0,S.py-RADIUS);y<=Math.min(N-1,S.py+RADIUS);y++)
    for(let x=Math.max(0,S.px-RADIUS);x<=Math.min(N-1,S.px+RADIUS);x++){
      if(Math.abs(x-S.px)+Math.abs(y-S.py)>RADIUS+1)continue;
      if(los(S.px,S.py,x,y)){S.vis.add(x+","+y);S.explored.add(x+","+y);}
    }
}
const neighbors=(x,y)=>[[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([a,b])=>a>=0&&b>=0&&a<N&&b<N);

// --- persistence ---
const lsKey = () => "ghostlight-"+S.dateKey;
function saveProgress(){
  if(!S||S.won)return;
  try{localStorage.setItem(lsKey(),JSON.stringify({
    px:S.px,py:S.py,owner:[...S.owner],explored:[...S.explored],
    beacons:S.beacons,carves:S.carves,moves:S.moves,
    lit:[...S.lanterns.values()].filter(l=>l.lit).map(l=>l.x+","+l.y),
  }))}catch{}
}
function loadProgress(){
  try{
    const raw=localStorage.getItem(lsKey()); if(!raw)return;
    const d=JSON.parse(raw);
    if(typeof d.px==="number"&&!S.wall[d.py]?.[d.px]){S.px=d.px;S.py=d.py}
    if(Array.isArray(d.owner))for(const[k,v]of d.owner)if(v==="you"||v==="wisp")S.owner.set(k,v);
    if(Array.isArray(d.explored))for(const k of d.explored)S.explored.add(k);
    if(Array.isArray(d.beacons))S.beacons=d.beacons.filter(b=>!S.wall[b.y]?.[b.x]).slice(0,MAX_BEACONS);
    if(typeof d.carves==="number")S.carves=Math.max(0,Math.min(MAX_CARVE,d.carves));
    if(typeof d.moves==="number")S.moves=d.moves;
    if(Array.isArray(d.lit))for(const k of d.lit){const l=S.lanterns.get(k);if(l&&!l.lit){l.lit=true;S.lanternsLit++}}
  }catch{}
}
function bestGet(){try{return JSON.parse(localStorage.getItem("ghostlight-best")||"{}")}catch{return{}}}
function bestSet(k,v){try{const b=bestGet();b[k]=v;localStorage.setItem("ghostlight-best",JSON.stringify(b))}catch{}}

// --- actions ---
function tryMove(dx,dy){
  if(!S||S.won)return;
  const nx=S.px+dx, ny=S.py+dy;
  if(nx<0||ny<0||nx>=N||ny>=N||S.wall[ny][nx]){bump();return}
  S.px=nx;S.py=ny;S.moves++;
  claim(nx,ny);
  const l=S.lanterns.get(nx+","+ny);
  if(l&&!l.lit){l.lit=true;S.lanternsLit++;say(`🏮 lantern lit (${S.lanternsLit}/${LANTERNS}) — the fog recoils.`);flash();}
  computeVis(); wispMove(); checkWin(); saveProgress(); render(); updateHud();
}
function claim(x,y){
  const k=x+","+y, prev=S.owner.get(k);
  S.owner.set(k,"you");
  if(prev==="wisp")say("⚔️ stole wisp ink at "+x+","+y+". Keep pushing.");
}
function wispMove(){
  // wisp wanders every other player move, paints floor
  if(++S.wispTick%2)return;
  const opts=neighbors(S.wx,S.wy).filter(([x,y])=>!S.wall[y][x]);
  if(!opts.length)return;
  // drift toward unclaimed / player tiles to create steal pressure
  opts.sort((a,b)=>scoreW(a)-scoreW(b));
  const [x,y]=opts[opts.length-1];
  S.wx=x;S.wy=y;
  const k=x+","+y, prev=S.owner.get(k);
  if(prev!=="wisp"){S.owner.set(k,"wisp");if(prev==="you")say("👺 the wisp stole your tile! Take it back.");}
}
function scoreW([x,y]){
  const k=x+","+y, o=S.owner.get(k);
  return (o==="you"?3:o?0:2) + ((x+S.turn*7+y*13)%3)*0.1 + (x===S.px&&y===S.py?5:0);
}
function dropBeacon(){
  if(!S||S.won)return;
  const k=S.px+","+S.py;
  if(S.beacons.some(b=>b.x===S.px&&b.y===S.py)){say("A beacon already hums here.");return}
  if(S.beacons.length>=MAX_BEACONS){S.beacons.shift();say("Oldest beacon fades — new one carved.");}
  else say(`🔱 beacon ${S.beacons.length+1} carved. Press ${S.beacons.length+1} to blink back.`);
  S.beacons.push({x:S.px,y:S.py});
  computeVis();saveProgress();render();updateHud();
}
function blink(i){
  if(!S||S.won)return;
  const b=S.beacons[i];
  if(!b){say(`No beacon ${i+1} yet — press B to carve one.`);return}
  S.px=b.x;S.py=b.y;S.moves++;
  claim(b.x,b.y);computeVis();wispMove();checkWin();saveProgress();render();updateHud();
  say(`✨ blinked to beacon ${i+1}. Shortcut charted.`);
}
function carve(){
  if(!S||S.won)return;
  if(S.carves<=0){say("Chisel is spent — no wall-carves left.");return}
  const w=neighbors(S.px,S.py).find(([x,y])=>S.wall[y]?.[x]&&(x>0&&y>0&&x<N-1&&y<N-1));
  if(!w){say("No carvable wall beside you (borders hold).");return}
  S.wall[w[1]][w[0]]=0;S.carves--;S.moves++;
  say(`⛏️ carved a shortcut! ${S.carves} carve${S.carves===1?"":"s"} left.`);
  computeVis();saveProgress();render();updateHud();
}
function checkWin(){
  let you=0;for(const o of S.owner.values())if(o==="you")you++;
  const pct=you/S.open*100;
  if(pct>=WIN_PCT&&S.lanternsLit>=LANTERNS&&!S.won){
    S.won=true;
    const b=bestGet()[S.dateKey];
    const score=S.moves;
    if(!b||score<b)bestSet(S.dateKey,score);
    try{localStorage.removeItem(lsKey())}catch{}
    $("winCard").hidden=false;
    $("winText").textContent=`${S.dateKey} charted in ${score} moves — ${pct.toFixed(0)}% painted, ${S.lanternsLit} lanterns.`;
    say("✨ maze charted! You win.");
  }
}

// --- rendering ---
let cells=[];
function render(){
  if(!cells.length){
    board.innerHTML="";
    board.style.setProperty("--n",N);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const d=document.createElement("div");
      d.className="cell";d.setAttribute("role","gridcell");
      board.appendChild(d);cells.push(d);
    }
  }
  const bIdx=new Map(S.beacons.map((b,i)=>[b.x+","+b.y,i+1]));
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const d=cells[y*N+x], k=x+","+y;
    const isWall=!!S.wall[y][x], vis=S.vis.has(k), exp=S.explored.has(k);
    const o=S.owner.get(k), lan=S.lanterns.get(k);
    let cls="cell "+(isWall?"wall":"floor")+(vis?" vis":exp?" explored":"")+(!vis&&!exp?" fog":"");
    if(!isWall&&o==="you")cls+=" mine"; if(!isWall&&o==="wisp")cls+=" wisp";
    if(lan&&!lan.lit&&exp)cls+=" lantern"; if(lan&&lan.lit&&vis)cls+=" lit";
    if(x===S.px&&y===S.py)cls+=" player"; if(x===S.wx&&y===S.wy&&vis)cls+=" wispHere";
    if(bIdx.has(k)&&exp)cls+=" beacon";
    d.className=cls;
    if(bIdx.has(k)&&exp)d.dataset.b=bIdx.get(k);else delete d.dataset.b;
    let glyph="";
    if(x===S.px&&y===S.py)glyph="👻";
    else if(x===S.wx&&y===S.wy&&vis)glyph="👺";
    else if(lan&&lan.lit&&vis)glyph="";
    d.textContent=(vis||exp)?glyph:"";
    d.setAttribute("aria-label",
      isWall?"wall":`${vis?"visible":"hidden"} tile ${o==="you"?"painted yours":o==="wisp"?"wisp ink":"unclaimed"}`+
      (lan?(lan.lit?" lantern lit":" lantern"):"")+(x===S.px&&y===S.py?" — you are here":""));
  }
}
function updateHud(){
  let you=0,wisp=0;for(const o of S.owner.values()){if(o==="you")you++;if(o==="wisp")wisp++}
  const yp=you/S.open*100, wp=wisp/S.open*100, ep=S.explored.size/(S.open)*100;
  $("stYou").textContent=yp.toFixed(0)+"%";$("barYou").style.width=Math.min(100,yp)+"%";
  $("stWisp").textContent=wp.toFixed(0)+"%";$("barWisp").style.width=Math.min(100,wp)+"%";
  $("stFog").textContent=ep.toFixed(0)+"%";
  $("stLan").textContent=`${S.lanternsLit}/${LANTERNS}`;
  $("stMoves").textContent=S.moves;
  seedDateEl.textContent=S.dateKey;seedNumEl.textContent="seed #"+(S.seed>>>0).toString(16);
  const b=bestGet()[S.dateKey];
  $("bestLine").textContent="best on this seed: "+(b?b+" moves":"—")+
    ` · beacons ${S.beacons.length}/${MAX_BEACONS} · carves ${S.carves}/${MAX_CARVE}`;
  $("winCard").hidden=!S.won;
}
let msgT=null;
function say(t){msgEl.textContent=t;clearTimeout(msgT);msgT=setTimeout(()=>{if(!S?.won)msgEl.textContent="Arrows/WASD wander · B beacon · 1-3 blink · E carve";},4200)}
function bump(){board.animate([{transform:"translate(0,0)"},{transform:"translate(2px,0)"},{transform:"translate(0,0)"}],{duration:90});}
function flash(){board.animate([{filter:"brightness(1)"},{filter:"brightness(1.5)"},{filter:"brightness(1)"}],{duration:350});}

// --- input: keyboard only ---
const MOVES={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]};
document.addEventListener("keydown",(e)=>{
  if(e.key==="Tab")return; // let focus move, board stays operable
  const tag=(document.activeElement?.tagName||"").toLowerCase();
  if(tag==="button"&&(e.key===" "||e.key==="Enter"))return; // don't hijack buttons
  if(MOVES[e.key]!==undefined){e.preventDefault();const[dx,dy]=MOVES[e.key];tryMove(dx,dy);return}
  const k=e.key.toLowerCase();
  if(k==="b"){e.preventDefault();dropBeacon()}
  else if(k==="e"){e.preventDefault();carve()}
  else if(k==="r"){e.preventDefault();restart()}
  else if(k==="n"){e.preventDefault();newGame(dayKey(new Date()))}
  else if(k==="1"||k==="2"||k==="3"){e.preventDefault();blink(+k-1)}
});
$("btnReset").addEventListener("click",restart);
$("btnAgain").addEventListener("click",restart);
$("btnToday").addEventListener("click",()=>newGame(dayKey(new Date())));
$("btnPrev").addEventListener("click",()=>shiftDay(-1));
$("btnNext").addEventListener("click",()=>shiftDay(1));
function shiftDay(d){
  const dt=new Date(S.dateKey+"T12:00:00Z");dt.setUTCDate(dt.getUTCDate()+d);
  newGame(dayKey(dt));
}
function restart(){cells=[];$("winCard").hidden=true;newGame(S?S.dateKey:dayKey(new Date()));}

newGame(dayKey(new Date()));
