/* Territory Tile Canvas — dark fantasy grid painter. No deps, works from file:// */
(function(){
"use strict";
var COLS=32, ROWS=20, CELL=24;
var canvas=document.getElementById('map');
var ctx=canvas.getContext('2d');
var dpr=Math.max(1,window.devicePixelRatio||1);

// territories
var TERR=[
  {name:'Crimson Covenant', color:'#8a1c2a', light:'#c94a5a', sigil:'⚔'},
  {name:'Verdant Reach',    color:'#1f4d3a', light:'#4fa07a', sigil:'🌿'},
  {name:'Arcane Spire',     color:'#2b3a7a', light:'#6a7fd4', sigil:'✦'},
  {name:'Gilded Throne',    color:'#7a5a1f', light:'#d4af37', sigil:'♛'},
  {name:'Umbral Court',     color:'#4a2b7a', light:'#9a7fd4', sigil:'☾'},
  {name:'Frostbound',       color:'#1f6b6b', light:'#5fd4d4', sigil:'❄'}
];
var EMPTY=-1;
var grid=[]; // length COLS*ROWS, territory index or -1
for(var i=0;i<COLS*ROWS;i++) grid.push(EMPTY);

var state={
  tool:'brush', // brush|fill|erase
  territory:0,
  showGrid:true,
  zoom:1, panX:0, panY:0,
  painting:false,
  lastCell:-1,
  seed:Math.floor(Math.random()*999999)
};

// ---------- utils ----------
function idx(x,y){return y*COLS+x;}
function cellOf(px,py){
  // px,py in canvas CSS pixels
  var x=Math.floor((px-state.panX)/state.zoom/CELL);
  var y=Math.floor((py-state.panY)/state.zoom/CELL);
  if(x<0||y<0||x>=COLS||y>=ROWS) return -1;
  return idx(x,y);
}
function neighbors(i){
  var x=i%COLS, y=(i/COLS)|0, out=[];
  if(x>0)out.push(i-1); if(x<COLS-1)out.push(i+1);
  if(y>0)out.push(i-COLS); if(y<ROWS-1)out.push(i+ROWS);
  return out;
}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2000);}

// ---------- flood fill ----------
function floodFill(start, newTerr){
  if(start<0) return;
  var old=grid[start];
  if(old===newTerr) return;
  var stack=[start];
  while(stack.length){
    var c=stack.pop();
    if(grid[c]!==old) continue;
    grid[c]=newTerr;
    var ns=neighbors(c);
    for(var k=0;k<ns.length;k++) if(grid[ns[k]]===old) stack.push(ns[k]);
  }
}

// ---------- drawing ----------
function resizeCanvas(){
  var rect=canvas.getBoundingClientRect();
  var w=Math.max(320, Math.floor(rect.width));
  var h=Math.max(200, Math.floor(w*ROWS/COLS));
  canvas.style.height=h+'px';
  canvas.width=Math.floor(w*dpr);
  canvas.height=Math.floor(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
function colorFor(t){ return t===EMPTY ? null : TERR[t].color; }

function draw(ctx2, W, H){
  var c=ctx2||ctx;
  var w=W|| (canvas.width/dpr);
  var h=H|| (canvas.height/dpr);
  c.save();
  c.clearRect(0,0,w,h);
  // background stone
  var g=c.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'#1a1228'); g.addColorStop(1,'#0a0712');
  c.fillStyle=g; c.fillRect(0,0,w,h);
  // subtle noise dots
  c.fillStyle='rgba(212,175,55,.04)';
  for(var i=0;i<120;i++){ c.fillRect((i*97)%w, (i*131)%h, 1,1); }

  c.save();
  c.translate(state.panX,state.panY);
  c.scale(state.zoom,state.zoom);

  // cells
  for(var y=0;y<ROWS;y++){
    for(var x=0;x<COLS;x++){
      var t=grid[idx(x,y)];
      var px=x*CELL, py=y*CELL;
      if(t===EMPTY){
        c.fillStyle='#120d1c';
        c.fillRect(px+1,py+1,CELL-2,CELL-2);
      } else {
        var tr=TERR[t];
        var cg=c.createLinearGradient(px,py,px+CELL,py+CELL);
        cg.addColorStop(0,tr.light); cg.addColorStop(1,tr.color);
        c.fillStyle=cg;
        c.fillRect(px+1,py+1,CELL-2,CELL-2);
        // inner rune dot
        c.fillStyle='rgba(255,255,255,.18)';
        c.beginPath(); c.arc(px+CELL/2,py+CELL/2,2,0,Math.PI*2); c.fill();
      }
    }
  }

  // territory bloom borders (glowing edges where different)
  c.lineWidth=2;
  c.shadowBlur=8; c.shadowColor='rgba(212,175,55,.6)';
  for(var y=0;y<ROWS;y++){
    for(var x=0;x<COLS;x++){
      var t=grid[idx(x,y)];
      // right edge
      if(x<COLS-1){
        var tr=grid[idx(x+1,y)];
        if(tr!==t){
          c.strokeStyle = (t===EMPTY||tr===EMPTY) ? 'rgba(212,175,55,.35)' : blend(t,tr);
          c.beginPath();
          c.moveTo((x+1)*CELL, y*CELL+1);
          c.lineTo((x+1)*CELL, (y+1)*CELL-1);
          c.stroke();
        }
      }
      // bottom edge
      if(y<ROWS-1){
        var tb=grid[idx(x,y+1)];
        if(tb!==t){
          c.strokeStyle = (t===EMPTY||tb===EMPTY) ? 'rgba(212,175,55,.35)' : blend(t,tb);
          c.beginPath();
          c.moveTo(x*CELL+1, (y+1)*CELL);
          c.lineTo((x+1)*CELL-1, (y+1)*CELL);
          c.stroke();
        }
      }
    }
  }
  c.shadowBlur=0;

  // grid overlay
  if(state.showGrid){
    c.strokeStyle='rgba(212,175,55,.12)';
    c.lineWidth=1;
    c.beginPath();
    for(var x=0;x<=COLS;x++){ c.moveTo(x*CELL,0); c.lineTo(x*CELL,ROWS*CELL); }
    for(var y=0;y<=ROWS;y++){ c.moveTo(0,y*CELL); c.lineTo(COLS*CELL,y*CELL); }
    c.stroke();
  }

  c.restore();
  // vignette
  var vg=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.max(w,h)*.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
  c.fillStyle=vg; c.fillRect(0,0,w,h);

  c.restore();
}
function blend(a,b){
  // average of territory light colors as hex-ish; return gold-ish glow
  return 'rgba(212,175,55,.7)';
}

var raf=null;
function requestDraw(){ if(raf) return; raf=requestAnimationFrame(function(){raf=null;draw();}); }

// ---------- interactions ----------
function paintCell(i){
  if(i<0) return;
  state.lastCell=i;
  if(state.tool==='erase'){ grid[i]=EMPTY; }
  else if(state.tool==='brush'){ grid[i]=state.territory; }
  else if(state.tool==='fill'){ floodFill(i,state.territory); }
  state.lastCell=i;
  updateHudCell(i);
  requestDraw();
  save();
}
function updateHudCell(i){
  var x=i%COLS, y=(i/COLS)|0;
  document.getElementById('coords').textContent='cell '+x+','+y+' · '+ (grid[i]===EMPTY?'wilderness':TERR[grid[i]].name);
}

var isPanning=false, panStart=null;
canvas.addEventListener('pointerdown',function(e){
  canvas.setPointerCapture(e.pointerId);
  var rect=canvas.getBoundingClientRect();
  var cx=e.clientX-rect.left, cy=e.clientY-rect.top;
  // scale to css size
  var scaleX= (canvas.width/dpr)/rect.width;
  // canvas internal css size
  var cssW=canvas.width/dpr, cssH=canvas.height/dpr;
  var px=cx*(cssW/rect.width);
  var py=cy*(cssH/rect.height);
  var i=cellOf(px,py);
  // if space/alt or middle button => pan
  if(e.button===1 || e.altKey){
    isPanning=true; panStart={x:e.clientX,y:e.clientY,px:state.panX,py:state.panY}; return;
  }
  if(i<0){ isPanning=true; panStart={x:e.clientX,y:e.clientY,px:state.panX,py:state.panY}; return; }
  state.painting=true;
  state.lastCell=-1;
  if(state.tool==='fill'){ paintCell(i); state.painting=false; }
  else { paintCell(i); }
});
canvas.addEventListener('pointermove',function(e){
  if(isPanning && panStart){
    state.panX=panStart.px+(e.clientX-panStart.x);
    state.panY=panStart.py+(e.clientY-panStart.y);
    requestDraw(); return;
  }
  if(!state.painting) return;
  var rect=canvas.getBoundingClientRect();
  var cssW=canvas.width/dpr, cssH=canvas.height/dpr;
  var px=(e.clientX-rect.left)*(cssW/rect.width);
  var py=(e.clientY-rect.top)*(cssH/rect.height);
  var i=cellOf(px,py);
  if(i>=0 && i!==state.lastCell){
    paintCell(i);
  }
});
canvas.addEventListener('pointerup',function(e){ state.painting=false; isPanning=false; panStart=null; });
canvas.addEventListener('pointercancel',function(){ state.painting=false; isPanning=false; panStart=null; });

// wheel zoom (scroll reactivity)
canvas.addEventListener('wheel',function(e){
  e.preventDefault();
  var rect=canvas.getBoundingClientRect();
  var cssW=canvas.width/dpr, cssH=canvas.height/dpr;
  var px=(e.clientX-rect.left)*(cssW/rect.width);
  var py=(e.clientY-rect.top)*(cssH/rect.height);
  var factor = e.deltaY<0 ? 1.12 : 1/1.12;
  var newZoom=Math.min(4,Math.max(0.5,state.zoom*factor));
  // zoom toward pointer
  state.panX = px - (px-state.panX)*(newZoom/state.zoom);
  state.panY = py - (py-state.panY)*(newZoom/state.zoom);
  state.zoom=newZoom;
  requestDraw();
  document.getElementById('status').textContent='zoom '+state.zoom.toFixed(2)+'×';
}, {passive:false});

// window scroll reactivity
window.addEventListener('scroll',function(){
  var y=window.scrollY||0;
  document.body.classList.toggle('scrolled', y>40);
  // subtle parallax on bg via css var
  document.documentElement.style.setProperty('--scroll', (y/400).toFixed(3));
}, {passive:true});

// ---------- palette ----------
function buildPalette(){
  var p=document.getElementById('palette');
  TERR.forEach(function(t,i){
    var b=document.createElement('button');
    b.className='swatch'+(i===state.territory?' active':'');
    b.style.background='linear-gradient(145deg,'+t.light+','+t.color+')';
    b.title=t.name;
    b.innerHTML='<span class="sigil">'+t.sigil+'</span>';
    b.addEventListener('click',function(){
      state.territory=i;
      if(state.tool==='erase') setTool('brush');
      document.querySelectorAll('.swatch').forEach(function(s){s.classList.remove('active');});
      b.classList.add('active');
      document.getElementById('status').textContent=t.name;
    });
    p.appendChild(b);
  });
  // legend
  var ul=document.getElementById('legend');
  TERR.forEach(function(t){
    var li=document.createElement('li');
    li.innerHTML='<i style="background:'+t.color+'"></i>'+t.name;
    ul.appendChild(li);
  });
}
function setTool(t){
  state.tool=t;
  document.querySelectorAll('.tool').forEach(function(b){ b.classList.toggle('active', b.dataset.tool===t); });
  canvas.style.cursor = t==='fill' ? 'cell' : (t==='erase'?'not-allowed':'crosshair');
  document.getElementById('status').textContent = t;
}

// ---------- toolbar wiring ----------
function wire(){
  document.querySelectorAll('.tool').forEach(function(b){
    b.addEventListener('click',function(){ setTool(b.dataset.tool); });
  });
  document.getElementById('gridBtn').addEventListener('click',function(){
    state.showGrid=!state.showGrid;
    this.setAttribute('aria-pressed',state.showGrid);
    this.textContent = state.showGrid ? '▦ grid' : '  grid';
    requestDraw();
  });
  document.getElementById('clearBtn').addEventListener('click',function(){
    if(!confirm('Clear the whole map?')) return;
    for(var i=0;i<grid.length;i++) grid[i]=EMPTY;
    requestDraw(); save(); toast('map cleared');
  });
  document.getElementById('resetViewBtn').addEventListener('click',function(){
    state.zoom=1; state.panX=0; state.panY=0; requestDraw();
  });
  document.getElementById('exportBtn').addEventListener('click',exportPNG);
  window.addEventListener('resize',resizeCanvas);
}

// ---------- persistence ----------
function save(){ try{ localStorage.setItem('ttc-grid', JSON.stringify(grid)); localStorage.setItem('ttc-state', JSON.stringify({showGrid:state.showGrid,territory:state.territory,tool:state.tool})); }catch(e){} }
function load(){ try{
  var g=localStorage.getItem('ttc-grid'); if(g){ var a=JSON.parse(g); if(Array.isArray(a)&&a.length===grid.length) for(var i=0;i<grid.length;i++) grid[i]=a[i]; }
  var s=localStorage.getItem('ttc-state'); if(s){ var o=JSON.parse(s); if(typeof o.showGrid==='boolean') state.showGrid=o.showGrid; if(typeof o.territory==='number') state.territory=o.territory; if(o.tool) state.tool=o.tool; }
}catch(e){} }

// ---------- export ----------
function exportPNG(){
  var scale=3;
  var W=COLS*CELL*scale, H=ROWS*CELL*scale;
  var off=document.createElement('canvas'); off.width=W; off.height=H;
  var oc=off.getContext('2d');
  // temporarily scale state
  var prevZoom=state.zoom, prevPanX=state.panX, prevPanY=state.panY;
  state.zoom=scale; state.panX=0; state.panY=0;
  draw(oc,W,H);
  state.zoom=prevZoom; state.panX=prevPanX; state.panY=prevPanY;
  requestDraw();
  off.toBlob(function(blob){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='territory-tile-canvas.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
    toast('map exported');
  },'image/png');
}

// ---------- init ----------
function init(){
  load();
  buildPalette();
  wire();
  setTool(state.tool);
  // apply showGrid button
  var gb=document.getElementById('gridBtn');
  gb.setAttribute('aria-pressed',state.showGrid);
  gb.textContent = state.showGrid ? '▦ grid' : '  grid';
  resizeCanvas();
  requestDraw();
  // status
  document.getElementById('status').textContent=TERR[state.territory].name;
  console.log('territory-tile-canvas ready');
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
