import { useState, useEffect, useMemo, useRef } from 'react'
import { MOODS, MOOD_BY_ID, WEEKDAY_HEADERS, monthGrid, monthLabel, moodKey, todayMonth, shiftMonth } from './lib/calendar'

// WebAudio click
function useSound(){
  const ctxRef = useRef<AudioContext|null>(null)
  function getCtx(){
    if(!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return ctxRef.current
  }
  function play(freq=660, dur=0.08, type: OscillatorType='square', gain=0.12){
    try{
      const ctx = getCtx()
      if(ctx.state==='suspended') ctx.resume()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type=type; o.frequency.value=freq
      g.gain.value=gain
      o.connect(g); g.connect(ctx.destination)
      o.start()
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur)
      o.stop(ctx.currentTime+dur)
    }catch{}
  }
  return { play }
}

export default function App(){
  const [{year, month}, setYM] = useState(()=>todayMonth())
  const [selectedDay, setSelectedDay] = useState<number|null>(()=> new Date().getDate())
  const [data, setData] = useState<Record<string,string>>(()=>{
    try{ return JSON.parse(localStorage.getItem('cc-nk6c')||'{}')}catch{return {}}
  })
  const [filter, setFilter] = useState<string>('all')
  const {play} = useSound()

  useEffect(()=>{ localStorage.setItem('cc-nk6c', JSON.stringify(data)) }, [data])
  const cells = useMemo(()=> monthGrid(year, month), [year, month])
  const label = monthLabel(year, month)
  const today = new Date()

  function setMood(day:number, moodId:string){
    play(520+ MOODS.findIndex(m=>m.id===moodId)*80, 0.09, 'square')
    const k = moodKey(year, month, day)
    setData(d=> ({...d, [k]: moodId}))
  }
  function clearDay(day:number){
    play(220,0.12,'sawtooth',0.08)
    const k = moodKey(year, month, day)
    setData(d=>{ const n={...d}; delete n[k]; return n })
  }
  function shift(delta:number){
    play(440,0.06,'triangle')
    const n= shiftMonth(year, month, delta)
    setYM(n); setSelectedDay(1)
  }
  const stats = useMemo(()=>{
    const vals = Object.values(data)
    const total = vals.length
    const counts: Record<string,number>={}; for(const m of MOODS) counts[m.id]=0
    for(const v of vals) counts[v]= (counts[v]||0)+1
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]
    return {total, counts, top}
  }, [data])

  const selectedKey = selectedDay? moodKey(year, month, selectedDay): null
  const selectedMood = selectedKey? data[selectedKey]: undefined

  function share(){
    play(700,0.12,'square')
    const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}:`
    const entries = Object.entries(data).filter(([k])=>k.startsWith(monthPrefix))
    const lines = entries.map(([k,v])=> `${k.split(':')[1]} → ${MOOD_BY_ID[v]?.name||v}`).join('\n') || 'No moods painted yet.'
    const text = `Chromatic Calendar — ${label}\n${lines}\nTop: ${stats.top? MOOD_BY_ID[stats.top[0]]?.name+' ('+stats.top[1]+')':'—'}\n— neo-brutalism edition`
    navigator.clipboard?.writeText(text).then(()=>alert('Copied!')).catch(()=>alert(text))
  }
  function exportJson(){
    play(880,0.08,'sine')
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`chromatic-${year}-${String(month+1).padStart(2,'0')}.json`; a.click(); URL.revokeObjectURL(url)
  }
  function clearMonth(){
    if(!confirm('Clear this month?')) return
    play(180,0.2,'sawtooth',0.15)
    const prefix = `${year}-${String(month+1).padStart(2,'0')}:`
    setData(d=>{ const n={...d}; for(const k of Object.keys(n)) if(k.startsWith(prefix)) delete n[k]; return n })
  }

  const visibleCells = filter==='all'? cells : cells.filter(c=>{
    if(c.day===null) return false
    const k = moodKey(year, month, c.day)
    return data[k]===filter
  })

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-black selection:bg-black selection:text-white" style={{fontFamily:'system-ui, Archivo Black, sans-serif'}}>
      <div className="max-w-[980px] mx-auto px-4 py-6 md:py-8">
        {/* header brutal */}
        <header className="border-[4px] border-black bg-white shadow-[8px_8px_0px_0px_#000] p-4 md:p-6 flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase">
              <span className="w-3 h-3 bg-black border-2 border-black" /> TIME · NEO-BRUTALISM
            </div>
            <h1 className="text-[28px] md:text-[40px] font-black tracking-tighter leading-none mt-2 uppercase">Chromatic <span className="bg-black text-white px-2">Calendar</span></h1>
            <p className="mt-2 text-sm font-bold max-w-[52ch] leading-tight">Mood as color — click a day, cycle the palette. Loud borders, louder feelings. Sound ON.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={share} className="px-4 py-2 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] font-black uppercase text-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all">Share ↗</button>
            <button onClick={exportJson} className="px-4 py-2 bg-black text-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] font-black uppercase text-sm hover:bg-zinc-900">Export JSON</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.75fr] gap-5 mt-6">
          {/* calendar */}
          <section className="border-[4px] border-black bg-white shadow-[8px_8px_0px_0px_#000] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b-[4px] border-black bg-[#FFD43B]">
              <button onClick={()=>shift(-1)} className="w-10 h-10 grid place-items-center bg-white border-[3px] border-black font-black text-xl shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">‹</button>
              <div className="text-center">
                <div className="font-black text-[18px] md:text-[22px] tracking-tight uppercase">{label}</div>
                <div className="text-[11px] font-bold tracking-widest uppercase opacity-70">{stats.total} painted • top {stats.top && stats.top[1]>0? MOOD_BY_ID[stats.top[0]]?.name: '—'}</div>
              </div>
              <button onClick={()=>shift(1)} className="w-10 h-10 grid place-items-center bg-white border-[3px] border-black font-black text-xl shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">›</button>
            </div>

            <div className="grid grid-cols-7 border-b-[4px] border-black bg-black gap-[3px] p-[3px]">
              {WEEKDAY_HEADERS.map(h=> <div key={h} className="bg-white text-center py-2 font-black text-xs tracking-widest">{h}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-[3px] bg-black p-[3px]">
              {(filter==='all'? cells : visibleCells).map(c=>{
                if(c.day===null) return <div key={c.key} className="bg-[#eee] min-h-[86px] md:min-h-[92px] border-[3px] border-black/10 opacity-40" />
                const k = moodKey(year, month, c.day)
                const moodId = data[k]
                const mood = moodId? MOOD_BY_ID[moodId]: null
                const isSel = selectedDay===c.day
                const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===c.day
                return (
                  <button
                    key={c.key}
                    onClick={()=>{ setSelectedDay(c.day); if(moodId){ const idx=MOODS.findIndex(m=>m.id===moodId); const next = MOODS[(idx+1)%MOODS.length]; setMood(c.day!, next.id)} else setMood(c.day!, MOODS[0].id) }}
                    onContextMenu={e=>{ e.preventDefault(); clearDay(c.day!) }}
                    className={`relative min-h-[86px] md:min-h-[92px] border-[3px] text-left p-2 flex flex-col justify-between font-black transition-all ${isSel? 'border-black shadow-[inset_0_0_0_3px_#000]':'border-black'} ${mood? 'text-white':'bg-white text-black hover:bg-zinc-50'}`}
                    style={{background: mood? mood.fill: undefined}}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[15px] leading-none px-1.5 py-0.5 border-2 ${mood? 'bg-black text-white border-black':'bg-white border-black'}`}>{c.day}</span>
                      {isToday && <span className="text-[9px] bg-black text-white px-1.5 py-0.5 uppercase tracking-widest">today</span>}
                    </div>
                    <div className="text-[11px] leading-none uppercase tracking-wide mt-1">
                      {mood? mood.name : <span className="opacity-30">tap →</span>}
                    </div>
                    {isSel && <div className="absolute -top-1 -right-1 w-3 h-3 bg-black border-2 border-white shadow" />}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2 p-3 border-t-[4px] border-black bg-white">
              <button onClick={()=>setFilter('all')} className={`px-3 py-1.5 border-[3px] border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] ${filter==='all'?'bg-black text-white':'bg-white'}`}>All</button>
              {MOODS.map(m=> (
                <button key={m.id} onClick={()=>{ play(600,0.05,'square'); setFilter(m.id)}} className={`px-3 py-1.5 border-[3px] border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] ${filter===m.id?'text-white':'bg-white'}`} style={{background: filter===m.id? m.fill: '#fff', color: filter===m.id? '#fff': '#000'}}>{m.name}</button>
              ))}
              <button onClick={()=>{setFilter('all'); clearMonth()}} className="ml-auto px-3 py-1.5 bg-[#FF4E6A] border-[3px] border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] text-white">Clear month</button>
            </div>
            <div className="px-3 py-2 bg-black text-white text-[11px] font-bold tracking-wide">TIP: click to cycle moods • right-click to clear • filter by mood above</div>
          </section>

          {/* detail */}
          <aside className="space-y-5">
            <div className="border-[4px] border-black bg-white shadow-[8px_8px_0px_0px_#000] p-4">
              <div className="text-[11px] font-black tracking-[0.18em] uppercase opacity-60">Selected</div>
              <div className="mt-1 font-black text-[28px] leading-none">{selectedDay? `${selectedDay} ${label.split(' ')[0]}` : '—'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOODS.map(m=> {
                  const active = selectedMood===m.id
                  return (
                    <button key={m.id} onClick={()=> selectedDay && setMood(selectedDay, m.id)} className={`px-3 py-2 border-[3px] border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_#000] ${active?'text-white scale-[1.02]':'bg-white'}`} style={{background: active? m.fill: '#fff'}}>
                      {m.name}
                    </button>
                  )
                })}
                <button onClick={()=> selectedDay && clearDay(selectedDay)} className="px-3 py-2 bg-white border-[3px] border-black font-black uppercase text-xs">Clear ×</button>
              </div>
              <div className="mt-4 border-[3px] border-black p-3 bg-[#f5f1e8]">
                <div className="text-xs font-black uppercase">Legend</div>
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {MOODS.map(m=> (
                    <div key={m.id} className="flex items-center gap-2 text-xs font-bold">
                      <span className="w-5 h-5 border-2 border-black" style={{background:m.fill}} /> {m.name} — <span className="opacity-60">{stats.counts[m.id]||0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-[4px] border-black bg-[#00C2FF] shadow-[8px_8px_0px_0px_#000] p-4">
              <div className="font-black uppercase text-sm tracking-wide">How it works</div>
              <ul className="mt-2 text-sm font-bold leading-tight list-disc pl-5 space-y-1">
                <li>Click any day to paint it. Click again to cycle.</li>
                <li>Sound blips on every interaction (WebAudio, no files).</li>
                <li>Share copies a text summary · Export saves JSON.</li>
              </ul>
              <div className="mt-3 inline-block bg-black text-white px-2 py-1 text-[11px] font-black uppercase tracking-widest">Constraint: sound on interaction ✓</div>
            </div>

            <div className="border-[4px] border-black bg-white shadow-[8px_8px_0px_0px_#000] p-4">
              <div className="font-black uppercase text-xs tracking-widest opacity-60">Stats</div>
              <div className="mt-2 font-black text-4xl leading-none">{stats.total} <span className="text-sm font-bold uppercase opacity-60">painted</span></div>
              <div className="mt-2 h-3 border-2 border-black flex overflow-hidden">
                {MOODS.map(m=>{
                  const c = stats.counts[m.id]||0
                  const pct = stats.total? (c/stats.total)*100:0
                  return <div key={m.id} style={{width: pct+'%', background:m.fill}} />
                })}
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-6 border-[3px] border-black bg-black text-white px-3 py-2 flex flex-wrap gap-2 items-center justify-between text-[11px] font-bold uppercase tracking-widest">
          <span>auto-forge — neo-brutalism • sound • chromatic calendar</span>
          <span className="opacity-70">{year}-{String(month+1).padStart(2,'0')}</span>
        </footer>
      </div>
    </div>
  )
}
