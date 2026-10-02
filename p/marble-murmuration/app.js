// extracted mirror of index.html inline script

"use strict";
/* Marble Murmuration — boids + marble flow-field over synthwave map. Scroll-reactive. */
const $=id=>document.getElementById(id);
const canvas=$("murm"),ctx=canvas.getContext("2d");
const toast=(m)=>{const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),1800);};

// --- seeded rng ---
let seed=(Math.random()*1e9)|0;
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let rnd=mulberry(seed);

// --- state (URL hash + localStorage) ---
const PALS={sunset:[[255,46,136],[255,154,61],[255,240,170],[34,230,255],[123,47,255]],
  chrome:[[34,230,255],[220,240,255],[255,46,136],[150,120,255],[255,255,255]],
  abyss:[[34,230,255],[64,255,170],[123,47,255],[255,46,136],[10,10,40]]};
const S={n:220,speed:1,swirl:1,trail:.86,pal:"sunset",magnet:true,paused:false};
function loadState(){
  try{const h=new URLSearchParams(location.hash.slice(1));
    if(h.get("seed"))seed=parseInt(h.get("seed"))>>>0;
    if(h.get("pal")&&PALS[h.get("pal")])S.pal=h.get("pal");
    if(h.get("n"))S.n=Math.min(380,Math.max(40,+h.get("n")||220));
    if(h.get("sw"))S.swirl=(+h.get("sw")||100)/100;
    if(h.get("sp"))S.speed=(+h.get("sp")||100)/100;
    if(h.get("tr"))S.trail=(+h.get("tr")||86)/100;
  }catch(e){}
  try{const s=JSON.parse(localStorage.getItem("marble-murmuration")||"null");
    if(s&&!location.hash)Object.assign(S,s.s||{},seed=s.seed||seed);}catch(e){}
  rnd=mulberry(seed);
}
function saveState(){try{localStorage.setItem("marble-murmuration",JSON.stringify({seed,s:S}));}catch(e){}}
loadState();

// --- canvas sizing ---
let W=0,H=0,DPR=1;
function size(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;
  canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);paintSky(0,true);}
addEventListener("resize",size);

// --- flock ---
let birds=[];
function spawn(){
  birds=[];rnd=mulberry(seed);
  for(let i=0;i<S.n;i++)birds.push({x:rnd()*W,y:rnd()*H*0.9+H*0.05,
    vx:(rnd()-.5)*2,vy:(rnd()-.5)*2,ph:rnd()*6.28,sz:.8+rnd()*2.2,ci:(rnd()*PALS[S.pal].length)|0});
}
const ptr={x:-999,y:-999,down:false};
addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();ptr.x=e.clientX-r.left;ptr.y=e.clientY-r.top;});
canvas.addEventListener("pointerdown",e=>{ptr.down=true;burst(ptr.x,ptr.y,26);});
addEventListener("pointerup",()=>ptr.down=false);
function burst(x,y,power){for(const b of birds){const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy)+1;
  if(d<260){b.vx+=dx/d*power*(1-d/260);b.vy+=dy/d*power*(1-d/260);}}}

// --- scroll state ---
let scrollP=0,scrollV=0,lastY=scrollY;
addEventListener("scroll",()=>{const max=document.body.scrollHeight-innerHeight;
  const p=max>0?scrollY/max:0;scrollV=scrollV*.8+Math.min(8,Math.abs(scrollY-lastY)/30)*.2;lastY=scrollY;
  scrollP=p;const dots=document.querySelectorAll("#meter i");
  dots.forEach((d,i)=>d.classList.toggle("on",p>=i/(dots.length-1)-.01));},{passive:true});

// --- background: synth map ---
function paintSky(t,hard){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0d0621");g.addColorStop(.55-scrollP*.15,"#2a0d55");
  g.addColorStop(.8,"#ff2e88");g.addColorStop(1,"#ff9a3d");
  ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // sun (sinks with scroll)
  const sunR=Math.min(W,H)*.22,sx=W/2,sy=H*(0.62+scrollP*0.22)+Math.sin(t*.0004)*6;
  const sg=ctx.createLinearGradient(0,sy-sunR,0,sy+sunR);
  sg.addColorStop(0,"#fff7c0");sg.addColorStop(.5,"#ff9a3d");sg.addColorStop(1,"#ff2e88");
  ctx.save();ctx.beginPath();ctx.arc(sx,sy,sunR,0,6.29);ctx.clip();
  ctx.fillStyle=sg;ctx.fillRect(sx-sunR,sy-sunR,sunR*2,sunR*2);
  ctx.fillStyle="rgba(13,6,33,.9)";
  for(let i=0;i<7;i++){const yy=sy-sunR*.2+i*i*1.6+i*4-scrollP*30;ctx.fillRect(sx-sunR,yy,sunR*2,2+i*1.4);}
  ctx.restore();
  ctx.strokeStyle="rgba(255,46,136,.35)";ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(sx,sy,sunR+8+Math.sin(t*.001)*2,0,6.29);ctx.stroke();
  // contour map lines
  ctx.strokeStyle="rgba(34,230,255,.20)";ctx.lineWidth=1;
  for(let k=0;k<9;k++){ctx.beginPath();
    for(let x=0;x<=W;x+=14){const y=H*.55+k*H*.045+Math.sin(x*.008+k*1.7+t*.0003)*(10+k*3)+scrollP*k*8;
      x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
  // perspective grid
  const hz=H*(0.68+scrollP*0.06);ctx.strokeStyle="rgba(34,230,255,.35)";
  for(let i=-12;i<=12;i++){ctx.beginPath();ctx.moveTo(W/2+i*W*.02,hz);ctx.lineTo(W/2+i*W*.16,H);ctx.stroke();}
  for(let j=0;j<9;j++){const p=((j/9+t*.00008*(1+scrollP*3))%1);const y=hz+(H-hz)*p*p;
    ctx.globalAlpha=.15+p*.4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.globalAlpha=1;
  if(hard){ctx.fillStyle="rgba(13,6,33,.9)";ctx.fillRect(0,0,W,H);}
}

// --- stars svg ---
(function(){const s=$("stars");s.setAttribute("width",innerWidth);s.setAttribute("height",innerHeight);
  let h="";const r=mulberry(7);for(let i=0;i<90;i++){h+=`<circle cx="${(r()*100).toFixed(1)}%" cy="${(r()*60).toFixed(1)}%" r="${(r()*1.4+.4).toFixed(1)}" fill="#fff" opacity="${(r()*.7+.2).toFixed(2)}"/>`;}s.innerHTML=h;})();

// --- main loop ---
let T=0;
function frame(){
  requestAnimationFrame(frame);
  if(S.paused)return;
  T+=16;
  scrollV*=.94;
  const turb=scrollP*1.6+scrollV*.35, wind=(scrollP-.5)*1.4;
  // fade for trails
  ctx.globalCompositeOperation="source-over";
  ctx.fillStyle=`rgba(13,6,33,${(1-S.trail)*.5+.03})`;
  ctx.fillRect(0,0,W,H);
  if((T&7)===0)paintGridOnly();
  const pal=PALS[S.pal],n=birds.length;
  const R=46*S.swirl+turb*30;
  for(let i=0;i<n;i++){
    const b=birds[i];
    // neighbours (sampled for perf)
    let ax=0,ay=0,cx=0,cy=0,sx=0,sy=0,cnt=0;
    for(let k=1;k<=4;k++){const o=birds[(i+k*37)%n];const dx=o.x-b.x,dy=o.y-b.y,d2=dx*dx+dy*dy;
      if(d2<3600){cnt++;ax+=o.vx;ay+=o.vy;cx+=o.x;cy+=o.y;if(d2<900&&d2>1){sx-=dx/d2*40;sy-=dy/d2*40;}}}
    // marble flow field
    const f=(Math.sin(b.x*.008+T*.0009)+Math.cos(b.y*.01-T*.0007))*S.swirl;
    const f2=Math.cos((b.x+b.y)*.005+T*.0006)*S.swirl;
    let fx=-f2*R*.01+wind*.06, fy=f*R*.01+Math.sin(b.ph+T*.002)*.05;
    // pointer
    const dx=b.x-ptr.x,dy=b.y-ptr.y,d=Math.hypot(dx,dy);
    if(d<220&&d>1){const s=(S.magnet?-1:1)*(1-d/220)*3.2+(ptr.down?2:0);fx+=dx/d*s;fy+=dy/d*s;}
    if(cnt){ax=ax/cnt-b.vx;ay=ay/cnt-b.vy;cx=cx/cnt-b.x;cy=cy/cnt-b.y;
      b.vx+=(ax*.06+cx*.0006+sx*.05+fx)*.5;b.vy+=(ay*.06+cy*.0006+sy*.05+fy)*.5;}
    else{b.vx+=fx*.5;b.vy+=fy*.5;}
    const sp=Math.hypot(b.vx,b.vy)||1,max=(2.2+S.speed*2.4)*(1+turb*.3);
    if(sp>max){b.vx*=max/sp;b.vy*=max/sp;}
    if(sp<.6){b.vx*=.6/sp||.1;b.vy*=.6/sp||.1;}
    b.x+=b.vx*S.speed;b.y+=b.vy*S.speed;
    if(b.x<0)b.x+=W;if(b.x>W)b.x-=W;if(b.y<0)b.y+=H;if(b.y>H)b.y-=H;
    // draw: glowing marble dot + comet
    const c=pal[(b.ci+((T*.004+b.ph)|0))%pal.length];
    ctx.globalCompositeOperation="lighter";
    ctx.strokeStyle=`rgba(${c[0]},${c[1]},${c[2]},.55)`;ctx.lineWidth=b.sz*.8;
    ctx.beginPath();ctx.moveTo(b.x-b.vx*4,b.y-b.vy*4);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},.95)`;
    ctx.beginPath();ctx.arc(b.x,b.y,b.sz,0,6.29);ctx.fill();
  }
  ctx.globalCompositeOperation="source-over";
}
function paintGridOnly(){ // re-assert sun+grid glow cheaply without full repaint
  ctx.save();ctx.globalAlpha=.5;
  const sunR=Math.min(W,H)*.22,sx=W/2,sy=H*(0.62+scrollP*0.22);
  ctx.strokeStyle="rgba(255,46,136,.5)";ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(sx,sy,sunR+8,0,6.29);ctx.stroke();ctx.restore();
}

// --- controls ---
function syncUI(){$("sN").value=S.n;$("sSp").value=S.speed*100;$("sSw").value=S.swirl*100;$("sTr").value=S.trail*100;
  $("vN").textContent=S.n;$("vSp").textContent=S.speed.toFixed(1);$("vSw").textContent=S.swirl.toFixed(1);$("vTr").textContent=S.trail.toFixed(2);
  document.querySelectorAll(".swatches button").forEach(b=>b.classList.toggle("on",b.dataset.pal===S.pal));}
function changed(){syncUI();saveState();}
$("sN").oninput=e=>{S.n=+e.target.value;spawn();changed();};
$("sSp").oninput=e=>{S.speed=+e.target.value/100;changed();};
$("sSw").oninput=e=>{S.swirl=+e.target.value/100;changed();};
$("sTr").oninput=e=>{S.trail=+e.target.value/100;changed();};
document.querySelectorAll(".swatches button").forEach(b=>b.onclick=()=>{S.pal=b.dataset.pal;
  birds.forEach(bb=>bb.ci=(Math.random()*PALS[S.pal].length)|0);paintSky(0,true);changed();toast("palette · "+S.pal);});
$("bShuffle").onclick=()=>{seed=(Math.random()*1e9)|0;rnd=mulberry(seed);spawn();paintSky(0,true);changed();toast("seed "+seed.toString(36));};
$("bPause").onclick=e=>{S.paused=!S.paused;e.target.textContent=S.paused?"▶ PLAY":"❚❚ PAUSE";e.target.classList.toggle("on",S.paused);};
$("bMagnet").onclick=e=>{S.magnet=!S.magnet;e.target.textContent=S.magnet?"🧲 ATTRACT":"⛨ REPEL";e.target.classList.toggle("on",!S.magnet);changed();};
$("bBurst").onclick=()=>burst(W/2,H/2,40);
$("bSave").onclick=()=>{saveState();toast("saved to browser ★");};
$("bTop").onclick=e=>{e.preventDefault();scrollTo({top:0,behavior:"smooth"});};
$("bPng").onclick=()=>{const a=document.createElement("a");a.download="marble-murmuration.png";a.href=canvas.toDataURL("image/png");a.click();toast("PNG exported ⬇");};
$("bLink").onclick=async()=>{const p=new URLSearchParams({seed,n:S.n,sp:Math.round(S.speed*100),sw:Math.round(S.swirl*100),tr:Math.round(S.trail*100),pal:S.pal});
  const url=location.href.split("#")[0]+"#"+p.toString();
  try{await navigator.clipboard.writeText(url);toast("link copied ⧉");}catch(e){prompt("copy your sky:",url);}};

// --- boot ---
size();syncUI();spawn();paintSky(0,true);requestAnimationFrame(frame);
addEventListener("scroll",()=>{}, {passive:true});
