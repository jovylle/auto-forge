import { useEffect, useReducer, useRef, useState } from 'react'
import type { ChangeEvent as RCE, CSSProperties, PointerEvent as RPE } from 'react'
import { KEYMAP, PAD_DEFS, engine } from './audio'

function useEngine(): void {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => engine.subscribe(bump), [])
}

function strikeVelocity(e: RPE<HTMLButtonElement>): number {
  const p = e.nativeEvent.pressure
  if (p > 0 && p <= 1) return Math.min(1, Math.max(0.15, p))
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  return 0.35 + 0.65 * Math.min(1, Math.max(0, y))
}

const BLOBS = ['blob-a', 'blob-b', 'blob-c'] as const
const PAD_SIZES = ['lg', 'md', 'lg', 'md', 'sm', 'md', 'sm', 'sm', 'md', 'md', 'sm', 'md', 'sm', 'md', 'lg', 'md'] as const
const SIZE_CLASS: Record<string, string> = {
  lg: 'h-28 w-28 md:h-32 md:w-32',
  md: 'h-24 w-24 md:h-28 md:w-28',
  sm: 'h-20 w-20 md:h-24 md:w-24',
}

function Pad({ i }: { i: number }) {
  const def = PAD_DEFS[i]
  if (!def) return null
  const size = PAD_SIZES[i] ?? 'md'
  const blob = BLOBS[i % 3] ?? 'blob-a'
  const hit = engine.lastHit.pad === i ? engine.lastHit : null
  return (
    <button
      type="button"
      aria-label={`${def.name} drum pad, keyboard key ${def.key}`}
      onPointerDown={(e) => {
        e.preventDefault()
        engine.playPad(i, strikeVelocity(e))
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`pad breathe ${blob} ${SIZE_CLASS[size] ?? ''}`}
      style={{ animationDelay: `${(i * 0.7).toFixed(1)}s` }}
    >
      <span className="font-display text-xl leading-none md:text-2xl">{i + 1}</span>
      <span className="text-[10px] uppercase tracking-widest opacity-80">{def.name}</span>
      <span className="text-[10px] opacity-50">[{def.key}]</span>
      {hit && (
        <span
          key={hit.n}
          className="pad-flash"
          style={{ '--fo': (0.25 + 0.75 * hit.vel).toFixed(2) } as CSSProperties}
        />
      )}
    </button>
  )
}

function PadField() {
  useEngine()
  const rows = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ]
  return (
    <section aria-label="Drum pads" className="flex flex-col gap-4 md:gap-5">
      {rows.map((row, r) => (
        <div key={r} className={`flex flex-wrap items-center gap-3 md:gap-4 ${r % 2 === 1 ? 'md:ml-12' : ''}`}>
          {row.map((i) => (
            <Pad key={i} i={i} />
          ))}
        </div>
      ))}
      <p className="mt-1 max-w-md text-[11px] leading-relaxed opacity-60">
        Strike lower on a pad for a louder hit — pen and touch pressure work too.
        Keys <span className="text-spore">1–4 · QWER · ASDF · ZXCV</span> play soft-to-loud at fixed velocity.
      </p>
    </section>
  )
}

function TempoCell() {
  useEngine()
  const [tapKey, setTapKey] = useState(0)
  const pulseRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const el = pulseRef.current
      if (el) el.style.setProperty('--beat', engine.position().beat.toFixed(3))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <section aria-label="Tempo and transport" className="flex flex-col gap-4">
      <div
        ref={pulseRef}
        className="tempo-blob blob-b breathe border border-fern/50 px-6 py-5"
        style={{ animationDelay: '2.4s' }}
      >
        <div className="text-[11px] uppercase tracking-[0.25em] opacity-70">tempo · tap the firefly</div>
        <div className="font-display text-6xl leading-none">
          {engine.bpm}
          <span className="ml-2 align-middle text-sm opacity-60">bpm</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="Tap tempo"
            onPointerDown={(e) => {
              e.preventDefault()
              engine.tap()
              setTapKey((k) => k + 1)
            }}
            className="blob-a relative h-16 w-16 border border-firefly bg-firefly/25 text-2xl text-firefly transition-transform active:scale-90"
          >
            ●
            <span key={tapKey} className="tap-flash pointer-events-none absolute inset-0 blob-a" />
          </button>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => engine.setBpm(engine.bpm + 1)} aria-label="Tempo up" className="rounded-full border border-fern/50 px-3 py-0.5 text-sm hover:border-spore">+</button>
            <button type="button" onClick={() => engine.setBpm(engine.bpm - 1)} aria-label="Tempo down" className="rounded-full border border-fern/50 px-3 py-0.5 text-sm hover:border-spore">−</button>
          </div>
          <input
            type="range"
            className="fader min-w-0 flex-1"
            aria-label="Tempo slider"
            min={60}
            max={180}
            step={1}
            value={engine.bpm}
            onChange={(e: RCE<HTMLInputElement>) => engine.setBpm(Number(e.target.value))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest">
          <button
            type="button"
            onClick={() => engine.togglePlay()}
            aria-pressed={engine.playing}
            className={`rounded-full border px-4 py-1.5 ${engine.playing ? 'border-spore bg-spore text-ink' : 'border-spore/60 text-spore'}`}
          >
            {engine.playing ? '■ rest' : '▶ wake'}
          </button>
          <button
            type="button"
            onClick={() => engine.toggleMetro()}
            aria-pressed={engine.metroOn}
            className={`rounded-full border px-4 py-1.5 ${engine.metroOn ? 'border-bone/70 text-bone' : 'border-bone/25 text-bone/50'}`}
          >
            click {engine.metroOn ? 'on' : 'off'}
          </button>
          <div className="ml-1 flex items-center gap-1" role="group" aria-label="Loop length in bars">
            {[1, 2, 4].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => engine.setBars(b)}
                aria-pressed={engine.bars === b}
                className={`rounded-full border px-3 py-1.5 ${engine.bars === b ? 'border-firefly text-firefly' : 'border-bone/25 text-bone/50'}`}
              >
                {b}bar
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Fader({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-0.5 flex items-center justify-between text-[11px] uppercase tracking-widest">
        <span className="opacity-70">{label}</span>
        <span className="text-spore">{display}</span>
      </div>
      <input
        type="range"
        className="fader"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: RCE<HTMLInputElement>) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function FxStalk() {
  useEngine()
  const cutoffDisplay = engine.cutoff >= 1000 ? `${(engine.cutoff / 1000).toFixed(1)}k` : `${Math.round(engine.cutoff)}`
  return (
    <section aria-label="Delay and filter effects" className="flex flex-col gap-4 border-t border-fern/30 pt-4">
      <h2 className="text-[11px] uppercase tracking-[0.25em] opacity-70">fx stalk · dub it out</h2>
      <Fader label="delay time" value={engine.delayTime} min={0} max={1} step={0.01} display={`${Math.round(engine.delayTime * 1000)}ms`} onChange={(v) => engine.setDelay(v, engine.feedback)} />
      <Fader label="feedback" value={engine.feedback} min={0} max={0.85} step={0.01} display={`${Math.round(engine.feedback * 100)}%`} onChange={(v) => engine.setDelay(engine.delayTime, v)} />
      <Fader label="filter cutoff" value={engine.cutoff} min={200} max={12000} step={50} display={`${cutoffDisplay}Hz`} onChange={(v) => engine.setFilter(v, engine.reso)} />
      <Fader label="resonance" value={engine.reso} min={0} max={12} step={0.1} display={`Q ${engine.reso.toFixed(1)}`} onChange={(v) => engine.setFilter(engine.cutoff, v)} />
      <p className="text-[11px] leading-relaxed opacity-60">Voices swim through the lowpass first, then the delay. Long time + high feedback + dark filter = pond at midnight.</p>
    </section>
  )
}

const TRACK_TINT = [
  { dot: 'bg-spore', ring: 'border-spore/40', name: 'Moss' },
  { dot: 'bg-fern', ring: 'border-fern/60', name: 'Dew' },
  { dot: 'bg-firefly', ring: 'border-firefly/50', name: 'Ember' },
  { dot: 'bg-bone', ring: 'border-bone/40', name: 'Marrow' },
] as const

function Lanes() {
  useEngine()
  const heads = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const phase = engine.position().phase
      for (const el of heads.current) {
        if (el) el.style.left = `${(phase * 100).toFixed(2)}%`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const dur = engine.loopDur()
  return (
    <section aria-label="Loop recorder tracks" className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h2 className="font-display text-3xl italic">soil strata — four looping tracks</h2>
        <button type="button" onClick={() => engine.clearAll()} className="text-[11px] uppercase tracking-widest text-bone/60 underline decoration-fern/60 underline-offset-4 hover:text-bone">
          release all loops
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {engine.tracks.map((tr, i) => {
          const tint = TRACK_TINT[i] ?? TRACK_TINT[0]!
          const capturing = engine.capturing[i] ?? false
          return (
            <article
              key={i}
              aria-label={`Track ${i + 1} ${tint.name}`}
              className={`relative border ${tint.ring} bg-ink/60 p-4 ${capturing ? 'lane-live border-firefly/70' : ''}`}
              style={{ borderRadius: '2rem 1.4rem 2.2rem 1.5rem / 1.5rem 2.2rem 1.4rem 2rem' }}
            >
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest">
                <span>
                  T{i + 1} · {tint.name}
                  <span className="ml-2 opacity-60">{tr.events.length} hits</span>
                </span>
                <span className={capturing ? 'text-firefly' : 'opacity-50'}>
                  {capturing ? '● capturing' : tr.muted ? 'muted' : engine.playing ? 'looping' : 'resting'}
                </span>
              </div>
              <div className="relative h-12 overflow-hidden rounded-full border border-bone/15 bg-ink" role="img" aria-label={`${tr.events.length} recorded hits on track ${i + 1}`}>
                {tr.events.length === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] opacity-40">
                    press ● then strike pads
                  </span>
                )}
                {tr.events.map((ev, k) => (
                  <span
                    key={k}
                    className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${tint.dot}`}
                    style={{ left: `${(Math.min(ev.t, dur) / dur) * 100}%`, opacity: 0.35 + 0.65 * ev.vel }}
                  />
                ))}
                {engine.playing && (
                  <div
                    ref={(el) => {
                      heads.current[i] = el
                    }}
                    className="playhead"
                    style={{ left: '0%' }}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest">
                <button
                  type="button"
                  onClick={() => engine.toggleCapture(i)}
                  aria-pressed={capturing}
                  aria-label={capturing ? `Stop capturing on track ${i + 1}` : `Record on track ${i + 1}`}
                  className={`rounded-full border px-4 py-1.5 ${capturing ? 'border-firefly bg-firefly text-ink' : 'border-firefly/60 text-firefly'}`}
                >
                  {capturing ? '■ stop' : tr.events.length > 0 ? '● overdub' : '● record'}
                </button>
                <button
                  type="button"
                  onClick={() => engine.toggleMute(i)}
                  aria-pressed={tr.muted}
                  aria-label={tr.muted ? `Unmute track ${i + 1}` : `Mute track ${i + 1}`}
                  className={`rounded-full border px-4 py-1.5 ${tr.muted ? 'border-bone bg-bone text-ink' : 'border-bone/40 text-bone/80'}`}
                >
                  {tr.muted ? 'unmute' : 'mute'}
                </button>
                <button
                  type="button"
                  onClick={() => engine.clearTrack(i)}
                  aria-label={`Clear track ${i + 1}`}
                  className="rounded-full border border-bone/25 px-4 py-1.5 text-bone/60 hover:text-bone"
                >
                  clear
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function App() {
  useEngine()
  useEffect(() => {
    const wake = () => engine.ensure()
    window.addEventListener('pointerdown', wake, { once: true })
    return () => window.removeEventListener('pointerdown', wake)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'INPUT') return
      if ((tag === 'BUTTON' || tag === 'A') && (e.key === ' ' || e.key === 'Enter')) return
      const lower = e.key.toLowerCase()
      const idx = KEYMAP[lower]
      if (idx !== undefined) {
        engine.playPad(idx, 0.85)
      } else if (e.key === ' ') {
        e.preventDefault()
        engine.togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-5 pb-16 pt-8 md:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.3em] text-fern">a meadow of lo-fi loops</p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">
            Fable Cricket <span className="italic text-spore">Loop Lab</span>
          </h1>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-widest ${engine.playing ? 'border-spore/60 text-spore' : 'border-bone/25 text-bone/60'}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{engine.playing ? '●' : '○'}</span>
          {engine.playing ? `live · ${engine.bars * 4}-beat loops` : 'resting — press ▶ wake'}
        </div>
      </header>

      <main className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PadField />
        <aside className="flex flex-col gap-6 lg:pt-2">
          <TempoCell />
          <FxStalk />
        </aside>
      </main>

      <Lanes />

      <footer className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-fern/30 pt-5 text-[11px] leading-relaxed opacity-70">
        <p>
          <span className="text-spore">space</span> wake / rest ·{' '}
          <span className="text-spore">1–4 QWER ASDF ZXCV</span> pads · strike lower = louder
        </p>
        <p>3 hues + ink &amp; bone · every sound synthesized live in WebAudio · loops persist in this browser</p>
      </footer>
    </div>
  )
}
