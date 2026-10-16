(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var t=`Eyebright.Thicket.Sedge.Cactus.Canyon.Marsh.Rock.Fern.Crest.Hollow.Ridge.Sage.Burrow.Flit.Trill.Warble.Chirr.Pip.Gully.Mesa.Dune.Salt.Wren.Tule.Cholla.Arroyo.Bajada`.split(`.`),n=[`First lamp lit by the dune wrens.`,`Guides fledglings home past midnight.`,`Hums low when the wind crosses the crest.`,`A seed-star, carried in a wren beak.`,`Blinks in threes — the wren knock.`,`Marks the hour of the night chorus.`,`Cold and steady; the hollow scope favorite.`,`Dust-tailed; best after a storm.`];function r(){let r=e(20261016),i=[],a=[],o=new Map,s=e=>{i.push(e),o.set(e.id,e)},c=[{id:`wren`,name:`The Wren`,lore:`The little cartographer herself — beak pointed at dawn.`,pts:[[.16,.4],[.19,.36],[.225,.345],[.25,.375],[.235,.41],[.205,.425],[.175,.435]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[1,5]]},{id:`crest`,name:`Dune Crest`,lore:`The long ridge where scope-01 keeps its wide eye.`,pts:[[.33,.55],[.365,.515],[.4,.53],[.425,.565],[.395,.585]],links:[[0,1],[1,2],[2,3],[3,4],[4,0]]},{id:`kettle`,name:`Night Kettle`,lore:`A pot of dark tea the wrens sip between sightings.`,pts:[[.555,.63],[.585,.575],[.625,.585],[.635,.63],[.6,.655]],links:[[0,1],[1,2],[2,3],[3,4],[4,0],[1,3]]},{id:`scoop`,name:`Salt Scoop`,lore:`Dips into the milky flat and comes up glittering.`,pts:[[.72,.32],[.755,.29],[.79,.315],[.765,.355]],links:[[0,1],[1,2],[2,3],[3,0]]},{id:`tail`,name:`Tail Feather`,lore:`One barred feather, dropped mid-migration, still glowing.`,pts:[[.82,.7],[.845,.665],[.87,.68],[.885,.645],[.905,.66],[.92,.625]],links:[[0,1],[1,2],[2,3],[3,4],[4,5]]}],l=0;for(let e of c){let i=[];e.pts.forEach(([a,o],c)=>{let u=`${e.id}-${c}`;i.push(u),s({id:u,x:a,y:o,mag:.4+r()*.9,name:`${e.name.split(` `)[1]??e.name} ${`αβγδεζη`[c]??c} · ${t[(l*7+c*3)%t.length].trim()}`,lore:n[(l+c)%n.length],constId:e.id})}),a.push({id:e.id,name:e.name,lore:e.lore,stars:i,links:e.links}),l++}let u=0,d=0;for(;u<520&&d++<6e3;){let e=r(),t=.03+r()*.94,n=!1;for(let r of i){let i=Math.abs(r.x-e),a=Math.abs(r.y-t);if(i<.012&&a<.012){n=!0;break}}if(n)continue;let a=r();s({id:`f-${u}`,x:e,y:t,mag:a<.06?.5+r():a<.3?1.2+r():2+r()*1.4}),u++}return{stars:i,consts:a,byId:o}}var i=[{id:`crest`,no:`01`,name:`Crest Scope`,nickname:`“Wide-Eye”`,dune:`High Dune`,desc:`Sweeping wide-field glass. Catches whole constellations in one gulp — start every night here.`,cx:.28,cy:.44,zoom:1.15,fov:.42},{id:`hollow`,no:`02`,name:`Hollow Scope`,nickname:`“Pinpoint”`,dune:`Hollow Dune`,desc:`Narrow, ruthless magnification sunk in the cool hollow. Splits tight pairs in the Night Kettle.`,cx:.6,cy:.6,zoom:2.6,fov:.15},{id:`salt`,no:`03`,name:`Salt-Flat Scope`,nickname:`“Comet Sweeper”`,dune:`Salt Flat`,desc:`Fast sweeper on the white flat. Meteor watch post — best seat for falling-star season.`,cx:.8,cy:.42,zoom:1.7,fov:.26}],{stars:a,consts:o,byId:s}=r(),c=`dwo_state_v1`,l=`dwo_nights_v1`,u={view:{cx:.5,cy:.5,zoom:1.15,rot:0},scopeId:`crest`,hour:22,showLines:!0,showNames:!0,showMeteors:!0,showWrens:!0,selectedId:null,log:[],notes:``};function d(){try{localStorage.setItem(c,JSON.stringify({view:u.view,scopeId:u.scopeId,hour:u.hour,showLines:u.showLines,showNames:u.showNames,showMeteors:u.showMeteors,showWrens:u.showWrens,log:u.log,notes:u.notes}))}catch{}}function f(){try{let e=localStorage.getItem(c);if(!e)return;let t=JSON.parse(e);t.view&&(u.view={...u.view,...t.view},u.view.cx=(u.view.cx%1+1)%1,u.view.cy=Math.min(1,Math.max(0,u.view.cy)),u.view.zoom=Math.min(4,Math.max(.8,u.view.zoom))),typeof t.scopeId==`string`&&i.some(e=>e.id===t.scopeId)&&(u.scopeId=t.scopeId),typeof t.hour==`number`&&(u.hour=Math.min(24,Math.max(0,t.hour)));for(let e of[`showLines`,`showNames`,`showMeteors`,`showWrens`])typeof t[e]==`boolean`&&(u[e]=t[e]);typeof t.notes==`string`&&(u.notes=t.notes.slice(0,4e3)),Array.isArray(t.log)&&(u.log=t.log.filter(e=>e&&typeof e.starId==`string`&&typeof e.name==`string`).slice(0,200))}catch{}}function p(){try{let e=JSON.parse(localStorage.getItem(l)??`[]`);return Array.isArray(e)?e.filter(e=>e&&typeof e.id==`string`&&e.view&&Array.isArray(e.log)).slice(0,24):[]}catch{return[]}}function ee(e){try{localStorage.setItem(l,JSON.stringify(e))}catch{}}function te(){try{let e=location.hash.match(/#n=([A-Za-z0-9+/=]+)/);if(!e)return!1;let t=JSON.parse(atob(e[1]));return typeof t.cx==`number`&&(u.view.cx=(t.cx%1+1)%1),typeof t.cy==`number`&&(u.view.cy=Math.min(1,Math.max(0,t.cy))),typeof t.zoom==`number`&&(u.view.zoom=Math.min(4,Math.max(.8,t.zoom))),typeof t.rot==`number`&&(u.view.rot=t.rot),typeof t.scopeId==`string`&&i.some(e=>e.id===t.scopeId)&&(u.scopeId=t.scopeId),typeof t.selectedId==`string`&&s.has(t.selectedId)&&(u.selectedId=t.selectedId),!0}catch{return!1}}var m=e=>document.querySelector(e),ne=m(`#app`);ne.innerHTML=`
<a href="#chart" class="kbd" style="position:absolute;left:-9999px;top:0;" onfocus="this.style.left='8px'" onblur="this.style.left='-9999px'">Skip to star chart</a>
<div class="ticker" aria-hidden="true"><span class="ticker-track" id="ticker"></span></div>

<header class="max-w-[1200px] mx-auto px-5 pt-8 pb-2 flex flex-wrap items-start gap-5 justify-between">
  <div class="logo-block px-6 py-4 max-w-[560px]">
    <div class="badge badge-yellow mb-2">Wren chart service · est. dusk</div>
    <h1 class="display" style="font-size:clamp(30px,5vw,58px);">
      Dune <span class="wren">Wren</span><br/>Observatory
    </h1>
    <p class="mt-2 text-[13px] font-bold tracking-wide" style="color:#fff;">Wrens chart the stars from dune scopes. Pick a scope, sweep the chart, export the night.</p>
  </div>
  <div class="flex flex-col gap-3 items-end pt-2">
    <div class="panel px-4 py-3 text-right">
      <div class="badge badge-blue mb-1">Local sky time</div>
      <div class="mono font-bold text-xl" id="clock">--:--:--</div>
      <div class="mono text-[11px]" id="starcount" style="color:var(--ink-64);">${a.length} stars catalogued · 5 wren constellations</div>
    </div>
    <div class="flex gap-2">
      <a class="btn btn-yellow" href="#scopes" style="text-decoration:none;">Scopes</a>
      <a class="btn btn-ink" href="#export" style="text-decoration:none;">Export</a>
    </div>
  </div>
</header>

<main class="max-w-[1200px] mx-auto px-5 pb-24">

  <!-- chart + rail -->
  <section class="grid gap-8 mt-6 lg:grid-cols-[62%_1fr] items-start" aria-label="Star chart and controls">
    <div>
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <span class="badge badge-red" id="scopeBadge">Scope-01 · Wide-Eye</span>
        <span class="mono text-[12px] font-bold" id="viewReadout"></span>
      </div>
      <div class="chart-frame" id="frame" style="height:min(62vh,560px);">
        <canvas id="chart" tabindex="0" role="img"
          aria-label="Interactive star chart. Arrow keys pan, plus and minus zoom, Enter selects the nearest star."></canvas>
        <div class="tip" id="tip" hidden></div>
        <div class="zoom-wipe" id="wipe"><span>Zoom!</span></div>
      </div>
      <p class="mono text-[12px] mt-3" style="color:var(--ink-64);">
        Drag to pan · scroll to zoom · click a star · keys: <span class="kbd">←↑↓→</span> pan
        <span class="kbd">+</span><span class="kbd">−</span> zoom <span class="kbd">Enter</span> select
      </p>
      <div class="panel mt-4 p-4" id="starPanel" aria-live="polite"></div>
    </div>

    <div class="rail-offset flex flex-col gap-5">
      <div class="panel panel-blue p-5 benday-light">
        <h2 class="display text-white" style="font-size:22px;">Chart controls</h2>
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest text-white" for="hour">Night hour · <span id="hourVal" class="mono"></span></label>
        <input class="slider" type="range" id="hour" min="0" max="24" step="0.25" value="22" aria-label="Night hour — rotates the sky" />
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest text-white" for="zoom">Magnification · <span id="zoomVal" class="mono"></span></label>
        <input class="slider" type="range" id="zoom" min="0.8" max="4" step="0.05" value="1.15" aria-label="Chart magnification" />
        <div class="grid grid-cols-2 gap-3 mt-5" role="group" aria-label="Chart layers">
          <div class="toggle" id="tLines" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Lines</div>
          <div class="toggle" id="tNames" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Names</div>
          <div class="toggle" id="tWrens" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Wrens</div>
          <div class="toggle" id="tMeteors" role="checkbox" tabindex="0" aria-checked="true"><span class="pip"></span>Meteors</div>
        </div>
      </div>

      <div class="panel p-5">
        <h2 class="display" style="font-size:22px;">Find a star</h2>
        <input class="field mt-3" id="search" type="search" placeholder="Type a star name — try “trill”…" aria-label="Search named stars" autocomplete="off" />
        <div id="results" class="mt-2 flex flex-col" role="group" aria-label="Search results"></div>
      </div>

      <div class="panel panel-red p-5 benday-light">
        <h2 class="display text-white" style="font-size:22px;">Field log</h2>
        <p class="text-[13px] font-bold mt-1">Stars you tap with “Log it” land here and ship with the night export.</p>
        <div id="logList" class="mt-3 bg-white rounded p-2" style="border:3px solid var(--ink);"></div>
        <label class="block mt-4 mb-1 font-bold text-[12px] uppercase tracking-widest" for="notes">Night notes</label>
        <textarea class="field" id="notes" placeholder="Wind from the west. Wrens loud tonight…"></textarea>
      </div>
    </div>
  </section>

  <!-- scopes -->
  <section id="scopes" class="mt-20" aria-label="Dune scopes">
    <div class="flex items-end gap-4 flex-wrap">
      <h2 class="display outline-text" style="font-size:clamp(34px,6vw,72px);">Dune scopes</h2>
      <p class="font-bold text-[14px] max-w-[340px] pb-2">Three telescopes. Three dunes. One sky full of wrens. Switching scopes slews the chart.</p>
    </div>
    <div class="grid gap-8 mt-8 md:grid-cols-3" id="scopeGrid"></div>
  </section>

  <!-- constellations -->
  <section class="mt-24" aria-label="Wren constellations">
    <h2 class="display" style="font-size:clamp(28px,4.5vw,52px);">The wren <span style="background:var(--pop);color:#fff;padding:0 10px;border:3px solid var(--ink);">canon</span></h2>
    <div class="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3" id="constGrid"></div>
  </section>
</main>

<!-- export strip -->
<section id="export" class="export-strip mt-16" aria-label="Night export">
  <div class="max-w-[1200px] mx-auto px-5 py-12">
    <div class="flex items-center gap-4 flex-wrap">
      <h2 class="display" style="font-size:clamp(30px,5vw,60px);">Night export</h2>
      <span class="burst" style="position:static;">Pack it up!</span>
    </div>
    <p class="font-bold mt-2 max-w-[620px]">Snapshot the chart as a PNG poster, download the observing log, or copy a link that restores this exact sky on any device.</p>
    <div class="flex gap-3 mt-6 flex-wrap">
      <button class="btn btn-ink" id="btnPng">Export PNG poster</button>
      <button class="btn btn-red" id="btnLog">Download log (.md)</button>
      <button class="btn" id="btnLink">Copy night link</button>
      <button class="btn btn-blue" id="btnSave">Save night</button>
    </div>
    <p class="mono text-[12px] font-bold mt-3" id="exportMsg" aria-live="polite"></p>
    <h3 class="display mt-8" style="font-size:20px;">Saved nights</h3>
    <div id="nights" class="grid gap-4 mt-3 md:grid-cols-2 lg:grid-cols-3"></div>
  </div>
</section>

<footer class="max-w-[1200px] mx-auto px-5 py-10 flex flex-wrap gap-4 items-center justify-between">
  <p class="display" style="font-size:15px;">Dune Wren Observatory · charted by wrens</p>
  <p class="mono text-[12px]" style="color:var(--ink-64);">3 inks + black &amp; white · system type · your nights never leave this browser</p>
</footer>
<div class="sr-only" aria-live="polite" id="live"></div>
`;var h=m(`#chart`),g=m(`#frame`),_=m(`#tip`),v=m(`#wipe`),y=h.getContext(`2d`),b=matchMedia(`(prefers-reduced-motion: reduce)`).matches,x=0,S=0,C=1;function re(){let e=g.getBoundingClientRect();C=Math.min(2,devicePixelRatio||1),x=Math.max(280,e.width),S=Math.max(320,e.height-0),h.width=Math.round(x*C),h.height=Math.round(S*C),h.style.height=`${S}px`,y.setTransform(C,0,0,C,0,0),ie()}new ResizeObserver(re).observe(g);var w=null;function ie(){w=document.createElement(`canvas`),w.width=Math.max(1,Math.round(x)),w.height=Math.max(1,Math.round(S));let e=w.getContext(`2d`);e.fillStyle=`rgba(255,255,255,0.55)`;for(let t=0;t<S;t+=26)for(let n=0;n<x;n+=26)e.beginPath(),e.arc(n+13,t+13,1.1,0,7),e.fill()}re();function T(e,t){let n=(e.x-t.cx)%1;n>.5&&--n,n<-.5&&(n+=1);let r=e.y-t.cy,i=Math.cos(t.rot),a=Math.sin(t.rot),o=n*i-r*a,s=n*a+r*i,c=Math.min(x,S)*t.zoom,l=x/2+o*c,u=S/2+s*c;return{x:l,y:u,vis:l>-40&&l<x+40&&u>-40&&u<S+40}}var E=new Map;function D(e,t){let n=E.get(e.id);if(n)return n;let r=T(e,t);return E.set(e.id,r),r}var O=[],ae=0;function oe(e){let t=Math.random,n=t()*x,r=t()*S*.5,i=Math.PI*(.72+t()*.12),a=500+t()*420;O.push({x:n,y:r,vx:Math.cos(i)*a,vy:-Math.sin(i)*a*.5+160,life:0,max:.55+t()*.3}),ae=e}function se(e,t){let n=u.view;y.fillStyle=`#2B44FF`,y.fillRect(0,0,x,S);let r=y.createLinearGradient(0,0,0,S);r.addColorStop(0,`rgba(255,255,255,0.14)`),r.addColorStop(.5,`rgba(0,0,0,0)`),r.addColorStop(1,`rgba(0,0,0,0.35)`),y.fillStyle=r,y.fillRect(0,0,x,S),w&&(y.save(),y.globalAlpha=.1,y.drawImage(w,0,0,x,S),y.restore()),y.fillStyle=`#0D0D0D`,y.beginPath(),y.moveTo(0,S),y.lineTo(0,S-26),y.bezierCurveTo(x*.2,S-70,x*.35,S-8,x*.55,S-34),y.bezierCurveTo(x*.72,S-54,x*.85,S-12,x,S-30),y.lineTo(x,S),y.closePath(),y.fill(),y.fillStyle=`#FFC700`;for(let e of[.18,.55,.85]){let t=x*e,n=S-30-Math.sin(e*9)*8;y.beginPath(),y.arc(t,n-8,7,Math.PI,0),y.fill(),y.strokeStyle=`#0D0D0D`,y.lineWidth=2.5,y.stroke()}let c=Math.min(x,S)*n.zoom,l=+!b;if(u.showLines)for(let e of o){let t=e.stars.map(e=>D(s.get(e),n));for(let[n,r]of e.links){let e=t[n],i=t[r];(e.vis||i.vis)&&(y.lineCap=`round`,y.strokeStyle=`#0D0D0D`,y.lineWidth=5.5,y.beginPath(),y.moveTo(e.x,e.y),y.lineTo(i.x,i.y),y.stroke(),y.strokeStyle=`#FFFFFF`,y.lineWidth=2.5,y.beginPath(),y.moveTo(e.x,e.y),y.lineTo(i.x,i.y),y.stroke())}}for(let t of a){let r=D(t,n);if(!r.vis)continue;let i=!!t.name,a=i?7-t.mag*2.2:5.2-t.mag*1.15,o=Math.max(.9,a*(.75+n.zoom*.22)),s=i&&l?1+Math.sin(e/700+t.x*40)*.12:1;if(i){if(y.fillStyle=`#FFC700`,y.strokeStyle=`#0D0D0D`,y.lineWidth=2,y.beginPath(),y.arc(r.x,r.y,o*s,0,7),y.fill(),y.stroke(),t.mag<1.1){y.strokeStyle=`#FFFFFF`,y.lineWidth=2;let e=o*2.4;y.beginPath(),y.moveTo(r.x-e,r.y),y.lineTo(r.x+e,r.y),y.moveTo(r.x,r.y-e),y.lineTo(r.x,r.y+e),y.stroke()}}else y.fillStyle=t.mag<1.4?`#FFFFFF`:`rgba(255,255,255,0.75)`,y.beginPath(),y.arc(r.x,r.y,o,0,7),y.fill()}y.textAlign=`center`;for(let e of o){for(let t of e.stars){let e=s.get(t),r=D(e,n);r.vis&&(y.fillStyle=`#FF2D55`,y.strokeStyle=`#0D0D0D`,y.lineWidth=2,y.beginPath(),y.arc(r.x,r.y,3.4,0,7),y.fill(),y.stroke(),u.showNames&&n.zoom>.95&&e.name&&(y.font=`700 11px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`,y.lineWidth=3,y.strokeStyle=`#0D0D0D`,y.strokeText(e.name,r.x,r.y-12),y.fillStyle=`#FFC700`,y.fillText(e.name,r.x,r.y-12)))}if(u.showNames&&n.zoom<=1.6){let t=e.stars.reduce((e,t)=>e+D(s.get(t),n).x,0)/e.stars.length,r=e.stars.reduce((e,t)=>e+D(s.get(t),n).y,0)/e.stars.length;t>0&&t<x&&r>0&&r<S&&(y.font=`900 13px "Arial Black", Helvetica, Arial, sans-serif`,y.lineWidth=4,y.strokeStyle=`#0D0D0D`,y.strokeText(e.name.toUpperCase(),t,r+26),y.fillStyle=`#FFFFFF`,y.fillText(e.name.toUpperCase(),t,r+26))}}u.showWrens&&u.showLines&&(y.lineWidth=2.5,y.strokeStyle=`#0D0D0D`,y.lineCap=`round`,o.forEach((t,r)=>{let i=t.links[Math.floor(e/2600+r)%t.links.length],a=(e/2600+r*.37)%1,o=D(s.get(t.stars[i[0]]),n),c=D(s.get(t.stars[i[1]]),n);if(!o.vis||!c.vis)return;let l=o.x+(c.x-o.x)*a,u=o.y+(c.y-o.y)*a-8,d=b?0:Math.abs(Math.sin(e/180+r))*4;y.beginPath(),y.moveTo(l-6,u-d),y.lineTo(l,u-4-d),y.lineTo(l+6,u-d),y.stroke(),y.fillStyle=`#FF2D55`,y.beginPath(),y.arc(l,u-1-d,2.2,0,7),y.fill()})),u.showMeteors&&!b&&e-ae>(u.scopeId===`salt`?1400:3200)&&oe(e),O=O.filter(e=>(e.life+=t)<e.max);for(let e of O)e.x+=e.vx*t,e.y+=e.vy*t,y.strokeStyle=`rgba(255,199,0,${.9*(1-e.life/e.max)})`,y.lineWidth=3,y.lineCap=`round`,y.beginPath(),y.moveTo(e.x,e.y),y.lineTo(e.x-e.vx*.09,e.y-e.vy*.09),y.stroke();let d=i.find(e=>e.id===u.scopeId);y.save(),y.strokeStyle=`#FFC700`,y.lineWidth=3,y.setLineDash([12,8]),y.beginPath(),y.arc(x/2,S/2,d.fov*c,0,7),y.stroke(),y.setLineDash([]),y.strokeStyle=`#0D0D0D`,y.lineWidth=2;let f=d.fov*c;for(let[e,t]of[[0,-1],[0,1],[-1,0],[1,0]])y.beginPath(),y.moveTo(x/2+e*(f-12),S/2+t*(f-12)),y.lineTo(x/2+e*(f+12),S/2+t*(f+12)),y.stroke();if(y.restore(),u.selectedId){let t=s.get(u.selectedId);if(t){let r=D(t,n);if(r.vis){let t=14+(b?0:Math.sin(e/300)*3);y.strokeStyle=`#FF2D55`,y.lineWidth=4,y.beginPath(),y.arc(r.x,r.y,t,0,7),y.stroke(),y.strokeStyle=`#FFFFFF`,y.lineWidth=1.5,y.beginPath(),y.arc(r.x,r.y,t+4,0,7),y.stroke()}}}}var k=performance.now();function A(e){let t=Math.min(.05,(e-k)/1e3);k=e,E.clear(),ce(t),se(e,t),de(),requestAnimationFrame(A)}var j=null;function M(e,t=380){j={from:{...u.view},to:{...u.view,...e},t:0,dur:b?1:t}}function ce(e){if(!j)return;j.t+=e*1e3;let t=Math.min(1,j.t/j.dur),n=1-(1-t)**3,r=j.to.cx-j.from.cx;r>.5&&--r,r<-.5&&(r+=1),u.view.cx=((j.from.cx+r*n)%1+1)%1,u.view.cy=j.from.cy+(j.to.cy-j.from.cy)*n,u.view.zoom=j.from.zoom+(j.to.zoom-j.from.zoom)*n,t>=1&&(j=null)}var le=m(`#starPanel`),ue=m(`#live`),N=e=>e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]);function P(e,t=!0){if(u.selectedId=e,d(),F(),e&&t){let t=s.get(e);ue.textContent=`Selected ${t.name??`star `+t.id}, magnitude ${t.mag.toFixed(1)}`}}function F(){let e=u.selectedId?s.get(u.selectedId):null;if(!e){le.innerHTML=`
      <div class="flex items-center gap-3 flex-wrap">
        <span class="badge badge-yellow">No star selected</span>
        <p class="text-[13px] font-bold m-0">Click any star on the chart — or search its name — to inspect it.</p>
      </div>`;return}let t=e.constId?o.find(t=>t.id===e.constId):null;le.innerHTML=`
    <div class="flex items-start gap-3 flex-wrap justify-between">
      <div>
        <span class="badge badge-red">${t?N(t.name):`Field star`}</span>
        <h3 class="display mt-2" style="font-size:24px;">${N(e.name??`Star `+e.id)}</h3>
        <p class="mono text-[12px] font-bold mt-1" style="color:var(--ink-64);">mag ${e.mag.toFixed(1)} · sky ${e.x.toFixed(3)} / ${e.y.toFixed(3)}</p>
        <p class="text-[14px] font-bold mt-2">${N(e.lore??`An unnamed ember keeping its own counsel.`)}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-yellow" id="btnLogIt">Log it</button>
        <button class="btn" id="btnCenter">Center</button>
      </div>
    </div>`,m(`#btnLogIt`).addEventListener(`click`,()=>{u.log.some(t=>t.starId===e.id)?Z(`Already in the field log.`):(u.log.push({starId:e.id,name:e.name??`Star `+e.id,at:new Date().toISOString()}),d(),X(),Z(`Star logged to the field log.`))}),m(`#btnCenter`).addEventListener(`click`,()=>M({cx:e.x,cy:e.y}))}var I=!1,L=0,R=0,z=0;function B(e,t){let n=null,r=1/0;for(let i of a){let a=T(i,u.view);if(!a.vis)continue;let o=Math.hypot(a.x-e,a.y-t);o<(i.name?16:10)&&o<r&&(n=i,r=o)}return n}function V(e){let t=h.getBoundingClientRect();return{x:e.clientX-t.left,y:e.clientY-t.top}}h.addEventListener(`pointerdown`,e=>{I=!0,L=0,R=e.clientX,z=e.clientY,h.setPointerCapture(e.pointerId)}),h.addEventListener(`pointermove`,e=>{if(I){let t=e.clientX-R,n=e.clientY-z;R=e.clientX,z=e.clientY,L+=Math.abs(t)+Math.abs(n),j=null;let r=Math.min(x,S)*u.view.zoom,i=Math.cos(-u.view.rot),a=Math.sin(-u.view.rot),o=(t*i-n*a)/r,s=(t*a+n*i)/r;u.view.cx=((u.view.cx-o)%1+1)%1,u.view.cy=Math.min(1,Math.max(0,u.view.cy-s)),H()}else{let{x:t,y:n}=V(e),r=B(t,n);r?.name?(_.hidden=!1,_.textContent=`★ ${r.name}`,_.style.left=`${t}px`,_.style.top=`${n}px`,h.style.cursor=`pointer`):(H(),h.style.cursor=`crosshair`)}});function H(){_.hidden=!0}h.addEventListener(`pointerup`,e=>{if(I=!1,L<6){let{x:t,y:n}=V(e),r=B(t,n);P(r?r.id:null)}else d()}),h.addEventListener(`pointerleave`,()=>{I=!1,H()}),h.addEventListener(`wheel`,e=>{e.preventDefault(),j=null,u.view.zoom=Math.min(4,Math.max(.8,u.view.zoom*(e.deltaY>0?.92:1.09))),d(),G()},{passive:!1}),h.addEventListener(`keydown`,e=>{let t=.03/u.view.zoom;if(e.key===`ArrowLeft`)u.view.cx=((u.view.cx-t)%1+1)%1,e.preventDefault();else if(e.key===`ArrowRight`)u.view.cx=(u.view.cx+t)%1,e.preventDefault();else if(e.key===`ArrowUp`)u.view.cy=Math.max(0,u.view.cy-t),e.preventDefault();else if(e.key===`ArrowDown`)u.view.cy=Math.min(1,u.view.cy+t),e.preventDefault();else if(e.key===`+`||e.key===`=`)u.view.zoom=Math.min(4,u.view.zoom*1.1),e.preventDefault();else if(e.key===`-`||e.key===`_`)u.view.zoom=Math.max(.8,u.view.zoom/1.1),e.preventDefault();else if(e.key===`Enter`){let t=null,n=1e9;for(let e of a){let r=T(e,u.view);if(!r.vis)continue;let i=Math.hypot(r.x-x/2,r.y-S/2);i<n&&(n=i,t=e)}t&&P(t.id),e.preventDefault()}else return;j=null,d(),G()});var U=m(`#hour`),W=m(`#zoom`);function G(){U.value=String(u.hour),W.value=String(u.view.zoom),m(`#hourVal`).textContent=`${u.hour.toFixed(2)}h`,m(`#zoomVal`).textContent=`${u.view.zoom.toFixed(2)}×`;for(let[e,t]of[[`tLines`,`showLines`],[`tNames`,`showNames`],[`tWrens`,`showWrens`],[`tMeteors`,`showMeteors`]])m(`#`+e).setAttribute(`aria-checked`,String(u[t]));let e=i.find(e=>e.id===u.scopeId);m(`#scopeBadge`).textContent=`Scope-${e.no} · ${e.nickname.replace(/“|”/g,``)}`,document.querySelectorAll(`.scope-card`).forEach(e=>{e.classList.toggle(`active`,e.getAttribute(`data-scope`)===u.scopeId)})}function de(){m(`#viewReadout`).textContent=`sky ${u.view.cx.toFixed(2)} / ${u.view.cy.toFixed(2)} · ${u.view.zoom.toFixed(2)}× · rot ${(u.view.rot*180/Math.PI).toFixed(0)}°`}U.addEventListener(`input`,()=>{u.hour=Number(U.value),u.view.rot=u.hour/24*Math.PI*2,d(),G()}),W.addEventListener(`input`,()=>{j=null,u.view.zoom=Number(W.value),d(),G()});for(let[e,t]of[[`tLines`,`showLines`],[`tNames`,`showNames`],[`tWrens`,`showWrens`],[`tMeteors`,`showMeteors`]]){let n=m(`#`+e),r=()=>{u[t]=!u[t],d(),G()};n.addEventListener(`click`,r),n.addEventListener(`keydown`,e=>{(e.key===` `||e.key===`Enter`)&&(e.preventDefault(),r())})}var K=m(`#search`),q=m(`#results`),fe=a.filter(e=>e.name);K.addEventListener(`input`,()=>{let e=K.value.trim().toLowerCase();if(e.length<2){q.innerHTML=``;return}let t=fe.filter(t=>t.name.toLowerCase().includes(e)).slice(0,8);q.innerHTML=t.length?t.map(e=>`<button class="search-result mono text-left text-[12px] font-bold px-3 py-2" data-id="${e.id}" style="border:2px solid var(--ink);border-radius:4px;margin-top:6px;background:#fff;cursor:pointer;">★ ${e.name} <span style="color:var(--ink-64);">mag ${e.mag.toFixed(1)}</span></button>`).join(``):`<p class="mono text-[12px] font-bold mt-2" style="color:var(--ink-64);">No wrens by that name. Try “pip”.</p>`,q.querySelectorAll(`button`).forEach(e=>e.addEventListener(`click`,()=>{let t=s.get(e.getAttribute(`data-id`));M({cx:t.x,cy:t.y,zoom:Math.max(u.view.zoom,1.8)}),P(t.id),q.innerHTML=``,K.value=t.name}))});var pe=m(`#scopeGrid`);pe.innerHTML=i.map((e,t)=>`
  <article class="panel scope-card stagger-${t+1} p-5" data-scope="${e.id}" aria-label="${e.name}, ${e.nickname}, on ${e.dune}">
    <div class="flex items-center justify-between">
      <span class="badge ${t===0?`badge-red`:t===1?`badge-blue`:`badge-yellow`}">Scope-${e.no}</span>
      <span class="mono text-[11px] font-bold" style="color:var(--ink-64);">${e.dune}</span>
    </div>
    <h3 class="display mt-3" style="font-size:26px;">${e.name}<br/><span style="font-size:16px;">${e.nickname}</span></h3>
    <p class="text-[13px] font-bold mt-2">${e.desc}</p>
    <p class="mono text-[11px] font-bold mt-3" style="color:var(--ink-64);">target ${e.cx.toFixed(2)} / ${e.cy.toFixed(2)} · ${e.zoom.toFixed(2)}× · FOV ⌀ ${(e.fov*100).toFixed(0)}</p>
    <button class="btn ${t===0?`btn-red`:t===1?`btn-blue`:`btn-yellow`} mt-4 w-full">Slew here</button>
  </article>`).join(``);function me(e){let t=i.find(t=>t.id===e);u.scopeId=e,M({cx:t.cx,cy:t.cy,zoom:t.zoom},420),v.classList.remove(`go`),v.offsetWidth,b||v.classList.add(`go`),ue.textContent=`Slewed to ${t.name} ${t.nickname} on ${t.dune}`,d(),G()}pe.querySelectorAll(`.scope-card`).forEach(e=>{let t=e.getAttribute(`data-scope`);e.addEventListener(`click`,()=>me(t))}),m(`#constGrid`).innerHTML=o.map((e,t)=>`
  <article class="panel p-5 ${t%3==1?`panel-blue benday-light`:t%3==2?`panel-yellow`:``}">
    <span class="badge ${t%3==1?`badge-white`:`badge-red`}">${e.stars.length} stars</span>
    <h3 class="display mt-2 ${t%3==1?`text-white`:``}" style="font-size:22px;">${e.name}</h3>
    <p class="text-[13px] font-bold mt-1 ${t%3==1?`text-white`:``}">${e.lore}</p>
    <div class="flex gap-2 mt-3 flex-wrap">
      ${e.stars.slice(0,3).map(e=>`<button class="btn" style="font-size:11px;padding:6px 12px;" data-goto="${e}">Visit ★</button>`).join(``)}
    </div>
  </article>`).join(``),document.querySelectorAll(`[data-goto]`).forEach(e=>e.addEventListener(`click`,()=>{let t=s.get(e.getAttribute(`data-goto`));M({cx:t.x,cy:t.y,zoom:Math.max(u.view.zoom,2)}),P(t.id),document.querySelector(`#frame`).scrollIntoView({behavior:b?`auto`:`smooth`,block:`center`})}));var J=m(`#logList`),Y=m(`#notes`);function X(){J.innerHTML=u.log.length?u.log.map((e,t)=>`
      <div class="log-row flex items-center justify-between gap-2 py-1.5">
        <span class="mono text-[12px] font-bold">★ ${N(e.name)}</span>
        <button class="btn" style="font-size:10px;padding:4px 10px;" data-unlog="${t}" aria-label="Remove ${N(e.name)} from log">×</button>
      </div>`).join(``):`<p class="mono text-[12px] font-bold p-2" style="color:var(--ink-64);">Empty — log stars with “Log it”.</p>`,J.querySelectorAll(`[data-unlog]`).forEach(e=>e.addEventListener(`click`,()=>{u.log.splice(Number(e.getAttribute(`data-unlog`)),1),d(),X()}))}Y.addEventListener(`input`,()=>{u.notes=Y.value,d()});var he=m(`#exportMsg`);function Z(e){he.textContent=e}function Q(){return new Date().toISOString().slice(0,16).replace(`T`,` `)}function ge(e,t){let n=document.createElement(`a`);n.href=URL.createObjectURL(e),n.download=t,document.body.appendChild(n),n.click(),n.remove(),setTimeout(()=>URL.revokeObjectURL(n.href),4e3)}m(`#btnPng`).addEventListener(`click`,()=>{let e=i.find(e=>e.id===u.scopeId),t=document.createElement(`canvas`);t.width=h.width,t.height=h.height+Math.round(96*C);let n=t.getContext(`2d`);n.fillStyle=`#0D0D0D`,n.fillRect(0,0,t.width,t.height),n.fillStyle=`#FFC700`,n.font=`900 ${Math.round(34*C)}px "Arial Black", Arial, sans-serif`,n.fillText(`DUNE WREN OBSERVATORY`,24*C,46*C),n.fillStyle=`#FFFFFF`,n.font=`${Math.round(20*C)}px ui-monospace, Menlo, monospace`,n.fillText(`Scope-${e.no} ${e.nickname} · ${Q()} UTC · ${u.log.length} logged`,24*C,76*C),n.drawImage(h,0,Math.round(96*C)),t.toBlob(e=>{e?(ge(e,`dune-wren-night-${Date.now()}.png`),Z(`PNG poster exported (${t.width}×${t.height}px).`),ve()):Z(`PNG failed — try again.`)},`image/png`)});function _e(e){let t=i.find(t=>t.id===e.scopeId);return[`# ${e.name} — Dune Wren Observatory`,``,`- Date (UTC): ${e.at}`,`- Scope: Scope-${t.no} ${t.name} ${t.nickname} (${t.dune})`,`- Night hour: ${e.hour.toFixed(2)}h · chart ${e.view.cx.toFixed(3)} / ${e.view.cy.toFixed(3)} · ${e.view.zoom.toFixed(2)}x`,``,`## Logged stars (${e.log.length})`,...e.log.length?e.log.map(e=>{let t=s.get(e.starId);return`- ★ ${e.name} — mag ${t?t.mag.toFixed(1):`?`}${t?.lore?` — ${t.lore}`:``}`}):[`(none — the wrens kept their secrets)`],``,`## Notes`,``,e.notes.trim()||`(no notes)`,``,`*Charted by wrens from dune scopes.*`].join(`
`)}m(`#btnLog`).addEventListener(`click`,()=>{let e=_e({name:`Night ${Q()}`,at:`${Q()} UTC`,view:u.view,scopeId:u.scopeId,hour:u.hour,notes:u.notes,log:u.log});ge(new Blob([e],{type:`text/markdown`}),`dune-wren-log-${Date.now()}.md`),Z(`Observing log downloaded (${u.log.length} stars, notes included).`)}),m(`#btnLink`).addEventListener(`click`,async()=>{let e=btoa(JSON.stringify({cx:+u.view.cx.toFixed(4),cy:+u.view.cy.toFixed(4),zoom:+u.view.zoom.toFixed(3),rot:+u.view.rot.toFixed(3),scopeId:u.scopeId,selectedId:u.selectedId})),t=`${location.origin}${location.pathname}#n=${e}`;try{await navigator.clipboard.writeText(t),Z(`Night link copied — opening it restores this exact sky.`)}catch{prompt(`Copy this night link:`,t)}}),m(`#btnSave`).addEventListener(`click`,()=>{let e=p(),t={id:`n${Date.now()}`,name:`Night ${e.length+1} — Scope-${i.find(e=>e.id===u.scopeId).no}`,at:`${Q()} UTC`,view:{...u.view},scopeId:u.scopeId,hour:u.hour,notes:u.notes,log:[...u.log]};e.unshift(t),ee(e.slice(0,24)),$(),Z(`${t.name} saved in this browser.`)});function $(){let e=p(),t=m(`#nights`);t.innerHTML=e.length?e.map(e=>`
      <div class="panel p-4 bg-white">
        <span class="badge badge-blue">${N(e.name)}</span>
        <p class="mono text-[11px] font-bold mt-2" style="color:var(--ink-64);">${N(e.at)} · ${e.log.length} stars</p>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-yellow" style="font-size:11px;" data-load="${e.id}">Load</button>
          <button class="btn" style="font-size:11px;" data-del="${e.id}">Delete</button>
        </div>
      </div>`).join(``):`<p class="font-bold">No saved nights yet — tonight could be the first.</p>`,t.querySelectorAll(`[data-load]`).forEach(e=>e.addEventListener(`click`,()=>{let t=p().find(t=>t.id===e.getAttribute(`data-load`));t&&(u.view={...t.view},u.scopeId=t.scopeId,u.hour=t.hour,u.notes=typeof t.notes==`string`?t.notes.slice(0,4e3):``,u.log=t.log.filter(e=>e&&typeof e.starId==`string`&&typeof e.name==`string`),u.view.rot=u.hour/24*Math.PI*2,P(null,!1),Y.value=u.notes,d(),G(),X(),F(),M({}),Z(`${t.name} restored.`),document.querySelector(`#frame`).scrollIntoView({behavior:b?`auto`:`smooth`,block:`center`}))})),t.querySelectorAll(`[data-del]`).forEach(e=>e.addEventListener(`click`,()=>{ee(p().filter(t=>t.id!==e.getAttribute(`data-del`))),$()}))}function ve(){if(b)return;let e=[`#FF2D55`,`#FFC700`,`#2B44FF`,`#FFFFFF`];for(let t=0;t<26;t++){let n=document.createElement(`div`);n.className=`confetti-dot`;let r=6+Math.random()*8;n.style.cssText=`left:${40+Math.random()*20}%;top:70%;width:${r}px;height:${r}px;background:${e[t%4]};border-radius:${t%2?`50%`:`2px`};`,document.body.appendChild(n);let i=(Math.random()-.5)*400,a=-120-Math.random()*260;n.animate([{transform:`translate(0,0) rotate(0)`,opacity:1},{transform:`translate(${i}px,${a}px) rotate(${Math.random()*540}deg)`,opacity:0}],{duration:900+Math.random()*600,easing:`cubic-bezier(.2,.7,.3,1)`}).onfinish=()=>n.remove()}}setInterval(()=>{m(`#clock`).textContent=new Date().toISOString().slice(11,19)+` UTC`,m(`#starcount`).textContent=`${a.length} stars catalogued · 5 wren constellations`},1e3),m(`#clock`).textContent=new Date().toISOString().slice(11,19)+` UTC`;{let e=[...i.map(e=>`SCOPE-${e.no} ${e.nickname} · ${e.dune} · ONLINE`),`THE WRENS ARE CHARTING`,`5 CONSTELLATIONS IN THE CANON`,`${a.length} STARS TONIGHT`,`EXPORT THE NIGHT BELOW`].map(e=>`${e}<span class="dot">●</span>`).join(``);m(`#ticker`).innerHTML=e+e}te()||f(),u.view.rot=u.hour/24*Math.PI*2,Y.value=u.notes,G(),de(),F(),X(),$(),u.selectedId&&!s.has(u.selectedId)&&P(null,!1),requestAnimationFrame(A);