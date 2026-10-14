import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FLAVORS,
  KEYS,
  isValidGossip,
  load,
  makeGossip,
  makeSparrow,
  rankFor,
  save,
  seedHand,
  seedOffers,
  seedSeats,
  tradeValue,
  uid,
  type Flavor,
  type Gossip,
  type Offer,
  type Seat,
} from './lib'
import {
  isSoundOn,
  setSoundOn,
  sndChirp,
  sndClick,
  sndCold,
  sndPost,
  sndStoke,
  sndWarm,
} from './audio'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

interface Burst {
  id: number
  text: string
  x: number
}

/** CSS sparrow avatar — pure divs, no assets. */
function Bird({ hue, size = 44 }: { hue: string; size?: number }) {
  return (
    <span className="bird" style={{ width: size, height: size }} aria-hidden="true">
      <span className="bird-body" style={{ background: hue, width: size, height: size * 0.82 }} />
      <span className="bird-eye" style={{ width: size * 0.2, height: size * 0.2 }} />
      <span
        className="bird-beak"
        style={{ borderTopWidth: size * 0.12, borderBottomWidth: size * 0.12, borderLeftWidth: size * 0.22 }}
      />
      <span className="bird-tail" style={{ background: hue }} />
    </span>
  )
}

function FlavorTag({ flavor }: { flavor: Flavor }) {
  const f = FLAVORS[flavor]
  return (
    <span className="flavtag" style={{ background: f.color, color: f.ink }}>
      {f.label}
    </span>
  )
}

function EmberPips({ level }: { level: number }) {
  return (
    <span className="pips" aria-label={`ember level ${level} of 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cx('pip', i < level && 'pip-lit')} />
      ))}
    </span>
  )
}

export default function App() {
  const [hand, setHand] = useState<Gossip>(() => {
    const raw = load<unknown>(KEYS.hand, null)
    return isValidGossip(raw) ? raw : seedHand()
  })
  const [offers, setOffers] = useState<Offer[]>(() => {
    const raw = load<unknown>(KEYS.offers, null)
    if (Array.isArray(raw) && raw.length === 3 && raw.every((o) => isValidGossip((o as Offer)?.gossip))) {
      return raw as Offer[]
    }
    return seedOffers()
  })
  const [seats, setSeats] = useState<Seat[]>(() => {
    const raw = load<unknown>(KEYS.seats, null)
    if (Array.isArray(raw) && raw.length === 6) return raw as Seat[]
    return seedSeats()
  })
  const [board, setBoard] = useState<Gossip[]>(() => {
    const raw = load<unknown[]>(KEYS.board, [])
    const clean = raw.filter(isValidGossip)
    return clean.sort((a, b) => b.ts - a.ts).slice(0, 60)
  })
  const [warmth, setWarmth] = useState<number>(() => load<number>(KEYS.warmth, 0))
  const [best, setBest] = useState<number>(() => load<number>(KEYS.best, 0))
  const [trades, setTrades] = useState<number>(() => load<number>(KEYS.trades, 0))
  const [snd, setSnd] = useState<boolean>(() => isSoundOn())
  const [draft, setDraft] = useState('')
  const [draftFlavor, setDraftFlavor] = useState<Flavor>('spicy')
  const [flash, setFlash] = useState<string | null>(null)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [secs, setSecs] = useState(0)
  const [boardSort, setBoardSort] = useState<'fresh' | 'chirps'>('fresh')
  const burstId = useRef(0)

  useEffect(() => save(KEYS.hand, hand), [hand])
  useEffect(() => save(KEYS.offers, offers), [offers])
  useEffect(() => save(KEYS.seats, seats), [seats])
  useEffect(() => save(KEYS.board, board), [board])
  useEffect(() => save(KEYS.warmth, warmth), [warmth])
  useEffect(() => save(KEYS.best, best), [best])
  useEffect(() => save(KEYS.trades, trades), [trades])

  // session clock (proves 30-second playability) + ember cooling tick
  useEffect(() => {
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    const t = window.setInterval(() => {
      setSeats((prev) => {
        if (!prev.some((s) => s.ember > 0)) return prev
        // cool a random lit seat by 1 every 6s — keeps stoking meaningful
        const lit = prev.map((s, i) => (s.ember > 0 ? i : -1)).filter((i) => i >= 0)
        if (lit.length === 0) return prev
        const pick = lit[Math.floor(Math.random() * lit.length)]
        return prev.map((s, i) => (i === pick ? { ...s, ember: Math.max(0, s.ember - 1) } : s))
      })
    }, 6000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(t)
  }, [flash])

  const litEmbers = useMemo(() => seats.reduce((n, s) => n + (s.ember > 0 ? 1 : 0), 0), [seats])
  const mult = 1 + litEmbers * 0.25
  const sortedBoard = useMemo(() => {
    const copy = [...board]
    if (boardSort === 'chirps') copy.sort((a, b) => b.chirps - a.chirps || b.ts - a.ts)
    else copy.sort((a, b) => b.ts - a.ts)
    return copy
  }, [board, boardSort])

  function spawnBurst(text: string): void {
    const id = ++burstId.current
    setBursts((p) => [...p.slice(-7), { id, text, x: 6 + Math.random() * 80 }])
    window.setTimeout(() => setBursts((p) => p.filter((b) => b.id !== id)), 1200)
  }

  function doTrade(idx: number): void {
    const offer = offers[idx]
    if (!offer) return
    const { gain, warm } = tradeValue(hand, offer, litEmbers)
    const received = { ...offer.gossip, heat: offer.gossip.heat + (warm ? 1 : 0) }
    const given = hand
    // new offer from a fresh sparrow
    const used = new Set([...offers.map((o) => o.sparrow.name), ...seats.map((s) => s.sparrow?.name ?? '')])
    const fresh = makeSparrow(used)
    const next: Offer[] = offers.map((o, i) => (i === idx ? { sparrow: fresh, gossip: makeGossip(fresh.name) } : o))
    setOffers(next)
    setHand(received)
    setBoard((p) => [{ ...received, ts: Date.now() }, ...p].slice(0, 60))
    const w = warmth + gain
    setWarmth(w)
    setBest((b) => Math.max(b, w))
    setTrades((t) => t + 1)
    if (warm) {
      sndWarm()
      spawnBurst(`+${gain} WARM TRADE`)
      setFlash(`${offer.sparrow.name} craved ${FLAVORS[given.flavor].label} — perfect match! +${gain} warmth.`)
    } else {
      sndCold()
      spawnBurst(`+${gain}`)
      setFlash(`${offer.sparrow.name} wanted ${FLAVORS[offer.sparrow.craves].label}, got ${FLAVORS[given.flavor].label}. Cold trade, +${gain}.`)
    }
  }

  function stoke(i: number): void {
    setSeats((prev) => prev.map((s, j) => (j === i ? { ...s, ember: Math.min(3, s.ember + 1) } : s)))
    sndStoke()
    spawnBurst('STOKED')
  }

  function invite(idx: number): void {
    const offer = offers[idx]
    if (!offer) return
    const empty = seats.findIndex((s) => s.sparrow === null)
    if (empty === -1) {
      setFlash('No empty ember seat — every perch is taken!')
      sndClick()
      return
    }
    setSeats((prev) => prev.map((s, j) => (j === empty ? { ...s, sparrow: offer.sparrow } : s)))
    const used = new Set([...offers.map((o) => o.sparrow.name), ...seats.map((s) => s.sparrow?.name ?? '')])
    const fresh = makeSparrow(used)
    setOffers((prev) => prev.map((o, j) => (j === idx ? { sparrow: fresh, gossip: makeGossip(fresh.name) } : o)))
    sndChirp()
    setFlash(`${offer.sparrow.name} hopped onto seat ${empty + 1}!`)
  }

  function whisper(): void {
    const text = draft.trim()
    if (text.length < 4) {
      setFlash('Whisper a little more — at least 4 characters.')
      sndClick()
      return
    }
    const g: Gossip = { id: uid(), text: text.slice(0, 140), flavor: draftFlavor, author: 'you', heat: 2, chirps: 0, ts: Date.now() }
    setHand(g)
    setDraft('')
    sndChirp()
    spawnBurst('NEW WHISPER')
    setFlash('Fresh whisper in your beak. Trade it while it’s warm!')
  }

  function pinHand(): void {
    setBoard((p) => {
      if (p.some((g) => g.id === hand.id)) return p
      return [{ ...hand, ts: Date.now() }, ...p].slice(0, 60)
    })
    sndPost()
    setFlash('Pinned to the flock board!')
  }

  function chirp(id: string): void {
    setBoard((p) => p.map((g) => (g.id === id ? { ...g, chirps: g.chirps + 1 } : g)))
    sndChirp()
  }

  function toggleSound(): void {
    const next = !snd
    setSnd(next)
    setSoundOn(next)
    if (next) sndClick()
  }

  function resetParlor(): void {
    setHand(seedHand())
    setOffers(seedOffers())
    setSeats(seedSeats())
    setBoard([])
    setWarmth(0)
    setTrades(0)
    setDraft('')
    sndClick()
    setFlash('A fresh parlor night begins. First trade in under 30 seconds — go!')
  }

  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const checklist = { whispered: trades > 0 || draft.length > 0, traded: trades > 0, stoked: litEmbers >= 3 }

  return (
    <div className="parlor">
      {/* ticker */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-inner">
          {[0, 1].map((k) => (
            <span key={k} className="ticker-chunk">
              {board.slice(0, 5).map((g) => g.text).join('  ✦  ') || 'FRESH CINDERS ✦ HUNGRY SPARROWS ✦ BRING GOSSIP ✦ '}
              {'  ✦  FRESH CINDERS ✦ HUNGRY SPARROWS ✦ BRING GOSSIP ✦ STOKE THE SEATS ✦ '}
            </span>
          ))}
        </div>
      </div>

      {/* header */}
      <header className="p-head">
        <div className="logo-block">
          <span className="logo-stamp">EST. CINDER</span>
          <h1>
            CINDER SPARROW
            <br />
            PARLOR
          </h1>
        </div>
        <div className="head-mid">
          <div className="warmbox">
            <div className="warmbox-top">
              <span>WARMTH</span>
              <span className="mono">{warmth}°</span>
            </div>
            <div className="warmbar">
              <div className="warmbar-fill" style={{ width: `${Math.min(100, warmth)}%` }} />
            </div>
            <div className="rank">{rankFor(warmth)} · BEST {best}°</div>
          </div>
          <p className="tagline">Sparrows trade gossip over warm cinders. Match cravings, stoke seats, rule the flock board.</p>
        </div>
        <div className="head-side">
          <div className="clock mono" title="session time">⏱ {mm}</div>
          <button type="button" className="btn btn-small" onClick={toggleSound} aria-pressed={snd}>
            {snd ? '🔊 SOUND ON' : '🔇 MUTED'}
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={resetParlor}>
            ↺ NEW NIGHT
          </button>
        </div>
      </header>

      {/* 30-second coach */}
      <section className="coach" aria-label="how to play fast">
        <span className="coach-title">PLAY IN 30 SECONDS:</span>
        <span className={cx('coach-step', checklist.whispered && 'done')}>1 · whisper or grab gossip</span>
        <span className={cx('coach-step', checklist.traded && 'done')}>2 · hit TRADE below</span>
        <span className={cx('coach-step', checklist.stoked && 'done')}>3 · STOKE a seat ×3</span>
        <span className="coach-note mono">trades: {trades} · ember bonus ×{mult.toFixed(2)}</span>
      </section>

      {flash && (
        <div className="flash" role="status">
          {flash}
        </div>
      )}
      <div className="bursts" aria-hidden="true">
        {bursts.map((b) => (
          <span key={b.id} className="burst" style={{ left: `${b.x}%` }}>
            {b.text}
          </span>
        ))}
      </div>

      <main className="p-grid">
        {/* EMBER SEATS */}
        <section className="panel seats-panel" aria-label="ember seats">
          <h2 className="panel-title">
            <span className="pt-num">01</span> EMBER SEATS
          </h2>
          <p className="panel-sub">Tap STOKE to feed a seat. Every lit seat boosts trade warmth ×0.25. Embers cool — keep feeding!</p>
          <div className="firepit" aria-hidden="true">
            <span className="flame f1" />
            <span className="flame f2" />
            <span className="flame f3" />
            <span className="pit-glow" />
          </div>
          <ul className="seats">
            {seats.map((s, i) => (
              <li key={i} className={cx('seat', s.ember > 0 && 'seat-lit', s.ember >= 3 && 'seat-blaze')}>
                <div className="seat-top">
                  <span className="seat-no mono">S{i + 1}</span>
                  <EmberPips level={s.ember} />
                </div>
                <div className="seat-bird">
                  {s.sparrow ? (
                    <>
                      <Bird hue={s.sparrow.hue} size={40} />
                      <span className="seat-name">{s.sparrow.name}</span>
                    </>
                  ) : (
                    <span className="seat-empty">EMPTY PERCH</span>
                  )}
                </div>
                <button type="button" className="btn btn-stoke" onClick={() => stoke(i)}>
                  🔥 STOKE
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* GOSSIP TRADE */}
        <section className="panel trade-panel" aria-label="gossip trade">
          <h2 className="panel-title">
            <span className="pt-num">02</span> GOSSIP TRADE
          </h2>
          <div className="hand-card">
            <div className="hand-head">
              <span className="sticker">YOUR BEAK</span>
              <FlavorTag flavor={hand.flavor} />
            </div>
            <p className="hand-text">“{hand.text}”</p>
            <div className="hand-meta mono">
              <span>heat {hand.heat}</span>
              <span>from {hand.author}</span>
            </div>
            <div className="hand-actions">
              <button type="button" className="btn btn-small" onClick={pinHand}>
                📌 PIN TO BOARD
              </button>
            </div>
          </div>

          <div className="whisper-box">
            <label htmlFor="whisper">Whisper your own gossip (140 chars):</label>
            <div className="whisper-row">
              <input
                id="whisper"
                value={draft}
                maxLength={140}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') whisper()
                }}
                placeholder="e.g. The miller grinds rumors finer than flour…"
              />
              <select value={draftFlavor} onChange={(e) => setDraftFlavor(e.target.value as Flavor)} aria-label="gossip flavor">
                <option value="spicy">SPICY</option>
                <option value="sweet">SWEET</option>
                <option value="dark">DARK</option>
                <option value="silly">SILLY</option>
              </select>
              <button type="button" className="btn btn-small" onClick={whisper}>
                WHISPER
              </button>
            </div>
          </div>

          <ul className="offers">
            {offers.map((o, i) => {
              const v = tradeValue(hand, o, litEmbers)
              return (
                <li key={o.sparrow.id} className={cx('offer', v.warm && 'offer-warm')}>
                  <div className="offer-head">
                    <Bird hue={o.sparrow.hue} size={52} />
                    <div>
                      <div className="offer-name">{o.sparrow.name}</div>
                      <div className="offer-crave">
                        craves <FlavorTag flavor={o.sparrow.craves} />
                      </div>
                    </div>
                    {v.warm && <span className="warm-stamp">WARM MATCH +{v.gain}°</span>}
                  </div>
                  <p className="offer-quip">“{o.sparrow.quip}”</p>
                  <div className="offer-gossip">
                    <FlavorTag flavor={o.gossip.flavor} />
                    <p>“{o.gossip.text}”</p>
                  </div>
                  <div className="offer-actions">
                    <button type="button" className="btn btn-trade" onClick={() => doTrade(i)}>
                      ⇄ TRADE {v.warm ? `+${v.gain}°` : `+${v.gain}°`}
                    </button>
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => invite(i)} title="Invite to an empty seat">
                      🪑 SEAT
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* FLOCK BOARD */}
        <section className="panel board-panel" aria-label="flock board">
          <h2 className="panel-title">
            <span className="pt-num">03</span> FLOCK BOARD
          </h2>
          <div className="board-tools">
            <button
              type="button"
              className={cx('btn btn-small', boardSort === 'fresh' && 'btn-active')}
              onClick={() => {
                setBoardSort('fresh')
                sndClick()
              }}
            >
              FRESH
            </button>
            <button
              type="button"
              className={cx('btn btn-small', boardSort === 'chirps' && 'btn-active')}
              onClick={() => {
                setBoardSort('chirps')
                sndClick()
              }}
            >
              TOP CHIRPS
            </button>
            <span className="mono board-count">{board.length} notes</span>
          </div>
          {sortedBoard.length === 0 ? (
            <p className="board-empty">The board is bare. Trade gossip or pin your whisper — every swap lands here.</p>
          ) : (
            <ul className="board-list">
              {sortedBoard.map((g, i) => (
                <li key={g.id} className={cx('note', i % 2 === 1 && 'note-tilt')}>
                  <div className="note-head">
                    <FlavorTag flavor={g.flavor} />
                    <span className="note-author mono">{g.author}</span>
                  </div>
                  <p className="note-text">“{g.text}”</p>
                  <div className="note-foot">
                    <button
                      type="button"
                      className="chirp-btn"
                      onClick={() => chirp(g.id)}
                      aria-label={`chirp at ${g.author}'s gossip`}
                    >
                      🐦 {g.chirps} chirps
                    </button>
                    <span className="mono note-heat">{g.heat} heat</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="p-foot mono">
        <span>CINDER SPARROW PARLOR · all gossip kept in localStorage · no sparrows were fact-checked</span>
      </footer>
    </div>
  )
}
