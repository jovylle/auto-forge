// WebAudio synth — no assets. Koto-ish plucks, sizzles, blips.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

function ensure(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function setMuted(m: boolean): void {
  muted = m
  if (master && ctx) master.gain.setValueAtTime(m ? 0 : 0.5, ctx.currentTime)
}

export function isMuted(): boolean {
  return muted
}

// Pentatonic ladder for koto feel (A C D E G across octaves)
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 784]

/** Triangle pluck with pitch bend — waypoint drops. */
export function pluck(step = 4): void {
  if (muted) return
  const ac = ensure()
  if (!ac || !master) return
  const t = ac.currentTime
  const f = SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length] ?? 440
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(f * 0.92, t)
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.06)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  osc.connect(g)
  g.connect(master)
  osc.start(t)
  osc.stop(t + 0.75)
}

/** Short square blip — UI ticks, route links. */
export function blip(freq = 660, dur = 0.09, vol = 0.25): void {
  if (muted) return
  const ac = ensure()
  if (!ac || !master) return
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** Band-passed noise sizzle + low sub — territory bloom. */
export function sizzle(dur = 1.1): void {
  if (muted) return
  const ac = ensure()
  if (!ac || !master) return
  const t = ac.currentTime
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900, t)
  bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.7)
  bp.Q.value = 1.2
  const g = ac.createGain()
  g.gain.setValueAtTime(0.28, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t)

  const sub = ac.createOscillator()
  const sg = ac.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(70, t)
  sub.frequency.exponentialRampToValueAtTime(130, t + dur * 0.8)
  sg.gain.setValueAtTime(0.22, t)
  sg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  sub.connect(sg)
  sg.connect(master)
  sub.start(t)
  sub.stop(t + dur + 0.05)
}

/** Rising chime arpeggio — export success. */
export function chime(): void {
  if (muted) return
  const ac = ensure()
  if (!ac || !master) return
  const notes = [523.25, 659.25, 784, 1046.5]
  notes.forEach((f, i) => {
    const t = ac.currentTime + i * 0.09
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(g)
    const m = master
    if (m) g.connect(m)
    osc.start(t)
    osc.stop(t + 0.55)
  })
}
