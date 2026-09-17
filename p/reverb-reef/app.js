// Reverb Reef — steampunk tide-pool groove engine (no assets, all synth)
const $ = (s) => document.querySelector(s);
const reefEl = $('#reef'), seqEl = $('#seq');
const statusEl = $('#status'), moonEl = $('#moon'), moonFill = $('#moonFill');
const needleTide = $('#needleTide'), needlePressure = $('#needlePressure');
const tideLabel = $('#tideLabel'), loopCount = $('#loopCount');

const STORE = 'reverb-reef-v1';
const STEPS = 16;
const BASS_NOTES = [55, 55, 65.41, 55, 82.41, 55, 73.42, 49];   // A1 groove
const ARP_NOTES = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63]; // A minor pent-ish
const PAD_NOTES = [110, 130.81, 146.83, 164.81];

const TRACKS = [
  { id:'puffer', name:'IRON PUFFER', latin:'Sphaeroides aeneus', kind:'kick',
    svg:`<svg viewBox="0 0 80 80"><circle cx="40" cy="42" r="24" fill="none" stroke="#c9a227" stroke-width="4"/><circle cx="40" cy="42" r="15" fill="#b5542d"/><circle cx="33" cy="36" r="4" fill="#f6eed6"/><circle cx="47" cy="36" r="4" fill="#f6eed6"/><circle cx="33" cy="36" r="1.8" fill="#14100b"/><circle cx="47" cy="36" r="1.8" fill="#14100b"/><path d="M28 56 l-6 8 M40 58 v10 M52 56 l6 8" stroke="#c9a227" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="14" r="5" fill="none" stroke="#2f9e8f" stroke-width="3"/><path d="M40 19 v6" stroke="#2f9e8f" stroke-width="3"/></svg>`,
    steps:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] },
  { id:'crab', name:'GEAR CRAB', latin:'Carabus dentatus', kind:'snare',
    svg:`<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="16" fill="#c9a227"/><circle cx="40" cy="40" r="9" fill="#14100b"/><circle cx="40" cy="40" r="3" fill="#f6eed6"/><g stroke="#c9a227" stroke-width="4" stroke-linecap="round"><path d="M24 40 H10 M56 40 H70 M28 28 L18 18 M52 28 L62 18 M28 52 L18 62 M52 52 L62 62"/></g><circle cx="10" cy="40" r="3" fill="#b5542d"/><circle cx="70" cy="40" r="3" fill="#b5542d"/></svg>`,
    steps:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1] },
  { id:'jelly', name:'BRASS JELLY', latin:'Medusa spiralis', kind:'hat',
    svg:`<svg viewBox="0 0 80 80"><path d="M18 38 a22 22 0 0 1 44 0 z" fill="#2f9e8f"/><path d="M18 38 h44" stroke="#f6eed6" stroke-width="2"/><g stroke="#c9a227" stroke-width="3" stroke-linecap="round"><path d="M28 40 q-2 10 -5 16 M40 40 v18 M52 40 q2 10 5 16"/></g><circle cx="33" cy="26" r="2.5" fill="#f6eed6"/><circle cx="47" cy="26" r="2.5" fill="#f6eed6"/></svg>`,
    steps:[0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1] },
  { id:'eel', name:'CLOCKWORK EEL', latin:'Anguis cuprum', kind:'bass',
    svg:`<svg viewBox="0 0 80 80"><path d="M14 52 q14 -26 30 -14 q12 9 22 -6" fill="none" stroke="#c9a227" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="30" r="7" fill="#b5542d"/><circle cx="62" cy="29" r="2" fill="#f6eed6"/><path d="M30 34 v-8 M38 30 v-8 M46 30 v-8" stroke="#2f9e8f" stroke-width="3" stroke-linecap="round"/></svg>`,
    steps:[1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0] },
  { id:'nautilus', name:'STEAM NAUTILUS', latin:'Nautica vaporis', kind:'arp',
    svg:`<svg viewBox="0 0 80 80"><circle cx="38" cy="42" r="22" fill="none" stroke="#c9a227" stroke-width="4"/><circle cx="38" cy="42" r="14" fill="none" stroke="#2f9e8f" stroke-width="3"/><circle cx="38" cy="42" r="7" fill="#b5542d"/><circle cx="60" cy="52" r="4" fill="#f6eed6"/><path d="M60 48 q6 -4 4 -10" stroke="#f6eed6" stroke-width="2" fill="none"/></svg>`,
    steps:[1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0] },
  { id:'anemone', name:'COPPER ANEMONE', latin:'Anemona cantus', kind:'bubble',
    svg:`<svg viewBox="0 0 80 80"><ellipse cx="40" cy="58" rx="16" ry="8" fill="#b5542d"/><g stroke="#2f9e8f" stroke-width="3" stroke-linecap="round"><path d="M28 56 q-6 -12 -10 -18 M36 56 q-2 -12 -3 -20 M44 56 q2 -12 3 -20 M52 56 q6 -12 10 -18"/></g><circle cx="18" cy="34" r="3" fill="none" stroke="#c9a227" stroke-width="2"/><circle cx="62" cy="30" r="4" fill="none" stroke="#c9a227" stroke-width="2"/><circle cx="40" cy="26" r="2.5" fill="#c9a227"/></svg>`,
    steps:[1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] },
];

const state = { playing:false, bpm:96, step:0, nextTime:0, timer:null,
  verb:.38, delay:.30, drive:.18, loops:{}, drawQueue:[] };

// ---------- persistence ----------
function save(){ try{ localStorage.setItem(STORE, JSON.stringify({
  steps:TRACKS.map(t=>t.steps), loops:state.loops, bpm:state.bpm,
  verb:state.verb, delay:state.delay, drive:state.drive })); }catch(e){} }
function load(){ try{ const d = JSON.parse(localStorage.getItem(STORE)||'null'); if(!d) return;
  if(d.steps) d.steps.forEach((s,i)=>{ if(TRACKS[i]&&s.length===16) TRACKS[i].steps=s; });
  Object.assign(state,{bpm:d.bpm??96, verb:d.verb??.38, delay:d.delay??.30, drive:d.drive??.18});
  state.loops = d.loops||{}; }catch(e){} }
load();
TRACKS.forEach(t=>{ if(!(t.id in state.loops)) state.loops[t.id] = (t.kind==='kick'||t.kind==='hat'); });

// ---------- audio engine ----------
let AC=null, master, verbSend, delaySend, verbGain, delayGain, convolver, delayNode, shaper, comp;
function ctx(){ if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); buildGraph(); } if(AC.state==='suspended') AC.resume(); return AC; }
function noiseBuffer(ac, sec){ const b=ac.createBuffer(1, Math.ceil(ac.sampleRate*sec), ac.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
function impulse(ac, sec=2.2, decay=2.8){ const r=ac.sampleRate, b=ac.createBuffer(2, r*sec, r);
  for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length, decay); } return b; }
function buildGraph(){
  master = AC.createGain(); master.gain.value = .9;
  shaper = AC.createWaveShaper(); setDrive(state.drive);
  comp = AC.createDynamicsCompressor();
  master.connect(shaper); shaper.connect(comp); comp.connect(AC.destination);
  convolver = AC.createConvolver(); convolver.buffer = impulse(AC);
  verbGain = AC.createGain(); convolver.connect(verbGain); verbGain.connect(master);
  verbSend = AC.createGain(); verbSend.connect(convolver);
  delayNode = AC.createDelay(2); delayNode.delayTime.value = .32;
  const fb = AC.createGain(); fb.gain.value = .38; delayNode.connect(fb); fb.connect(delayNode);
  delayGain = AC.createGain(); delayNode.connect(delayGain); delayGain.connect(master);
  delaySend = AC.createGain(); delaySend.connect(delayNode);
  // a whisper of delay feeds the cavern
  const dw = AC.createGain(); dw.gain.value=.4; delayNode.connect(dw); dw.connect(convolver);
  applyFX();
}
function setDrive(v){ if(!AC) return; const k = 1 + v*40; const n=256, c=new Float32Array(n);
  for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(k*x)/Math.tanh(k*.5)*.6; } shaper.curve=c; }
function applyFX(){ if(!AC) return;
  verbGain.gain.setTargetAtTime(state.verb*1.1, AC.currentTime, .05);
  delayGain.gain.setTargetAtTime(state.delay*.8, AC.currentTime, .05);
  delayNode.delayTime.setTargetAtTime(.22 + state.delay*.35, AC.currentTime, .05);
  setDrive(state.drive);
}
function bus(){ // every voice connects here: dry + two echo sends
  const g = AC.createGain(); g.connect(master);
  const vs = AC.createGain(); vs.gain.value = .9; g.connect(vs); vs.connect(verbSend);
  const ds = AC.createGain(); ds.gain.value = .7; g.connect(ds); ds.connect(delaySend);
  return g;
}
// --- synthesized voices (one-shots) ---
function vKick(t, out){ const o=AC.createOscillator(), g=AC.createGain();
  o.frequency.setValueAtTime(160,t); o.frequency.exponentialRampToValueAtTime(42,t+.12);
  g.gain.setValueAtTime(.9,t); g.gain.exponentialRampToValueAtTime(.001,t+.28);
  o.connect(g); g.connect(out); o.start(t); o.stop(t+.3); }
function vSnare(t, out){ const n=AC.createBufferSource(); n.buffer=noiseBuffer(AC,.2);
  const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1900; f.Q.value=.9;
  const g=AC.createGain(); g.gain.setValueAtTime(.55,t); g.gain.exponentialRampToValueAtTime(.001,t+.18);
  n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t+.2);
  const o=AC.createOscillator(), g2=AC.createGain(); o.frequency.value=190;
  g2.gain.setValueAtTime(.4,t); g2.gain.exponentialRampToValueAtTime(.001,t+.1);
  o.connect(g2); g2.connect(out); o.start(t); o.stop(t+.12); }
function vHat(t, out, open){ const n=AC.createBufferSource(); n.buffer=noiseBuffer(AC,.12);
  const f=AC.createBiquadFilter(); f.type='highpass'; f.frequency.value=7500;
  const g=AC.createGain(); const d=open?.22:.06;
  g.gain.setValueAtTime(.32,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t+d+.02); }
function vBass(t, out, freq){ const o=AC.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(700,t); f.frequency.exponentialRampToValueAtTime(180,t+.22); f.Q.value=6;
  const g=AC.createGain(); g.gain.setValueAtTime(.5,t); g.gain.exponentialRampToValueAtTime(.001,t+.26);
  o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t+.3); }
function vArp(t, out, freq){ const o=AC.createOscillator(); o.type='triangle'; o.frequency.value=freq;
  const o2=AC.createOscillator(); o2.type='sine'; o2.frequency.value=freq*2;
  const g=AC.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.4,t+.015); g.gain.exponentialRampToValueAtTime(.001,t+.4);
  const g2=AC.createGain(); g2.gain.value=.25; o2.connect(g2); g2.connect(g);
  o.connect(g); g.connect(out); o.start(t); o.stop(t+.45); o2.start(t); o2.stop(t+.45); }
function vBubble(t, out, freq){ const o=AC.createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(freq*2.2,t+.18);
  const g=AC.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.38,t+.06); g.gain.exponentialRampToValueAtTime(.001,t+.5);
  o.connect(g); g.connect(out); o.start(t); o.stop(t+.55); }
function playKind(kind, t, stepIdx, dest){
  const out = dest || bus();
  if(kind==='kick') vKick(t,out);
  else if(kind==='snare') vSnare(t,out);
  else if(kind==='hat') vHat(t,out, stepIdx%4===2);
  else if(kind==='bass') vBass(t,out, BASS_NOTES[stepIdx%8]);
  else if(kind==='arp') vArp(t,out, ARP_NOTES[stepIdx%8]);
  else vBubble(t,out, PAD_NOTES[stepIdx%4]);
}

// ---------- scheduler (tide cycle) ----------
function stepDur(){ return 60/state.bpm/4; }
function scheduler(){ const ac=ctx();
  while(state.nextTime < ac.currentTime + .14){
    const s = state.step;
    TRACKS.forEach(tr=>{ if(state.loops[tr.id] && tr.steps[s]) playKind(tr.kind, state.nextTime, s); });
    state.drawQueue.push({step:s, time:state.nextTime});
    state.nextTime += stepDur(); state.step = (state.step+1)%STEPS;
  }
}
function drawLoop(){ if(state.drawQueue.length){ const ac=ctx();
    while(state.drawQueue.length && state.drawQueue[0].time <= ac.currentTime+.02){
      const {step}=state.drawQueue.shift(); paintStep(step); } }
  requestAnimationFrame(drawLoop); }
function paintStep(s){
  document.querySelectorAll('.step').forEach(el=>el.classList.toggle('now', +el.dataset.step===s));
  moonEl.style.transform = `rotate(${s/STEPS*360}deg)`;
  moonFill.style.width = `${(s+1)/STEPS*100}%`;
  const tide = s<4?'FLOOD':s<8?'HIGH':s<12?'EBB':'LOW';
  tideLabel.textContent = tide;
  needleTide.style.transform = `rotate(${-70 + s/STEPS*140}deg)`;
}
function updatePressure(){ const n=Object.values(state.loops).filter(Boolean).length;
  loopCount.textContent = `${n} LOOP${n===1?'':'S'}`;
  needlePressure.style.transform = `rotate(${-70 + n/TRACKS.length*140}deg)`; }

// ---------- build DOM: reef + grid ----------
function buildReef(){
  reefEl.innerHTML='';
  TRACKS.forEach(tr=>{
    const b=document.createElement('div'); b.className='creature'+(state.loops[tr.id]?' loop-on':'');
    b.setAttribute('role','button'); b.setAttribute('tabindex','0');
    b.setAttribute('aria-label',`${tr.name}: tap to play, toggle loop valve`);
    b.innerHTML=`${tr.svg}<span class="glowdot"></span><h3>${tr.name}</h3><p class="latin">${tr.latin}</p>
      <div class="valve"><button aria-pressed="${!!state.loops[tr.id]}">${state.loops[tr.id]?'LOOP ●':'LOOP ○'}</button></div>`;
    const fire=()=>{ ctx(); playKind(tr.kind, AC.currentTime+.01, state.step, null);
      b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      setStatus(`${tr.name} sounds across the pool.`); };
    b.addEventListener('pointerdown',e=>{ if(e.target.closest('button')) return; fire(); });
    b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); }});
    const vb=b.querySelector('button');
    vb.addEventListener('click',e=>{ e.stopPropagation(); ctx();
      state.loops[tr.id]=!state.loops[tr.id]; vb.setAttribute('aria-pressed',state.loops[tr.id]); vb.textContent=state.loops[tr.id]?'LOOP ●':'LOOP ○';
      b.classList.toggle('loop-on',state.loops[tr.id]); updatePressure(); paintNames(); save();
      setStatus(state.loops[tr.id]?`${tr.name} joins the tide-cycle.`:`${tr.name} rests.`); });
    reefEl.appendChild(b);
  });
}
function buildGrid(){
  seqEl.innerHTML='';
  TRACKS.forEach(tr=>{
    const row=document.createElement('div'); row.className='seq-row'; row.dataset.track=tr.id;
    const nm=document.createElement('div'); nm.className='seq-name'+(state.loops[tr.id]?'':' off'); nm.textContent=tr.name; nm.title=tr.name;
    row.appendChild(nm);
    tr.steps.forEach((on,s)=>{
      const st=document.createElement('button'); st.className='step'+(on?' on':'')+(s%4===0?' beat4':'');
      st.dataset.track=tr.id; st.dataset.step=s; st.setAttribute('role','gridcell');
      st.setAttribute('aria-label',`${tr.name} step ${s+1} ${on?'on':'off'}`);
      st.addEventListener('click',()=>{ ctx(); tr.steps[s]^=1;
        st.classList.toggle('on',!!tr.steps[s]); st.setAttribute('aria-label',`${tr.name} step ${s+1} ${tr.steps[s]?'on':'off'}`);
        if(tr.steps[s]) playKind(tr.kind, AC.currentTime+.01, s, null); save(); });
      row.appendChild(st);
    });
    seqEl.appendChild(row);
  });
}
function paintNames(){ document.querySelectorAll('.seq-row').forEach(r=>{
  r.querySelector('.seq-name').classList.toggle('off', !state.loops[r.dataset.track]); }); }
function setStatus(m){ statusEl.textContent=m; }

// ---------- transport / fx wiring ----------
const btnPower=$('#btnPower');
btnPower.addEventListener('click',()=>{ const ac=ctx();
  state.playing=!state.playing;
  btnPower.setAttribute('aria-pressed',state.playing);
  btnPower.innerHTML = state.playing?'■ DAMP BOILER':'▶ STOKE BOILER';
  btnPower.classList.toggle('recording',state.playing);
  if(state.playing){ state.step=0; state.nextTime=ac.currentTime+.08; state.drawQueue.length=0;
    state.timer=setInterval(scheduler,25); setStatus(`Boiler stoked · ${state.bpm} BPM · tide cycling.`);
  } else { clearInterval(state.timer); setStatus('Boiler damped. The reef holds its breath.'); }
});
$('#btnClear').addEventListener('click',()=>{ TRACKS.forEach(t=>t.steps.fill(0)); buildGrid(); save(); setStatus('All valves vented. Carve a new tide.'); });
const tempo=$('#tempo'), bpmVal=$('#bpmVal');
tempo.value=state.bpm; bpmVal.textContent=state.bpm;
tempo.addEventListener('input',()=>{ state.bpm=+tempo.value; bpmVal.textContent=state.bpm; save(); });
function wireKnob(id, valId, ptrId, key){ const el=$('#'+id);
  el.value = Math.round(state[key]*100);
  const paint=()=>{ const v=+el.value; state[key]=v/100;
    $('#'+valId).textContent=v;
    const p=$('#'+ptrId); p.style.transform=`rotate(${-135+v/100*270}deg)`;
    p.parentElement.style.setProperty('--fill', v+'%');
    applyFX(); };
  el.addEventListener('input',()=>{ ctx(); paint(); save(); }); paint(); }
wireKnob('reverb','verbVal','ptrVerb','verb');
wireKnob('delay','delayVal','ptrDelay','delay');
wireKnob('drive','driveVal','ptrDrive','drive');

// ---------- WAV export (offline render of 4 tide-cycles) ----------
function encodeWAV(buf){ const n=buf.length, ch=Math.min(2,buf.numberOfChannels), sr=buf.sampleRate;
  const bytes=44+n*ch*2, ab=new ArrayBuffer(bytes), v=new DataView(ab);
  const wstr=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
  wstr(0,'RIFF'); v.setUint32(4,bytes-8,true); wstr(8,'WAVEfmt '); v.setUint32(16,16,true);
  v.setUint16(20,1,true); v.setUint16(22,ch,true); v.setUint32(24,sr,true);
  v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true); v.setUint16(34,16,true);
  wstr(36,'data'); v.setUint32(40,n*ch*2,true);
  const chans=[]; for(let c=0;c<ch;c++) chans.push(buf.getChannelData(c));
  let o=44; for(let i=0;i<n;i++) for(let c=0;c<ch;c++){ const s=Math.max(-1,Math.min(1,chans[c][i]));
    v.setInt16(o, s<0?s*0x8000:s*0x7FFF, true); o+=2; }
  return new Blob([ab],{type:'audio/wav'}); }
$('#btnWav').addEventListener('click', async ()=>{
  const btn=$('#btnWav'); btn.disabled=true; btn.textContent='⚙ RENDERING…'; setStatus('Etching phonograph cylinder… (4 tide-cycles)');
  try{
    const sr=44100, cycles=4, totalSteps=STEPS*cycles, sd=60/state.bpm/4, dur=totalSteps*sd+.8;
    const OC=new OfflineAudioContext(2, Math.ceil(sr*dur), sr);
    // offline graph mirrors live graph
    const m=OC.createGain(); m.gain.value=.9;
    const sh=OC.createWaveShaper(); const k=1+state.drive*40, N=256, cu=new Float32Array(N);
    for(let i=0;i<N;i++){ const x=i/(N-1)*2-1; cu[i]=Math.tanh(k*x)/Math.tanh(k*.5)*.6; } sh.curve=cu;
    const cp=OC.createDynamicsCompressor(); m.connect(sh); sh.connect(cp); cp.connect(OC.destination);
    const cv=OC.createConvolver(); cv.buffer=impulse(OC); const vg=OC.createGain(); vg.gain.value=state.verb*1.1;
    cv.connect(vg); vg.connect(m);
    const dl=OC.createDelay(2); dl.delayTime.value=.22+state.delay*.35;
    const fb=OC.createGain(); fb.gain.value=.38; dl.connect(fb); fb.connect(dl);
    const dg=OC.createGain(); dg.gain.value=state.delay*.8; dl.connect(dg); dg.connect(m);
    const dw=OC.createGain(); dw.gain.value=.4; dl.connect(dw); dw.connect(cv);
    const nb=OC.createBuffer(1, Math.ceil(sr*.25), sr); { const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
    const mk=()=>{ const g=OC.createGain(); g.connect(m);
      const vs=OC.createGain(); vs.gain.value=.9; g.connect(vs); vs.connect(cv);
      const ds=OC.createGain(); ds.gain.value=.7; g.connect(ds); ds.connect(dl); return g; };
    const hit=(kind,t,s)=>{ const o=mk();
      if(kind==='kick'){ const x=OC.createOscillator(),g=OC.createGain(); x.frequency.setValueAtTime(160,t); x.frequency.exponentialRampToValueAtTime(42,t+.12);
        g.gain.setValueAtTime(.9,t); g.gain.exponentialRampToValueAtTime(.001,t+.28); x.connect(g); g.connect(o); x.start(t); x.stop(t+.3); }
      else if(kind==='snare'){ const n2=OC.createBufferSource(); n2.buffer=nb; const f=OC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1900;
        const g=OC.createGain(); g.gain.setValueAtTime(.55,t); g.gain.exponentialRampToValueAtTime(.001,t+.18); n2.connect(f); f.connect(g); g.connect(o); n2.start(t); n2.stop(t+.2);
        const x=OC.createOscillator(),g2=OC.createGain(); x.frequency.value=190; g2.gain.setValueAtTime(.4,t); g2.gain.exponentialRampToValueAtTime(.001,t+.1);
        x.connect(g2); g2.connect(o); x.start(t); x.stop(t+.12); }
      else if(kind==='hat'){ const n2=OC.createBufferSource(); n2.buffer=nb; const f=OC.createBiquadFilter(); f.type='highpass'; f.frequency.value=7500;
        const g=OC.createGain(); const d=s%4===2?.22:.06; g.gain.setValueAtTime(.32,t); g.gain.exponentialRampToValueAtTime(.001,t+d); n2.connect(f); f.connect(g); g.connect(o); n2.start(t); n2.stop(t+d+.02); }
      else if(kind==='bass'){ const x=OC.createOscillator(); x.type='sawtooth'; x.frequency.value=BASS_NOTES[s%8];
        const f=OC.createBiquadFilter(); f.type='lowpass'; f.Q.value=6; f.frequency.setValueAtTime(700,t); f.frequency.exponentialRampToValueAtTime(180,t+.22);
        const g=OC.createGain(); g.gain.setValueAtTime(.5,t); g.gain.exponentialRampToValueAtTime(.001,t+.26); x.connect(f); f.connect(g); g.connect(o); x.start(t); x.stop(t+.3); }
      else if(kind==='arp'){ const x=OC.createOscillator(); x.type='triangle'; x.frequency.value=ARP_NOTES[s%8];
        const g=OC.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.4,t+.015); g.gain.exponentialRampToValueAtTime(.001,t+.4);
        x.connect(g); g.connect(o); x.start(t); x.stop(t+.45); }
      else { const x=OC.createOscillator(); x.frequency.setValueAtTime(PAD_NOTES[s%4],t); x.frequency.exponentialRampToValueAtTime(PAD_NOTES[s%4]*2.2,t+.18);
        const g=OC.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.38,t+.06); g.gain.exponentialRampToValueAtTime(.001,t+.5);
        x.connect(g); g.connect(o); x.start(t); x.stop(t+.55); } };
    for(let i=0;i<totalSteps;i++){ const t=i*sd+.05, s=i%STEPS;
      TRACKS.forEach(tr=>{ if(state.loops[tr.id]&&tr.steps[s]) hit(tr.kind,t,s); }); }
    const rendered=await OC.startRendering();
    const blob=encodeWAV(rendered), a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='reef-jam.wav'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000);
    setStatus(`Cylinder bottled · reef-jam.wav · ${cycles} tide-cycles at ${state.bpm} BPM.`);
  }catch(err){ setStatus('The etching needle snapped. Try again.'); }
  btn.disabled=false; btn.textContent='⬇ EXPORT REEF JAM (.WAV)';
});

// ---------- easter egg: THE KRAKEN ----------
const kraken=$('#kraken'); let rivets=0, typed='';
function awakenKraken(why){
  ctx(); // foghorn swell in C minor abyss
  const t0=AC.currentTime+.02;
  [55,65.41,82.41].forEach((f,i)=>{ const o=AC.createOscillator(),g=AC.createGain(); o.type='sawtooth'; o.frequency.value=f/2;
    g.gain.setValueAtTime(.0001,t0+i*.12); g.gain.exponentialRampToValueAtTime(.3,t0+i*.12+.4); g.gain.exponentialRampToValueAtTime(.001,t0+2.6);
    o.connect(g); g.connect(master); o.start(t0+i*.12); o.stop(t0+2.7); });
  // kraken remixes your tide: funky deterministic-ish mutation
  TRACKS.forEach((tr,i)=>{ tr.steps = tr.steps.map((_,s)=> ((s*7+i*5+3)%11<4)?1:0); if(!tr.steps.some(Boolean)) tr.steps[i%16]=1; state.loops[tr.id]=true; });
  buildGrid(); buildReef(); updatePressure(); paintNames(); save();
  $('#krakenMsg').textContent = why==='rivet'
    ? 'You pressed the forbidden rivet five times. It remixed your tide.'
    : 'You spoke its name. It remixed your tide.';
  kraken.classList.add('show'); document.body.classList.add('kraken-mode');
  setStatus('🦑 THE KRAKEN remixed your tide-cycle. It slaps, honestly.');
  setTimeout(()=>document.body.classList.remove('kraken-mode'), 12000);
}
$('#krakenRivet').addEventListener('click',()=>{ rivets++; setStatus(rivets>=4?'The rivet grows warm…':'A rivet. Surely decorative.');
  if(rivets>=5){ rivets=0; awakenKraken('rivet'); } });
$('#krakenBtn').addEventListener('click',()=>kraken.classList.remove('show'));
window.addEventListener('keydown',e=>{ if(e.key==='Escape') kraken.classList.remove('show');
  typed=(typed+e.key.toLowerCase()).slice(-6); if(typed==='kraken') awakenKraken('typed'); });

// ---------- init ----------
buildReef(); buildGrid(); updatePressure(); paintStep(0); requestAnimationFrame(drawLoop);
tempo.value=state.bpm; bpmVal.textContent=state.bpm;
setStatus(Object.values(state.loops).some(Boolean) ? 'Boiler cold. Press STOKE BOILER to start the tide.' : 'Boiler cold. Flip a LOOP valve, then STOKE BOILER.');
console.log('Reverb Reef ready — mind the third rivet.');
