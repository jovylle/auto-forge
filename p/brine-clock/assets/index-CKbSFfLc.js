(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=e=>document.querySelector(e),t=44714.16432,n=43200,r=86164.092,i=e=>.82*Math.cos(Math.PI*2*e/t+.4)+.38*Math.cos(Math.PI*2*e/n-.9)+.12*Math.cos(Math.PI*2*e/r+1.7),a=e=>Math.min(1,Math.max(0,(e+1.35)/2.7)),o=[{name:`Middle`,start:0,end:4},{name:`Morning`,start:4,end:8},{name:`Forenoon`,start:8,end:12},{name:`Afternoon`,start:12,end:16},{name:`First Dog`,start:16,end:18},{name:`Second Dog`,start:18,end:20},{name:`First`,start:20,end:24}];function s(e){for(let t of o)if(e>=t.start*3600&&e<t.end*3600){let n=(t.end-t.start)*2,r=Math.min(Math.floor((e-t.start*3600)/1800),n-1);return{watch:t,bell:t.start===18?4+r+1:r+1,idx:r}}return{watch:o[0],bell:1,idx:0}}function c(e,n){let r=e+t*1.1;for(let t=e+60;t<r;t+=60){let e=i(t-120),r=i(t),a=i(t+120);if(n===`high`&&r>e&&r>a||n===`low`&&r<e&&r<a)return{sec:t,h:r}}return null}var l=e=>{let t=Math.round(e),n=Math.floor(t/3600),r=Math.floor(t%3600/60);return n>0?`${n}h ${r}m`:`${r}m`},u=e(`#app`);u.innerHTML=`
  <header class="masthead">
    <div>
      <p class="masthead-kicker">a tide timer that breathes with the sea</p>
      <h1 class="masthead-word">Brine <em>Clock</em></h1>
    </div>
    <div class="wavebar" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
  </header>

  <main class="grid-main">
    <section class="panel dial-panel">
      <div class="dial-head">
        <h2 class="panel-title">The Tidal Pool</h2>
        <span class="panel-tag">M2 lunar tide · live</span>
      </div>
      <div class="dial-wrap">
        <canvas class="dial-canvas" role="img" aria-label="Animated tide dial showing the lunar tidal cycle"></canvas>
        <div class="tide-chips">
          <div class="chip chip--high"><span>Next high</span><b id="nextHigh">—</b></div>
          <div class="chip chip--low"><span>Next low</span><b id="nextLow">—</b></div>
        </div>
        <div class="dial-overlay">
          <p class="tide-state" id="tideState">—</p>
          <p class="tide-meters" id="tideMeters">—</p>
        </div>
      </div>
    </section>

    <aside class="rail">
      <section class="panel card">
        <div class="card-head">
          <h2 class="panel-title">Breathe with the Sea</h2>
          <span class="panel-tag" id="bpmTag">6 / min</span>
        </div>
        <div class="breath-orb" id="breathOrb"><div class="breath-core"></div></div>
        <div class="breath-readout">
          <p class="breath-phase" id="breathPhase">INHALE</p>
          <p class="breath-hint">tidal breathing pacer</p>
        </div>
        <div class="breath-meta">
          <span id="breathCount">0 breaths</span>
          <span id="breathSecs">10s cycle</span>
        </div>
        <div class="slider-row">
          <label for="bpm">Cadence</label>
          <input type="range" id="bpm" min="4" max="12" step="0.5" value="6" />
        </div>
      </section>

      <section class="panel card">
        <div class="card-head">
          <h2 class="panel-title">Harbor Bell</h2>
          <span class="panel-tag" id="watchName">—</span>
        </div>
        <div class="bell-dome">
          <div class="bell-bolt"></div>
          <div class="bell-body" id="bellBody"></div>
          <div class="bell-clapper"></div>
        </div>
        <div class="bell-readout">
          <p class="bell-count" id="bellCount">—</p>
          <p class="bell-next" id="bellNext">next bell in —</p>
        </div>
        <div class="bell-actions">
          <button class="btn" id="ringBtn" type="button">Ring now</button>
          <label class="toggle"><input type="checkbox" id="bellOn" checked /><span>sound</span></label>
        </div>
      </section>
    </aside>

    <section class="panel watch-strip">
      <div class="watch-now"><span>Current watch</span><b id="watchNow">—</b></div>
      <div class="watch-list" id="watchList"></div>
    </section>
  </main>

  <p class="foot-note">tides follow a synthetic lunar model · ship's bells mark the half-hour watches</p>
`;var d=`brine-clock`,f={bpm:6,bellOn:!0},p=f;try{let e=localStorage.getItem(d);e&&(p={...f,...JSON.parse(e)})}catch{p={...f}}var m=()=>{try{localStorage.setItem(d,JSON.stringify(p))}catch{}},ee=e(`#tideState`),te=e(`#tideMeters`),ne=e(`#nextHigh`),re=e(`#nextLow`),h=e(`.dial-canvas`),g=e(`.dial-wrap`),_=h.getContext(`2d`),ie=e(`#breathOrb`);e(`.breath-core`);var ae=e(`#breathPhase`),oe=e(`#breathCount`),se=e(`#breathSecs`),ce=e(`#bpmTag`),v=e(`#bpm`);v.value=String(p.bpm);var y=e(`#bellBody`),b=e(`#bellCount`),x=e(`#bellNext`),S=e(`#bellOn`);S.checked=p.bellOn;var C=e(`#ringBtn`),w=e(`#watchName`),T=e(`#watchNow`),E=e(`#watchList`);for(let e of o){let t=document.createElement(`span`);t.className=`watch-item`,t.textContent=e.name,t.dataset.watch=e.name,E.appendChild(t)}var D=p.bpm;v.addEventListener(`input`,()=>{D=parseFloat(v.value),p.bpm=D,m()}),S.addEventListener(`change`,()=>{p.bellOn=S.checked,m()});var O=null;function k(){if(O){O.state===`suspended`&&O.resume();return}try{O=new AudioContext,O.state===`suspended`&&O.resume()}catch{O=null}}window.addEventListener(`pointerdown`,k,{passive:!0});function A(e){if(!O||!p.bellOn)return;let t=O.currentTime+Math.max(0,e);for(let[e,n]of[[1,1],[2,.6],[2.76,.38],[4.3,.2],[5.4,.1]]){let r=O.createOscillator(),i=O.createGain();r.type=`sine`,r.frequency.value=392*e;let a=2.5-e*.2;i.gain.setValueAtTime(0,t),i.gain.linearRampToValueAtTime(n*.5,t+.006),i.gain.exponentialRampToValueAtTime(1e-4,t+a),r.connect(i),i.connect(O.destination),r.start(t),r.stop(t+a+.1)}let n=O.createBuffer(1,Math.floor(O.sampleRate*.025),O.sampleRate),r=n.getChannelData(0);for(let e=0;e<r.length;e++)r[e]=(Math.random()*2-1)*(1-e/r.length)**2;let i=O.createBufferSource();i.buffer=n;let a=O.createBiquadFilter();a.type=`bandpass`,a.frequency.value=1900,a.Q.value=.8;let o=O.createGain();o.gain.setValueAtTime(.12,t),o.gain.exponentialRampToValueAtTime(1e-4,t+.02),i.connect(a),a.connect(o),o.connect(O.destination),i.start(t)}function j(){y.classList.remove(`ringing`),y.offsetWidth,y.classList.add(`ringing`)}var M=0;function N(e){M++;let t=M;for(let n=0;n<e;n++)window.setTimeout(()=>{t===M&&(j(),A(0))},n*850)}C.addEventListener(`click`,()=>{k();let e=new Date;N(s(e.getHours()*3600+e.getMinutes()*60+e.getSeconds()).bell)});function P(){k();let e=new Date;N(s(e.getHours()*3600+e.getMinutes()*60+e.getSeconds()).bell)}var F=-1;function I(e){let t=new Date(e),n=t.getHours(),r=t.getMinutes(),i=n*100+r;if((r===0||r===30)&&i!==F){F=i;let e=s(n*3600+r*60+t.getSeconds());return p.bellOn?P():j(),e}return null}var L=0,R=0,z=Math.min(window.devicePixelRatio||1,2);function B(){let e=g.getBoundingClientRect();L=Math.max(220,Math.min(560,e.width)),R=L,h.style.width=`${L}px`,h.style.height=`${R}px`,h.width=Math.round(L*z),h.height=Math.round(R*z)}B(),new ResizeObserver(B).observe(g);var le=Array.from({length:9},()=>({px:(Math.random()*2-1)*.86,py:Math.random()*2-1,r:1.6+Math.random()*3.4,spd:.008+Math.random()*.02,ph:Math.random()*Math.PI*2}));function ue(e,t,n){return e*(1+.02*Math.sin(3*t+.4*n)+.013*Math.sin(5*t-.3*n)+.009*Math.sin(7*t+.2*n))}var V=``,H=``,U=``,W=``,G=``,K=``,q=0,J=-1;function Y(e){let n=e/1e3,r=Math.floor(n),o=L/2,s=R/2,u=Math.min(L,R)/2-10,d=u*.72;_.setTransform(z,0,0,z,0,0),_.clearRect(0,0,L,R);let f=i(r),p=a(f),m=new Path2D;for(let e=0;e<=140;e++){let t=e/140*Math.PI*2,r=ue(u,t,n),i=o+Math.cos(t)*r,a=s+Math.sin(t)*r;e===0?m.moveTo(i,a):m.lineTo(i,a)}m.closePath();let h=_.createLinearGradient(0,s-u,0,s+u);h.addColorStop(0,`#0c4450`),h.addColorStop(.5,`#08333b`),h.addColorStop(1,`#06222c`),_.fillStyle=h,_.fill(m),_.save(),_.globalCompositeOperation=`destination-out`,_.beginPath(),_.arc(o,s,d,0,Math.PI*2),_.fill(),_.restore();for(let e=0;e<12;e++){let t=e/12*Math.PI*2-Math.PI/2,n=(u+d)/2,r=o+Math.cos(t)*n,i=s+Math.sin(t)*n;_.beginPath(),_.arc(r,i,2.4,0,Math.PI*2),_.fillStyle=`rgba(233,245,238,0.5)`,_.fill()}_.beginPath(),_.arc(o,s,d,0,Math.PI*2),_.strokeStyle=`rgba(233,245,238,0.22)`,_.lineWidth=1.5,_.stroke(),_.save(),_.beginPath(),_.arc(o,s,d,0,Math.PI*2),_.clip();let g=s+d-p*d*2,v=e=>g+Math.sin((e-o)/16+.5*n)*5+Math.sin((e-o)/26-.34*n)*4,y=new Path2D;y.moveTo(o-d,v(o-d));for(let e=o-d;e<=o+d;e+=3)y.lineTo(e,v(e));y.lineTo(o+d,s+d+8),y.lineTo(o-d,s+d+8),y.closePath();let b=_.createLinearGradient(0,g-20,0,s+d);b.addColorStop(0,`rgba(152,222,204,0.95)`),b.addColorStop(.12,`rgba(54,174,150,0.95)`),b.addColorStop(.55,`rgba(20,116,118,0.96)`),b.addColorStop(1,`rgba(5,46,62,0.98)`),_.fillStyle=b,_.fill(y),_.beginPath();for(let e=o-d;e<=o+d;e+=3){let t=v(e);e===o-d?_.moveTo(e,t):_.lineTo(e,t)}_.strokeStyle=`rgba(240,250,244,0.7)`,_.lineWidth=1.6,_.stroke();for(let t of le){t.py-=t.spd,t.py<-1&&(t.py=1,t.px=(Math.random()*2-1)*.86);let n=o+t.px*d*.94,r=s+t.py*d*.94;if(r>g+4){let i=.28+.22*Math.sin(e/400+t.ph);_.beginPath(),_.arc(n,r,t.r,0,Math.PI*2),_.fillStyle=`rgba(240,250,244,${i.toFixed(3)})`,_.fill()}}_.restore();let x=r%t/t*Math.PI*2-Math.PI/2,S=d*.88;_.save(),_.translate(o,s),_.rotate(x);let C=new Path2D;C.moveTo(0,0),C.quadraticCurveTo(S*.42,-S*.05,S,-S*.04),C.quadraticCurveTo(S*1.02,0,S,S*.04),C.quadraticCurveTo(S*.42,S*.05,0,0),C.closePath();let w=_.createLinearGradient(0,0,S,0);w.addColorStop(0,`rgba(242,200,164,0.9)`),w.addColorStop(1,`rgba(255,125,95,0.85)`),_.fillStyle=w,_.fill(C),_.beginPath(),_.arc(S,0,5.5,0,Math.PI*2),_.fillStyle=`#f2f7f2`,_.shadowColor=`rgba(242,200,164,0.9)`,_.shadowBlur=12,_.fill(),_.shadowBlur=0,_.restore();let T=i(r)-i(r-1200),E=x+Math.PI,O=o+Math.cos(E)*(u+d)/2,k=s+Math.sin(E)*(u+d)/2,A=T>6e-5,j=T<-6e-5;if(_.save(),_.translate(O,k),_.rotate(E),A||j){_.strokeStyle=A?`rgba(233,245,238,0.85)`:`rgba(242,200,164,0.8)`,_.lineWidth=2,_.lineCap=`round`;for(let e of[6,12]){let t=A?-e:e;_.beginPath(),_.moveTo(-5,t),_.lineTo(0,A?-(e+5):e+5),_.lineTo(5,t),_.stroke()}}else _.strokeStyle=`rgba(233,245,238,0.4)`,_.lineWidth=2,_.lineCap=`round`,_.beginPath(),_.moveTo(-6,0),_.lineTo(6,0),_.stroke();_.restore();let M=A?`FLOODING`:j?`EBBING`:`SLACK WATER`;M!==V&&(V=M,ee.textContent=M);let N=`${f>=0?`+`:``}${f.toFixed(2)} m · ${A?`rising`:j?`falling`:`slack`}`;N!==H&&(H=N,te.textContent=N);let P=c(r,`high`),F=c(r,`low`),I=P?l(P.sec-r):`—`,B=F?l(F.sec-r):`—`;I!==U&&(U=I,ne.textContent=I),B!==W&&(W=B,re.textContent=B);let Y=60/D,X=r%Y/Y,Z=1+.5*Math.sin(X*Math.PI*2);ie.style.setProperty(`--bscale`,Z.toFixed(3));let Q=Math.sin(X*Math.PI*2)>=0?`INHALE`:`EXHALE`;Q!==G&&(G=Q,ae.textContent=Q,ae.style.color=Q===`INHALE`?`var(--tide-soft)`:`var(--shell)`);let $=`${Math.round(Y)}s cycle`;$!==K&&(K=$,se.textContent=$,ce.textContent=`${D} / min`);let de=Math.floor(X*4);J===3&&de===0&&q++,J=de,oe.textContent=`${q} breaths`}function X(){Y(performance.now()),requestAnimationFrame(X)}requestAnimationFrame(X);function Z(e){let t=new Date(e),n=s(t.getHours()*3600+t.getMinutes()*60+t.getSeconds());b.textContent=`${n.bell} bell${n.bell===1?``:`s`}`,w.textContent=`${n.watch.name} watch`,T.textContent=`${n.watch.name} · ${n.bell} bell${n.bell===1?``:`s`}`;let r=new Date(t);t.getMinutes()<30?r.setHours(t.getHours(),30,0,0):r.setHours(t.getHours()+1,0,0,0);let i=(r.getTime()-e)/1e3,a=s(r.getHours()*3600+r.getMinutes()*60);x.textContent=`next bell · ${l(i)} · ${a.bell} bell${a.bell===1?``:`s`}`;for(let e of E.querySelectorAll(`.watch-item`))e.classList.toggle(`is-current`,e.dataset.watch===n.watch.name);return I(e)}function Q(){Z(Date.now()),window.setTimeout(Q,500)}Q();