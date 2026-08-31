import { useState, useEffect, useMemo } from 'react'

type Mood = 'none' | 'joy' | 'calm' | 'focus' | 'melancholy' | 'fury' | 'glow' | 'dream'
type Entry = { mood: Mood; note?: string }

const moods: Record<Mood, { label: string; color: string; bg: string; emoji: string }> = {
  none:       { label: '—',        color: '#ffffff10', bg: 'transparent',   emoji: '·' },
  joy:        { label: 'Joy',      color: '#f59e0b',   bg: '#f59e0b22',     emoji: '✦' },
  calm:       { label: 'Calm',     color: '#38bdf8',   bg: '#38bdf822',     emoji: '◯' },
  focus:      { label: 'Focus',    color: '#22d3ee',   bg: '#22d3ee22',     emoji: '⬢' },
  melancholy: { label: 'Blue',     color: '#8b5cf6',   bg: '#8b5cf622',     emoji: '⬣' },
  fury:       { label: 'Fury',     color: '#f43f5e',   bg: '#f43f5e22',     emoji: '⬔' },
  glow:       { label: 'Glow',     color: '#10b981',   bg: '#10b98122',     emoji: '⬥' },
  dream:      { label: 'Dream',    color: '#ec4899',   bg: '#ec489922',     emoji: '✺' },
}

const palette: Mood[] = ['joy','calm','focus','melancholy','fury','glow','dream','none']

function fmt(d: Date){ return d.toISOString().slice(0,10) }

export default function App(){
  const [cursor, setCursor] = useState(()=>{ const n=new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selected, setSelected] = useState<string>(()=> fmt(new Date()))
  const [data, setData] = useState<Record<string, Entry>>(()=>{
    try{ return JSON.parse(localStorage.getItem('chromatic-v1')||'{}') }catch{ return {} }
  })
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<Mood|'all'>('all')

  useEffect(()=>{ localStorage.setItem('chromatic-v1', JSON.stringify(data)) }, [data])
  useEffect(()=>{ setNote(data[selected]?.note||'') }, [selected, data])

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const todayKey = fmt(new Date())

  const cells = useMemo(()=>{
    const arr: { key: string; day: number; muted: boolean }[] = []
    for(let i=firstDay-1;i>=0;i--) arr.push({ key: fmt(new Date(year, month-1, daysInPrev - i)), day: daysInPrev - i, muted: true })
    for(let d=1; d<=daysInMonth; d++) arr.push({ key: fmt(new Date(year, month, d)), day: d, muted: false })
    while(arr.length %7 !==0){ const n=arr.length - (firstDay+daysInMonth); const d=n+1; arr.push({ key: fmt(new Date(year, month+1, d)), day: d, muted: true }) }
    while(arr.length < 42) { const last=arr.length; const d= last - (firstDay+daysInMonth) +1; arr.push({ key: fmt(new Date(year, month+1, d)), day: d, muted: true }) }
    return arr.slice(0,42)
  }, [year, month, firstDay, daysInMonth, daysInPrev])

  const stats = useMemo(()=>{
    const vals = Object.values(data)
    const total = vals.filter(v=>v.mood!=='none').length
    const counts: Record<string, number> = {}
    for(const m of palette) counts[m]=0
    for(const v of vals) if(v.mood!=='none') counts[v.mood]=(counts[v.mood]||0)+1
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]
    return { total, counts, top }
  }, [data])

  const filteredCells = filter==='all' ? cells : cells.filter(c=> (data[c.key]?.mood||'none')===filter)

  function setMood(key: string, mood: Mood){
    setData(d=> ({...d, [key]: { mood, note: d[key]?.note||'' }}))
  }

  function saveNote(){
    setData(d=> ({...d, [selected]: { mood: d[selected]?.mood||'none', note }}))
  }

  async function share(){
    const summary = `Chromatic Calendar — ${todayKey}\n${Object.entries(data).filter(([,v])=>v.mood!=='none').map(([k,v])=> `${k}: ${moods[v.mood].label}${v.note?` — ${v.note}`:''}`).join('\n') || 'No moods yet — paint your month with color.'}\n\nTop mood: ${stats.top? `${moods[stats.top[0] as Mood].label} (${stats.top[1]})` : '—'}\nCreated with Chromatic Calendar — mood as color`
    try{ await navigator.clipboard.writeText(summary); alert('Copied summary to clipboard') }catch{ alert(summary) }
  }
  function exportJson(){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`chromatic-${year}-${String(month+1).padStart(2,'0')}.json`; a.click(); URL.revokeObjectURL(url)
  }
  function clearMonth(){
    if(!confirm('Clear all moods this month?')) return
    const next={...data}
    for(const c of cells) if(!c.muted) delete next[c.key]
    setData(next)
  }

  const selMood = data[selected]?.mood||'none'

  return (
    <div className="min-h-screen text-[#e8e8ef] relative overflow-hidden" style={{background:'#070a14'}}>
      {/* glassmorphism backdrop */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-[30%] -left-[20%] w-[80%] h-[70%] rounded-full blur-[120px] opacity-40" style={{background:'radial-gradient(ellipse at center, #8b5cf6 0%, #38bdf8 35%, transparent 70%)'}}/>
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full blur-[100px] opacity-30" style={{background:'radial-gradient(ellipse at center, #f59e0b 0%, #ec4899 40%, transparent 70%)'}}/>
        <div className="absolute inset-0" style={{background:'linear-gradient(180deg, transparent 0%, rgba(7,10,20,0.6) 100%)'}}/>
      </div>

      <div className="relative max-w-[1100px] mx-auto px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase opacity-60">
              <span className="w-2 h-2 rounded-full" style={{background:'#38bdf8', boxShadow:'0 0 12px #38bdf8'}}/> time · theme
            </div>
            <h1 className="text-[32px] md:text-[42px] font-black tracking-tighter leading-none mt-1" style={{fontFamily:'system-ui', letterSpacing:'-0.03em'}}>
              Chromatic <span className="font-light opacity-80">Calendar</span>
            </h1>
            <p className="text-sm opacity-60 mt-1">Mood as color — paint each day, watch your month become a palette.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={share} className="px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-xl border border-white/15 bg-white/10 hover:bg-white/15 transition">Share ↗</button>
            <button onClick={exportJson} className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-black hover:bg-zinc-100 transition">Export JSON</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
          {/* calendar */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <button onClick={()=>setCursor(new Date(year, month-1, 1))} className="w-8 h-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/15 border border-white/10">‹</button>
                <div className="min-w-[170px] text-center">
                  <div className="text-lg font-bold tracking-tight">{cursor.toLocaleString('en-US',{month:'long'})} <span className="font-light opacity-70">{year}</span></div>
                  <div className="text-[11px] tracking-widest uppercase opacity-50">{stats.total} painted days</div>
                </div>
                <button onClick={()=>setCursor(new Date(year, month+1, 1))} className="w-8 h-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/15 border border-white/10">›</button>
              </div>
              <button onClick={()=>{setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(todayKey)}} className="text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10">Today</button>
            </div>

            <div className="px-3 pt-3 pb-1 flex gap-1.5 flex-wrap">
              <button onClick={()=>setFilter('all')} className={`text-xs px-3 py-1.5 rounded-full border transition ${filter==='all' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>All</button>
              {palette.filter(m=>m!=='none').map(m=>(
                <button key={m} onClick={()=>setFilter(filter===m?'all':m)} className={`text-xs px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 transition ${filter===m ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{background: moods[m].color}}/> {moods[m].label}
                </button>
              ))}
            </div>

            <div className="px-3 pb-4">
              <div className="grid grid-cols-7 gap-1 text-[11px] tracking-widest uppercase opacity-40 px-1 py-2">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> <div key={d} className="text-center">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {(filter==='all' ? cells : filteredCells.length? filteredCells : cells).map(c=>{
                  const e = data[c.key]
                  const mood: Mood = e?.mood || 'none'
                  const isSel = c.key===selected
                  const isToday = c.key===todayKey
                  const bg = mood==='none' ? 'rgba(255,255,255,0.04)' : moods[mood].bg
                  const border = isSel ? 'rgba(255,255,255,0.9)' : mood==='none' ? 'rgba(255,255,255,0.08)' : moods[mood].color+'55'
                  return (
                    <button key={c.key} onClick={()=>setSelected(c.key)}
                      className={`relative aspect-square rounded-[14px] p-2 text-left flex flex-col justify-between border backdrop-blur transition overflow-hidden group ${c.muted? 'opacity-30':''} hover:scale-[1.02] hover:shadow-lg`}
                      style={{background: bg, borderColor: border, boxShadow: isSel? '0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px rgba(0,0,0,0.3)': undefined}}>
                      <div className="flex items-start justify-between">
                        <span className={`text-sm font-semibold ${c.muted?'opacity-60':''} ${isToday?'underline decoration-2 underline-offset-4':''}`} style={{color: mood==='none' ? '#e8e8ef' : moods[mood].color}}>{c.day}</span>
                        <span className="text-[10px] leading-none opacity-70">{moods[mood].emoji}</span>
                      </div>
                      {e?.note && <div className="text-[10px] leading-tight opacity-70 line-clamp-2">{e.note}</div>}
                      {isToday && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"/>}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs opacity-50">
                <span>{filter!=='all' ? `Filter: ${moods[filter as Mood].label} · ${filteredCells.length} days` : 'Click a day → pick a mood'}</span>
                <button onClick={clearMonth} className="hover:opacity-80 underline decoration-dotted">Clear month</button>
              </div>
            </div>
          </div>

          {/* detail */}
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.07] backdrop-blur-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="text-[11px] tracking-[0.16em] uppercase opacity-50">Selected</div>
              <div className="text-xl font-bold mt-1">{new Date(selected).toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric', year:'numeric'})}</div>
              <div className="text-xs opacity-60">{selected===todayKey ? 'Today' : new Date(selected) < new Date(todayKey) ? 'Past' : 'Future'} · {selMood==='none' ? 'No mood yet' : moods[selMood].label}</div>

              <div className="mt-4">
                <div className="text-xs opacity-60 mb-2">Paint mood</div>
                <div className="flex flex-wrap gap-2">
                  {palette.map(m=>(
                    <button key={m} onClick={()=>setMood(selected, m)}
                      className={`px-3 py-2 rounded-full text-sm font-semibold border flex items-center gap-2 transition ${selMood===m ? 'bg-white text-black border-white shadow' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      <span className="w-3 h-3 rounded-full" style={{background: moods[m].color, boxShadow: selMood===m? `0 0 10px ${moods[m].color}`:undefined}}/>
                      {m==='none' ? 'Clear' : moods[m].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs opacity-60 mb-2">Note (optional)</div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="A word about today — kept with its color"
                  className="w-full min-h-[72px] rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:border-white/20 resize-none"/>
                <div className="flex gap-2 mt-2">
                  <button onClick={saveNote} className="px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-zinc-100">Save note</button>
                  <span className="text-xs opacity-40 self-center">{data[selected]?.note ? 'Saved' : 'Not saved'}</span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-white/10 grid place-items-center text-lg" style={{background: moods[selMood].bg, color: moods[selMood].color, borderColor: moods[selMood].color+'40'}}>{moods[selMood].emoji}</div>
                <div>
                  <div className="text-sm font-bold" style={{color: selMood==='none'? '#e8e8ef': moods[selMood].color}}>{selMood==='none'? 'Unpainted' : moods[selMood].label}</div>
                  <div className="text-xs opacity-60">This day's color — shows in calendar and timeline</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-5">
              <div className="text-[11px] tracking-[0.16em] uppercase opacity-50">Palette timeline</div>
              <div className="mt-3 flex gap-1 h-8 items-stretch">
                {cells.filter(c=>!c.muted).map(c=>{
                  const m = data[c.key]?.mood||'none'
                  return <div key={c.key} title={`${c.key} · ${moods[m].label}`} className="flex-1 rounded-full border border-white/5 transition" style={{background: m==='none'? 'rgba(255,255,255,0.06)' : moods[m].color, opacity: c.key===selected?1:0.9}}/>
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="opacity-50">Painted</div><div className="text-lg font-black">{stats.total} days</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="opacity-50">Top mood</div><div className="text-sm font-bold" style={{color: stats.top && stats.top[1]>0 ? moods[stats.top[0] as Mood].color : undefined}}>{stats.top && stats.top[1]>0 ? `${moods[stats.top[0] as Mood].label} · ${stats.top[1]}` : '—'}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {palette.filter(m=>m!=='none').map(m=>(
                  <span key={m} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
                    <span className="w-2 h-2 rounded-full" style={{background: moods[m].color}}/>{moods[m].label} <span className="opacity-60">{stats.counts[m]||0}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="text-[11px] leading-relaxed opacity-40 text-center px-2">
              glassmorphism · vite + react + tailwind · single component · keyboard: Tab to navigate, Enter to paint · localStorage only
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
