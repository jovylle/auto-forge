import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  CURRENCY,
  DAILY_BUDGET,
  DEFAULT_SNACK_ID,
  SNACKS,
  WEEKLY_BUDGET,
  fmtMoney,
  getSnack,
  leftover,
  snackCount,
  wholeSnacks,
} from './snacks'
import {
  loadExpenses,
  saveExpenses,
  todayISO,
  lastNDays,
  dayShort,
  fmtDateRange,
  uid,
} from './storage'
import type { Expense } from './storage'
import { tiltHandlers, useCountUp, useReducedMotion } from './hooks'

const DAYS = 7

function Glass({
  className = '',
  children,
  tilt = true,
  ...rest
}: {
  className?: string
  children: ReactNode
  tilt?: boolean
  onMouseMove?: (e: MouseEvent<HTMLElement>) => void
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void
}) {
  const t = tiltHandlers(tilt)
  return (
    <section className={`glass ${className}`} {...t} {...rest}>
      {children}
    </section>
  )
}

export default function App() {
  const reduce = useReducedMotion()
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses())
  const [snackId, setSnackId] = useState<string>(() => {
    try {
      return localStorage.getItem('crumb-budget:snack') ?? DEFAULT_SNACK_ID
    } catch {
      return DEFAULT_SNACK_ID
    }
  })
  const skipSave = useRef(true)

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveExpenses(expenses)
  }, [expenses])

  useEffect(() => {
    try {
      localStorage.setItem('crumb-budget:snack', snackId)
    } catch {
      // ignore
    }
  }, [snackId])

  const days = lastNDays(DAYS)
  const dailyTotals = days.map((d) =>
    expenses.filter((e) => e.date === d).reduce((sum, e) => sum + e.amount, 0),
  )

  const weekTotal = dailyTotals.reduce((a, b) => a + b, 0)
  const allTime = expenses.reduce((sum, e) => sum + e.amount, 0)

  const addExpense = (e: Expense): void => {
    setExpenses((prev) => [e, ...prev])
  }

  const removeExpense = (id: string): void => {
    setExpenses((prev) => prev.filter((x) => x.id !== id))
  }

  const clearAll = (): void => {
    if (window.confirm('Clear the whole shelf of crumbs?')) setExpenses([])
  }

  const snack = getSnack(snackId)
  const over = weekTotal > WEEKLY_BUDGET

  return (
    <div className="app-shell">
      <div className="blob blob-candy" />
      <div className="blob blob-toffee" />
      <div className="blob blob-pistachio" />
      <div className="grain" />

      <div className="app-frame">
        <Header weekRange={fmtDateRange(days)} crumbCount={expenses.length} onClear={clearAll} />

        <Hero
          reduce={reduce}
          weekTotal={weekTotal}
          snackId={snackId}
          over={over}
          snack={snack}
        />

        <Chart days={days} dailyTotals={dailyTotals} snack={snack} weekTotal={weekTotal} />

        <SnackConverter snackId={snackId} onSelect={setSnackId} defaultAmount={weekTotal} snack={snack} />

        <Ledger
          expenses={expenses}
          allTime={allTime}
          snack={snack}
          onAdd={addExpense}
          onRemove={removeExpense}
        />
      </div>
    </div>
  )
}

function Header({
  weekRange,
  crumbCount,
  onClear,
}: {
  weekRange: string
  crumbCount: number
  onClear: () => void
}) {
  return (
    <Glass className="hdr" tilt={false}>
      <div className="wordmark">
        <span className="wm-display">CRUMB</span>
        <span className="wm-sub">budget</span>
      </div>
      <div className="hdr-meta">
        <span className="stamp">{weekRange}</span>
        <span className="stamp">{crumbCount} {crumbCount === 1 ? 'crumb' : 'crumbs'}</span>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          clear shelf
        </button>
      </div>
    </Glass>
  )
}

function Hero({
  reduce,
  weekTotal,
  snackId,
  over,
  snack,
}: {
  reduce: boolean
  weekTotal: number
  snackId: string
  over: boolean
  snack: { emoji: string; name: string; price: number }
}) {
  const value = useCountUp(weekTotal, reduce)
  const [pop, setPop] = useState(0)
  useEffect(() => setPop((p) => p + 1), [weekTotal])

  const bars = weekTotal === 0 ? 0 : weekTotal / snack.price
  const spare = over ? 0 : (WEEKLY_BUDGET - weekTotal) / snack.price

  return (
    <div className="hero">
      <span className="ghost" aria-hidden="true">{snack.emoji}</span>
      <p className="eyebrow">this week you munched through</p>
      <h1 className="hero-num" key={pop}>
        <span className="cur">{CURRENCY}</span>
        <Digited s={fmtMoney(value)} />
      </h1>
      <p className="hero-sub">
        {over ? (
          <>that's a whole bakery, champ 🥐</>
        ) : (
          <>
            ≈ <b>{bars.toFixed(1)}</b> {snack.name} {snack.emoji} and some change
          </>
        )}
      </p>
      <div className={`pill ${over ? 'pill-over' : 'pill-clear'}`}>
        {over
          ? `over by ${CURRENCY}${fmtMoney(weekTotal - WEEKLY_BUDGET)}`
          : weekTotal === 0
            ? 'no crumbs yet — go munch'
            : `under budget — ${Math.floor(spare)} ${snack.name} to spare`}
      </div>
      <p className="hero-foot stamp">every expense is a snack you could've had · {snackId}</p>
    </div>
  )
}

function Digited({ s }: { s: string }) {
  return (
    <>
      {Array.from(s).map((c, i) => (
        <span key={i} className="digit">
          {c}
        </span>
      ))}
    </>
  )
}

function Chart({
  days,
  dailyTotals,
  snack,
  weekTotal,
}: {
  days: string[]
  dailyTotals: number[]
  snack: { emoji: string; name: string; price: number }
  weekTotal: number
}) {
  const max = Math.max(DAILY_BUDGET, ...dailyTotals, 1)
  const [hover, setHover] = useState<number | null>(null)
  const any = weekTotal > 0

  return (
    <Glass className="chart">
      <p className="eyebrow">the week in crumbs</p>
      <div className="chart-body">
        <div className="chart-grid">
          <div className="bars-area">
            <span className="budget-line" style={{ bottom: `${(DAILY_BUDGET / max) * 100}%` }} />
            {days.map((d, i) => {
              const total = dailyTotals[i] ?? 0
              const h = Math.max((total / max) * 100, total > 0 ? 3 : 1.5)
              const overDay = total > DAILY_BUDGET
              return (
                <div
                  key={d}
                  className="bar-slot"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${dayShort(d)}: ${CURRENCY}${fmtMoney(total)}`}
                >
                  <div className={`bar ${overDay ? 'bar-over' : 'bar-ok'}`} style={{ height: `${h}%` }} />
                  {hover === i && total > 0 && (
                    <div className="tooltip" role="tooltip">
                      <span>{dayShort(d)}</span>
                      <b>
                        {CURRENCY}
                        {fmtMoney(total)}
                      </b>
                      <i>= {snackCount(total, snack.price).toFixed(1)} {snack.name}</i>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="labels-row" aria-hidden="true">
            {days.map((d) => (
              <span key={d} className="bar-label">
                {dayShort(d).slice(0, 1)}
              </span>
            ))}
          </div>
        </div>
        <p className="chart-foot stamp">
          dashed line = {CURRENCY}
          {DAILY_BUDGET} / day budget
        </p>
        {!any && <div className="empty-stamp">no snacks tracked this week</div>}
      </div>
    </Glass>
  )
}

function SnackConverter({
  snackId,
  onSelect,
  defaultAmount,
  snack,
}: {
  snackId: string
  onSelect: (id: string) => void
  defaultAmount: number
  snack: { emoji: string; name: string; price: number }
}) {
  const [amountStr, setAmountStr] = useState<string>(() => {
    const v = Math.max(0, Math.round(defaultAmount * 100) / 100)
    return v === 0 ? '' : String(v)
  })
  const amount = Math.max(0, Number.parseFloat(amountStr) || 0)
  const count = snackCount(amount, snack.price)
  const whole = wholeSnacks(amount, snack.price)
  const rest = leftover(amount, snack.price)

  const breakdown =
    amount === 0
      ? 'drop some dollars above'
      : whole === 0
        ? `save up ${CURRENCY}${fmtMoney(snack.price - amount)} more`
        : rest > 0
          ? `${whole} whole ${snack.name} + ${CURRENCY}${fmtMoney(rest)} in change`
          : `exactly ${whole} ${snack.name}`

  return (
    <Glass className="snacker">
      <p className="eyebrow">
        {CURRENCY} → treats · snack exchange
      </p>
      <div className="conv-row">
        <label className="conv-field" htmlFor="conv-amount">
          how far does{' '}
          <input
            id="conv-amount"
            className="conv-input"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0"
          />{' '}
          go?
        </label>
      </div>
      <div className="chips" role="group" aria-label="choose a snack">
        {SNACKS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip ${s.id === snackId ? 'chip-on' : ''}`}
            aria-pressed={s.id === snackId}
            onClick={() => onSelect(s.id)}
            title={s.name}
          >
            <span className="chip-emoji">{s.emoji}</span>
            <span className="chip-price">
              {CURRENCY}
              {fmtMoney(s.price)}
            </span>
          </button>
        ))}
      </div>
      <div className="conv-out">
        <span className="conv-emoji">{snack.emoji}</span>
        <div>
          <b className="conv-count">{count.toFixed(1)}</b>
          <span className="conv-name">{snack.name}</span>
        </div>
      </div>
      <p className="conv-foot">{breakdown}</p>
    </Glass>
  )
}

function Ledger({
  expenses,
  allTime,
  snack,
  onAdd,
  onRemove,
}: {
  expenses: Expense[]
  allTime: number
  snack: { emoji: string; name: string; price: number }
  onAdd: (e: Expense) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => todayISO())
  const [emoji, setEmoji] = useState(SNACKS[4]!.emoji)
  const [freshId, setFreshId] = useState<string | null>(null)

  useEffect(() => {
    if (!freshId) return
    const t = window.setTimeout(() => setFreshId(null), 600)
    return () => window.clearTimeout(t)
  }, [freshId])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const amt = Number.parseFloat(amount)
    const nm = name.trim()
    if (!nm || !Number.isFinite(amt) || amt <= 0) return
    const entry: Expense = { id: uid(), name: nm, amount: amt, date: date || todayISO(), emoji }
    onAdd(entry)
    setFreshId(entry.id)
    setName('')
    setAmount('')
  }

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [expenses],
  )
  const totalTreats = allTime === 0 ? 0 : allTime / snack.price

  return (
    <Glass className="ledger">
      <div className="ledger-form">
        <p className="eyebrow">log a crumb</p>
        <form onSubmit={submit} className="entry-form">
          <div className="emoji-row" role="group" aria-label="pick an emoji">
            {SNACKS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`emoji-chip ${s.emoji === emoji ? 'emoji-chip-on' : ''}`}
                aria-pressed={s.emoji === emoji}
                onClick={() => setEmoji(s.emoji)}
              >
                {s.emoji}
              </button>
            ))}
          </div>
          <div className="field-row">
            <input
              className="field"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="afternoon donut"
              aria-label="expense name"
              maxLength={60}
            />
            <input
              className="field field-amt"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="amount"
            />
            <input
              className="field field-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="date"
            />
            <button type="submit" className="btn">
              + munch
            </button>
          </div>
        </form>
      </div>

      <div className="ledger-divider" />

      <div className="ledger-list-wrap">
        {sorted.length === 0 ? (
          <div className="ledger-empty">
            <p className="empty-big">nothing but crumbs so far 🍪</p>
            <p className="empty-sub">log a treat above and watch the damage</p>
          </div>
        ) : (
          <ul className="ledger-list">
            {sorted.map((x) => {
              const eq = snackCount(x.amount, snack.price)
              return (
                <li
                  key={x.id}
                  className={`entry ${x.id === freshId ? 'entry-new' : ''}`}
                  onAnimationEnd={() => {
                    if (x.id === freshId) setFreshId(null)
                  }}
                >
                  <span className="entry-emoji" aria-hidden="true">
                    {x.emoji}
                  </span>
                  <span className="entry-main">
                    <b>{x.name}</b>
                    <i>{dayShort(x.date)} {x.date.slice(5)}</i>
                  </span>
                  <span className="entry-amt">
                    −{CURRENCY}
                    {fmtMoney(x.amount)}
                  </span>
                  <span className="entry-eq">= {eq.toFixed(1)} {snack.name}</span>
                  <button
                    type="button"
                    className="entry-del"
                    onClick={() => onRemove(x.id)}
                    aria-label={`delete ${x.name}`}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="ledger-total">
        <span className="stamp">all-time shelf</span>
        <b>
          {CURRENCY}
          {fmtMoney(allTime)}
        </b>
        <span className="ledger-total-eq">
          ≈ {totalTreats.toFixed(1)} {snack.name} {snack.emoji}
        </span>
      </div>
    </Glass>
  )
}