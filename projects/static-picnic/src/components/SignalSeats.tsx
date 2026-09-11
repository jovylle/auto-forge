import { useEffect, useState } from 'react'
import { SEAT_IDS } from '../data'

interface SeatState {
  occupant: string | null
  strength: number
}

interface Props {
  signal: number // 0-5 current broadcast strength
  onClaim: (label: string) => void
}

const LS_KEY = 'static-picnic:seats'

const RANDOM_PASSERS = ['Aunt Ro', 'Kid Static', 'The Shimmy', 'Buzz', 'Dottie', 'Neon Nell', 'Old Sal', 'Half-Egg Hal', 'Tumble', 'Wanda', 'Percy', 'Juno']

function randomPasser(used: Set<string>): string {
  const free = RANDOM_PASSERS.filter(p => !used.has(p))
  const pool = free.length ? free : RANDOM_PASSERS
  return pool[Math.floor(Math.random() * pool.length)]
}

function loadSeats(): Record<string, SeatState> {
  const init: Record<string, SeatState> = {}
  for (const id of SEAT_IDS) init[id] = { occupant: null, strength: 0 }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return init
    const parsed = JSON.parse(raw) as Record<string, SeatState>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return init
    for (const id of SEAT_IDS) {
      const s = parsed[id]
      if (s && typeof s === 'object' && (typeof s.occupant === 'string' || s.occupant === null)) {
        init[id] = { occupant: s.occupant, strength: Math.max(0, Math.min(5, Number(s.strength) || 0)) }
      }
    }
  } catch { /* ignore */ }
  return init
}

export default function SignalSeats({ signal, onClaim }: Props) {
  const [seats, setSeats] = useState<Record<string, SeatState>>(loadSeats)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(seats)) } catch { /* ignore */ }
  }, [seats])

  const claimSeat = (id: string) => {
    const used = new Set(Object.values(seats).map(s => s.occupant).filter(Boolean) as string[])
    const passer = nameInput.trim() || randomPasser(used)
    setSeats(prev => ({
      ...prev,
      [id]: { occupant: passer, strength: Math.max(1, signal) },
    }))
    if (nameInput.trim()) {
      onClaim(passer)
      setNameInput('')
    }
  }

  const claimFirstFree = () => {
    const freeId = SEAT_IDS.find(id => !seats[id]?.occupant)
    if (freeId) claimSeat(freeId)
    else setSeats(prev => ({ ...prev, [SEAT_IDS[0]]: { occupant: nameInput.trim() || 'A Stranger', strength: Math.max(1, signal) } }))
  }

  const emptySeat = (id: string) => {
    setSeats(prev => ({ ...prev, [id]: { occupant: null, strength: 0 } }))
  }

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="display squiggle text-lg leading-tight">Signal Seats</h2>
        <span className="mono text-xs uppercase tracking-widest bg-black text-[#FFF4DC] px-2 py-1">
          {Object.values(seats).filter(s => s.occupant).length}/{SEAT_IDS.length} seated
        </span>
      </div>

      <p className="mono text-[11px] uppercase tracking-wider mt-2 opacity-70">
        Grab a seat around the broadcast. Leave your name, or let a passing stranger sit.
      </p>

      <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); claimFirstFree() }}>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          placeholder="your name (or leave blank for a stranger)"
          aria-label="Seat name"
          className="flex-1 border-3 border-black p-2 bg-[var(--bg)]"
        />
        <button type="submit" className="lift mono text-xs uppercase px-3 py-2 border-3 border-black bg-[var(--yellow)] cursor-pointer">
          Claim a seat
        </button>
      </form>

      {/* Seat arc */}
      <div className="mt-6 flex flex-wrap justify-center gap-3" role="group" aria-label="Signal seats">
        {SEAT_IDS.map((id, i) => {
          const seat = seats[id]
          return (
            <div key={id} className="flex flex-col items-center gap-1">
              <button
                onClick={() => seat.occupant ? emptySeat(id) : claimSeat(id)}
                aria-label={`${seat.occupant ? `Empty ${id}` : `Claim ${id}`}`}
                className={`w-20 h-16 border-3 border-black rounded-lg lift flex flex-col items-center justify-center cursor-pointer snap ${
                  seat.occupant ? 'bg-[var(--pink)] text-[var(--ink)] shadow-[4px_4px_0_#16130F]' : 'bg-transparent'
                }`}
              >
                {seat.occupant ? (
                  <>
                    <span className="display text-xl leading-none">{seat.occupant[0].toUpperCase()}</span>
                    <span className="mono text-[9px] uppercase tracking-wide mt-1">{seat.occupant}</span>
                  </>
                ) : (
                  <span className="mono text-[10px] uppercase tracking-wide opacity-90">seat {i + 1}</span>
                )}
              </button>
              {/* signal strength */}
              <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
                {[1, 2, 3].map(b => (
                  <div
                    key={b}
                    className={`w-1 ${b <= (seat.occupant ? seat.strength : 0) ? 'bg-[var(--cobalt)]' : 'bg-black/15'}`}
                    style={{ height: `${b * 4 + 2}px` }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}