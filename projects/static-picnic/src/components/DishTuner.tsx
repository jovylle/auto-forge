import { useEffect, useRef, useState } from 'react'
import type { Dish } from '../data'
import { BAND_MAX, BAND_MIN, STATIONS, TICK, VOID_DISH, nearestStation } from '../data'

interface Props {
  locked: Dish[]
  onLock: (dish: Dish) => void
  onVoid: () => void
}

function renderTicks(start: number, end: number, step: number) {
  const ticks: number[] = []
  for (let f = start; f <= end + 0.001; f += step) ticks.push(f)
  return ticks
}

export default function DishTuner({ locked, onLock, onVoid }: Props) {
  const [freq, setFreq] = useState<number>(88.3)
  const [crackle, setCrackle] = useState<number>(0)
  const [voidActive, setVoidActive] = useState(false)
  const bandRef = useRef<HTMLDivElement>(null)

  const isVoid = freq < BAND_MIN || freq > BAND_MAX
  const current = isVoid ? VOID_DISH : nearestStation(freq, STATIONS)

  const lockCurrent = () => {
    if (!current) return
    if (current.id === 'void') {
      setVoidActive(true)
      onVoid()
      setTimeout(() => setVoidActive(false), 5000)
      return
    }
    onLock(current)
  }
  const lockCurrentRef = useRef(lockCurrent)
  lockCurrentRef.current = lockCurrent

  // keyboard control on the dial container
  useEffect(() => {
    const el = bandRef.current
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Escape', 'Home', 'End'].includes(e.key)) e.preventDefault()
      setFreq(prev => {
        if (e.key === 'ArrowLeft') return Math.max(70, +(prev - TICK).toFixed(1))
        if (e.key === 'ArrowRight') return Math.min(114, +(prev + TICK).toFixed(1))
        if (e.key === 'Home') return 70
        if (e.key === 'End') return 114
        if (e.key === 'Escape') return BAND_MIN
        return prev
      })
      if (e.key === 'Enter') lockCurrentRef.current()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setCrackle(c => c + 1)
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [])

  const pct = ((freq - 70) / (114 - 70)) * 100

  return (
    <section
      className={`panel tilt-pos p-5 ${voidActive ? 'void-mode' : ''}`}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="display squiggle text-lg leading-tight">Dish Tuner</h2>
        <span className="mono text-xs uppercase tracking-widest bg-black text-[#FFF4DC] px-2 py-1">Band 87.5–108</span>
      </div>

      <p className="mono text-[11px] uppercase tracking-wider mt-2 opacity-70">
        Rotate the dial to catch a broadcast. Arrow keys tune · Enter locks · Esc home
      </p>

      {/* Dial */}
      <div
        ref={bandRef}
        tabIndex={0}
        role="slider"
        aria-label="Frequency tuner"
        aria-valuemin={70}
        aria-valuemax={114}
        aria-valuenow={freq}
        aria-valuetext={`${freq.toFixed(1)} megahertz`}
        className="relative mt-6 py-6 select-none outline-none cursor-grab"
      >
        {/* band track */}
        <div className="relative border-3 border-black rounded-full bg-black/5 h-3">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--cobalt)]"
            style={{ width: `${Math.min(100, Math.max(0, ((freq - 70) / 44) * 100))}%` }}
          />
        </div>
        {/* tick marks */}
        <div className="absolute inset-x-0 top-0 flex justify-between px-2">
          {renderTicks(70, 114, TICK).map(f => (
            <div key={f} className="h-4 w-px bg-black/40" />
          ))}
        </div>
        {/* discovered station dots */}
        <div className="absolute inset-x-0 top-0 pointer-events-none">
          {STATIONS.map(s => {
            const left = Math.max(0, Math.min(100, ((s.freq - 70) / 44) * 100))
            return (
              <div key={s.id} className="absolute -translate-x-1/2"
                style={{ left: `${left}%` }}>
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: locked.some(l => l.id === s.id) ? 'var(--green)' : 'var(--pink)' }}
                />
              </div>
            )
          })}
        </div>
        {/* needle */}
        <div
          className="absolute -top-1 h-7 w-1.5 bg-[var(--pink)] shadow-[2px_2px_0_#16130F] snap transition-[left] duration-100"
          style={{ left: `calc(${pct}% - 3px)` }}
        >
          <div className="absolute -top-2 -left-[5px] h-3 w-3 rounded-full bg-black" />
        </div>
      </div>

      {/* Frequency readout */}
      <div className="flex items-end justify-between mt-2">
        <div className="flex items-baseline gap-2">
          <span className="display text-4xl leading-none">{freq.toFixed(1)}</span>
          <span className="mono text-xs uppercase">MHz</span>
        </div>
        <div className="flex items-end gap-1 h-8">
          {[1, 2, 3, 4, 5].map(bar => {
            const filled = current ? bar <= current.signal : bar <= 0
            return (
              <div
                key={bar}
                className={`w-2 ${filled ? (current?.id === 'void' ? 'bg-[var(--pink)]' : 'bg-[var(--cobalt)]') : 'bg-black/15'} ${current ? '' : 'static-flicker'}`}
                style={{ height: `${bar * 5 + 4}px` }}
              />
            )
          })}
        </div>
      </div>

      {/* Revealed dish */}
      {current ? (
        <div key={current.id} className="dish-reveal mt-4 border-3 border-black rounded-lg overflow-hidden">
          <div
            className="px-3 py-1 display text-sm uppercase tracking-wide flex justify-between"
            style={{ background: current.stripe === 'pink' ? 'var(--pink)' : current.stripe === 'yellow' ? 'var(--yellow)' : 'var(--green)', color: 'var(--ink)' }}
          >
            <span>{current.name}</span>
            <span className="mono text-xs normal-case">{current.freq.toFixed(1)} FM</span>
          </div>
          <div className="p-3">
            <p className="font-bold">hosted by {current.host}</p>
            <p className="text-sm opacity-80 italic">“{current.tagline}”</p>
            <p className="text-sm mt-1">flavor: {current.flavor}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {current.vibe.map(v => (
                <span key={v} className="mono text-[10px] uppercase px-2 py-0.5 bg-black text-[#FFF4DC]">{v}</span>
              ))}
            </div>
            <button
              onClick={lockCurrent}
              className="lift mono text-xs uppercase px-3 py-1.5 border-3 border-black mt-3 bg-[var(--yellow)] cursor-pointer"
            >
              {current.id === 'void' ? '★ Enter The Void ★' : 'Bring this dish'}
            </button>
            {current.id === 'void' && <p className="crackle mono text-[11px] mt-2 text-[var(--cobalt)]">⟨kpshhh⟩ you found the void…</p>}
          </div>
        </div>
      ) : (
        <div className="mt-4 border-3 border-dashed border-black rounded-lg p-3 text-center">
          <p className="mono text-xs uppercase tracking-widest static-flicker" key={crackle}>⟨ KSSSH ⟩ tuning… nothing yet</p>
        </div>
      )}

      <p className="mono text-[11px] uppercase mt-3 tracking-wide opacity-70">
        {locked.length} dish{locked.length === 1 ? '' : 'es'} on the board
      </p>
    </section>
  )
}