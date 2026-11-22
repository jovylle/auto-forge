import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Zone = { id: string; name: string; tz: string; lat: number; lon: number }

const ZONES: Zone[] = [
  { id: 'akl', name: 'Auckland', tz: 'Pacific/Auckland', lat: -36.9, lon: 174.8 },
  { id: 'syd', name: 'Sydney', tz: 'Australia/Sydney', lat: -33.9, lon: 151.2 },
  { id: 'tok', name: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.7, lon: 139.7 },
  { id: 'sha', name: 'Shanghai', tz: 'Asia/Shanghai', lat: 31.2, lon: 121.5 },
  { id: 'del', name: 'Delhi', tz: 'Asia/Kolkata', lat: 28.6, lon: 77.2 },
  { id: 'dxb', name: 'Dubai', tz: 'Asia/Dubai', lat: 25.3, lon: 55.3 },
  { id: 'mow', name: 'Moscow', tz: 'Europe/Moscow', lat: 55.8, lon: 37.6 },
  { id: 'ist', name: 'Istanbul', tz: 'Europe/Istanbul', lat: 41.0, lon: 28.9 },
  { id: 'ber', name: 'Berlin', tz: 'Europe/Berlin', lat: 52.5, lon: 13.4 },
  { id: 'lon', name: 'London', tz: 'Europe/London', lat: 51.5, lon: -0.1 },
  { id: 'cai', name: 'Cairo', tz: 'Africa/Cairo', lat: 30.0, lon: 31.2 },
  { id: 'utc', name: 'UTC', tz: 'UTC', lat: 0, lon: 0 },
  { id: 'gru', name: 'São Paulo', tz: 'America/Sao_Paulo', lat: -23.5, lon: -46.6 },
  { id: 'nyc', name: 'New York', tz: 'America/New_York', lat: 40.7, lon: -74.0 },
  { id: 'chi', name: 'Chicago', tz: 'America/Chicago', lat: 41.9, lon: -87.6 },
  { id: 'den', name: 'Denver', tz: 'America/Denver', lat: 39.7, lon: -105.0 },
  { id: 'lax', name: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.1, lon: -118.2 },
  { id: 'anc', name: 'Anchorage', tz: 'America/Anchorage', lat: 61.2, lon: -150.0 },
  { id: 'hnl', name: 'Honolulu', tz: 'Pacific/Honolulu', lat: 21.3, lon: -157.8 },
  { id: 'yyt', name: "St. John's", tz: 'America/St_Johns', lat: 47.6, lon: -52.7 },
]

const PINNED = ['utc', 'nyc', 'lax', 'ber', 'tok']

function offsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const parts = dtf.formatToParts(date)
  const g = (t: string) => parts.find((p) => p.type === t)!.value
  const asUtc = Date.UTC(+g('year'), +g('month') - 1, +g('day'), +g('hour'), +g('minute'), +g('second'))
  return (asUtc - date.getTime()) / 60000
}

function toXY(lat: number, lon: number) {
  return { x: (lon + 180) / 360 * 1000, y: (90 - lat) / 180 * 500 }
}

const TRANS_CACHE = new Map<string, { date: Date; from: number; to: number }[]>()
function daysInYear(year: number) {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
}
function transitionsInYear(tz: string, year: number) {
  const key = `${tz}:${year}`
  const cached = TRANS_CACHE.get(key)
  if (cached) return cached
  const out: { date: Date; from: number; to: number }[] = []
  const n = daysInYear(year)
  let prev = offsetMinutes(tz, new Date(Date.UTC(year, 0, 1, 12)))
  for (let d = 1; d < n; d++) {
    const date = new Date(Date.UTC(year, 0, 1 + d, 12))
    const cur = offsetMinutes(tz, date)
    if (cur !== prev) {
      out.push({ date: new Date(Date.UTC(year, 0, 1 + d)), from: prev, to: cur })
      prev = cur
    }
  }
  TRANS_CACHE.set(key, out)
  return out
}

const fmtMonthDay = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const rawYear = parseInt(params.get('y') || '', 10)
  const initYear = Number.isFinite(rawYear) ? Math.min(2030, Math.max(1970, rawYear)) : new Date().getFullYear()
  const rawTz = params.get('tz')
  const initTz = rawTz && ZONES.some((z) => z.id === rawTz) ? rawTz : null
  const [viewYear, setViewYear] = useState<number>(initYear)
  const [playing, setPlaying] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(initTz)
  const [copied, setCopied] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [intro, setIntro] = useState(true)

  const meridianRef = useRef<SVGLineElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const utcH = n.getUTCHours() + n.getUTCMinutes() / 60 + n.getUTCSeconds() / 3600
      const lon = (12 - utcH) * 15
      const x = ((lon + 180) / 360) * 1000
      if (meridianRef.current) {
        meridianRef.current.setAttribute('x1', String(x))
        meridianRef.current.setAttribute('x2', String(x))
      }
      if (clockRef.current) {
        clockRef.current.textContent = n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setViewYear((y) => (y >= 2030 ? 1970 : y + 1))
    }, 900)
    return () => clearInterval(id)
  }, [playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); setPlaying((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const focusDate = useMemo(() => {
    const cy = new Date().getFullYear()
    if (viewYear === cy) return new Date()
    return new Date(viewYear, 2, 15)
  }, [viewYear])

  const yearOffsets = useMemo(() => {
    const m = new Map<string, number>()
    const cy = new Date().getFullYear()
    const d = viewYear === cy ? new Date() : new Date(viewYear, 6, 1, 12)
    for (const z of ZONES) m.set(z.id, offsetMinutes(z.tz, d))
    return m
  }, [viewYear])

  const markers = useMemo(() => {
    const out: { zone: Zone; date: Date; to: number }[] = []
    const windowDays = 30
    for (const z of ZONES) {
      const trans = transitionsInYear(z.tz, viewYear)
      for (const t of trans) {
        const diff = (t.date.getTime() - focusDate.getTime()) / 86400000
        if (Math.abs(diff) <= windowDays) out.push({ zone: z, date: t.date, to: t.to })
      }
    }
    return out.sort((a, b) => a.zone.lon - b.zone.lon)
  }, [viewYear, focusDate])

  const snapshotUrl = useCallback(() => {
    const u = new URL(window.location.href)
    u.searchParams.set('y', String(viewYear))
    if (selectedZone) u.searchParams.set('tz', selectedZone)
    else u.searchParams.delete('tz')
    return u.toString()
  }, [viewYear, selectedZone])

  const onCopy = useCallback(async () => {
    const url = snapshotUrl()
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else throw new Error('no clipboard')
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setShowLink(true)
    }
  }, [snapshotUrl])

  const offsetCounts = useMemo(() => {
    const c = new Map<number, number>()
    for (const off of yearOffsets.values()) c.set(off, (c.get(off) || 0) + 1)
    const max = Math.max(1, ...Array.from(c.values()))
    return { c, max }
  }, [yearOffsets])

  const pinnedPositions = useMemo(() => {
    const items = PINNED.map((id) => {
      const z = ZONES.find((x) => x.id === id)!
      const { y } = toXY(z.lat, z.lon)
      return { id, y }
    }).sort((a, b) => a.y - b.y)
    const out = new Map<string, number>()
    const minGap = 26
    let prev = -Infinity
    for (const it of items) {
      const y = Math.max(it.y, prev + minGap)
      out.set(it.id, y)
      prev = y
    }
    // clamp into 0..500
    const max = 500 - 10
    // shift if overflow
    const last = Array.from(out.values()).pop()!
    if (last > max) {
      const shift = last - max
      for (const [k, v] of out) out.set(k, v - shift)
    }
    return out
  }, [])

  const pinnedZones = ZONES.filter((z) => PINNED.includes(z.id))

  return (
    <div className="relative w-dvw h-dvh overflow-hidden" style={{ background: 'var(--bone)', color: 'var(--ink)' }}>
      {/* Top rail */}
      <header className="absolute top-0 left-0 right-0 h-[72px] z-20">
        <span className="serif text-[28px] leading-none absolute left-6 top-1/2 -translate-y-1/2">Epoch Drift Map</span>
        <span className="mono text-[10px] uppercase tracking-[0.18em] opacity-60 absolute left-[200px] top-1/2 -translate-y-1/2">UTC</span>
        <span ref={clockRef} aria-live="off" className="mono font-medium leading-none tracking-[-0.04em] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(80px,14vw,180px)]" />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-baseline gap-3">
          {selectedZone && (
            <span className="serif italic text-[14px]">
              {ZONES.find((z) => z.id === selectedZone)?.name}
            </span>
          )}
          <span className="mono text-[10px] uppercase tracking-[0.18em] opacity-60">
            {selectedZone
              ? `${(yearOffsets.get(selectedZone)! / 60) > 0 ? '+' : ''}${(yearOffsets.get(selectedZone)! / 60).toFixed(1)}h`
              : '—'}
          </span>
        </div>
      </header>

      {/* Left rail */}
      <aside className="absolute top-[72px] bottom-[144px] left-0 w-[22%] z-10">
        {pinnedZones.map((z) => {
          const off = yearOffsets.get(z.id)!
          const y = pinnedPositions.get(z.id)!
          const pct = (y / 500) * 100
          const sign = off < 0 ? '−' : off > 0 ? '+' : ''
          const mag = Math.abs(off / 60)
          return (
            <div
              key={z.id}
              className="absolute right-3 flex items-center gap-2"
              style={{ top: `${pct}%`, transform: 'translateY(-50%)' }}
            >
              <span className="mono text-[10px] uppercase tracking-[0.18em] opacity-50 tabular-nums">
                {sign}{mag.toFixed(mag % 1 === 0 ? 0 : 1)}
              </span>
              <span className={`serif text-[14px] ${selectedZone === z.id ? 'italic' : ''}`}>{z.name}</span>
              <svg width="40" height="1" className="opacity-40"><line x1="0" y1="0.5" x2="40" y2="0.5" stroke="var(--ink)" strokeWidth="0.5" /></svg>
            </div>
          )
        })}
      </aside>

      {/* Map */}
      <main className="absolute top-[72px] bottom-[144px] left-[22%] right-0 z-0">
        <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" className="w-full h-full" role="img" aria-label="World map with timezone offset bands">
          <title>Epoch Drift Map</title>
          <g opacity="0.12">
            {[-60, -30, 0, 30, 60].map((lat) => {
              const y = (90 - lat) / 180 * 500
              return <line key={lat} x1="0" y1={y} x2="1000" y2={y} stroke="var(--ink)" strokeWidth="0.5" />
            })}
            {Array.from({ length: 13 }, (_, i) => i * 30 - 180).map((lon) => {
              const x = (lon + 180) / 360 * 1000
              return <line key={lon} x1={x} y1="0" x2={x} y2={500} stroke="var(--ink)" strokeWidth="0.5" />
            })}
          </g>
          <g opacity="0.18" fill="var(--ink)">
            <path d="M120,120 Q180,90 260,110 Q300,150 290,200 Q260,260 200,250 Q140,230 120,180 Z" />
            <path d="M230,270 Q280,260 300,320 Q290,400 250,420 Q220,360 230,300 Z" />
            <path d="M470,100 Q520,90 560,110 Q570,160 540,190 Q500,200 470,170 Z" />
            <path d="M490,210 Q540,200 560,280 Q550,370 520,390 Q490,340 490,260 Z" />
            <path d="M560,70 Q700,60 820,90 Q830,180 780,230 Q700,260 620,240 Q570,200 560,140 Z" />
            <path d="M780,300 Q830,290 870,330 Q860,390 820,400 Q780,380 780,340 Z" />
          </g>
          <g style={{ opacity: intro ? 0 : 1, transition: 'opacity 1.2s var(--ease)' }}>
            {Array.from({ length: 27 }, (_, i) => i - 13).map((off) => {
              if (off === 0) return null
              const lon = off * 15
              const x = (lon + 180) / 360 * 1000
              const w = 15 / 360 * 1000
              const west = off < 0
              const color = west ? 'var(--lag)' : 'var(--lead)'
              const cnt = offsetCounts.c.get(off) || 0
              const opacity = 0.16 + 0.62 * (cnt / offsetCounts.max)
              return (
                <rect
                  key={off}
                  x={x - w / 2}
                  y={0}
                  width={w}
                  height={500}
                  fill={color}
                  opacity={opacity}
                  style={{ transition: 'opacity 120ms linear' }}
                />
              )
            })}
            <line x1={500} y1={0} x2={500} y2={500} stroke="var(--ink)" strokeWidth="1" opacity="0.6" />
          </g>
          <line ref={meridianRef} x1={500} y1={0} x2={500} y2={500} stroke="var(--signal)" strokeWidth="1" />
          {markers.map((m, i) => {
            const { x, y } = toXY(m.zone.lat, m.zone.lon)
            const prevX = i > 0 ? toXY(markers[i-1].zone.lat, markers[i-1].zone.lon).x : -999
            const showLabel = Math.abs(x - prevX) > 24
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`${m.zone.name} DST transition ${fmtMonthDay(m.date)}`}
                onClick={() => setSelectedZone(m.zone.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedZone(m.zone.id) }}
                style={{ cursor: 'pointer' }}
              >
                <polygon points={`${x},${y - 6} ${x + 5},${y} ${x},${y + 6} ${x - 5},${y}`} fill="var(--signal)" />
                {showLabel && (
                  <text x={x + 8} y={y + 3} fontSize="9" fontFamily="var(--mono)" fill="var(--ink)" opacity="0.7">
                    {fmtMonthDay(m.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </main>

      {/* Bottom timeline */}
      <footer className="absolute bottom-0 left-0 right-0 h-[144px] z-20 flex flex-col justify-end px-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="mono text-[10px] uppercase tracking-[0.18em] opacity-60">Drift timeline</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
              aria-label={playing ? 'Pause playback' : 'Play playback'}
              className="mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 border border-[var(--ink)] opacity-80 hover:opacity-100"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <span className="mono text-[12px] tabular-nums">{viewYear}</span>
          </div>
        </div>
        <input
          type="range"
          min={1970}
          max={2030}
          aria-label="View year"
          value={viewYear}
          onChange={(e) => setViewYear(Math.min(2030, Math.max(1970, parseInt(e.target.value, 10))))}
          className="w-full"
          style={{ accentColor: 'var(--ink)' }}
        />
        <div className="flex justify-between mt-1 mono text-[10px] opacity-40">
          <span>1970</span>
          <span>2030</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4 mono text-[10px] opacity-60">
            <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: 'var(--lag)', display: 'inline-block' }} /> West</span>
            <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: 'var(--lead)', display: 'inline-block' }} /> East</span>
            <span className="flex items-center gap-1"><span style={{ width: 10, height: 2, background: 'var(--signal)', display: 'inline-block' }} /> Solar noon</span>
          </div>
          <button
            onClick={onCopy}
            className="mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5"
            style={{ background: 'var(--ink)', color: 'var(--bone)' }}
          >
            {copied ? 'Copied' : 'Snapshot link'}
          </button>
          {showLink && (
            <input
              readOnly
              value={snapshotUrl()}
              onFocus={(e) => e.target.select()}
              className="mono text-[10px] w-[40%] px-2 py-1 border border-[var(--ink)]"
            />
          )}
        </div>
      </footer>
    </div>
  )
}
