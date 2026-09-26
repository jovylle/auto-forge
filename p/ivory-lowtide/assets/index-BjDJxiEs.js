(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=(e,t=document)=>t.querySelector(e),t=44714.16432,n=43200,r=86164.092,i=.4,a=7.6,o=e=>.82*Math.cos(2*Math.PI*e/t+.4)+.38*Math.cos(2*Math.PI*e/n-.9)+.12*Math.cos(2*Math.PI*e/r+1.7),s=e=>i+Math.min(1,Math.max(0,(e+1.35)/2.7))*7.199999999999999,c=e=>s(o(e)),l=e=>(e-i)/7.199999999999999;function ee(e,n){let r=e+t*1.2;for(let t=e+60;t<r;t+=60){let e=c(t-120),r=c(t),i=c(t+120);if(n===`high`&&r>e&&r>i||n===`low`&&r<e&&r<i)return{sec:t,ft:r}}return null}var u=e=>e.toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`}),d=e=>{let t=Math.max(0,Math.round(e)),n=Math.floor(t/3600),r=Math.floor(t%3600/60);return n>0?`${n}h ${r}m`:`${r}m`},f=`ivory-lowtide`,p={LOW:1.5,MID:3,HIGH:4.5},m={threshold:2,enabled:!0};try{let e=localStorage.getItem(f);if(e){let t=JSON.parse(e);typeof t.threshold==`number`&&(m.threshold=Math.min(a,Math.max(i,t.threshold))),typeof t.enabled==`boolean`&&(m.enabled=t.enabled)}}catch{}var h=()=>{try{localStorage.setItem(f,JSON.stringify(m))}catch{}},g=e(`#app`);g.innerHTML=`
  <div class="top-rule" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <header class="masthead">
    <div>
      <p class="kicker"><b>IL—01</b> &nbsp;BAUHAUS TIDE INSTRUMENT</p>
      <h1 class="word">Ivory <span class="l">Low</span><span class="t">tide</span></h1>
      <p class="sub">Read the tide in shades of ivory. A harbour staff, an ivory disc and a twenty-four hour chart — one instrument, three faces. Scroll to sound the depths.</p>
    </div>
    <div class="shapes" aria-hidden="true">
      <div class="shape-circle" id="shCircle"></div>
      <div class="shape-square" id="shSquare"></div>
      <div class="shape-tri" id="shTri"></div>
    </div>
  </header>
  <p class="scroll-hint">Scroll to read the tide <span class="bar"><i></i></span> click only — no typing, no dragging</p>

  <section aria-label="Tide reader" class="reveal" id="secReader">
    <h2 class="sec-label"><span class="n">01</span> Tide reader — now</h2>
    <div class="reader-grid">
      <div class="panel staff-panel">
        <p class="staff-title">Tide staff · ft</p>
        <div class="staff" id="staff"><div class="staff-ticks" id="staffTicks"></div><div class="staff-pointer" id="staffPointer"></div></div>
        <p class="staff-title" id="staffVal">—</p>
      </div>
      <div class="panel disc-panel" id="discPanel">
        <div class="disc-wrap">
          <button class="disc-btn" id="discBtn" type="button" aria-label="Toggle between current tide and next peak">
            <svg id="discSvg" width="250" height="250" viewBox="0 0 250 250" role="img" aria-label="Ivory disc tide gauge"></svg>
          </button>
          <div>
            <p class="disc-num"><span class="big" id="discNum">—</span><span class="unit">FEET · HARBOUR DATUM</span></p>
            <p><span class="disc-state" id="discState">—</span></p>
            <p class="disc-sub" id="discSub">—</p>
            <p class="disc-mode" id="discMode">MODE · NOW — CLICK DISC FOR NEXT PEAK</p>
          </div>
        </div>
        <p class="sr-only" aria-live="polite" id="discLive">—</p>
      </div>
      <div class="stack">
        <button class="chip-btn" id="chipBtn" type="button" aria-label="Toggle next tide detail">
          <h3 style="font-family:var(--font-mono2);font-size:.62rem;letter-spacing:.24em;margin:0 0 6px;">Direction — click</h3>
          <span class="row"><span class="tri" id="chipTri">▲</span><span><b class="v" id="chipWord" style="font-family:var(--font-display);font-size:1.8rem;">RISING</b><br><span class="s" id="chipSub" style="font-family:var(--font-mono2);font-size:.72rem;">—</span></span></span>
        </button>
        <div class="mini-card blue"><h3>Next high</h3><p class="v" id="nextHighV">—</p><p class="s" id="nextHighS">—</p></div>
        <div class="mini-card red"><h3>Next low</h3><p class="v" id="nextLowV">—</p><p class="s" id="nextLowS">—</p></div>
      </div>
    </div>
  </section>

  <section aria-label="Ivory chart" class="chart-section reveal" id="secChart">
    <h2 class="sec-label sec-b"><span class="n">02</span> Ivory chart — 24 hours</h2>
    <div class="panel chart-panel">
      <div class="chart-scroll">
        <p class="sticky-readout">SCRUB <b id="scrubTime">—</b> · <span id="scrubVal">—</span> · SCROLL OR CLICK CHART</p>
        <svg class="chart-svg" id="chartSvg" viewBox="0 0 720 260" role="img" aria-label="Twenty-four hour tide curve. Click to inspect an hour."></svg>
        <div class="hour-dots" id="hourDots" aria-label="Jump to hour"></div>
        <p class="chart-cap">Thick ink line = predicted height · red dot = now · yellow band = alarm threshold · click curve or hour to inspect</p>
      </div>
    </div>
  </section>

  <section aria-label="Lowtide alarm" class="alarm-section reveal" id="secAlarm">
    <h2 class="sec-label sec-c"><span class="n">03</span> Lowtide alarm — click to arm</h2>
    <div class="alarm-grid">
      <div class="panel scale-panel">
        <p class="staff-title">Threshold scale · ft</p>
        <div class="tscale" id="tscale"><div class="thresh-band" id="threshBand"></div><div class="thresh-line" id="threshLine"></div></div>
      </div>
      <div class="panel ctrl-panel">
        <p class="staff-title">Set level — click only</p>
        <p class="thresh-num"><span id="threshNum">2.0</span><span style="font-family:var(--font-mono2);font-size:.9rem;"> FT</span></p>
        <div class="stepper">
          <button class="minus" id="thMinus" type="button" aria-label="Decrease threshold by one tenth of a foot">−</button>
          <button class="plus" id="thPlus" type="button" aria-label="Increase threshold by one tenth of a foot">+</button>
        </div>
        <div class="presets" role="group" aria-label="Threshold presets">
          <button type="button" data-preset="LOW">LOW</button>
          <button type="button" data-preset="MID">MID</button>
          <button type="button" data-preset="HIGH">HIGH</button>
        </div>
        <button class="toggle-btn" id="alarmToggle" type="button" aria-pressed="true"><span class="box"></span><span id="alarmToggleLabel">ALARM ARMED</span></button>
        <p class="chart-cap">Saved to this browser only · survives reload</p>
      </div>
      <div class="panel status-panel" id="statusPanel">
        <p class="staff-title">Harbour status</p>
        <p class="status-big" id="statusBig">—</p>
        <p class="status-sub" id="statusSub">—</p>
      </div>
    </div>
  </section>

  <footer class="foot"><span>Ivory Lowtide · synthetic harmonic tide · local only</span><span id="footClock">—</span></footer>
`;var _=e(`#discSvg`),v=`http://www.w3.org/2000/svg`;function y(e,t){let n=document.createElementNS(v,e);for(let[e,r]of Object.entries(t))n.setAttribute(e,r);return n}function b(e,t,n,r){let i=(r-90)*Math.PI/180;return`${e+n*Math.cos(i)},${t+n*Math.sin(i)}`}function te(e,t,n,r){if(r<=.5)return`M ${e} ${t} L ${e} ${t-n} A ${n} ${n} 0 0 1 ${e+.01} ${t-n} Z`;if(r>=359.5)return`M ${e-n} ${t} A ${n} ${n} 0 1 0 ${e+n} ${t} A ${n} ${n} 0 1 0 ${e-n} ${t} Z`;let i=+(r>180),[a,o]=b(e,t,n,r).split(`,`).map(Number);return`M ${e} ${t} L ${e} ${t-n} A ${n} ${n} 0 ${i} 1 ${a} ${o} Z`}_.appendChild(y(`circle`,{cx:`125`,cy:`125`,r:`116`,fill:`#F2E8D5`,stroke:`#16130F`,"stroke-width":`6`}));var x=y(`path`,{fill:`#16130F`,stroke:`none`});_.appendChild(x);for(let e=0;e<12;e++){let t=e/12*360,[n,r]=b(125,125,104,t).split(`,`).map(Number),[i,a]=b(125,125,116,t).split(`,`).map(Number);_.appendChild(y(`line`,{x1:String(n),y1:String(r),x2:String(i),y2:String(a),stroke:`#F2E8D5`,"stroke-width":`3`}))}var S=y(`line`,{x1:`125`,y1:`125`,x2:`125`,y2:`18`,stroke:`#D7263D`,"stroke-width":`6`});_.appendChild(S);var C=y(`circle`,{cx:`125`,cy:`18`,r:`9`,fill:`#D7263D`,stroke:`#16130F`,"stroke-width":`3`});_.appendChild(C);var w=y(`circle`,{cx:`125`,cy:`125`,r:`116`,fill:`none`,stroke:`#D7263D`,"stroke-width":`0`});_.appendChild(w);var T=`now`;e(`#discBtn`).addEventListener(`click`,()=>{T=T===`now`?`peak`:`now`,$(!0)});var E=e(`#staffTicks`);for(let t of[0,3,6,9,12,15,18,21,24]){let n=document.createElement(`button`);n.type=`button`,n.style.top=`${t/24*100}%`,n.setAttribute(`aria-label`,`Scroll to hour ${t} in chart`),n.innerHTML=`<span>${t===24?`24`:String(t).padStart(2,`0`)}:00</span>`,n.addEventListener(`click`,()=>{H(t===24?0:t),e(`#secChart`).scrollIntoView({behavior:X?`auto`:`smooth`,block:`center`})}),E.appendChild(n)}var D=e(`#chartSvg`),O=720,k=26,A=new Date;A.setHours(0,0,0,0);var j=Math.floor(A.getTime()/1e3),M=Array.from({length:25},(e,t)=>j+t*3600),N=e=>c(M[e]),P=M.map((e,t)=>N(t)),F=e=>k+e/24*668,I=e=>234-l(e)*208,ne=P.map((e,t)=>`${t===0?`M`:`L`}${F(t).toFixed(1)},${I(e).toFixed(1)}`).join(` `);for(let e=0;e<=4;e++){let t=k+e/4*208;D.appendChild(y(`line`,{x1:String(k),y1:String(t),x2:`694`,y2:String(t),stroke:`#D9CDB4`,"stroke-width":`1.5`,"stroke-dasharray":`5 5`}))}for(let e=0;e<=24;e+=3){D.appendChild(y(`line`,{x1:String(F(e)),y1:String(k),x2:String(F(e)),y2:`234`,stroke:`#D9CDB4`,"stroke-width":`1`}));let t=y(`text`,{x:String(F(e)),y:`254`,"text-anchor":`middle`,"font-size":`11`,fill:`#16130F`,"font-family":`Space Mono, monospace`});t.textContent=`${e}:00`,D.appendChild(t)}var L=y(`rect`,{x:String(k),y:`0`,width:`668`,height:`0`,fill:`rgba(244,180,0,0.4)`});D.appendChild(L);var R=y(`line`,{x1:String(k),y1:`0`,x2:`694`,y2:`0`,stroke:`#16130F`,"stroke-width":`3`,"stroke-dasharray":`8 4`});D.appendChild(R),D.appendChild(y(`path`,{d:ne,fill:`none`,stroke:`#16130F`,"stroke-width":`6`,"stroke-linejoin":`round`,"stroke-linecap":`round`}));var z=y(`circle`,{r:`10`,fill:`#F4B400`,stroke:`#16130F`,"stroke-width":`4`,cx:`0`,cy:`0`});D.appendChild(z);var B=y(`circle`,{r:`11`,fill:`#D7263D`,stroke:`#16130F`,"stroke-width":`4`,cx:`0`,cy:`0`});D.appendChild(B);var V=new Date().getHours();function H(e){V=Math.min(24,Math.max(0,e)),$(!0)}D.addEventListener(`click`,e=>{let t=D.getBoundingClientRect(),n=(e.clientX-t.left)/t.width*O,r=Math.round((n-k)/668*24);H(Math.min(24,Math.max(0,r)))});var re=e(`#hourDots`),ie=[];for(let e=0;e<24;e+=2){let t=document.createElement(`button`);t.type=`button`,t.textContent=String(e).padStart(2,`0`),t.setAttribute(`aria-label`,`Inspect hour ${e}`),t.addEventListener(`click`,()=>H(e)),re.appendChild(t),ie.push(t)}var ae=e(`#threshNum`),oe=e(`#threshLine`),U=e(`#threshBand`),W=e(`#statusPanel`),G=e(`#statusBig`),K=e(`#statusSub`),q=e(`#alarmToggle`),se=e(`#alarmToggleLabel`);function J(e){m.threshold=Math.round(Math.min(a,Math.max(i,e))*10)/10,h(),$(!0)}e(`#thMinus`).addEventListener(`click`,()=>J(m.threshold-.1)),e(`#thPlus`).addEventListener(`click`,()=>J(m.threshold+.1)),document.querySelectorAll(`.presets button`).forEach(e=>{e.addEventListener(`click`,()=>J(p[e.dataset.preset]))}),q.addEventListener(`click`,()=>{m.enabled=!m.enabled,h(),$(!0)});var Y=!1;e(`#chipBtn`).addEventListener(`click`,()=>{Y=!Y,$(!0)});var X=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,Z=0,Q=!1,ce=e(`#secChart`),le=e(`#staffTicks`),ue=e(`#shCircle`),de=e(`#shSquare`),fe=e(`#shTri`);function pe(){let e=document.documentElement.scrollHeight-window.innerHeight;Z=e>0?Math.min(1,Math.max(0,window.scrollY/e)):0;let t=ce.getBoundingClientRect(),n=window.innerHeight;if(Q=t.top<n*.7&&t.bottom>n*.3,X||(le.style.transform=`translateY(${(Z*26).toFixed(1)}px)`,ue.style.transform=`translateY(${(Z*-40).toFixed(1)}px) rotate(${(Z*120).toFixed(1)}deg)`,de.style.transform=`translateY(${(Z*30).toFixed(1)}px) rotate(${(Z*-90).toFixed(1)}deg)`,fe.style.transform=`translateY(${(Z*-24).toFixed(1)}px)`),Q&&t.height>0){let e=Math.min(1,Math.max(0,(n*.7-t.top)/(t.height+n*.4)));me(Math.round(e*24))}$(!1)}window.addEventListener(`scroll`,pe,{passive:!0});function me(e){V=Math.min(24,Math.max(0,e))}var he=new IntersectionObserver(e=>{for(let t of e)t.isIntersecting&&(t.target.classList.add(`is-in`),he.unobserve(t.target))},{threshold:.12});document.querySelectorAll(`.reveal`).forEach(e=>he.observe(e));var ge=e(`#discNum`),_e=e(`#discState`),ve=e(`#discSub`),ye=e(`#discMode`),be=e(`#discLive`),xe=e(`#discPanel`),Se=e(`#staffPointer`),Ce=e(`#staffVal`),we=e(`#chipTri`),Te=e(`#chipWord`),Ee=e(`#chipSub`),De=e(`#nextHighV`),Oe=e(`#nextHighS`),ke=e(`#nextLowV`),Ae=e(`#nextLowS`),je=e(`#scrubTime`),Me=e(`#scrubVal`),Ne=e(`#footClock`),Pe=``;function $(e){let t=Math.floor(Date.now()/1e3),n=c(t),r=c(t)-c(t-1200),i=r>.004,a=r<-.004,o=ee(t,`high`),s=ee(t,`low`),f=c(j+V*3600),h=Q,g=n,v=T===`now`?`NOW`:`NEXT PEAK`;if(h)g=f,v=`SCROLL SCRUB · ${String(V).padStart(2,`0`)}:00`;else if(T===`peak`){let e=i?o:s;e&&(g=e.ft)}let y=Math.max(2,l(g)*360);x.setAttribute(`d`,te(125,125,100,y));let[E,D]=b(125,125,107,y).split(`,`).map(Number);S.setAttribute(`x2`,String(E)),S.setAttribute(`y2`,String(D)),C.setAttribute(`cx`,String(E)),C.setAttribute(`cy`,String(D));let O=m.enabled&&n<m.threshold;w.setAttribute(`stroke-width`,O?`10`:`0`),xe.classList.toggle(`alarm-on`,O),ge.textContent=`${g.toFixed(1)}`,_e.textContent=h?`SCRUB ${String(V).padStart(2,`0`)}:00`:i?`▲ RISING`:a?`▼ FALLING`:`— SLACK`,_e.className=`disc-state ${i&&!h?`rising`:a&&!h?`falling`:``}`,ve.textContent=o&&s?Y?`LOW ${u(new Date(s.sec*1e3))} · HIGH ${u(new Date(o.sec*1e3))} · SCROLL ${(Z*100).toFixed(0)}%`:`HIGH ${u(new Date(o.sec*1e3))} · LOW ${u(new Date(s.sec*1e3))} · SCROLL ${(Z*100).toFixed(0)}%`:`—`,ye.textContent=`MODE · ${v} — CLICK DISC FOR ${T===`now`?`NEXT PEAK`:`NOW`}`;let k=`Current tide ${n.toFixed(1)} feet, ${i?`rising`:a?`falling`:`slack`}. Threshold ${m.threshold.toFixed(1)} feet, alarm ${m.enabled?O?`triggered`:`armed`:`off`}.`;(k!==Pe||e)&&(Pe=k,be.textContent=k),_.setAttribute(`aria-label`,`Ivory disc: ${g.toFixed(1)} feet. ${k}`),Se.style.top=`${(1-l(n))*100}%`,Ce.textContent=`${n.toFixed(1)} ft`,we.textContent=i?`▲`:a?`▼`:`—`,we.style.color=i?`#274080`:a?`#D7263D`:`#16130F`,Te.textContent=i?`RISING`:a?`FALLING`:`SLACK`,Ee.textContent=Y?`opposite extreme ${s&&o?d((i?s.sec:o.sec)-t):`—`} away`:`rate ${Math.abs(r*3).toFixed(2)} ft/h`,o&&(De.textContent=o.ft.toFixed(1)+` ft`,Oe.textContent=`${u(new Date(o.sec*1e3))} · in ${d(o.sec-t)}`),s&&(ke.textContent=s.ft.toFixed(1)+` ft`,Ae.textContent=`${u(new Date(s.sec*1e3))} · in ${d(s.sec-t)}`);let A=(t-j)/3600,M=Math.min(24,Math.max(0,A));B.setAttribute(`cx`,String(F(M))),B.setAttribute(`cy`,String(I(n))),z.setAttribute(`cx`,String(F(Math.min(24,V)))),z.setAttribute(`cy`,String(I(f)));let N=I(m.threshold);R.setAttribute(`y1`,String(N)),R.setAttribute(`y2`,String(N)),L.setAttribute(`y`,String(N)),L.setAttribute(`height`,String(234-N)),je.textContent=`${String(Math.min(24,V)).padStart(2,`0`)}:00`,Me.textContent=`${f.toFixed(1)} ft`,ie.forEach(e=>{let t=Number(e.textContent);e.classList.toggle(`is-now`,t===new Date().getHours()),e.classList.toggle(`is-sel`,t===Math.min(23,V))}),ae.textContent=m.threshold.toFixed(1);let P=(1-l(m.threshold))*100;U.style.top=`${P}%`,U.style.height=`${100-P}%`,oe.style.top=`${P}%`,q.setAttribute(`aria-pressed`,String(m.enabled)),se.textContent=m.enabled?`ALARM ARMED`:`ALARM OFF`,document.querySelectorAll(`.presets button`).forEach(e=>{let t=p[e.textContent];e.classList.toggle(`is-active`,Math.abs(t-m.threshold)<.051)}),m.enabled?O?(W.className=`panel status-panel triggered`,G.textContent=`Lowtide!`,K.textContent=`tide ${n.toFixed(1)} ft below ${m.threshold.toFixed(1)} ft line · ${(m.threshold-n).toFixed(1)} ft under`):(W.className=`panel status-panel armed`,G.textContent=`Holding`,K.textContent=`tide ${n.toFixed(1)} ft above ${m.threshold.toFixed(1)} ft line · margin ${(n-m.threshold).toFixed(1)} ft`):(W.className=`panel status-panel safe`,G.textContent=`Off watch`,K.textContent=`alarm off · tide ${n.toFixed(1)} ft vs ${m.threshold.toFixed(1)} ft line`),Ne.textContent=`${u(new Date)} · scroll ${(Z*100).toFixed(0)}%`}pe(),$(!0),window.setInterval(()=>$(!1),1e3);