import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Tuner from './components/Tuner'
import Decode from './components/Decode'
import StaticViz from './components/StaticViz'
import SignalBoard from './components/SignalBoard'
import Composer from './components/Composer'
import {
  MIN_FREQ,
  MAX_FREQ,
  OWN_FREQ,
  dailySeed,
  generateEtherStations,
  fmtFreq,
  type Signal,
} from './lib/stations'
import { loadLog, saveLog, loadBroadcast, saveBroadcast } from './lib/storage'

function clampFreq(f: number): number {
  return Math.round(Math.max(MIN_FREQ, Math.min(MAX_FREQ, f)) * 10) / 10
}

export default function App() {
  const [freq, setFreq] = useState(94.0)
  const [log, setLog] = useState<Signal[]>(() => {
    const existing = loadLog()
    if (existing.length) return existing
    const seeded = generateEtherStations(dailySeed())
    const first = seeded.find((s) => Math.abs(s.freq - 95.1) < 0.01) ?? seeded[0]
    return first ? [{ ...first, at: Date.now() }] : []
  })
  const [broadcast, setBroadcast] = useState<Signal | null>(() => loadBroadcast())
  const [lockNonce, setLockNonce] = useState(0)
  const [newestId, setNewestId] = useState<string | null>(null)
  const [stamp, setStamp] = useState(false)
  const [sweep, setSweep] = useState(false)

  const seed = dailySeed()
  const ether = useMemo(() => generateEtherStations(seed), [seed])

  const allSignals = useMemo(() => {
    const merged = broadcast
      ? [...ether.filter((s) => Math.abs(s.freq - OWN_FREQ) > 0.1), broadcast]
      : ether
    return [...merged].sort((a, b) => a.freq - b.freq)
  }, [ether, broadcast])

  const nearest = useMemo(() => {
    let best: Signal | null = null
    let bestDist = Infinity
    for (const s of allSignals) {
      const d = Math.abs(freq - s.freq)
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    }
    return best
  }, [freq, allSignals])

  const dist = nearest ? Math.abs(freq - nearest.freq) : Infinity
  const locked = nearest !== null && dist <= 0.2
  const intensity = locked ? 0.12 : 0.05 + 0.9 * Math.min(1, dist / 2)
  const decodeText = locked && nearest ? nearest.message : ''
  const lockLabel = locked && nearest ? `${nearest.callsign} · ${fmtFreq(nearest.freq)}` : ''

  const lastLockId = useRef<string | null>(null)

  const addToLog = useCallback((sig: Signal) => {
    setLog((prev) => {
      if (prev.some((x) => x.id === sig.id)) return prev
      return [sig, ...prev].slice(0, 30)
    })
  }, [])

  useEffect(() => {
    if (locked && nearest && nearest.id !== lastLockId.current) {
      lastLockId.current = nearest.id
      setLockNonce((n) => n + 1)
      setNewestId(nearest.id)
      if (nearest.source === 'ether') addToLog({ ...nearest, at: Date.now() })
    }
  }, [locked, nearest, addToLog])

  useEffect(() => {
    saveLog(log)
  }, [log])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest?.('[role="slider"]'))) {
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFreq((f) => clampFreq(f + 0.1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFreq((f) => clampFreq(f - 0.1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleBroadcast = useCallback((message: string) => {
    const sig: Signal = {
      id: `you:${Date.now()}`,
      freq: OWN_FREQ,
      callsign: 'YOU',
      message,
      strength: 5,
      source: 'yours',
      at: Date.now(),
    }
    setBroadcast(sig)
    saveBroadcast(sig)
    setLog((prev) => [{ ...sig }, ...prev.filter((x) => x.source !== 'yours')].slice(0, 30))
    setNewestId(sig.id)
    setSweep(true)
    setStamp(true)
    window.setTimeout(() => setSweep(false), 450)
    window.setTimeout(() => setStamp(false), 700)
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="ether-wash" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="header-jitter relative z-10 border-b-2 border-bone/70 bg-soot py-2">
        <div className="marquee font-crt text-xs tracking-[0.28em] text-bone/60 uppercase">
          <span className="marquee-inner">
            {[0, 1].map((i) => (
              <span key={i} className="inline-block">
                ghost antenna ◦ 87.5–108.0 mhz ◦ received {log.length} ◦ your frequency {fmtFreq(OWN_FREQ)} ◦ the ether keeps what you send ◦&nbsp;
              </span>
            ))}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pt-5 pb-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8 lg:pb-12">
        <div className="order-1 flex flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:order-none">
          <div className="crt wobble-c">
            <div className="crt-glass">
              <StaticViz target={intensity} />
              <div className="crt-roll" aria-hidden="true" />
              <Decode text={decodeText} nonce={lockNonce} locked={locked} lockLabel={lockLabel} />
            </div>
          </div>
          <div className="hidden lg:block">
            <Composer hasBroadcast={broadcast !== null} onBroadcast={handleBroadcast} />
          </div>
        </div>

        <div className="order-2 flex flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:order-none">
          <Tuner freq={freq} locked={locked} lockLabel={lockLabel} onChange={setFreq} />
          <SignalBoard signals={log} newestId={newestId} />
          <p className="hidden px-2 font-hand text-sm text-bone/35 italic lg:block">
            no names. no accounts. tune in, leave a message, vanish.
          </p>
        </div>
      </main>

      <div className="sticky bottom-0 z-30 px-3 pb-3 lg:hidden">
        <div className="border-2 border-soot bg-soot shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
          <Composer hasBroadcast={broadcast !== null} onBroadcast={handleBroadcast} />
        </div>
      </div>

      {sweep && (
        <div className="carrier-sweep" aria-hidden="true">
          <i />
        </div>
      )}
      {stamp && (
        <div className="stamp" role="status">
          broadcast
        </div>
      )}
    </div>
  )
}