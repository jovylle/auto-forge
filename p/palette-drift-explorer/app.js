// Palette Drift Explorer
const $ = (s) => document.querySelector(s);
const canvas = $("#drift");
const ctx = canvas.getContext("2d");

let audioCtx = null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return audioCtx; }
function tone(freq=440, dur=0.12, type="sine", gain=0.06){
  const ac = ensureAudio(); if(!ac) return;
  if(ac.state==="suspended") ac.resume();
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime+dur+0.02);
}
function chime(){ tone(660,.1,"triangle",.05); setTimeout(()=>tone(880,.12,"triangle",.04),90); }

// state
const state = { hue:260, speed:1, count:5, paused:false, drift:0 };

const hueEl = $("#hue"), speedEl = $("#speed"), countEl = $("#count");
const hueVal = $("#hueVal"), speedVal = $("#speedVal"), countVal = $("#countVal");
const pauseBtn = $("#pauseBtn"), exportBtn = $("#exportBtn");
const swatchesEl = $("#swatches");
const toast = $("#toast");
const fgSel = $("#fgSel"), bgSel = $("#bgSel");
const ccPreview = $("#ccPreview"), ccRatio = $("#ccRatio");
const ccAA = $("#ccAA"), ccAAA = $("#ccAAA"), ccLarge = $("#ccLarge");
const driftLabel = $("#driftLabel");

function hslToHex(h,s,l){
  s/=100; l/=100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l,1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
  const toHex = x => Math.round(x*255).toString(16).padStart(2,"0");
  return "#"+toHex(f(0))+toHex(f(8))+toHex(f(4));
}
function luminance(hex){
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const lin = c => c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
  return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
}
function contrastRatio(a,b){
  const l1=luminance(a), l2=luminance(b);
  const hi=Math.max(l1,l2), lo=Math.min(l1,l2);
  return (hi+0.05)/(lo+0.05);
}

function genPalette(){
  const out = [];
  const h = state.hue;
  const n = state.count;
  for(let i=0;i<n;i++){
    const frac = i/(n-1||1);
    // spread hues along a drifting arc
    const hue = (h + frac*220 + state.drift*0.4) % 360;
    const sat = 55 + frac*25;
    const lig = 14 + frac*46;
    out.push(hslToHex(hue, sat, lig));
  }
  return out;
}

let palette = [];
function renderSwatches(){
  palette = genPalette();
  swatchesEl.innerHTML = "";
  palette.forEach((hex, i) => {
    const el = document.createElement("div");
    el.className = "swatch";
    el.style.background = hex;
    el.innerHTML = `<span class="hex">${hex}</span><span class="name">swatch ${i+1}</span>`;
    el.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(hex); } catch(e){
        const ta = document.createElement("textarea"); ta.value=hex; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      showToast(`Copied ${hex}`);
      chime();
    });
    swatchesEl.appendChild(el);
  });
  // update selects
  const opts = palette.map((hex,i)=>`<option value="${i}">${i+1} ${hex}</option>`).join("");
  const prevFg = fgSel.value, prevBg = bgSel.value;
  fgSel.innerHTML = opts; bgSel.innerHTML = opts;
  if(prevFg) fgSel.value = prevFg; else fgSel.value = "2";
  if(prevBg) bgSel.value = prevBg; else bgSel.value = "0";
  updateContrast();
}

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.remove("show"), 1600);
}

function updateContrast(){
  const fg = palette[+fgSel.value];
  const bg = palette[+bgSel.value];
  if(!fg||!bg) return;
  ccPreview.style.color = fg;
  ccPreview.style.background = bg;
  const r = contrastRatio(fg,bg);
  ccRatio.textContent = r.toFixed(2)+":1";
  const setBadge = (el, pass) => { el.classList.toggle("pass",pass); el.classList.toggle("fail",!pass); };
  setBadge(ccAA, r>=4.5);
  setBadge(ccAAA, r>=7);
  setBadge(ccLarge, r>=3);
}

fgSel.addEventListener("change", ()=>{ updateContrast(); tone(520,.08); });
bgSel.addEventListener("change", ()=>{ updateContrast(); tone(420,.08); });

// controls
hueEl.addEventListener("input", e => {
  state.hue = +e.target.value;
  hueVal.textContent = state.hue+"°";
  renderSwatches();
  tone(300 + state.hue*0.8, .06);
});
speedEl.addEventListener("input", e => {
  state.speed = +e.target.value/100;
  speedVal.textContent = state.speed.toFixed(1)+"×";
  tone(440, .06);
});
countEl.addEventListener("input", e => {
  state.count = +e.target.value;
  countVal.textContent = state.count;
  renderSwatches();
  tone(560, .06);
});
pauseBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Resume Drift" : "Pause Drift";
  tone(state.paused?220:660,.1);
});
exportBtn.addEventListener("click", () => { exportPNG(); tone(780,.12); setTimeout(()=>tone(990,.12),110); });

// drift animation
let last = performance.now();
function frame(now){
  const dt = (now-last)/1000; last = now;
  if(!state.paused){
    state.drift += dt * 30 * state.speed;
    driftLabel.textContent = "DRIFT · "+Math.round(state.drift%360)+"°";
  }
  // redraw canvas gradient
  const w = canvas.width, h = canvas.height;
  const grad = ctx.createLinearGradient(0,0,w,h);
  // use palette colors with drift
  const p = genPalette();
  p.forEach((c,i)=> grad.addColorStop(i/(p.length-1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
  // drifting overlay
  ctx.globalCompositeOperation = "lighter";
  const t = state.drift/60;
  for(let i=0;i<3;i++){
    const x = (Math.sin(t+i*2)*0.5+0.5)*w;
    const y = (Math.cos(t*0.7+i)*0.5+0.5)*h;
    const r = 120 + Math.sin(t+i)*40;
    const rg = ctx.createRadialGradient(x,y,0,x,y,r);
    rg.addColorStop(0, p[i % p.length]+"55");
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.fillRect(0,0,w,h);
  }
  ctx.globalCompositeOperation = "source-over";
  // subtle noise shimmer
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// re-render swatches periodically to reflect drift? Keep palette stable unless hue changes; 
// but gradient drifts. Swatches update on control. For "live palette slider" enough.
// However to show drift in swatches, update every 2s lightly:
setInterval(()=>{ if(!state.paused){ renderSwatches(); } }, 2000);

function exportPNG(){
  const off = document.createElement("canvas");
  off.width = 1000; off.height = 600;
  const c = off.getContext("2d");
  // background
  const bg = c.createLinearGradient(0,0,off.width,off.height);
  const p = genPalette();
  p.forEach((col,i)=> bg.addColorStop(i/(p.length-1), col));
  c.fillStyle = bg; c.fillRect(0,0,off.width,off.height);
  // overlay title
  c.fillStyle = "rgba(7,4,15,.55)";
  c.fillRect(0,0,off.width,off.height);
  c.fillStyle = "#f0d27a";
  c.font = "bold 28px Cinzel, serif";
  c.fillText("Palette Drift Explorer", 40, 50);
  c.fillStyle = "#9a8fb8";
  c.font = "16px Crimson Text, serif";
  c.fillText("base hue "+state.hue+"°  ·  drift "+Math.round(state.drift%360)+"°", 40, 80);
  // swatches
  const sw = 120, sh = 120, gap = 24;
  const total = p.length*sw + (p.length-1)*gap;
  let x = (off.width-total)/2;
  const y = 160;
  p.forEach((col,i) => {
    c.fillStyle = col;
    c.fillRect(x,y,sw,sh);
    c.strokeStyle = "rgba(201,162,39,.4)";
    c.strokeRect(x,y,sw,sh);
    c.fillStyle = "rgba(7,4,15,.7)";
    c.fillRect(x, y+sh-34, sw, 34);
    c.fillStyle = "#f0d27a";
    c.font = "bold 13px Cinzel, serif";
    c.textAlign = "center";
    c.fillText(col.toUpperCase(), x+sw/2, y+sh-12);
    c.textAlign = "start";
    x += sw+gap;
  });
  // contrast info
  const fg = palette[+fgSel.value], bgc = palette[+bgSel.value];
  const r = contrastRatio(fg,bgc).toFixed(2);
  c.fillStyle = "#e9e2f5";
  c.font = "18px Crimson Text, serif";
  c.fillText(`Contrast ${fg} on ${bgc}: ${r}:1`, 40, 360);
  // download
  const url = off.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = "palette-drift.png";
  document.body.appendChild(a); a.click(); a.remove();
  showToast("Exported PNG");
}

// init
renderSwatches();
// initial tone on load
setTimeout(()=>tone(440,.08), 400);

// sound on any interaction (global) — subtle
document.addEventListener("pointerdown", (e) => {
  if(e.target && e.target.closest && e.target.closest("input,button,select,.swatch")) return;
  tone(330,.05);
}, {passive:true});
