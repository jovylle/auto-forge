import { TIER_META, fmtClock, pad3 } from './types'
import { State } from './state'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

export class StripView {
  private chip: HTMLElement
  private chipLabel: HTMLElement
  private intensityVal: HTMLElement
  private nextId: HTMLElement
  private clock: HTMLElement
  private brush: HTMLElement

  constructor(strip: HTMLElement, sparkCanvas: HTMLCanvasElement) {
    const rainBlock = el('div', 'strip-block')
    const rainHead = el('div', 'micro-label')
    const idx = el('span', 'idx', '01')
    rainHead.append(idx, document.createTextNode(' — RAIN'))
    this.chip = el('div', 'chip', 'R')
    this.chipLabel = el('span', 'micro-label', 'OFF')
    const chipRow = el('div', 'chip-row')
    chipRow.append(this.chip, this.chipLabel)
    rainBlock.append(rainHead, chipRow)

    const sparkWrap = el('div', 'spark-wrap')
    sparkCanvas.className = 'sparkline'
    sparkCanvas.setAttribute('aria-hidden', 'true')
    this.intensityVal = el('div', 'strip-block')
    this.intensityVal.textContent = ''
    const intHead = el('div', 'micro-label', 'INTENSITY')
    const intVal = el('span', 'hud', '0.00')
    this.intensityVal.append(intHead, intVal)
    sparkWrap.append(sparkCanvas, this.intensityVal)

    const divider = el('div', 'divider')

    const evapBlock = el('div', 'strip-block')
    const evapHead = el('div', 'micro-label')
    const idx2 = el('span', 'idx', '03')
    evapHead.append(idx2, document.createTextNode(' — EVAPORATION'))
    this.nextId = el('span', 'micro-label', '—')
    const nextRow = el('div', 'chip-row')
    nextRow.append(this.nextId)
    this.clock = el('div', 'strip-clock idle', '--:--')
    evapBlock.append(evapHead, nextRow, this.clock)

    const hints = el('div', 'hints')
    const hintText =
      '↑↓←→ MOVE · ⏎ LOG · S SIZE · R RAIN · ⌫ REMOVE · ? HELP'
    hints.append(el('span', '', hintText))
    this.brush = el('span', '', '')
    const brushWrap = el('div', 'chip-row')
    brushWrap.append(this.brush)

    strip.append(rainBlock, sparkWrap, divider, evapBlock, brushWrap, hints)
  }

  frame(state: State, intensity: number): void {
    this.chip.classList.toggle('on', state.raining)
    this.chipLabel.textContent = state.raining ? 'ON' : 'OFF'

    this.intensityVal.querySelector('.hud')!.textContent = intensity.toFixed(2)

    let best: { id: number; rem: number } | null = null
    for (const p of state.puddles) {
      const rem = TIER_META[p.tier].life - p.evap
      if (!best || rem < best.rem) best = { id: p.id, rem }
    }
    if (best) {
      this.nextId.textContent = `NEXT TO VANISH — P-${pad3(best.id)}`
      this.clock.textContent = fmtClock(best.rem)
      this.clock.classList.remove('idle')
      this.clock.classList.toggle('urgent', best.rem < 10_000)
    } else {
      this.nextId.textContent = 'NEXT TO VANISH'
      this.clock.textContent = '--:--'
      this.clock.classList.add('idle')
      this.clock.classList.remove('urgent')
    }

    this.brush.textContent = `BRUSH — ${state.brush} · ${TIER_META[state.brush].life / 1000}s`
  }
}