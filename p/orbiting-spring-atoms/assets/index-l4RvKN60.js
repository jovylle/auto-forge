(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=26,t=28,n=1.6,r=t,i=!1,a=[],o=[],s=null;function c(){if(!s)try{s=new(window.AudioContext||window.webkitAudioContext)}catch{}return s}function l(e,t=.12,n=`square`,r=.08,i=0){let a=c();if(!a)return;let o=a.createOscillator(),s=a.createGain();o.type=n,o.frequency.value=e,i&&o.frequency.exponentialRampToValueAtTime(Math.max(40,e+i),a.currentTime+t),s.gain.value=r,s.gain.exponentialRampToValueAtTime(1e-4,a.currentTime+t),o.connect(s),s.connect(a.destination),o.start(),o.stop(a.currentTime+t)}function u(e){let t=c();if(!t)return;let n=t.createOscillator(),r=t.createGain();n.type=`sawtooth`,n.frequency.value=e?120:600,n.frequency.exponentialRampToValueAtTime(e?600:120,t.currentTime+.25),r.gain.value=.06,r.gain.exponentialRampToValueAtTime(1e-4,t.currentTime+.25),n.connect(r),r.connect(t.destination),n.start(),n.stop(t.currentTime+.25)}function d(){a=[],o=[];let t=m.width/(2*g()),r=m.height/(2*g()),i=f(42);for(let o=0;o<e;o++){let s=o/e*Math.PI*2+i()*.4,c=90+i()*120;a.push({id:o,x:t+Math.cos(s)*c,y:r+Math.sin(s)*c,vx:-Math.sin(s)*(1.2+i()*.6)*(n*30),vy:Math.cos(s)*(1.2+i()*.6)*(n*30),r:3+i()*2.5,hue:o*37%360,trail:[]})}for(let t=0;t<e;t++)o.push({a:t,b:(t+1)%e,rest:0,k:.04});for(let e of o){let t=a[e.a],n=a[e.b];e.rest=Math.hypot(t.x-n.x,t.y-n.y)}u(!0)}function f(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var p=document.getElementById(`app`);p.innerHTML=`
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
    <canvas id="c"></canvas>
    <div id="hint" class="absolute top-3 right-3 text-xs opacity-60 pointer-events-none"></div>
  </main>
</div>`;var m=document.getElementById(`c`),h=m.getContext(`2d`);function g(){return window.devicePixelRatio||1}function _(){let e=m.parentElement.getBoundingClientRect();m.width=e.width*g(),m.height=e.height*g(),m.style.width=e.width+`px`,m.style.height=e.height+`px`}window.addEventListener(`resize`,_),_();var v=document.getElementById(`gravity`),y=document.getElementById(`trail`),b=document.getElementById(`stiff`),x=document.getElementById(`pause`),S=document.getElementById(`reset`),C=document.getElementById(`clearSprings`);v.addEventListener(`input`,()=>{n=parseFloat(v.value),document.getElementById(`gVal`).textContent=n.toFixed(2),l(220+n*80,.06,`sine`,.05)}),y.addEventListener(`input`,()=>{r=parseInt(y.value),document.getElementById(`tVal`).textContent=String(r)});var w=.04;b.addEventListener(`input`,()=>{w=parseFloat(b.value),document.getElementById(`kVal`).textContent=w.toFixed(3);for(let e of o)e.k=w;l(300,.05,`triangle`,.04)}),x.addEventListener(`click`,()=>{i=!i,x.textContent=i?`RESUME`:`PAUSE`,l(i?180:320,.08,`square`,.06)}),S.addEventListener(`click`,d),C.addEventListener(`click`,()=>{o=[],l(120,.1,`sawtooth`,.05)}),window.addEventListener(`keydown`,e=>{e.code===`Space`&&(e.preventDefault(),x.click()),e.key.toLowerCase()===`r`&&S.click()});var T=null,E=null;function D(e,t){let n=g();e*n,t*n;let r=e,i=t;for(let e=a.length-1;e>=0;e--){let t=a[e];if(Math.hypot(t.x-r,t.y-i)<Math.max(12,t.r*2.5))return e}return null}m.addEventListener(`mousedown`,e=>{let t=m.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top,i=D(n,r);i!==null&&(T=i,E={x:n,y:r},l(440,.05,`sine`,.05))}),m.addEventListener(`mousemove`,e=>{if(T===null)return;let t=m.getBoundingClientRect();E={x:e.clientX-t.left,y:e.clientY-t.top}}),m.addEventListener(`mouseup`,e=>{if(T===null)return;let t=m.getBoundingClientRect(),n=D(e.clientX-t.left,e.clientY-t.top);if(n!==null&&n!==T&&!o.some(e=>e.a===T&&e.b===n||e.a===n&&e.b===T)){let e=a[T],t=a[n];o.push({a:T,b:n,rest:Math.hypot(e.x-t.x,e.y-t.y),k:w}),l(660,.1,`triangle`,.07,200)}T=null,E=null});function O(e){if(i)return;let t=m.width/(2*g()),s=m.height/(2*g()),c=Array(a.length).fill(0),l=Array(a.length).fill(0);for(let e=0;e<a.length;e++){let r=a[e],i=t-r.x,o=s-r.y,u=i*i+o*o+400,d=Math.sqrt(u),f=n*120/u;c[e]+=i/d*f,l[e]+=o/d*f}for(let e of o){let t=a[e.a],n=a[e.b],r=n.x-t.x,i=n.y-t.y,o=Math.hypot(r,i)||1,s=e.k*(o-e.rest),u=r/o,d=i/o;c[e.a]+=u*s,l[e.a]+=d*s,c[e.b]-=u*s,l[e.b]-=d*s}for(let t=0;t<a.length;t++){let n=a[t];n.vx+=c[t]*e,n.vy+=l[t]*e,n.vx*=.995,n.vy*=.995,n.x+=n.vx*e,n.y+=n.vy*e,n.trail.push({x:n.x,y:n.y}),n.trail.length>r&&n.trail.shift()}}var k=performance.now(),A=0,j=performance.now();function M(){let e=m.width,t=m.height,n=g();h.fillStyle=`rgba(3,6,13,0.35)`,h.fillRect(0,0,e,t);let r=e/2,i=t/2,s=h.createRadialGradient(r,i,0,r,i,60*n);s.addColorStop(0,`rgba(0,229,255,0.9)`),s.addColorStop(.4,`rgba(0,229,255,0.25)`),s.addColorStop(1,`rgba(0,229,255,0)`),h.fillStyle=s,h.beginPath(),h.arc(r,i,60*n,0,Math.PI*2),h.fill(),h.fillStyle=`#00e5ff`,h.shadowColor=`#00e5ff`,h.shadowBlur=24*n,h.beginPath(),h.arc(r,i,6*n,0,Math.PI*2),h.fill(),h.shadowBlur=0,h.lineWidth=1.5*n;for(let e of o){let t=a[e.a],r=a[e.b];t&&r&&(h.strokeStyle=`rgba(255,176,0,0.55)`,h.shadowColor=`#ffb000`,h.shadowBlur=6*n,h.beginPath(),h.moveTo(t.x*n,t.y*n),h.lineTo(r.x*n,r.y*n),h.stroke())}h.shadowBlur=0;for(let e of a)if(!(e.trail.length<2)){h.lineWidth=1.2*n;for(let t=1;t<e.trail.length;t++){let r=t/e.trail.length;h.strokeStyle=`hsla(${e.hue}, 100%, 60%, ${r*.6})`,h.beginPath(),h.moveTo(e.trail[t-1].x*n,e.trail[t-1].y*n),h.lineTo(e.trail[t].x*n,e.trail[t].y*n),h.stroke()}}for(let e of a)h.shadowColor=`hsl(${e.hue},100%,60%)`,h.shadowBlur=12*n,h.fillStyle=`hsl(${e.hue},100%,65%)`,h.beginPath(),h.arc(e.x*n,e.y*n,e.r*n,0,Math.PI*2),h.fill(),h.shadowBlur=0;if(T!==null&&E){let e=a[T];h.strokeStyle=`rgba(255,0,170,0.8)`,h.lineWidth=2*n,h.setLineDash([6*n,4*n]),h.beginPath(),h.moveTo(e.x*n,e.y*n),h.lineTo(E.x*n,E.y*n),h.stroke(),h.setLineDash([])}A++;let c=performance.now();c-j>500&&(document.getElementById(`fps`).textContent=String(Math.round(A*1e3/(c-j))),A=0,j=c),document.getElementById(`pCount`).textContent=String(a.length),document.getElementById(`sCount`).textContent=String(o.length)}var N=0;function P(e){let t=Math.min(.033,(e-k)/1e3);k=e,N+=t;let n=0;for(;N>=1/60&&n<3;)O(1/60),N-=1/60,n++;M(),requestAnimationFrame(P)}d(),requestAnimationFrame(P);