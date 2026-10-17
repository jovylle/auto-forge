import { useEffect, useMemo, useRef, useState } from 'react'

/* ——— data (plain module constants, not components) ——— */

type Suitability = 'excellent' | 'seasonal' | 'poor'
type Species = 'Smooth newt' | 'Palmate newt' | 'Great crested newt' | 'Eastern red-spotted newt' | 'Unidentified'

interface Sighting {
  id: string
  species: Species
  count: number
  pond: string
  date: string
  notes: string
}

interface Pond {
  name: string
  shade: 'open' | 'dappled' | 'shaded'
  access: 'easy' | 'scramble' | 'private'
  suitability: Suitability
  note: string
  depth: string
}

const SPECIES: Species[] = ['Smooth newt', 'Palmate newt', 'Great crested newt', 'Eastern red-spotted newt', 'Unidentified']

const PONDS: Pond[] = [
  { name: 'Tansy Hollow', shade: 'dappled', access: 'easy', suitability: 'excellent', note: 'Leaf-litter shallows; cresteds courting in April.', depth: '0.6 m' },
  { name: 'Old Mill Dewpond', shade: 'open', access: 'easy', suitability: 'excellent', note: 'Sun-warmed margins, dense starwort egg strips.', depth: '1.1 m' },
  { name: 'Copper Beech Pool', shade: 'shaded', access: 'scramble', suitability: 'seasonal', note: 'Best after rain; dries by late July.', depth: '0.4 m' },
  { name: 'Heron’s Kettle', shade: 'open', access: 'scramble', suitability: 'seasonal', note: 'Deep centre, newts hug the sedge shelf.', depth: '1.8 m' },
  { name: 'Moss Gate Ditch', shade: 'dappled', access: 'easy', suitability: 'seasonal', note: 'Efts on the move at dusk along the culvert.', depth: '0.3 m' },
  { name: 'Wrenfield Farm Pond', shade: 'open', access: 'private', suitability: 'excellent', note: 'Ask at the farmhouse; record counts welcomed.', depth: '0.9 m' },
  { name: 'Slate Quarry Seep', shade: 'shaded', access: 'scramble', suitability: 'poor', note: 'Cold and fish-stocked — efts only, rarely adults.', depth: '2.4 m' },
  { name: 'Orchard Rill', shade: 'dappled', access: 'private', suitability: 'poor', note: 'Flows too fast; try the silted side basin.', depth: '0.2 m' },
]

const STORE_KEY = 'tansy-newt-nook:entries:v1'

function todayISO(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function loadEntries(): Sighting[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const list = parsed.filter(
      (e): e is Sighting =>
        typeof e === 'object' && e !== null &&
        'id' in e && 'species' in e && 'count' in e && 'pond' in e && 'date' in e &&
        typeof (e as Sighting).count === 'number' && typeof (e as Sighting).pond === 'string',
    )
    return list.map((e) => ({ ...e, notes: typeof e.notes === 'string' ? e.notes : '' }))
  } catch {
    return []
  }
}

function escapeCsv(v: string | number): string {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function suitRank(s: Suitability): number {
  return s === 'excellent' ? 0 : s === 'seasonal' ? 1 : 2
}

type Tab = 'log' | 'ponds' | 'export'
type ExportFormat = 'csv' | 'json' | 'text'

/* ——— the single component ——— */

export default function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('log')
  const [entries, setEntries] = useState<Sighting[]>(() => loadEntries())
  const [species, setSpecies] = useState<Species>('Smooth newt')
  const [count, setCount] = useState(1)
  const [pond, setPond] = useState(PONDS[0]?.name ?? 'Tansy Hollow')
  const [customPond, setCustomPond] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [shadeF, setShadeF] = useState<'all' | Pond['shade']>('all')
  const [accessF, setAccessF] = useState<'all' | Pond['access']>('all')
  const [suitF, setSuitF] = useState<'all' | Suitability>('all')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [copied, setCopied] = useState(false)
  const [rippling, setRippling] = useState(false)
  const [hanko, setHanko] = useState(false)
  const rippleTimer = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(entries))
    } catch {
      /* storage full or unavailable — keep in-memory */
    }
  }, [entries])

  useEffect(() => () => {
    if (rippleTimer.current !== null) window.clearTimeout(rippleTimer.current)
  }, [])

  const totalNewts = useMemo(() => entries.reduce((n, e) => n + e.count, 0), [entries])
  const visits = entries.length
  const topPond = useMemo(() => {
    if (entries.length === 0) return '—'
    const tally = new Map<string, number>()
    for (const e of entries) tally.set(e.pond, (tally.get(e.pond) ?? 0) + e.count)
    let best = '—'
    let bestN = -1
    for (const [k, v] of tally) if (v > bestN) { bestN = v; best = k }
    return best
  }, [entries])

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id))),
    [entries],
  )

  const ponds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...PONDS]
      .sort((a, b) => suitRank(a.suitability) - suitRank(b.suitability) || a.name.localeCompare(b.name))
      .filter((p) =>
        (shadeF === 'all' || p.shade === shadeF) &&
        (accessF === 'all' || p.access === accessF) &&
        (suitF === 'all' || p.suitability === suitF) &&
        (q === '' || p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q)),
      )
  }, [query, shadeF, accessF, suitF])

  const exportText = useMemo(() => {
    if (format === 'json') return JSON.stringify({ guide: 'Tansy Newt Nook', exported: new Date().toISOString(), sightings: sorted }, null, 2)
    if (format === 'text') {
      if (sorted.length === 0) return 'Tansy Newt Nook — field notes\n(no sightings yet)'
      const lines = sorted.map((e) => `· ${e.date} — ${e.count}× ${e.species} @ ${e.pond}${e.notes ? ` — ${e.notes}` : ''}`)
      return `Tansy Newt Nook — field notes\n${visits} visits · ${totalNewts} newts\n${lines.join('\n')}`
    }
    const head = 'date,species,count,pond,notes'
    const rows = sorted.map((e) => [e.date, escapeCsv(e.species), e.count, escapeCsv(e.pond), escapeCsv(e.notes)].join(','))
    return [head, ...rows].join('\n')
  }, [format, sorted, visits, totalNewts])

  function record(): void {
    const pondName = customPond.trim() !== '' ? customPond.trim() : pond
    if (pondName === '') return
    const entry: Sighting = { id: uid(), species, count: Math.max(1, Math.min(99, count)), pond: pondName, date: date || todayISO(), notes: notes.trim() }
    setEntries((prev) => [entry, ...prev])
    setNotes('')
    setCustomPond('')
    setRippling(true)
    if (rippleTimer.current !== null) window.clearTimeout(rippleTimer.current)
    rippleTimer.current = window.setTimeout(() => setRippling(false), 750)
  }

  function remove(id: string): void {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function logAt(pondName: string): void {
    setPond(pondName)
    setCustomPond('')
    setTab('log')
  }

  async function copyExport(): Promise<void> {
    let ok = false
    try {
      await navigator.clipboard.writeText(exportText)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = exportText
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (!ok) return
    setCopied(true)
    setHanko(true)
    window.setTimeout(() => setCopied(false), 2400)
    window.setTimeout(() => setHanko(false), 260)
  }

  function downloadExport(): void {
    const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tansy-newt-nook-field-notes.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function suitDot(s: Suitability): string {
    return s === 'excellent' ? 'bg-pond' : s === 'seasonal' ? 'bg-midori' : 'bg-hai'
  }

  const tabs: { id: Tab; kanji: string; label: string }[] = [
    { id: 'log', kanji: '誌', label: 'Log' },
    { id: 'ponds', kanji: '池', label: 'Ponds' },
    { id: 'export', kanji: '刷', label: 'Export' },
  ]

  return (
    <div className="washi-grain min-h-screen bg-washi text-sumi">
      <div className="book-plate mx-auto max-w-6xl px-5 pb-28 pt-6 md:px-10 md:pb-16 md:pt-10">
        {/* masthead */}
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="field-label text-pond">Pocket field guide · 其の一</p>
            <h1 className="mt-2 font-mincho text-4xl leading-tight font-bold md:text-6xl">
              Tansy Newt<br />Nook
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-sumi/80">
              A pocket field guide to pond newts — log what you lift the net for,
              learn which water holds them, and carry your notes home.
            </p>
          </div>
          <div className="vertical-masthead hidden select-none font-mincho text-lg tracking-[0.5em] text-sumi/60 md:block" aria-hidden="true">
            山椒魚の野帳
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1" aria-hidden="true">
            <span className="grid h-14 w-14 place-items-center bg-shu font-mincho text-2xl font-bold text-washi shadow-[3px_3px_0_0_#23211C]">蛭</span>
            <span className="text-[0.6rem] tracking-[0.3em] text-sumi/60">NEWT</span>
          </div>
        </header>

        {/* stat strip */}
        <dl className="mt-8 grid grid-cols-3 divide-x divide-sumi/30 border-y hairline">
          {[
            { k: 'Visits', v: String(visits) },
            { k: 'Newts seen', v: String(totalNewts) },
            { k: 'Favoured water', v: topPond },
          ].map((s) => (
            <div key={s.k} className="px-4 py-3">
              <dt className="field-label text-sumi/60">{s.k}</dt>
              <dd className="tabular mt-1 truncate font-mincho text-xl font-semibold md:text-2xl" title={s.v}>{s.v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 md:flex md:gap-10">
          {/* rail nav (desktop) / tab bar links */}
          <nav aria-label="Guide sections" className="mb-6 flex gap-6 md:mb-0 md:w-20 md:shrink-0 md:flex-col md:gap-8 md:border-r hairline md:pr-6 md:pt-16">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                data-active={tab === t.id}
                onClick={() => setTab(t.id)}
                className="nav-link group flex items-baseline gap-2 text-left md:flex-col md:items-center md:gap-1"
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <span className={`font-mincho text-2xl transition-opacity ${tab === t.id ? 'text-pond' : 'text-sumi/50 group-hover:text-sumi'}`}>{t.kanji}</span>
                <span className={`field-label ${tab === t.id ? 'text-pond' : 'text-sumi/50'}`}>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* main column — asymmetric: ledger wide, pond shelf narrow */}
          <div className="min-w-0 flex-1">
            {tab === 'log' && (
              <section aria-label="Newt log" className="md:grid md:grid-cols-[62%_1fr] md:gap-10">
                <div>
                  <h2 className="font-mincho text-3xl font-semibold"><span className="mr-3 text-sm text-shu">壱</span>Newt log</h2>
                  {/* record card */}
                  <div className="mt-4 border border-sumi/60 bg-kinari p-5 shadow-[5px_5px_0_0_rgba(35,33,28,0.9)]">
                    <p className="field-label text-sumi/60">Record a sighting</p>
                    <label className="mt-4 block">
                      <span className="field-label text-sumi/70">Species</span>
                      <select
                        value={species}
                        onChange={(e) => setSpecies(e.target.value as Species)}
                        className="mt-1 w-full border border-sumi/60 bg-washi px-3 py-2 font-mincho text-lg"
                      >
                        {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <div className="mt-4 flex items-end gap-5">
                      <div className="relative">
                        <span className="field-label text-sumi/70">Count</span>
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" aria-label="One fewer" onClick={() => setCount((c) => Math.max(1, c - 1))}
                            className="grid h-9 w-9 place-items-center border border-sumi/60 bg-washi text-xl transition-colors hover:bg-pond hover:text-washi">−</button>
                          <output aria-live="polite" className="tabular w-12 text-center font-mincho text-3xl font-bold text-shu">{count}</output>
                          <button type="button" aria-label="One more" onClick={() => setCount((c) => Math.min(99, c + 1))}
                            className="grid h-9 w-9 place-items-center border border-sumi/60 bg-washi text-xl transition-colors hover:bg-pond hover:text-washi">＋</button>
                        </div>
                        {rippling && (
                          <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                            <span className="ripple-ring block h-16 w-16 rounded-full border-2 border-pond" />
                          </span>
                        )}
                      </div>
                      <label className="flex-1">
                        <span className="field-label text-sumi/70">Date</span>
                        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)}
                          className="mt-1 w-full border border-sumi/60 bg-washi px-3 py-2" />
                      </label>
                    </div>
                    <label className="mt-4 block">
                      <span className="field-label text-sumi/70">Pond</span>
                      <select value={pond} onChange={(e) => setPond(e.target.value)}
                        className="mt-1 w-full border border-sumi/60 bg-washi px-3 py-2">
                        {PONDS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    </label>
                    <label className="mt-3 block">
                      <span className="field-label text-sumi/70">…or a new water (optional)</span>
                      <input type="text" value={customPond} onChange={(e) => setCustomPond(e.target.value)} placeholder="e.g. Quarry finger pond"
                        className="mt-1 w-full border border-dashed border-sumi/50 bg-washi px-3 py-2 placeholder:text-sumi/35" />
                    </label>
                    <label className="mt-3 block">
                      <span className="field-label text-sumi/70">Field note</span>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Belly spots, crest height, weather…"
                        className="mt-1 w-full resize-y border border-sumi/60 bg-washi px-3 py-2 placeholder:text-sumi/35" />
                    </label>
                    <button type="button" onClick={record}
                      className="mt-4 w-full bg-shu px-4 py-3 font-mincho text-lg font-bold text-washi shadow-[3px_3px_0_0_#23211C] transition-transform hover:-translate-y-0.5 active:translate-y-0">
                      記録する · Record sighting
                    </button>
                  </div>
                </div>

                {/* ledger */}
                <div className="mt-8 md:mt-16">
                  <h3 className="field-label text-sumi/60">Ledger · {visits} {visits === 1 ? 'visit' : 'visits'}</h3>
                  {sorted.length === 0 ? (
                    <div className="mt-4 border border-dashed border-sumi/40 px-6 py-10 text-center">
                      <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24" role="img" aria-label="Empty log — an enso ink ring">
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#2E5A4C" strokeWidth="7" strokeLinecap="round" className="enso-ring" />
                      </svg>
                      <p className="mt-4 font-mincho text-lg">The page is still blank.</p>
                      <p className="mt-1 text-sm text-sumi/60">Lift a net, count the wrigglers, and ink your first row.</p>
                    </div>
                  ) : (
                    <ol className="mt-2 divide-y divide-sumi/25 border-y hairline">
                      {sorted.map((e, i) => (
                        <li key={e.id} className="ledger-row flex items-start justify-between gap-3 py-3" style={{ animationDelay: `${Math.min(i, 12) * 8}ms` }}>
                          <div className="min-w-0">
                            <p className="font-mincho text-lg leading-snug font-semibold">{e.species} <span className="tabular text-shu">×{e.count}</span></p>
                            <p className="mt-0.5 truncate text-xs tracking-wide text-sumi/65">{e.pond} · {e.date}</p>
                            {e.notes !== '' && <p className="mt-0.5 line-clamp-2 text-xs text-sumi/75 italic">“{e.notes}”</p>}
                          </div>
                          <button type="button" onClick={() => remove(e.id)} aria-label={`Delete sighting of ${e.species} at ${e.pond}`}
                            className="shrink-0 border border-sumi/40 px-2 py-1 text-xs text-sumi/60 transition-colors hover:border-shu hover:text-shu">消</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            )}

            {tab === 'ponds' && (
              <section aria-label="Pond finder">
                <h2 className="font-mincho text-3xl font-semibold"><span className="mr-3 text-sm text-shu">弐</span>Pond finder</h2>
                <p className="mt-2 max-w-xl text-sm text-sumi/70">Eight known waters, ranked by newt-keenness. Filter by shade, footing and promise — then log straight from the bank.</p>
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <label className="flex-1">
                    <span className="sr-only">Search ponds</span>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search waters…"
                      className="w-full border border-sumi/60 bg-kinari px-3 py-2 placeholder:text-sumi/40" />
                  </label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Shade filter">
                    {(['all', 'open', 'dappled', 'shaded'] as const).map((o) => (
                      <button key={o} type="button" onClick={() => setShadeF(o)} aria-pressed={shadeF === o}
                        className={`border px-3 py-1 text-xs tracking-widest uppercase transition-colors ${shadeF === o ? 'border-pond bg-pond text-washi' : 'border-sumi/40 text-sumi/65 hover:border-sumi'}`}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Access filter">
                  {(['all', 'easy', 'scramble', 'private'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => setAccessF(o)} aria-pressed={accessF === o}
                      className={`border px-3 py-1 text-xs tracking-widest uppercase transition-colors ${accessF === o ? 'border-pond bg-pond text-washi' : 'border-sumi/40 text-sumi/65 hover:border-sumi'}`}>{o === 'all' ? 'any access' : o}</button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Suitability filter">
                  {(['all', 'excellent', 'seasonal', 'poor'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => setSuitF(o)} aria-pressed={suitF === o}
                      className={`border px-3 py-1 text-xs tracking-widest uppercase transition-colors ${suitF === o ? 'border-shu bg-shu text-washi' : 'border-sumi/40 text-sumi/65 hover:border-sumi'}`}>{o === 'all' ? 'any water' : o}</button>
                  ))}
                </div>
                {ponds.length === 0 ? (
                  <p className="mt-6 border border-dashed border-sumi/40 p-6 text-center font-mincho text-lg">No water matches — loosen the net.</p>
                ) : (
                  <ol className="mt-5 grid gap-4 sm:grid-cols-2">
                    {ponds.map((p) => (
                      <li key={p.name} className="group border border-sumi/60 bg-kinari p-4 transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_0_rgba(46,90,76,0.9)]">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-mincho text-xl font-semibold">{p.name}</h3>
                          <span className="flex items-center gap-1.5 text-[0.65rem] tracking-[0.2em] uppercase" title={`Suitability: ${p.suitability}`}>
                            <span className={`inline-block h-3 w-3 rounded-full ${suitDot(p.suitability)}`} aria-hidden="true" />
                            {p.suitability}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-sumi/80">{p.note}</p>
                        <p className="tabular mt-2 text-xs tracking-wide text-sumi/60">shade · {p.shade} — access · {p.access} — depth · {p.depth}</p>
                        <button type="button" onClick={() => logAt(p.name)}
                          className="mt-3 border border-pond px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-pond uppercase transition-colors hover:bg-pond hover:text-washi">
                          Log here →
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {tab === 'export' && (
              <section aria-label="Field export">
                <h2 className="font-mincho text-3xl font-semibold"><span className="mr-3 text-sm text-shu">参</span>Field export</h2>
                <p className="mt-2 max-w-xl text-sm text-sumi/70">Press your notes into a take-home sheet — {visits} {visits === 1 ? 'visit' : 'visits'}, {totalNewts} newts, ready to carry.</p>
                <div className="mt-4 flex gap-2" role="group" aria-label="Export format">
                  {(['csv', 'json', 'text'] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f}
                      className={`border px-5 py-2 font-mincho text-lg transition-colors ${format === f ? 'border-sumi bg-sumi text-washi' : 'border-sumi/40 text-sumi/65 hover:border-sumi'}`}>{f.toUpperCase()}</button>
                  ))}
                </div>
                <div className="relative mt-4">
                  <label htmlFor="export-preview" className="field-label text-sumi/60">Preview</label>
                  <textarea id="export-preview" readOnly value={exportText} rows={12}
                    className="tabular mt-1 w-full resize-y border border-sumi/60 bg-sumi p-4 font-mono text-xs leading-relaxed text-washi" />
                  {copied && <p role="status" className="ink-fade absolute top-8 right-4 bg-shu px-3 py-1 font-mincho text-sm font-bold text-washi">copied 済</p>}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => void copyExport()} className={hanko ? 'hanko-press grid h-16 w-16 shrink-0 place-items-center self-start bg-shu font-mincho text-2xl font-bold text-washi shadow-[3px_3px_0_0_#23211C] sm:self-auto' : 'grid h-16 w-16 shrink-0 place-items-center self-start bg-shu font-mincho text-2xl font-bold text-washi shadow-[3px_3px_0_0_#23211C] transition-transform hover:-translate-y-0.5 sm:self-auto'}>
                    写
                  </button>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => void copyExport()}
                      className="flex-1 border border-sumi bg-washi px-4 py-3 text-sm font-bold tracking-[0.2em] uppercase transition-colors hover:bg-pond hover:text-washi">
                      Copy {format.toUpperCase()}
                    </button>
                    <button type="button" onClick={downloadExport}
                      className="flex-1 bg-pond px-4 py-3 text-sm font-bold tracking-[0.2em] text-washi uppercase shadow-[3px_3px_0_0_#23211C] transition-transform hover:-translate-y-0.5">
                      Download file
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-sumi/55">Notes never leave this device until you carry them — everything lives in localStorage.</p>
              </section>
            )}
          </div>
        </div>

        <footer className="mt-12 flex items-center justify-between border-t hairline pt-4 text-xs text-sumi/55">
          <p className="font-mincho">田菖蒲イモリの庵 — handle newts gently, wet hands only.</p>
          <p className="tabular hidden sm:block">{visits} visits · {totalNewts} newts</p>
        </footer>
      </div>

      {/* mobile bottom tab bar */}
      <nav aria-label="Guide sections" className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-sumi bg-washi/95 backdrop-blur md:hidden">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex items-center justify-center gap-2 py-3.5 ${tab === t.id ? 'bg-pond text-washi' : 'text-sumi/70'}`}>
            <span className="font-mincho text-lg">{t.kanji}</span>
            <span className="text-[0.65rem] font-bold tracking-[0.25em] uppercase">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
