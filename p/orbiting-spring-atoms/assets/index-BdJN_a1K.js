(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=26,t=28,n=1.6,r=t,i=!1,a=.04,o=[],s=[],c=null;function l(){if(!c)try{c=new(window.AudioContext||window.webkitAudioContext)}catch{}return c}function u(e,t=.12,n=`square`,r=.08,i=0){let a=l();if(!a)return;let o=a.createOscillator(),s=a.createGain();o.type=n,o.frequency.value=e,i&&o.frequency.exponentialRampToValueAtTime(Math.max(40,e+i),a.currentTime+t),s.gain.value=r,s.gain.exponentialRampToValueAtTime(1e-4,a.currentTime+t),o.connect(s),s.connect(a.destination),o.start(),o.stop(a.currentTime+t)}function d(e){let t=l();if(!t)return;let n=t.createOscillator(),r=t.createGain();n.type=`sawtooth`,n.frequency.value=e?120:600,n.frequency.exponentialRampToValueAtTime(e?600:120,t.currentTime+.25),r.gain.value=.06,r.gain.exponentialRampToValueAtTime(1e-4,t.currentTime+.25),n.connect(r),r.connect(t.destination),n.start(),n.stop(t.currentTime+.25)}function f(){o=[],s=[],i=!1;let t=document.getElementById(`pause`);t&&(t.textContent=`PAUSE`);let r=h.width/(2*_()),c=h.height/(2*_()),l=p(42);for(let t=0;t<e;t++){let i=t/e*Math.PI*2+l()*.4,a=90+l()*120;o.push({id:t,x:r+Math.cos(i)*a,y:c+Math.sin(i)*a,vx:-Math.sin(i)*(1.2+l()*.6)*(n*30),vy:Math.cos(i)*(1.2+l()*.6)*(n*30),r:3+l()*2.5,hue:t*37%360,trail:[]})}for(let t=0;t<e;t++)s.push({a:t,b:(t+1)%e,rest:0,k:a});for(let e of s){let t=o[e.a],n=o[e.b];e.rest=Math.hypot(t.x-n.x,t.y-n.y)}d(!0)}function p(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var m=document.getElementById(`app`);m.innerHTML=`
<div class="flex flex-col md:flex-row h-screen w-screen">
  <aside class="panel w-full md:w-[340px] shrink-0 flex flex-col gap-4 p-5 overflow-y-auto">
    <div>
      <h1 class="title text-2xl glow-cyan">ORBITAL<br/>SPRING ATOMS</h1>
      <p class="text-xs mt-1 opacity-70">particles · springs · gravity well</p>
    </div>
    <div class="border-t border-cyan-500/20 pt-3">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">GRAVITY</span>
        <span class="readout" id="gVal">1.60</span>
      </div>
      <input id="gravity" type="range" min="0" max="4" step="0.05" value="1.6" class="slider" aria-label="gravity" />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">TRAIL LENGTH</span>
        <span class="readout" id="tVal">28</span>
      </div>
      <input id="trail" type="range" min="0" max="80" step="1" value="28" class="slider" aria-label="trail length" />
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs tracking-widest">SPRING STIFFNESS</span>
        <span class="readout" id="kVal">0.04</span>
      </div>
      <input id="stiff" type="range" min="0.005" max="0.2" step="0.005" value="0.04" class="slider" aria-label="spring stiffness" />
    </div>
    <div class="flex gap-2 flex-wrap">
      <button id="pause" class="btn green">PAUSE</button>
      <button id="reset" class="btn amber">RESET</button>
      <button id="clearSprings" class="btn magenta">CLEAR SPRINGS</button>
    </div>
    <div class="panel p-3 text-xs space-y-1">
      <div class="flex justify-between"><span>PARTICLES</span><span class="readout" id="pCount">0</span></div>
      <div class="flex justify-between"><span>SPRINGS</span><span class="readout" id="sCount">0</span></div>
      <div class="flex justify-between"><span>FPS</span><span class="readout" id="fps">0</span></div>
    </div>
    <div class="text-xs opacity-70 leading-relaxed">
      <p class="mb-1"><span class="kbd">drag</span> particle → particle to add spring</p>
      <p class="mb-1"><span class="kbd">space</span> pause / resume</p>
      <p><span class="kbd">r</span> reset system</p>
    </div>
    <div class="mt-auto text-[10px] opacity-40">WEB AUDIO · CANVAS 2D · NO ASSETS</div>
  </aside>
  <main class="flex-1 relative">
    <canvas id="c" role="img" aria-label="Orbiting spring atoms canvas"></canvas>
    <div id="hint" class="absolute top-3 right-3 text-xs opacity-60 pointer-events-none"></div>
  </main>
</div>`;var h=document.getElementById(`c`),g=h.getContext(`2d`);function _(){return window.devicePixelRatio||1}function v(){let e=h.parentElement.getBoundingClientRect();h.width=e.width*_(),h.height=e.height*_(),h.style.width=e.width+`px`,h.style.height=e.height+`px`}window.addEventListener(`resize`,v),v();var y=document.getElementById(`gravity`),b=document.getElementById(`trail`),x=document.getElementById(`stiff`),S=document.getElementById(`pause`),C=document.getElementById(`reset`),w=document.getElementById(`clearSprings`);y.addEventListener(`input`,()=>{n=parseFloat(y.value),document.getElementById(`gVal`).textContent=n.toFixed(2),u(220+n*80,.06,`sine`,.05)}),b.addEventListener(`input`,()=>{r=parseInt(b.value),document.getElementById(`tVal`).textContent=String(r);for(let e of o)for(;e.trail.length>r;)e.trail.shift()}),x.addEventListener(`input`,()=>{a=parseFloat(x.value),document.getElementById(`kVal`).textContent=a.toFixed(3);for(let e of s)e.k=a;u(300,.05,`triangle`,.04)}),S.addEventListener(`click`,()=>{i=!i,S.textContent=i?`RESUME`:`PAUSE`,u(i?180:320,.08,`square`,.06)}),C.addEventListener(`click`,f),w.addEventListener(`click`,()=>{s=[],u(120,.1,`sawtooth`,.05)}),window.addEventListener(`keydown`,e=>{let t=e.target;(!t||t.tagName!==`INPUT`&&t.tagName!==`TEXTAREA`)&&(e.code===`Space`&&(e.preventDefault(),S.click()),e.key.toLowerCase()===`r`&&C.click())});var T=null,E=null;function D(e,t){for(let n=o.length-1;n>=0;n--){let r=o[n];if(Math.hypot(r.x-e,r.y-t)<Math.max(12,r.r*2.5))return n}return null}h.addEventListener(`mousedown`,e=>{let t=h.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top,i=D(n,r);i!==null&&(T=i,E={x:n,y:r},u(440,.05,`sine`,.05))}),h.addEventListener(`mousemove`,e=>{if(T===null)return;let t=h.getBoundingClientRect();E={x:e.clientX-t.left,y:e.clientY-t.top}}),h.addEventListener(`mouseup`,e=>{if(T===null)return;let t=h.getBoundingClientRect(),n=D(e.clientX-t.left,e.clientY-t.top);if(n!==null&&n!==T&&!s.some(e=>e.a===T&&e.b===n||e.a===n&&e.b===T)){let e=o[T],t=o[n];s.push({a:T,b:n,rest:Math.hypot(e.x-t.x,e.y-t.y),k:a}),u(660,.1,`triangle`,.07,200)}T=null,E=null}),window.addEventListener(`mouseup`,()=>{T=null,E=null});function O(e){if(i)return;let t=h.width/(2*_()),a=h.height/(2*_()),c=Array(o.length).fill(0),l=Array(o.length).fill(0);for(let e=0;e<o.length;e++){let r=o[e],i=t-r.x,s=a-r.y,u=i*i+s*s+400,d=Math.sqrt(u),f=n*120/u;c[e]+=i/d*f,l[e]+=s/d*f}for(let e of s){let t=o[e.a],n=o[e.b],r=n.x-t.x,i=n.y-t.y,a=Math.hypot(r,i)||1,s=e.k*(a-e.rest),u=r/a,d=i/a;c[e.a]+=u*s,l[e.a]+=d*s,c[e.b]-=u*s,l[e.b]-=d*s}for(let t=0;t<o.length;t++){let n=o[t];n.vx+=c[t]*e,n.vy+=l[t]*e,n.vx*=.995,n.vy*=.995,n.x+=n.vx*e,n.y+=n.vy*e,r>0?(n.trail.push({x:n.x,y:n.y}),n.trail.length>r&&n.trail.shift()):n.trail.length=0}}var k=performance.now(),A=0,j=performance.now();function M(){let e=h.width,t=h.height,n=_();g.fillStyle=`#03060d`,g.fillRect(0,0,e,t);let r=e/2,i=t/2,a=g.createRadialGradient(r,i,0,r,i,60*n);a.addColorStop(0,`rgba(0,229,255,0.9)`),a.addColorStop(.4,`rgba(0,229,255,0.25)`),a.addColorStop(1,`rgba(0,229,255,0)`),g.fillStyle=a,g.beginPath(),g.arc(r,i,60*n,0,Math.PI*2),g.fill(),g.fillStyle=`#00e5ff`,g.shadowColor=`#00e5ff`,g.shadowBlur=24*n,g.beginPath(),g.arc(r,i,6*n,0,Math.PI*2),g.fill(),g.shadowBlur=0,g.lineWidth=1.5*n;for(let e of s){let t=o[e.a],r=o[e.b];t&&r&&(g.strokeStyle=`rgba(255,176,0,0.55)`,g.shadowColor=`#ffb000`,g.shadowBlur=6*n,g.beginPath(),g.moveTo(t.x*n,t.y*n),g.lineTo(r.x*n,r.y*n),g.stroke())}g.shadowBlur=0;for(let e of o)if(!(e.trail.length<2)){g.lineWidth=1.2*n;for(let t=1;t<e.trail.length;t++){let r=t/e.trail.length;g.strokeStyle=`hsla(${e.hue}, 100%, 60%, ${r*.6})`,g.beginPath(),g.moveTo(e.trail[t-1].x*n,e.trail[t-1].y*n),g.lineTo(e.trail[t].x*n,e.trail[t].y*n),g.stroke()}}for(let e of o)g.shadowColor=`hsl(${e.hue},100%,60%)`,g.shadowBlur=12*n,g.fillStyle=`hsl(${e.hue},100%,65%)`,g.beginPath(),g.arc(e.x*n,e.y*n,e.r*n,0,Math.PI*2),g.fill(),g.shadowBlur=0;if(T!==null&&E){let e=o[T];g.strokeStyle=`rgba(255,0,170,0.8)`,g.lineWidth=2*n,g.setLineDash([6*n,4*n]),g.beginPath(),g.moveTo(e.x*n,e.y*n),g.lineTo(E.x*n,E.y*n),g.stroke(),g.setLineDash([])}A++;let c=performance.now();c-j>500&&(document.getElementById(`fps`).textContent=String(Math.round(A*1e3/(c-j))),A=0,j=c),document.getElementById(`pCount`).textContent=String(o.length),document.getElementById(`sCount`).textContent=String(s.length)}var N=0;function P(e){let t=Math.min(.033,(e-k)/1e3);k=e,N+=t;let n=0;for(;N>=1/60&&n<3;)O(1/60),N-=1/60,n++;M(),requestAnimationFrame(P)}f(),requestAnimationFrame(P);