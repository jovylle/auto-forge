import { useEffect, useMemo, useRef, useState } from "react"

type Habit = {
  id: string
  name: string
  color: string
  createdAt: string
  dates: string[] // YYYY-MM-DD
}

const STORAGE_KEY = "habit-constellation-v2"
const COLORS = ["#7dd3fc","#f9a8d4","#fde68a","#86efac","#c4b5fd","#fca5a5","#5eead4","#facc15"]
const PIXEL_FONT = "'ui-monospace','Cascadia Code','Consolas',monospace"

function todayStr(d = new Date()) { return d.toISOString().slice(0,10) }
function fmtDate(s:string){ const d=new Date(s+"T12:00:00"); return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}) }
function hash(s:string){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h }
function streakOf(dates: string[]){
  const set = new Set(dates)
  let c=0
  const cur = new Date()
  // walk backwards from today
  for(let i=0;i<365;i++){
    const ds = cur.toISOString().slice(0,10)
    if(set.has(ds)){ c++; cur.setDate(cur.getDate()-1) } else break
  }
  return c
}
function totalOf(dates:string[]){ return dates.length }

function load():Habit[]{
  try{ const r=localStorage.getItem(STORAGE_KEY); if(r) return JSON.parse(r) }catch{}
  return [
    { id:"h1", name:"Morning Pages", color: COLORS[0], createdAt: todayStr(), dates: [todayStr(new Date(Date.now()-86400000)), todayStr()] },
    { id:"h2", name:"Run 2k", color: COLORS[1], createdAt: todayStr(), dates: [todayStr()] },
    { id:"h3", name:"Read 20m", color: COLORS[3], createdAt: todayStr(), dates: [] },
  ]
}
function save(h:Habit[]){ localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) }

export default function App(){
  const [habits, setHabits] = useState<Habit[]>(()=> load())
  const [name, setName] = useState("")
  const [filter, setFilter] = useState<"all"|"active">("all")
  const [chosenColor, setChosenColor] = useState(COLORS[0])
  const [toast, setToast] = useState<string|null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=> save(habits), [habits])
  useEffect(()=>{
    if(!toast) return
    const t=setTimeout(()=>setToast(null),2200)
    return ()=>clearTimeout(t)
  },[toast])

  const today = todayStr()
  const stats = useMemo(()=>{
    const total = habits.length
    const doneToday = habits.filter(h=>h.dates.includes(today)).length
    const best = Math.max(0, ...habits.map(h=>streakOf(h.dates)))
    const totalChecks = habits.reduce((a,h)=>a+h.dates.length,0)
    return { total, doneToday, best, totalChecks }
  },[habits, today])

  function addHabit(){
    const n=name.trim()
    if(!n) return
    if(habits.some(h=>h.name.toLowerCase()===n.toLowerCase())){ setToast("Already tracked"); return }
    const h:Habit={ id: Math.random().toString(36).slice(2,8), name:n, color: chosenColor, createdAt: today, dates:[]}
    setHabits(v=>[h, ...v])
    setName("")
    setToast(`★ ${n} added to sky`)
  }
  function toggleToday(id:string){
    setHabits(v=>v.map(h=>{
      if(h.id!==id) return h
      const has = h.dates.includes(today)
      return { ...h, dates: has ? h.dates.filter(d=>d!==today) : [...h.dates, today].sort()}
    }))
  }
  function removeHabit(id:string){ setHabits(v=>v.filter(h=>h.id!==id)) }
  function bumpFakeStreak(id:string){
    // add yesterday + today for demo
    const y = new Date(); y.setDate(y.getDate()-1)
    const ys = y.toISOString().slice(0,10)
    setHabits(v=>v.map(h=>{
      if(h.id!==id) return h
      const s=new Set(h.dates); s.add(today); s.add(ys); return {...h, dates:[...s].sort()}
    }))
  }

  // star positions in polar coords hashed by name
  const stars = useMemo(()=>{
    const cx=200, cy=200
    return habits.map((h,i)=>{
      const ha=hash(h.name+ h.id)
      const angle = (ha % 360) * Math.PI/180 + (i*0.13)
      const radius = 55 + (ha % 95) // 55..150
      const x = cx + Math.cos(angle)*radius
      const y = cy + Math.sin(angle)*radius
      const stk = streakOf(h.dates)
      const tot = totalOf(h.dates)
      const size = 6 + Math.min(10, tot*0.9 + stk*0.6)
      const glow = Math.min(22, 4 + stk*3.2)
      const alpha = 0.55 + Math.min(0.45, stk*0.1 + (h.dates.includes(today)?0.2:0))
      return { h, x,y,size,glow,alpha, angle, radius, stk, tot }
    })
  },[habits, today])

  // draw background starfield on canvas once
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return
    const ctx=c.getContext("2d")!; if(!ctx) return
    const dpr = window.devicePixelRatio||1
    const w=400, h=400
    c.width=w*dpr; c.height=h*dpr; c.style.width=w+"px"; c.style.height=h+"px"
    ctx.scale(dpr,dpr)
    ctx.clearRect(0,0,w,h)
    // bg
    const g=ctx.createRadialGradient(200,200,60,200,200,280)
    g.addColorStop(0,"#111936"); g.addColorStop(1,"#060912")
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h)
    // grid pixels
    ctx.strokeStyle="rgba(124,140,255,0.07)"; ctx.lineWidth=1
    for(let x=0;x<w;x+=20){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
    for(let y=0;y<h;y+=20){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
    // random field stars
    for(let i=0;i<140;i++){
      const x=Math.random()*w, y=Math.random()*h, r=Math.random()*1.1
      ctx.fillStyle=`rgba(255,255,240,${0.15+Math.random()*0.55})`
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(r), Math.ceil(r))
    }
    // crosshair
    ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.setLineDash([3,6])
    ctx.beginPath(); ctx.moveTo(200,0); ctx.lineTo(200,400); ctx.moveTo(0,200); ctx.lineTo(400,200); ctx.stroke()
    ctx.setLineDash([])
  },[habits.length])

  const filtered = filter==="active" ? habits.filter(h=>!h.dates.includes(today)) : habits

  return (
    <div className="min-h-screen bg-[#060912] text-[#e6e8f0] selection:bg-[#7dd3fc]/30" style={{fontFamily: PIXEL_FONT}}>
      {/* header */}
      <header className="sticky top-0 z-30 backdrop-blur border-b border-white/10 bg-[#060912]/80">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 grid place-items-center bg-white text-black font-black text-[11px] tracking-widest border-2 border-white shadow-[4px_4px_0_#7dd3fc]">★</div>
            <div>
              <h1 className="font-black tracking-[0.12em] text-[13px] sm:text-[15px]">HABIT CONSTELLATION</h1>
              <p className="text-[11px] tracking-widest opacity-60">YOUR HABITS AS A STAR MAP — PIXEL-ART EDITION</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] tracking-widest opacity-50">SCORE</span>
            <span className="px-2 py-1 bg-white text-black font-black text-xs border-2 border-black shadow-[3px_3px_0_#86efac]">{stats.doneToday}/{stats.total} TODAY</span>
            <span className="px-2 py-1 bg-[#7dd3fc] text-black font-bold text-xs border-2 border-black">BEST {stats.best}🔥</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        {/* left: sky */}
        <section className="order-1">
          <div className="bg-[#0b1020] border-2 border-white/15 shadow-[6px_6px_0_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-white text-black border-b-2 border-black">
              <span className="font-black tracking-widest text-[11px]">◈ STAR MAP — {habits.length} BODIES</span>
              <span className="text-[10px] tracking-widest opacity-60 hidden sm:inline">PIXEL SCALE 400×400 — STREAK = BRIGHTNESS</span>
            </div>
            <div className="relative bg-[#080c1a] p-3 sm:p-4 flex justify-center">
              <div className="relative w-[400px] max-w-full aspect-square border-2 border-white/10 bg-black overflow-hidden shadow-[inset_0_0_40px_rgba(124,211,252,0.15)]">
                <canvas ref={canvasRef} width={400} height={400} className="absolute inset-0 w-full h-full" />
                <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
                  {/* constellation lines sorted by streak desc */}
                  {(()=>{
                    const ordered=[...stars].sort((a,b)=>b.stk-a.stk)
                    const pts=ordered.map(s=> [s.x,s.y] as const)
                    return pts.length>1 ? (
                      <g>
                        {/* faint all-connect */}
                        {ordered.slice(0,Math.min(8,ordered.length)).map((s,i)=>{
                          const n=ordered[(i+1)%ordered.length]
                          if(!n) return null
                          return <line key={s.h.id+"-ln"} x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke="rgba(124,211,252,0.18)" strokeWidth={0.9} strokeDasharray={s.stk>0 && n.stk>0 ? "0" : "2 4"} />
                        })}
                        {/* bright path for streaking habits */}
                        {ordered.filter(s=>s.stk>=2).slice(0,5).map((s,i,arr)=>{
                          const n=arr[i+1]; if(!n) return null
                          return <line key={s.h.id+"-b"} x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke={s.h.color} strokeOpacity={0.55} strokeWidth={1.4} />
                        })}
                      </g>
                    ) : null
                  })()}
                  {/* stars */}
                  {stars.map(s=>(
                    <g key={s.h.id}>
                      {/* glow */}
                      <rect x={s.x - s.glow/2} y={s.y - s.glow/2} width={s.glow} height={s.glow}
                        fill={s.h.color} opacity={0.12 + s.stk*0.04} rx={1}
                        style={{filter:"blur(6px)"}} />
                      {/* core pixel star */}
                      <g style={{filter: s.stk>=3 ? `drop-shadow(0 0 ${4+s.stk}px ${s.h.color})` : undefined}}>
                        {/* pixel cross */}
                        <rect x={s.x - s.size/2} y={s.y - 1} width={s.size} height={2} fill={s.h.color} opacity={s.alpha} />
                        <rect x={s.x - 1} y={s.y - s.size/2} width={2} height={s.size} fill={s.h.color} opacity={s.alpha} />
                        <rect x={s.x - s.size/3} y={s.y - s.size/3} width={s.size*0.66} height={s.size*0.66} fill="white" opacity={0.92} style={{mixBlendMode:"screen"}} />
                        {/* center */}
                        <rect x={s.x-1.5} y={s.y-1.5} width={3} height={3} fill="white" />
                      </g>
                      {/* label */}
                      <text x={s.x} y={s.y + s.size/2 + 12} textAnchor="middle"
                        fontFamily={PIXEL_FONT} fontSize={7.5} fontWeight={900}
                        fill="white" opacity={0.9}
                        style={{paintOrder:"stroke", stroke:"#000", strokeWidth:3, strokeLinejoin:"round"}}>
                        {s.h.name.slice(0,14).toUpperCase()} {s.stk>0?`·${s.stk}🔥`:""}
                      </text>
                    </g>
                  ))}
                  {/* center nav */}
                  <g>
                    <circle cx={200} cy={200} r={2.5} fill="white" opacity={0.9}/>
                    <circle cx={200} cy={200} r={14} fill="none" stroke="white" opacity={0.12} strokeDasharray="2 3"/>
                  </g>
                </svg>
                {/* pixel scanline overlay */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{background:"repeating-linear-gradient(0deg, transparent 0 2px, white 2px 3px)"}} />
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x-2 divide-black border-t-2 border-black text-center">
              <div className="bg-white text-black py-2"><div className="text-[10px] tracking-widest opacity-60">TOTAL CHECKS</div><div className="font-black">{stats.totalChecks}</div></div>
              <div className="bg-[#86efac] text-black py-2"><div className="text-[10px] tracking-widest opacity-60">COMPLETION</div><div className="font-black">{stats.total?Math.round(stats.doneToday/stats.total*100):0}%</div></div>
              <div className="bg-[#7dd3fc] text-black py-2"><div className="text-[10px] tracking-widest opacity-60">LIVE STARS</div><div className="font-black">{stars.filter(s=>s.stk>0).length} / {stars.length}</div></div>
            </div>
            <p className="px-3 py-2 text-[11px] leading-relaxed opacity-60 border-t border-white/10">
              Tip: check a habit today and its star ignites. Keep a 3-day streak for glow, 7-day for pulse, 30-day for supernova. Constellation lines connect streaking habits — your sky tells your momentum.
            </p>
          </div>

          {/* legend */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {[
              ["■ 0 streak", "opacity-40"],
              ["◆ 1–2 streak", "text-[#7dd3fc]"],
              ["✦ 3–6 GLOW", "text-[#fde68a]"],
              ["★ 7+ PULSE", "text-[#f9a8d4] animate-pulse"],
            ].map(([label, cls])=>(
              <div key={label} className={`border border-white/10 bg-white/5 px-2 py-1.5 font-bold tracking-widest text-center ${cls}`}>{label}</div>
            ))}
          </div>
        </section>

        {/* right: control panel */}
        <section className="order-2 space-y-4">
          {/* add habit */}
          <div className="bg-white text-black border-2 border-black shadow-[6px_6px_0_#0b1020]">
            <div className="px-3 py-2 bg-black text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-[#7dd3fc] animate-pulse" />
              <span className="font-black tracking-widest text-[11px]">ADD STAR — HABIT INPUT</span>
              <span className="ml-auto text-[10px] opacity-60">{habits.length}/12</span>
            </div>
            <div className="p-3 space-y-3">
              <div className="flex gap-2">
                <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addHabit()}
                  placeholder="e.g. Meditate 10m"
                  className="flex-1 border-2 border-black px-3 py-2.5 text-sm font-bold placeholder:opacity-40 focus:outline-none focus:shadow-[3px_3px_0_#7dd3fc]"
                />
                <button onClick={addHabit} className="px-4 py-2 bg-black text-white font-black text-xs tracking-widest border-2 border-black hover:bg-[#7dd3fc] hover:text-black active:translate-y-px transition">ADD</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] tracking-widest opacity-60 mr-1">COLOR</span>
                {COLORS.map(c=>(
                  <button key={c} onClick={()=>setChosenColor(c)} aria-label={c}
                    className={`w-7 h-7 border-2 ${chosenColor===c?"border-black shadow-[2px_2px_0_#000] scale-110":"border-black/20"}`}
                    style={{background:c}} />
                ))}
                <button onClick={()=>{ if(confirm("Reset all habits?")){ setHabits([]); localStorage.removeItem(STORAGE_KEY)}}}
                  className="ml-auto text-[10px] tracking-widest underline opacity-60 hover:opacity-100">RESET SKY</button>
              </div>
            </div>
          </div>

          {/* filter + list */}
          <div className="bg-[#0b1020] border-2 border-white/15 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <span className="font-black tracking-widest text-[11px] text-white">HABITS</span>
              <div className="ml-auto flex gap-1">
                {(["all","active"] as const).map(k=>(
                  <button key={k} onClick={()=>setFilter(k)}
                    className={`px-2 py-1 text-[10px] font-black tracking-widest border ${filter===k?"bg-white text-black border-white":"bg-transparent text-white/60 border-white/20 hover:border-white/40"}`}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-[420px] overflow-auto">
              {filtered.length===0 ? (
                <div className="p-6 text-center">
                  <div className="text-2xl mb-2">☆</div>
                  <div className="text-xs tracking-widest opacity-60">{filter==="active"?"All caught up — every star lit today.":"No stars yet — add your first habit above."}</div>
                </div>
              ) : filtered.map(h=>{
                const stk=streakOf(h.dates)
                const doneToday=h.dates.includes(today)
                const tot=totalOf(h.dates)
                return (
                  <div key={h.id} className={`p-3 flex gap-3 items-center ${doneToday?"bg-white/[0.06]":""}`}>
                    <button onClick={()=>toggleToday(h.id)}
                      className={`w-8 h-8 border-2 grid place-items-center font-black text-[11px] shrink-0 ${doneToday?"bg-[#86efac] border-black text-black shadow-[2px_2px_0_#000]":"bg-transparent border-white/20 text-white/40 hover:border-white/40"}`}
                      title={doneToday?"Undo today":"Mark today done"}>
                      {doneToday?"✓":"○"}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 border border-black shrink-0" style={{background:h.color, boxShadow: stk>=3?`0 0 8px ${h.color}`:undefined}} />
                        <span className="font-black text-[12px] tracking-wide truncate">{h.name}</span>
                        {stk>=3 && <span className="text-[10px] font-black px-1.5 py-0.5 bg-[#fde68a] text-black border border-black">{stk}🔥</span>}
                        {stk>=7 && <span className="text-[10px] font-black px-1 py-0.5 bg-[#f9a8d4] text-black border border-black animate-pulse">PULSE</span>}
                      </div>
                      <div className="text-[11px] opacity-60 flex flex-wrap gap-2">
                        <span>{tot} checks</span>
                        <span>·</span>
                        <span>streak {stk}</span>
                        {h.dates.length>0 && <span>· last {fmtDate(h.dates[h.dates.length-1])}</span>}
                      </div>
                      {/* mini heat strip last 14 days */}
                      <div className="mt-1 flex gap-0.5">
                        {Array.from({length:14},(_,i)=>{
                          const d=new Date(); d.setDate(d.getDate()-(13-i))
                          const ds=d.toISOString().slice(0,10)
                          const on=h.dates.includes(ds)
                          return <div key={ds} title={ds} className={`h-2 w-2 border ${on?"border-black":"border-white/10"} ${on?"":"bg-white/5"}`} style={{background: on? h.color : undefined}} />
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={()=>bumpFakeStreak(h.id)} className="text-[10px] tracking-widest px-2 py-1 bg-white text-black font-black border border-black hover:bg-[#7dd3fc]">+2 DEMO</button>
                      <button onClick={()=>removeHabit(h.id)} className="text-[10px] tracking-widest px-2 py-1 bg-transparent text-white/50 border border-white/10 hover:text-white hover:border-white/30">DELETE</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-3 py-2.5 bg-white text-black border-t-2 border-black flex items-center gap-2 text-[11px]">
              <span className="font-black tracking-widest">STREAK GLOW:</span>
              <span className="opacity-70">3d = glow · 7d = pulse · 30d = supernova</span>
              <button onClick={()=>{
                const share = `My habit sky: ${stats.doneToday}/${stats.total} today, best streak ${stats.best} — habit-constellation`
                navigator.clipboard.writeText(share); setToast("Copied share text ✓")
              }} className="ml-auto px-2 py-1 bg-black text-white font-black text-[10px] tracking-widest border border-black">COPY SHARE</button>
            </div>
          </div>

          {/* export */}
          <div className="flex gap-2">
            <button onClick={()=>{
              const blob=new Blob([JSON.stringify(habits,null,2)],{type:"application/json"})
              const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="habit-constellation.json"; a.click(); URL.revokeObjectURL(url)
            }} className="flex-1 py-2.5 bg-white text-black font-black text-xs tracking-widest border-2 border-black shadow-[4px_4px_0_#0b1020] hover:bg-[#7dd3fc]">EXPORT JSON</button>
            <button onClick={()=>{
              const data=prompt("Paste JSON to import:"); if(!data) return; try{ const j=JSON.parse(data); if(Array.isArray(j)) setHabits(j)}catch{alert("Invalid JSON")}
            }} className="px-4 py-2.5 bg-transparent text-white font-black text-xs tracking-widest border-2 border-white/20 hover:border-white/40">IMPORT</button>
          </div>

          <div className="text-[10px] tracking-widest opacity-40 text-center">
            PIXEL-ART · BUILT BY AUTO-FORGE · DATA SAVED LOCALLY · NO SERVER
          </div>
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black text-white border-2 border-white px-4 py-2 font-black tracking-widest text-xs shadow-[4px_4px_0_#7dd3fc] z-50">
          {toast}
        </div>
      )}

      <style>{`
        *{ scrollbar-width: thin; scrollbar-color: #333 transparent; }
        ::selection{ background: #7dd3fc; color:#000 }
      `}</style>
    </div>
  )
}
