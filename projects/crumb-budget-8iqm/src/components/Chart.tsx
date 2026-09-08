import { useEffect, useRef, useState } from 'react'
import {
  cx,
  fmtMoney,
  fmtSnack,
  isOverBudget,
  last7Days,
  totalsByDay,
  weekSpend,
  type Entry,
} from '../lib'
import { blip, error, hoverTick, sweep } from '../audio'

interface ChartProps {
  entries: Entry[]
  snackPrice: number
  snackEmoji: string
  budget: number
  onBudgetChange: (n: number) => void
}

type Unit = '$' | '🍩'

export function Chart({ entries, snackPrice, snackEmoji, budget, onBudgetChange }: ChartProps) {
  const [unit, setUnit] = useState<Unit>('$')
  const [active, setActive] = useState<number | null>(null)
  const [budgetStr, setBudgetStr] = useState(String(budget))
  const prevOver = useRef(false)

  const slots = last7Days()
  const totals = totalsByDay(entries)
  const perDay = slots.map((s) => totals[s.key] ?? 0)
  const isQuiet = perDay.every((v) => v <= 0)
  const week = weekSpend(entries)

  const unitVals = unit === '$' ? perDay : perDay.map((v) => v / snackPrice)
  const maxUnit = Math.max(...unitVals, 0.0001)

  useEffect(() => {
    setBudgetStr(String(budget))
  }, [budget])

  useEffect(() => {
    const over = isOverBudget(week, budget)
    if (over && !prevOver.current) error()
    prevOver.current = over
  }, [week, budget])

  useEffect(() => {
    sweep()
  }, [entries])

  const switchUnit = (u: Unit) => {
    if (u === unit) return
    setUnit(u)
    blip()
    sweep()
  }

  const over = isOverBudget(week, budget)
  const pct = budget > 0 ? Math.min(100, (week / budget) * 100) : 0

  const commitBudget = () => {
    const n = Number(budgetStr.replace(/[$,\s]/g, ''))
    if (Number.isFinite(n) && n >= 0) {
      onBudgetChange(n)
    } else {
      error()
      setBudgetStr(String(budget))
    }
  }

  const activeSlot = active !== null ? slots[active] : null
  const activeVal = active !== null ? perDay[active] ?? 0 : 0

  return (
    <section className="panel col-span-12 lg:col-span-12" aria-labelledby="chart-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="chart-title" className="panel-title">
          Weekly Chart
          <span className="katakana">ウィークリー・チャート</span>
        </h2>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Chart unit">
          {(['$', '🍩'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              className={cx('chip', unit === u && 'sel')}
              onClick={() => switchUnit(u)}
              onMouseEnter={hoverTick}
            >
              <span className="term-num text-sm">{u === '$' ? 'DOLLARS' : 'SNACKS'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <label htmlFor="budget-input" className="field-label">Weekly budget</label>
        <div className="relative w-24">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-pink" aria-hidden="true">$</span>
          <input
            id="budget-input"
            className="neon-input term-num pl-5 text-base"
            inputMode="decimal"
            value={budgetStr}
            onChange={(e) => setBudgetStr(e.target.value)}
            onBlur={commitBudget}
            onKeyDown={(e) => e.key === 'Enter' && commitBudget()}
            aria-label="Weekly budget in dollars"
          />
        </div>
        <div className="flex min-w-[160px] flex-1 items-center gap-2">
          <div className="chrome flex-1">
            <div className={cx('chrome-fill', over && 'over')} style={{ width: `${pct}%` }} />
          </div>
          <span className="term-num text-sm text-muted">
            {fmtMoney(week)} / {fmtMoney(budget)}
          </span>
          {over && (
            <span className="term-num text-sm animate-pulse text-sunset">OVERDRIVE</span>
          )}
        </div>
      </div>

      <div className="relative mt-2">
        <div className="chart-bars">
          {slots.map((s, i) => {
            const v = unitVals[i] ?? 0
            const stub = v <= 0
            const h = stub ? 4 : Math.max(6, (v / maxUnit) * 100)
            const val$ = perDay[i] ?? 0
            const valSnack = val$ / snackPrice
            return (
              <div key={s.key} className="bar-col">
                <div
                  role="img"
                  tabIndex={0}
                  className={cx('bar', stub && 'stub', s.isToday && 'today')}
                  style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                  aria-label={`${s.label}${s.isToday ? ' (today)' : ''}, ${fmtMoney(val$)}${
                    valSnack > 0 ? `, about ${fmtSnack(valSnack)} ${snackEmoji}` : ', nothing spent'
                  }`}
                  onClick={() => setActive(active === i ? null : i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActive(active === i ? null : i)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
                <span className={cx('day-label', s.isToday && 'today')}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {isQuiet && (
          <div className="pointer-events-none absolute inset-x-0 top-8 flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-bold tracking-widest text-muted">quiet week… too quiet</p>
            <p className="katakana text-xs text-muted">シズカナ シュウカン</p>
          </div>
        )}

        {activeSlot && (
          <div
            className="tooltip"
            style={{ left: `${((active ?? 0) + 0.5) * (100 / 7)}%`, top: '0.4rem' }}
            role="status"
          >
            {activeSlot.label}
            {activeSlot.isToday ? ' (today)' : ''} · {fmtMoney(activeVal)} · {fmtSnack(activeVal / snackPrice)}{' '}
            {snackEmoji}
          </div>
        )}
      </div>
    </section>
  )
}