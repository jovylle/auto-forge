import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

const STORAGE_KEY = 'habit-constellation:v1'

type Habit = {
  id: string
  name: string
  createdAt: string
  dates: string[]
}

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayIso(): string {
  return iso(new Date())
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function currentStreak(dates: string[]): number {
  const set = new Set(dates)
  let streak = 0
  const d = new Date()
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1)
  while (set.has(iso(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function readHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (h): h is Habit =>
          !!h &&
          typeof (h as Habit).id === 'string' &&
          typeof (h as Habit).name === 'string' &&
          Array.isArray((h as Habit).dates),
      )
      .map((h) => ({
        id: h.id,
        name: h.name,
        createdAt: typeof h.createdAt === 'string' ? h.createdAt : '',
        dates: h.dates.filter((x): x is string => typeof x === 'string'),
      }))
  } catch {
    return []
  }
}

function nodePos(id: string, name: string, index: number) {
  const s1 = hashSeed(`${id}::${index}`)
  const s2 = hashSeed(`${name}::${index}`)
  const r = 0.16 + s1 * 0.62
  const a = s2 * Math.PI * 2
  return { x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.9 }
}

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(() => readHabits())
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
  }, [habits])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const dayKey = iso(now)
  const derived = useMemo(
    () =>
      habits.map((habit) => ({
        habit,
        streak: currentStreak(habit.dates),
        doneToday: habit.dates.includes(dayKey),
        hasLogs: habit.dates.length > 0,
      })),
    [habits, dayKey],
  )

  const totalCheckins = useMemo(() => habits.reduce((a, h) => a + h.dates.length, 0), [habits])
  const litCount = derived.filter((d) => d.streak > 0).length
  const maxStreak = derived.reduce((a, d) => Math.max(a, d.streak), 0)

  const addHabit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      setError('TYPE A HABIT NAME')
      return
    }
    if (habits.some((h) => h.name.toLowerCase() === n.toLowerCase())) {
      setError('THAT STAR ALREADY EXISTS')
      return
    }
    setHabits((prev) => [
      ...prev,
      { id: uid(), name: n, createdAt: new Date().toISOString(), dates: [] },
    ])
    setName('')
    setError('')
    inputRef.current?.focus()
  }

  const toggleToday = (id: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const t = todayIso()
        return h.dates.includes(t)
          ? { ...h, dates: h.dates.filter((d) => d !== t) }
          : { ...h, dates: [...h.dates, t] }
      }),
    )
  }

  const removeHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: hashSeed(`sx${i}`),
      y: hashSeed(`sy${i}`),
      r: 0.4 + hashSeed(`sr${i}`) * 1.4,
      phase: hashSeed(`sp${i}`) * Math.PI * 2,
      speed: 0.5 + hashSeed(`sv${i}`) * 1.5,
    }))

    const draw = (t: number) => {
      const nowMs = t / 1000
      ctx.clearRect(0, 0, w, h)

      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(nowMs * s.speed + s.phase))
        ctx.globalAlpha = tw * 0.7
        ctx.fillStyle = '#E8F7FF'
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      const nodes = derived.map((d, i) => ({ ...d, ...nodePos(d.habit.id, d.habit.name, i) }))

      const maxDist = Math.min(w, h) * 0.3
      ctx.setLineDash([3, 6])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0,240,255,0.5)'
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[i].x - nodes[j].x) * w
          const dy = (nodes[i].y - nodes[j].y) * h
          const dist = Math.hypot(dx, dy)
          if (dist < maxDist) {
            ctx.globalAlpha = 0.3 * (1 - dist / maxDist)
            ctx.beginPath()
            ctx.moveTo(nodes[i].x * w, nodes[i].y * h)
            ctx.lineTo(nodes[j].x * w, nodes[j].y * h)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      ctx.setLineDash([])

      for (const n of nodes) {
        const px = n.x * w
        const py = n.y * h
        const pulse = 0.5 + 0.5 * Math.sin(nowMs * 2.2 + hashSeed(n.habit.id) * Math.PI * 2)
        const hue = n.streak > 0 ? 185 + Math.min(n.streak, 30) * 3 : 210

        if (n.streak > 0) {
          const glowR = (6 + Math.min(n.streak, 24) * 0.35) * (1 + pulse * 0.25)
          const g = ctx.createRadialGradient(px, py, 0, px, py, glowR)
          g.addColorStop(0, `hsla(${hue},100%,72%,0.95)`)
          g.addColorStop(0.35, `hsla(${hue},100%,60%,0.45)`)
          g.addColorStop(1, `hsla(${hue},100%,60%,0)`)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(px, py, glowR, 0, Math.PI * 2)
          ctx.fill()
        } else if (n.hasLogs) {
          ctx.globalAlpha = 0.5 + 0.12 * Math.sin(nowMs * 3 + hashSeed(n.habit.id) * 10)
          ctx.fillStyle = '#56638A'
          ctx.beginPath()
          ctx.arc(px, py, 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }

        const coreColor =
          n.streak > 0 ? `hsl(${hue},100%,75%)` : n.hasLogs ? '#56638A' : '#E8F7FF'
        const coreR = n.streak > 0 ? 2.2 + Math.min(n.streak, 30) * 0.12 : 1.8
        ctx.fillStyle = coreColor
        ctx.beginPath()
        ctx.arc(px, py, coreR, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!reduceMotion) raf = requestAnimationFrame(draw)
    }

    let raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [derived])

  return (
    <div className="app-shell">
      <div className="bg-sky" aria-hidden="true">
        <div className="bg-floor" aria-hidden="true" />
        <div className="bg-scanlines" aria-hidden="true" />
        <div className="bg-vignette" aria-hidden="true" />
      </div>

      <header className="app-header">
        <div>
          <h1 className="app-title">Habit Constellation</h1>
          <p className="app-subtitle">Your habits as a star map</p>
        </div>
        <div className="stats-strip" role="list" aria-label="Constellation statistics">
          <div className="stat" role="listitem">
            <span className="stat-label">Stars</span>
            <span className="stat-value">{habits.length}</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat-label">Lit</span>
            <span className="stat-value">{litCount}</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat-label">Longest</span>
            <span className="stat-value">{maxStreak}d</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat-label">Logs</span>
            <span className="stat-value">{totalCheckins}</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-panel" aria-label="Habit constellation map">
          <canvas ref={canvasRef} className="constellation-canvas" aria-hidden="true" />
          <p className="sr-only">
            {habits.length === 0
              ? 'No habits logged yet. The sky is empty.'
              : `Constellation of ${habits.length} habits, ${litCount} currently lit.`}
          </p>
          {habits.length === 0 && (
            <div className="empty-state">
              <span className="empty-star" aria-hidden="true" />
              <p className="empty-title">No stars mapped</p>
              <p className="empty-sub">Log a habit to ignite the sky</p>
            </div>
          )}
        </section>

        <aside className="habit-panel" aria-label="Habit log">
          <form className="habit-form" onSubmit={addHabit} aria-label="Add a new habit">
            <label className="form-label" htmlFor="habit-input">
              New habit
            </label>
            <div className="form-row">
              <span className="prompt-glyph" aria-hidden="true">
                &gt;
              </span>
              <input
                id="habit-input"
                ref={inputRef}
                className="habit-input"
                type="text"
                placeholder="e.g. TRAIN AT 6AM"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError('')
                }}
                autoComplete="off"
                maxLength={60}
              />
              <button type="submit" className="log-btn">
                [ Log ]
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>

          {habits.length === 0 ? (
            <p className="panel-empty">No habits tracked yet</p>
          ) : (
            <ul className="habit-list">
              {derived.map((d) => {
                const status = d.streak > 0 ? 'lit' : d.hasLogs ? 'ember' : 'dormant'
                const hue = d.streak > 0 ? 185 + Math.min(d.streak, 30) * 3 : undefined
                const statusText =
                  d.streak > 0
                    ? `Lit · ${d.streak}d streak`
                    : d.hasLogs
                      ? 'Ember · streak broken'
                      : 'Dormant · not logged'
                return (
                  <li key={d.habit.id} className="habit-item">
                    <span
                      className={`node-glyph node-${status}`}
                      aria-hidden="true"
                      style={
                        hue !== undefined
                          ? {
                              background: `hsl(${hue},100%,65%)`,
                              boxShadow: `0 0 10px hsla(${hue},100%,60%,0.8)`,
                            }
                          : undefined
                      }
                    />
                    <div className="habit-info">
                      <span className="habit-name">{d.habit.name}</span>
                      <span className={`habit-coords habit-coords-${status}`}>{statusText}</span>
                    </div>
                    <div className="habit-actions">
                      <button
                        className={`day-btn${d.doneToday ? ' done' : ''}`}
                        aria-pressed={d.doneToday}
                        onClick={() => toggleToday(d.habit.id)}
                      >
                        {d.doneToday ? 'Logged' : 'Log today'}
                      </button>
                      <button
                        className="del-btn"
                        aria-label={`Delete habit ${d.habit.name}`}
                        onClick={() => removeHabit(d.habit.id)}
                      >
                        &times;
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </main>

      <footer className="app-footer">
        <span>
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
        <span>Data lives in your browser</span>
      </footer>
    </div>
  )
}