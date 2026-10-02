// Moss Telegraph — tap dots/dashes, transmit to moss relay map, share the wire.
// Stack: plain HTML/CSS/JS. Persistence: localStorage. Sound: WebAudio, no assets.

const MORSE = {A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','?':'..--..','!':'-.-.--','/':'-..-.','&':'.-...',':':'---...','=':'-...-','+':'.-.-.','-':'-....-','_':'..--.-','"':'.-..-.','$':'...-..-','@':'.--.-.'};
const REV = Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
const STATIONS = [
  {id:'bog',   name:'BOG HUT',    coord:'51°N · SINK 03'},
  {id:'ruin',  name:'RUIN RELAY', coord:'52°N · FELL 07'},
  {id:'fen',   name:'FEN POST',   coord:'49°N · MIRe 12'},
  {id:'hollow',name:'HOLLOW',     coord:'50°N · ROOT 01'},
  {id:'quarry',name:'QUARRY',     coord:'53°N · GRIT 09'},
  {id:'thorn', name:'THORN GATE', coord:'48°N · BRAM 05'},
];
const LS_KEY = 'moss-telegraph-v1';
const DOT_MS = 220;          // hold shorter than this = dot
const LETTER_GAP = 900;      // pause -> letter break
const $ = (id)=>document.getElementById(id);
const els = { key:$('key'), needle:$('needle'), morse:$('morseOut'), text:$('textOut'),
  handle:$('handle'), station:$('station'), send:$('btn-send'), wire:$('wire'), map:$('map'),
  toast:$('toast'), cheat:$('cheat'), count:$('wireCount'),
  modal:$('modal'), mSt:$('m-station'), mTi:$('m-title'), mMe:$('m-meta'), mMo:$('m-morse'), mTx:$('m-text'), mWc:$('m-wc') };

// ---------- sound (WebAudio, no assets) ----------
let AC=null, muted=false;
function ac(){ if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); } if(AC.state==='suspended') AC.resume(); return AC; }
function tone({freq=660,dur=0.09,type='sine',vol=0.22,slide=0}){
  if(muted) return;
  try{
    const c=ac(), t=c.currentTime, o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.02);
  }catch(e){/* audio unavailable — stay silent */}
}
function noiseBurst(dur=0.35,vol=0.14,lp=1800){
  if(muted) return;
  try{
    const c=ac(), t=c.currentTime, len=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const s=c.createBufferSource(); s.buffer=buf;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp;
    const g=c.createGain(); g.gain.value=vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }catch(e){}
}
const sfx = {
  keyDown(){ tone({freq:640,dur:0.5,type:'square',vol:0.06}); },
  dot(){ tone({freq:720,dur:0.09,type:'sine',vol:0.25}); },
  dash(){ tone({freq:540,dur:0.26,type:'sine',vol:0.25}); },
  gap(){ tone({freq:330,dur:0.07,vol:0.1}); },
  back(){ tone({freq:220,dur:0.12,type:'sawtooth',vol:0.12}); },
  send(){ noiseBurst(0.5,0.2,2400); tone({freq:900,dur:0.5,slide:-650,type:'sawtooth',vol:0.08}); setTimeout(()=>tone({freq:520,dur:0.2,vol:0.2}),260); },
  pin(){ tone({freq:880,dur:0.12,vol:0.18}); setTimeout(()=>tone({freq:1174,dur:0.15,vol:0.15}),90); },
  water(){ tone({freq:900,dur:0.25,slide:-600,vol:0.2}); },
  paper(){ noiseBurst(0.18,0.1,900); },
};

// ---------- state ----------
let morseBuf='';   // raw '.- / ...' with ' ' letter sep, '/' word sep
let downAt=0, downTimer=null, letterTimer=null, keyOsc=null;
let msgs=[];
try{ msgs = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch(e){ msgs=[]; }
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(msgs)); }catch(e){} }
if(!Array.isArray(msgs)||!msgs.length){
  const t=Date.now();
  msgs=[
    {id:'seed1',who:'bogwitch',st:'bog',morse:'... --- ...',text:'SOS',water:7,mine:false,at:t-86400000},
    {id:'seed2',who:'fernop',st:'ruin',morse:'-- --- ... ... / .. ... / - .... .. -.-. -.-',text:'MOSS IS THICK',water:4,mine:false,at:t-43000000},
    {id:'seed3',who:'rustling',st:'fen',morse:'.... --- .-.. -.. / - .... . / -.- . -.--',text:'HOLD THE KEY',water:2,mine:false,at:t-9000000},
  ];
  save();
}
try{ els.handle.value = localStorage.getItem('moss-telegraph-handle')||''; }catch(e){}
els.handle.addEventListener('change',()=>{ try{localStorage.setItem('moss-telegraph-handle',els.handle.value);}catch(e){} });

// ---------- morse helpers ----------
function decode(m){
  if(!m.trim()) return '';
  return m.trim().split(' / ').map(w=>w.split(' ').map(l=>REV[l]||'�').join('')).join(' ');
}
function encodeText(t){
  return t.toUpperCase().split(' ').map(w=>[...w].map(c=>MORSE[c]||'').filter(Boolean).join(' ')).join(' / ');
}
function refreshReadout(){
  els.morse.innerHTML = morseBuf ? escapeHtml(morseBuf) : '<span class="ghost">··· −−− ··· waiting for signal…</span>';
  const d = decode(morseBuf);
  els.text.innerHTML = d ? escapeHtml(d) : '<span class="ghost">your words crawl out here…</span>';
  els.send.disabled = !d.trim();
  needleKick();
}
function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function needleKick(){ els.needle.style.transform='translateX(-50%) rotate(55deg)'; setTimeout(()=>{els.needle.style.transform='translateX(-50%) rotate(-60deg)';},140); }

// ---------- key input ----------
function pushSymbol(sym){
  clearTimeout(letterTimer);
  morseBuf += sym;
  (sym==='.'?sfx.dot:sfx.dash)();
  refreshReadout();
  letterTimer=setTimeout(()=>{ morseBuf+=' '; refreshReadout(); sfx.gap(); }, LETTER_GAP);
}
function wordGap(){ clearTimeout(letterTimer); if(morseBuf && !morseBuf.endsWith('/ ')){ morseBuf += (morseBuf.endsWith(' ')?'/ ':' / '); } sfx.gap(); refreshReadout(); }
function backspace(){
  clearTimeout(letterTimer);
  morseBuf = morseBuf.replace(/ \/ $/,'').replace(/ $/,'').slice(0,-1);
  sfx.back(); refreshReadout();
}
function startHold(e){
  if(e) e.preventDefault();
  if(downAt) return;
  ac(); // unlock audio on gesture
  downAt=performance.now();
  els.key.classList.add('down');
  try{
    const c=ac(), o=c.createOscillator(), g=c.createGain();
    o.type='square'; o.frequency.value=640; g.gain.value=0.05;
    o.connect(g).connect(c.destination); o.start();
    keyOsc={o,g};
  }catch(err){}
  clearTimeout(downTimer);
  downTimer=setTimeout(()=>{ if(keyOsc){ try{keyOsc.o.frequency.value=560;}catch(err){} } }, DOT_MS);
}
function endHold(e){
  if(!downAt) return;
  if(e) e.preventDefault();
  const held = performance.now()-downAt;
  downAt=0;
  els.key.classList.remove('down');
  clearTimeout(downTimer);
  if(keyOsc){ try{keyOsc.o.stop();}catch(err){} keyOsc=null; }
  pushSymbol(held < DOT_MS ? '.' : '-');
}
els.key.addEventListener('pointerdown',startHold);
window.addEventListener('pointerup',endHold);
els.key.addEventListener('pointerleave',()=>{ if(downAt) endHold(); });
window.addEventListener('keydown',(e)=>{
  if(e.code==='Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){ e.preventDefault(); if(!e.repeat) startHold(); }
});
window.addEventListener('keyup',(e)=>{ if(e.code==='Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){ e.preventDefault(); endHold(); } });
$('btn-dot').onclick=()=>{ac();pushSymbol('.');};
$('btn-dash').onclick=()=>{ac();pushSymbol('-');};
$('btn-gap').onclick=wordGap;
$('btn-back').onclick=backspace;
$('btn-clear').onclick=()=>{morseBuf='';sfx.back();refreshReadout();};

// ---------- stations / map ----------
els.station.innerHTML = STATIONS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
els.cheat.textContent = 'A ·−  B −···  C −·−·  D −··  E ·  F ··−·  G −−·  H ····  I ··  J ·−−−  K −·−  L ·−··  M −−  N −·  O −−−  P ·−−·  Q −−·−  R ·−·  S ···  T −  U ··−  V ···−  W ·−−  X −··−  Y −·−−  Z −−··   SOS ··· −−− ···';
let selStation = STATIONS[0].id;
els.station.onchange=()=>{ selStation=els.station.value; renderMap(); };

function renderMap(){
  els.map.innerHTML='';
  for(const s of STATIONS){
    const mine = msgs.filter(m=>m.st===s.id);
    const d=document.createElement('div');
    d.className='station'+(s.id===selStation?' sel':'');
    d.setAttribute('role','listitem'); d.tabIndex=0;
    d.setAttribute('aria-label',s.name+' — '+mine.length+' dispatches. Activate to select relay.');
    d.innerHTML=`<div class="st-name"><span>✚ ${s.name}</span><span class="cnt">${mine.length}</span></div>
      <div class="st-coord">${s.coord}</div>
      <div class="st-pins"></div>
      ${mine.length?'':'<div class="st-empty">no moss yet. be first.</div>'}
      <div class="st-moss">🌿🌿</div>`;
    const pins=d.querySelector('.st-pins');
    mine.slice(-8).forEach(m=>{
      const b=document.createElement('button');
      b.className='pin'+(m.mine?' mine':''); b.title=(m.who||'anon')+': '+(m.text||'');
      b.setAttribute('aria-label','Read dispatch from '+(m.who||'anon'));
      b.onclick=(ev)=>{ev.stopPropagation();sfx.pin();openModal(m.id);};
      pins.appendChild(b);
    });
    const pick=()=>{ selStation=s.id; els.station.value=s.id; sfx.paper(); renderMap(); };
    d.onclick=pick;
    d.onkeydown=(ev)=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pick();} };
    els.map.appendChild(d);
  }
  els.count.textContent = msgs.length+(msgs.length===1?' on the wire':' on the wire');
}

// ---------- wire feed ----------
function fmtTime(at){ const d=new Date(at); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
function renderWire(){
  els.wire.innerHTML='';
  if(!msgs.length){ els.wire.innerHTML='<div class="wire-empty">The wire is dead quiet. Pound the key above and transmit the first dispatch. 🌿</div>'; return; }
  const sorted=[...msgs].sort((a,b)=>b.at-a.at);
  for(const m of sorted){
    const st=STATIONS.find(s=>s.id===m.st);
    const d=document.createElement('article');
    d.className='msg';
    d.innerHTML=`<div class="mossbits">🌿</div>
      <div class="msg-head"><span class="msg-who">@${escapeHtml(m.who||'anon')}</span>
      <span class="msg-st">${st?st.name:''}</span><span class="msg-time">${fmtTime(m.at)}</span></div>
      <div class="msg-morse">${escapeHtml(m.morse||'')}</div>
      <div class="msg-text">${escapeHtml(m.text||'')}</div>
      <div class="msg-foot">
        <button class="btn" data-a="water">💧 water · ${m.water||0}</button>
        <button class="btn" data-a="read">☰ read</button>
        <button class="btn" data-a="copy">⧉ copy</button>
        <button class="btn" data-a="share">🔗 share</button>
        <button class="btn" data-a="del">burn</button>
      </div>`;
    d.querySelector('[data-a=water]').onclick=()=>{ m.water=(m.water||0)+1; sfx.water(); save(); renderWire(); renderMap(); };
    d.querySelector('[data-a=read]').onclick=()=>{ sfx.pin(); openModal(m.id); };
    d.querySelector('[data-a=copy]').onclick=()=>copyText(wireText(m),'dispatch copied');
    d.querySelector('[data-a=share]').onclick=()=>shareMsg(m);
    d.querySelector('[data-a=del]').onclick=(ev)=>{
      const b=ev.currentTarget;
      if(b.dataset.armed){ msgs=msgs.filter(x=>x.id!==m.id); save(); renderWire(); renderMap(); toast('dispatch burned 🜂'); sfx.paper(); }
      else{ b.dataset.armed='1'; b.textContent='sure? tap again'; sfx.back(); setTimeout(()=>{b.dataset.armed='';b.textContent='burn';},2500); }
    };
    els.wire.appendChild(d);
  }
}
function wireText(m){
  const st=STATIONS.find(s=>s.id===m.st);
  return `— MOSS TELEGRAPH —\n@${m.who||'anon'} via ${st?st.name:m.st} · ${fmtTime(m.at)}\n${m.morse}\n${m.text}\n💧 ${m.water||0}`;
}

// ---------- transmit ----------
els.send.onclick=()=>{
  const text=decode(morseBuf).trim();
  if(!text){ toast('nothing to transmit — tap the key first'); return; }
  const who=(els.handle.value||'anon').slice(0,16).replace(/[^\w.-]/g,'')||'anon';
  msgs.push({id:'m'+Date.now().toString(36)+Math.floor(Math.random()*999),who,st:selStation,morse:morseBuf.trim(),text,water:0,mine:true,at:Date.now()});
  save(); sfx.send();
  const panel=document.querySelector('.key-panel'); panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake');
  morseBuf=''; refreshReadout(); renderWire(); renderMap();
  toast('⚡ transmitted to '+(STATIONS.find(s=>s.id===selStation)||{}).name+' — the moss carries it');
};

// ---------- modal ----------
let modalId=null;
function openModal(id){
  const m=msgs.find(x=>x.id===id); if(!m) return;
  modalId=id;
  const st=STATIONS.find(s=>s.id===m.st);
  els.mSt.textContent='✚ '+(st?st.name:'UNKNOWN RELAY');
  els.mTi.textContent='@'+(m.who||'anon');
  els.mMe.textContent=fmtTime(m.at)+' · 💧 '+(m.water||0);
  els.mMo.textContent=m.morse||'';
  els.mTx.textContent=m.text||'';
  els.mWc.textContent=m.water||0;
  els.modal.hidden=false;
}
$('m-close').onclick=()=>{els.modal.hidden=true;};
els.modal.addEventListener('click',(e)=>{ if(e.target===els.modal) els.modal.hidden=true; });
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') els.modal.hidden=true; });
$('m-water').onclick=()=>{ const m=msgs.find(x=>x.id===modalId); if(m){m.water=(m.water||0)+1;sfx.water();save();els.mWc.textContent=m.water;els.mMe.textContent=fmtTime(m.at)+' · 💧 '+m.water;renderWire();} };
$('m-copy').onclick=()=>{ const m=msgs.find(x=>x.id===modalId); if(m) copyText(wireText(m),'dispatch copied'); };
$('m-share').onclick=()=>{ const m=msgs.find(x=>x.id===modalId); if(m) shareMsg(m); };
$('m-del').onclick=(ev)=>{ const m=msgs.find(x=>x.id===modalId); if(!m) return; const b=ev.currentTarget;
  if(b.dataset.armed){ msgs=msgs.filter(x=>x.id!==m.id); save(); renderWire(); renderMap(); els.modal.hidden=true; toast('dispatch burned 🜂'); }
  else{ b.dataset.armed='1'; b.textContent='really burn? tap again'; setTimeout(()=>{b.dataset.armed='';b.textContent='burn it';},2500); } };

// ---------- share / export ----------
function b64e(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64d(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return decodeURIComponent(escape(atob(s))); }
async function copyText(t,msg){
  try{ await navigator.clipboard.writeText(t); toast(msg||'copied ✓'); }
  catch(e){
    const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast(msg||'copied ✓'); }catch(err){ toast('copy blocked — select manually'); }
    ta.remove();
  }
  sfx.paper();
}
function shareMsg(m){
  const link=location.origin+location.pathname+'#m='+b64e(JSON.stringify({who:m.who,st:m.st,morse:m.morse,text:m.text}));
  copyText(link,'share link copied — opens this dispatch 🔗');
}
$('btn-copy').onclick=()=>copyText(msgs.map(wireText).join('\n\n────────\n\n')||'(empty wire)','whole wire copied ⧉');
$('btn-dl').onclick=()=>{
  const txt='MOSS TELEGRAPH — TRANSCRIPT · '+new Date().toLocaleString()+'\n'+'='.repeat(52)+'\n\n'+msgs.map(wireText).join('\n\n────────\n\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download='moss-telegraph-transcript.txt'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  sfx.paper(); toast('transcript downloaded ⬇');
};
$('btn-json').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(msgs,null,2)],{type:'application/json'}));
  a.download='moss-telegraph-wire.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  sfx.paper(); toast('wire exported as json { }');
};
$('btn-link').onclick=()=>{
  const link=location.origin+location.pathname+'#w='+b64e(JSON.stringify(msgs.slice(-30)));
  copyText(link,'wire share-link copied — up to 30 latest 🔗');
};
$('btn-mute').onclick=(e)=>{ muted=!muted; e.currentTarget.textContent=muted?'♪ sound: off':'♪ sound: on'; e.currentTarget.setAttribute('aria-pressed',String(muted)); if(!muted) sfx.pin(); };
$('btn-wipe').onclick=(e)=>{
  if(e.currentTarget.dataset.armed){ msgs=[]; save(); renderWire(); renderMap(); toast('the whole wire is ash 🜂'); }
  else{ e.currentTarget.dataset.armed='1'; e.currentTarget.textContent='really burn everything? click again'; setTimeout(()=>{e.currentTarget.dataset.armed='';e.currentTarget.textContent='burn the whole wire';},3000); }
};
let toastT=null;
function toast(t){ els.toast.textContent=t; els.toast.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>els.toast.classList.remove('show'),2600); }

// ---------- inbound share links ----------
(function inbound(){
  if(!location.hash) return;
  try{
    if(location.hash.startsWith('#m=')){
      const m=JSON.parse(b64d(location.hash.slice(3)));
      const text=(m.text||decode(m.morse||'')).trim();
      if(text){ msgs.push({id:'m'+Date.now().toString(36),who:(m.who||'anon').slice(0,16),st:m.st||'bog',morse:m.morse||encodeText(text),text,water:0,mine:false,at:Date.now()}); save(); toast('📨 a shared dispatch joined your wire'); }
      history.replaceState(null,'',location.pathname);
    }else if(location.hash.startsWith('#w=')){
      const arr=JSON.parse(b64d(location.hash.slice(3)));
      if(Array.isArray(arr)&&arr.length){ const have=new Set(msgs.map(m=>m.morse+'|'+m.at)); let n=0; for(const m of arr){ if(!have.has(m.morse+'|'+m.at)){msgs.push(m);n++;} } save(); toast(`📨 ${n} shared dispatch${n===1?'':'es'} joined your wire`); }
      history.replaceState(null,'',location.pathname);
    }
  }catch(e){ toast('that share link was overgrown beyond reading'); }
})();

// ---------- init ----------
refreshReadout(); renderMap(); renderWire();
console.log('moss telegraph ready — hold the key');
