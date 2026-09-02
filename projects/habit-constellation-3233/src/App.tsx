import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Habit {
  id: string
  name: string
  createdAt: number
  x: number
  y: number
  streak: number
  best: number
  lastDone: string // yyyy-mm-dd
}

const STORAGE_KEY = 'habit-constellation:v1'
const AMBIENT_COUNT = 200

const PINK = '#ff2e97'
const CYAN = '#00e5ff'
const WHITE = '#ffffff'

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// deterministic hash seed for stable star positions
function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Habit[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((h) => ({ ...h }))
  } catch {
    return []
  }
}

function useHabits() {
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    } catch {
      /* storage unavailable */
    }
  }, [habits])

  return [habits, setHabits] as const
}

export default function App() {
  const [habits, setHabits] = useHabits()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<number>(0)
  const [activeStar, setActiveStar] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = todayStr()
  const yesterday = yesterdayStr()

  const doneToday = useMemo(() => habits.filter((h) => h.lastDone === today).length, [habits, today])
  const todayTotal = habits.length

  const addHabit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const n = name.trim()
      if (!n) return
      const seed = hashSeed(n + Date.now().toString(36))
      const habit: Habit = {
        id: `h-${Date.now().toString(36)}-${seed.toString(36)}`,
        name: n,
        createdAt: Date.now(),
        x: 6 + (seed % 89), // 6..94
        y: 8 + ((seed >> 8) % 73), // 8..80 (% of sky height)
        streak: 0,
        best: 0,
        lastDone: '',
      }
      setHabits((prev) => [...prev, habit])
      setSelected(habits.length)
      setName('')
      inputRef.current?.focus()
    },
    [name, habits.length],
  )

  const toggleToday = useCallback(
    (id: string) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h
          if (h.lastDone === today) {
            const streak = Math.max(0, h.streak - 1)
            return { ...h, lastDone: yesterday, streak, best: Math.max(h.best, streak) }
          }
          const streak = h.lastDone === yesterday || h.lastDone === '' ? h.streak + 1 : 1
          return { ...h, lastDone: today, streak, best: Math.max(h.best, streak) }
        }),
      )
    },
    [today, yesterday],
  )

  const removeHabit = useCallback(
    (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id))
      setRemoving(null)
      setSelected((s) => Math.max(0, s - 1))
    },
    [setHabits],
  )

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT'
      if ((e.key === 'n' || e.key === '/') && !inInput) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (inInput) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(habits.length - 1, s + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(0, s - 1))
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const h = habits[selected]
        if (h) {
          if (removing === h.id) removeHabit(h.id)
          else setRemoving(h.id)
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        if (removing && (e.key === 'y' || e.key === 'Y')) {
          removeHabit(removing)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [habits, selected, removing, removeHabit])

  // scroll selected row into view
  useEffect(() => {
    if (listRef.current) {
      const row = listRef.current.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null
      row?.scrollIntoView({ block: 'nearest' })
    }
  }, [selected])

  const bestStreak = useMemo(() => habits.reduce((m, h) => Math.max(m, h.best), 0), [habits])
  const activeHabit = useMemo(
    () => habits.find((h) => h.id === activeStar) ?? null,
    [habits, activeStar],
  )

  return (
    <div className="h-full w-full relative bg-void text-white font-mono">
      <StarMap
        habits={habits}
        today={today}
        activeStar={activeStar}
        onStarFocus={setActiveStar}
        onStarToggle={toggleToday}
      />

      {/* Control rail */}
      <aside
        className="rail-chamfer absolute left-0 top-0 z-10 h-full w-full sm:w-[340px] flex flex-col border-r border-neon-cyan/30 bg-void/80 backdrop-blur-[6px]"
        aria-label="Habit controls"
      >
        <header className="px-6 pt-6 pb-2">
          <h1 className="chrome-text font-display text-2xl font-black uppercase tracking-[0.3em]">
            Habit
            <br />
            Constellation
          </h1>
        </header>

        <form onSubmit={addHabit} className="px-6 pt-4 flex flex-col gap-3">
          <label htmlFor="habit-input" className="text-[11px] uppercase tracking-[0.18em] text-neon-cyan font-bold">
            Add a habit
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="habit-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. meditate"
              autoComplete="off"
              className="glow-hover flex-1 min-w-0 bg-black/40 border border-neon-purple px-3 py-2 text-sm text-white placeholder-white/40 outline-none"
            />
            <button
              type="submit"
              className="glow-hover shrink-0 bg-neon-pink/90 text-black font-bold text-sm px-4 py-2 border border-neon-pink"
            >
              ADD
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-neon-cyan/20 px-6 pt-3 pb-2 flex justify-between text-[11px] text-white/55">
          <span>STARS {habits.length}</span>
          <span>TODAY {doneToday}/{todayTotal}</span>
          <span>BEST {bestStreak}D</span>
        </div>

        {/* Habit list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1"
          role="listbox"
          aria-label="Your habits"
        >
          {habits.length === 0 && (
            <p className="px-3 py-2 text-white/40 text-xs italic">No habits yet. Add one above.</p>
          )}
          {habits.map((h, i) => {
            const done = h.lastDone === today
            const isSel = i === selected
            return (
              <div
                key={h.id}
                data-idx={i}
                role="option"
                aria-selected={isSel}
                tabIndex={-1}
                className={`group flex items-center gap-3 px-3 py-2 border text-left text-sm cursor-pointer outline-none ${
                  isSel ? 'border-neon-pink/70 bg-neon-pink/10 glow-pink' : 'border-neon-purple/40'
                }`}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
              >
                <button
                  className={`shrink-0 w-4 h-4 border flex items-center justify-center text-black text-[10px] font-bold ${
                    done ? 'bg-neon-pink border-neon-pink' : 'border-white/40'
                  }`}
                  aria-label={`Toggle ${h.name} today`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleToday(h.id)
                  }}
                >
                  {done ? '✓' : ''}
                </button>
                <button
                  className="flex-1 min-w-0 text-left"
                  aria-label={`${h.name}, ${h.streak} day streak${done ? ', done today' : ''}. Press Enter to toggle.`}
                  onClick={() => toggleToday(h.id)}
                >
                  <span className="block truncate text-white/90">{h.name}</span>
                  <span className="block text-[11px] text-white/45">
                    {h.streak}D streak{done ? ' · today ✓' : ''}
                  </span>
                </button>
                {removing === h.id && (
                  <span className="shrink-0 text-[10px] text-neon-pink italic">
                    REMOVE? <button onClick={() => removeHabit(h.id)} className="underline">Y</button>
                    <button onClick={() => setRemoving(null)} className="underline ml-2">N</button>
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <footer className="px-6 py-4 border-t border-neon-cyan/20 text-[10px] text-white/45 italic leading-relaxed">
          N / · NEW · ↑↓ SELECT · ENTER TOGGLE · DEL REMOVE
        </footer>
      </aside>

      {/* Star tooltip */}
      {activeHabit && (
        <div
          className="absolute z-30 bg-black/90 border border-neon-cyan/40 px-3 py-2 text-[12px] text-white pointer-events-none"
          style={{
            left: `${activeHabit.x}%`,
            top: `${activeHabit.y * 0.62}%`,
            transform: 'translate(16px, 16px)',
          }}
          role="tooltip"
        >
          <span className="block font-bold text-neon-cyan">{activeHabit.name}</span>
          <span className="block text-white/70">{activeHabit.streak}D streak</span>
          <span className="block text-white/45">
            last: {activeHabit.lastDone || 'never'} · best {activeHabit.best}D
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------------- Star map canvas ---------------- */

interface StarMapProps {
  habits: Habit[]
  today: string
  activeStar: string | null
  onStarFocus: (id: string) => void
  onStarToggle: (id: string) => void
}

function StarMap({ habits, today, activeStar, onStarFocus, onStarToggle }: StarMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const skyY = 0.62 // horizon at 62% of map height

  // draw ambient star field + grid + sun + constellation
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { width, height }
    }

    const ambient: { x: number; y: number; r: number; o: number; s: number }[] = []
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const seed = hashSeed(`amb${i}`)
      ambient.push({
        x: (seed % 1000) / 10,
        y: ((seed >> 8) % 600) / 10,
        r: 0.5 + ((seed >> 16) % 10) / 10,
        o: 0.2 + ((seed >> 20) % 60) / 100,
        s: 6 + ((seed >> 24) % 4),
      })
    }

    let t = 0
    const draw = () => {
      const { width, height } = resize()
      ctx.clearRect(0, 0, width, height)
      t += 0.016

      const horizonY = height * skyY

      // Nebula wash upper-left
      const neb = ctx.createRadialGradient(width * 0.18, height * 0.15, 0, width * 0.18, height * 0.15, width * 0.4)
      neb.addColorStop(0, 'rgba(138,43,226,0.08)')
      neb.addColorStop(1, 'rgba(138,43,226,0)')
      ctx.fillStyle = neb
      ctx.fillRect(0, 0, width, height)

      // Horizon line
      ctx.fillStyle = PINK
      ctx.globalAlpha = 0.7
      ctx.fillRect(0, horizonY - 1, width, 2)
      ctx.globalAlpha = 1

      // Grid floor
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, horizonY, width, height - horizonY)
      ctx.clip()
      const cell = 44
      for (let gx = 0; gx < width + cell; gx += cell) {
        ctx.strokeStyle = CYAN
        ctx.globalAlpha = 0.2
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(gx, horizonY)
        ctx.lineTo(gx - (height - horizonY) * 0.6, height)
        ctx.stroke()
      }
      for (let gy = horizonY; gy < height; gy += cell) {
        ctx.strokeStyle = CYAN
        ctx.globalAlpha = 0.12
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(width, gy)
        ctx.stroke()
      }
      ctx.restore()
      ctx.globalAlpha = 1

      // Ambient stars (sky only)
      const done = habits.filter((h) => h.lastDone === today).length
      const completion = habits.length ? done / habits.length : 0
      for (const a of ambient) {
        const aY = (a.y / 100) * horizonY
        ctx.fillStyle = WHITE
        ctx.globalAlpha = a.o * (0.6 + 0.4 * Math.sin(t * a.s))
        ctx.beginPath()
        ctx.arc((a.x / 100) * width, aY, a.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Sun (functional rise by completion)
      const sunR = Math.min(width, height) * 0.13
      const sunX = width * 0.78
      const sunBaseY = horizonY + sunR * 0.5
      const sunY = sunBaseY - completion * sunR * 0.9
      const sunO = 0.35 + completion * 0.65
      const grad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR)
      grad.addColorStop(0, PINK)
      grad.addColorStop(1, '#8a2be2')
      ctx.globalAlpha = sunO
      ctx.fillStyle = grad
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, width, horizonY + 1)
      ctx.clip()
      // slice-cut bands
      const bandH = sunR / 7
      for (let b = 0; b < 7; b++) {
        const by = sunY - sunR + b * bandH * 2.1
        ctx.beginPath()
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, by, width, bandH)
        ctx.clip()
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      ctx.restore()
      ctx.globalAlpha = 1

      // Constellation lines (creation order)
      if (habits.length > 1) {
        ctx.beginPath()
        habits.forEach((h, i) => {
          const px = (h.x / 100) * width
          const py = (h.y / 100) * horizonY
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.strokeStyle = CYAN
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [habits, today, skyY])

  const enabled = typeof window !== 'undefined'

  return (
    <div ref={wrapRef} className="absolute inset-0 z-0" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Focusable star buttons overlay */}
      <div className="absolute inset-0" aria-hidden={false}>
        {enabled &&
          habits.map((h) => {
            const done = h.lastDone === today
            const isActive = activeStar === h.id
            const r = Math.min(40, 8 + h.streak * 1.5)
            const core = Math.min(1.6, 1 + h.streak * 0.02)
            const xPct = h.x
            const yPct = h.y * 0.62
            return (
              <button
                key={h.id}
                type="button"
                className={`absolute rounded-full outline-none ${done ? 'pulse-breathe' : ''}`}
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: '24px',
                  height: '24px',
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label={`${h.name}, ${h.streak} day streak${done ? ', done today' : ''}. Press Enter to toggle.`}
                onFocus={() => onStarFocus(h.id)}
                onBlur={() => onStarFocus('')}
                onClick={() => onStarToggle(h.id)}
              >
                {/* glow */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: done ? PINK : CYAN,
                    opacity: done ? 0.9 : 0.75,
                    boxShadow: `0 0 ${r}px ${done ? PINK : CYAN}`,
                    transform: `scale(${core})`,
                  }}
                />
                {/* core */}
                <span
                  className="absolute left-1/2 top-1/2 rounded-full bg-white"
                  style={{
                    width: 3,
                    height: 3,
                    transform: `translate(-50%,-50%) scale(${core})`,
                    boxShadow: '0 0 6px #ffffff',
                  }}
                />
                {/* today halo ring */}
                {done && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: `1.5px solid ${PINK}`,
                      transform: 'scale(1.6)',
                    }}
                  />
                )}
                {/* active energize ring */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full ring-expand" style={{ border: `1px solid ${CYAN}` }} />
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}
