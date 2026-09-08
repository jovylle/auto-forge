import { useState } from 'react'
import { CATEGORIES, cx, fmtMoney, fmtSnack, parseMoney, type CategoryId, type Entry } from '../lib'
import { addChord, blip, error, hoverTick, removeChord, zap } from '../audio'

interface LogProps {
  entries: Entry[]
  onAdd: (e: { name: string; amount: number; category: CategoryId }) => void
  onDelete: (id: string) => void
  snackEmoji: string
  snackName: string
  snackPrice: number
}

export function Log({ entries, onAdd, onDelete, snackEmoji, snackName, snackPrice }: LogProps) {
  const [name, setName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState<CategoryId>('food')
  const [nameErr, setNameErr] = useState(false)
  const [amtErr, setAmtErr] = useState(false)
  const [gone, setGone] = useState<string | null>(null)

  const amount = parseMoney(amountStr)

  const submit = () => {
    const cleanName = name.trim()
    const okName = cleanName.length > 0
    const okAmt = amount > 0
    if (!okName) setNameErr(true)
    if (!okAmt) setAmtErr(true)
    if (!okName || !okAmt) {
      error()
      if (!okName) window.setTimeout(() => setNameErr(false), 260)
      if (!okAmt) window.setTimeout(() => setAmtErr(false), 260)
      return
    }
    addChord()
    onAdd({ name: cleanName, amount, category })
    setName('')
    setAmountStr('')
  }

  const remove = (id: string) => {
    if (gone) return
    if (entries.length <= 1) removeChord()
    else zap()
    setGone(id)
    window.setTimeout(() => {
      onDelete(id)
      setGone(null)
    }, 260)
  }

  return (
    <section className="panel col-span-12 lg:col-span-7 flex flex-col" aria-labelledby="log-title">
      <div className="flex items-baseline justify-between">
        <h2 id="log-title" className="panel-title">
          Expense Log
          <span className="katakana">マネー・ログ</span>
        </h2>
        <span className="term-num text-sm text-muted">{entries.length} SPEND{entries.length === 1 ? '' : 'S'}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          id="log-name"
          className={cx('neon-input sm:flex-1', nameErr && 'err')}
          placeholder="what did you buy?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Expense name"
        />
        <div className="relative w-28 sm:w-32">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pink" aria-hidden="true">$</span>
          <input
            id="log-amount"
            className={cx('neon-input amount pl-7', amtErr && 'err')}
            placeholder="0.00"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label="Expense amount in dollars"
          />
        </div>
        <button type="button" className="neon-btn cyan" onClick={submit} onMouseEnter={hoverTick}>
          Log it
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Expense category">
        {CATEGORIES.map((c) => {
          const sel = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={sel}
              className={cx('chip', sel && 'sel')}
              onClick={() => {
                setCategory(c.id)
                blip()
              }}
              onMouseEnter={hoverTick}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
              <span aria-hidden="true">{c.emoji}</span>
              {c.label}
            </button>
          )
        })}
      </div>

      <div className="log-scroll mt-3 -mr-2 pr-2" aria-label="Logged expenses">
        {entries.length === 0 ? (
          <div className="empty-dash">
            <div className="text-3xl" aria-hidden="true">🍩</div>
            <p className="mt-1 font-bold tracking-widest">NO CRUMBS YET</p>
            <p className="katakana text-xs text-muted">まだ何も食べてない</p>
            <p className="mt-2 text-xs text-muted">log your first spend above ↑</p>
          </div>
        ) : (
          entries.map((e) => {
            const c = CATEGORIES.find((x) => x.id === e.category)
            return (
              <div
                key={e.id}
                className={cx('row enter', gone === e.id && 'gone')}
                style={{ animationDelay: '0s' }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: c?.color ?? '#9d8fc7' }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-sm text-lilac">{e.name}</span>
                <span className="term-num ml-auto text-lg text-lilac">{fmtMoney(e.amount)}</span>
                <span className="term-num hidden text-sm text-muted sm:inline">
                  ≈ {fmtSnack(e.amount / snackPrice)} {snackEmoji}
                </span>
                <span
                  className="term-num text-sm text-muted sm:hidden"
                  title={`≈ ${fmtSnack(e.amount / snackPrice)} ${snackName}`}
                >
                  ≈{fmtSnack(e.amount / snackPrice)}{snackEmoji}
                </span>
                <button
                  type="button"
                  className="del"
                  onClick={() => remove(e.id)}
                  aria-label={`Delete ${e.name}`}
                  onMouseEnter={hoverTick}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}