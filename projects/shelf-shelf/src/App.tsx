import { useState } from 'react'

type Book = { id: number, title: string, color: string }

const initial: Book[] = [
  { id: 1, title: "Neuromancer", color: "#ff006e" },
  { id: 2, title: "Snow Crash", color: "#00f5ff" },
  { id: 3, title: "Ghost in Shell", color: "#ffbe0b" },
  { id: 4, title: "Akira", color: "#8338ec" },
  { id: 5, title: "BLAME!", color: "#06ffa5" },
  { id: 6, title: "Paprika", color: "#ff7b00" },
]

function App() {
  const [books, setBooks] = useState<Book[]>(initial)
  const [dragId, setDragId] = useState<number|null>(null)
  const taste = Math.round((books.findIndex(b=>b.title==="Neuromancer")+1) * 13 + books.length * 7) % 100

  const onDragStart = (id:number) => setDragId(id)
  const onDrop = (target:number) => {
    if (dragId===null || dragId===target) return
    const from = books.findIndex(b=>b.id===dragId)
    const to = books.findIndex(b=>b.id===target)
    const next=[...books]; const [m]=next.splice(from,1); next.splice(to,0,m)
    setBooks(next); setDragId(null)
  }

  const share = async () => {
    const text = `My Shelf Shelf taste score: ${taste}/100 — ${books.map(b=>b.title).join(', ')}`
    try { await navigator.clipboard.writeText(text); alert('Copied: ' + text)} catch { alert(text) }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ef] flex flex-col items-center">
      <header className="w-full max-w-3xl px-6 pt-10 pb-4">
        <h1 className="text-3xl font-black tracking-tighter">SHELF SHELF</h1>
        <p className="opacity-60 text-sm mt-1">Arrange your bookshelf, judge your taste. — japanese-cyberpunk</p>
      </header>
      <div className="w-full max-w-3xl px-6">
        <div className="rounded-2xl border border-[#222] bg-[#111119] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-50">Taste score</div>
            <div className="text-4xl font-black" style={{color: taste>70 ? '#06ffa5' : taste>40 ? '#ffbe0b' : '#ff006e'}}>{taste}<span className="text-xl opacity-40">/100</span></div>
            <div className="text-xs opacity-60 mt-1">{taste>75 ? 'Impeccable curation' : taste>50 ? 'Solid shelf' : 'Needs more cyberpunk'}</div>
          </div>
          <button onClick={share} className="px-4 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-zinc-200">Share card ↗</button>
        </div>
        <div className="mt-6">
          <div className="flex gap-3 p-4 rounded-xl border border-dashed border-[#333] bg-[#0f0f17] overflow-x-auto">
            {books.map(b=>(
              <div key={b.id}
                draggable onDragStart={()=>onDragStart(b.id)}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>onDrop(b.id)}
                className="shrink-0 w-[92px] h-[140px] rounded-lg grid place-items-center text-center p-2 cursor-grab active:cursor-grabbing select-none border"
                style={{background: b.color, color: '#000', borderColor: 'rgba(0,0,0,0.2)', transform: dragId===b.id ? 'scale(0.95) rotate(2deg)' : undefined, opacity: dragId===b.id ? 0.6 : 1 }}>
                <span className="text-xs font-bold leading-tight">{b.title}</span>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-40 text-center mt-2">Drag to reorder — taste updates live</p>
        </div>
        <div className="mt-8 text-xs opacity-30 border-t border-[#222] pt-4">
          Shelf Shelf — vite + react-ts + tailwind · placeholder scaffold (auto-forge)
        </div>
      </div>
    </div>
  )
}
export default App
