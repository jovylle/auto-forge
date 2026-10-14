import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CLERKS,
  SHELVES,
  loadBest,
  loadBooks,
  loadClerks,
  persistBest,
  persistBooks,
  persistClerks,
  searchBooks,
  seedBooks,
  uid,
  urchinShadows,
  type Book,
  type Clerk,
  type ShelfId,
} from './lib'

type SprintPhase = 'idle' | 'run' | 'done'

interface Sprint {
  phase: SprintPhase
  timeLeft: number // seconds, tenths
  score: number
  misses: number
  orderId: string | null
  lastHit: string | null
}

const SPRINT_LEN = 30
const SPINE_COLORS = ['#e2603f', '#4e9b8f', '#7fa65a', '#d9a441', '#8e5ba6', '#c96f2e']

function pickOrder(books: Book[], excludeId: string | null): string | null {
  const pool = books.filter((b) => b.id !== excludeId)
  if (pool.length === 0) return null
  const pick = pool[Math.floor(Math.random() * pool.length)]
  return pick ? pick.id : null
}

function StatChunks({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  return (
    <span className="statbar inline-flex gap-[2px]" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="inline-block h-[10px] w-[10px]"
          style={{ background: i < value ? color : '#08191a', border: '1px solid #08191a' }}
        />
      ))}
    </span>
  )
}

function UrchinAvatar({ clerk, size = 4 }: { clerk: Clerk; size?: number }) {
  const dim = 9 * size
  return (
    <span
      className="urchin-spikes inline-block"
      aria-hidden="true"
      style={{ width: dim, height: dim, position: 'relative' }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          boxShadow: urchinShadows(clerk.color, clerk.belly, size),
        }}
      />
    </span>
  )
}

export default function App() {
  const [books, setBooks] = useState<Book[]>(loadBooks)
  const [clerks, setClerks] = useState<Clerk[]>(loadClerks)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [best, setBest] = useState<number>(loadBest)
  const [sprint, setSprint] = useState<Sprint>({ phase: 'idle', timeLeft: SPRINT_LEN, score: 0, misses: 0, orderId: null, lastHit: null })
  const [working, setWorking] = useState<{ clerkId: string; bookId: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newShelf, setNewShelf] = useState<ShelfId>('A')
  const timerRef = useRef<number | null>(null)
  const workRef = useRef<number | null>(null)

  useEffect(() => persistBooks(books), [books])
  useEffect(() => persistClerks(clerks), [clerks])

  // sprint clock
  useEffect(() => {
    if (sprint.phase !== 'run') return
    timerRef.current = window.setInterval(() => {
      setSprint((s) => {
        const t = Math.max(0, Math.round((s.timeLeft - 0.1) * 10) / 10)
        if (t <= 0) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          return { ...s, timeLeft: 0, phase: 'done' }
        }
        return { ...s, timeLeft: t }
      })
    }, 100)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [sprint.phase])

  // record best at sprint end
  useEffect(() => {
    if (sprint.phase === 'done' && sprint.score > best) {
      setBest(sprint.score)
      persistBest(sprint.score)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint.phase])

  // working-clerk completion
  useEffect(() => {
    if (!working) return
    workRef.current = window.setTimeout(() => {
      const { clerkId, bookId } = working
      setBooks((bs) => bs.map((b) => (b.id === bookId ? { ...b, checkedOut: false, clerkId } : b)))
      setClerks((cs) => cs.map((c) => (c.id === clerkId ? { ...c, shelved: c.shelved + 1 } : c)))
      const clerk = clerks.find((c) => c.id === clerkId)
      const book = books.find((b) => b.id === bookId)
      setNotice(`${clerk?.name ?? 'CLERK'} shelved “${book?.title ?? 'a book'}”. +1 shift tally.`)
      setWorking(null)
    }, 1200)
    return () => {
      if (workRef.current) window.clearTimeout(workRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working])

  const matches = useMemo(() => searchBooks(books, query), [books, query])
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches])
  const selected = books.find((b) => b.id === selectedId) ?? null
  const orderBook = books.find((b) => b.id === sprint.orderId) ?? null
  const outCount = books.filter((b) => b.checkedOut).length
  const totalShelved = clerks.reduce((n, c) => n + c.shelved, 0)

  function flashNotice(msg: string) {
    setNotice(msg)
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2600)
  }

  function handleSpineClick(book: Book) {
    if (sprint.phase === 'run') {
      if (sprint.orderId === book.id) {
        const next = pickOrder(books, book.id)
        setSprint((s) => ({ ...s, score: s.score + 1, orderId: next, lastHit: book.id }))
        window.setTimeout(() => setSprint((s) => (s.lastHit === book.id ? { ...s, lastHit: null } : s)), 500)
      } else {
        setSprint((s) => ({ ...s, misses: s.misses + 1 }))
      }
      return
    }
    setSelectedId(book.id)
  }

  function startSprint() {
    if (books.length === 0) return
    setSelectedId(null)
    setSprint({ phase: 'run', timeLeft: SPRINT_LEN, score: 0, misses: 0, orderId: pickOrder(books, null), lastHit: null })
  }

  function assignClerk(clerkId: string, bookId: string) {
    if (working) return
    setWorking({ clerkId, bookId })
  }

  function checkout(book: Book) {
    setBooks((bs) => bs.map((b) => (b.id === book.id ? { ...b, checkedOut: true } : b)))
    flashNotice(`“${book.title}” checked OUT. Assign a clerk to reshelve it.`)
  }

  function addBook() {
    const title = newTitle.trim()
    const author = newAuthor.trim() || 'Anonymous Urchin'
    if (!title) {
      flashNotice('Name the tome first — even urchins need titles.')
      return
    }
    const book: Book = {
      id: uid(),
      title: title.slice(0, 60),
      author: author.slice(0, 60),
      shelf: newShelf,
      spine: SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)] ?? '#d9a441',
      height: 96 + Math.floor(Math.random() * 48),
      checkedOut: false,
      clerkId: null,
    }
    setBooks((bs) => [...bs, book])
    setNewTitle('')
    setNewAuthor('')
    setSelectedId(book.id)
    flashNotice(`“${book.title}” catalogued on SHELF ${book.shelf}.`)
  }

  function resetLibrary() {
    setBooks(seedBooks())
    setClerks(CLERKS.map((c) => ({ ...c })))
    setSelectedId(null)
    setQuery('')
    flashNotice('Library restocked. Fresh brass, fresh spines.')
  }

  return (
    <div className="scanlines min-h-screen">
      {/* ticker */}
      <div className="overflow-hidden border-b-[3px] border-[#08191a] bg-[#08191a] py-1" aria-hidden="true">
        <span className="ticker-track font-term text-[18px] tracking-widest text-[#f2cd72]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="mx-6">
              ★ URCHIN BRASS LIBRARY ★ shelve fast ★ polish the brass ★ mind the spines ★ 30-SECOND NIGHT SHIFT ★
            </span>
          ))}
        </span>
      </div>

      {/* header plaque — asymmetric, offset left */}
      <header className="px-4 pt-6 md:px-8">
        <div className="md:w-[72%]">
          <div className="px-cut px-bevel bg-[#d9a441] p-1">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-[#0e2a2b] px-5 py-4">
              <div>
                <p className="font-pixel text-[10px] tracking-widest text-[#4e9b8f]">EST. LOWTIDE · STACKS 001–003</p>
                <h1 className="font-pixel mt-2 text-[22px] leading-snug text-[#f4e3c1] md:text-[30px]">
                  URCHIN <span className="text-[#f2cd72]">BRASS</span> LIBRARY
                </h1>
                <p className="font-term mt-2 text-[20px] text-[#f4e3c1]/80">
                  Sea urchins shelve a brass library. Catalog spines, quiz the clerks, sprint one 30-second shift.
                </p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-3">
                <button
                  onClick={startSprint}
                  className="px-btn bg-[#e2603f] px-5 py-3 text-[12px] text-[#08191a]"
                  aria-label="Start the 30 second night shift sprint"
                >
                  ★ SPRINT 30s
                </button>
                <p className="font-term text-[18px] text-[#f2cd72]">
                  BEST SHIFT: <span className="font-pixel text-[12px]">{best}</span> · SHELVED: {totalShelved} · OUT: {outCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* notice toast */}
      <div aria-live="polite" className="px-4 md:px-8">
        {notice && (
          <p className="font-term mt-4 inline-block border-[3px] border-[#08191a] bg-[#7fa65a] px-4 py-1 text-[20px] text-[#08191a]">
            ▸ {notice}
          </p>
        )}
      </div>

      <main className="grid gap-6 px-4 py-6 md:px-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* LEFT RAIL — urchin clerks */}
        <aside aria-label="Urchin clerks" className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="font-pixel text-[12px] text-[#4e9b8f]">⌘ CLERKS ON DUTY</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {clerks.map((clerk) => {
              const isWorking = working?.clerkId === clerk.id
              return (
                <div
                  key={clerk.id}
                  className={`px-panel min-w-[210px] flex-1 bg-[#123336] p-3 ${isWorking ? 'urchin-work' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <UrchinAvatar clerk={clerk} />
                    <div>
                      <p className="font-pixel text-[11px] text-[#f4e3c1]">{clerk.name}</p>
                      <p className="font-term text-[17px] leading-tight text-[#f4e3c1]/70">{clerk.trait}</p>
                    </div>
                  </div>
                  <div className="font-term mt-2 space-y-1 text-[18px]">
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-[#f2cd72]">SPD</span>
                      <StatChunks value={clerk.speed} color="#e2603f" />
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="text-[#f2cd72]">CARE</span>
                      <StatChunks value={clerk.care} color="#4e9b8f" />
                    </p>
                  </div>
                  <p className="font-term mt-2 text-[18px] text-[#7fa65a]">
                    {isWorking ? '◌ shelving… (steps carefully)' : `▣ shelved: ${clerk.shelved}`}
                  </p>
                  {selected?.checkedOut && !isWorking && (
                    <button
                      onClick={() => assignClerk(clerk.id, selected.id)}
                      disabled={working !== null}
                      className="px-btn font-pixel mt-2 w-full bg-[#4e9b8f] px-2 py-2 text-[9px] text-[#08191a]"
                      aria-label={`Assign ${clerk.name} to shelve ${selected.title}`}
                    >
                      SHELVE “{selected.title.slice(0, 14)}…”
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-panel mt-4 bg-[#123336] p-3">
            <h3 className="font-pixel text-[10px] text-[#f2cd72]">+ CATALOGUE A TOME</h3>
            <label className="font-term mt-2 block text-[18px]">
              Title
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. The Prickly Canon II"
                className="mt-1 w-full border-[3px] border-[#08191a] bg-[#08191a] px-2 py-1 text-[#f4e3c1]"
              />
            </label>
            <label className="font-term mt-2 block text-[18px]">
              Author
              <input
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="e.g. Urso Major"
                className="mt-1 w-full border-[3px] border-[#08191a] bg-[#08191a] px-2 py-1 text-[#f4e3c1]"
              />
            </label>
            <label className="font-term mt-2 block text-[18px]">
              Shelf
              <select
                value={newShelf}
                onChange={(e) => setNewShelf(e.target.value as ShelfId)}
                className="mt-1 w-full border-[3px] border-[#08191a] bg-[#08191a] px-2 py-1 text-[#f4e3c1]"
              >
                <option value="A">SHELF A · folios</option>
                <option value="B">SHELF B · annals</option>
                <option value="C">SHELF C · codex</option>
              </select>
            </label>
            <button onClick={addBook} className="px-btn font-pixel mt-3 w-full bg-[#d9a441] px-2 py-2 text-[10px] text-[#08191a]">
              STAMP IT IN
            </button>
            <button onClick={resetLibrary} className="font-term mt-2 w-full text-center text-[17px] text-[#f4e3c1]/60 underline">
              restock demo stacks
            </button>
          </div>
        </aside>

        {/* MAIN — search + shelves */}
        <section aria-label="Stacks">
          {/* spyglass search */}
          <div className="flex justify-end">
            <div className="w-full md:w-[62%]">
              <label htmlFor="shelf-search" className="font-pixel block text-[11px] text-[#f2cd72]">
                ⌕ SHELF SEARCH
              </label>
              <input
                id="shelf-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="title, author, or shelf (try “brass” or “C”)…"
                role="searchbox"
                className="px-bevel-thin mt-2 w-full bg-[#08191a] px-4 py-3 text-[22px] text-[#f4e3c1]"
              />
              <div aria-live="polite">
                {query.trim() !== '' && (
                  <div className="px-panel mt-2 max-h-44 overflow-auto bg-[#f4e3c1] p-2 text-[#3a2418]">
                    {matches.length === 0 ? (
                      <p className="font-term px-2 py-1 text-[20px]">No spines match “{query}”. The urchins shrug.</p>
                    ) : (
                      <ul>
                        {matches.map((m) => (
                          <li key={m.id}>
                            <button
                              onClick={() => setSelectedId(m.id)}
                              className="font-term flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[20px] hover:bg-[#d9a441]"
                            >
                              <span>
                                <strong>{m.title}</strong> <span className="opacity-70">— {m.author}</span>
                              </span>
                              <span className="font-pixel shrink-0 text-[10px]">SH.{m.shelf}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* shelves — staggered offsets */}
          <div className="mt-4 space-y-8" role="list" aria-label="Spine catalog">
            {SHELVES.map((shelf) => {
              const onShelf = books.filter((b) => b.shelf === shelf.id)
              return (
                <div key={shelf.id} role="listitem" style={{ marginLeft: shelf.indent }} className="max-w-full">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-pixel text-[11px] text-[#f2cd72] md:text-[12px]">{shelf.name}</h3>
                    <span className="font-term text-[18px] text-[#f4e3c1]/60">{onShelf.length} tomes</span>
                  </div>
                  <div className="mt-2 border-[3px] border-[#08191a] bg-[#3a2418] p-3 pb-0">
                    <div className="flex flex-wrap items-end gap-[6px]">
                      {onShelf.length === 0 && (
                        <p className="font-term pb-3 text-[20px] text-[#f4e3c1]/60">Bare brass. Catalogue something!</p>
                      )}
                      {onShelf.map((book) => {
                        const searching = query.trim() !== ''
                        const isMatch = matchIds.has(book.id)
                        const dim = searching && !isMatch
                        const isOrder = sprint.phase === 'run' && sprint.orderId === book.id
                        const justHit = sprint.lastHit === book.id
                        const isSel = selectedId === book.id
                        return (
                          <button
                            key={book.id}
                            onClick={() => handleSpineClick(book)}
                            aria-label={`${book.title} by ${book.author}, shelf ${book.shelf}${book.checkedOut ? ', checked out' : ''}`}
                            title={`${book.title} — ${book.author}`}
                            className={`spine spine-title shrink-0 px-2 pb-2 pt-3 text-center ${
                              dim ? 'spine-dim' : ''
                            } ${searching && isMatch ? 'spine-match' : ''}`}
                            style={{
                              background: book.spine,
                              height: book.height,
                              width: book.checkedOut ? 30 : 40,
                              color: '#08191a',
                              fontSize: 17,
                              lineHeight: 1,
                              border: isSel ? '3px solid #f4e3c1' : '3px solid #08191a',
                              outline: isOrder ? '3px solid #7fa65a' : justHit ? '3px solid #e2603f' : 'none',
                              outlineOffset: 2,
                              opacity: book.checkedOut ? 0.55 : undefined,
                              transform: book.checkedOut ? 'rotate(-4deg)' : undefined,
                            }}
                          >
                            <span className="pointer-events-none">
                              {book.checkedOut ? '◌ OUT' : book.title.slice(0, 18)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {/* brass shelf board */}
                    <div className="mx-[-12px] mt-0 h-[14px] border-t-[3px] border-[#08191a] bg-[#d9a441]" aria-hidden="true">
                      <div className="h-[4px] bg-[#f2cd72]" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* detail drawer */}
          <div aria-live="polite" className="mt-6">
            {selected && (
              <div className="px-panel bg-[#f4e3c1] p-4 text-[#3a2418] md:ml-[96px]">
                <div className="flex flex-wrap items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="px-bevel-thin shrink-0 px-3 py-2"
                    style={{ background: selected.spine, color: '#08191a', minHeight: 120, width: 56 }}
                  >
                    <span className="spine-title text-[18px]">{selected.title}</span>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <p className="font-pixel text-[10px] text-[#4e9b8f]">CATALOG CARD · SHELF {selected.shelf}</p>
                    <h4 className="font-pixel mt-1 text-[14px] leading-relaxed">{selected.title}</h4>
                    <p className="font-term mt-1 text-[21px]">by {selected.author}</p>
                    <p className="font-term text-[19px] opacity-75">
                      Status: {selected.checkedOut ? '◌ CHECKED OUT — needs an urchin' : '▣ ON SHELF — polished'}
                      {selected.clerkId ? ` · last shelved by ${clerks.find((c) => c.id === selected.clerkId)?.name ?? 'a clerk'}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {!selected.checkedOut ? (
                        <button onClick={() => checkout(selected)} className="px-btn bg-[#e2603f] px-4 py-2 text-[10px] text-[#08191a]">
                          CHECK OUT
                        </button>
                      ) : (
                        <p className="font-term text-[19px]">
                          ☞ Pick a clerk on the left rail to reshelve this tome.
                          {working && <span className="text-[#4e9b8f]"> (an urchin is already rolling…)</span>}
                        </p>
                      )}
                      <button onClick={() => setSelectedId(null)} className="px-btn bg-[#4e9b8f] px-4 py-2 text-[10px] text-[#08191a]">
                        CLOSE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* SPRINT PANEL — bottom-right */}
      <section aria-label="Night shift sprint" className="px-4 pb-10 md:px-8">
        <div className="ml-auto max-w-[380px]">
          <div className="px-cut px-bevel bg-[#e2603f] p-1">
            <div className="bg-[#08191a] p-4">
              <h2 className="font-pixel text-[11px] text-[#f2cd72]">★ NIGHT SHIFT SPRINT</h2>
              {sprint.phase === 'idle' && (
                <div className="font-term mt-2 text-[20px]">
                  <p>Shelve rush! When the whistle blows you get <strong>30 seconds</strong>.</p>
                  <p className="mt-1">Tap the <span className="text-[#7fa65a]">green-outlined spine</span> the order calls for. +1 per hit.</p>
                  <button onClick={startSprint} className="px-btn mt-3 w-full bg-[#7fa65a] px-4 py-3 text-[11px] text-[#08191a]">
                    BLOW THE WHISTLE
                  </button>
                  {best > 0 && <p className="mt-2 text-[#f2cd72]">House record: {best} shelved.</p>}
                </div>
              )}
              {sprint.phase === 'run' && (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <p className={`font-pixel text-[20px] ${sprint.timeLeft <= 5 ? 'timer-low' : 'text-[#f4e3c1]'}`} aria-live="off">
                      {sprint.timeLeft.toFixed(1)}s
                    </p>
                    <p className="font-pixel text-[20px] text-[#7fa65a]">★ {sprint.score}</p>
                  </div>
                  <div className="mt-2 h-[12px] border-2 border-[#08191a] bg-[#3a2418]">
                    <div className="h-full bg-[#7fa65a]" style={{ width: `${(sprint.timeLeft / SPRINT_LEN) * 100}%` }} />
                  </div>
                  {orderBook ? (
                    <div className="drop-book mt-3 border-[3px] border-[#d9a441] bg-[#0e2a2b] p-3">
                      <p className="font-pixel text-[9px] text-[#4e9b8f]">ORDER SLIP · FETCH & TAP:</p>
                      <p className="font-pixel mt-1 text-[12px] leading-relaxed text-[#f4e3c1]">“{orderBook.title}”</p>
                      <p className="font-term text-[19px] text-[#f2cd72]">→ SHELF {orderBook.shelf} · {orderBook.author}</p>
                    </div>
                  ) : (
                    <p className="font-term mt-3 text-[20px]">All shelves clear?!</p>
                  )}
                  <p className="font-term mt-2 text-[18px] text-[#f4e3c1]/60">misses: {sprint.misses}</p>
                </div>
              )}
              {sprint.phase === 'done' && (
                <div className="font-term mt-2 text-[21px]">
                  <p className="font-pixel text-[13px] text-[#f2cd72]">SHIFT OVER!</p>
                  <p className="mt-2">
                    You shelved <strong className="text-[#7fa65a]">{sprint.score}</strong> tomes
                    {sprint.score >= best && sprint.score > 0 ? ' — NEW HOUSE RECORD! ★' : ` (record: ${best})`}.
                  </p>
                  <div className="puff mx-auto mt-1 h-4 w-16 bg-[#d9a441]" aria-hidden="true" />
                  <div className="mt-2 flex gap-3">
                    <button onClick={startSprint} className="px-btn flex-1 bg-[#7fa65a] px-4 py-3 text-[10px] text-[#08191a]">
                      AGAIN!
                    </button>
                    <button onClick={() => setSprint((s) => ({ ...s, phase: 'idle' }))} className="px-btn flex-1 bg-[#4e9b8f] px-4 py-3 text-[10px] text-[#08191a]">
                      REST
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-[3px] border-[#08191a] bg-[#08191a] px-4 py-4 md:px-8">
        <p className="font-term text-[18px] text-[#f4e3c1]/60">
          URCHIN BRASS LIBRARY · a pixel-art tool · spines catalogued locally in your browser · no urchins were rushed
          <span className="float-right hidden md:inline" aria-hidden="true">◌ ◌ ◌</span>
        </p>
      </footer>
    </div>
  )
}
