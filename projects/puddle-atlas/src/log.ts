import { Puddle, Settled, TIER_META, fmtBorn, fmtClock, pad3 } from './types'
import { State } from './state'

interface RowNode {
  id: number
  clock: HTMLElement | null
  lastSec: number
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

type RowItem = { p: Puddle; key: number; diedAt?: number } | { key: number; diedAt: number; p?: never }

export class LogView {
  private counter: HTMLElement
  private scroll: HTMLElement
  private rows = new Map<number, RowNode>()
  private settled: Settled[] = []

  constructor(counter: HTMLElement, scroll: HTMLElement) {
    this.counter = counter
    this.scroll = scroll
  }

  rebuild(state: State): void {
    this.settled = state.settled
    this.counter.textContent = String(state.puddles.length).padStart(2, '0')

    const items: RowItem[] = []
    for (const p of state.puddles) items.push({ p, key: p.id })
    for (const s of state.settled) items.push({ key: s.id, diedAt: s.diedAt })
    items.sort((a, b) => (b.diedAt ?? b.p.bornAt) - (a.diedAt ?? a.p.bornAt))
    const top = items.slice(0, 8)

    const ids = new Set(top.map((r) => r.key))
    for (const [id, node] of this.rows) {
      if (!ids.has(id)) {
        node.clock?.parentElement?.remove()
        this.rows.delete(id)
      }
    }

    for (const item of top) {
      if (item.p && this.rows.has(item.key)) {
        this.updateLiveRow(this.rows.get(item.key)!, item.p)
        continue
      }
      if (!item.p && this.rows.has(item.key)) continue
      this.createRow(item)
    }

    const empty = this.scroll.querySelector('.log-empty')
    if (top.length === 0 && !empty) {
      const e = el('div', 'log-empty', 'NO OBSERVATIONS — WALK & PRESS ⏎')
      this.scroll.appendChild(e)
    } else if (top.length > 0 && empty) {
      empty.remove()
    }
  }

  private createRow(item: RowItem): void {
    const row = el('div', 'log-row')
    row.setAttribute('role', 'listitem')
    if (item.p) {
      const p = item.p
      const id = el('span', 'id', `P-${pad3(p.id)}`)
      const tier = el('span', 'tier', p.tier)
      const born = el('span', 'born', fmtBorn(p.bornAt))
      const clock = el('span', 'clock', fmtClock(TIER_META[p.tier].life))
      const left = el('div')
      left.append(id, tier, born)
      row.append(left, clock)
      row.setAttribute('aria-label', `Puddle P-${pad3(p.id)}, tier ${p.tier}, logged ${fmtBorn(p.bornAt)}`)
      this.scroll.appendChild(row)
      this.rows.set(p.id, {
        id: p.id,
        clock,
        lastSec: Math.ceil(TIER_META[p.tier].life / 1000),
      })
    } else {
      const s = this.settled.find((x) => x.id === item.key)
      if (!s) return
      const id = el('span', 'id', `P-${pad3(s.id)}`)
      const tier = el('span', 'tier', s.tier)
      const born = el('span', 'born', fmtBorn(s.bornAt))
      const stamp = el('span', 'stamp', 'EVAPORATED')
      const left = el('div')
      left.append(id, tier, born)
      row.append(left, stamp)
      row.classList.add('evap')
      row.setAttribute('aria-label', `Puddle P-${pad3(s.id)} evaporated`)
      this.scroll.appendChild(row)
      this.rows.set(s.id, { id: s.id, clock: null, lastSec: 0 })
    }
  }

  private updateLiveRow(node: RowNode, p: Puddle): void {
    if (!node.clock) return
    const remaining = Math.max(0, TIER_META[p.tier].life - p.evap)
    const sec = Math.ceil(remaining / 1000)
    if (sec !== node.lastSec) {
      node.lastSec = sec
      node.clock.textContent = fmtClock(remaining)
    }
    node.clock.classList.toggle('urgent', remaining < 10_000)
  }

  frame(_dt: number, state: State): void {
    for (const p of state.puddles) {
      const node = this.rows.get(p.id)
      if (node) this.updateLiveRow(node, p)
    }
  }
}