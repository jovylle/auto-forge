import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ============================== types ============================== */

interface Stock {
  id: string
  name: string
  zone: string
  qty: number
}

interface Lark {
  id: string
  name: string
  shifts: string[]
}

interface Zone {
  id: string
  name: string
  blurb: string
  accent: string
  poly: string
  cx: number
  cy: number
}

/* ============================== data ============================== */

const ZONES: Zone[] = [
  {
    id: 'nave',
    name: 'Hollow Nave',
    blurb: 'Cool dark aisles for pale, slow-curing bone.',
    accent: '#B5A684',
    poly: '30,50 240,30 240,370 30,350',
    cx: 135,
    cy: 190,
  },
  {
    id: 'vault',
    name: 'Ember Vault',
    blurb: 'Smoked marrow sealed behind ember-iron doors.',
    accent: '#E8963F',
    poly: '260,30 570,30 570,170 260,190',
    cx: 415,
    cy: 100,
  },
  {
    id: 'cloister',
    name: 'Moss Cloister',
    blurb: 'Damp green court where knuckles stay supple.',
    accent: '#A3B77A',
    poly: '260,205 420,195 420,370 260,370',
    cx: 340,
    cy: 278,
  },
  {
    id: 'pantry',
    name: 'Blood Pantry',
    blurb: 'Vials and rich cuts, counted twice nightly.',
    accent: '#E0606E',
    poly: '435,190 570,185 570,280 435,285',
    cx: 502,
    cy: 228,
  },
  {
    id: 'gallery',
    name: 'Gnawed Gallery',
    blurb: 'Picked-clean curiosities for the boldest broths.',
    accent: '#C6641E',
    poly: '435,295 570,290 570,370 435,370',
    cx: 502,
    cy: 322,
  },
]

const SHIFTS = [
  { id: 'dawn', name: 'Dawn Vigil', glyph: '◐' },
  { id: 'ember', name: 'Ember Watch', glyph: '◑' },
  { id: 'dusk', name: 'Dusk Round', glyph: '◒' },
  { id: 'night', name: 'Night Hollow', glyph: '◓' },
]

const MARROW_PRESETS: { name: string; zone: string }[] = [
  { name: 'Pale Ox Femur', zone: 'nave' },
  { name: 'Mooncalf Ulna', zone: 'nave' },
  { name: 'Ember Fowl Shin', zone: 'vault' },
  { name: 'Charred Rib Splinter', zone: 'vault' },
  { name: 'Moss Knuckle', zone: 'cloister' },
  { name: 'Thorn Hock', zone: 'cloister' },
  { name: 'Blood-Marrow Vial', zone: 'pantry' },
  { name: 'Heartbone Shard', zone: 'pantry' },
  { name: 'Gnawed Lark Tibia', zone: 'gallery' },
  { name: 'Riddle Vertebra', zone: 'gallery' },
]

const LARK_PRESETS = ['Sorrel', 'Ashbell', 'Quillow', 'Bramblet', 'Vex', 'Corvidelle', 'Mothwin', 'Pell']

const SEED_STOCKS: Stock[] = [
  { id: 's1', name: 'Pale Ox Femur', zone: 'nave', qty: 14 },
  { id: 's2', name: 'Mooncalf Ulna', zone: 'nave', qty: 6 },
  { id: 's3', name: 'Ember Fowl Shin', zone: 'vault', qty: 11 },
  { id: 's4', name: 'Charred Rib Splinter', zone: 'vault', qty: 3 },
  { id: 's5', name: 'Moss Knuckle', zone: 'cloister', qty: 9 },
  { id: 's6', name: 'Blood-Marrow Vial', zone: 'pantry', qty: 2 },
  { id: 's7', name: 'Heartbone Shard', zone: 'pantry', qty: 0 },
  { id: 's8', name: 'Gnawed Lark Tibia', zone: 'gallery', qty: 5 },
]

const SEED_LARKS: Lark[] = [
  { id: 'l1', name: 'Sorrel', shifts: ['dawn', 'dusk'] },
  { id: 'l2', name: 'Ashbell', shifts: ['ember'] },
  { id: 'l3', name: 'Quillow', shifts: ['night', 'dawn'] },
  { id: 'l4', name: 'Bramblet', shifts: [] },
]

const STORE_KEY = 'marrow-lark-depot-v1'
const MAX_QTY = 60

function zoneById(id: string): Zone {
  const z = ZONES.find((w) => w.id === id)
  return (z ?? ZONES[0]) as Zone
}

function loadStore(): { stocks: Stock[]; larks: Lark[] } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { stocks: Stock[]; larks: Lark[] }
    if (!Array.isArray(parsed.stocks) || !Array.isArray(parsed.larks)) return null
    return parsed
  } catch {
    return null
  }
}

let uidCounter = 100
function uid(prefix: string): string {
  uidCounter += 1
  return `${prefix}${Date.now().toString(36)}${uidCounter}`
}

/* ============================== app ============================== */

export default function App() {
  const [initial] = useState(loadStore)
  const [stocks, setStocks] = useState<Stock[]>(() => initial?.stocks ?? SEED_STOCKS)
  const [larks, setLarks] = useState<Lark[]>(() => initial?.larks ?? SEED_LARKS)
  const [focusZone, setFocusZone] = useState<string | null>(null)
  const [carveStock, setCarveStock] = useState(false)
  const [hatchLark, setHatchLark] = useState(false)
  const [pickedMarrow, setPickedMarrow] = useState<string | null>(null)
  const [pickedLark, setPickedLark] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [whisper, setWhisper] = useState<{ text: string; key: number } | null>(null)
  const [stamp, setStamp] = useState<{ id: string; key: number } | null>(null)
  const [flash, setFlash] = useState<{ id: string; dir: 'plus' | 'minus' } | null>(null)
  const [bloomKey, setBloomKey] = useState<string | null>(null)

  /* scroll state */
  const [progress, setProgress] = useState(0)
  const [activeSection, setActiveSection] = useState('threshold')
  const [compressed, setCompressed] = useState(false)
  const [showTop, setShowTop] = useState(false)

  const threadRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const whisperTimer = useRef<number | null>(null)
  const confirmTimer = useRef<number | null>(null)
  const ticking = useRef(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  /* persist */
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ stocks, larks }))
    } catch {
      /* crypt is full — carry on */
    }
  }, [stocks, larks])

  const say = useCallback((text: string) => {
    if (whisperTimer.current) window.clearTimeout(whisperTimer.current)
    setWhisper({ text, key: Date.now() })
    whisperTimer.current = window.setTimeout(() => setWhisper(null), 2400)
  }, [])

  /* ---------- scroll engine: progress + active rune + parallax (rAF) ---------- */
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      window.requestAnimationFrame(() => {
        ticking.current = false
        const y = window.scrollY
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0
        setProgress((prev) => (Math.abs(prev - p) < 0.004 ? prev : p))
        setShowTop(y > 600)

        const ids = ['threshold', 'ledger', 'perches', 'map']
        let current = 'threshold'
        for (const id of ids) {
          const el = document.getElementById(id)
          if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id
        }
        setActiveSection((prev) => (prev === current ? prev : current))

        const sentinel = document.getElementById('ledger-sentinel')
        setCompressed(sentinel ? sentinel.getBoundingClientRect().top < 76 : false)

        if (!reduceMotion.current) {
          if (threadRef.current) threadRef.current.style.transform = `scaleX(${p})`
          if (glowRef.current) glowRef.current.style.transform = `translateY(${y * 0.15}px)`
          document.querySelectorAll<HTMLElement>('.wm-drift').forEach((el) => {
            const rate = Number(el.dataset.rate ?? '0.2')
            el.style.transform = `translateY(${(y - (el.parentElement?.offsetTop ?? 0)) * rate * -1}px)`
          })
        } else if (threadRef.current) {
          threadRef.current.style.transform = `scaleX(${p})`
        }
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ---------- reveal on scroll ---------- */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'))
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [stocks.length, larks.length, focusZone])

  /* esc closes popovers */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCarveStock(false)
        setHatchLark(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- derived ---------- */
  const total = useMemo(() => stocks.reduce((a, s) => a + s.qty, 0), [stocks])
  const perZone = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stocks) m.set(s.zone, (m.get(s.zone) ?? 0) + s.qty)
    return m
  }, [stocks])
  const waning = useMemo(() => stocks.filter((s) => s.qty > 0 && s.qty <= 3), [stocks])
  const bare = useMemo(() => stocks.filter((s) => s.qty === 0), [stocks])
  const shiftSlots = larks.length * SHIFTS.length
  const filledSlots = useMemo(() => larks.reduce((a, l) => a + l.shifts.length, 0), [larks])

  const visibleStocks = useMemo(
    () => (focusZone ? stocks.filter((s) => s.zone === focusZone) : stocks),
    [stocks, focusZone],
  )

  const marrowOptions = useMemo(
    () => MARROW_PRESETS.filter((p) => !stocks.some((s) => s.name === p.name)),
    [stocks],
  )
  const larkOptions = useMemo(
    () => LARK_PRESETS.filter((n) => !larks.some((l) => l.name === n)),
    [larks],
  )

  /* ---------- actions (click only) ---------- */
  const bump = useCallback(
    (id: string, delta: number) => {
      setStocks((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, qty: Math.min(MAX_QTY, Math.max(0, s.qty + delta)) } : s,
        ),
      )
      const target = stocks.find((s) => s.id === id)
      setStamp({ id, key: Date.now() })
      setFlash({ id, dir: delta > 0 ? 'plus' : 'minus' })
      window.setTimeout(() => setFlash(null), 220)
      if (target) {
        const next = Math.min(MAX_QTY, Math.max(0, target.qty + delta))
        say(
          delta > 0
            ? `Laid ${target.name} upon the pile — ${next} in store`
            : next === 0
              ? `${target.name} picked bare`
              : `Drew from ${target.name} — ${next} remain`,
        )
      }
    },
    [stocks, say],
  )

  const requestRemove = useCallback(
    (id: string, label: string) => {
      if (confirmId === id) {
        setStocks((prev) => prev.filter((s) => s.id !== id))
        setConfirmId(null)
        if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
        say(`${label} struck from the ledger`)
      } else {
        if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
        setConfirmId(id)
        confirmTimer.current = window.setTimeout(() => setConfirmId(null), 3000)
      }
    },
    [confirmId, say],
  )

  const inscribeMarrow = useCallback(() => {
    if (!pickedMarrow) return
    const preset = MARROW_PRESETS.find((p) => p.name === pickedMarrow)
    if (!preset) return
    setStocks((prev) => [...prev, { id: uid('s'), name: preset.name, zone: preset.zone, qty: 5 }])
    setCarveStock(false)
    setPickedMarrow(null)
    say(`Two? Nay — five ${preset.name} committed to the ${zoneById(preset.zone).name}`)
  }, [pickedMarrow, say])

  const toggleShift = useCallback(
    (larkId: string, shiftId: string) => {
      setLarks((prev) =>
        prev.map((l) => {
          if (l.id !== larkId) return l
          const has = l.shifts.includes(shiftId)
          return { ...l, shifts: has ? l.shifts.filter((s) => s !== shiftId) : [...l.shifts, shiftId] }
        }),
      )
      const lark = larks.find((l) => l.id === larkId)
      const shift = SHIFTS.find((s) => s.id === shiftId)
      setBloomKey(`${larkId}-${shiftId}-${Date.now()}`)
      if (lark && shift) {
        const has = lark.shifts.includes(shiftId)
        say(has ? `${lark.name} released from the ${shift.name}` : `${lark.name} takes up the ${shift.name}`)
      }
    },
    [larks, say],
  )

  const hatch = useCallback(() => {
    if (!pickedLark) return
    setLarks((prev) => [...prev, { id: uid('l'), name: pickedLark, shifts: [] }])
    setHatchLark(false)
    setPickedLark(null)
    say(`${pickedLark} settles onto an empty perch`)
  }, [pickedLark, say])

  const releaseLark = useCallback(
    (id: string, name: string) => {
      setLarks((prev) => prev.filter((l) => l.id !== id))
      say(`${name} flies the depot`)
    },
    [say],
  )

  const resetDepot = useCallback(() => {
    setStocks(SEED_STOCKS)
    setLarks(SEED_LARKS)
    setFocusZone(null)
    say('The depot is re-carved to the old count')
  }, [say])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion.current ? 'auto' : 'smooth' })
  }, [])

  const zoneTotal = useCallback((zoneId: string) => perZone.get(zoneId) ?? 0, [perZone])

  const focus = useCallback(
    (zoneId: string) => {
      const next = focusZone === zoneId ? null : zoneId
      setFocusZone(next)
      if (next) say(`Behold the ${zoneById(next).name} — ledger narrowed`)
    },
    [focusZone, say],
  )

  /* ============================== render ============================== */

  const runes = [
    { id: 'threshold', glyph: '✦', label: 'Threshold' },
    { id: 'ledger', glyph: '❖', label: 'Marrow Ledger' },
    { id: 'perches', glyph: '◈', label: 'Lark Perches' },
    { id: 'map', glyph: '✧', label: 'Depot Map' },
  ]

  return (
    <div className="depot-bg min-h-screen bg-pit font-body text-bone">
      <div id="scroll-thread" ref={threadRef} aria-hidden="true" />

      {/* rune rail — click-only section nav + scroll progress */}
      <nav
        aria-label="Depot sections"
        className="fixed right-2 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-2 sm:right-4"
      >
        {runes.map((r) => {
          const isActive = activeSection === r.id
          const passed =
            runes.findIndex((x) => x.id === activeSection) > runes.findIndex((x) => x.id === r.id)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => scrollTo(r.id)}
              aria-label={`Go to ${r.label}`}
              title={r.label}
              className={`rune-btn grid h-11 w-11 place-items-center rounded-md border text-lg ${
                isActive
                  ? 'border-emberbright bg-ember text-emberink'
                  : passed
                    ? 'border-edge bg-crypt text-bonedim'
                    : 'border-edge bg-crypt/60 text-bonefaint'
              }`}
            >
              {r.glyph}
            </button>
          )
        })}
      </nav>

      {/* ============ THRESHOLD (hero) ============ */}
      <header id="threshold" className="relative flex min-h-[100svh] items-center overflow-hidden">
        <div ref={glowRef} aria-hidden="true" className="absolute inset-0 will-change-transform">
          <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-ember/15 blur-[110px]" />
          <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-blood/20 blur-[130px]" />
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="mote"
              style={{
                left: `${(i * 67) % 100}%`,
                width: `${3 + ((i * 5) % 4)}px`,
                height: `${3 + ((i * 5) % 4)}px`,
                animationDuration: `${7 + ((i * 3) % 6)}s`,
                animationDelay: `${(i * 1.3) % 7}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-12 gap-6 px-5 sm:px-8">
          <div className="col-span-12 lg:col-span-7">
            <p className="reveal font-label text-xs uppercase tracking-[0.25em] text-emberbright">
              A supply depot · kept by larks
            </p>
            <h1 className="carve-in mt-4 font-display text-[clamp(3.2rem,9vw,6.5rem)] font-bold leading-[0.95] text-bone">
              Marrow
              <br />
              Lark <span className="text-emberbright">Depot</span>
            </h1>
            <p className="reveal mt-6 max-w-xl text-lg italic leading-relaxed text-bonedim" style={{ ['--stagger' as string]: '120ms' }}>
              Below the roost, the larks keep the bone-crypts full — every femur counted,
              every vigil perched, every vault mapped in ember-light.
            </p>
            <div className="reveal mt-8 flex flex-wrap gap-3" style={{ ['--stagger' as string]: '200ms' }}>
              <button
                type="button"
                onClick={() => scrollTo('ledger')}
                className="btn-press btn-primary rounded-md px-6 py-3 font-label text-sm uppercase tracking-[0.12em]"
              >
                Open the ledger ❖
              </button>
              <button
                type="button"
                onClick={() => scrollTo('map')}
                className="btn-press btn-ghost rounded-md px-6 py-3 font-label text-sm uppercase tracking-[0.12em]"
              >
                Walk the depot map
              </button>
            </div>
            <dl className="reveal mt-10 flex flex-wrap gap-8" style={{ ['--stagger' as string]: '280ms' }}>
              <div>
                <dt className="font-label text-xs uppercase tracking-[0.2em] text-bonefaint">Bones in store</dt>
                <dd className="tnum font-display text-4xl text-bone" aria-live="polite">{total}</dd>
              </div>
              <div>
                <dt className="font-label text-xs uppercase tracking-[0.2em] text-bonefaint">Larks roosting</dt>
                <dd className="tnum font-display text-4xl text-bone">{larks.length}</dd>
              </div>
              <div>
                <dt className="font-label text-xs uppercase tracking-[0.2em] text-bonefaint">Shelves bare</dt>
                <dd className="tnum font-display text-4xl text-bloodbright">{bare.length}</dd>
              </div>
            </dl>
          </div>

          <aside
            className="reveal col-span-12 self-center rounded-md border border-edge bg-crypt/80 p-6 backdrop-blur lg:col-span-4 lg:col-start-9"
            style={{ ['--stagger' as string]: '240ms' }}
            aria-label="Keeper's writ"
          >
            <p className="font-label text-xs uppercase tracking-[0.2em] text-emberbright">Keeper's writ</p>
            <p className="mt-3 leading-relaxed text-bonedim">
              Click is the only tongue spoken here — no quills, no dragging of crates.
              Press the runes, stamp the steppers, perch the larks. Scroll, and the depot
              answers: thread above, numerals astray, motes rising.
            </p>
            <p className="mt-4 border-t border-edge pt-4 text-sm italic text-bonefaint">
              Scroll progress {Math.round(progress * 100)}% — the ember thread never lies.
            </p>
          </aside>
        </div>
      </header>

      <div className="vertebrae" aria-hidden="true" />

      {/* ============ I · LEDGER ============ */}
      <main>
        <section id="ledger" aria-label="Stock ledger" className="relative mx-auto max-w-6xl scroll-mt-16 px-5 py-20 sm:px-8">
          <div
            aria-hidden="true"
            data-rate="0.2"
            className="wm-drift pointer-events-none absolute -left-6 top-10 select-none font-display text-[11rem] font-bold leading-none text-bone/[0.045]"
          >
            I
          </div>
          <p className="reveal font-label text-xs uppercase tracking-[0.25em] text-emberbright">Chapter I</p>
          <h2 className="reveal mt-2 font-display text-5xl font-bold sm:text-6xl">The Marrow Ledger</h2>
          <p className="reveal mt-3 max-w-2xl text-bonedim">
            Every bone stamped in and out. Press <span className="text-bone">＋</span> to lay stock down,
            <span className="text-bone"> －</span> to draw it for the broths. The rail keeps the running count.
          </p>

          <div id="ledger-sentinel" aria-hidden="true" className="h-px" />

          <div
            id="ledger-subhead"
            className={`sticky top-0 z-30 -mx-2 mt-8 flex flex-wrap items-center gap-3 rounded-md px-2 py-3 ${compressed ? 'compressed' : ''}`}
          >
            <button
              type="button"
              onClick={() => {
                setCarveStock(true)
                setPickedMarrow(marrowOptions[0]?.name ?? null)
              }}
              className="btn-press btn-primary rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em]"
            >
              ＋ Carve entry
            </button>
            {focusZone && (
              <button
                type="button"
                onClick={() => setFocusZone(null)}
                className="btn-press btn-ghost rounded-md px-4 py-3 font-label text-xs uppercase tracking-[0.12em]"
              >
                ✕ Show all bones
              </button>
            )}
            <span className="ml-auto font-label text-xs uppercase tracking-[0.18em] text-bonefaint" aria-live="polite">
              {focusZone ? `Narrowed to ${zoneById(focusZone).name} · ${visibleStocks.length} entries` : `${stocks.length} entries · ${total} bones`}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              {visibleStocks.length === 0 && (
                <div className="rounded-md border border-dashed border-edge bg-crypt p-10 text-center">
                  <p className="font-display text-2xl">This shelf stands empty</p>
                  <p className="mt-2 text-bonedim">Carve a new entry, or lift the narrowing.</p>
                </div>
              )}
              <ul className="flex flex-col gap-4">
                {visibleStocks.map((s, i) => {
                  const zone = zoneById(s.zone)
                  const status = s.qty === 0 ? 'BARE' : s.qty <= 3 ? 'WANING' : 'PROVISIONED'
                  return (
                    <li
                      key={s.id}
                      className={`ledger-card reveal relative p-4 sm:p-5 ${s.qty === 0 ? 'bare' : ''} ${s.qty > 0 && s.qty <= 3 ? 'waning' : ''}`}
                      style={{ ['--stagger' as string]: `${(i % 6) * 60}ms` }}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-label text-base font-bold uppercase tracking-[0.06em] text-bone">
                              {s.name}
                            </h3>
                            <span
                              className="rounded-full border px-2.5 py-0.5 font-label text-[0.68rem] uppercase tracking-[0.14em]"
                              style={{ color: zone.accent, borderColor: zone.accent, background: '#16120D' }}
                            >
                              {zone.name}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 font-label text-[0.68rem] uppercase tracking-[0.14em] ${
                                status === 'PROVISIONED'
                                  ? 'border-mossbright text-mossbright'
                                  : status === 'WANING'
                                    ? 'border-emberbright text-emberbright'
                                    : 'border-bloodbright text-bloodbright'
                              } bg-crypt`}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm italic text-bonefaint">{zone.blurb}</p>
                        </div>
                        <div className="flex items-center gap-2" role="group" aria-label={`${s.name} quantity`}>
                          <button
                            type="button"
                            onClick={() => bump(s.id, -1)}
                            aria-disabled={s.qty === 0}
                            aria-label={`Draw one ${s.name}`}
                            disabled={s.qty === 0}
                            className={`stepper btn-press ${flash?.id === s.id && flash.dir === 'minus' ? 'flash-minus' : ''}`}
                          >
                            －
                          </button>
                          <span
                            key={stamp?.id === s.id ? stamp.key : s.id}
                            aria-live="polite"
                            aria-label={`${s.qty} in store`}
                            className={`tnum inline-block min-w-[3rem] text-center font-display text-3xl font-bold ${stamp?.id === s.id ? 'stamp' : ''}`}
                          >
                            {s.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => bump(s.id, 1)}
                            aria-disabled={s.qty >= MAX_QTY}
                            aria-label={`Lay one ${s.name} down`}
                            disabled={s.qty >= MAX_QTY}
                            className={`stepper btn-press ${flash?.id === s.id && flash.dir === 'plus' ? 'flash-plus' : ''}`}
                          >
                            ＋
                          </button>
                        </div>
                      </div>
                      {s.qty === 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-2 top-1/2 -translate-y-1/2 rotate-[8deg] rounded-sm border-2 border-bloodbright px-2 py-0.5 font-label text-xs uppercase tracking-[0.2em] text-bloodbright"
                        >
                          Bare
                        </span>
                      )}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => requestRemove(s.id, s.name)}
                          aria-label={confirmId === s.id ? `Press again to strike ${s.name}` : `Strike ${s.name} from the ledger`}
                          className={`btn-press rounded-md px-3 py-2 font-label text-xs uppercase tracking-[0.14em] ${
                            confirmId === s.id
                              ? 'bg-bloodbright text-bone'
                              : 'border border-edge text-bonefaint hover:border-bloodbright hover:text-bone'
                          }`}
                        >
                          {confirmId === s.id ? 'Sure? press again' : 'Strike'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* bone totals rail */}
            <aside className="col-span-12 lg:col-span-4" aria-label="Bone totals">
              <div className="reveal rounded-md border border-edge bg-crypt p-5 lg:sticky lg:top-20">
                <p className="font-label text-xs uppercase tracking-[0.22em] text-emberbright">Bone totals</p>
                <p className="tnum mt-2 font-display text-6xl font-bold" aria-live="polite">{total}</p>
                <ul className="mt-4 flex flex-col gap-2 border-t border-edge pt-4">
                  {ZONES.map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        onClick={() => focus(z.id)}
                        aria-pressed={focusZone === z.id}
                        aria-label={`Narrow ledger to ${z.name}, ${zoneTotal(z.id)} bones`}
                        className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                          focusZone === z.id ? 'border-emberbright bg-slab' : 'border-edge hover:border-ember'
                        }`}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: z.accent }} aria-hidden="true" />
                        <span className="font-label text-xs uppercase tracking-[0.12em] text-bone">{z.name}</span>
                        <span className="tnum ml-auto font-display text-xl text-bonedim">{zoneTotal(z.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {waning.length > 0 && (
                  <div className="mt-4 rounded-md border border-ember/60 bg-slab p-3">
                    <p className="font-label text-xs uppercase tracking-[0.18em] text-emberbright">
                      Waning — feed soon
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {waning.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-bonedim">{s.name}</span>
                          <button
                            type="button"
                            onClick={() => bump(s.id, 5)}
                            aria-label={`Restock ${s.name} by five`}
                            className="btn-press rounded border border-ember px-2 py-1 font-label text-[0.7rem] uppercase tracking-[0.12em] text-emberbright hover:bg-ember hover:text-emberink"
                          >
                            ＋5
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={resetDepot}
                  className="btn-press btn-ghost mt-4 w-full rounded-md px-4 py-2.5 font-label text-xs uppercase tracking-[0.14em]"
                >
                  ↺ Re-carve to the old count
                </button>
              </div>
            </aside>
          </div>
        </section>

        <div className="vertebrae" aria-hidden="true" />

        {/* ============ II · PERCHES ============ */}
        <section id="perches" aria-label="Lark shifts" className="relative mx-auto max-w-6xl scroll-mt-16 px-5 py-20 sm:px-8">
          <div
            aria-hidden="true"
            data-rate="0.2"
            className="wm-drift pointer-events-none absolute -right-4 top-10 select-none font-display text-[11rem] font-bold leading-none text-bone/[0.045]"
          >
            II
          </div>
          <div className="ml-auto max-w-2xl lg:mr-[12%]">
            <p className="reveal font-label text-xs uppercase tracking-[0.25em] text-emberbright">Chapter II</p>
            <h2 className="reveal mt-2 font-display text-5xl font-bold sm:text-6xl">The Lark Perches</h2>
            <p className="reveal mt-3 text-bonedim">
              Four vigils keep the depot breathing. Press a chip to perch a lark upon a shift —
              press again to release it. {filledSlots} of {shiftSlots} perches held.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setHatchLark(true)
                setPickedLark(larkOptions[0] ?? null)
              }}
              className="btn-press btn-primary rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em]"
            >
              ＋ Hatch a lark
            </button>
            <div className="ml-auto h-2 w-full max-w-xs overflow-hidden rounded-full border border-edge bg-crypt sm:w-64" role="img" aria-label={`${filledSlots} of ${shiftSlots} shift slots filled`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-blood via-ember to-emberbright transition-all duration-500"
                style={{ width: `${shiftSlots === 0 ? 0 : Math.round((filledSlots / shiftSlots) * 100)}%` }}
              />
            </div>
          </div>

          <ul className="mt-6 flex flex-col gap-5">
            {larks.map((lark, i) => (
              <li
                key={lark.id}
                className="reveal rounded-md border border-edge bg-slab"
                style={{
                  ['--stagger' as string]: `${(i % 5) * 60}ms`,
                  marginLeft: `${(i % 2) * 6}%`,
                  marginRight: `${((i + 1) % 2) * 6}%`,
                  borderLeft: '4px solid var(--color-moss)',
                }}
              >
                <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full border border-moss bg-crypt font-display text-2xl text-mossbright">
                      {lark.name.charAt(0)}
                    </span>
                    <div>
                      <h3 className="font-label text-lg font-bold uppercase tracking-[0.06em]">{lark.name}</h3>
                      <p className="text-sm italic text-bonefaint" aria-live="polite">
                        {lark.shifts.length === 0
                          ? 'roosting idle'
                          : `holding ${lark.shifts.length} vigil${lark.shifts.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label={`${lark.name} shifts`}>
                    {SHIFTS.map((sh) => {
                      const held = lark.shifts.includes(sh.id)
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => toggleShift(lark.id, sh.id)}
                          aria-pressed={held}
                          aria-label={`${held ? 'Release' : 'Perch'} ${lark.name} ${held ? 'from' : 'upon'} the ${sh.name}`}
                          className={`shift-chip btn-press rounded-md px-4 py-2.5 font-label text-xs uppercase tracking-[0.1em] ${bloomKey?.startsWith(`${lark.id}-${sh.id}`) ? 'bloom' : ''}`}
                        >
                          {sh.glyph} {sh.name}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => releaseLark(lark.id, lark.name)}
                    aria-label={`Release ${lark.name} from the depot`}
                    className="btn-press rounded-md border border-edge px-3 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-bonefaint hover:border-bloodbright hover:text-bone"
                  >
                    Fly off
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {larks.length === 0 && (
            <div className="mt-6 rounded-md border border-dashed border-edge bg-crypt p-10 text-center">
              <p className="font-display text-2xl">The perches stand empty</p>
              <p className="mt-2 text-bonedim">Hatch a lark to keep the vigils.</p>
            </div>
          )}
        </section>

        <div className="vertebrae" aria-hidden="true" />

        {/* ============ III · MAP ============ */}
        <section id="map" aria-label="Depot map" className="relative scroll-mt-16 py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <p className="reveal font-label text-xs uppercase tracking-[0.25em] text-emberbright">Chapter III</p>
            <h2 className="reveal mt-2 font-display text-5xl font-bold sm:text-6xl">The Depot Map</h2>
            <p className="reveal mt-3 max-w-2xl text-bonedim">
              The cathedral floor, drawn in ember. Press a vault to narrow the ledger to its bones —
              press it again to lift the narrowing. Pips mark five bones apiece.
            </p>
          </div>

          <div className="reveal relative mx-auto mt-8 max-w-6xl px-5 sm:px-8">
            <div className="overflow-hidden rounded-md border border-edge bg-crypt">
              <svg viewBox="0 0 600 400" role="group" aria-label="Depot floor map with five zones" className="block h-auto w-full">
                <defs>
                  <pattern id="stones" width="26" height="26" patternUnits="userSpaceOnUse">
                    <path d="M0 26 H26 M26 0 V26" stroke="#362C20" strokeWidth="1" opacity="0.5" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="600" height="400" fill="#16120D" />
                <rect x="0" y="0" width="600" height="400" fill="url(#stones)" />
                {ZONES.map((z) => {
                  const zTotal = zoneTotal(z.id)
                  const fillOpacity = Math.min(0.75, 0.12 + (zTotal / MAX_QTY) * 0.6)
                  const pips = Math.min(10, Math.floor(zTotal / 5))
                  const selected = focusZone === z.id
                  return (
                    <g
                      key={z.id}
                      className={`map-zone ${selected ? 'selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${z.name}, ${zTotal} bones. Press to ${selected ? 'lift the narrowing' : 'narrow the ledger'}.`}
                      onClick={() => focus(z.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          focus(z.id)
                        }
                      }}
                    >
                      <polygon
                        points={z.poly}
                        fill={z.accent}
                        fillOpacity={selected ? Math.min(0.85, fillOpacity + 0.15) : fillOpacity}
                        stroke={selected ? '#E8963F' : '#97886A'}
                        strokeWidth={selected ? 2.5 : 1.25}
                      />
                      <text
                        x={z.cx}
                        y={z.cy - 14}
                        textAnchor="middle"
                        fill="#EADFC8"
                        fontSize="15"
                        fontFamily="'Alegreya SC', serif"
                        letterSpacing="1"
                      >
                        {z.name.toUpperCase()}
                      </text>
                      <text
                        x={z.cx}
                        y={z.cy + 6}
                        textAnchor="middle"
                        fill="#EADFC8"
                        fontSize="22"
                        fontWeight="bold"
                        fontFamily="'Alegreya', serif"
                      >
                        {zTotal}
                      </text>
                      {Array.from({ length: pips }).map((_, i) => (
                        <circle
                          key={i}
                          cx={z.cx - ((pips - 1) * 9) / 2 + i * 9}
                          cy={z.cy + 24}
                          r={selected ? 4.5 : 3.5}
                          fill={z.accent}
                        />
                      ))}
                      {pips === 0 && (
                        <text
                          x={z.cx}
                          y={z.cy + 26}
                          textAnchor="middle"
                          fill="#A62836"
                          fontSize="11"
                          fontFamily="'Alegreya SC', serif"
                          letterSpacing="2"
                        >
                          BARE
                        </text>
                      )}
                    </g>
                  )
                })}
                {/* compass rose */}
                <g aria-hidden="true" opacity="0.7">
                  <circle cx="52" cy="348" r="16" fill="none" stroke="#97886A" strokeWidth="1" />
                  <path d="M52 336 L55 348 L52 360 L49 348 Z" fill="#E8963F" />
                  <text x="52" y="386" textAnchor="middle" fill="#97886A" fontSize="10" fontFamily="'Alegreya SC', serif">NORTH</text>
                </g>
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Zone filters">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => focus(z.id)}
                  aria-pressed={focusZone === z.id}
                  className={`btn-press rounded-full border px-4 py-2 font-label text-xs uppercase tracking-[0.12em] ${
                    focusZone === z.id ? 'border-emberbright bg-ember text-emberink' : 'border-edge bg-crypt text-bonedim hover:text-bone'
                  }`}
                >
                  {z.name} · {zoneTotal(z.id)}
                </button>
              ))}
              {focusZone && (
                <button
                  type="button"
                  onClick={() => setFocusZone(null)}
                  className="btn-press rounded-full border border-bonefaint px-4 py-2 font-label text-xs uppercase tracking-[0.12em] text-bone"
                >
                  ✕ Show all bones
                </button>
              )}
            </div>

            <div className="sticky bottom-4 z-30 mt-6 flex justify-end">
              <p className="rounded-md border border-edge bg-crypt/95 px-4 py-2 font-label text-xs uppercase tracking-[0.16em] text-bonedim shadow-lg">
                {focusZone ? `◉ ${zoneById(focusZone).name} in focus` : '◇ All five vaults open'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ============ SEAL (footer) ============ */}
      <footer className="border-t border-edge bg-crypt px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
          <div
            aria-hidden="true"
            className="grid h-14 w-14 rotate-3 place-items-center rounded-sm border-2 border-bloodbright font-display text-2xl text-bloodbright"
          >
            ✦
          </div>
          <div>
            <p className="font-display text-2xl font-bold">Sealed by the Keeper of Marrow</p>
            <p className="mt-1 text-sm italic text-bonefaint">
              {total} bones · {larks.length} larks · {filledSlots} vigils held — kept in this browser's crypt (localStorage).
            </p>
          </div>
          <button
            type="button"
            onClick={() => scrollTo('threshold')}
            className="btn-press btn-ghost ml-auto rounded-md px-5 py-3 font-label text-xs uppercase tracking-[0.14em]"
          >
            ↑ Return to the threshold
          </button>
        </div>
      </footer>

      {/* back to top */}
      {showTop && (
        <button
          type="button"
          onClick={() => scrollTo('threshold')}
          aria-label="Return to top"
          className="btn-press fixed bottom-6 left-6 z-50 grid h-12 w-12 place-items-center rounded-md border border-emberbright bg-crypt text-xl text-emberbright shadow-lg"
        >
          ↑
        </button>
      )}

      {/* ============ carve-entry popover (click-only preset picker) ============ */}
      {carveStock && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close without carving"
            onClick={() => setCarveStock(false)}
            className="absolute inset-0 cursor-default bg-black/70"
          />
          <div role="dialog" aria-modal="true" aria-label="Carve a new ledger entry" className="relative w-full max-w-lg rounded-md border border-edge bg-crypt p-6 shadow-2xl">
            <p className="font-label text-xs uppercase tracking-[0.22em] text-emberbright">Carve entry</p>
            <h3 className="mt-1 font-display text-3xl font-bold">Choose the marrow</h3>
            {marrowOptions.length === 0 ? (
              <p className="mt-4 text-bonedim">Every known marrow is already carved. The crypts are complete.</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Marrow presets">
                {marrowOptions.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPickedMarrow(p.name)}
                    aria-pressed={pickedMarrow === p.name}
                    className={`btn-press rounded-md border px-3.5 py-2.5 font-label text-xs uppercase tracking-[0.1em] ${
                      pickedMarrow === p.name
                        ? 'border-emberbright bg-ember text-emberink'
                        : 'border-edge text-bonedim hover:border-ember hover:text-bone'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={inscribeMarrow}
                disabled={!pickedMarrow}
                aria-disabled={!pickedMarrow}
                className="btn-press btn-primary flex-1 rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em] disabled:opacity-40"
              >
                Inscribe ×5
              </button>
              <button
                type="button"
                onClick={() => setCarveStock(false)}
                className="btn-press btn-ghost rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em]"
              >
                Leave it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ hatch-a-lark popover ============ */}
      {hatchLark && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close without hatching"
            onClick={() => setHatchLark(false)}
            className="absolute inset-0 cursor-default bg-black/70"
          />
          <div role="dialog" aria-modal="true" aria-label="Hatch a new lark" className="relative w-full max-w-lg rounded-md border border-edge bg-crypt p-6 shadow-2xl">
            <p className="font-label text-xs uppercase tracking-[0.22em] text-emberbright">Hatch a lark</p>
            <h3 className="mt-1 font-display text-3xl font-bold">Name the fledgling</h3>
            {larkOptions.length === 0 ? (
              <p className="mt-4 text-bonedim">Every lark of the flock already roosts here.</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Lark name presets">
                {larkOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPickedLark(n)}
                    aria-pressed={pickedLark === n}
                    className={`btn-press rounded-md border px-3.5 py-2.5 font-label text-xs uppercase tracking-[0.1em] ${
                      pickedLark === n
                        ? 'border-emberbright bg-ember text-emberink'
                        : 'border-edge text-bonedim hover:border-ember hover:text-bone'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={hatch}
                disabled={!pickedLark}
                aria-disabled={!pickedLark}
                className="btn-press btn-primary flex-1 rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em] disabled:opacity-40"
              >
                Settle onto perch
              </button>
              <button
                type="button"
                onClick={() => setHatchLark(false)}
                className="btn-press btn-ghost rounded-md px-5 py-3 font-label text-sm uppercase tracking-[0.12em]"
              >
                Leave it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* whisper toast */}
      {whisper && (
        <div
          key={whisper.key}
          role="status"
          aria-live="polite"
          className="whisper fixed bottom-6 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-edge bg-crypt px-5 py-3 text-center shadow-2xl"
        >
          <span className="text-emberbright" aria-hidden="true">❖ </span>
          <span className="text-bone">{whisper.text}</span>
        </div>
      )}
    </div>
  )
}
