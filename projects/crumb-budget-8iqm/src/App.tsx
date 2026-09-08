import { useEffect, useRef, useState } from 'react'
import {
  KEYS,
  cx,
  defaultChoice,
  fmtMoney,
  fmtSnack,
  load,
  save,
  snackLabel,
  todaySpend,
  uid,
  type CategoryId,
  type Entry,
  type SnackChoice,
} from './lib'
import { isSoundOn, setSoundOn, sunTick } from './audio'
import { Decor } from './components/decor'
import { Converter } from './components/Converter'
import { Log } from './components/Log'
import { Chart } from './components/Chart'
import { Egg } from './components/Egg'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

function validSnack(raw: unknown): SnackChoice {
  if (typeof raw !== 'object' || raw === null) return defaultChoice()
  const r = raw as { kind?: string; id?: string; name?: string; price?: number }
  if (r.kind === 'preset' && typeof r.id === 'string') {
    return { kind: 'preset', id: r.id }
  }
  if (r.kind === 'custom' && typeof r.name === 'string' && typeof r.price === 'number' && r.price > 0) {
    return { kind: 'custom', name: r.name, price: r.price }
  }
  return defaultChoice()
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => load<Entry[]>(KEYS.entries, []))
  const [snack, setSnack] = useState<SnackChoice>(() => validSnack(load(KEYS.snack, null)))
  const [budget, setBudget] = useState<number>(() => load<number>(KEYS.budget, 100))
  const [snd, setSnd] = useState<boolean>(() => isSoundOn())
  const [egg, setEgg] = useState(false)
  const [sunPokes, setSunPokes] = useState(0)
  const konamiRef = useRef<string[]>([])

  useEffect(() => save(KEYS.entries, entries), [entries])
  useEffect(() => save(KEYS.snack, snack), [snack])
  useEffect(() => save(KEYS.budget, budget), [budget])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const buf = [...konamiRef.current, e.key].slice(-KONAMI.length)
      if (buf.join() === KONAMI.join()) {
        konamiRef.current = []
        triggerEgg()
      } else {
        konamiRef.current = buf
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const triggerEgg = () => {
    setEgg(true)
    setSunPokes(0)
  }

  const pokeSun = () => {
    const c = sunPokes + 1
    setSunPokes(c)
    if (c >= 5) {
      triggerEgg()
    } else {
      sunTick(c)
    }
  }

  const toggleSnd = () => {
    const next = !snd
    setSnd(next)
    setSoundOn(next)
  }

  const addEntry = (e: { name: string; amount: number; category: CategoryId }) => {
    setEntries((prev) => [{ id: uid(), ...e, ts: Date.now() }, ...prev])
  }

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((x) => x.id !== id))
  }

  const cur = snackLabel(snack)
  const today = todaySpend(entries)

  return (
    <div className="app relative min-h-screen">
      <Decor />
      {egg && <Egg lifetimeTotal={entries.reduce((s, e) => s + e.amount, 0)} onClose={() => setEgg(false)} />}

      <main className="relative z-10 mx-auto grid max-w-[1280px] grid-cols-12 gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <header className="col-span-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="wordmark">CRUMB BUDGET</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <span className="katakana">クラム・バジェット</span>
              <span aria-hidden="true">·</span>
              track spending in snack units
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cx('chip', snd && 'sel')}
              onClick={toggleSnd}
              aria-pressed={snd}
              aria-label={`Sound ${snd ? 'on' : 'off'}`}
            >
              <span aria-hidden="true">{snd ? '🔊' : '🔇'}</span>
              SND
            </button>
            <div className="text-right">
              <p className="text-[0.6rem] uppercase tracking-[0.25em] text-muted">today</p>
              <p className="term-num text-2xl leading-none text-lilac">{fmtMoney(today)}</p>
              <p className="term-num text-sm text-cyan">
                ≈ {fmtSnack(today / cur.price)} {cur.emoji}
              </p>
            </div>
          </div>
        </header>

        <Converter snack={snack} onSnack={setSnack} onPokeSun={pokeSun} />
        <Log
          entries={entries}
          onAdd={addEntry}
          onDelete={deleteEntry}
          snackEmoji={cur.emoji}
          snackName={cur.name}
          snackPrice={cur.price}
        />
        <Chart
          entries={entries}
          snackPrice={cur.price}
          snackEmoji={cur.emoji}
          budget={budget}
          onBudgetChange={setBudget}
        />

        <footer className="col-span-12 pb-4 text-center text-xs text-muted">
          <span className="katakana">エンドレス・サマー</span> · everything stays in your localStorage · the sun is
          clickable… probably
        </footer>
      </main>
    </div>
  )
}