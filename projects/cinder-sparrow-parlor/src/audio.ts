/* WebAudio synth — every interaction makes a sound. No assets. */

import { load, save, KEYS } from './lib'

let ctx: AudioContext | null = null
let enabled: boolean = true

try {
  enabled = load<boolean>(KEYS.sound, true)
} catch {
  enabled = true
}

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
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur = 0.1, type: OscillatorType = 'square', gain = 0.05, when = 0, slide = 0): void {
  const c = ac()
  if (!c) return
  try {
    const t = c.currentTime + when
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + dur + 0.02)
  } catch {
    /* silent */
  }
}

function crackle(dur = 0.25, gain = 0.06, when = 0): void {
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
    f.type = 'bandpass'
    f.frequency.setValueAtTime(2200, t)
    src.connect(f).connect(g).connect(c.destination)
    src.start(t)
  } catch {
    /* silent */
  }
}

/** sparrow chirp — quick rising double peep */
export function sndChirp(): void {
  blip(2400, 0.07, 'sine', 0.06, 0, 900)
  blip(2900, 0.09, 'sine', 0.06, 0.08, 1100)
}

/** warm trade — happy chord */
export function sndWarm(): void {
  blip(523, 0.12, 'square', 0.05)
  blip(659, 0.12, 'square', 0.05, 0.09)
  blip(784, 0.2, 'square', 0.05, 0.18)
  crackle(0.3, 0.03, 0.05)
  sndChirp()
}

/** cold trade — low thud */
export function sndCold(): void {
  blip(180, 0.16, 'triangle', 0.07, 0, -60)
  blip(140, 0.14, 'triangle', 0.05, 0.1)
}

/** stoke seat — fire crackle + whoosh */
export function sndStoke(): void {
  crackle(0.28, 0.08)
  blip(220, 0.18, 'sawtooth', 0.04, 0.02, 160)
}

/** generic click / pop */
export function sndClick(): void {
  blip(700, 0.05, 'square', 0.035)
}

/** pin to board — bright fanfare */
export function sndPost(): void {
  blip(440, 0.09, 'square', 0.05)
  blip(554, 0.09, 'square', 0.05, 0.08)
  blip(659, 0.09, 'square', 0.05, 0.16)
  blip(880, 0.16, 'square', 0.05, 0.24)
}
