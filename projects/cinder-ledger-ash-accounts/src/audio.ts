/* WebAudio bleeps — no assets. Every interaction makes a sound. */

import { load, save, KEYS } from './lib'

let ctx: AudioContext | null = null
let enabled: boolean = load<boolean>(KEYS.sound, true)

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(on: boolean): void {
  enabled = on
  save(KEYS.sound, on)
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur = 0.12, type: OscillatorType = 'square', gain = 0.06, when = 0): void {
  const c = ac()
  if (!c) return
  try {
    const t = c.currentTime + when
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + dur + 0.02)
  } catch {
    /* audio unavailable — stay silent */
  }
}

function noise(dur = 0.18, gain = 0.05, when = 0): void {
  const c = ac()
  if (!c) return
  try {
    const t = c.currentTime + when
    const len = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(900, t)
    src.connect(f).connect(g).connect(c.destination)
    src.start(t)
  } catch {
    /* silent */
  }
}

/** income added — rising spark */
export function sndEmber(): void {
  blip(392, 0.1, 'square', 0.05)
  blip(587, 0.14, 'square', 0.05, 0.08)
}

/** expense added — low ash thud + crackle */
export function sndAsh(): void {
  blip(147, 0.16, 'triangle', 0.08)
  noise(0.22, 0.05, 0.02)
}

/** entry deleted — pop */
export function sndDelete(): void {
  blip(330, 0.07, 'sawtooth', 0.04)
  blip(220, 0.09, 'sawtooth', 0.04, 0.06)
}

/** generic click / toggle */
export function sndClick(): void {
  blip(660, 0.05, 'square', 0.035)
}

/** burn-all — descending whoosh */
export function sndBurn(): void {
  blip(523, 0.1, 'sawtooth', 0.05)
  blip(392, 0.1, 'sawtooth', 0.05, 0.09)
  blip(262, 0.16, 'sawtooth', 0.05, 0.18)
  noise(0.5, 0.06, 0.1)
}

/** export / share — bright arpeggio */
export function sndExport(): void {
  blip(523, 0.09, 'square', 0.05)
  blip(659, 0.09, 'square', 0.05, 0.08)
  blip(784, 0.14, 'square', 0.05, 0.16)
}
