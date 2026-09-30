// Paper Crane Exchange — neon fold network
// Features: fold+launch (core), polished cyberpunk UI, share/export
// Constraints: scroll-reactive sky, WebAudio sounds (no assets)

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const LS = 'paper-crane-exchange-v1';
const COLORS = { pink:'#ff2a6d', cyan:'#05d9e8', lime:'#f9f002', violet:'#b537f2', ghost:'#e8f6ff' };

/* ---------- sound (WebAudio, no assets) ---------- */
let AC = null, soundOn = true;
function ac(){ if(!AC){ AC = new (window.AudioContext||window.webkitAudioContext)(); } if(AC.state==='suspended') AC.resume(); return AC; }
function tone(freq, dur=0.12, type='square', vol=0.08, slide=0){
  if(!soundOn) return;
  try{
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), c.currentTime+dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+dur);
  }catch(e){}
}
const sfx = {
  hover(){ tone(880,.05,'sine',.03); },
  fold(n){ tone(220+n*140,.16,'triangle',.1,180); setTimeout(()=>tone(330+n*120,.1,'square',.05),90); },
  unfold(){ tone(500,.2,'sawtooth',.06,-300); },
  type(){ tone(1200+Math.random()*400,.03,'sine',.02); },
  launch(){ tone(180,.5,'sawtooth',.1,700); setTimeout(()=>tone(880,.25,'sine',.07,440),200); },
  catch(){ [660,880,1320].forEach((f,i)=>setTimeout(()=>tone(f,.15,'sine',.09),i*110)); },
  keep(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.14,'triangle',.08),i*90)); },
  share(){ tone(990,.1,'square',.06); setTimeout(()=>tone(1320,.14,'square',.06),110); },
  wind(v){ if(!soundOn||v<2) return; tone(90+v*8,.3,'sawtooth',.015,v*4); }
};
$('#soundBtn').addEventListener('click', (e)=>{
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? '♪ ON' : '♪ OFF';
  e.currentTarget.classList.toggle('off', !soundOn);
  if(soundOn) sfx.share();
});

/* ---------- state ---------- */
const SEED = [
  ['the rain on level 9 tastes like static and strawberries. come up.','nova-9','pink'],
  ['i hid a mixtape in locker 044 at the night market. password is crane.','ghostline','cyan'],
  ['if your neon is flickering, it means the city is dreaming about you.','moth.exe','violet'],
  ['rooftop K-9, 3am, when the drones sleep. bring paper. bring secrets.','origami_jane','lime'],
  ['sold my hoverboard for a thousand paper cranes. best trade ever.','kaito','cyan'],
  ['dear stranger: you looked kind under the pink rain. keep going.','anon','ghost'],
  ['the grid hums in B minor tonight. fold along.','synth-priest','violet'],
  ['lost: one chrome feather. reward: one true wish.','vex','pink'],
  ['they paved the river but the cranes remember the way. follow them.','old-tokyo','lime'],
  ['every fold is a promise the paper keeps for you.','sensei_loop','ghost'],
  ['meet at the ramen stall with no name. i will be the one glowing.','neonfox','pink'],
  ['transmission ends. the sky keeps your echo. launch another.','sysop','cyan'],
];
function load(){
  try{ const d = JSON.parse(localStorage.getItem(LS)); if(d && Array.isArray(d.cranes)) return d; }catch(e){}
  return { cranes: SEED.map((s,i)=>({ id:'seed-'+i, msg:s[0], from:s[1], color:s[2], mine:false, kept:false, ts:Date.now()-i*36e5 })), caught:0, folded:0 };
}
let store = load();
function save(){ try{ localStorage.setItem(LS, JSON.stringify(store)); }catch(e){} }
function airborne(){ return store.cranes.filter(c=>!c.kept); }

/* ---------- ticker ---------- */
function renderTicker(){
  const items = store.cranes.slice(0,10).map(c=>`◈ ${c.msg.slice(0,42)} — @${c.from}`).join(' &nbsp;///&nbsp; ');
  $('#ticker').innerHTML = items + ' &nbsp;///&nbsp; ' + items;
}
renderTicker();

/* ---------- fold bay ---------- */
let foldStep = 0, wrapColor = 'cyan';
const paper = $('#paper'), glow = $('#paperGlow');
function paintPaper(){
  const c = COLORS[wrapColor];
  if(foldStep < 4){ paper.style.borderColor = c; paper.style.boxShadow = `0 0 24px ${c}55`; }
  $('#craneBody').style.stroke = c;
  $('#craneBody').style.filter = `drop-shadow(0 0 8px ${c})`;
  $('#shareCard').style.borderColor = c;
  $('.sc-crane').style.color = c;
}
paintPaper();

$$('#foldSteps button').forEach(b=>b.addEventListener('click', ()=>{
  const n = +b.dataset.fold;
  if(n === foldStep+1){
    foldStep = n; sfx.fold(n);
    paper.dataset.step = foldStep;
    glow.classList.remove('flash'); void glow.offsetWidth; glow.classList.add('flash');
    document.querySelector(`#foldSteps li:nth-child(${n})`).classList.add('done');
  } else if(n <= foldStep){ toast('already folded — keep going forward ▸'); sfx.hover(); }
  else { toast('fold in order: I → II → III → IV'); sfx.unfold(); paper.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(0)'}],{duration:220}); }
  paintPaper(); updateLaunch();
}));
$('#unfoldBtn').addEventListener('click', ()=>{ foldStep=0; paper.dataset.step=0; $$('#foldSteps li').forEach(li=>li.classList.remove('done')); sfx.unfold(); updateLaunch(); paintPaper(); });
$$('#swatches .sw').forEach(b=>b.addEventListener('click', ()=>{
  $$('#swatches .sw').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  wrapColor = b.dataset.c; sfx.hover(); paintPaper(); updateShareCard();
}));
$('#msgInput').addEventListener('input', (e)=>{ $('#charCount').textContent = `${e.target.value.length}/140`; if(Math.random()<.3) sfx.type(); updateShareCard(); });
$('#fromInput').addEventListener('input', ()=>{ if(Math.random()<.3) sfx.type(); updateShareCard(); });
function updateLaunch(){
  const btn = $('#launchBtn'), ok = foldStep===4 && $('#msgInput').value.trim().length>0;
  btn.disabled = !ok;
  btn.innerHTML = foldStep<4 ? `◇ COMPLETE ALL 4 FOLDS TO LAUNCH (${foldStep}/4)` : ($('#msgInput').value.trim() ? '◤ LAUNCH INTO THE SKY ◢' : '◇ INK A MESSAGE TO LAUNCH');
}

/* ---------- launch ---------- */
$('#launchBtn').addEventListener('click', ()=>{
  const msg = $('#msgInput').value.trim(); if(!msg || foldStep<4) return;
  const crane = { id:'c'+Date.now().toString(36), msg, from:($('#fromInput').value.trim()||'anonymous ghost').slice(0,18), color:wrapColor, mine:true, kept:false, ts:Date.now() };
  sfx.launch();
  $('#paperWrap').classList.add('launching');
  setTimeout(()=>{
    $('#paperWrap').classList.remove('launching');
    store.cranes.unshift(crane); store.folded++;
    save(); renderAll(); updateShareCard(true, crane);
    skyBurst();
    foldStep=0; paper.dataset.step=0; $$('#foldSteps li').forEach(li=>li.classList.remove('done'));
    $('#msgInput').value=''; $('#fromInput').value=''; $('#charCount').textContent='0/140';
    updateLaunch(); paintPaper();
    toast('◤ crane airborne — catch one back ↓');
    document.getElementById('stream').scrollIntoView({behavior:'smooth'});
  }, 950);
});

/* ---------- stream grid ---------- */
let filter = 'all';
$$('.filters .chip').forEach(ch=>ch.addEventListener('click', ()=>{
  $$('.filters .chip').forEach(x=>x.classList.remove('on')); ch.classList.add('on');
  filter = ch.dataset.filter; sfx.hover(); renderGrid();
}));
function filtered(){
  if(filter==='mine') return store.cranes.filter(c=>c.mine);
  if(filter==='caught') return store.cranes.filter(c=>c.kept);
  if(filter==='air') return airborne();
  return store.cranes;
}
const GLYPH = { pink:'✹', cyan:'✈', lime:'➤', violet:'❖', ghost:'☁' };
function renderGrid(){
  const g = $('#craneGrid'), list = filtered();
  if(!list.length){ g.innerHTML = `<div class="empty">no cranes on this frequency yet.<br/>fold one above and launch it ↑</div>`; return; }
  g.innerHTML = '';
  list.slice(0,30).forEach(c=>{
    const el = document.createElement('div');
    el.className = 'crane-card' + (c.mine?' mine':'') + (c.kept?' kept':'');
    el.style.setProperty('--glow', COLORS[c.color]||COLORS.cyan);
    el.innerHTML = `<div class="cc-top"><span>${c.kept?'♥ KEPT':(c.mine?'◈ MINE':'○ AIRBORNE')}</span><span>#${c.id.slice(-4).toUpperCase()}</span></div>
      <div class="cc-glyph">${GLYPH[c.color]||'✈'}</div>
      <p class="cc-msg">${escapeHtml(c.msg.length>64?c.msg.slice(0,64)+'…':c.msg)}</p>
      <p class="cc-from">@${escapeHtml(c.from)}</p>`;
    el.addEventListener('click', ()=>openModal(c));
    el.addEventListener('mouseenter', ()=>sfx.hover(), {once:false});
    g.appendChild(el);
  });
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function renderStats(){
  $('#statFolded').textContent = store.folded + store.cranes.filter(c=>c.mine).length;
  $('#statAir').textContent = airborne().length;
  $('#statCaught').textContent = store.cranes.filter(c=>c.kept).length;
}
function renderAll(){ renderGrid(); renderStats(); renderTicker(); }
renderAll(); updateLaunch();

/* ---------- modal (catch) ---------- */
let current = null;
function openModal(c){
  current = c; sfx.catch();
  $('#mMsg').textContent = '“' + c.msg + '”';
  $('#mFrom').textContent = '— @' + c.from + ' · #' + c.id.slice(-4).toUpperCase();
  $('#mCrane').style.color = COLORS[c.color]||COLORS.cyan;
  $('#mCrane').style.textShadow = `0 0 22px ${COLORS[c.color]||COLORS.cyan}`;
  $('#keepBtn').textContent = c.kept ? 'KEPT ♥' : 'KEEP IT ♥';
  $('#modal').hidden = false;
}
function closeModal(){ $('#modal').hidden = true; current = null; }
$('#mClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
$('#keepBtn').addEventListener('click', ()=>{
  if(!current) return; current.kept = true; store.caught++; save(); renderAll(); sfx.keep();
  $('#keepBtn').textContent = 'KEPT ♥'; toast('♥ crane kept in your flock');
});
$('#releaseBtn').addEventListener('click', ()=>{
  if(!current) return;
  current.kept = false; save(); renderAll(); sfx.unfold(); closeModal(); toast('↺ released back to the wind');
});
$('#mShareBtn').addEventListener('click', ()=>{ if(current){ updateShareCard(true, current); closeModal(); copyLink(current); document.getElementById('export').scrollIntoView({behavior:'smooth'}); } });

/* ---------- share / export ---------- */
function encodeCrane(c){
  return btoa(unescape(encodeURIComponent(JSON.stringify([c.msg,c.from,c.color])))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeCrane(s){
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4) s+='=';
  const [msg,from,color] = JSON.parse(decodeURIComponent(escape(atob(s))));
  return { id:'link-'+Date.now().toString(36), msg:String(msg).slice(0,140), from:String(from).slice(0,18), color:COLORS[color]?color:'cyan', mine:false, kept:false, ts:Date.now() };
}
function shareURL(c){ return location.origin + location.pathname + '#c=' + encodeCrane(c); }
function lastCrane(){ return store.cranes.find(c=>c.mine) || store.cranes[0]; }
function updateShareCard(announce, c){
  c = c || lastCrane(); if(!c) return;
  $('#scMsg').textContent = '“' + c.msg + '”';
  $('#scFrom').textContent = '— @' + c.from;
  $('#scCode').textContent = '#' + c.id.slice(-4).toUpperCase() + ' · ' + c.color.toUpperCase();
  if(announce) toast('transmission card updated ↓');
}
updateShareCard();
function copyLink(c){
  c = c || lastCrane(); if(!c) return toast('fold a crane first');
  const url = shareURL(c); sfx.share();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    ()=>toast('⧉ share-link copied — anyone opening it catches your crane'),
    ()=>{ prompt('copy your crane link:', url); });
}
$('#copyLinkBtn').addEventListener('click', ()=>copyLink());
$('#copyTextBtn').addEventListener('click', ()=>{
  const c = lastCrane(); if(!c) return toast('fold a crane first');
  sfx.share();
  const txt = `◤ PAPER CRANE EXCHANGE ◢\n“${c.msg}”\n— @${c.from} · #${c.id.slice(-4).toUpperCase()}\n${shareURL(c)}`;
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
    ()=>toast('⧉ text card copied'), ()=>prompt('copy:', txt));
});
$('#jsonBtn').addEventListener('click', ()=>{
  sfx.share();
  const blob = new Blob([JSON.stringify(store.cranes,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'paper-crane-flock.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('⬇ flock exported (.json)');
});
$('#pngBtn').addEventListener('click', ()=>{
  const c = lastCrane(); if(!c) return toast('fold a crane first');
  sfx.share();
  const cv = document.createElement('canvas'); cv.width=800; cv.height=500;
  const x = cv.getContext('2d');
  const col = COLORS[c.color]||COLORS.cyan;
  const gr = x.createLinearGradient(0,0,800,500); gr.addColorStop(0,'#12041f'); gr.addColorStop(1,'#06121f');
  x.fillStyle=gr; x.fillRect(0,0,800,500);
  x.strokeStyle='rgba(5,217,232,.25)'; x.lineWidth=1;
  for(let i=0;i<800;i+=40){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,500); x.stroke(); }
  for(let j=0;j<500;j+=40){ x.beginPath(); x.moveTo(0,j); x.lineTo(800,j); x.stroke(); }
  x.strokeStyle=col; x.lineWidth=5; x.lineJoin='round'; x.shadowColor=col; x.shadowBlur=24;
  x.beginPath(); x.moveTo(400,210); x.lineTo(220,90); x.lineTo(350,230); x.closePath(); x.stroke();
  x.beginPath(); x.moveTo(400,210); x.lineTo(580,90); x.lineTo(450,230); x.closePath(); x.stroke();
  x.beginPath(); x.moveTo(400,210); x.lineTo(350,290); x.lineTo(450,290); x.closePath(); x.stroke();
  x.shadowBlur=0; x.fillStyle='#e8f6ff'; x.font='28px monospace'; x.textAlign='center';
  x.fillText('◤ PAPER CRANE EXCHANGE ◢',400,350);
  x.font='24px monospace'; wrap(x,'“'+c.msg+'”',400,390,36,700);
  x.fillStyle='#8b93b0'; x.font='20px monospace'; x.fillText('— @'+c.from,400,465);
  const a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download='paper-crane.png'; a.click();
  toast('⬇ transmission card exported (.png)');
});
function wrap(x,text,cx,y,lh,maxW){
  const words=text.split(' '); let line='',yy=y;
  for(const w of words){ const t=line?line+' '+w:w;
    if(x.measureText(t).width>maxW){ x.fillText(line,cx,yy); line=w; yy+=lh; } else line=t; }
  x.fillText(line,cx,yy);
}
// inbound share-link
(function(){
  if(location.hash.startsWith('#c=')){
    try{
      const c = decodeCrane(location.hash.slice(3));
      if(!store.cranes.some(k=>k.msg===c.msg&&k.from===c.from)){
        store.cranes.unshift(c); save(); renderAll();
      }
      setTimeout(()=>{ openModal(c); toast('◈ inbound crane from share-link!'); },600);
      history.replaceState(null,'',location.pathname);
    }catch(e){ console.warn('bad crane hash',e); }
  }
})();

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2600); }

/* ---------- scroll: reveal + progress + wind ---------- */
let wind = 0, lastY = scrollY, windDecay;
const prog = $('#scrollProgress i');
function onScroll(){
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  prog.style.width = (h>0 ? (y/h*100) : 0) + '%';
  const v = Math.min(30, Math.abs(y-lastY)); lastY = y;
  wind = Math.min(30, wind*0.85 + v*0.5);
  $('#windVal').textContent = Math.round(wind);
  $('#windFill').style.width = (wind/30*100)+'%';
  if(wind>6){ skyGust(wind); clearTimeout(windDecay); windDecay=setTimeout(()=>{},300); if(Math.random()<.06) sfx.wind(wind); }
  $$('[data-reveal]:not(.seen)').forEach(el=>{
    const r = el.getBoundingClientRect();
    if(r.top < innerHeight*0.88) el.classList.add('seen');
  });
}
addEventListener('scroll', onScroll, {passive:true});
onScroll();

/* ---------- canvas sky: scroll-reactive crane flock ---------- */
const cv = $('#sky'), ctx = cv.getContext('2d');
let W,H, flock=[], gust=0, burst=0;
function size(){ W=cv.width=innerWidth; H=cv.height=innerHeight; }
addEventListener('resize', size); size();
function scrollNorm(){ const h=document.documentElement.scrollHeight-innerHeight; return h>0?scrollY/h:0; }
function mk(i){
  const palette = Object.keys(COLORS);
  return { x:Math.random()*W, y:Math.random()*H, s:8+Math.random()*22,
    vx:.4+Math.random()*1.2, vy:(Math.random()-.5)*.5,
    ph:Math.random()*Math.PI*2, fl:2+Math.random()*3,
    c:COLORS[palette[i%palette.length]], mine:i<store.cranes.length&&store.cranes[i].mine };
}
for(let i=0;i<34;i++) flock.push(mk(i));
function skyGust(w){ gust = Math.min(14, gust + w*0.25); }
function skyBurst(){ burst = 14; }
let t=0;
function draw(){
  t+=0.016;
  const sn = scrollNorm();
  // cyberpunk gradient shifts with scroll: magenta district -> cyan heights
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, mix('#0a0618','#03141c',sn));
  g.addColorStop(.6, mix('#12041f','#0a0a24',sn));
  g.addColorStop(1,'#07070f');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // grid floor recedes with scroll
  ctx.strokeStyle='rgba(5,217,232,.12)'; ctx.lineWidth=1;
  const horizon = H*(0.62+sn*0.25);
  for(let i=0;i<14;i++){ const y=horizon+Math.pow(i/14,1.8)*(H-horizon);
    ctx.globalAlpha=.12+.05*Math.sin(t+i); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.globalAlpha=.14;
  for(let i=-8;i<17;i++){ ctx.beginPath(); ctx.moveTo(W/2+(i*90)-sn*200,horizon); ctx.lineTo(W/2+(i*160)-sn*320,H); ctx.stroke(); }
  ctx.globalAlpha=1;
  // sun / moon that morphs on scroll
  const sx=W*0.78, sy=H*(0.22+sn*0.4);
  const sg=ctx.createRadialGradient(sx,sy,10,sx,sy,120);
  sg.addColorStop(0,'rgba(255,42,109,.8)'); sg.addColorStop(.4,'rgba(181,55,242,.35)'); sg.addColorStop(1,'transparent');
  ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sx,sy,120,0,7); ctx.fill();
  ctx.fillStyle='#ff2a6d'; ctx.shadowColor='#ff2a6d'; ctx.shadowBlur=30;
  ctx.beginPath(); ctx.arc(sx,sy,44,0,7); ctx.fill(); ctx.shadowBlur=0;
  // scanline slices on sun
  ctx.fillStyle='#07070f';
  for(let i=0;i<5;i++){ const yy=sy-20+i*12+Math.sin(t*2)*2; ctx.fillRect(sx-46,yy,92,3); }

  gust*=0.94; burst*=0.93;
  const speed = 1 + sn*2.2 + gust*0.35 + burst*0.4 + wind*0.06;
  flock.forEach((b,i)=>{
    b.ph += 0.05*b.fl;
    b.x += (b.vx + gust*0.6 + wind*0.12 + burst*0.5)*speed;
    b.y += (b.vy + Math.sin(t*1.4+i)*0.4 - sn*0.7)*speed + Math.sin(b.ph)*0.5;
    if(b.x>W+60){ b.x=-60; b.y=Math.random()*H; }
    if(b.y<-60) b.y=H+40; if(b.y>H+60) b.y=-40;
    const flap = Math.abs(Math.sin(b.ph));
    const w=b.s*(1.1-flap*0.55), hh=b.s*0.5;
    ctx.save(); ctx.translate(b.x,b.y);
    ctx.rotate(Math.sin(b.ph*0.5)*0.18 - gust*0.012);
    ctx.strokeStyle=b.c; ctx.fillStyle=b.c+'22'; ctx.lineWidth=Math.max(1.2,b.s/12);
    ctx.shadowColor=b.c; ctx.shadowBlur=10+flap*10+burst;
    // left + right wings flap, hull steady
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-w,-hh*(0.4+flap)); ctx.lineTo(-w*0.3,hh*0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w,-hh*(0.4+flap)); ctx.lineTo(w*0.3,hh*0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-w*0.25,hh); ctx.lineTo(w*0.25,hh); ctx.closePath(); ctx.stroke();
    if(b.mine){ ctx.fillStyle='#f9f002'; ctx.beginPath(); ctx.arc(0,0,2.4,0,7); ctx.fill(); }
    ctx.restore();
  });
  // rain streaks intensify with scroll/gust
  ctx.strokeStyle='rgba(5,217,232,.18)'; ctx.lineWidth=1;
  const drops = 30 + sn*70 + gust*6;
  for(let i=0;i<drops;i++){
    const rx=(i*197+t*900*(1+gust*0.2))% (W+40)-20, ry=(i*331+t*700)%(H+40)-20;
    ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-6,ry+16); ctx.stroke();
  }
  requestAnimationFrame(draw);
}
function mix(a,b,f){
  const pa=hex(a),pb=hex(b);
  return `rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*f)).join(',')})`;
}
function hex(h){ return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); }
draw();
