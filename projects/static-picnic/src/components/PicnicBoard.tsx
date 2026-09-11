import { useEffect, useState } from 'react'
import type { BoardCard, Dish } from '../data'

interface Props {
  locked: Dish[]
}

const LS_KEY = 'static-picnic:board'

function loadBoard(): BoardCard[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as BoardCard[]
  } catch {
    return []
  }
}

export default function PicnicBoard({ locked }: Props) {
  const [cards, setCards] = useState<BoardCard[]>(loadBoard)
  const [note, setNote] = useState('')
  const [draftDish, setDraftDish] = useState<string>(locked[0]?.id ?? '')

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cards)) } catch { /* ignore */ }
  }, [cards])

  // When a dish is freshly locked, add it to the board automatically
  useEffect(() => {
    if (locked.length === 0) return
    const newest = locked[locked.length - 1]
    if (cards.some(c => c.dishId === newest.id)) return
    setCards(prev => [
      ...prev,
      {
        id: `card-${Date.now()}`,
        dishId: newest.id,
        note: '',
        name: newest.name,
        freq: newest.freq,
        stripe: newest.stripe,
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked.length])

  // Keep draftDish valid: fall back to the first locked dish whenever the
  // selected value is no longer in the locked set (e.g. fresh page mount).
  useEffect(() => {
    if (locked.length === 0) { setDraftDish(''); return }
    if (!locked.some(d => d.id === draftDish)) setDraftDish(locked[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, draftDish])

  const addNote = () => {
    const dish = locked.find(d => d.id === draftDish)
    if (!dish || !note.trim()) return
    const existing = cards.find(c => c.dishId === dish.id)
    if (existing) {
      setCards(prev => prev.map(c => c.id === existing.id ? { ...c, note: note.trim() } : c))
    } else {
      setCards(prev => [
        ...prev,
        { id: `card-${Date.now()}`, dishId: dish.id, note: note.trim(), name: dish.name, freq: dish.freq, stripe: dish.stripe },
      ])
    }
    setNote('')
  }

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
  }

  return (
    <section className="panel tilt-neg p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display squiggle text-lg leading-tight">Picnic Board</h2>
        <span className="mono text-xs uppercase tracking-widest bg-black text-[#FFF4DC] px-2 py-1">{cards.length} plate{cards.length === 1 ? '' : 's'}</span>
      </div>

      <p className="mono text-[11px] uppercase tracking-wider mt-2 opacity-70">
        The potluck table. Every stranger leaves a note.
      </p>

      {/* add note form */}
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={e => { e.preventDefault(); addNote() }}
      >
        <label className="mono text-[11px] uppercase tracking-wide" htmlFor="pick-dish">Pick a dish</label>
        <select
          id="pick-dish"
          className="border-3 border-black bg-[var(--bg)] p-2 font-bold"
          value={draftDish}
          onChange={e => setDraftDish(e.target.value)}
        >
          {locked.length === 0 && <option value="">— tune a dish first —</option>}
          {locked.map(d => (
            <option key={d.id} value={d.id}>{d.name} · {d.freq.toFixed(1)} FM</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="leave a note for the passing stranger…"
            className="flex-1 border-3 border-black p-2 bg-[var(--bg)]"
            aria-label="Board note"
          />
          <button type="submit" className="lift mono text-xs uppercase px-3 py-2 border-3 border-black bg-[var(--green)] cursor-pointer">
            Pin
          </button>
        </div>
      </form>

      {/* board cards */}
      {cards.length === 0 ? (
        <div className="halftone mt-4 border-3 border-black rounded-lg p-6 text-center opacity-80">
          <p className="display text-sm">An empty picnic rug.</p>
          <p className="mono text-[11px] uppercase tracking-widest mt-1">Tune a dish to lay out the first plate.</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card, i) => (
            <li
              key={card.id}
              className={`lift border-3 border-black rounded-lg overflow-hidden bg-[var(--bg)] ${i % 2 ? 'rotate-1' : '-rotate-1'}`}
            >
              <div
                className="px-2 py-0.5 display text-xs uppercase flex justify-between items-center"
                style={{ background: card.stripe === 'pink' ? 'var(--pink)' : card.stripe === 'yellow' ? 'var(--yellow)' : 'var(--green)', color: 'var(--ink)' }}
              >
                <span>{card.name}</span>
                <button
                  onClick={() => removeCard(card.id)}
                  aria-label={`remove ${card.name}`}
                  className="mono text-xs leading-none px-1 bg-black text-[#FFF4DC] cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-2">
                <p className="mono text-[10px] uppercase tracking-wider opacity-90">{card.freq.toFixed(1)} FM</p>
                {card.note ? (
                  <p className="text-sm italic mt-1">“{card.note}”</p>
                ) : (
                  <p className="text-sm italic mt-1 opacity-90">no note yet — whispered on arrival.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}