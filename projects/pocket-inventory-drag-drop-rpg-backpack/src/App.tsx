import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { Item } from './lib/items'
import { RARITY, generateLoot, itemName, typeOf } from './lib/items'
import type { Slot } from './lib/board'
import { SLOTS, COLS, ROWS, GAP, gridHeight, gridWidth, centerOf, blobFor } from './lib/board'
import type { SerialState } from './lib/share'
import { STORE_KEY, stateFromHash, copyText, shareUrl, snapshotToDataURL } from './lib/share'
import { sfx, setMuted as setAudioMuted, ensureCtx } from './lib/audio'
import { ItemChip } from './components/ItemChip'
import { Tooltip } from './components/Tooltip'

const MUTE_KEY = 'pocket-inventory:muted'

type Origin =
  | { kind: 'tray'; uid: string }
  | { kind: 'slot'; uid: string; slotId: string }

interface DragState {
  origin: Origin
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
}

function freshState(): SerialState {
  const seed = Math.floor(Math.random() * 2 ** 31)
  const loot = generateLoot(seed)
  const slots = Object.fromEntries(SLOTS.map((s) => [s.id, null])) as Record<string, string | null>
  return {
    seed,
    slots,
    tray: loot.map((i) => i.uid),
    items: Object.fromEntries(loot.map((i) => [i.uid, i])),
  }
}

function loadInitial(): SerialState {
  const fromHash = stateFromHash()
  if (fromHash) return fromHash
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SerialState
      if (parsed && parsed.items && parsed.slots) return parsed
    }
  } catch {
    /* corrupted store — regenerate */
  }
  return freshState()
}

function placeInState(prev: SerialState, uid: string, slotId: string): SerialState {
  if (prev.slots[slotId] === uid) return prev
  const occupant = prev.slots[slotId]
  const originSlot =
    Object.keys(prev.slots).find((k) => prev.slots[k] === uid) ?? null
  const inTray = prev.tray.includes(uid)

  const slots = { ...prev.slots }
  if (originSlot) slots[originSlot] = null
  slots[slotId] = uid

  let tray = prev.tray
  if (inTray) tray = tray.filter((x) => x !== uid)
  if (occupant) {
    if (originSlot) slots[originSlot] = occupant
    else tray = [occupant, ...tray]
  }
  return { ...prev, slots, tray }
}

function toTrayState(prev: SerialState, uid: string): SerialState {
  if (prev.tray.includes(uid)) return prev
  const slots = { ...prev.slots }
  for (const k of Object.keys(slots)) {
    if (slots[k] === uid) slots[k] = null
  }
  return { ...prev, slots, tray: [...prev.tray, uid] }
}

function pointIn(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

export default function App() {
  const [state, setState] = useState<SerialState>(loadInitial)
  const [draggingUid, setDraggingUid] = useState<string | null>(null)
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null)
  const [overTray, setOverTray] = useState(false)
  const [tooltip, setTooltip] = useState<{ uid: string; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [muted, setMutedUi] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      return false
    }
  })

  const slotEls = useRef<Record<string, HTMLDivElement | null>>({})
  const trayEl = useRef<HTMLDivElement | null>(null)
  const ghostEl = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const toastTimer = useRef<number | null>(null)

  const hauled = useMemo(
    () => SLOTS.filter((s) => state.slots[s.id]).length,
    [state.slots],
  )
  const capacity = SLOTS.length
  const totalValue = useMemo(
    () =>
      SLOTS.reduce((sum, s) => {
        const uid = state.slots[s.id]
        return uid ? sum + (state.items[uid]?.value ?? 0) : sum
      }, 0),
    [state.slots, state.items],
  )

  useEffect(() => {
    setAudioMuted(muted)
  }, [muted])

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable */
    }
  }, [state])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const toggleMuted = useCallback(() => {
    setMutedUi((m) => {
      const next = !m
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (!next) sfx.click()
      return next
    })
  }, [])

  const hitTestSlot = useCallback((x: number, y: number): string | null => {
    for (const slot of SLOTS) {
      const el = slotEls.current[slot.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return slot.id
    }
    return null
  }, [])

  const onPointerMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.active) {
        const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
        if (dist > 6) {
          d.active = true
          d.x = e.clientX
          d.y = e.clientY
          sfx.grab()
          setDraggingUid(d.origin.uid)
        } else {
          return
        }
      } else {
        d.x = e.clientX
        d.y = e.clientY
      }
      const ghost = ghostEl.current
      if (ghost) {
        ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`
      }
      const found = hitTestSlot(e.clientX, e.clientY)
      setHoverSlotId((prev) => (prev === found ? prev : found))
      const trayOver = !found && !!trayEl.current && pointIn(e.clientX, e.clientY, trayEl.current.getBoundingClientRect())
      setOverTray((prev) => (prev === trayOver ? prev : trayOver))
    },
    [hitTestSlot],
  )

  const onPointerUp = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setHoverSlotId(null)
      setOverTray(false)
      if (!d.active) {
        setDraggingUid(null)
        return
      }
      const uid = d.origin.uid
      const targetSlot = hitTestSlot(e.clientX, e.clientY)
      if (targetSlot) {
        const occupant = state.slots[targetSlot]
        setState((prev) => placeInState(prev, uid, targetSlot))
        if (occupant && occupant !== uid) sfx.swap()
        else sfx.drop()
      } else if (trayEl.current && pointIn(e.clientX, e.clientY, trayEl.current.getBoundingClientRect())) {
        if (d.origin.kind === 'slot') {
          setState((prev) => toTrayState(prev, uid))
          sfx.remove()
        }
      } else {
        sfx.click()
      }
      setDraggingUid(null)
    },
    [hitTestSlot, state.slots],
  )

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  const startDrag = useCallback((e: ReactPointerEvent, origin: Origin) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    ensureCtx()
    dragRef.current = {
      origin,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    }
    setTooltip(null)
  }, [])

  const stashItem = useCallback(
    (uid: string) => {
      ensureCtx()
      const freeSlot = SLOTS.find((s) => !state.slots[s.id])
      if (freeSlot) {
        setState((prev) => placeInState(prev, uid, freeSlot.id))
        sfx.stash()
      } else {
        sfx.reject()
        showToast('The pack is full — no open pores.')
      }
    },
    [state.slots, showToast],
  )

  const removeItem = useCallback(
    (uid: string) => {
      ensureCtx()
      setState((prev) => toTrayState(prev, uid))
      sfx.remove()
    },
    [],
  )

  const restock = useCallback(() => {
    ensureCtx()
    setState(freshState())
    sfx.restock()
    showToast('Fresh loot buds in the growth bed.')
  }, [showToast])

  const emptyPack = useCallback(() => {
    ensureCtx()
    setState((prev) => {
      const slots = { ...prev.slots }
      const moved: string[] = []
      for (const k of Object.keys(slots)) {
        if (slots[k]) {
          moved.push(slots[k] as string)
          slots[k] = null
        }
      }
      return { ...prev, slots, tray: [...prev.tray, ...moved] }
    })
    sfx.remove()
    showToast('The pack has been emptied.')
  }, [showToast])

  const copyLink = useCallback(async () => {
    ensureCtx()
    try {
      await copyText(shareUrl(state))
      showToast('Share link copied to your clipboard.')
    } catch {
      showToast('Could not copy — your browser blocked it.')
    }
    sfx.click()
  }, [state, showToast])

  const savePng = useCallback(() => {
    ensureCtx()
    const url = snapshotToDataURL(state.slots, state.items, {
      haul: hauled,
      capacity,
      value: totalValue,
      seed: state.seed,
    })
    if (!url) {
      showToast('Snapshot failed.')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = `pocket-inventory-seed-${state.seed}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('Backpack snapshot saved as PNG.')
    sfx.click()
  }, [state, hauled, capacity, totalValue, showToast])

  const enterTooltip = useCallback((e: ReactMouseEvent, uid: string) => {
    setTooltip({ uid, x: e.clientX, y: e.clientY })
  }, [])
  const moveTooltip = useCallback((e: ReactMouseEvent, uid: string) => {
    setTooltip((t) => (t && t.uid === uid ? { ...t, x: e.clientX, y: e.clientY } : t))
  }, [])
  const clearTooltip = useCallback(() => setTooltip(null), [])

  const onSlotKeyDown = useCallback(
    (e: ReactKeyboardEvent, slot: Slot) => {
      const dirs: Record<string, [number, number]> = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const d = dirs[e.key]
      if (!d) return
      e.preventDefault()
      let best: Slot | null = null
      let bestScore = Infinity
      for (const s of SLOTS) {
        if (s.id === slot.id) continue
        if (!state.slots[s.id]) continue
        const dc = s.col - slot.col
        const dr = s.row - slot.row
        if (dc === 0 && dr === 0) continue
        const aligned = (d[0] !== 0 && dr === 0 && Math.sign(dc) === d[0]) || (d[1] !== 0 && dc === 0 && Math.sign(dr) === d[1])
        if (!aligned) continue
        const score = Math.abs(dc) + Math.abs(dr)
        if (score < bestScore) {
          bestScore = score
          best = s
        }
      }
      if (best) {
        const el = document.getElementById(`chip-${best.id}`)
        el?.focus()
      }
    },
    [state.slots],
  )

  const veins = useMemo(() => {
    const occupied = SLOTS.filter((s) => state.slots[s.id])
    const core = { x: gridWidth() / 2, y: gridHeight() / 2 }
    return occupied.map((s) => {
      const c = centerOf(s)
      const dx = c.x - core.x
      const dy = c.y - core.y
      const len = Math.hypot(dx, dy) || 1
      const perp = { x: -dy / len, y: dx / len }
      const bend = ((s.id.charCodeAt(0) % 3) - 1) * len * 0.3
      const mx = (core.x + c.x) / 2 + perp.x * bend
      const my = (core.y + c.y) / 2 + perp.y * bend
      return `M ${core.x.toFixed(1)} ${core.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
    })
  }, [state.slots])

  const ghostItem = draggingUid ? state.items[draggingUid] : null
  const lastPos = dragRef.current
  const trayItem = (uid: string | null): Item | null => (uid ? (state.items[uid] ?? null) : null)

  return (
    <div className="app">
      <header className="brand">
        <div>
          <h1>Pocket Inventory</h1>
          <p className="tag">a living backpack for loose loot</p>
        </div>
        <div className="stats">
          <span className="stat">
            hauled <b>{hauled}</b>/{capacity}
          </span>
          <span className="stat">
            value <b>{totalValue}</b> gp
          </span>
          <span className="stat">
            loose <b>{state.tray.length}</b>
          </span>
        </div>
      </header>

      <div className="controls">
        <button type="button" className="btn" onClick={toggleMuted} aria-pressed={muted}>
          {muted ? '🔇 sound off' : '🔊 sound on'}
        </button>
        <button type="button" className="btn" onClick={restock}>
          🌱 restock
        </button>
        <button type="button" className="btn" onClick={emptyPack} disabled={hauled === 0}>
          🫙 empty pack
        </button>
        <span className="divider" aria-hidden="true" />
        <button type="button" className="btn btn-cta" onClick={copyLink}>
          🔗 copy share link
        </button>
        <button type="button" className="btn btn-cta" onClick={savePng}>
          📸 save snapshot
        </button>
      </div>

      <main className="main">
        <section className="pack" aria-label="The pack — your backpack of organ slots">
          <h2 className="sec-title">The Pack</h2>
          <div className="pack-frame">
            <svg
              className="pack-veins"
              viewBox={`0 0 ${gridWidth()} ${gridHeight()}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="vein-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#46E5AE" stopOpacity="0" />
                  <stop offset="0.55" stopColor="#46E5AE" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#46E5AE" stopOpacity="0" />
                </linearGradient>
              </defs>
              {veins.map((d, i) => (
                <path key={i} d={d} stroke="url(#vein-grad)" />
              ))}
            </svg>
            <div
              className="pack-grid"
              role="grid"
              aria-label="Backpack slots. Drag items from the growth bed into an open pore."
              aria-rowcount={ROWS}
              aria-colcount={COLS}
              style={{ '--gap': `${GAP}px` } as CSSProperties}
            >
              {SLOTS.map((slot, i) => {
                const uid = state.slots[slot.id]
                const item = trayItem(uid)
                const hovering = hoverSlotId === slot.id
                return (
                  <div
                    key={slot.id}
                    ref={(el) => {
                      slotEls.current[slot.id] = el
                    }}
                    className={`slot${hovering ? ' hover' : ''}${draggingUid && hovering ? ' accept' : ''}`}
                    style={
                      {
                        gridColumn: `${slot.col + 1} / span ${slot.w}`,
                        gridRow: `${slot.row + 1} / span ${slot.h}`,
                        '--blob': blobFor(i),
                        '--i': i,
                      } as CSSProperties
                    }
                    role="gridcell"
                    aria-label={slot.label}
                    aria-rowindex={slot.row + 1}
                    aria-colindex={slot.col + 1}
                  >
                    {item ? (
                      <ItemChip
                        item={item}
                        className={draggingUid === uid ? 'source-hidden' : ''}
                        label={`${itemName(item)}, ${RARITY[item.rarity].label}, ${typeOf(item).stat}, ${item.value} gold, in the ${slot.label}. Press Enter to send it back to the growth bed.`}
                        onPointerDown={(e) => startDrag(e, { kind: 'slot', uid: item.uid, slotId: slot.id })}
                        onClick={() => removeItem(item.uid)}
                        onKeyDown={(e) => onSlotKeyDown(e, slot)}
                        onMouseEnter={(e) => enterTooltip(e, item.uid)}
                        onMouseMove={(e) => moveTooltip(e, item.uid)}
                        onMouseLeave={clearTooltip}
                      />
                    ) : (
                      <span className="pore" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="tray" aria-label="Growth bed — loose loot waiting to be packed">
          <h2 className="sec-title">Growth Bed</h2>
          <div
            ref={trayEl}
            className={`tray-row${overTray ? ' over' : ''}`}
            role="list"
            aria-label="Loose items. Click or press Enter to auto-stash into the first open pore."
          >
            {state.tray.length === 0 ? (
              <p className="tray-empty">The growth bed is empty — restock the pack.</p>
            ) : (
              state.tray.map((uid) => {
                const item = state.items[uid]
                if (!item) return null
                return (
                  <div key={uid} className="tray-chip" role="listitem">
                    <ItemChip
                      item={item}
                      className={draggingUid === uid ? 'source-hidden' : ''}
                      label={`${itemName(item)}, ${RARITY[item.rarity].label}, ${typeOf(item).stat}, ${item.value} gold, loose in the growth bed. Press Enter to stash it in the pack.`}
                      onPointerDown={(e) => startDrag(e, { kind: 'tray', uid: item.uid })}
                      onClick={() => stashItem(item.uid)}
                      onMouseEnter={(e) => enterTooltip(e, item.uid)}
                      onMouseMove={(e) => moveTooltip(e, item.uid)}
                      onMouseLeave={clearTooltip}
                    />
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </main>

      <footer className="foot">
        <span>
          Drag loot into a pore — the pack gulps. Click an item to auto-stash, click a packed item to release it.
        </span>
        <span>
          seed <code>#{state.seed}</code>
        </span>
      </footer>

      {ghostItem && lastPos?.active && (
        <div
          ref={ghostEl}
          className="ghost"
          role="presentation"
          aria-hidden="true"
          style={
            {
              transform: `translate(${lastPos.x}px, ${lastPos.y}px) translate(-50%,-50%)`,
              '--rar': RARITY[ghostItem.rarity].color,
            } as CSSProperties
          }
        >
          <div className="chip">
            <span className="chip-emoji">{typeOf(ghostItem).emoji}</span>
          </div>
        </div>
      )}

      {tooltip && state.items[tooltip.uid] && (
        <Tooltip item={state.items[tooltip.uid]} x={tooltip.x} y={tooltip.y} />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}