import { Puddle, TIER_META, pad3 } from './types'
import { blobPath } from './rng'
import { State } from './state'

const CELL = 44
const SVG_NS = 'http://www.w3.org/2000/svg'

const H_NAMES = ['MIRE AVE', 'GUTTER RD', 'DRIP LN', 'SOAK WAY', 'SEEP ST', 'DRAIN RD', 'WELL LN', 'BOG AVE']
const V_NAMES = ['ASH ST', 'EMBER ST', 'SLOSH ST', 'MIST LN', 'DEW ST', 'FOG WALK']

interface PuddleNode {
  root: HTMLElement
  ann: HTMLElement
  fuse: HTMLElement
  lastSec: number
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

export class MapView {
  plate: HTMLElement
  onLogPuddle: (col: number, row: number) => void = () => {}

  private gridLayer = el('div', 'map-grid')
  private puddleLayer = el('div', 'map-puddles')
  private guideH = el('div', 'cursor-guide-h')
  private guideV = el('div', 'cursor-guide-v')
  private ring = el('div', 'cursor-ring')
  private dot = el('div', 'cursor-dot')
  private cursor = el('div', 'map-cursor')
  private coord = el('div', 'coord')

  private nodes = new Map<number, PuddleNode>()
  private cols = 0
  private rows = 0
  col = 0
  row = 0

  constructor(plate: HTMLElement) {
    this.plate = plate
    this.cursor.append(this.ring, this.dot)
    plate.append(this.gridLayer, this.puddleLayer, this.cursor, this.coord)
    plate.append(this.guideH, this.guideV)
  }

  resize(): void {
    const w = this.plate.clientWidth
    const h = this.plate.clientHeight
    this.cols = Math.max(1, Math.floor(w / CELL))
    this.rows = Math.max(1, Math.floor(h / CELL))
    this.col = Math.min(this.col, this.cols - 1)
    this.row = Math.min(this.row, this.rows - 1)
    this.buildGrid(w, h)
    this.renderCursor()
  }

  move(dc: number, dr: number): void {
    this.col = Math.max(0, Math.min(this.cols - 1, this.col + dc))
    this.row = Math.max(0, Math.min(this.rows - 1, this.row + dr))
    this.renderCursor()
  }

  private buildGrid(w: number, h: number): void {
    this.gridLayer.replaceChildren()
    for (let i = 1; i < this.cols; i++) {
      const street = i % 4 === 0
      const line = el('div', street ? 'grid-line street' : 'grid-line')
      line.style.left = `${i * CELL}px`
      line.style.top = '0'
      line.style.width = '1px'
      line.style.height = `${h}px`
      this.gridLayer.appendChild(line)
      if (street) {
        const name = el('div', 'street-name v', V_NAMES[(i / 4 - 1 + V_NAMES.length * 2) % V_NAMES.length])
        name.style.left = `${i * CELL + 6}px`
        name.style.top = `${Math.round(h * (0.22 + 0.15 * ((i / 4) % 4)))}px`
        this.gridLayer.appendChild(name)
      }
    }
    for (let j = 1; j < this.rows; j++) {
      const street = j % 3 === 0
      const line = el('div', street ? 'grid-line street' : 'grid-line')
      line.style.top = `${j * CELL}px`
      line.style.left = '0'
      line.style.height = '1px'
      line.style.width = `${w}px`
      this.gridLayer.appendChild(line)
      if (street) {
        const name = el('div', 'street-name', H_NAMES[(j / 3 - 1 + H_NAMES.length * 2) % H_NAMES.length])
        name.style.left = `${Math.round(w * (0.16 + 0.14 * ((j / 3) % 5)))}px`
        name.style.top = `${j * CELL - 6}px`
        this.gridLayer.appendChild(name)
      }
    }
  }

  private renderCursor(): void {
    const cx = (this.col + 0.5) * CELL
    const cy = (this.row + 0.5) * CELL
    this.cursor.style.left = `${cx}px`
    this.cursor.style.top = `${cy}px`
    this.cursor.style.translate = '-50% -50%'
    this.guideV.style.left = `${this.col * CELL}px`
    this.guideV.style.top = '0'
    this.guideV.style.width = '1px'
    this.guideV.style.height = '100%'
    this.guideH.style.top = `${this.row * CELL}px`
    this.guideH.style.left = '0'
    this.guideH.style.height = '1px'
    this.guideH.style.width = '100%'
    this.coord.textContent = `C${this.col + 1}·R${this.row + 1}`
    this.coord.style.left = `${cx + 11}px`
    this.coord.style.top = `${cy + 11}px`
  }

  private createPuddle(p: Puddle): PuddleNode {
    const meta = TIER_META[p.tier]
    const root = el('div', 'puddle bloom')

    const size = meta.dia
    const pad = 12
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(size + pad))
    svg.setAttribute('height', String(size + pad))
    svg.setAttribute('viewBox', `${-(size / 2 + pad / 2)} ${-(size / 2 + pad / 2)} ${size + pad} ${size + pad}`)

    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', blobPath(p.seed, size / 2))
    path.setAttribute('fill', 'var(--color-puddle)')
    if (meta.stroke > 0) {
      path.setAttribute('stroke', 'var(--color-ink)')
      path.setAttribute('stroke-width', String(meta.stroke))
    }
    svg.appendChild(path)

    const dropPositions: Array<[number, number, number]> =
      meta.drops === 1
        ? [[size * 0.34, size * 0.4, 2]]
        : meta.drops === 2
          ? [[size * 0.36, size * 0.42, 2.2], [size * 0.55, size * 0.24, 1.6]]
          : []
    for (const [dx, dy, r] of dropPositions) {
      const drop = document.createElementNS(SVG_NS, 'circle')
      drop.setAttribute('cx', String(dx - size / 2))
      drop.setAttribute('cy', String(dy - size / 2))
      drop.setAttribute('r', String(r))
      drop.setAttribute('fill', 'var(--color-puddle)')
      drop.setAttribute('stroke', 'var(--color-ink)')
      drop.setAttribute('stroke-width', '0.75')
      svg.appendChild(drop)
    }

    const ann = el('div', 'puddle-ann', `P-${pad3(p.id)} · ${Math.ceil(this.stateRemaining(p) / 1000)}s`)
    const fuse = el('div', 'fuse')
    fuse.style.width = `${meta.dia}px`
    root.append(svg, ann, fuse)
    root.style.left = `${(p.col + 0.5) * CELL}px`
    root.style.top = `${(p.row + 0.5) * CELL}px`
    this.puddleLayer.appendChild(root)

    const node: PuddleNode = { root, ann, fuse, lastSec: Math.ceil(this.stateRemaining(p) / 1000) }
    this.nodes.set(p.id, node)
    return node
  }

  private stateRemaining(p: Puddle): number {
    return Math.max(0, TIER_META[p.tier].life - p.evap)
  }

  private updateNode(node: PuddleNode, p: Puddle): void {
    const meta = TIER_META[p.tier]
    const remaining = this.stateRemaining(p)
    const sec = Math.ceil(remaining / 1000)
    if (sec !== node.lastSec) {
      node.lastSec = sec
      node.ann.textContent = `P-${pad3(p.id)} · ${sec}s`
    }
    node.fuse.style.width = `${Math.max(2, meta.dia * (remaining / meta.life))}px`
    node.root.classList.toggle('flicker', remaining < 5000 && remaining > 0)
    node.root.classList.toggle('raining', this.raining)
  }

  private raining = false
  private pendingRemoval = new Set<number>()

  frame(_dt: number, state: State): void {
    this.raining = state.raining

    const activeIds = new Set(state.puddles.map((p) => p.id))
    for (const [id, node] of this.nodes) {
      if (!activeIds.has(id)) {
        this.nodes.delete(id)
        if (this.pendingRemoval.has(id)) continue
        this.pendingRemoval.add(id)
        node.root.classList.add('leaving')
        setTimeout(() => {
          node.root.remove()
          this.pendingRemoval.delete(id)
        }, 240)
      }
    }

    for (const p of state.puddles) {
      let node = this.nodes.get(p.id)
      if (!node) node = this.createPuddle(p)
      this.updateNode(node, p)
    }
  }
}