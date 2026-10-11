(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=(e,t=document)=>t.querySelector(e),t=(e,t=document)=>Array.from(t.querySelectorAll(e)),n=[`rest`,`C5`,`D5`,`E5`,`G5`,`A5`],r=[0,523.25,587.33,659.25,783.99,880],i=[`·`,`𝅝`,`𝅗𝅥`,`𝅘𝅥`,`𝅘𝅥𝅮`,`𝅘𝅥𝅯`],a=8,o=240,s=420,c=[{id:`reeds`,glyph:`🪶`,name:`Cattail Reeds`,desc:`Low, misty water. Slow amber trills.`,base:0},{id:`copper`,glyph:`🔔`,name:`Copper Wires`,desc:`Bright metallic peals that carry far.`,base:1},{id:`pines`,glyph:`🌲`,name:`High Pines`,desc:`Thin pine-needle whistles, quick and shy.`,base:2}],l=[{name:`Wren Marlowe`,glyph:`🐦`},{name:`Linnet Okafor`,glyph:`🐤`},{name:`Pip Alder`,glyph:`🦜`},{name:`Siskin Vale`,glyph:`🐥`},{name:`Redpoll Quinn`,glyph:`🕊️`},{name:`Chaffinch Bly`,glyph:`🦅`}],u=`first light · trade a chorus · answer a stranger · perch your song · `.repeat(4),d=`copper-finch-radio-fqbj-v1`;function f(){let e=Date.now();return[{id:`seed-1`,from:`Wren Marlowe`,glyph:`🐦`,pattern:[1,0,3,2,5,3,1,0],dawn:280,perch:`Cattail Reeds`,likes:12,mine:!1,at:e-864e5},{id:`seed-2`,from:`Pip Alder`,glyph:`🦜`,pattern:[5,5,3,1,2,4,0,5],dawn:325,perch:`Copper Wires`,likes:7,mine:!1,at:e-432e5},{id:`seed-3`,from:`Siskin Vale`,glyph:`🐥`,pattern:[2,4,0,4,2,1,3,0],dawn:365,perch:`High Pines`,likes:4,mine:!1,at:e-72e5}]}function p(){return{handle:`Finch-`+Math.floor(100+Math.random()*900),dawn:320,perch:`copper`,chorus:[1,3,0,5,3,2,4,0],flock:f(),loved:[],trades:0,flight:{tuned:!1,chirped:!1,traded:!1}}}var m=p();try{let e=localStorage.getItem(d);if(e){let t=JSON.parse(e);m={...p(),...t,flight:{...p().flight,...t.flight??{}}},(!Array.isArray(m.chorus)||m.chorus.length!==a)&&(m.chorus=p().chorus),Array.isArray(m.flock)||(m.flock=f())}}catch{m=p()}function h(){try{localStorage.setItem(d,JSON.stringify(m))}catch{}}var g=null;function _(){try{if(!g){g=new AudioContext;let e=g.createGain();e.gain.value=.5;let t=g.createDelay(1);t.delayTime.value=.27;let n=g.createGain();n.gain.value=.28;let r=g.createGain();r.gain.value=.3,e.connect(g.destination),e.connect(t),t.connect(n),n.connect(t),t.connect(r),r.connect(g.destination),g.__master=e}return g.state===`suspended`&&g.resume(),g}catch{return null}}function ee(e){return e.__master??e.destination}function v(e,t,n,r=.22,i=.5){let a=n,o=e.createOscillator();o.type=`sine`,o.frequency.setValueAtTime(t*.9,a),o.frequency.exponentialRampToValueAtTime(t*1.1,a+r*.35),o.frequency.exponentialRampToValueAtTime(t*.98,a+r);let s=e.createOscillator();s.type=`sine`,s.frequency.value=28;let c=e.createGain();c.gain.value=t*.03,s.connect(c),c.connect(o.frequency);let l=e.createGain();l.gain.setValueAtTime(0,a),l.gain.linearRampToValueAtTime(i,a+.015),l.gain.exponentialRampToValueAtTime(1e-4,a+r),o.connect(l),l.connect(ee(e)),o.start(a),s.start(a),o.stop(a+r+.05),s.stop(a+r+.05)}var y=[];function b(){y.forEach(e=>window.clearTimeout(e)),y=[],t(`.step.playing`).forEach(e=>e.classList.remove(`playing`)),t(`.finch-card .icon-btn--play.playing`).forEach(e=>e.classList.remove(`playing`))}function x(e,n={}){let i=_();if(!i){T(`Tap again to wake the radio — browsers need a gesture for sound.`);return}b();let a=m.perch===`pines`?1.122:m.perch===`reeds`?.891:1,o=1+(m.dawn-330)/180*.12,s=n.stepDur??.34,c=i.currentTime+.06;e.forEach((e,l)=>{if(e<=0)return;let u=r[e]*a*o;v(i,u,c+l*s);let d=n.mark?.[l];d&&y.push(window.setTimeout(()=>{t(`.step.playing`).forEach(e=>e.classList.remove(`playing`)),d.classList.add(`playing`)},l*s*1e3))}),y.push(window.setTimeout(()=>{t(`.step.playing`).forEach(e=>e.classList.remove(`playing`)),n.onDone?.()},e.length*s*1e3+120))}function S(e){let t=Math.floor(e/60),n=e%60,r=t>=12?`PM`:`AM`;return`${t%12==0?12:t%12}:${String(n).padStart(2,`0`)} ${r}`}function te(e){return e<275?{name:`Blue Hour`,desc:`Indigo air, one brave wren testing the dark. Slow, low answers carry best now.`}:e<315?{name:`First Light`,desc:`The reeds silver over. Quicksilver trills stitch the mist together.`}:e<360?{name:`Copper Sunrise`,desc:`Full finch rush hour — wires hum, pines echo. Trade loud and often.`}:{name:`Gold Morning`,desc:`Late risers and show-offs. Long confident phrases over warm static.`}}function C(e){return e.map(e=>e===0?`―`:i[e]).join(` `)}var w=0;function T(t){let n=e(`#toast`);n.textContent=t,n.classList.add(`show`),window.clearTimeout(w),w=window.setTimeout(()=>n.classList.remove(`show`),2600)}function E(){return`c`+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36)}var ne=e(`#app`);ne.innerHTML=`
<div class="sky" aria-hidden="true">
  <canvas id="skyCanvas"></canvas>
  <div class="orb orb--copper"></div>
  <div class="orb orb--teal"></div>
  <div class="orb orb--rose"></div>
</div>
<aside class="rail" aria-hidden="true">
  <div class="rail-track"><div class="rail-fill" id="railFill"></div></div>
  <span class="rail-phase" id="railPhase">night</span>
</aside>
<div class="page">
  <header class="hero">
    <div>
      <span class="kicker"><span class="dot"></span>on the air · dawn band 4–7 AM</span>
      <h1 class="hero-title">Copper<br />Finch <em>Radio</em></h1>
      <p class="hero-lede">Trade dawn choruses with fellow finches. Tune the dial to your favourite
      first light, chirp an eight-note phrase, and swap songs with the flock before the sun clears the wires.</p>
      <div class="hero-cta-row">
        <button class="btn" id="quickBtn" type="button">⚡ Catch the dawn in 30 seconds</button>
        <button class="btn btn--ghost" id="listenBtn" type="button">Hear the flock</button>
      </div>
      <p class="seq-hint" id="quickHint">One tap tunes, chirps &amp; preps your trade — under 30 seconds, beak promise.</p>
    </div>
    <div class="glass flight-card reveal" id="flightCard">
      <h2>Your 30-second flight</h2>
      <p class="sub">Three hops, ten seconds each. Scroll to travel from night to morning.</p>
      <ol class="flight-steps">
        <li id="fsTune"><span class="n">1</span> Tune the dawn dial <span class="tick" hidden>✓</span></li>
        <li id="fsChirp"><span class="n">2</span> Chirp your chorus <span class="tick" hidden>✓</span></li>
        <li id="fsTrade"><span class="n">3</span> Trade with the flock <span class="tick" hidden>✓</span></li>
      </ol>
    </div>
    <div class="scroll-cue" aria-hidden="true"><span>scroll into dawn</span><span class="chev"></span></div>
  </header>

  <div class="marquee" aria-hidden="true"><span id="marqueeSpan"></span></div>

  <main>
    <section class="section" id="dialSection" aria-label="Dawn dial">
      <div class="section-head reveal"><span class="section-num">01</span><h2>Dawn dial</h2></div>
      <p class="section-sub reveal">Drag the sun along its track. Earlier dawns sing low and slow through the mist;
      later ones ring bright off the copper wires. Scrolling the page also travels through the morning — watch the sky follow you.</p>
      <div class="dial-grid">
        <div class="glass dial-panel reveal">
          <span class="kicker"><span class="dot"></span>dawn o'clock</span>
          <p class="time-readout"><span id="dawnTime">5:20</span> <small id="dawnSuffix">AM</small></p>
          <p class="dawn-name" id="dawnName">Copper Sunrise</p>
          <p class="dawn-desc" id="dawnDesc"></p>
          <label for="dawnRange" class="seq-hint">drag the sun · 4:00 – 7:00 AM</label>
          <input type="range" class="sun-track" id="dawnRange" min="${o}" max="${s}" step="5" value="${m.dawn}" aria-label="Dawn time in minutes after midnight" />
          <div class="tick-labels"><span>4:00</span><span>5:00</span><span>6:00</span><span>7:00</span></div>
          <div class="chip-row" id="dawnChips"></div>
          <label class="seq-hint">light level</label>
          <div class="light-meter" id="lightMeter" aria-hidden="true"></div>
          <div class="seq-actions">
            <button class="btn btn--small" id="dawnPlay" type="button">▶ Sing this dawn</button>
          </div>
        </div>
        <div class="glass perch-card reveal">
          <span class="kicker"><span class="dot"></span>transmission perch</span>
          <h3>Where do you sing from?</h3>
          <p class="seq-hint" style="margin:0">Your perch tints every chirp — reeds deepen, wires brighten, pines lift.</p>
          <div class="perch-list" id="perchList"></div>
        </div>
      </div>
    </section>

    <section class="section" id="tradeSection" aria-label="Chorus trade">
      <div class="section-head reveal"><span class="section-num">02</span><h2>Chorus trade</h2></div>
      <p class="section-sub reveal">Tap a note to cycle its pitch — rest, C, D, E, G, A. Eight notes, one dawn phrase.
      Broadcast it and a fellow finch answers with a song of their own.</p>
      <div class="trade-grid">
        <div class="glass sequencer reveal">
          <span class="kicker"><span class="dot"></span>your phrase · <span id="handleTag"></span></span>
          <h3>Compose your chorus</h3>
          <div class="seq-steps" id="seqSteps" role="group" aria-label="Eight chorus notes"></div>
          <p class="seq-hint" id="chorusWords"></p>
          <div class="seq-actions">
            <button class="btn btn--small" id="playBtn" type="button">▶ Play</button>
            <button class="btn btn--ghost btn--small" id="windBtn" type="button">🍃 Ask the wind</button>
            <button class="btn btn--ghost btn--small" id="clearBtn" type="button">Clear</button>
            <button class="btn btn--small" id="tradeBtn" type="button">📡 Broadcast &amp; trade</button>
          </div>
        </div>
        <div class="glass inbox reveal">
          <span class="kicker"><span class="dot"></span>nest inbox</span>
          <h3>Answers on the wind</h3>
          <div id="inboxBody"><div class="inbox-empty">Quiet skies… broadcast your chorus and a fellow finch will answer within a wingbeat.</div></div>
        </div>
      </div>
    </section>

    <section class="section" id="flockSection" aria-label="Flock board">
      <div class="section-head reveal"><span class="section-num">03</span><h2>Flock board</h2></div>
      <p class="section-sub reveal"><span id="flockCount"></span> Every broadcast perches here. Love the ones that
      ruffle your feathers — the flock remembers.</p>
      <div class="board-tools reveal" id="boardTools" role="group" aria-label="Filter flock board">
        <button class="chip active" data-filter="all" type="button">All songs</button>
        <button class="chip" data-filter="mine" type="button">My broadcasts</button>
        <button class="chip" data-filter="loved" type="button">Loved ♥</button>
      </div>
      <div class="flock-grid" id="flockGrid"></div>
    </section>
  </main>

  <footer class="glass footer reveal">
    <span class="sig">Copper Finch Radio — est. first light</span>
    <span id="footStats"></span>
    <span>no servers were harmed · songs live in your browser</span>
  </footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`,e(`#marqueeSpan`).textContent=u+u;function D(){let e=[[`fsTune`,m.flight.tuned],[`fsChirp`,m.flight.chirped],[`fsTrade`,m.flight.traded]];for(let[t,n]of e){let e=document.getElementById(t);if(!e)continue;e.classList.toggle(`done`,n);let r=e.querySelector(`.tick`);r&&(r.hidden=!n)}h()}function O(e){m.flight[e]||(m.flight[e]=!0,D(),m.flight.tuned&&m.flight.chirped&&m.flight.traded&&T(`🪶 Full flight in record time — a true dawn finch!`))}var k=e(`#dawnRange`),re=e(`#dawnTime`),ie=e(`#dawnSuffix`),ae=e(`#dawnName`),oe=e(`#dawnDesc`),A=e(`#lightMeter`);for(let e=0;e<12;e++){let t=document.createElement(`i`);t.style.height=`${10+e/11*32}px`,A.appendChild(t)}var j=[{label:`Nightingale · 4:40`,min:280},{label:`Wren · 5:20`,min:320},{label:`Linnet · 6:10`,min:370}],M=e(`#dawnChips`);for(let e of j){let t=document.createElement(`button`);t.type=`button`,t.className=`chip`,t.textContent=e.label,t.addEventListener(`click`,()=>N(e.min,!0)),M.appendChild(t)}function N(e,n=!1,r=!0){m.dawn=Math.max(o,Math.min(s,Math.round(e))),k.value=String(m.dawn);let i=S(m.dawn);re.textContent=i.slice(0,-3),ie.textContent=i.slice(-2);let a=te(m.dawn);ae.textContent=a.name,oe.textContent=a.desc;let c=Math.round((m.dawn-o)/180*12);t(`i`,A).forEach((e,t)=>e.classList.toggle(`lit`,t<c)),t(`.chip`,M).forEach(e=>{let t=j.find(t=>t.label===e.textContent);e.classList.toggle(`active`,!!t&&Math.abs(t.min-m.dawn)<3)}),G=m.dawn,r&&O(`tuned`),h(),n&&T(`🌅 Tuned to ${i} — ${a.name}`)}k.addEventListener(`input`,()=>N(Number(k.value))),e(`#dawnPlay`).addEventListener(`click`,()=>{x(m.chorus,{mark:L}),O(`chirped`),T(`🎶 Your phrase at ${S(m.dawn)}`)});var P=e(`#perchList`);function F(){P.innerHTML=``;for(let e of c){let t=document.createElement(`button`);t.type=`button`,t.className=`perch`+(m.perch===e.id?` active`:``),t.setAttribute(`aria-pressed`,String(m.perch===e.id));let n=e.base===0?`0.89×`:e.base===2?`1.12×`:`1.00×`;t.innerHTML=`<span class="glyph">${e.glyph}</span><span><b>${e.name}</b><small>${e.desc}</small></span><span class="freq">${n}</span>`,t.addEventListener(`click`,()=>{m.perch=e.id,h(),F();let t=_();t&&v(t,659.25*(e.base===0?.891:e.base===2?1.122:1),t.currentTime+.05),T(`${e.glyph} Perched on the ${e.name}`)}),P.appendChild(t)}}var I=e(`#seqSteps`),se=e(`#chorusWords`),ce=e(`#handleTag`);ce.textContent=m.handle;var L=[];function R(){I.innerHTML=``,L=[],m.chorus.forEach((e,t)=>{let i=document.createElement(`button`);i.type=`button`,i.className=`step`,i.dataset.p=String(e),i.setAttribute(`aria-label`,`Note ${t+1}: ${n[e]}. Activate to change pitch.`),i.innerHTML=`<span class="bar-wrap"><span class="bar" style="height:${e===0?4:14+e*10}px"></span></span><span class="lbl">${e===0?`rest`:n[e]}</span>`,i.addEventListener(`click`,()=>{m.chorus[t]=(m.chorus[t]+1)%n.length;let e=_();e&&m.chorus[t]>0&&v(e,r[m.chorus[t]],e.currentTime+.02,.16,.4),h(),R()}),I.appendChild(i),L.push(i)}),se.textContent=`“ `+C(m.chorus)+` ” — tap any note to change its pitch`}e(`#playBtn`).addEventListener(`click`,()=>{x(m.chorus,{mark:L}),O(`chirped`)}),e(`#windBtn`).addEventListener(`click`,()=>{b();let e=[[1,3,5,3,2,1,0,2],[5,0,4,2,3,5,1,0],[2,2,4,0,5,4,3,1],[3,5,3,1,0,2,4,5]],t=e[Math.floor(Math.random()*e.length)];m.chorus=t.map(e=>Math.random()<.18?Math.floor(Math.random()*6):e),h(),R(),x(m.chorus,{mark:L}),O(`chirped`),T(`🍃 The wind rearranged your notes…`)}),e(`#clearBtn`).addEventListener(`click`,()=>{b(),m.chorus=Array(a).fill(0),h(),R()});function le(){let e=l[Math.floor(Math.random()*l.length)],t=[[5,4,3,2,1,2,3,0],[1,2,3,5,0,5,3,1],[3,3,1,0,2,4,5,0],[4,5,4,2,0,1,3,5],[2,5,0,3,1,4,2,0],[5,1,3,0,4,2,5,3]],n=t[Math.floor(Math.random()*t.length)],r=m.dawn<300?-1:+(m.dawn>360),i=n.map(e=>e===0?Math.random()<.7?0:1+Math.floor(Math.random()*5):Math.max(1,Math.min(5,e+r)));return{from:e.name,glyph:e.glyph,pattern:i}}var z=`all`;function B(t){let n=e(`#inboxBody`);t?(n.innerHTML=`
    <div class="reply-card">
      <span class="from">${t.glyph} answer from ${t.from}</span>
      <p class="pattern">“ ${C(t.pattern)} ”</p>
      <div class="minidots">${t.pattern.map(e=>`<i class="${e===0?`rest`:``}" style="height:${e===0?4:6+e*5}px"></i>`).join(``)}</div>
      <div class="reply-actions">
        <button class="icon-btn icon-btn--play" id="replyPlay" type="button">▶ Play answer</button>
        <button class="icon-btn" id="replyPerch" type="button">Perch it on the board</button>
      </div>
    </div>`,e(`#replyPlay`).addEventListener(`click`,()=>{x(t.pattern,{}),T(`🎶 ${t.from} sings back`)}),e(`#replyPerch`).addEventListener(`click`,()=>{m.flock.unshift({id:E(),from:t.from,glyph:t.glyph,pattern:[...t.pattern],dawn:m.dawn,perch:c[Math.floor(Math.random()*c.length)].name,likes:1,mine:!1,at:Date.now()}),m.loved.push(m.flock[0].id),h(),H(),B(null),T(`📌 ${t.from}'s answer perched on the flock board`)})):n.innerHTML=`<div class="inbox-empty">Quiet skies… broadcast your chorus and a fellow finch will answer within a wingbeat.</div>`}e(`#tradeBtn`).addEventListener(`click`,()=>{if(m.chorus.every(e=>e===0)){T(`🤫 All rests — give your chorus at least one note before trading.`);return}b();let e=c.find(e=>e.id===m.perch)?.name??`Copper Wires`;m.flock.unshift({id:E(),from:m.handle+` (you)`,glyph:`🪶`,pattern:[...m.chorus],dawn:m.dawn,perch:e,likes:0,mine:!0,at:Date.now()}),m.trades++;let t=le();h(),H(),B(t),O(`traded`),x(t.pattern,{}),T(`📡 Broadcast at ${S(m.dawn)} — ${t.from} answered!`),document.getElementById(`tradeSection`)?.scrollIntoView({behavior:`smooth`,block:`nearest`})});var V=e(`#flockGrid`),ue=e(`#flockCount`),de=e(`#footStats`);function H(){let e=m.flock.filter(e=>z===`mine`?e.mine:z!==`loved`||m.loved.includes(e.id));if(ue.textContent=`${m.flock.length} song${m.flock.length===1?``:`s`} on the wires · ${m.trades} trade${m.trades===1?``:`s`} made`,de.textContent=`${m.flock.length} songs · ${m.trades} trades · dawn ${S(m.dawn)}`,V.innerHTML=``,e.length===0){let e=document.createElement(`div`);e.className=`glass board-empty`,e.textContent=z===`all`?`The wires are quiet. Broadcast the first chorus of the morning.`:`Nothing here yet — go chirp something worth loving.`,V.appendChild(e)}else for(let t of e){let e=m.loved.includes(t.id),n=document.createElement(`article`);n.className=`glass finch-card reveal in`,n.innerHTML=`
      <div class="who">
        <span class="avatar">${t.glyph}</span>
        <span><b>${t.from}</b><small>${t.perch}</small></span>
        <span class="dawn-tag">${S(t.dawn)}</span>
      </div>
      <div class="minidots" style="margin-top:12px">${t.pattern.map(e=>`<i class="${e===0?`rest`:``}" style="height:${e===0?4:6+e*5}px"></i>`).join(``)}</div>
      <div class="card-actions">
        <button class="icon-btn icon-btn--play" type="button">▶ Play</button>
        <button class="icon-btn ${e?`loved`:``}" type="button" aria-pressed="${e}">♥ ${t.likes}</button>
        ${t.mine?`<button class="icon-btn" type="button">✕</button>`:``}
      </div>`;let[r,i,a]=Array.from(n.querySelectorAll(`button`));r.addEventListener(`click`,()=>{r.classList.add(`playing`),x(t.pattern,{onDone:()=>r.classList.remove(`playing`)})}),i.addEventListener(`click`,()=>{if(e)m.loved=m.loved.filter(e=>e!==t.id),t.likes=Math.max(0,t.likes-1);else{m.loved.push(t.id),t.likes++;let e=_();e&&(v(e,880,e.currentTime+.02,.14,.3),v(e,1174.7,e.currentTime+.14,.18,.3))}h(),H()}),a?.addEventListener(`click`,()=>{m.flock=m.flock.filter(e=>e.id!==t.id),m.loved=m.loved.filter(e=>e!==t.id),h(),H(),T(`🗑️ That broadcast flew south for the winter.`)}),V.appendChild(n)}}t(`#boardTools .chip`).forEach(e=>{e.addEventListener(`click`,()=>{z=e.dataset.filter??`all`,t(`#boardTools .chip`).forEach(t=>t.classList.toggle(`active`,t===e)),H()})}),e(`#quickBtn`).addEventListener(`click`,()=>{N(320);let t=[[1,3,5,3,2,4,1,0],[5,3,1,2,4,5,0,3]];m.chorus=[...t[Math.floor(Math.random()*t.length)]],h(),R(),x(m.chorus,{mark:L}),O(`chirped`),e(`#quickHint`).textContent=`Playing now (~6 seconds) — hit “Broadcast & trade” when it lands. Total flight: under 30 seconds.`,document.getElementById(`tradeSection`)?.scrollIntoView({behavior:`smooth`}),T(`⚡ Dawn caught! Your chorus is playing — trade it below.`)}),e(`#listenBtn`).addEventListener(`click`,()=>{let e=m.flock[0];e?(document.getElementById(`flockSection`)?.scrollIntoView({behavior:`smooth`}),window.setTimeout(()=>x(e.pattern,{}),600),T(`🎧 Now playing: ${e.from}`)):T(`The wires are quiet — broadcast first!`)});var U=[[0,`night`],[.25,`first light`],[.55,`sunrise`],[.8,`full chorus`]];function W(){let t=document.documentElement,n=Math.max(1,t.scrollHeight-window.innerHeight),r=Math.min(1,Math.max(0,window.scrollY/n));t.style.setProperty(`--scrollp`,r.toFixed(4));let i=U[0][1];for(let[e,t]of U)r>=e&&(i=t);e(`#railPhase`).textContent=i}var G=m.dawn;window.addEventListener(`scroll`,W,{passive:!0}),window.addEventListener(`resize`,W);var K=new IntersectionObserver(e=>{for(let t of e)t.isIntersecting&&(t.target.classList.add(`in`),K.unobserve(t.target))},{threshold:.12});t(`.reveal`).forEach(e=>K.observe(e));var q=e(`#skyCanvas`),J=q.getContext(`2d`),fe=Array.from({length:14},()=>({x:Math.random(),y:.15+Math.random()*.6,s:.5+Math.random()*1.4,v:.008+Math.random()*.02,ph:Math.random()*6.28})),pe=Array.from({length:90},()=>({x:Math.random(),y:Math.random()*.7,r:.4+Math.random()*1.3,tw:Math.random()*6.28}));function Y(e,t,n){return e+(t-e)*n}function X(e,t,n){return`rgb(${Math.round(Y(e[0],t[0],n))},${Math.round(Y(e[1],t[1],n))},${Math.round(Y(e[2],t[2],n))})`}var Z=[[20,16,33],[44,28,64],[154,79,34],[240,178,74]];function me(e){let t=Math.min(2.999,e*3),n=Math.floor(t);return X(Z[n],Z[n+1],t-n)}function he(e){let t=[[16,12,26],[28,19,12],[42,28,16],[112,74,40]],n=Math.min(2.999,e*3),r=Math.floor(n);return X(t[r],t[r+1],n-r)}function Q(){let e=Math.min(window.devicePixelRatio||1,2);q.width=Math.round(window.innerWidth*e),q.height=Math.round(window.innerHeight*e)}Q(),window.addEventListener(`resize`,Q);function $(e){let t=e/1e3,n=document.documentElement,r=Number(n.style.getPropertyValue(`--scrollp`)||0),i=(G-o)/180,a=Math.min(1,Math.max(0,r*.75+i*.45)),s=Math.min(window.devicePixelRatio||1,2),c=q.width/s,l=q.height/s;J.setTransform(s,0,0,s,0,0);let u=J.createLinearGradient(0,0,0,l);u.addColorStop(0,me(a)),u.addColorStop(.62,he(a)),u.addColorStop(1,`#100b14`),J.fillStyle=u,J.fillRect(0,0,c,l);let d=Math.max(0,.9-a*1.4);if(d>.02)for(let e of pe){let n=d*(.5+.5*Math.sin(t*1.5+e.tw));J.beginPath(),J.arc(e.x*c,e.y*l,e.r,0,6.283),J.fillStyle=`rgba(247,234,214,${n.toFixed(3)})`,J.fill()}let f=Math.min(1,a*1.15),p=c*(.22+f*.5),m=l*(.92-f*.62),h=J.createRadialGradient(p,m,0,p,m,130);h.addColorStop(0,`rgba(240,178,74,${(.25+f*.6).toFixed(3)})`),h.addColorStop(1,`rgba(240,178,74,0)`),J.fillStyle=h,J.fillRect(p-140,m-140,280,280),J.beginPath(),J.arc(p,m,20+f*14,0,6.283),J.fillStyle=`#f7d9a0`,J.fill(),J.strokeStyle=`rgba(20,12,8,0.75)`,J.lineWidth=2,J.lineCap=`round`;for(let e of fe){e.x+=e.v*.016*(.5+a),e.x>1.08&&(e.x=-.08,e.y=.12+Math.random()*.6);let n=e.x*c,r=(e.y+Math.sin(t*2+e.ph)*.012)*l,i=7*e.s,o=Math.sin(t*9+e.ph)*i*.55;J.beginPath(),J.moveTo(n-i,r-o*.4),J.quadraticCurveTo(n-i*.4,r-i*.5-o,n,r),J.quadraticCurveTo(n+i*.4,r-i*.5-o,n+i,r-o*.4),J.stroke()}requestAnimationFrame($)}requestAnimationFrame($),N(m.dawn,!1,!1),F(),R(),H(),D(),B(null),W(),window.addEventListener(`pointerdown`,()=>_(),{passive:!0,once:!0});