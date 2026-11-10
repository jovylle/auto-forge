// Spring Mesh Bloom — verlet spring-mass bloom
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const gSlider = document.getElementById('gravity');
const gVal = document.getElementById('gval');
const dampBtn = document.getElementById('damp');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');

let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
let nodes = [], springs = [];
let gravity = 1.2;
let damping = true;
let dragging = null; // node
let pointer = {x:0,y:0};

function resize(){
  const r = canvas.getBoundingClientRect();
  W = Math.max(10, r.width); H = Math.max(10, r.height);
  canvas.width = W*dpr; canvas.height = H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', ()=>{ resize(); });

function Node(x,y,pinned=false){
  return {x,y,px:x,py:y,pinned,drag:false};
}
function Spring(a,b,rest,k=0.35){
  return {a,b,rest,k};
}

function build(){
  nodes = []; springs = [];
  const cx = W*0.5, cy = H*0.22;
  const rings = [0.18,0.30,0.42]; // radii as fraction of min(W,H)
  const counts = [10,16,22];
  // hub
  const hub = Node(cx,cy,true);
  nodes.push(hub); // index 0
  let prevRingIndices = [0];
  rings.forEach((rf,ri)=>{
    const r = Math.min(W,H)*rf;
    const n = counts[ri];
    const ringStart = nodes.length;
    const ringIdx = [];
    for(let i=0;i<n;i++){
      const ang = (i/n)*Math.PI*2 - Math.PI/2;
      // start slightly above to "bloom" down under gravity
      const x = cx + Math.cos(ang)*r*0.6;
      const y = cy + Math.sin(ang)*r*0.6 - 40;
      const nd = Node(x,y);
      nodes.push(nd);
      ringIdx.push(nodes.length-1);
    }
    // ring springs
    for(let i=0;i<n;i++){
      const a = ringStart+i;
      const b = ringStart+(i+1)%n;
      const dx = nodes[a].x-nodes[b].x, dy=nodes[a].y-nodes[b].y;
      springs.push(Spring(a,b,Math.hypot(dx,dy),0.4));
    }
    // connect to previous ring / hub
    const prev = ri===0 ? [0] : null;
    if(ri===0){
      // spokes to hub
      for(let i=0;i<n;i++){
        const a = 0;
        const b = ringStart+i;
        const dx=nodes[a].x-nodes[b].x, dy=nodes[a].y-nodes[b].y;
        springs.push(Spring(a,b,Math.hypot(dx,dy)*0.95,0.3));
      }
    } else {
      const prevStart = nodes.length - n - counts[ri-1]; // previous ring start
      // Actually recompute: previous ring start
    }
    // cross connections to previous ring (map nearest)
    if(ri>0){
      const prevN = counts[ri-1];
      const prevStart2 = ringStart - prevN;
      for(let i=0;i<n;i++){
        const ang=(i/n)*Math.PI*2;
        // connect to nearest prev node
        const pi = Math.round((i/n)*prevN)%prevN;
        const a = ringStart+i;
        const b = prevStart2+pi;
        const dx=nodes[a].x-nodes[b].x, dy=nodes[a].y-nodes[b].y;
        springs.push(Spring(a,b,Math.hypot(dx,dy),0.25));
        // also +1 for mesh density
        const pi2 = (pi+1)%prevN;
        const b2 = prevStart2+pi2;
        const dx2=nodes[a].x-nodes[b2].x, dy2=nodes[a].y-nodes[b2].y;
        springs.push(Spring(a,b2,Math.hypot(dx2,dy2),0.2));
      }
    }
  });
}

// gravity accel per frame
const G = 9.8; // base
function step(){
  const dampFactor = damping ? 0.90 : 0.985;
  // integrate
  for(const nd of nodes){
    if(nd.pinned || nd.drag) continue;
    const vx = (nd.x-nd.px)*dampFactor;
    const vy = (nd.y-nd.py)*dampFactor;
    nd.px = nd.x; nd.py = nd.y;
    nd.x += vx;
    nd.y += vy + gravity*0.6;
  }
  // constraints: springs
  for(let iter=0; iter<6; iter++){
    for(const s of springs){
      const a=nodes[s.a], b=nodes[s.b];
      if(a.drag && b.drag) continue;
      const dx=b.x-a.x, dy=b.y-a.y;
      const d=Math.hypot(dx,dy)||0.0001;
      const diff=(d-s.rest)/d;
      const k=s.k*0.5;
      const ox=dx*diff*k, oy=dy*diff*k;
      if(!a.pinned && !a.drag){ a.x+=ox; a.y+=oy; }
      if(!b.pinned && !b.drag){ b.x-=ox; b.y-=oy; }
    }
  }
  // bounds soft
  for(const nd of nodes){
    if(nd.pinned||nd.drag) continue;
    if(nd.x<8){nd.x=8; nd.px=nd.x;}
    if(nd.x>W-8){nd.x=W-8; nd.px=nd.x;}
    if(nd.y<H*0.05){nd.y=H*0.05; nd.py=nd.y;}
    if(nd.y>H-8){nd.y=H-8; nd.py=nd.y;}
  }
  // hub stays
  nodes[0].x=W*0.5; nodes[0].y=H*0.22;
}

function draw(){
  ctx.fillStyle='rgba(2,2,10,0.35)';
  ctx.fillRect(0,0,W,H);
  // subtle grid
  ctx.strokeStyle='rgba(123,44,255,0.06)';
  ctx.lineWidth=1;
  const stepg=40;
  for(let x=0;x<W;x+=stepg){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=stepg){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // springs
  for(const s of springs){
    const a=nodes[s.a], b=nodes[s.b];
    const stretch = Math.hypot(a.x-b.x,a.y-b.y)/ (s.rest||1);
    const hue = stretch>1.15 ? 320 : 190;
    const alpha = Math.min(0.9, 0.25 + Math.abs(stretch-1)*0.8);
    ctx.strokeStyle = `hsla(${hue},100%,60%,${alpha})`;
    ctx.lineWidth = stretch>1.2 ? 2 : 1;
    ctx.shadowBlur = 12;
    ctx.shadowColor = stretch>1.15 ? '#ff2bd6' : '#00f0ff';
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  ctx.shadowBlur=0;
  // nodes
  for(const nd of nodes){
    const vx = nd.x-nd.px, vy=nd.y-nd.py;
    const speed = Math.hypot(vx,vy);
    const r = nd.pinned ? 6 : 4;
    const grad = ctx.createRadialGradient(nd.x,nd.y,0,nd.x,nd.y,r*3);
    if(nd.pinned){ grad.addColorStop(0,'#ffe600'); grad.addColorStop(1,'rgba(255,230,0,0)'); }
    else if(speed>0.6){ grad.addColorStop(0,'#ff2bd6'); grad.addColorStop(1,'rgba(255,43,214,0)'); }
    else { grad.addColorStop(0,'#00f0ff'); grad.addColorStop(1,'rgba(0,240,255,0)'); }
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(nd.x,nd.y,r*3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = nd.pinned?'#ffe600': (speed>0.6?'#ff2bd6':'#00f0ff');
    ctx.beginPath(); ctx.arc(nd.x,nd.y,r,0,Math.PI*2); ctx.fill();
  }
}

let raf;
function loop(){
  step();
  draw();
  raf=requestAnimationFrame(loop);
}

// pointer drag
function nodeAt(x,y){
  let best=null, bd=14;
  for(const nd of nodes){
    const d=Math.hypot(nd.x-x,nd.y-y);
    if(d<bd){bd=d;best=nd;}
  }
  return best;
}
canvas.addEventListener('pointerdown', e=>{
  const r=canvas.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  const nd=nodeAt(x,y);
  if(nd){ dragging=nd; nd.drag=true; pointer.x=x; pointer.y=y; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointermove', e=>{
  if(!dragging) return;
  const r=canvas.getBoundingClientRect();
  dragging.x=e.clientX-r.left; dragging.y=e.clientY-r.top;
  dragging.px=dragging.x; dragging.py=dragging.y;
});
canvas.addEventListener('pointerup', e=>{
  if(dragging){ dragging.drag=false; dragging=null; canvas.classList.remove('dragging');}
});
canvas.addEventListener('pointercancel', ()=>{ if(dragging){dragging.drag=false;dragging=null;canvas.classList.remove('dragging');}});

gSlider.addEventListener('input', e=>{ gravity=parseFloat(e.target.value); gVal.textContent=gravity.toFixed(2);});
dampBtn.addEventListener('click', ()=>{
  damping=!damping;
  dampBtn.setAttribute('aria-pressed', String(damping));
  dampBtn.textContent = damping?'damping: on':'damping: off';
});
resetBtn.addEventListener('click', ()=>{ build(); });
exportBtn.addEventListener('click', ()=>{
  // render a clean frame to offscreen? just export current canvas
  const url=canvas.toDataURL('image/png');
  const a=document.createElement('a');
  a.href=url; a.download='spring-mesh-bloom.png'; a.click();
});

function init(){
  resize();
  build();
  // fade-in clear
  ctx.fillStyle='#02020a'; ctx.fillRect(0,0,W,H);
  loop();
}
init();
