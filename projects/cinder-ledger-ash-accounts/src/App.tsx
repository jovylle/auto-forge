import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  CATS,
  KEYS,
  catName,
  cx,
  fmtDate,
  fmtMoney,
  isValidEntry,
  load,
  save,
  shareCard,
  toCSV,
  totals,
  uid,
  type Entry,
  type Kind,
} from './lib'
import { isSoundOn, setSoundOn, sndAsh, sndBurn, sndClick, sndDelete, sndEmber, sndExport } from './audio'

type Filter = 'all' | Kind

interface Burst {
  id: number
  kind: Kind
  x: number
}

const DEMO: Entry[] = [
  { id: 'demo-1', label: 'Freelance poster gig', amount: 420, kind: 'ember', cat: 'spark', ts: Date.now() - 86400000 * 3 },
  { id: 'demo-2', label: 'Groceries at the corner', amount: 68.4, kind: 'ash', cat: 'meal', ts: Date.now() - 86400000 * 2 },
  { id: 'demo-3', label: 'Studio rent', amount: 310, kind: 'ash', cat: 'shelter', ts: Date.now() - 86400000 },
  { id: 'demo-4', label: 'Sold old lamp', amount: 45, kind: 'ember', cat: 'drift', ts: Date.now() - 3600000 * 5 },
]

function Shape({ shape, kind }: { shape: string; kind: Kind }): JSX.Element {
  return <span aria-hidden="true" className={cx('shape', `sh-${shape}`, kind === 'ember' ? 'k-ember' : 'k-ash')} />
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    const raw = load<unknown[]>(KEYS.entries, [])
    const clean = raw.filter(isValidEntry)
    return clean.sort((a, b) => b.ts - a.ts)
  })
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<Kind>('ash')
  const [cat, setCat] = useState<string>('meal')
  const [filter, setFilter] = useState<Filter>('all')
  const [snd, setSnd] = useState<boolean>(() => isSoundOn())
  const [err, setErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [confirmBurn, setConfirmBurn] = useState(false)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const burstId = useRef(0)

  useEffect(() => save(KEYS.entries, entries), [entries])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2200)
    return () => window.clearTimeout(t)
  }, [flash])

  const t = useMemo(() => totals(entries), [entries])
  const shown = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.kind === filter)),
    [entries, filter],
  )
  const burnPct = t.ember > 0 ? Math.min(100, Math.round((t.ash / t.ember) * 100)) : t.ash > 0 ? 100 : 0

  function spawnBurst(k: Kind): void {
    const id = ++burstId.current
    setBursts((p) => [...p.slice(-11), { id, kind: k, x: 8 + Math.random() * 84 }])
    window.setTimeout(() => setBursts((p) => p.filter((b) => b.id !== id)), 1100)
  }

  function addEntry(): void {
    const amt = Number.parseFloat(amount)
    if (!label.trim()) {
      setErr('Name the cinder first.')
      sndClick()
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Amount must be a number above zero.')
      sndClick()
      return
    }
    const e: Entry = { id: uid(), label: label.trim().slice(0, 60), amount: Math.round(amt * 100) / 100, kind, cat, ts: Date.now() }
    setEntries((p) => [e, ...p])
    setLabel('')
    setAmount('')
    setErr(null)
    setFlash(kind === 'ember' ? '▲ ember caught' : '▼ burned to ash')
    spawnBurst(kind)
    if (kind === 'ember') sndEmber()
    else sndAsh()
  }

  function del(id: string): void {
    setEntries((p) => p.filter((e) => e.id !== id))
    sndDelete()
  }

  function burnAll(): void {
    if (!confirmBurn) {
      setConfirmBurn(true)
      sndClick()
      window.setTimeout(() => setConfirmBurn(false), 3000)
      return
    }
    setEntries([])
    setConfirmBurn(false)
    setFlash('∅ ledger reduced to ash')
    sndBurn()
  }

  function toggleSnd(): void {
    const next = !snd
    setSnd(next)
    setSoundOn(next)
    if (next) window.setTimeout(() => sndClick(), 30)
  }

  function download(name: string, text: string, mime: string): void {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 800)
    setFlash(`◉ exported ${name}`)
    sndExport()
  }

  async function copyCard(): Promise<void> {
    const text = shareCard(entries)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFlash('◉ share card copied')
      sndExport()
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Clipboard blocked — select the card text manually.')
    }
  }

  function onImportFile(file: File): void {
    const r = new FileReader()
    r.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(r.result))
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        const clean = arr.filter(isValidEntry)
        if (clean.length === 0) {
          setErr('That file holds no valid entries.')
          return
        }
        setEntries((p) => [...clean.map((e) => ({ ...e, id: uid() })), ...p])
        setFlash(`◉ imported ${clean.length} entries`)
        sndExport()
      } catch {
        setErr('Could not read that JSON file.')
      }
    }
    r.readAsText(file)
  }

  return (
    <div className="ledger-root">
      <div aria-hidden="true" className="burst-layer">
        {bursts.map((b) => (
          <span key={b.id} className={cx('burst', b.kind === 'ember' ? 'b-ember' : 'b-ash')} style={{ left: `${b.x}%` }}>
            {b.kind === 'ember' ? '▲' : '▼'}
          </span>
        ))}
      </div>

      <aside className="rail" aria-hidden="true">
        <span className="rail-word">ASH · ACCOUNTS · 1923</span>
        <span className="rail-dot r" />
        <span className="rail-dot b" />
        <span className="rail-dot y" />
      </aside>

      <main className="ledger-main">
        <header className="masthead">
          <div className="mast-geo" aria-hidden="true">
            <span className="geo-circle" />
            <span className="geo-tri" />
            <span className="geo-bar" />
          </div>
          <div className="mast-text">
            <p className="kicker">◉ Bauhaus bookkeeping · № 07</p>
            <h1 className="wordmark">
              CINDER
              <br />
              LEDGER
            </h1>
            <p className="sub">Burn every coin. Ember in, ash out — the balance is what survives the fire.</p>
          </div>
          <button
            type="button"
            className={cx('snd-btn', snd && 'on')}
            onClick={toggleSnd}
            aria-pressed={snd}
            aria-label={`Sound ${snd ? 'on' : 'off'}`}
          >
            {snd ? '♪ ON' : '♪ OFF'}
          </button>
        </header>

        {(flash ?? err) && (
          <p role="status" className={cx('notice', err ? 'is-err' : 'is-ok')}>
            {err ?? flash}
          </p>
        )}

        <section className="blocks" aria-label="Totals">
          <div className="block b-red">
            <p className="block-k">▲ ember in</p>
            <p className="block-v">{fmtMoney(t.ember)}</p>
          </div>
          <div className="block b-blue">
            <p className="block-k">▼ ash out</p>
            <p className="block-v">{fmtMoney(t.ash)}</p>
          </div>
          <div className="block b-ink">
            <p className="block-k">● survives</p>
            <p className={cx('block-v', t.balance < 0 && 'neg')}>{fmtMoney(t.balance)}</p>
          </div>
          <div className="block b-yellow burn-block">
            <p className="block-k">◉ burn rate — {burnPct}%</p>
            <div className="burn-track" role="img" aria-label={`Burn rate ${burnPct} percent`}>
              <div className="burn-fill" style={{ width: `${burnPct}%` }} />
            </div>
            <p className="burn-cap">
              {burnPct <= 50 ? 'a tidy fire' : burnPct <= 90 ? 'running hot' : 'nearly all ash'}
            </p>
          </div>
        </section>

        <div className="cols">
          <section className="panel form-panel" aria-label="Add entry">
            <h2 className="panel-title">
              <span className="t-square" aria-hidden="true" /> stoke the ledger
            </h2>
            <label className="field">
              <span>entry name</span>
              <input
                className="inp"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. market bread"
                maxLength={60}
                aria-label="Entry name"
              />
            </label>
            <label className="field">
              <span>amount $</span>
              <input
                className={cx('inp', 'num')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                aria-label="Amount in dollars"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addEntry()
                }}
              />
            </label>
            <div className="field">
              <span id="kind-hint">kind</span>
              <div className="kind-row" role="group" aria-labelledby="kind-hint">
                <button
                  type="button"
                  className={cx('kind', kind === 'ember' && 'sel-e')}
                  onClick={() => {
                    setKind('ember')
                    sndClick()
                  }}
                  aria-pressed={kind === 'ember'}
                >
                  ▲ ember · income
                </button>
                <button
                  type="button"
                  className={cx('kind', kind === 'ash' && 'sel-a')}
                  onClick={() => {
                    setKind('ash')
                    sndClick()
                  }}
                  aria-pressed={kind === 'ash'}
                >
                  ▼ ash · expense
                </button>
              </div>
            </div>
            <div className="field">
              <span id="cat-hint">account shape</span>
              <div className="cat-row" role="group" aria-labelledby="cat-hint">
                {CATS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={cx('cat-chip', cat === c.id && 'sel')}
                    onClick={() => {
                      setCat(c.id)
                      sndClick()
                    }}
                    aria-pressed={cat === c.id}
                    title={c.name}
                  >
                    <Shape shape={c.shape} kind={kind} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="stoke" onClick={addEntry}>
              {kind === 'ember' ? '▲ catch ember' : '▼ burn to ash'}
            </button>
          </section>

          <section className="panel list-panel" aria-label="Entries">
            <div className="list-head">
              <h2 className="panel-title">
                <span className="t-circle" aria-hidden="true" /> ash accounts
              </h2>
              <div className="filters" role="group" aria-label="Filter entries">
                {(['all', 'ember', 'ash'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={cx('f-chip', filter === f && 'sel')}
                    onClick={() => {
                      setFilter(f)
                      sndClick()
                    }}
                    aria-pressed={filter === f}
                  >
                    {f === 'all' ? '◉ all' : f === 'ember' ? '▲ ember' : '▼ ash'}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="empty">
                <p className="empty-big">∅</p>
                <p>{entries.length === 0 ? 'The grate is empty. Strike the first cinder.' : 'Nothing burned under this filter.'}</p>
                {entries.length === 0 && (
                  <button
                    type="button"
                    className="demo-btn"
                    onClick={() => {
                      setEntries([...DEMO].sort((a, b) => b.ts - a.ts))
                      setFlash('◉ demo cinders struck')
                      sndEmber()
                    }}
                  >
                    ◉ strike demo cinders
                  </button>
                )}
              </div>
            ) : (
              <ul className="rows">
                {shown.map((e) => {
                  const shape = CATS.find((c) => c.id === e.cat)?.shape ?? 'bar'
                  return (
                    <li key={e.id} className={cx('row', e.kind === 'ember' ? 'is-ember' : 'is-ash')}>
                      <Shape shape={shape} kind={e.kind} />
                      <div className="row-main">
                        <p className="row-label">{e.label}</p>
                        <p className="row-meta">
                          {e.kind === 'ember' ? '▲' : '▼'} {catName(e.cat)} · {fmtDate(e.ts)}
                        </p>
                      </div>
                      <p className="row-amt">
                        {e.kind === 'ember' ? '+' : '−'}
                        {fmtMoney(e.amount).replace('−', '').replace('$', '$')}
                      </p>
                      <button type="button" className="row-del" onClick={() => del(e.id)} aria-label={`Delete ${e.label}`}>
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="list-foot">
              <p className="count">
                {shown.length} of {entries.length} entries
              </p>
              <button
                type="button"
                className={cx('burn-all', confirmBurn && 'arm')}
                onClick={burnAll}
                disabled={entries.length === 0}
              >
                {confirmBurn ? '☒ confirm — reduce all to ash?' : '☒ burn entire ledger'}
              </button>
            </div>
          </section>
        </div>

        <section className="panel share-panel" aria-label="Share and export">
          <h2 className="panel-title">
            <span className="t-bar" aria-hidden="true" /> carry the cinders
          </h2>
          <div className="share-grid">
            <div className="share-card" aria-label="Share card preview">
              <pre>{shareCard(entries)}</pre>
            </div>
            <div className="share-btns">
              <button type="button" className="s-btn" onClick={() => download('cinder-ledger.csv', toCSV(entries), 'text/csv')}>
                ◉ export CSV
              </button>
              <button
                type="button"
                className="s-btn"
                onClick={() => download('cinder-ledger.json', JSON.stringify(entries, null, 2), 'application/json')}
              >
                ◉ export JSON
              </button>
              <button type="button" className="s-btn" onClick={() => void copyCard()}>
                {copied ? '◉ copied!' : '◉ copy share card'}
              </button>
              <button type="button" className="s-btn ghost" onClick={() => fileRef.current?.click()}>
                ◉ import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                aria-label="Import JSON file"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </section>

        <footer className="foot">
          <span className="foot-shapes" aria-hidden="true">
            <i className="fs-c" /> <i className="fs-s" /> <i className="fs-t" />
          </span>
          <p>cinder ledger · ash accounts — everything stays in your localStorage · every touch makes a sound</p>
        </footer>
      </main>
    </div>
  )
}
