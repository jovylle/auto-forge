/* Pebble Grid Pilgrims — glassmorphism territory game. No deps. Works from file:// */
(function(){
"use strict";
var N = 9, CELLS = N*N;
var board = document.getElementById('board');
var svg = document.getElementById('routeSvg');
var walker = document.getElementById('walker');
var seedLabel = document.getElementById('seedLabel');
var statLine = document.getElementById('statLine');
var countdownEl = document.getElementById('countdown');
var logEl = document.getElementById('log');
var shrinesEl = document.getElementById('shrines');
var toastEl = document.getElementById('toast');

var state = { seed: 0, terrain: [], claims: [], walking: false, golden: false, sound: true, moonTaps: 0 };

// ---------- utils ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function isoWeek(d){d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-n);var y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));return{y:d.getUTCFullYear(),w:1+Math.round(((d-y0)/864e5-3+n)/7)};}
function weeklySeed(now){now=now||new Date();var p=isoWeek(now);return p.y*100+Math.min(p.w,53);}
function nextMonday(){var d=new Date();var diff=(8-d.getDay())%7||7;var n=new Date(d);n.setDate(d.getDate()+diff);n.setHours(0,0,0,0);return n;}
function $(id){return document.getElementById(id);}
function toast(m){toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(toastEl._t);toastEl._t=setTimeout(function(){toastEl.classList.remove('show');},2200);}

// ---------- audio (WebAudio, no assets) ----------
var AC=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function tone(f,dur,type,vol,when,slide){if(!state.sound)return;var c=ac();if(!c)return;var t=c.currentTime+(when||0);var o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.18,t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+0.05);}
function sndClaim(i){tone(300+i*40,0.22,'triangle',0.2,0,520+i*40);tone(900+i*30,0.12,'sine',0.08,0.05);}
function sndLift(){tone(420,0.18,'triangle',0.15,0,180);}
function sndErr(){tone(140,0.2,'sawtooth',0.12,0,90);}
function sndStep(i){tone(500+(i%8)*60,0.09,'sine',0.1);}
function sndFanfare(){[523,659,784,1047,1319].forEach(function(f,i){tone(f,0.3,'triangle',0.16,i*0.11);});}
function sndShutter(){tone(1200,0.06,'square',0.1);tone(700,0.1,'square',0.1,0.07);}
function sndEgg(){[392,523,659,784,1047,1568].forEach(function(f,i){tone(f,0.35,'sine',0.16,i*0.09);});}

// ---------- map gen ----------
function genTerrain(seed){
  var rnd = mulberry32(seed*2654435761 % 4294967296 || seed+1);
  var t = [];
  for(var i=0;i<CELLS;i++){
    var r=rnd();
    if(r<0.11)t.push('water');else if(r<0.19)t.push('crag');else t.push('meadow');
  }
  // guarantee 3 walkable shrines spread out
  var spots=[10,40,70].map(function(s){return (s+Math.floor(rnd()*8))%CELLS;});
  spots.forEach(function(s){t[s]='shrine';});
  // guarantee start area walkable
  t[0]='meadow';t[1]='meadow';
  return t;
}
var GLYPH={water:'🌊',crag:'⛰',meadow:'',shrine:'⛩'};

// ---------- pathfinding (BFS, 4-dir, avoids water/crag) ----------
function blocked(i){var t=state.terrain[i];return t==='water'||t==='crag';}
function neighbors(i){var x=i%N,y=(i/N)|0,out=[];if(x>0)out.push(i-1);if(x<N-1)out.push(i+1);if(y>0)out.push(i-N);if(y<N-1)out.push(i+N);return out;}
function bfs(a,b){
  if(a===b)return[a];
  var prev=new Array(CELLS).fill(-1);var q=[a];prev[a]=a;
  while(q.length){var c=q.shift();var ns=neighbors(c);
    for(var k=0;k<ns.length;k++){var n=ns[k];if(prev[n]!==-1||blocked(n))continue;prev[n]=c;if(n===b){var p=[b];while(p[0]!==a)p.unshift(prev[p[0]]);return p;}q.push(n);}}
  return null;
}
function fullRoute(){
  if(state.claims.length<2)return[];
  var path=[];
  for(var i=0;i<state.claims.length-1;i++){
    var seg=bfs(state.claims[i],state.claims[i+1]);
    if(!seg){ // unreachable: keep marker gap
      path.push('GAP');continue;
    }
    if(path.length)seg=seg.slice(1);
    path=path.concat(seg);
  }
  return path.filter(function(x){return x!=='GAP';});
}

// ---------- render ----------
var cellEls=[];
function render(){
  board.innerHTML='';cellEls=[];
  var order={};state.claims.forEach(function(c,i){order[c]=i+1;});
  for(var i=0;i<CELLS;i++){
    (function(i){
      var d=document.createElement('div');
      d.className='cell '+state.terrain[i]+(order[i]?' claimed':'');
      d.setAttribute('role','gridcell');
      var label=GLYPH[state.terrain[i]]||'';
      if(order[i])label='🪨';
      d.innerHTML='<span class="peb">'+label+'</span>'+(order[i]?'<span class="ord">'+order[i]+'</span>':'');
      d.setAttribute('aria-label','cell '+i+' '+state.terrain[i]+(order[i]?' claimed #'+order[i]:''));
      d.addEventListener('click',function(){onClaim(i,d);});
      board.appendChild(d);cellEls.push(d);
    })(i);
  }
  drawRoute();updateStats();renderLog();save();
}
function cellCenter(i){
  var r=board.getBoundingClientRect(),e=cellEls[i].getBoundingClientRect();
  return {x:e.left-r.left+e.width/2,y:e.top-r.top+e.height/2};
}
function drawRoute(){
  var route=fullRoute();
  var NS='http://www.w3.org/2000/svg';
  // size svg to board
  var r=board.getBoundingClientRect();
  svg.setAttribute('viewBox','0 0 '+r.width+' '+r.height);
  svg.innerHTML='<defs><linearGradient id="routegrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be9d9"/><stop offset=".5" stop-color="#c4a7ff"/><stop offset="1" stop-color="#ffd98a"/></linearGradient></defs>';
  if(route.length<2)return;
  var d='M '+route.map(function(i){var c=cellCenter(i);return c.x.toFixed(1)+' '+c.y.toFixed(1);}).join(' L ');
  var p=document.createElementNS(NS,'path');p.setAttribute('d',d);svg.appendChild(p);
  // shrine stars on route
  route.forEach(function(i){
    if(state.terrain[i]==='shrine'){
      var c=cellCenter(i);var el=document.createElementNS(NS,'circle');
      el.setAttribute('cx',c.x);el.setAttribute('cy',c.y);el.setAttribute('r',5);
      el.setAttribute('fill','#ffd98a');svg.appendChild(el);
    }
  });
}
function score(){
  var pts=0;state.claims.forEach(function(c){pts+=state.terrain[c]==='shrine'?2:1;});
  var land=Math.round(state.claims.length/CELLS*100);
  var route=fullRoute();
  return {pts:pts,land:land,steps:route.length?route.length-1:0};
}
function updateStats(){
  var s=score();
  statLine.textContent=state.claims.length+' pebbles · '+s.land+'% land · '+s.steps+'-step path · '+s.pts+' pts';
  var p=isoWeek(new Date());
  seedLabel.textContent='week '+p.w+' · seed '+state.seed+(state.seed===weeklySeed()?' · ★ official':' · wanderer');
  var shr=state.terrain.map(function(t,i){return t==='shrine'?i:-1;}).filter(function(x){return x>=0;});
  shrinesEl.innerHTML=shr.map(function(i){var got=state.claims.indexOf(i)>=0?' ✅':'';return '<span>⛩ shrine @'+i+got+'</span>';}).join('');
}
function renderLog(){
  if(!state.claims.length){logEl.innerHTML='<li class="dim">No pebbles yet — drop your first stone.</li>';return;}
  logEl.innerHTML=state.claims.map(function(c,i){
    var nm=state.terrain[c]==='shrine'?'⛩ shrine':'cell';
    return '<li><b>#'+(i+1)+'</b> '+nm+' '+c+' <span class="dim">('+(c%N)+','+((c/N)|0)+')</span></li>';
  }).join('');
}

// ---------- interactions ----------
function onClaim(i,el){
  if(blocked(i)){sndErr();el.classList.add('shake');setTimeout(function(){el.classList.remove('shake');},450);toast(state.terrain[i]==='water'?'🌊 pilgrims can\'t swim here':'⛰ crag too steep — pick meadow');return;}
  var at=state.claims.indexOf(i);
  if(at>=0){state.claims.splice(at,1);sndLift();}
  else{state.claims.push(i);sndClaim(state.claims.length);if(state.claims.length===9&&!state.golden)toast('9 pebbles! the path hums…');}
  render();syncHash();
}
function clearClaims(){state.claims=[];stopWalk();render();syncHash();toast('pebbles lifted');sndLift();}

// ---------- walker animation ----------
var walkRAF=null;
function stopWalk(){state.walking=false;walkRAF&&cancelAnimationFrame(walkRAF);walkRAF=null;walker.classList.remove('on');var b=$('journeyBtn');if(b)b.textContent='▶ journey';}
function journey(){
  var route=fullRoute();
  if(route.length<2){toast('drop at least 2 pebbles to walk');sndErr();return;}
  if(state.walking){stopWalk();return;}
  state.walking=true;$('journeyBtn').textContent='⏸ pause';walker.classList.add('on');
  walker.classList.toggle('golden',state.golden);
  walker.textContent=state.golden?'🧙':'🚶';
  var pts=route.map(cellCenter);var idx=0,frac=0;
  function frame(){
    if(!state.walking)return;
    var a=pts[idx],b=pts[Math.min(idx+1,pts.length-1)];
    frac+=0.06;
    if(frac>=1){frac=0;idx++;sndStep(idx);if(idx>=pts.length-1){finish();return;}}
    var x=a.x+(b.x-a.x)*frac,y=a.y+(b.y-a.y)*frac;
    walker.style.left=x+'px';walker.style.top=y+'px';
    walkRAF=requestAnimationFrame(frame);
  }
  function finish(){state.walking=false;walkRAF=null;walker.classList.remove('on');$('journeyBtn').textContent='▶ journey';sndFanfare();toast('🙏 pilgrimage complete: '+(pts.length-1)+' steps');}
  frame();
}

// ---------- persistence + share ----------
function save(){try{localStorage.setItem('pgp-'+state.seed,JSON.stringify(state.claims));localStorage.setItem('pgp-last',String(state.seed));}catch(e){}}
function load(seed){try{var v=localStorage.getItem('pgp-'+seed);return v?JSON.parse(v):[];}catch(e){return[];}}
function setSeed(s,keep){
  stopWalk();state.seed=s>>>0||1;state.terrain=genTerrain(state.seed);
  state.claims=keep||load(state.seed);
  render();syncHash();
}
function shareURL(){var base=location.href.split('#')[0];return base+'#s='+state.seed+'&c='+state.claims.join('.');}
function syncHash(){try{history.replaceState(null,'','#s='+state.seed+'&c='+state.claims.join('.'));}catch(e){}}
function fromHash(){
  if(!location.hash)return null;
  var m=location.hash.match(/s=(\d+)/);if(!m)return null;
  var c=(location.hash.match(/c=([\d.]*)/)||[])[1];
  return {seed:parseInt(m[1],10),claims:c?c.split('.').filter(Boolean).map(Number).filter(function(n){return n>=0&&n<CELLS;}):null};
}

// ---------- postcard ----------
function drawPostcard(){
  var cv=$('postcard'),ctx=cv.getContext('2d');
  var W=cv.width,H=cv.height;
  var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#241d5e');g.addColorStop(.5,'#123f5c');g.addColorStop(1,'#3a1c56');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // stars
  var rnd=mulberry32(state.seed+7);
  ctx.fillStyle='#fff';
  for(var i=0;i<120;i++){ctx.globalAlpha=0.2+rnd()*0.6;ctx.fillRect(rnd()*W,rnd()*H*0.6,2,2);}
  ctx.globalAlpha=1;
  // mini map
  var s=score();var m=340,ox=(W-m)/2,oy=110,cs=m/N;
  ctx.save();ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=24;
  roundRect(ctx,ox-14,oy-14,m+28,m+28,22);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fill();ctx.restore();
  for(var y=0;y<N;y++)for(var x=0;x<N;x++){
    var idx=y*N+x,t=state.terrain[idx];
    ctx.fillStyle=t==='water'?'#3aa7e8':t==='crag'?'#6f6b8c':t==='shrine'?'#ffd98a':'rgba(89,217,154,.5)';
    ctx.globalAlpha=t==='meadow'?0.5:0.9;
    roundRect(ctx,ox+x*cs+2,oy+y*cs+2,cs-4,cs-4,7);ctx.fill();
  }
  ctx.globalAlpha=1;
  // route
  var route=fullRoute();
  if(route.length>1){
    ctx.strokeStyle='#8be9d9';ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.shadowColor='#8be9d9';ctx.shadowBlur=12;ctx.beginPath();
    route.forEach(function(c,k){var cx=ox+(c%N)*cs+cs/2,cy=oy+((c/N)|0)*cs+cs/2;k?ctx.lineTo(cx,cy):ctx.moveTo(cx,cy);});
    ctx.stroke();ctx.shadowBlur=0;
  }
  state.claims.forEach(function(c,k){
    var cx=ox+(c%N)*cs+cs/2,cy=oy+((c/N)|0)*cs+cs/2;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy-2,cs*0.26,0,7);ctx.fill();
    ctx.fillStyle='#1a1440';ctx.font='bold '+(cs*0.3)+'px sans-serif';ctx.textAlign='center';ctx.fillText(String(k+1),cx,cy+cs*0.12);
  });
  // text
  ctx.textAlign='center';ctx.fillStyle='#fff';
  ctx.font='italic 600 44px Georgia,serif';ctx.fillText('Pebble Grid Pilgrims',W/2,60);
  ctx.font='300 22px system-ui';ctx.fillStyle='#cfc8ee';
  var p=isoWeek(new Date());
  ctx.fillText('seed '+state.seed+' · '+state.claims.length+' pebbles · '+s.steps+' steps · '+s.pts+' pts · week '+p.w,W/2,H-26);
  $('postText').textContent=shareURL();
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function openPostcard(){drawPostcard();$('postcardModal').hidden=false;sndShutter();}
function copyLink(){
  var u=shareURL();
  function done(){toast('⧉ link copied — send it to a fellow pilgrim');sndFanfare();}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(done,function(){fallback();});
  else fallback();
  function fallback(){var ta=document.createElement('textarea');ta.value=u;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){prompt('copy this link:',u);}ta.remove();}
}
function dlPNG(){drawPostcard();var a=document.createElement('a');a.download='pebble-pilgrims-'+state.seed+'.png';a.href=$('postcard').toDataURL('image/png');a.click();toast('⬇ postcard saved');}

// ---------- easter egg ----------
function egg(){
  if(state.golden)return;
  state.golden=true;sndEgg();
  walker.classList.add('golden');
  toast('🥚 the Moon Pilgrim joins you — golden steps, double shimmer!');
  var layer=$('meteorLayer');
  for(var i=0;i<40;i++){
    (function(i){
      var s=document.createElement('div');s.className='meteor';s.textContent=['✨','🌠','🪨','🌕','💫'][i%5];
      s.style.left=(Math.random()*100)+'vw';s.style.animationDuration=(1.4+Math.random()*2)+'s';s.style.fontSize=(14+Math.random()*22)+'px';
      layer.appendChild(s);setTimeout(function(){s.remove();},3600);
    })(i);
  }
  document.querySelector('.moon').textContent='🌝';
}
var moonCount=0,typed='';
function bindEgg(){
  document.querySelector('.moon').addEventListener('click',function(){moonCount++;tone(600+moonCount*90,0.2,'sine',0.15);this.style.transform='scale('+(1+moonCount*0.08)+')';if(moonCount>=5)egg();setTimeout(function(){moonCount=0;},3000);});
  document.addEventListener('keydown',function(e){
    typed=(typed+e.key.toLowerCase()).slice(-12);
    if(typed.indexOf('pilgrim')>=0||typed.indexOf('pebble')>=0)egg();
  });
}

// ---------- countdown ----------
function tick(){
  var ms=nextMonday()-new Date();
  var d=(ms/864e5)|0,h=((ms/36e5)%24)|0,m=((ms/6e4)%60)|0;
  countdownEl.textContent='↻ new land in '+d+'d '+h+'h '+m+'m';
}

// ---------- wire ----------
function init(){
  $('journeyBtn').addEventListener('click',journey);
  $('clearBtn').addEventListener('click',clearClaims);
  $('shuffleBtn').addEventListener('click',function(){setSeed((Math.random()*900000+100000)|0);toast('🎲 wandered to seed '+state.seed);tone(500,0.2,'triangle',0.15,0,900);});
  $('weeklyBtn').addEventListener('click',function(){setSeed(weeklySeed());toast('★ official weekly map');});
  $('seedGo').addEventListener('click',function(){var v=parseInt($('seedInput').value,10);if(v>=0)setSeed(v);else{sndErr();toast('enter a number seed');}});
  $('soundBtn').addEventListener('click',function(){state.sound=!state.sound;this.textContent=state.sound?'🔊 sound':'🔇 muted';this.setAttribute('aria-pressed',state.sound);if(state.sound)tone(660,0.15,'sine',0.15);});
  $('shareBtn').addEventListener('click',openPostcard);
  $('closeModal').addEventListener('click',function(){$('postcardModal').hidden=true;});
  $('postcardModal').addEventListener('click',function(e){if(e.target===this)this.hidden=true;});
  $('copyBtn').addEventListener('click',copyLink);$('copyBtn2').addEventListener('click',copyLink);
  $('pngBtn').addEventListener('click',dlPNG);$('pngBtn2').addEventListener('click',dlPNG);
  window.addEventListener('resize',drawRoute);
  bindEgg();tick();setInterval(tick,30000);
  var h=fromHash();
  if(h){setSeed(h.seed,h.claims||load(h.seed));if(h.claims)toast('📬 opened a shared route — seed '+h.seed);}
  else{var last=parseInt(localStorage.getItem('pgp-last')||'0',10);setSeed(weeklySeed());if(last&&last!==weeklySeed()&&localStorage.getItem('pgp-'+last)){/* keep weekly but note */}}
  console.log('pebble-grid-pilgrims ready');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
