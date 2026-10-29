/* MOSS FROG CHORUS — WebAudio-only pond. Classic script (file:// safe). */
(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };

/* ---------- data ---------- */
var FROGS = [
  {name:"BASSO", glyph:"●", shape:"rd", len:16, hits:5, base:58,  kind:0},
  {name:"RIBBIT",glyph:"◐", shape:"sq", len:12, hits:5, base:196, kind:1},
  {name:"PLOP",  glyph:"▼", shape:"sq", len:9,  hits:3, base:330, kind:2},
  {name:"KLICK", glyph:"▲", shape:"rd", len:8,  hits:4, base:880, kind:3},
  {name:"GULP",  glyph:"◑", shape:"rd", len:7,  hits:3, base:140, kind:4},
  {name:"TRILL", glyph:"⬢", shape:"sq", len:6,  hits:3, base:290, kind:5},
  {name:"SNORO", glyph:"◍", shape:"rd", len:5,  hits:2, base:78,  kind:6},
  {name:"PEEP",  glyph:"⬣", shape:"sq", len:4,  hits:2, base:660, kind:7}
];
var state = {
  playing:false, bpm:96, pitch:0, verb:35, evolve:true, evoBars:2,
  patterns:[], mutes:[false,false,false,false,false,false,false,false],
  step:0, nextT:0
};

/* euclidean rhythm */
function euclid(k,n){
  var p=[], i, bucket=0;
  for(i=0;i<n;i++){ bucket+=k; if(bucket>=n){bucket-=n; p.push(true);} else p.push(false); }
  return p;
}
function preset(){
  state.patterns = FROGS.map(function(f){ return euclid(f.hits, f.len); });
  state.mutes = FROGS.map(function(){ return false; });
}
/* restore: hash > localStorage > preset */
function loadPersist(){
  try{
    var h = location.hash.match(/c=([A-Za-z0-9+/=_-]+)/);
    if(h){
      var j = JSON.parse(decodeURIComponent(escape(atob(h[1].replace(/-/g,"+").replace(/_/g,"/")))));
      if(j && j.p){ state.bpm=j.b; state.pitch=j.q||0; state.verb=(j.v==null?35:j.v);
        state.patterns=j.p; state.mutes=j.m||state.mutes; state.evolve=j.e!==false; return true; }
    }
    var s = JSON.parse(localStorage.getItem("mfc1")||"null");
    if(s && s.patterns){ Object.assign(state,s); return true; }
  }catch(e){}
  return false;
}
function save(){
  try{ localStorage.setItem("mfc1", JSON.stringify({bpm:state.bpm,pitch:state.pitch,verb:state.verb,evolve:state.evolve,evoBars:state.evoBars,patterns:state.patterns,mutes:state.mutes})); }catch(e){}
  var n=$("saveNote"); if(n) n.textContent="saved locally ✓ "+new Date().toLocaleTimeString();
}

/* ---------- audio ---------- */
var AC=null, master, dryG, wetG, verb, analyser, noiseBuf, recDest, meterFill;
function ctx(){
  if(AC) return AC;
  var C = window.AudioContext||window.webkitAudioContext; AC = new C();
  master=AC.createGain(); master.gain.value=.9;
  analyser=AC.createAnalyser(); analyser.fftSize=256;
  dryG=AC.createGain(); wetG=AC.createGain();
  verb=AC.createConvolver(); verb.buffer=impulse(2.4,3.2);
  var comp=AC.createDynamicsCompressor();
  dryG.connect(master); verb.connect(wetG); wetG.connect(master);
  master.connect(comp); comp.connect(analyser); analyser.connect(AC.destination);
  recDest=AC.createMediaStreamDestination(); master.connect(recDest);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*1,AC.sampleRate);
  var d=noiseBuf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  applyVerb();
  return AC;
}
function impulse(dur,decay){
  var rate=AC.sampleRate, len=rate*dur, buf=AC.createBuffer(2,len,rate);
  for(var c=0;c<2;c++){ var ch=buf.getChannelData(c);
    for(var i=0;i<len;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay); }
  return buf;
}
function applyVerb(){ if(!AC) return; var w=state.verb/100; wetG.gain.value=w*.9; dryG.gain.value=1-w*.55; }
function rate(){ return Math.pow(2, state.pitch/12); }

function env(g,t,a,peak,dec){
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(peak,t+a);
  g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec);
}
/* one synthesized frog croak. t = AudioContext time */
function croak(i,t,vol){
  ctx(); var f=FROGS[i], r=rate(), v=(vol||.8);
  var out=AC.createGain(); out.connect(dryG);
  var send=AC.createGain(); send.gain.value=.8; out.connect(send); send.connect(verb);
  function osc(type,f0,f1,dur,peak,wobF,wobD){
    var o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.setValueAtTime(Math.max(20,f0*r),t);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1*r),t+dur);
    var lfo=null,lg=null;
    if(wobF){ lfo=AC.createOscillator(); lg=AC.createGain();
      lfo.frequency.value=wobF; lg.gain.value=(wobD||0)*f0;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t+dur+.05); }
    env(g,t,.008,peak*v,dur); o.connect(g); g.connect(out);
    o.start(t); o.stop(t+dur+.1);
  }
  function noise(dur,peak,hp){
    var s=AC.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
    var fl=AC.createBiquadFilter(); fl.type=hp?"highpass":"lowpass"; fl.frequency.value=hp||900;
    var g=AC.createGain(); env(g,t,.005,peak*v,dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t+dur+.1);
  }
  switch(f.kind){
    case 0: osc("sine",f.base,f.base*.5,.5,.5); osc("sawtooth",f.base*2,f.base,.35,.18); break;
    case 1: osc("square",f.base,f.base*.72,.16,.3,27,.35); noise(.06,.12); break;              /* ribbit: AM-ish wobble */
    case 2: osc("sine",f.base,f.base*.22,.22,.4); noise(.09,.25,2500); break;                  /* plop */
    case 3: osc("sine",f.base,f.base*1.4,.07,.22); noise(.05,.3,4000); break;                  /* klick */
    case 4: osc("triangle",f.base,f.base*.55,.32,.4,6,.25); break;                             /* gulp */
    case 5: osc("sawtooth",f.base,f.base*1.6,.28,.22,14,.5); break;                            /* trill */
    case 6: osc("sawtooth",f.base,f.base*.9,.6,.4,4,.4); osc("sine",f.base/2,f.base/3,.6,.3); break;
    default: osc("sine",f.base,f.base*.8,.14,.35,9,.15);
  }
}

/* ---------- sequencer ---------- */
var timer=null, uiTimers=[];
function stepDur(){ return 60/state.bpm/4; }
function scheduler(){
  if(!state.playing) return;
  var ahead=.14;
  while(state.nextT < AC.currentTime + ahead){
    scheduleStep(state.step, state.nextT);
    state.nextT += stepDur(); state.step++;
    if(state.evolve && state.step % (state.evoBars*16)===0) evolve();
  }
}
function scheduleStep(s,t){
  var delay=Math.max(0,(t-AC.currentTime)*1000);
  uiTimers.push(setTimeout(function(){ drawHead(s); }, delay));
  FROGS.forEach(function(f,i){
    if(state.mutes[i]) return;
    var pat=state.patterns[i]; if(pat && pat[s%pat.length]) croak(i,t,.75);
  });
  if(uiTimers.length>64) uiTimers.splice(0, uiTimers.length-64);
}
function evolve(){
  var i=(Math.random()*FROGS.length)|0, pat=state.patterns[i]; if(!pat) return;
  var lane=document.querySelector('.lane[data-i="'+i+'"]');
  if(Math.random()<.5){ pat.push(pat.shift()); }                       /* rotate */
  else{                                                                  /* toggle one step */
    var j=(Math.random()*pat.length)|0, on=pat.filter(Boolean).length;
    if(pat[j] && on>1) pat[j]=false; else if(!pat[j] && on<pat.length-1) pat[j]=true;
    else pat.push(pat.shift());
  }
  renderLane(i); save();
  if(lane){ lane.classList.remove("evo"); void lane.offsetWidth; lane.classList.add("evo"); }
  toast(FROGS[i].name+" evolved ⟳");
}

/* ---------- ui: pads + lanes ---------- */
var padsEl=$("pads"), lanesEl=$("lanes");
function buildPads(){
  padsEl.innerHTML="";
  FROGS.forEach(function(f,i){
    var b=document.createElement("button");
    b.className="pad f"+i; b.setAttribute("role","gridcell");
    b.setAttribute("aria-label",f.name+" frog pad, "+f.len+"-step cycle. Press "+(i+1));
    b.innerHTML='<span class="key">'+(i+1)+'</span><span class="disc">'+f.glyph+'</span>'+
      '<span class="nm">'+f.name+'</span><br><span class="ln">'+f.len+' STEPS · '+(state.mutes[i]?"MUTED":"LIVE")+'</span><span class="rip"></span>';
    b.addEventListener("pointerdown",function(e){ e.preventDefault(); tapPad(i,b); });
    padsEl.appendChild(b);
  });
}
function tapPad(i,btn){
  ctx(); if(AC.state==="suspended") AC.resume();
  croak(i,AC.currentTime,.9);
  btn=btn||padsEl.children[i];
  btn.classList.remove("hit"); void btn.offsetWidth; btn.classList.add("hit");
  setTimeout(function(){btn.classList.remove("hit");},550);
  blip(i);
}
function blip(i){ /* flash matching lane */
  var lane=lanesEl.querySelector('.lane[data-i="'+i+'"]');
  if(lane){ lane.classList.remove("evo"); void lane.offsetWidth; lane.classList.add("evo"); }
}
function renderLanes(){
  lanesEl.innerHTML="";
  FROGS.forEach(function(f,i){
    var row=document.createElement("div");
    row.className="lane"+(state.mutes[i]?" off":""); row.dataset.i=i;
    var dotC=["#2447F5","#D8402A","#B88A00","#3E6B34","#C26A00","#5B3DF0","#0E6B54","#C2145B"][i];
    row.innerHTML='<span class="lname"><i style="background:'+dotC+'"></i>'+f.name+'·'+f.len+'</span>'+
      '<span class="steps"></span><button class="mute" aria-label="mute '+f.name+'">'+(state.mutes[i]?"✕":"♪")+'</button>';
    row.querySelector(".mute").addEventListener("click",function(){
      state.mutes[i]=!state.mutes[i]; renderLanes(); buildPadsMute(); save();
    });
    lanesEl.appendChild(row); renderLane(i);
  });
}
function renderLane(i){
  var row=lanesEl.querySelector('.lane[data-i="'+i+'"]'); if(!row) return;
  var box=row.querySelector(".steps"); box.innerHTML="";
  var pat=state.patterns[i], f=FROGS[i];
  pat.forEach(function(on,j){
    var s=document.createElement("button");
    s.className="st "+f.shape+(on?" on":"");
    s.setAttribute("aria-label",f.name+" step "+(j+1)+(on?" on":" off"));
    s.addEventListener("click",function(){
      pat[j]=!pat[j]; s.classList.toggle("on"); ctx(); if(pat[j]) croak(i,AC.currentTime,.7); save();
    });
    box.appendChild(s);
  });
}
function buildPadsMute(){
  FROGS.forEach(function(f,i){
    var b=padsEl.children[i]; if(!b) return;
    b.classList.toggle("muted",state.mutes[i]);
    var ln=b.querySelector(".ln"); if(ln) ln.textContent=f.len+" STEPS · "+(state.mutes[i]?"MUTED":"LIVE");
  });
  lanesEl.querySelectorAll(".lane").forEach(function(row){
    var i=+row.dataset.i; row.classList.toggle("off",state.mutes[i]);
    var m=row.querySelector(".mute"); if(m) m.textContent=state.mutes[i]?"✕":"♪";
  });
}
function drawHead(s){
  $("stepReadout").textContent=(state.playing?"▶ BAR "+(Math.floor(s/16)+1)+" · STEP "+(s%16+1):"STOPPED")+" · "+state.bpm+" BPM";
  lanesEl.querySelectorAll(".lane").forEach(function(row){
    var i=+row.dataset.i, pat=state.patterns[i]; if(!pat) return;
    var cells=row.querySelectorAll(".st"), pos=s%pat.length;
    cells.forEach(function(c,j){ c.classList.toggle("now", j===pos); });
    if(pat[pos] && !state.mutes[i]){ var p=padsEl.children[i]; if(p){p.classList.add("flash"); setTimeout(function(){p.classList.remove("flash");},120);} }
  });
}

/* ---------- transport ---------- */
function setPlaying(on){
  state.playing=on;
  var b=$("btnPlay");
  b.textContent=on?"■ STOP CHORUS":"▶ START CHORUS";
  b.classList.toggle("playing",on); b.setAttribute("aria-pressed",on);
  if(on){ ctx(); if(AC.state==="suspended") AC.resume();
    state.step=0; state.nextT=AC.currentTime+.08;
    timer=setInterval(scheduler,25);
  } else { clearInterval(timer); uiTimers.forEach(clearTimeout); uiTimers=[];
    $("stepReadout").textContent="STOPPED · "+state.bpm+" BPM";
    lanesEl.querySelectorAll(".st.now").forEach(function(c){c.classList.remove("now");});
  }
}

/* ---------- record + share ---------- */
var rec=null, chunks=[], recStart=0, recTick=null, lastBlob=null;
function toggleRec(){
  ctx();
  var b=$("btnRec");
  if(rec){ rec.stop(); return; }
  try{
    chunks=[];
    rec=new MediaRecorder(recDest.stream);
  }catch(e){ toast("recording not supported here"); return; }
  rec.ondataavailable=function(e){ if(e.data.size) chunks.push(e.data); };
  rec.onstop=function(){
    clearInterval(recTick); b.classList.remove("armed"); b.textContent="● REC LOOP"; b.setAttribute("aria-pressed","false");
    lastBlob=new Blob(chunks,{type:rec.mimeType||"audio/webm"});
    var url=URL.createObjectURL(lastBlob);
    $("loopAudio").src=url; $("loopBox").hidden=false;
    $("btnShare").disabled=false; $("btnDl").disabled=false;
    $("recTime").textContent=""; toast("loop captured ✓ ("+Math.round(lastBlob.size/1024)+" KB)");
    rec=null;
  };
  rec.start(); recStart=Date.now(); b.classList.add("armed"); b.textContent="■ STOP"; b.setAttribute("aria-pressed","true");
  recTick=setInterval(function(){ $("recTime").textContent="● "+((Date.now()-recStart)/1000).toFixed(1)+"s"; },100);
  toast("recording pond… tap pads!");
}
function shareLink(){
  var j={b:state.bpm,q:state.pitch,v:state.verb,e:state.evolve,p:state.patterns,m:state.mutes};
  var code=btoa(unescape(encodeURIComponent(JSON.stringify(j)))).replace(/\+/g,"-").replace(/\//g,"_");
  var url=location.href.split("#")[0]+"#c="+code;
  function done(){ toast("share link copied ✓"); }
  if(navigator.share){ navigator.share({title:"Moss Frog Chorus",url:url}).catch(function(){ copy(url,done); }); }
  else copy(url,done);
}
function copy(txt,ok){
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,function(){fallback();});
  else fallback();
  function fallback(){ var t=document.createElement("textarea"); t.value=txt; document.body.appendChild(t); t.select();
    try{document.execCommand("copy"); ok();}catch(e){prompt("Copy this link:",txt);} t.remove(); }
}

/* ---------- misc ui ---------- */
function toast(msg){
  var t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  $("toasts").appendChild(t); setTimeout(function(){t.remove();},2200);
}
function bindSlider(id,fn){ $(id).addEventListener("input",function(e){ fn(+e.target.value); save(); }); }
function syncLabels(){
  $("bpmVal").textContent=state.bpm; $("bpm").value=state.bpm;
  $("pitchVal").textContent=(state.pitch>=0?"+":"")+state.pitch+" st"; $("pitch").value=state.pitch;
  $("verbVal").textContent=state.verb+"%"; $("verb").value=state.verb;
  $("evoVal").textContent=(state.evolve?"on":"off")+" · "+state.evoBars+" bars"; $("evoRate").value=state.evoBars;
  var be=$("btnEvolve"); be.textContent=state.evolve?"◉ auto-evolve: on":"○ auto-evolve: off";
  be.classList.toggle("on",state.evolve); be.setAttribute("aria-pressed",state.evolve);
}

/* ---------- events ---------- */
$("btnPlay").addEventListener("click",function(){ setPlaying(!state.playing); });
$("btnEvolve").addEventListener("click",function(){ state.evolve=!state.evolve; syncLabels(); save(); });
$("btnRec").addEventListener("click",toggleRec);
$("btnShare").addEventListener("click",shareLink);
$("btnDl").addEventListener("click",function(){
  if(!lastBlob) return; var a=document.createElement("a");
  a.href=$("loopAudio").src; a.download="moss-frog-chorus-loop.webm"; a.click();
});
$("btnPreset").addEventListener("click",function(){ preset(); renderLanes(); buildPadsMute(); save(); toast("classic chorus loaded"); });
$("btnDice").addEventListener("click",function(){
  state.patterns=FROGS.map(function(f){
    var k=1+((Math.random()* (f.len-2))|0), p=euclid(k,f.len), r=(Math.random()*f.len)|0;
    return p.slice(r).concat(p.slice(0,r));
  });
  renderLanes(); save(); toast("pond remixed ⟳");
});
$("btnClear").addEventListener("click",function(){
  state.patterns=FROGS.map(function(f){ return f.len; }).map(function(n){ var a=[]; for(var i=0;i<n;i++)a.push(false); return a; });
  renderLanes(); save(); toast("pond drained — tap steps to compose");
});
bindSlider("bpm",function(v){ state.bpm=v; syncLabels(); });
bindSlider("pitch",function(v){ state.pitch=v; syncLabels(); });
bindSlider("verb",function(v){ state.verb=v; applyVerb(); syncLabels(); });
bindSlider("evoRate",function(v){ state.evoBars=v; syncLabels(); });

document.addEventListener("keydown",function(e){
  if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")) return;
  if(e.code==="Space"){ e.preventDefault(); setPlaying(!state.playing); }
  else if(e.key>="1"&&e.key<="8"){ tapPad(+e.key-1); }
  else if(e.key==="r"||e.key==="R"){ toggleRec(); }
  else frogEgg(e.key);
});
var egg="";
function frogEgg(k){ egg=(egg+k.toLowerCase()).slice(-4);
  if(egg==="frog"){ toast("🐸 RIBBIT RIBBIT 🐸"); for(var i=0;i<8;i++)(function(i){setTimeout(function(){tapPad(i);},i*120);})(i); egg=""; }
}

/* ticker */
(function(){ var t=$("tickerText"); t.textContent=(t.textContent+" ").repeat(3); })();

/* meter */
setInterval(function(){
  if(!AC||!analyser) return;
  var a=new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(a);
  var s=0; for(var i=0;i<a.length;i++) s+=a[i]; s/=a.length;
  if(meterFill) meterFill.style.width=Math.min(100,s*1.6)+"%";
  else meterFill=$("meterFill");
},90);

/* ---------- init ---------- */
if(!loadPersist()) preset();
buildPads(); renderLanes(); buildPadsMute(); syncLabels();
meterFill=$("meterFill");
if(location.hash.indexOf("#c=")===0) toast("shared pond loaded ✓ — press play");
})();
