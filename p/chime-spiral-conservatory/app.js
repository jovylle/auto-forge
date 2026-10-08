// Chime Spiral Conservatory — sampled tick sequencer + spiral clock + history scrub + wav export
// No deps. Web Audio synthesized "samples". localStorage persistence.
const $ = (id) => document.getElementById(id);
const STEPS = 16, LS = "chime-spiral-v1";

const SCALES = {
  miyako: { name: "宮 MIYAKO — Miyako-bushi", iv: [0, 1, 5, 7, 8] },
  in:     { name: "法 IN — In-sen", iv: [0, 2, 3, 7, 8] },
  yo:     { name: "陽 YŌ — Yō", iv: [0, 2, 5, 7, 9] },
  ryukyu: { name: "琉球 RYŪKYŪ", iv: [0, 4, 5, 7, 11] },
};

// state
let state = load() || {
  steps: [1,0,0,1, 0,1,0,0, 1,0,1,0, 0,0,1,0],
  scale: "miyako", root: 246.94, bpm: 96, evolve: 40, voice: "kachi",
  history: [], // {steps, scale, root, label, t}
};
function load(){ try{ return JSON.parse(localStorage.getItem(LS)); }catch{ return null; } }
function save(){ try{ localStorage.setItem(LS, JSON.stringify(state)); }catch{} }

let actx = null, playing = false, stepIdx = 0, nextT = 0, timer = null;
let blooms = [];   // {angle, r, life, hue}
let petalsOn = false;

const spiral = $("spiral"), sctx = spiral.getContext("2d");
const tl = $("timeline"), tctx = tl.getContext("2d");

// ---------- audio: procedural "sampled ticks" ----------
function ac(){ if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended") actx.resume(); return actx; }
function midiHz(root, scaleKey, degree){
  const iv = SCALES[scaleKey].iv;
  const oct = Math.floor(degree / iv.length), d = ((degree % iv.length)+iv.length)%iv.length;
  return root * Math.pow(2, (iv[d] + oct*12)/12);
}
function noteName(root, scaleKey, degree){
  const names=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const iv = SCALES[scaleKey].iv;
  const st = iv[((degree%iv.length)+iv.length)%iv.length] + 12*Math.floor(degree/iv.length);
  const base = Math.round(12*Math.log2(root/261.63));
  return names[(((base+st)%12)+12)%12];
}
// "sampled tick": pre-rendered 1-shot buffers per voice (wood/bell/drum) then pitch via playbackRate
const sampleCache = {};
function makeTick(voice){
  if(sampleCache[voice]) return sampleCache[voice];
  const c = ac(), len = c.sampleRate * 0.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  const f = voice==="suzu" ? 2093 : voice==="taiko" ? 110 : 1800;
  for(let i=0;i<len;i++){
    const t = i/c.sampleRate, env = Math.exp(-t*(voice==="taiko"?14:voice==="suzu"?7:26));
    let v;
    if(voice==="taiko") v = Math.sin(2*Math.PI*f*t)*Math.exp(-t*9) + 0.5*Math.sin(2*Math.PI*f*2.02*t)*env*0.4 + (Math.random()*2-1)*env*0.25;
    else if(voice==="suzu") v = (Math.sin(2*Math.PI*f*t)+0.5*Math.sin(2*Math.PI*f*2.76*t)+0.25*Math.sin(2*Math.PI*f*5.4*t))*env*0.5;
    else v = (Math.random()*2-1)*env*0.8 + Math.sin(2*Math.PI*f*t)*env*0.35; // kachi: woody click
    d[i] = v*0.9;
  }
  sampleCache[voice]=buf; return buf;
}
function pluck(degree, when, dest){
  const c = ac(), out = dest || c.destination;
  const master = c.createGain(); master.gain.value = 0.9; master.connect(out);
  // tick transient (sampled)
  const src = c.createBufferSource(); src.buffer = makeTick(state.voice);
  const ref = state.voice==="suzu"?2093:state.voice==="taiko"?110:1800;
  src.playbackRate.value = midiHz(state.root, state.scale, degree)/523.25 * (state.voice==="taiko"?0.35:1) * (ref/1800 > 1 ? 1 : 1);
  const tg = c.createGain(); tg.gain.value = state.voice==="taiko"?0.9:0.5;
  src.connect(tg).connect(master); src.start(when); src.stop(when+0.5);
  // koto-ish body
  const hz = midiHz(state.root, state.scale, degree);
  const o = c.createOscillator(); o.type="triangle"; o.frequency.value=hz;
  const o2 = c.createOscillator(); o2.type="sine"; o2.frequency.value=hz*2.001;
  const g = c.createGain(), g2=c.createGain();
  g.gain.setValueAtTime(0.0001,when); g.gain.exponentialRampToValueAtTime(0.5,when+0.012); g.gain.exponentialRampToValueAtTime(0.0001,when+1.4);
  g2.gain.setValueAtTime(0.0001,when); g2.gain.exponentialRampToValueAtTime(0.12,when+0.01); g2.gain.exponentialRampToValueAtTime(0.0001,when+0.9);
  o.connect(g).connect(master); o2.connect(g2).connect(master);
  o.start(when); o.stop(when+1.5); o2.start(when); o2.stop(when+1.0);
}

// ---------- sequencer ----------
function buildSteps(){
  const box = $("steps"); box.innerHTML="";
  state.steps.forEach((on,i)=>{
    const b = document.createElement("button");
    b.className = "step"+(on?" on":"")+(i===stepIdx&&playing?" now":"");
    b.setAttribute("aria-pressed", on?"true":"false");
    const deg = pitchFor(i);
    b.innerHTML = `<div class="t">刻 ${String(i+1).padStart(2,"0")}</div><div class="n">${on?"♪":"·"}</div><div class="pitch">${noteName(state.root,state.scale,deg)} · d${deg}</div><div class="dot"></div>`;
    b.onclick = ()=>{ state.steps[i]^=1; pushHistory("tap "+(i+1)); save(); buildSteps(); };
    box.appendChild(b);
  });
}
function pitchFor(i){ // spiral melody: rise along spiral, wrap by scale length
  return i + Math.floor(i/8);
}
function schedule(){
  const c = ac();
  const spb = 60/state.bpm/2; // 8th-note ticks
  while(nextT < c.currentTime + 0.15){
    const i = stepIdx;
    if(state.steps[i]){
      pluck(pitchFor(i), nextT);
      const a = (i/STEPS)*Math.PI*4 + Math.PI/2; // spiral angle
      blooms.push({ angle:a, r: 40 + (i/STEPS)*220, life:1, deg:pitchFor(i), step:i });
    }
    stepIdx = (stepIdx+1)%STEPS;
    if(stepIdx===0) pushHistory("loop", true);
    nextT += spb;
    updateReadout(i);
  }
}
function updateReadout(i){
  $("barBeat").textContent = `TICK ${String(i+1).padStart(2,"0")} / 16 · ${playing?"PLAYING":"RESTING"}`;
  buildStepsHighlight(i);
}
function buildStepsHighlight(i){
  [...$("steps").children].forEach((el,k)=>el.classList.toggle("now", k===i&&playing));
}
function togglePlay(){
  ac();
  playing=!playing;
  $("playBtn").textContent = playing?"❚❚":"▶";
  $("playBtn").classList.toggle("playing", playing);
  if(playing){ stepIdx=0; nextT=ac().currentTime+0.06; timer=setInterval(schedule,40); }
  else clearInterval(timer);
}

// ---------- evolution ----------
function evolveOnce(){
  const amt = state.evolve/100;
  for(let i=0;i<STEPS;i++){
    if(Math.random()<amt*0.55){
      // mutate toward neighbor scale degrees: keep musical
      state.steps[i] = Math.random() < (state.steps[i]?0.55:0.45) ? 1:0;
    }
  }
  if(!state.steps.some(Boolean)) state.steps[Math.floor(Math.random()*STEPS)]=1;
  pushHistory("evolve ✳"); save(); buildSteps();
}
function scatter(){
  state.steps = state.steps.map(()=>Math.random()<0.38?1:0);
  pushHistory("scatter ✦"); save(); buildSteps();
}

// ---------- history ----------
function pushHistory(label, quiet){
  const snap = { steps:[...state.steps], scale:state.scale, root:state.root, label, t:Date.now() };
  state.history.push(snap);
  if(state.history.length>64) state.history.shift();
  if(!quiet){ save(); }
  renderHistory();
}
function renderHistory(){
  $("genLabel").textContent = `generation ${state.history.length} · ${state.history.length?state.history[state.history.length-1].label:"seed"}`;
  const s = $("scrub"); s.max = Math.max(0,state.history.length-1); s.value = s.max;
  // strip
  const w=tl.width,h=tl.height; tctx.clearRect(0,0,w,h);
  tctx.fillStyle="#efe7d3"; tctx.fillRect(0,0,w,h);
  state.history.forEach((snap,i)=>{
    const x = state.history.length<2? w/2 : 10 + (i/(state.history.length-1))*(w-20);
    const dens = snap.steps.reduce((a,b)=>a+b,0)/STEPS;
    tctx.fillStyle = i==s.value ? "#c73e1d" : "#2b3a55";
    const bh = 12+dens*(h-28);
    tctx.beginPath(); tctx.arc(x, h/2, 4+dens*9, 0, 7); tctx.globalAlpha=.25; tctx.fill(); tctx.globalAlpha=1;
    tctx.fillRect(x-2, h/2-bh/2, 4, bh);
  });
  drawSpiralFrameOnce();
}

// ---------- spiral clock visualizer (single rAF loop) ----------
function drawSpiralFrameOnce(){ /* static preview painted by the running rAF loop; no-op to avoid duplicate loops */ }
let frameInit=false;
function drawSpiralFrame(){
  const w=spiral.width,h=spiral.height,cx=w/2,cy=h/2;
  const moon=document.body.classList.contains("moonview");
  sctx.fillStyle=moon?"#0e1626":"#14120e"; sctx.fillRect(0,0,w,h);
  sctx.strokeStyle="rgba(246,241,229,.08)";
  for(let r=40;r<300;r+=32){ sctx.beginPath(); sctx.arc(cx,cy,r,0,7); sctx.stroke(); }
  sctx.strokeStyle=moon?"rgba(220,195,130,.8)":"rgba(201,162,39,.55)"; sctx.lineWidth=2; sctx.beginPath();
  for(let a=0;a<=Math.PI*4.2;a+=0.02){ const r=26+a*17.5; const x=cx+Math.cos(a+Math.PI/2)*r,y=cy+Math.sin(a+Math.PI/2)*r; a===0?sctx.moveTo(x,y):sctx.lineTo(x,y); }
  sctx.stroke();
  const grd=sctx.createRadialGradient(cx,cy,4,cx,cy,54);
  grd.addColorStop(0,moon?"#f4e9c8":"#c73e1d"); grd.addColorStop(1,"transparent");
  sctx.fillStyle=grd; sctx.beginPath(); sctx.arc(cx,cy,54,0,7); sctx.fill();
  sctx.fillStyle=moon?"#f4e9c8":"#f6f1e5"; sctx.beginPath(); sctx.arc(cx,cy,moon?22:13,0,7); sctx.fill();
  for(let i=0;i<STEPS;i++){
    const a=(i/STEPS)*Math.PI*4+Math.PI/2, r=26+(i/STEPS)*Math.PI*4*17.5;
    const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    const on=state.steps[i], now=(i===stepIdx&&playing);
    sctx.fillStyle=on?(now?"#ff6a3d":"#c73e1d"):"rgba(246,241,229,.32)";
    sctx.strokeStyle=now?"#fff":"rgba(246,241,229,.55)"; sctx.lineWidth=now?3:1.2;
    sctx.beginPath(); sctx.arc(x,y,on?(now?13:10):6,0,7); sctx.fill(); sctx.stroke();
    if(on){ sctx.fillStyle="rgba(246,241,229,.85)"; sctx.font="11px serif"; sctx.textAlign="center"; sctx.fillText(noteName(state.root,state.scale,pitchFor(i)),x,y-15); }
    if(now){ sctx.strokeStyle="rgba(255,255,255,.7)"; sctx.lineWidth=2; sctx.beginPath(); sctx.moveTo(cx,cy); sctx.lineTo(x,y); sctx.stroke(); }
  }
  blooms=blooms.filter(b=>b.life>0.02);
  blooms.forEach(b=>{ const x=cx+Math.cos(b.angle)*b.r,y=cy+Math.sin(b.angle)*b.r;
    sctx.globalAlpha=Math.max(0,b.life)*0.9; sctx.fillStyle=moon?"#e8d9a8":"#e9a13b";
    for(let p=0;p<5;p++){ const pa=b.angle+p*1.256; sctx.beginPath(); sctx.ellipse(x+Math.cos(pa)*10*b.life,y+Math.sin(pa)*10*b.life,7*b.life+2,3.5*b.life+1,pa,0,7); sctx.fill(); }
    sctx.globalAlpha=1; b.life*=0.965; b.r+=0.25; });
  requestAnimationFrame(drawSpiralFrame);
}

// ---------- export: one-click loop -> WAV ----------
function encodeWav(buf){
  const n=buf.length, ch=1, sr=buf.sampleRate, bytes=44+n*2, ab=new ArrayBuffer(bytes), v=new DataView(ab);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,"RIFF"); v.setUint32(4,bytes-8,true); ws(8,"WAVEfmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); ws(36,"data"); v.setUint32(40,n*2,true);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++){ const s=Math.max(-1,Math.min(1,d[i])); v.setInt16(44+i*2,s*32767,true); }
  return new Blob([ab],{type:"audio/wav"});
}
async function exportLoop(){
  $("exportMsg").textContent="Rendering two loops…";
  const sr=44100, spb=60/state.bpm/2, dur=spb*STEPS*2+1.6;
  const off=new OfflineAudioContext(1, Math.ceil(sr*dur), sr);
  // render same pluck() but bound to offline ctx: replicate quickly
  const keepActx=actx;
  const iv=SCALES[state.scale].iv;
  for(let rep=0;rep<2;rep++) for(let i=0;i<STEPS;i++){
    if(!state.steps[i]) continue;
    const t=rep*spb*STEPS+i*spb+0.05;
    const hz=state.root*Math.pow(2,(iv[pitchFor(i)%iv.length]+12*Math.floor(pitchFor(i)/iv.length))/12);
    const o=off.createOscillator(); o.type="triangle"; o.frequency.value=hz;
    const g=off.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);
    o.connect(g).connect(off.destination); o.start(t); o.stop(t+1.5);
    const o2=off.createOscillator(); o2.type="sine"; o2.frequency.value=hz*2.001;
    const g2=off.createGain(); g2.gain.setValueAtTime(0.0001,t); g2.gain.exponentialRampToValueAtTime(0.12,t+0.01); g2.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
    o2.connect(g2).connect(off.destination); o2.start(t); o2.stop(t+1.0);
  }
  const buf=await off.startRendering();
  const url=URL.createObjectURL(encodeWav(buf));
  const a=document.createElement("a"); a.href=url; a.download="chime-spiral-loop.wav"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  // also copy pattern JSON
  try{ await navigator.clipboard.writeText(JSON.stringify({scale:state.scale,root:state.root,bpm:state.bpm,steps:state.steps})); $("exportMsg").textContent="✓ Loop exported as .wav — pattern JSON also copied to clipboard."; }
  catch{ $("exportMsg").textContent="✓ Loop exported as .wav."; }
  actx=keepActx;
}

// ---------- easter egg: hanko × 5 → moon-viewing (お月見) ----------
let sealClicks=0, eggFired=false;
const HAIKU=["古池や 蛙飛び込む 水の音 — old pond, frog, splash","月が綺麗ですね — the moon is beautiful, isn't it?","虫の声 夜に螺旋を 描くなり — insects sing spirals into the night"];
function sealEgg(){
  sealClicks++;
  if(sealClicks>=5 && !eggFired){
    eggFired=true; document.body.classList.add("moonview");
    const h=$("haiku"); h.hidden=false; h.textContent="🌕 "+HAIKU[Math.floor(Math.random()*HAIKU.length)];
    sakura();
    // secret lullaby: full pentatonic descent
    ac(); const t0=ac().currentTime+0.1;
    [12,9,7,5,4,2,0].forEach((d,i)=>pluck(d,t0+i*0.34));
    setTimeout(()=>{eggFired=false;sealClicks=0;},8000);
    setTimeout(()=>{h.hidden=true; if(!petalsOn) document.body.classList.remove("moonview");},9000);
  }
}
function sakura(){
  const box=$("petals");
  for(let i=0;i<40;i++){ const s=document.createElement("span"); s.className="petal"; s.textContent=Math.random()<0.5?"🌸":"🍃";
    s.style.left=Math.random()*100+"vw"; s.style.animationDuration=(3+Math.random()*4)+"s"; s.style.fontSize=(12+Math.random()*16)+"px";
    box.appendChild(s); setTimeout(()=>s.remove(),8000); }
}
// hidden text code: typing "matsu" (pine) also triggers
let typed="";
window.addEventListener("keydown",e=>{ typed=(typed+e.key).slice(-5); if(typed==="matsu") sealEgg(); });

// ---------- wire up ----------
function init(){
  $("bpm").value=state.bpm; $("evolve").value=state.evolve; $("voice").value=state.voice; $("scale").value=state.scale; $("root").value=String(state.root);
  $("bpmVal").textContent=state.bpm; $("evolveVal").textContent=state.evolve+"%";
  $("scaleName").textContent=SCALES[state.scale].name;
  if(!state.history.length) pushHistory("seed 🌱");
  buildSteps(); renderHistory();
  $("playBtn").onclick=togglePlay;
  spiral.onclick=()=>{ if(!actx) ac(); togglePlay(); };
  $("bpm").oninput=e=>{ state.bpm=+e.target.value; $("bpmVal").textContent=state.bpm; save(); };
  $("evolve").oninput=e=>{ state.evolve=+e.target.value; $("evolveVal").textContent=state.evolve+"%"; save(); };
  $("voice").onchange=e=>{ state.voice=e.target.value; save(); };
  $("scale").onchange=e=>{ state.scale=e.target.value; $("scaleName").textContent=SCALES[state.scale].name; pushHistory("scale → "+state.scale); save(); buildSteps(); };
  $("root").onchange=e=>{ state.root=+e.target.value; pushHistory("root → "+state.root+"Hz"); save(); buildSteps(); };
  $("evolveBtn").onclick=evolveOnce;
  $("clearBtn").onclick=()=>{ state.steps=state.steps.map(()=>0); pushHistory("cleared ○"); save(); buildSteps(); };
  $("randomBtn").onclick=scatter;
  $("exportBtn").onclick=exportLoop;
  $("scrub").oninput=e=>{
    const i=+e.target.value, snap=state.history[i]; if(!snap) return;
    state.steps=[...snap.steps]; state.scale=snap.scale; state.root=snap.root;
    $("scale").value=state.scale; $("root").value=String(state.root);
    $("scaleName").textContent=SCALES[state.scale].name;
    $("genLabel").textContent=`generation ${i} · ${snap.label} (previewing — press restore)`;
    buildSteps(); renderHistoryKeep(i);
  };
  $("restoreBtn").onclick=()=>{ const i=+$("scrub").value, snap=state.history[i]; if(!snap) return;
    state.steps=[...snap.steps]; state.scale=snap.scale; state.root=snap.root;
    pushHistory("restored ↩ gen "+i); save(); buildSteps(); };
  $("branchBtn").onclick=()=>{ evolveOnce(); pushHistory("branched ♻"); };
  $("seal").onclick=sealEgg;
  $("seal").onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault();sealEgg();} };
  // responsive canvas backing
  const fit=()=>{ const r=spiral.getBoundingClientRect(); const s=Math.min(640,Math.floor(r.width)); };
  window.addEventListener("resize",fit); fit();
  if(!frameInit){ frameInit=true; requestAnimationFrame(drawSpiralFrame); }
}
function renderHistoryKeep(sel){
  const w=tl.width,h=tl.height; tctx.clearRect(0,0,w,h);
  tctx.fillStyle="#efe7d3"; tctx.fillRect(0,0,w,h);
  state.history.forEach((snap,i)=>{
    const x=state.history.length<2?w/2:10+(i/(state.history.length-1))*(w-20);
    const dens=snap.steps.reduce((a,b)=>a+b,0)/STEPS;
    tctx.fillStyle=i===sel?"#c73e1d":"#2b3a55";
    const bh=12+dens*(h-28);
    tctx.globalAlpha=.3; tctx.beginPath(); tctx.arc(x,h/2,4+dens*9,0,7); tctx.fill(); tctx.globalAlpha=1;
    tctx.fillRect(x-2,h/2-bh/2,4,bh);
  });
  const s=$("scrub"); s.max=Math.max(0,state.history.length-1);
}
init();
