import { useCallback, useEffect, useRef, useState } from 'react'
import type { View } from './components/types'
import { MossCanvas } from './components/MossCanvas'
import { ClockBlock } from './components/ClockBlock'
import { BreathPanel } from './components/BreathPanel'
import { StatsLedger } from './components/StatsLedger'
import { StillnessGauge } from './components/StillnessGauge'
import { HelpStrip } from './components/HelpStrip'
import { HelpOverlay } from './components/HelpOverlay'
import type { SimState } from './sim'
import {
  MAX_DT,
  clamp,
  createSim,
  formatPct,
  noteHidden,
  noteKey,
  noteMouse,
  pauseBreath,
  phaseOf,
  shiftPhase,
  tickSim,
  toggleBreath,
  wipeSim,
} from './sim'
import { clearSave, loadSave, saveSim } from './storage'

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function buildView(sim: SimState, now: number): View {
  const d = new Date(now)
  const ph = phaseOf(sim, now)
  return {
    hh: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
    date: DATE_FMT.format(d).toUpperCase(),
    phaseId: ph.id,
    phaseRemaining: ph.remaining,
    phaseProgress: ph.progress,
    running: sim.breath.running,
    started: sim.breath.started,
    sessionCycles: sim.breath.cycles,
    score: Math.round(sim.still.score),
    peak: Math.round(sim.still.peak),
    best: Math.round(sim.still.best),
    coverage: sim.moss.coverage,
    lushness: sim.moss.lushness,
    calm: sim.moss.calmSeconds,
    lifetimeCycles: sim.moss.cycles,
    disturbed: sim.still.score < 30,
    resetArmed: sim.resetArmedAt > 0,
  }
}

export default function App() {
  const [simState] = useState<SimState>(() => createSim(loadSave()))
  const simRef = useRef<SimState | null>(null)
  useEffect(() => {
    simRef.current = simState
  }, [simState])

  const [view, setView] = useState<View>(() => buildView(simState, Date.now()))
  const [helpOpen, setHelpOpen] = useState(false)

  const helpRef = useRef(false)
  const resetTimerRef = useRef(0)

  const sync = useCallback(() => {
    setView(buildView(simRef.current!, Date.now()))
  }, [])

  const armReset = useCallback(() => {
    const sim = simRef.current!
    const t = Date.now()
    if (sim.resetArmedAt && t - sim.resetArmedAt < 3500) {
      wipeSim(sim, t)
      clearSave()
      saveSim(sim.moss, sim.still.best)
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    } else {
      sim.resetArmedAt = t
      resetTimerRef.current = window.setTimeout(() => {
        sim.resetArmedAt = 0
        sync()
      }, 3500)
    }
    sync()
  }, [sync])

  const toggle = useCallback(() => {
    toggleBreath(simRef.current!, Date.now())
    sync()
  }, [sync])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastSync = 0
    const loop = (t: number) => {
      const sim = simRef.current!
      const dt = clamp((t - last) / 1000, 0, MAX_DT)
      last = t
      const now = Date.now()
      tickSim(sim, dt, now)
      if (now - lastSync >= 100) {
        lastSync = now
        setView(buildView(sim, now))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const save = () => {
      const sim = simRef.current
      if (sim) saveSim(sim.moss, sim.still.best)
    }
    const iv = window.setInterval(save, 5000)
    const boot = window.setTimeout(save, 800)
    window.addEventListener('pagehide', save)
    return () => {
      window.clearInterval(iv)
      window.clearTimeout(boot)
      window.removeEventListener('pagehide', save)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const sim = simRef.current!
      const t = Date.now()
      const tgt = e.target instanceof Element ? e.target : null
      const inButton = !!tgt?.closest('button')

      if (e.key === 'Escape') {
        if (helpRef.current) {
          setHelpOpen(false)
          helpRef.current = false
          return
        }
        if (sim.breath.running) {
          pauseBreath(sim, t)
          sync()
        }
        return
      }
      if (helpRef.current) {
        if (e.key === ' ' || e.key === '?' || e.key.toLowerCase() === 'h') {
          e.preventDefault()
          setHelpOpen(false)
          helpRef.current = false
        }
        return
      }
      if (e.key === '?' || e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setHelpOpen(true)
        helpRef.current = true
        return
      }
      if (e.key === ' ' && !inButton) {
        e.preventDefault()
        toggleBreath(sim, t)
        sync()
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        shiftPhase(sim, e.key === 'ArrowLeft' ? -1 : 1, t)
        sync()
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        armReset()
        return
      }
      noteKey(sim, t)
      sync()
    }

    const onMove = (e: MouseEvent) => {
      noteMouse(simRef.current!, e.clientX, e.clientY, Date.now())
    }
    const onVis = () => {
      if (document.hidden) {
        noteHidden(simRef.current!)
        pauseBreath(simRef.current!, Date.now())
        saveSim(simRef.current!.moss, simRef.current!.still.best)
        sync()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [armReset, sync])

  const closeHelp = () => {
    setHelpOpen(false)
    helpRef.current = false
  }

  return (
    <div className={`app-frame${view.disturbed ? ' alarm-state' : ''}`}>
      <header className="hdr">
        <span className="hdr-title">MOSS CLOCK</span>
        <span className="hdr-mid mono-mini">TIME / MOSS / STILL — ONE MACHINE</span>
        <span className="stamp stamp-horiz">FIELD UNIT 07</span>
      </header>

      <ClockBlock view={view} />

      <section className="panel moss-block" aria-label="Moss habitat">
        <div className="stamp stamp-vert">HABITAT/02</div>
        <MossCanvas simRef={simRef} />
        <div className="moss-readout">
          <span className="mono-mini">COVER {formatPct(view.coverage)}</span>
          <span className="mono-mini">LUSH {formatPct(view.lushness)}</span>
        </div>
      </section>

      <BreathPanel view={view} onToggle={toggle} />
      <StatsLedger view={view} onReset={armReset} />
      <StillnessGauge view={view} />
      <HelpStrip />

      {helpOpen && <HelpOverlay onClose={closeHelp} />}
    </div>
  )
}