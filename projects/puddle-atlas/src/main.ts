import './index.css'
import { State } from './state'
import { MapView } from './map'
import { RainView } from './rain'
import { Sparkline } from './sparkline'
import { LogView } from './log'
import { StripView } from './strip'
import { HelpView } from './help'
import { rainIntensity } from './weather'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

const app = document.querySelector<HTMLDivElement>('#app')!
app.classList.add('app')

/* grain + registration marks */
app.appendChild(el('div', 'grain'))
const markDefs: Array<[string, string, string, string]> = [
  ['', '', 'left:0;top:0', '+'],
  ['', '', 'right:0;top:0', '+'],
  ['', '', 'left:0;bottom:0', '+'],
  ['', '', 'right:0;bottom:0', '+'],
]
for (const [,, pos, glyph] of markDefs) {
  const m = el('span', 'mark', glyph)
  m.style.cssText = pos
  app.appendChild(m)
}

/* top rule + form header */
const toprule = el('div', 'toprule')
toprule.appendChild(el('span', 'micro-label', 'SURVEY SHEET · STATION 12 · EST. 2026'))
app.appendChild(toprule)

/* masthead */
const masthead = el('div', 'masthead')
masthead.appendChild(el('div', 'masthead-line', 'PUDDLE'))
const line2 = el('div', 'masthead-line')
const atlas = el('span', 'masthead-atlas', 'ATLAS')
line2.append(atlas, el('span', 'masthead-note', '— field survey · no. 04'))
masthead.appendChild(line2)
app.appendChild(masthead)

/* content grid */
const content = el('main', 'content')
const plate = el('section', 'map-plate')
plate.tabIndex = 0
plate.setAttribute(
  'aria-label',
  'Street map of your neighborhood. Arrow keys move the surveyor, Enter logs a puddle, R makes it rain.',
)
const rainCanvas = document.createElement('canvas')
rainCanvas.className = 'rain-canvas'
plate.appendChild(rainCanvas)
content.appendChild(plate)
content.appendChild(el('div'))
const logCol = el('aside', 'log-col')
const counter = el('div', 'counter', '00')
const counterLabel = el('div', 'micro-label counter-label', 'PUDDLES SURVEYED')
const logHead = el('div', 'micro-label log-head')
const lh = el('span', 'idx', '02')
logHead.append(lh, document.createTextNode(' — LOG · RECENT OBSERVATIONS'))
const logScroll = el('div', 'log-scroll')
logScroll.setAttribute('role', 'list')
logScroll.tabIndex = 0
logScroll.setAttribute('aria-label', 'Recent puddle observations')
logCol.append(counter, counterLabel, logHead, logScroll)
content.appendChild(logCol)
app.appendChild(content)

/* status strip */
const strip = el('footer', 'strip')
strip.tabIndex = 0
strip.setAttribute('aria-label', 'Rain and evaporation status')
const sparkCanvas = document.createElement('canvas')
app.appendChild(strip)

/* help overlay */
const helpOverlay = el('div', 'help hidden')
helpOverlay.setAttribute('role', 'dialog')
helpOverlay.setAttribute('aria-label', 'Field manual')
app.appendChild(helpOverlay)

/* ---- wire ---- */
const state = new State()
const map = new MapView(plate)
const rain = new RainView(rainCanvas)
const spark = new Sparkline(sparkCanvas)
const log = new LogView(counter, logScroll)
const stripView = new StripView(strip, sparkCanvas)
const help = new HelpView(helpOverlay)

state.subscribe(() => log.rebuild(state))
log.rebuild(state)

const resize = (): void => {
  const dpr = window.devicePixelRatio || 1
  map.resize()
  rain.resize(plate.clientWidth, plate.clientHeight, dpr)
  spark.resize(dpr)
}
new ResizeObserver(resize).observe(plate)
window.addEventListener('resize', resize)
resize()

/* rain wiring */
const applyRain = (v: boolean): void => {
  rain.setOn(v)
  atlas.classList.toggle('wet', v)
  if (v) spawnDrop()
}

function spawnDrop(): void {
  const drop = el('div', 'masthead-drop')
  drop.style.left = `${atlas.getBoundingClientRect().left - masthead.getBoundingClientRect().left + 8}px`
  drop.style.top = `${atlas.getBoundingClientRect().bottom - masthead.getBoundingClientRect().top}px`
  masthead.appendChild(drop)
  setTimeout(() => drop.remove(), 650)
}

const setRain = (v: boolean): void => {
  if (state.raining === v) return
  state.setRaining(v)
  applyRain(v)
}

/* keyboard */
window.addEventListener('keydown', (e) => {
  if (help.isOpen) {
    help.handleKey(e)
    return
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key
  switch (k) {
    case 'ArrowUp':
      e.preventDefault()
      map.move(0, -1)
      break
    case 'ArrowDown':
      e.preventDefault()
      map.move(0, 1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      map.move(-1, 0)
      break
    case 'ArrowRight':
      e.preventDefault()
      map.move(1, 0)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      state.addPuddle(map.row, map.col)
      break
    case 's':
    case 'S':
      state.cycleBrush()
      break
    case 'r':
    case 'R':
      setRain(!state.raining)
      break
    case 'Delete':
    case 'Backspace': {
      const at = state.puddles.find((p) => p.col === map.col && p.row === map.row)
      if (at) state.removePuddle(at.id)
      break
    }
    case 'h':
    case 'H':
    case '?':
      e.preventDefault()
      help.open()
      break
  }
})

/* main loop */
let last = performance.now()
const loop = (t: number): void => {
  const dt = Math.min(t - last, 100)
  last = t
  state.tick()
  const intensity = rainIntensity(performance.now(), state.raining)
  rain.frame(dt, intensity)
  spark.frame(dt, intensity)
  map.frame(dt, state)
  log.frame(dt, state)
  stripView.frame(state, intensity)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

/* init */
if (state.raining) {
  applyRain(true)
  rain.setOn(true)
}
plate.focus({ preventScroll: true })