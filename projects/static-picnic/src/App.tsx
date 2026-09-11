import { useEffect, useRef, useState } from 'react'
import type { Dish } from './data'
import { STATIONS } from './data'
import DishTuner from './components/DishTuner'
import PicnicBoard from './components/PicnicBoard'
import SignalSeats from './components/SignalSeats'

function loadLocked(): Dish[] {
  try {
    const ids = JSON.parse(localStorage.getItem('static-picnic:locked') ?? '[]') as string[]
    return STATIONS.filter(s => ids.includes(s.id))
  } catch {
    return []
  }
}

const MARQUEE_ITEMS = [
  'NOW BROADCASTING FROM A PASSING PICNIC',
  'TUNE A DISH · BRING A PLATE · GRAB A SEAT',
  'EVERY STRANGER HAS A FREQUENCY',
  'SIGNAL SEATS AROUND THE TRANSMITTER',
  'DON\'T CROSS THE WIRES',
]

export default function App() {
  const [locked, setLocked] = useState<Dish[]>(loadLocked)
  const [voidMode, setVoidMode] = useState(false)
  const [ticker, setTicker] = useState(MARQUEE_ITEMS[0])
  const voidRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!voidMode) { voidRef.current = null; return }
    voidRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setVoidMode(false); return }
      if (e.key === 'Tab' && voidRef.current) {
        // keep focus inside the dialog
        e.preventDefault()
        voidRef.current.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voidMode])

  useEffect(() => {
    try {
      localStorage.setItem('static-picnic:locked', JSON.stringify(locked.map(d => d.id)))
    } catch { /* ignore */ }
  }, [locked])

  const handleLock = (dish: Dish) => {
    setLocked(prev => prev.some(d => d.id === dish.id) ? prev : [...prev, dish])
    setTicker(`${dish.name} just landed on the picnic rug at ${dish.freq.toFixed(1)} FM`)
  }

  const handleClaim = (name: string) => {
    setTicker(`${name} grabbed a signal seat around the broadcast`)
  }

  const signal = locked.length > 0 ? Math.min(5, locked.length) : 2

  return (
    <div className={`min-h-screen ${voidMode ? 'void-mode' : ''}`}>
      {/* Masthead */}
      <header className="relative border-b-3 border-black">
        <div className="sunburst absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-4 text-center">
          <p className="mono text-[11px] uppercase tracking-[0.3em] mb-1">a radio potluck for passing strangers</p>
          <h1 className="display title-shadow text-[clamp(2.5rem,6vw,4rem)] leading-none uppercase">
            Static Picnic
          </h1>
          <p className="mono text-xs uppercase tracking-widest mt-3 text-black/70">
            ◉ transmitter live · {STATIONS.length} dishes in the band · {locked.length} on the rug
          </p>
        </div>
      </header>

      {/* Marquee ticker */}
      <div className="border-b-3 border-black overflow-hidden bg-black text-[#FFF4DC] py-1.5">
        <div className="marquee-track" role="region" aria-label="Broadcast ticker" tabIndex={0}>
          {[0, 1].map(dup => (
            <div key={dup} className="flex shrink-0">
              {MARQUEE_ITEMS.concat(MARQUEE_ITEMS).map((item, i) => (
                <span key={`${dup}-${i}`} className="mono text-xs uppercase tracking-widest px-8 whitespace-nowrap">
                  ◉ {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Live toast */}
      <div className="max-w-5xl mx-auto px-4 py-3" aria-live="polite">
        <p className="mono text-[11px] uppercase tracking-widest bg-[var(--yellow)] border-2 border-black px-3 py-1 inline-block">
          {ticker}
        </p>
      </div>

      {/* Main asymmetric grid */}
      <main className="max-w-5xl mx-auto px-4 pb-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <DishTuner locked={locked} onLock={handleLock} onVoid={() => setVoidMode(true)} />
        </div>
        <div className="lg:col-span-5">
          <PicnicBoard locked={locked} />
        </div>
      </main>

      {/* Seats */}
      <footer className="max-w-5xl mx-auto px-4 pb-16">
        <SignalSeats signal={signal} onClaim={handleClaim} />
        <p className="mono text-[10px] uppercase tracking-widest text-center mt-8 opacity-50">
          static picnic · keyboard friendly · your data stays on this device
        </p>
      </footer>

      {/* Void overlay easter egg */}
      {voidMode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--ink)] text-[#FFF4DC] dish-reveal" role="dialog" aria-modal="true" aria-label="The Void">
          <div className="text-center max-w-md px-6">
            <p className="mono text-xs uppercase tracking-[0.4em] text-[var(--pink)]">⟨ the void ›⟩</p>
            <h2 className="display text-4xl my-3" style={{ textShadow: '3px 3px 0 var(--cobalt)' }}>THE VOID</h2>
            <p className="italic opacity-80">You tuned past the whole band. There's no dish here — just a warm static and a place to sit.</p>
            <p className="mono text-[11px] uppercase tracking-widest mt-4 text-[var(--green)]">stay a while · nobody's watching</p>
            <button
              ref={voidRef}
              onClick={() => setVoidMode(false)}
              className="lift mono text-xs uppercase px-4 py-2 border-3 border-[#FFF4DC] mt-6 bg-[var(--cobalt)] text-[#FFF4DC] cursor-pointer"
            >
              esc — return to the picnic
            </button>
          </div>
        </div>
      )}
    </div>
  )
}