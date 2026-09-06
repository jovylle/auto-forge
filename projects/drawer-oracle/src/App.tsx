import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Burst, DrawerItem } from './types'
import {
  loadItems,
  loadReleased,
  makeId,
  nextLedgerNo,
  saveItems,
  saveReleased,
  scoreFor,
} from './lib/ledger'
import Masthead from './components/Masthead'
import SeedPacketSearch from './components/SeedPacketSearch'
import PreservesJar from './components/PreservesJar'
import LedgerSheet from './components/LedgerSheet'
import SeedBurst from './components/SeedBurst'

export default function App() {
  const [items, setItems] = useState<DrawerItem[]>(() => loadItems())
  const [released, setReleased] = useState<number>(() => loadReleased())
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [departing, setDeparting] = useState<string[]>([])
  const [burst, setBurst] = useState<Burst | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const inFlight = useRef(new Set<string>())
  const burstSeq = useRef(0)

  useEffect(() => {
    saveItems(items)
  }, [items])

  useEffect(() => {
    saveReleased(released)
  }, [released])

  const activeItems = useMemo(
    () => items.filter((i) => !departing.includes(i.id)),
    [items, departing],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeItems.filter((i) => {
      const inCat = cat === 'all' || i.category === cat
      if (!inCat) return false
      if (!q) return true
      return i.name.toLowerCase().includes(q) || i.note.toLowerCase().includes(q)
    })
  }, [activeItems, query, cat])

  const foundId = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const hit = filtered.find((i) => i.name.trim().toLowerCase() === q)
    return hit ? hit.id : null
  }, [filtered, query])

  const departingItems = useMemo(
    () => items.filter((i) => departing.includes(i.id)),
    [items, departing],
  )

  const addItem = useCallback((name: string, note: string, category: string) => {
    const entry: DrawerItem = {
      id: makeId(),
      name: name.trim(),
      note: note.trim(),
      category,
      no: nextLedgerNo(),
      createdAt: Date.now(),
    }
    setItems((prev) => [entry, ...prev])
    setJustAdded(entry.id)
    window.setTimeout(() => setJustAdded((cur) => (cur === entry.id ? null : cur)), 650)
  }, [])

  const removeItem = useCallback((id: string, x: number, y: number) => {
    if (inFlight.current.has(id)) return
    inFlight.current.add(id)
    setDeparting((prev) => [...prev, id])
    burstSeq.current += 1
    setBurst({ id: burstSeq.current, x, y })
    window.setTimeout(() => {
      inFlight.current.delete(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeparting((prev) => prev.filter((d) => d !== id))
      setReleased((r) => r + 1)
      setBurst(null)
    }, 1500)
  }, [])

  const emptyDrawer = useCallback(() => {
    if (activeItems.length === 0) return
    if (!window.confirm('Release every thing in the drawer?')) return
    setReleased((r) => r + activeItems.length)
    setItems([])
    setDeparting([])
  }, [activeItems.length])

  const kept = activeItems.length
  const score = scoreFor(kept, released)
  const year = new Date().getFullYear()

  return (
    <div className="scene">
      <main className="spread">
        <aside className="pantry">
          <Masthead />
          <SeedPacketSearch
            query={query}
            onQuery={setQuery}
            cat={cat}
            onCat={setCat}
            count={filtered.length}
          />
          <PreservesJar
            kept={kept}
            released={released}
            score={score}
            found={foundId !== null}
            onEmpty={emptyDrawer}
          />
        </aside>

        <LedgerSheet
          items={filtered}
          departing={departingItems}
          hasAny={kept > 0}
          query={query}
          foundId={foundId}
          justAdded={justAdded}
          onAdd={addItem}
          onRemove={removeItem}
        />
      </main>

      <footer className="foot">
        Drawer Oracle · every thing kept, honestly · {year}
      </footer>

      {burst && <SeedBurst burst={burst} key={burst.id} />}
    </div>
  )
}