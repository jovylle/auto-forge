/**
 * WebAudio sound engine — zero assets. All sounds synthesized.
 * The AudioContext is created lazily on first user gesture.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

export function setSoundEnabled(v: boolean) {
  enabled = v
}

export function isSoundEnabled() {
  return enabled
}

export function ensureAudio(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Blip with a pitch glide — "comet whoosh". */
function blip(freq: number, endFreq: number, dur: number, type: OscillatorType = 'sine', vol = 1) {
  const ac = ensureAudio()
  if (!ac || !master) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sfx = {
  add() {
    blip(220, 660, 0.18, 'sine', 0.9)
    setTimeout(() => blip(440, 880, 0.14, 'triangle', 0.5), 60)
  },
  select() {
    blip(520, 740, 0.08, 'square', 0.35)
  },
  complete() {
    blip(660, 990, 0.16, 'triangle', 0.8)
    setTimeout(() => blip(990, 1320, 0.18, 'triangle', 0.7), 80)
  },
  delete() {
    blip(340, 90, 0.28, 'sawtooth', 0.7)
  },
  sort() {
    blip(300, 200, 0.1, 'sine', 0.5)
  },
  alarm() {
    blip(880, 880, 0.09, 'square', 0.5)
    setTimeout(() => blip(660, 660, 0.09, 'square', 0.5), 140)
    setTimeout(() => blip(880, 880, 0.09, 'square', 0.5), 280)
  },
  tick() {
    blip(1200, 1600, 0.04, 'sine', 0.2)
  },
}