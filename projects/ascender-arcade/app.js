// Ascender Arcade — catch rising letters, build words in 60 seconds.
// gravity-flipped catching (letters rise, net at TOP) · variable-font power-ups
// 60s runs · daily kinetic seed · easter egg (konami + ASCEND)

const $ = (id) => document.getElementById(id);
const stage = $('stage'), layer = $('float-layer'), paddleEl = $('paddle');
const hudTime = $('hud-time'), hudScore = $('hud-score'), hudBest = $('hud-best'), hudSeed = $('hud-seed');
const targetWordEl = $('target-word'), targetProgEl = $('target-progress'), powerBanner = $('power-banner');
const trayEl = $('tray'), trayCount = $('tray-count'), wordEl = $('word'), msgEl = $('msg');
const scoredEl = $('scored-list'), overlay = $('overlay'), overlayTitle = $('overlay-title'), overlaySub = $('overlay-sub');
const seedCodeEl = $('seed-code'), dailyBestEl = $('daily-best');

const CATCH_Y = 64;          // catch line (px from top)
const ROUND = 60;            // seconds
const TRAY_MAX = 8;

// compact word list (valid submissions, 3-8 letters)
const WORDS = `CAT DOG SUN SKY ARCADE PIXEL TYPE CATCH WORD SCORE SEED FLOAT RISE ESCAPE NET PLAY COIN BONUS FREEZE MAGNET DOUBLE COMBO CHAIN LETTER GRAVITY FLIP UP TOP SKYLINE NEON RETRO JOY FUN RUN DAILY POWER WIDE BOLD HEAVY LIGHT QUICK SLOW STORM BLAZE FROST CANDY GHOST ROBOT LASER BLOOM CLOUD RAIN STAR MOON PIX INVADER KONAMI GOLD PINK CYAN BLACK WHITE CABINET BUTTON START READY PLAYER SCORE BEST KIND MIND TIME ZONE WAVE DRIFT FLOATY BUBBLE POP FIZZ JUMP HOP SKIP DASH RUSH RISK LUCK CHARM SPELL MAGIC KINETIC ASCEND RISEUP UPLINK ZENITH APEX NOVA PULSE VIVID GLOSS PRISM ORBIT QUEST PIXELPOP TYPEFACE FONT WIDTH WEIGHT SLANT BOLDY FUNKY JAZZY WONKY SPARKY CATCHY LETTERY WORDY GAMEY TIMEY SEEDY WINDY BREEZY GUSTY FLOATER RISER CATCHER NETTY TOPPY UPPY ALPHA BRAVO DELTA GAMMA PIXIE FAIRY TIGER PANDA KOALA EAGLE SHARK WHALE SNAKE BREAD TOAST HONEY LEMON APPLE GRAPE MANGO PEACH PIANO GUITAR DRUM FLUTE DANCE SING SONG BEAT DRIFT SURF SKATE SKI CLIMB FLY SOAR GLIDE DIVE SWIM CRAWL MARCH PROUD BRAVE SWIFT KEEN EAGER MERRY JOLLY HAPPY LUCKY SUNNY FROSTY STORMY WINDY RAINY PIXELY RETRO ARCADE GAMER PLAYER COINOP HI SCORE`.split(/\s+/).map(w=>w.trim().toUpperCase()).filter((w,i,a)=>w.length>=3&&a.indexOf(w)===i);
const WORDSET = new Set(WORDS);

// seeded rng: xmur3 + mulberry32
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return(h^=h>>>16)>>>0}}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const store = {
  get(k,f){ try{ const v=localStorage.getItem(k); return v==null?f:JSON.parse(v);}catch{return f} },
  set(k,v){ try{localStorage.setItem(k,JSON.stringify(v))}catch{} }
};

const state = {
  mode:'daily', running:false, t:ROUND, score:0, combo:1, best:store.get('ascender.best',0),
  seedStr:todayStr(), rng:Math.random, letters:[], tray:[], word:[],
  scored:[], target:'', targetFound:new Set(),
  paddleX:0.5, keys:{}, power:{ double:0, slow:0, wide:0 },
  last:0, spawnAcc:0, invaderMode:false, eggArmed:false,
};

function setSeed(str){
  state.seedStr = str;
  const seedFn = xmur3('ascender:'+str);
  state.rng = mulberry32(seedFn());
  hudSeed.textContent = str.length>7 ? str.slice(5) : str; // MM-DD fits the cabinet
  seedCodeEl.textContent = str;
  // target word: deterministic pick of a 5-6 letter word
  const pool = WORDS.filter(w=>w.length>=4&&w.length<=6);
  state.target = pool[Math.floor(state.rng()*pool.length)];
  state.targetFound = new Set();
  renderTarget();
}
function renderTarget(){
  targetWordEl.textContent = state.target.split('').map(ch=>state.targetFound.has(ch)?ch:'_').join(' ');
  targetProgEl.textContent = `${state.targetFound.size}/${state.target.length}`;
}

function setMode(m){
  state.mode = m;
  $('btn-daily').classList.toggle('active', m==='daily');
  $('btn-practice').classList.toggle('active', m!=='daily');
  setSeed(m==='daily' ? todayStr() : 'P-'+Math.floor(Math.random()*8999+1000));
  dailyBestEl.textContent = 'daily best ' + (store.get('ascender.daily.'+todayStr(), 0));
}
$('btn-daily').onclick = ()=>{ if(!state.running) setMode('daily'); };
$('btn-practice').onclick = ()=>{ if(!state.running) setMode('practice'); };

function msg(t, cls=''){ msgEl.textContent = t; msgEl.className = 'msg '+cls; }

// ---- paddle input (mouse / touch / keys) ----
function stageX(clientX){ const r=stage.getBoundingClientRect(); return Math.min(1,Math.max(0,(clientX-r.left)/r.width)); }
stage.addEventListener('pointermove', e=>{ state.paddleX = stageX(e.clientX); });
stage.addEventListener('pointerdown', e=>{ state.paddleX = stageX(e.clientX); });
addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') state.keys.l=true;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') state.keys.r=true;
  // typing letters into word from tray
  if(state.running && /^[a-zA-Z]$/.test(e.key)){ pushLetter(e.key.toUpperCase()); }
  if(e.key==='Enter' && state.running) submitWord();
  if(e.key==='Backspace' && state.running){ popLetter(); e.preventDefault(); }
  konami(e.key);
});
addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') state.keys.l=false;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') state.keys.r=false;
});
function pollKeys(dt){
  const sp = 1.6*dt;
  if(state.keys.l) state.paddleX = Math.max(0, state.paddleX - sp);
  if(state.keys.r) state.paddleX = Math.min(1, state.paddleX + sp);
}

// ---- letters ----
const FREQ = 'EEEEEEEEAAAAAAAIIIIIIOOOOOONNRRTTLLSSUUUDDGGGBBCCMMPPFFHHVVWWYYKJXQZ';
const pickLetter = () => FREQ[Math.floor(state.rng()*FREQ.length)];

function spawn(){
  const W = stage.clientWidth;
  const roll = state.rng();
  let kind = 'letter', ch = pickLetter();
  if(roll > 0.93){ // ~7% power-ups (variable-font showpieces)
    const kinds = ['freeze','wide','double'];
    kind = kinds[Math.floor(state.rng()*kinds.length)];
    ch = kind==='freeze' ? '❄' : kind==='wide' ? '⇔' : '×2';
  } else if(state.invaderMode && roll > 0.8){ kind='invader'; ch = ['👾','🛸','★'][Math.floor(state.rng()*3)]; }
  const el = document.createElement('div');
  el.className = 'tile' + ('AEIOU'.includes(ch)?' vowel':'') + (kind!=='letter'&&kind!=='invader'?' power '+kind:'') + (kind==='invader'?' invader':'');
  el.textContent = ch;
  // variable-font expression: random heavy weight + wide width, animated via JS
  const wght = 600 + Math.floor(state.rng()*400);
  const wdth = 80 + Math.floor(state.rng()*70);
  el.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}`;
  el.dataset.kind = kind; el.dataset.ch = ch; el.dataset.wght = wght;
  const x = 20 + state.rng()*(W-60);
  // speed scales with elapsed time (difficulty ramp) + daily wind
  const elapsed = ROUND - state.t;
  const base = 55 + elapsed*2.2 + state.rng()*40;
  const rec = { el, x, y: stage.clientHeight+20, vy: base, wob: state.rng()*Math.PI*2, wobAmp: 10+state.rng()*26, wobHz: 1+state.rng()*2, wght, wdth, dead:false };
  el.style.left = x+'px'; el.style.top = rec.y+'px';
  state.letters.push(rec); layer.appendChild(el);
}

function paddleRange(){
  const wide = state.power.wide>0;
  const w = wide ? 150 : 92;
  const cx = state.paddleX * stage.clientWidth;
  return { cx, half: w/2, wide };
}

function update(dt){
  pollKeys(dt);
  const { cx, half, wide } = paddleRange();
  paddleEl.style.left = cx+'px';
  paddleEl.classList.toggle('wide', wide);
  // power timers
  for(const k of ['double','slow','wide']) if(state.power[k]>0) state.power[k]-=dt;
  const anyPower = state.power.double>0||state.power.slow>0||state.power.wide>0;
  if(anyPower){
    const names=[]; if(state.power.double>0)names.push('×2 SCORE'); if(state.power.slow>0)names.push('SLOW-MO'); if(state.power.wide>0)names.push('WIDE NET');
    powerBanner.hidden=false; powerBanner.textContent = '⚡ '+names.join(' + ');
  } else powerBanner.hidden=true;

  const slowMul = state.power.slow>0 ? 0.45 : 1;
  // spawn rate ramps up
  const elapsed = ROUND - state.t;
  state.spawnAcc += dt * (0.9 + elapsed*0.022);
  if(state.spawnAcc > 1){ state.spawnAcc = 0; if(state.letters.length < 26) spawn(); }

  const H = stage.clientHeight;
  for(const L of state.letters){
    if(L.dead) continue;
    L.y -= L.vy * slowMul * dt;
    L.wob += dt * L.wobHz * 2;
    const dx = Math.sin(L.wob) * L.wobAmp * dt;
    L.x += dx;
    // variable-font pulse while rising (kinetic type!)
    const pulse = 700 + Math.round(300*Math.sin(L.wob*1.4));
    L.el.style.fontVariationSettings = `'wght' ${pulse}, 'wdth' ${L.wdth}`;
    L.el.style.top = L.y+'px'; L.el.style.left = L.x+'px';
    // catch check at line
    if(!L.caught && L.y <= CATCH_Y+14 && L.y >= CATCH_Y-26){
      if(Math.abs(L.x+19 - cx) <= half+14){ catchLetter(L); continue; }
    }
    if(L.y < -50){ escapeLetter(L); }
  }
  state.letters = state.letters.filter(L=>!L.dead);
}

function catchLetter(L){
  L.caught = true; L.dead = true;
  L.el.classList.add('caught');
  setTimeout(()=>L.el.remove(), 200);
  const kind = L.el.dataset.kind, ch = L.el.dataset.ch;
  if(kind==='freeze'){ state.power.slow=8; msg('❄ SLOW-MO 8s — letters drift!', 'good'); blip(520); return; }
  if(kind==='wide'){ state.power.wide=10; msg('⇔ WIDE NET 10s!', 'good'); blip(620); return; }
  if(kind==='double'){ state.power.double=10; msg('×2 DOUBLE SCORE 10s!', 'good'); blip(720); return; }
  if(kind==='invader'){ addScore(25, L.x); msg('👾 INVADER +25!', 'good'); blip(880); return; }
  if(state.tray.length >= TRAY_MAX){ msg('Tray full! Spell or clear a word.', 'bad'); addScore(1, L.x); return; }
  state.tray.push(ch);
  // target-word progress: mark letter if needed
  let progressed=false;
  for(const c of state.target){ if(c===ch && !state.targetFound.has(c)){ state.targetFound.add(c); progressed=true; break; } }
  // count occurrences properly: need multiset check
  fixTargetProgress();
  renderTarget(); renderTray();
  if(progressed) msg(`Nice — "${ch}" is in the target!`, 'good');
  blip(440 + Math.random()*220);
  state.combo = Math.min(9, state.combo+0); // combo grows on words, not catches
}
function fixTargetProgress(){
  // reveal target letters covered by tray+word multiset
  const bag = {};
  for(const c of [...state.tray, ...state.word]) bag[c]=(bag[c]||0)+1;
  state.targetFound = new Set();
  const need = {};
  for(const c of state.target){
    need[c]=(need[c]||0)+1;
    if((bag[c]||0) >= need[c]) state.targetFound.add(c+':'+need[c]);
  }
  // store as plain letters present (for display count use covered positions)
  const covered = new Set(); const tmp={};
  state.target.split('').forEach((c,i)=>{ tmp[c]=(tmp[c]||0)+1; if((bag[c]||0)>=tmp[c]) covered.add(i); });
  state.targetFound = covered;
  renderTargetCovered(covered);
}
function renderTargetCovered(covered){
  targetWordEl.textContent = state.target.split('').map((c,i)=>covered.has(i)?c:'_').join(' ');
  targetProgEl.textContent = `${covered.size}/${state.target.length}`;
}

function escapeLetter(L){
  L.dead = true;
  L.el.classList.add('escaped');
  setTimeout(()=>L.el.remove(), 300);
  state.combo = 1;
}

function addScore(n, x){
  const mult = state.power.double>0 ? 2 : 1;
  state.score += n*mult*state.combo;
  hudScore.textContent = state.score;
  floatScore('+'+n*mult*state.combo, x);
}

// ---- tray / words ----
function renderTray(){
  trayEl.innerHTML='';
  trayCount.textContent = `(${state.tray.length}/${TRAY_MAX})`;
  state.tray.forEach((ch,i)=>{
    const b=document.createElement('button');
    b.className='tray-tile'; b.type='button'; b.textContent=ch;
    b.setAttribute('aria-label','use letter '+ch);
    b.onclick=()=>{ state.tray.splice(i,1); state.word.push(ch); renderTray(); renderWord(); fixTargetProgress(); blip(500); };
    trayEl.appendChild(b);
  });
}
function renderWord(){
  wordEl.textContent = state.word.join('');
  wordEl.style.fontVariationSettings = `'wght' ${700+state.word.length*40}, 'wdth' ${100+state.word.length*6}`;
}
function pushLetter(ch){
  const i = state.tray.indexOf(ch);
  if(i>=0){ state.tray.splice(i,1); state.word.push(ch); renderTray(); renderWord(); fixTargetProgress(); blip(500); }
}
function popLetter(){
  const c = state.word.pop();
  if(c){ state.tray.push(c); renderTray(); renderWord(); fixTargetProgress(); }
}
$('btn-clear').onclick = ()=>{ if(!state.word.length) { state.tray=[]; } else { state.tray.push(...state.word); state.word=[]; } renderTray(); renderWord(); fixTargetProgress(); };
trayEl.addEventListener('click', ()=>{});
wordEl.addEventListener('click', ()=>popLetter());

function submitWord(){
  const w = state.word.join('');
  if(w.length<3){ msg('Words need 3+ letters.', 'bad'); buzz(); return; }
  if(!WORDSET.has(w)){
    msg(`"${w}" isn't in the arcade dictionary.`, 'bad'); buzz();
    state.combo=1; state.word=[]; renderWord();
    return;
  }
  const isTarget = w===state.target;
  const pts = w.length*w.length*10 + (isTarget?150:0);
  state.combo = Math.min(9, state.combo+1);
  addScore(pts, stage.clientWidth/2);
  state.scored.unshift({w, pts: pts*(state.power.double>0?2:1)*state.combo});
  const chip=document.createElement('span');
  chip.className='scored-chip'+(isTarget?' target':'');
  chip.textContent=`${w} +${pts}`;
  scoredEl.prepend(chip);
  msg(isTarget?`★ TARGET "${w}"! +${pts} ★`:`"${w}" +${pts} · combo ×${state.combo}`, 'good');
  if(isTarget){ // new target after hit
    const pool=WORDS.filter(x=>x!==state.target&&x.length>=4&&x.length<=6);
    state.target=pool[Math.floor(state.rng()*pool.length)];
  }
  state.word=[]; renderWord(); fixTargetProgress(); blip(880);
}
$('btn-submit').onclick = submitWord;

// ---- game loop ----
function loop(ts){
  if(!state.running) return;
  const dt = Math.min(0.05, (ts-state.last)/1000 || 0.016);
  state.last = ts;
  state.t -= dt;
  hudTime.textContent = Math.ceil(Math.max(0,state.t));
  hudTime.style.color = state.t<10 ? 'var(--pink)' : '';
  if(state.t<=0) return endGame();
  update(dt);
  requestAnimationFrame(loop);
}

function startGame(){
  // reset
  layer.innerHTML=''; scoredEl.innerHTML='';
  state.letters=[]; state.tray=[]; state.word=[]; state.scored=[];
  state.score=0; state.combo=1; state.t=ROUND; state.spawnAcc=0;
  state.power={double:0,slow:0,wide:0};
  if(state.mode==='daily') setSeed(todayStr());
  hudScore.textContent='0'; renderTray(); renderWord(); renderTarget(); fixTargetProgress();
  msg('Catch letters! Spell a 3+ letter word.');
  overlay.hidden=true;
  state.running=true; state.last=performance.now();
  requestAnimationFrame(loop);
  // countdown safety: end exactly at 60s
  clearTimeout(startGame._t);
  startGame._t=setTimeout(()=>{ if(state.running) endGame(); }, ROUND*1000+400);
}
function endGame(){
  state.running=false;
  clearTimeout(startGame._t);
  for(const L of state.letters) L.el.remove();
  state.letters=[];
  const isDaily = state.mode==='daily';
  const dk = 'ascender.daily.'+todayStr();
  if(state.score>state.best){ state.best=state.score; store.set('ascender.best',state.best); }
  if(isDaily && state.score>store.get(dk,0)) store.set(dk,state.score);
  hudBest.textContent=state.best;
  dailyBestEl.textContent='daily best '+store.get(dk,0);
  overlay.hidden=false;
  overlayTitle.textContent='TIME UP!';
  overlaySub.innerHTML=`SCORE <b style="color:var(--gold)">${state.score}</b> · BEST ${state.best}<br>${state.scored.length? 'Top: '+state.scored.slice().sort((a,b)=>b.pts-a.pts)[0].w : 'No words — the letters escaped!'}`;
  $('btn-go').textContent='PLAY AGAIN ▸';
}
$('btn-start').onclick=startGame;
$('btn-go').onclick=startGame;

// ---- easter eggs ----
// 1) Konami code → invader rain + bonus. 2) type ASCEND → target reveal bonus.
const KONAMI=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let kIdx=0, typed='';
function konami(key){
  const k = key.length===1?key.toLowerCase():key;
  if(k===KONAMI[kIdx]){ kIdx++; if(kIdx===KONAMI.length){ kIdx=0; invaderParty(); } }
  else kIdx = k===KONAMI[0]?1:0;
  if(/^[a-zA-Z]$/.test(key)){ typed=(typed+key.toUpperCase()).slice(-8); if(typed.endsWith('ASCEND')){ ascendEgg(); typed=''; } }
}
function invaderParty(){
  state.invaderMode=true;
  msg('👾 KONAMI! INVADER RAIN — catch them! 👾','good');
  overlay.hidden=true;
  for(let i=0;i<10;i++) setTimeout(spawn, i*120);
  addScore(100, stage.clientWidth/2);
  setTimeout(()=>state.invaderMode=false, 15000);
  fanfare();
}
function ascendEgg(){
  msg('✨ ASCEND! target revealed +50','good');
  addScore(50, stage.clientWidth/2);
  targetWordEl.textContent = state.target.split('').join(' ');
  fanfare();
}

// ---- tiny webaudio blips (no assets) ----
let AC=null;
function tone(f,d=0.08,type='square',g=0.04){ try{
  AC = AC || new (window.AudioContext||window.webkitAudioContext)();
  const o=AC.createOscillator(), gn=AC.createGain();
  o.type=type; o.frequency.value=f; gn.gain.value=g;
  o.connect(gn); gn.connect(AC.destination); o.start();
  gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+d);
  o.stop(AC.currentTime+d);
}catch{} }
const blip=(f)=>tone(f,0.09,'square',0.035);
const buzz=()=>tone(140,0.18,'sawtooth',0.05);
const fanfare=()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.12,'square',0.05),i*90));};

function floatScore(txt, x){
  const s=document.createElement('div');
  s.textContent=txt;
  s.style.cssText=`position:absolute;top:${CATCH_Y+30}px;left:${(x??stage.clientWidth/2)}px;z-index:5;color:var(--gold);font-size:11px;pointer-events:none;transform:translateX(-50%)`;
  layer.appendChild(s);
  s.animate([{opacity:1,transform:'translate(-50%,0)'},{opacity:0,transform:'translate(-50%,-40px)'}],{duration:800}).onfinish=()=>s.remove();
}

// ---- init ----
setMode('daily');
hudBest.textContent=state.best;
renderTray(); renderWord();
