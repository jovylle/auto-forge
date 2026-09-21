// Bubble Reverb Arcade — dark-fantasy WebAudio blob toy.
// No deps. Works from file://. All sounds synthesized.

const $ = (s) => document.querySelector(s);
const arena = $('#arena'), live = $('#live');
const audioState = $('#audio-state'), abyssFill = $('#abyss-fill');
const abyssLabel = $('#abyss-label');

const BLOBS = [
  { id:'wisp',    name:'WISP',    glyph:'✦', color:'#7c5cff', dark:'#2a1e6e', wave:'sine',     base:523.25, dur:0.9, div:4,  desc:'moonlit lead' },
  { id:'gargoyle',name:'GARGOYLE',glyph:'ᚷ', color:'#3ddc97', dark:'#0e4d33', wave:'square',   base:130.81, dur:0.7, div:8,  desc:'stone bass' },
  { id:'mandrake',name:'MANDRAKE',glyph:'❧', color:'#c2255c', dark:'#5c0f28', wave:'sawtooth', base:196.00, dur:0.8, div:4,  desc:'root shriek' },
  { id:'crypt',   name:'CRYPT',   glyph:'☽', color:'#d8b46a', dark:'#5c4416', wave:'triangle', base:261.63, dur:1.4, div:16, desc:'burial pad' },
  { id:'hex',     name:'HEX',     glyph:'⬢', color:'#ff8c42', dark:'#6e3410', wave:'noise',    base:0,      dur:0.25,div:2,  desc:'cursed hat' },
  { id:'banshee', name:'BANSHEE', glyph:'༄', color:'#4cc9f0', dark:'#123f52', wave:'vibrato',  base:659.25, dur:1.1, div:8,  desc:'wail' },
];
const SCALES = {
  minor:    [0,2,3,5,7,8,10],
  dorian:   [0,2,3,5,7,9,10],
  phrygian: [0,1,3,5,7,8,10],
  major:    [0,2,4,5,7,9,11],
};

// ---- state (persisted) ----
const store = {
  load(){ try { return JSON.parse(localStorage.getItem('bra-v1')||'{}'); } catch { return {}; } },
  save(s){ try { localStorage.setItem('bra-v1', JSON.stringify(s)); } catch {} },
};
const saved = store.load();
const state = {
  bend: saved.bend || {},            // blobId -> semitones -12..12
  loops: new Set(saved.loops || []), // blobIds
  loopsOn: false,
  bpm: saved.bpm ?? 96,
  delayTime: saved.delayTime ?? 0.32,
  delayFb: saved.delayFb ?? 0.42,
  reverb: saved.reverb ?? 0.45,
  vol: saved.vol ?? 0.8,
  scale: saved.scale || 'minor',
  abyss: 0,                          // 0..1 from scroll
  recording: false, jamStart: 0, events: [],
};
function persist(){
  store.save({ bend:state.bend, loops:[...state.loops], bpm:state.bpm,
    delayTime:state.delayTime, delayFb:state.delayFb, reverb:state.reverb, vol:state.vol, scale:state.scale });
}

// ---- audio graph ----
let AC=null, master, voiceBus, filt, delay, fbGain, wet, convolver, dry, analyser, comp;
let audioReady=false;

function impulse(dur=2.2, decay=2.5){
  const rate=AC.sampleRate, len=Math.floor(rate*dur), buf=AC.createBuffer(2,len,rate);
  for(let c=0;c<2;c++){ const d=buf.getChannelData(c);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
  } return buf;
}
function ensureAudio(){
  if(AC) { if(AC.state==='suspended') AC.resume(); return; }
  AC = new (window.AudioContext||window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = state.vol;
  comp = AC.createDynamicsCompressor();
  analyser = AC.createAnalyser(); analyser.fftSize=256;
  filt = AC.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=6000;
  dry = AC.createGain(); dry.gain.value=1;
  wet = AC.createGain(); wet.gain.value=state.reverb;
  convolver = AC.createConvolver(); convolver.buffer = impulse();
  delay = AC.createDelay(2); delay.delayTime.value = state.delayTime;
  fbGain = AC.createGain(); fbGain.gain.value = state.delayFb;
  const dIn=AC.createGain(), dOut=AC.createGain(); dOut.gain.value=0.6;
  voiceBus = AC.createGain();
  // voice -> filter -> dry -> master ; voice -> delay loop -> convolver -> master
  voiceBus.connect(filt); filt.connect(dry); dry.connect(master);
  voiceBus.connect(dIn); dIn.connect(delay); delay.connect(fbGain); fbGain.connect(delay);
  delay.connect(dOut); dOut.connect(convolver); convolver.connect(wet); wet.connect(master);
  master.connect(comp); comp.connect(analyser); analyser.connect(AC.destination);
  applyAbyss();
  audioReady=true;
  audioState.textContent='The reliquary hums. Strike a blob — keys 1–6 work too.';
  $('#btn-awaken').textContent='⚡ Audio awake';
  say('Audio awakened.');
}
function say(msg){ live.textContent=msg; }

// synth voice — also reused (in simplified form) by the offline WAV renderer
function freqOf(b, bendOverride){
  const semis = bendOverride ?? (state.bend[b.id]||0);
  if(b.wave==='noise') return 0;
  const offsets={minor:0,dorian:2,phrygian:1,major:-2};
  return b.base * Math.pow(2, (semis+(offsets[state.scale]||0))/12);
}
function strike(id, opts={}){
  ensureAudio();
  const b = BLOBS.find(x=>x.id===id); if(!b) return;
  const t = AC.currentTime + (opts.when||0);
  const semis = state.bend[id]||0;
  const f = freqOf(b);
  const g = AC.createGain();
  g.connect(voiceBus);
  const dur = b.dur;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.9,t+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  if(b.wave==='noise'){
    const len=Math.floor(AC.sampleRate*dur), buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=AC.createBufferSource(); src.buffer=buf;
    const hp=AC.createBiquadFilter(); hp.type='highpass';
    hp.frequency.value=3000*Math.pow(2,(semis)/12);
    src.connect(hp); hp.connect(g); src.start(t); src.stop(t+dur+0.05);
  } else {
    const o=AC.createOscillator(); o.type = b.wave==='vibrato'?'sawtooth':b.wave; o.frequency.value=f;
    if(b.wave==='vibrato'){
      const lfo=AC.createOscillator(), lg=AC.createGain();
      lfo.frequency.value=7; lg.gain.value=f*0.03; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t+dur+0.05);
    }
    if(b.id==='banshee'||b.id==='mandrake'){ // wobbly harmony fifth
      const o2=AC.createOscillator(); o2.type='sine'; o2.frequency.value=f*1.5;
      const g2=AC.createGain(); g2.gain.value=0.35; o2.connect(g2); g2.connect(g);
      o2.start(t); o2.stop(t+dur+0.05);
    }
    o.connect(g); o.start(t); o.stop(t+dur+0.05);
  }
  setTimeout(()=>{ try{g.disconnect()}catch{} }, (dur+0.3)*1000);
  // visuals
  const el = document.querySelector(`.blob[data-id="${id}"]`);
  if(el){ el.classList.remove('struck'); void el.offsetWidth; el.classList.add('struck');
    setTimeout(()=>el.classList.remove('struck'),260); }
  // log for wav export
  if(state.recording){
    state.events.push({ t: AC.currentTime - state.jamStart, id, semis });
    $('#rite-status').textContent = `● Recording… ${state.events.length} strikes chronicled. Press X to seal.`;
  }
  say(`${b.name} struck${semis?` at ${semis>0?'+':''}${semis} st`:''}.`);
}

// ---- blobs: DOM + physics + drag-to-bend ----
const bodies = [];
function buildArena(){
  BLOBS.forEach((b,i)=>{
    const el=document.createElement('button');
    el.className='blob'; el.dataset.id=b.id;
    el.style.background=`radial-gradient(circle at 35% 30%, ${b.color}, ${b.dark})`;
    el.setAttribute('aria-label',`${b.name}, ${b.desc}. Press Enter to strike, arrow keys to bend pitch, L to toggle loop.`);
    el.innerHTML=`<span class="key" aria-hidden="true">${i+1}</span><span class="glyph" aria-hidden="true">${b.glyph}</span><span class="name">${b.name}</span><span class="bend" aria-hidden="true">0st</span>`;
    arena.appendChild(el);
    const r={ el, b, x:40+i*70, y:60+(i%3)*80, vx:(Math.random()-.5)*90, vy:(Math.random()-.5)*60, w:104, h:104, dragging:false };
    bodies.push(r);
    updateBendLabel(r);
    if(state.loops.has(b.id)) el.classList.add('looping');

    el.addEventListener('click',()=>{ if(!r.moved) toggleStrike(b.id); });
    el.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleStrike(b.id); }
      else if(e.key==='ArrowUp'||e.key==='ArrowRight'){ e.preventDefault(); setBend(b.id,(state.bend[b.id]||0)+1); }
      else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){ e.preventDefault(); setBend(b.id,(state.bend[b.id]||0)-1); }
      else if(e.key.toLowerCase()==='l'){ e.preventDefault(); toggleLoop(b.id); }
    });
    // pointer drag: horizontal moves blob, vertical bends pitch
    let sx=0, sy=0, startBend=0;
    el.addEventListener('pointerdown',(e)=>{
      ensureAudio(); r.dragging=true; r.moved=false; sx=e.clientX; sy=e.clientY; startBend=state.bend[b.id]||0;
      el.setPointerCapture(e.pointerId); el.style.cursor='grabbing';
    });
    el.addEventListener('pointermove',(e)=>{
      if(!r.dragging) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.abs(dx)+Math.abs(dy)>6) r.moved=true;
      r.x+=dx*1.2; r.y+=dy*0.4; sx=e.clientX; sy=e.clientY;
      // vertical travel bends pitch: ~18px per semitone
      r.bendTravel=(r.bendTravel||0)+dy;
      setBend(b.id, clamp(startBend + Math.round(-r.bendTravel/18), -12, 12), true);
      clampBody(r);
    });
    const end=(e)=>{ if(!r.dragging) return; r.dragging=false; r.bendTravel=0; el.style.cursor='grab';
      r.vx=(Math.random()-.5)*160; r.vy=-80; };
    el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end);
  });
  requestAnimationFrame(physics);
}
function clamp(v,a,b2){ return Math.max(a,Math.min(b2,v)); }
function clampBody(r){
  const W=arena.clientWidth-r.w, H=arena.clientHeight-r.h;
  r.x=clamp(r.x,0,Math.max(0,W)); r.y=clamp(r.y,0,Math.max(0,H));
}
function toggleStrike(id){ strike(id); }
function setBend(id, semis, quiet){
  state.bend[id]=clamp(Math.round(semis),-12,12); persist();
  const r=bodies.find(x=>x.b.id===id); if(r) updateBendLabel(r);
  if(!quiet) say(`${id} bent to ${state.bend[id]} semitones.`);
}
function updateBendLabel(r){
  const s=state.bend[r.b.id]||0;
  r.el.querySelector('.bend').textContent=`${s>0?'+':''}${s}st`;
}
let lastT=0;
function physics(t){
  const dt=Math.min(0.05,(t-lastT)/1000||0.016); lastT=t;
  const speedMul = 1 + state.abyss*1.6;
  const W=arena.clientWidth, H=arena.clientHeight;
  for(const r of bodies){
    const size = W<480?88:104; r.w=r.h=size;
    r.el.style.width=r.el.style.height=size+'px';
    if(!r.dragging){
      r.x+=r.vx*dt*speedMul; r.y+=r.vy*dt*speedMul;
      r.vy+=26*dt*(1+state.abyss); // abyss gravity
      if(r.x<=0||r.x>=W-r.w){ r.vx*=-1; r.x=clamp(r.x,0,W-r.w); }
      if(r.y<=0||r.y>=H-r.h){ r.vy*=-1; r.y=clamp(r.y,0,H-r.h); }
      // gentle separation
      for(const o of bodies){ if(o===r) continue;
        const dx=(r.x+1)-(o.x+1), cx=(r.x+r.w/2)-(o.x+o.w/2), cy=(r.y+r.h/2)-(o.y+o.h/2);
        const d=Math.hypot(cx,cy);
        if(d>0&&d<(r.w+o.w)/2){ r.vx+=cx/d*14*dt; r.vy+=cy/d*14*dt; }
      }
    }
    r.el.style.transform=`translate(${r.x}px,${r.y}px)`;
  }
  requestAnimationFrame(physics);
}

// ---- loops: scheduler ----
let step=0, schedTimer=null;
function setLoops(on){
  state.loopsOn=on;
  const btn=$('#btn-loops');
  btn.textContent = on?'⏸ Stop all loops':'▶ Start all loops';
  btn.setAttribute('aria-pressed', String(on));
  if(on){ ensureAudio(); if(!schedTimer) schedTimer=setInterval(scheduler,(60/state.bpm/2)*1000); say('Loops running.'); }
  else { clearInterval(schedTimer); schedTimer=null; step=0; say('Loops stopped.'); }
}
function scheduler(){
  if(!state.loopsOn) return;
  const looping=[...state.loops];
  for(const id of looping){
    const b=BLOBS.find(x=>x.id===id);
    if(b && step % b.div===0) strike(id);
  }
  step=(step+1)%32;
}
function toggleLoop(id){
  ensureAudio();
  const el=document.querySelector(`.blob[data-id="${id}"]`);
  if(state.loops.has(id)){ state.loops.delete(id); el.classList.remove('looping'); say(`${id} loop released.`); }
  else { state.loops.add(id); el.classList.add('looping'); say(`${id} loop bound — every ${BLOBS.find(b=>b.id===id).div} steps.`); }
  persist(); renderStack();
  if(state.loops.size&&!state.loopsOn) setLoops(true);
}
function renderStack(){
  const ul=$('#loop-stack'); ul.innerHTML='';
  if(!state.loops.size){ ul.innerHTML='<li class="empty">No loops bound. Focus a blob, press <kbd>L</kbd> — or <kbd>Shift</kbd>+<kbd>1</kbd>…<kbd>6</kbd>.</li>'; return; }
  for(const id of state.loops){
    const b=BLOBS.find(x=>x.id===id);
    const li=document.createElement('li');
    li.innerHTML=`${b.glyph} ${b.name} <small>÷${b.div}</small>`;
    const x=document.createElement('button'); x.textContent='✕'; x.setAttribute('aria-label',`Release ${b.name} loop`);
    x.addEventListener('click',()=>toggleLoop(id)); li.appendChild(x); ul.appendChild(li);
  }
}

// ---- scroll reacts ----
function onScroll(){
  const max=document.documentElement.scrollHeight-innerHeight;
  state.abyss = max>0 ? clamp(scrollY/max,0,1) : 0;
  document.documentElement.style.setProperty('--abyss',state.abyss.toFixed(3));
  if(abyssFill) abyssFill.parentElement.style.setProperty('--abyss',state.abyss);
  document.documentElement.style.setProperty('--abyss',state.abyss);
  abyssLabel.textContent=`ABYSS ${Math.round(state.abyss*100)}%`;
  abyssFill.style.width=(state.abyss*100)+'%';
  applyAbyss();
}
let lastZone=0;
function applyAbyss(){
  if(!AC) return;
  const a=state.abyss;
  filt.frequency.setTargetAtTime(6000 - a*5200, AC.currentTime, 0.2);
  wet.gain.setTargetAtTime(clamp(state.reverb + a*0.5,0,1), AC.currentTime, 0.2);
  delay.delayTime.setTargetAtTime(clamp(state.delayTime + a*0.25,0.05,1.2), AC.currentTime, 0.2);
  const zone=Math.floor(a*3);
  if(zone!==lastZone){ lastZone=zone;
    if(audioReady && state.loopsOn){ const ids=[...state.loops]; if(ids.length) strike(ids[zone%ids.length]); }
  }
}

// ---- transport / record / export ----
function toggleRecord(){
  ensureAudio();
  const btn=$('#btn-record');
  if(!state.recording){
    state.recording=true; state.events=[]; state.jamStart=AC.currentTime;
    btn.textContent='■ Sealing… (stop rite)'; btn.setAttribute('aria-pressed','true');
    $('#rite-status').textContent='● Recording… strike blobs, bind loops. Every strike is chronicled.';
    say('Rite begun. Recording.');
  } else {
    state.recording=false;
    btn.textContent='● Begin rite (record)'; btn.setAttribute('aria-pressed','false');
    $('#rite-status').textContent=`Rite paused — ${state.events.length} strikes chronicled. Press X to seal them into WAV.`;
    say('Recording paused.');
  }
}

// Offline re-render of the event log -> WAV download
async function exportWav(){
  ensureAudio();
  let evs=[...state.events];
  let dur=0;
  if(!evs.length){
    // demo pattern so the file is never empty
    say('No strikes chronicled — sealing a demo incantation instead.');
    const ids=['wisp','gargoyle','mandrake','crypt','hex','banshee'];
    evs=ids.map((id,i)=>({t:i*0.4,id,semis:state.bend[id]||0}));
  }
  dur=Math.min(30, Math.max(...evs.map(e=>e.t))+3);
  $('#rite-status').textContent='Sealing the reliquary… rendering WAV (this takes a moment).';
  const rate=44100, off=new OfflineAudioContext(2,Math.ceil(dur*rate),rate);
  const oMaster=off.createGain(); oMaster.gain.value=state.vol; oMaster.connect(off.destination);
  const oDelay=off.createDelay(2); oDelay.delayTime.value=clamp(state.delayTime+state.abyss*0.25,0.05,1.2);
  const oFb=off.createGain(); oFb.gain.value=state.delayFb;
  const oWet=off.createGain(); oWet.gain.value=clamp(state.reverb+state.abyss*0.5,0,1);
  const oVerb=off.createConvolver(); oVerb.buffer=makeImpulse(off,rate);
  const oBus=off.createGain(); oBus.connect(oMaster);
  oBus.connect(oDelay); oDelay.connect(oFb); oFb.connect(oDelay);
  const oDout=off.createGain(); oDout.gain.value=0.6; oDelay.connect(oDout); oDout.connect(oVerb); oVerb.connect(oWet); oWet.connect(oMaster);
  for(const e of evs){
    const b=BLOBS.find(x=>x.id===e.id); if(!b) continue;
    renderVoice(off,oBus,b,e.t,e.semis??0);
  }
  const buf=await off.startRendering();
  const blob=encodeWav(buf);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='bubble-reverb-jam.wav'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  $('#rite-status').textContent=`Sealed! ${evs.length} strikes → bubble-reverb-jam.wav (${dur.toFixed(1)}s).`;
  say('WAV sealed and downloaded.');
}
function makeImpulse(ctx,rate){
  const len=Math.floor(rate*2.2), buf=ctx.createBuffer(2,len,rate);
  for(let c=0;c<2;c++){ const d=buf.getChannelData(c);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5); }
  return buf;
}
function renderVoice(off,dest,b,when,semis){
  const t=when, dur=b.dur;
  const g=off.createGain(); g.connect(dest);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.9,t+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  const offsets={minor:0,dorian:2,phrygian:1,major:-2};
  const f=b.base*Math.pow(2,((semis||0)+(offsets[state.scale]||0))/12);
  if(b.wave==='noise'){
    const len=Math.floor(off.sampleRate*dur), buf=off.createBuffer(1,len,off.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const s=off.createBufferSource(); s.buffer=buf;
    const hp=off.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3000*Math.pow(2,semis/12);
    s.connect(hp); hp.connect(g); s.start(t);
  } else {
    const o=off.createOscillator(); o.type=b.wave==='vibrato'?'sawtooth':b.wave; o.frequency.value=f||440;
    o.connect(g); o.start(t); o.stop(t+dur+0.05);
    if(b.id==='banshee'||b.id==='mandrake'){
      const o2=off.createOscillator(); o2.type='sine'; o2.frequency.value=(f||440)*1.5;
      const g2=off.createGain(); g2.gain.value=0.35; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t+dur+0.05);
    }
  }
}
function encodeWav(buf){
  const nCh=2, sr=buf.sampleRate, len=buf.length;
  const bytes=44+len*nCh*2, ab=new ArrayBuffer(bytes), v=new DataView(ab);
  const wstr=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  wstr(0,'RIFF'); v.setUint32(4,bytes-8,true); wstr(8,'WAVE'); wstr(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,nCh,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*nCh*2,true); v.setUint16(32,nCh*2,true); v.setUint16(34,16,true);
  wstr(36,'data'); v.setUint32(40,len*nCh*2,true);
  const ch0=buf.getChannelData(0), ch1=buf.numberOfChannels>1?buf.getChannelData(1):ch0;
  let o=44;
  for(let i=0;i<len;i++){ for(const ch of [ch0,ch1]){
    const s=clamp(ch[i],-1,1); v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true); o+=2; } }
  return new Blob([ab],{type:'audio/wav'});
}

// ---- controls wiring ----
function wire(){
  const bind=(id,key,fmt)=>{
    const el=$(id);
    el.value=state[key];
    $(id+'-v').textContent=fmt(state[key]);
    el.addEventListener('input',()=>{
      state[key]=parseFloat(el.value); $(id+'-v').textContent=fmt(state[key]); persist();
      if(!AC) return;
      const t=AC.currentTime;
      if(key==='bpm'&&state.loopsOn){ clearInterval(schedTimer); schedTimer=setInterval(scheduler,(60/state.bpm/2)*1000); }
      if(key==='delayTime') delay.delayTime.setTargetAtTime(state.delayTime,t,0.05);
      if(key==='delayFb') fbGain.gain.setTargetAtTime(state.delayFb,t,0.05);
      if(key==='reverb') wet.gain.setTargetAtTime(clamp(state.reverb+state.abyss*0.5,0,1),t,0.05);
      if(key==='vol') master.gain.setTargetAtTime(state.vol,t,0.05);
    });
  };
  bind('#bpm','bpm',v=>v); bind('#delay-time','delayTime',v=>(+v).toFixed(2));
  bind('#delay-fb','delayFb',v=>(+v).toFixed(2)); bind('#reverb','reverb',v=>(+v).toFixed(2));
  bind('#vol','vol',v=>(+v).toFixed(2));
  const sc=$('#scale'); sc.value=state.scale;
  sc.addEventListener('change',()=>{ state.scale=sc.value; persist(); say(`Scale: ${sc.selectedOptions[0].text}.`); });

  $('#btn-awaken').addEventListener('click',ensureAudio);
  $('#btn-loops').addEventListener('click',()=>setLoops(!state.loopsOn));
  $('#btn-panic').addEventListener('click',()=>{ setLoops(false); panicMute(); say('Silenced.'); });
  $('#btn-record').addEventListener('click',toggleRecord);
  $('#btn-export').addEventListener('click',exportWav);
  addEventListener('scroll',onScroll,{passive:true}); addEventListener('resize',()=>bodies.forEach(clampBody));

  // global keyboard (ignored when focus is in a slider/select except for its own keys)
  addEventListener('keydown',(e)=>{
    const tag=(e.target.tagName||'').toLowerCase();
    const inField=tag==='input'||tag==='select'||tag==='textarea';
    const k=e.key;
    if(k>='1'&&k<='6'&&!inField){
      const b=BLOBS[+k-1];
      if(e.shiftKey){ e.preventDefault(); toggleLoop(b.id); } else { e.preventDefault(); strike(b.id); }
      return;
    }
    if(inField) return;
    const lk=k.toLowerCase();
    if(lk==='c'){ toggleRecord(); }
    else if(lk==='x'){ exportWav(); }
    else if(lk==='p'){ setLoops(!state.loopsOn); }
    else if(k==='0'){ setLoops(false); say('Silenced.'); }
    else if(lk==='s'){ const o=$('#scale'); o.selectedIndex=(o.selectedIndex+1)%o.options.length; o.dispatchEvent(new Event('change')); }
    else if(lk==='b'){ nudge('#bpm',-1); } else if(lk==='v'){ nudge('#bpm',1); }
    else if(k==='['){ nudge('#delay-time',-0.02); } else if(k===']'){ nudge('#delay-time',0.02); }
    else if(k===';'){ nudge('#delay-fb',-0.02); } else if(k==="'"){ nudge('#delay-fb',0.02); }
    else if(k==='-'){ nudge('#reverb',-0.02); } else if(k==='='){ nudge('#reverb',0.02); }
    else if(k===','){ nudge('#vol',-0.02); } else if(k==='.'){ nudge('#vol',0.02); }
  });
}
function nudge(sel,d){
  const el=$(sel); el.value=parseFloat(el.value)+d; el.dispatchEvent(new Event('input'));
}
function panicMute(){
  if(!AC) return;
  const t=AC.currentTime, prev=state.vol;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(prev,t);
  master.gain.linearRampToValueAtTime(0.0001,t+0.05);
  master.gain.linearRampToValueAtTime(prev,t+0.4);
}

// ---- init ----
buildArena(); wire(); renderStack(); onScroll();
console.log('Bubble Reverb Arcade ready — tap blobs, drag to bend, scroll to deepen.');
