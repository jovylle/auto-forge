let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean): void {
  muted = m
}

export function isMuted(): boolean {
  return muted
}

export function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const det = (): number => Math.pow(2, (Math.random() * 30 - 15) / 1200)

function master(): GainNode | null {
  const c = ctx
  if (!c) return null
  const g = c.createGain()
  g.gain.value = 0.16
  g.connect(c.destination)
  return g
}

function tone(
  c: AudioContext,
  g: GainNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  at = 0,
  vol = 0.7,
): void {
  const t = c.currentTime + at
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(Math.max(1, f0), t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  const og = c.createGain()
  og.gain.setValueAtTime(0.0001, t)
  og.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(og)
  og.connect(g)
  o.start(t)
  o.stop(t + dur + 0.06)
}

function burst(c: AudioContext, g: GainNode, dur: number, freq: number, at = 0, vol = 0.4): void {
  const t = c.currentTime + at
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 1.4
  const bg = c.createGain()
  bg.gain.setValueAtTime(0.0001, t)
  bg.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f)
  f.connect(bg)
  bg.connect(g)
  src.start(t)
}

function play(fn: (c: AudioContext, g: GainNode) => void): void {
  if (muted) return
  const c = ensureCtx()
  if (!c) return
  const g = master()
  if (!g) return
  fn(c, g)
}

export const sfx = {
  grab(): void {
    play((c, g) => {
      tone(c, g, 'sine', 320 * det(), 660 * det(), 0.09)
      burst(c, g, 0.035, 2600, 0, 0.25)
    })
  },
  drop(): void {
    play((c, g) => {
      tone(c, g, 'sine', 190 * det(), 92 * det(), 0.13)
      tone(c, g, 'triangle', 285 * det(), 138 * det(), 0.11, 0, 0.35)
      burst(c, g, 0.07, 520, 0, 0.3)
    })
  },
  swap(): void {
    play((c, g) => {
      tone(c, g, 'sine', 220 * det(), 130 * det(), 0.09)
      tone(c, g, 'sine', 160 * det(), 90 * det(), 0.1, 0.06)
      burst(c, g, 0.05, 680, 0, 0.25)
    })
  },
  reject(): void {
    play((c, g) => {
      tone(c, g, 'square', 88, 58, 0.045, 0, 0.4)
      tone(c, g, 'square', 88, 58, 0.045, 0.055, 0.4)
    })
  },
  stash(): void {
    play((c, g) => {
      tone(c, g, 'sine', 240 * det(), 120 * det(), 0.1)
      tone(c, g, 'triangle', 360 * det(), 180 * det(), 0.09, 0, 0.3)
      burst(c, g, 0.05, 700, 0, 0.2)
    })
  },
  remove(): void {
    play((c, g) => {
      tone(c, g, 'sine', 420 * det(), 160 * det(), 0.2)
      tone(c, g, 'sine', 260 * det(), 110 * det(), 0.18, 0.03, 0.3)
    })
  },
  restock(): void {
    play((c, g) => {
      tone(c, g, 'triangle', 330 * det(), 660 * det(), 0.08)
      tone(c, g, 'triangle', 440 * det(), 880 * det(), 0.09, 0.09)
      tone(c, g, 'triangle', 550 * det(), 1100 * det(), 0.1, 0.18)
    })
  },
  click(): void {
    play((c, g) => {
      tone(c, g, 'sine', 480 * det(), 720 * det(), 0.05, 0, 0.25)
    })
  },
}