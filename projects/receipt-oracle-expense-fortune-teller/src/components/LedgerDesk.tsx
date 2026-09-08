import { memo, useEffect, useRef, useState } from 'react'
import { CATEGORIES, type Receipt } from '../lib/oracle'

export interface Draft {
  name: string
  amount: string
  category: Receipt['category']
  date: string
}

export function todayStr(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const emptyDraft = (): Draft => ({ name: '', amount: '', category: 'other', date: todayStr() })

export default memo(function LedgerDesk({ receipts, onAdd, onClear }: { receipts: Receipt[]; onAdd: (r: Receipt) => void; onClear: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [flash, setFlash] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 900)
    return () => clearTimeout(t)
  }, [flash])

  const valid = draft.name.trim().length > 0 && Number(draft.amount) > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(draft.amount)
    if (!draft.name.trim() || !Number.isFinite(amt) || amt <= 0) return
    onAdd({
      id: Math.random().toString(36).slice(2, 10),
      name: draft.name.trim(),
      amount: Math.round(amt * 100) / 100,
      category: draft.category,
      date: draft.date || todayStr(),
      addedAt: Date.now(),
    })
    setFlash(draft.name.trim())
    setDraft(emptyDraft())
    nameRef.current?.focus()
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  const total = receipts.reduce((s, r) => s + r.amount, 0)

  return (
    <section className="brass-plate p-3 sm:p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="display brass-engrave text-lg tracking-widest m-0">Ledger Desk</h2>
        <span className="mono text-xs text-[var(--brass-bright)] opacity-80">{receipts.length} inks</span>
      </header>

      <form onSubmit={submit} className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input ref={nameRef} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="field text-sm" placeholder="What did the coin buy?" aria-label="Receipt name" />
          <input value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            type="number" min="0" step="0.01" inputMode="decimal"
            className="field text-sm w-24 mono text-right" placeholder="0.00" aria-label="Amount" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Receipt['category'] })}
            className="field text-sm" aria-label="Category">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            type="date" className="field text-sm" aria-label="Date" />
        </div>
        <button type="submit" disabled={!valid} className="brass-btn mt-1 w-full">Ink Receipt</button>
      </form>

      {flash && <div className="receipt-stamp mt-3 mono text-sm text-[var(--ink)]">✳ “{flash}” inked — added to the ledger</div>}

      <div className="parch mt-4 p-3 max-h-56 overflow-auto">
        {receipts.length === 0 ? (
          <p className="m-0 text-sm italic opacity-70">The desk is bare. Ink your first expense and the Oracle shall read it.</p>
        ) : (
          <ul className="list-none m-0 p-0">
            {[...receipts].reverse().map((r) => (
              <li key={r.id} className="receipt-row py-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="mono whitespace-nowrap">{fmt.format(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between">
        <button onClick={onClear} disabled={receipts.length === 0} className="brass-btn ghost text-xs px-3 py-1.5">Burn the ledger</button>
        <div className="mono text-sm text-[var(--brass-bright)]">Σ {fmt.format(total)}</div>
      </footer>
    </section>
  )
})
