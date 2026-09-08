import { load, save, KEYS } from './lib'

type OscType = OscillatorType

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = load<boolean>(KEYS.snd, true)
let lastHover = 0

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(on: boolean): void {
  if (on) {
    enabled = true
    voice('square', 660, 660, 0, 0.05, 0.12)
  } else {
    voice('square', 440, 440, 0, 0.05, 0.12)
    enabled = false
  }
  save(KEYS.snd, on)
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.15
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function voice(
  type: OscType,
  f0: number,
  f1: number | null,
  delay: number,
  dur: number,
  peak = 0.15,
): void {
  if (!enabled) return
  const c = ensure()
  if (!c || !master) return
  const start = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(Math.max(1, f0), start)
  if (f1 !== null && f1 !== f0) {
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur)
  }
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(peak, start + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(master)
  o.start(start)
  o.stop(start + dur + 0.05)
}

function noiseBurst(delay: number, dur: number, cutoff: number, peak = 0.12): void {
  if (!enabled) return
  const c = ensure()
  if (!c || !master) return
  const start = c.currentTime + delay
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(Math.max(40, cutoff), start)
  filter.frequency.exponentialRampToValueAtTime(40, start + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(peak, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(start)
  src.stop(start + dur + 0.05)
}

/* interaction set */

export function blip(): void {
  voice('square', 880, 1320, 0, 0.08, 0.18)
}

export function addChord(): void {
  voice('sine', 523.25, null, 0, 0.09, 0.2)
  voice('sine', 783.99, null, 0.06, 0.1, 0.2)
}

export function removeChord(): void {
  voice('sine', 783.99, null, 0, 0.09, 0.18)
  voice('sine', 523.25, null, 0.06, 0.1, 0.18)
}

export function zap(): void {
  voice('sawtooth', 220, 55, 0, 0.18, 0.18)
  noiseBurst(0.02, 0.09, 1000, 0.08)
}

export function chord(): void {
  voice('triangle', 392, null, 0, 0.35, 0.15)
  voice('triangle', 494, null, 0, 0.35, 0.15)
  voice('triangle', 587, null, 0, 0.35, 0.15)
  voice('square', 1568, null, 0.12, 0.06, 0.1)
}

export function toggle(): void {
  voice('square', 660, 660, 0, 0.05, 0.12)
}

export function error(): void {
  voice('square', 180, null, 0, 0.1, 0.2)
  voice('square', 140, null, 0.08, 0.12, 0.2)
}

export function hoverTick(): void {
  if (!enabled) return
  const now = performance.now()
  if (now - lastHover < 60) return
  lastHover = now
  voice('sine', 2400, null, 0, 0.015, 0.04)
}

export function sunTick(step: number): void {
  const f = 600 + step * 150
  voice('square', f, f, 0, 0.09, 0.16)
}

export function sweep(): void {
  voice('sine', 200, 800, 0, 0.3, 0.06)
}

export function fanfare(): void {
  const seq = [523.25, 659.25, 783.99, 1046.5, 1318.51]
  seq.forEach((f, i) => {
    voice('square', f, null, i * 0.07, 0.09, 0.16)
    voice('triangle', f, null, i * 0.07, 0.12, 0.12)
  })
  voice('triangle', 1046.5, null, seq.length * 0.07, 0.8, 0.16)
  voice('triangle', 1318.51, null, seq.length * 0.07, 0.8, 0.16)
  voice('triangle', 1567.98, null, seq.length * 0.07, 0.8, 0.16)
  noiseBurst(seq.length * 0.07, 0.6, 8000, 0.1)
}