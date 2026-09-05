import { useEffect, useMemo, useRef, useState } from 'react'
import { MIN_FREQ, MAX_FREQ, fmtFreq } from '../lib/stations'

const BAND = MAX_FREQ - MIN_FREQ
const SWEEP_DEG = 300

function freqToRot(f: number): number {
  return ((f - MIN_FREQ) / BAND) * SWEEP_DEG - SWEEP_DEG / 2
}

function rotToFreq(rot: number): number {
  const clamped = Math.max(-SWEEP_DEG / 2, Math.min(SWEEP_DEG / 2, rot))
  return MIN_FREQ + ((clamped + SWEEP_DEG / 2) / SWEEP_DEG) * BAND
}

function clampFreq(f: number): number {
  const c = Math.max(MIN_FREQ, Math.min(MAX_FREQ, f))
  return Math.round(c * 10) / 10
}

function angleOf(elem: HTMLElement, clientX: number, clientY: number): number {
  const r = elem.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
}

type Props = {
  freq: number
  locked: boolean
  lockLabel: string
  onChange: (f: number) => void
}

export default function Tuner({ freq, locked, lockLabel, onChange }: Props) {
  const rulerRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ mode: 'knob'; startRot: number; startAngle: number } | null>(null)
  const dragging = useRef(false)
  const lastStep = useRef(freq)
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem('ghost-antenna:seen') === null
    } catch {
      return false
    }
  })
  const [bump, setBump] = useState(0)

  useEffect(() => {
    lastStep.current = freq
  }, [freq])

  const ticks = useMemo(() => {
    const majors: number[] = []
    const minors: number[] = []
    for (let f = Math.ceil(MIN_FREQ); f <= MAX_FREQ; f++) {
      majors.push(f)
      minors.push(f - 0.5)
    }
    return { majors, minors }
  }, [])

  const setFreq = (f: number) => {
    const next = clampFreq(f)
    if (next === lastStep.current) return
    try {
      navigator.vibrate?.(8)
    } catch {
      /* no haptics */
    }
    onChange(next)
  }

  const onRulerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  const onRulerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }

  const updateFromClientX = (clientX: number) => {
    const el = rulerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setFreq(MIN_FREQ + p * BAND)
  }

  const onRulerUp = () => {
    dragging.current = false
  }

  const onKnobDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = knobRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    drag.current = {
      mode: 'knob',
      startRot: freqToRot(freq),
      startAngle: angleOf(el, e.clientX, e.clientY),
    }
  }

  const onKnobMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = knobRef.current
    if (!d || !el) return
    const a = angleOf(el, e.clientX, e.clientY)
    let delta = a - d.startAngle
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    setFreq(rotToFreq(d.startRot + delta))
  }

  const onKnobUp = () => {
    drag.current = null
  }

  const triggerBump = () => setBump((b) => b + 1)

  const [whole, frac] = fmtFreq(freq).split('.')
  const needleLeft = ((freq - MIN_FREQ) / BAND) * 100

  return (
    <section
      className="panel panel-torn scratch wobble-a relative p-4 sm:p-5"
      aria-label="message tuner"
      onPointerDown={() => {
        if (hint) {
          setHint(false)
          try {
            localStorage.setItem('ghost-antenna:seen', '1')
          } catch {
            /* storage unavailable */
          }
        }
      }}
    >
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div className="relative shrink-0 self-center sm:self-auto">
          <div
            ref={knobRef}
            className="knob"
            style={{ transform: `rotate(${freqToRot(freq)}deg)` }}
            onPointerDown={onKnobDown}
            onPointerMove={onKnobMove}
            onPointerUp={onKnobUp}
            onPointerCancel={onKnobUp}
            role="slider"
            aria-label="tune frequency"
            aria-valuemin={MIN_FREQ}
            aria-valuemax={MAX_FREQ}
            aria-valuenow={freq}
            aria-valuetext={`${fmtFreq(freq)} megahertz`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                setFreq(freq + 0.1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                setFreq(freq - 0.1)
              }
            }}
            onFocus={() => triggerBump()}
          >
            <div className="knob-mark" />
            <div className={`knob-lamp ${locked ? 'locked' : ''}`} aria-hidden="true" />
          </div>
          {hint && (
            <div className="dial-hint absolute left-1/2 top-full mt-2 -translate-x-1/2 sm:left-auto sm:right-[-6px] sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:translate-x-full">
              drag the dial
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="readout" key={bump}>
              <span className="roll">{whole}</span>
              <span className="text-[0.5em] opacity-70">.</span>
              <span className="roll">{frac ?? '0'}</span>
              <span className="ml-1 text-[0.45em] tracking-[0.2em] opacity-70">MHz</span>
            </div>
            <div
              className={`min-w-0 truncate font-crt text-sm tracking-[0.18em] uppercase ${
                locked ? 'text-phosphor' : 'text-bone/50'
              }`}
            >
              {locked ? `▣ lock ${lockLabel}` : '··· scanning'}
            </div>
          </div>

          <div
            ref={rulerRef}
            className="ruler mt-3"
            onPointerDown={onRulerDown}
            onPointerMove={onRulerMove}
            onPointerUp={onRulerUp}
            onPointerCancel={onRulerUp}
            role="slider"
            aria-label="frequency ruler"
            aria-valuemin={MIN_FREQ}
            aria-valuemax={MAX_FREQ}
            aria-valuenow={freq}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                setFreq(freq + 0.1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                setFreq(freq - 0.1)
              }
            }}
          >
            {ticks.minors.map((f) => (
              <div key={`m${f}`} className="ruler-minor" style={{ left: `${((f - MIN_FREQ) / BAND) * 100}%` }} />
            ))}
            {ticks.majors.map((f) => (
              <div key={`t${f}`} className="ruler-tick" style={{ left: `${((f - MIN_FREQ) / BAND) * 100}%` }}>
                <span className={`ruler-label ${f % 2 === 0 ? '' : 'hidden sm:block'}`}>{f}</span>
              </div>
            ))}
            <div className="ruler-needle" style={{ left: `${needleLeft}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between font-crt text-xs tracking-[0.2em] text-bone/40 uppercase">
            <span>87.5</span>
            <span className="hidden sm:inline">keys ← → to scan</span>
            <span>108.0</span>
          </div>
        </div>
      </div>
    </section>
  )
}