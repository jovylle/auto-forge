const canvas = document.getElementById('tapestry');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const PALETTES = {
  rust:  ['#b85c38','#d9b08c','#3a2e2a'],
  moss:  ['#4a6b3a','#8fa87a','#2b2b2b'],
  ochre: ['#c9a227','#7a5c3e','#1a1a1a'],
  blood: ['#8b2e2e','#c4a484','#3d3d3d'],
};

let paletteKey = localStorage.getItem('tt-palette') || 'rust';
let speed = parseFloat(localStorage.getItem('tt-speed') || '1');
let threads = [];
try { threads = JSON.parse(localStorage.getItem('tt-threads') || '[]'); } catch(e){ threads=[]; }
let running = true;
let timer = null;
let rewinding = false;

const counterEl = document.getElementById('counter');
const statusEl = document.getElementById('status');
const speedInput = document.getElementById('speed');
const speedVal = document.getElementById('speedVal');
const paletteSel = document.getElementById('palette');
const pauseBtn = document.getElementById('pause');
const rewindBtn = document.getElementById('rewind');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

speedInput.value = speed;
paletteSel.value = paletteKey;
speedVal.textContent = speed.toFixed(2) + '×';

function colors(){ return PALETTES[paletteKey]; }

function genThread(){
  const cols = colors();
  const color = cols[Math.floor(Math.random()*cols.length)];
  const horizontal = Math.random() < 0.5;
  const pts = [];
  const steps = 10 + Math.floor(Math.random()*6);
  if (horizontal){
    const base = Math.random()*H;
    const amp = 18 + Math.random()*46;
    const phase = Math.random()*Math.PI*2;
    for (let i=0;i<=steps;i++){
      const x = (i/steps)*W;
      const y = base + Math.sin(i*0.6 + phase)*amp + (Math.random()-0.5)*8;
      pts.push({x,y});
    }
  } else {
    const base = Math.random()*W;
    const amp = 18 + Math.random()*46;
    const phase = Math.random()*Math.PI*2;
    for (let i=0;i<=steps;i++){
      const y = (i/steps)*H;
      const x = base + Math.sin(i*0.6 + phase)*amp + (Math.random()-0.5)*8;
      pts.push({x,y});
    }
  }
  return { color, pts, width: 0.8 + Math.random()*2.4 };
}

function drawBg(ctx){
  ctx.fillStyle = '#16120e';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(232,221,200,0.035)';
  for (let i=0;i<1200;i++){
    ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
  }
  const g = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.25, W/2,H/2, Math.max(W,H)*0.75);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

function drawThread(ctx,t){
  ctx.save();
  ctx.strokeStyle = t.color;
  ctx.lineWidth = t.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.86;
  ctx.beginPath();
  ctx.moveTo(t.pts[0].x, t.pts[0].y);
  for (let i=1;i<t.pts.length-1;i++){
    const xc = (t.pts[i].x + t.pts[i+1].x)/2;
    const yc = (t.pts[i].y + t.pts[i+1].y)/2;
    ctx.quadraticCurveTo(t.pts[i].x, t.pts[i].y, xc, yc);
  }
  const last = t.pts[t.pts.length-1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawAll(ctx, list){
  drawBg(ctx);
  for (const t of list) drawThread(ctx,t);
}

function updateCounter(){
  counterEl.textContent = threads.length + ' thread' + (threads.length===1?'':'s');
}

function save(){
  try {
    localStorage.setItem('tt-threads', JSON.stringify(threads));
    localStorage.setItem('tt-palette', paletteKey);
    localStorage.setItem('tt-speed', String(speed));
  } catch(e){}
}

function tick(){
  if (!running || rewinding) return;
  const t = genThread();
  threads.push(t);
  drawThread(ctx, t);
  updateCounter();
  save();
}

function startTimer(){
  if (timer) clearInterval(timer);
  const ms = Math.max(100, 1000 / speed);
  timer = setInterval(tick, ms);
}

function setRunning(v){
  running = v;
  pauseBtn.textContent = v ? 'pause' : 'resume';
  statusEl.textContent = v ? 'weaving' : 'paused';
  if (v) startTimer(); else { if (timer) clearInterval(timer); timer=null; }
}

// init
drawAll(ctx, threads);
updateCounter();
startTimer();

// controls
speedInput.addEventListener('input', (e)=>{
  speed = parseFloat(e.target.value);
  speedVal.textContent = speed.toFixed(2) + '×';
  if (running) startTimer();
  save();
});
paletteSel.addEventListener('change', (e)=>{
  paletteKey = e.target.value;
  // redraw existing with new? keep colors already; new threads use new palette
  save();
});
pauseBtn.addEventListener('click', ()=> setRunning(!running));

rewindBtn.addEventListener('click', async ()=>{
  if (rewinding) return;
  rewinding = true;
  statusEl.textContent = 'rewinding';
  const prevRunning = running;
  running = false;
  if (timer) { clearInterval(timer); timer=null; }
  drawBg(ctx);
  for (let i=0;i<threads.length;i++){
    drawThread(ctx, threads[i]);
    await new Promise(r=>setTimeout(r, Math.max(20, 200/speed)));
  }
  rewinding = false;
  running = prevRunning;
  if (running) startTimer();
  statusEl.textContent = running ? 'weaving' : 'paused';
});

resetBtn.addEventListener('click', ()=>{
  if (!confirm('Clear the whole tapestry?')) return;
  threads = [];
  localStorage.removeItem('tt-threads');
  drawAll(ctx, threads);
  updateCounter();
});

// GIF export
function nearestColor(pal, r,g,b){
  let best=0, bestD=Infinity;
  for (let i=0;i<pal.length;i++){
    const d = (pal[i][0]-r)**2 + (pal[i][1]-g)**2 + (pal[i][2]-b)**2;
    if (d < bestD){ bestD=d; best=i; }
  }
  return best;
}

function medianCut(samples, maxColors){
  let boxes = [{pixels: samples.slice()}];
  while (boxes.length < maxColors){
    let best=-1, bestRange=-1, bestAxis=0;
    for (let i=0;i<boxes.length;i++){
      const b = boxes[i];
      if (b.pixels.length < 2) continue;
      let minR=255,maxR=0,minG=255,maxG=0,minB=255,maxB=0;
      for (const p of b.pixels){
        if (p[0]<minR)minR=p[0]; if (p[0]>maxR)maxR=p[0];
        if (p[1]<minG)minG=p[1]; if (p[1]>maxG)maxG=p[1];
        if (p[2]<minB)minB=p[2]; if (p[2]>maxB)maxB=p[2];
      }
      const rR=maxR-minR, rG=maxG-minG, rB=maxB-minB;
      const range = Math.max(rR,rG,rB);
      if (range > bestRange){ bestRange=range; best=i; bestAxis = rR>=rG && rR>=rB ? 0 : (rG>=rB?1:2); }
    }
    if (best === -1) break;
    const b = boxes[best];
    b.pixels.sort((a,c)=>a[bestAxis]-c[bestAxis]);
    const mid = Math.floor(b.pixels.length/2);
    boxes.splice(best,1,{pixels:b.pixels.slice(0,mid)},{pixels:b.pixels.slice(mid)});
  }
  return boxes.map(b=>{
    if (!b.pixels.length) return [0,0,0];
    let r=0,g=0,bl=0;
    for (const p of b.pixels){ r+=p[0]; g+=p[1]; bl+=p[2]; }
    const n=b.pixels.length;
    return [Math.round(r/n), Math.round(g/n), Math.round(bl/n)];
  });
}

function lzwEncode(indices, minCodeSize){
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxTable = 4096;
  const dict = new Map();
  function resetDict(){
    dict.clear();
    for (let i=0;i<clearCode;i++) dict.set(String.fromCharCode(i), i);
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  }
  resetDict();
  const out = [];
  let buffer = 0, bits = 0;
  function writeCode(code){
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8){ out.push(buffer & 0xff); buffer >>= 8; bits -= 8; }
  }
  writeCode(clearCode);
  let str = String.fromCharCode(indices[0]);
  for (let i=1;i<indices.length;i++){
    const c = String.fromCharCode(indices[i]);
    const sc = str + c;
    if (dict.has(sc)){ str = sc; }
    else {
      writeCode(dict.get(str));
      if (nextCode < maxTable){
        dict.set(sc, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeCode(clearCode);
        resetDict();
      }
      str = c;
    }
  }
  writeCode(dict.get(str));
  writeCode(eoiCode);
  if (bits > 0) out.push(buffer & 0xff);
  return out;
}

function encodeGif(frames, w, h, palette, delayCs){
  const bytes = [];
  const push = (b)=>bytes.push(b);
  'GIF89a'.split('').forEach(c=>push(c.charCodeAt(0)));
  push(w & 0xff); push((w>>8)&0xff);
  push(h & 0xff); push((h>>8)&0xff);
  let size = 2, sizeField = 0;
  while (size < palette.length){ size*=2; sizeField++; }
  push(0x80 | (7<<4) | sizeField);
  push(0);
  push(0);
  for (let i=0;i<size;i++){
    if (i < palette.length){ push(palette[i][0]); push(palette[i][1]); push(palette[i][2]); }
    else { push(0);push(0);push(0); }
  }
  // netscape loop
  push(0x21); push(0xFF); push(0x0B);
  'NETSCAPE2.0'.split('').forEach(c=>push(c.charCodeAt(0)));
  push(0x03); push(0x01); push(0x00); push(0x00); push(0x00);
  for (const frame of frames){
    push(0x21); push(0xF9); push(0x04);
    push(0x00);
    push(delayCs & 0xff); push((delayCs>>8)&0xff);
    push(0x00);
    push(0x00);
    push(0x2C);
    push(0);push(0);push(0);push(0);
    push(w & 0xff); push((w>>8)&0xff);
    push(h & 0xff); push((h>>8)&0xff);
    push(0x00);
    const minCodeSize = 8;
    push(minCodeSize);
    const lzw = lzwEncode(Array.from(frame), minCodeSize);
    let i=0;
    while (i < lzw.length){
      const chunk = Math.min(255, lzw.length - i);
      push(chunk);
      for (let j=0;j<chunk;j++) push(lzw[i++]);
    }
    push(0x00);
  }
  push(0x3B);
  return new Uint8Array(bytes);
}

exportBtn.addEventListener('click', async ()=>{
  if (threads.length === 0){ alert('Nothing to export yet.'); return; }
  const wasRunning = running;
  if (running) setRunning(false);
  exportBtn.disabled = true;
  progress.hidden = false;
  progressBar.style.width = '0%';
  progressText.textContent = 'preparing frames…';

  const EW = 320, EH = 180;
  const off = document.createElement('canvas');
  off.width = EW; off.height = EH;
  const octx = off.getContext('2d');

  // cap frames
  let seq = threads.slice();
  const MAXF = 40;
  if (seq.length > MAXF){
    const step = Math.ceil(seq.length / MAXF);
    const sampled = [];
    for (let i=0;i<seq.length;i+=step) sampled.push(seq[i]);
    if (sampled[sampled.length-1] !== seq[seq.length-1]) sampled.push(seq[seq.length-1]);
    seq = sampled;
  }

  const samples = [];
  // full-size offscreen then scale
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fctx = full.getContext('2d');
  const framesFull = [];
  for (let i=0;i<=seq.length;i++){
    drawAll(fctx, seq.slice(0,i));
    // scale to export size
    octx.clearRect(0,0,EW,EH);
    octx.drawImage(full, 0,0, EW, EH);
    const img = octx.getImageData(0,0,EW,EH);
    framesFull.push(img);
    for (let p=0;p<img.data.length;p+=32){
      samples.push([img.data[p], img.data[p+1], img.data[p+2]]);
    }
    progressText.textContent = 'capturing ' + (i+1) + '/' + (seq.length+1);
    progressBar.style.width = (40 + i/(seq.length+1)*30) + '%';
    await new Promise(r=>setTimeout(r,0));
  }

  progressText.textContent = 'quantizing…';
  const palette = medianCut(samples, 128);
  progressBar.style.width = '75%';

  const indexed = framesFull.map(img=>{
    const idx = new Uint8Array(EW*EH);
    const cache = new Map();
    for (let p=0,i=0;p<img.data.length;p+=4,i++){
      const key = (img.data[p]<<16)|(img.data[p+1]<<8)|img.data[p+2];
      let v = cache.get(key);
      if (v === undefined){ v = nearestColor(palette, img.data[p], img.data[p+1], img.data[p+2]); cache.set(key,v); }
      idx[i] = v;
    }
    return idx;
  });

  progressText.textContent = 'encoding…';
  progressBar.style.width = '85%';
  const delayCs = Math.max(8, Math.round(100 / speed));
  const gif = encodeGif(indexed, EW, EH, palette, delayCs);

  const blob = new Blob([gif], {type:'image/gif'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tick-tapestry.gif';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  progressText.textContent = 'done';
  progressBar.style.width = '100%';
  setTimeout(()=>{ progress.hidden = true; exportBtn.disabled = false; if (wasRunning) setRunning(true); }, 900);
});

// save on unload
window.addEventListener('beforeunload', save);