// Fable Cricket Loop Lab — WebAudio engine.
// 16 synthesized lo-fi voices, 4-track event loop recorder,
// delay + lowpass-filter FX, tap-tempo metronome, vinyl-crackle bed.
// No audio assets; everything is synthesized. Settings persist to localStorage.

export interface LoopEvent {
  pad: number
  t: number // seconds into the loop
  vel: number
}

export interface TrackState {
  events: LoopEvent[]
  muted: boolean
}

export const PAD_DEFS: ReadonlyArray<{ name: string; key: string }> = [
  { name: 'Kick', key: '1' },
  { name: 'Sub', key: '2' },
  { name: 'Snare', key: '3' },
  { name: 'Clap', key: '4' },
  { name: 'Hat', key: 'q' },
  { name: 'OpenHat', key: 'w' },
  { name: 'Rim', key: 'e' },
  { name: 'Shaker', key: 'r' },
  { name: 'LowTom', key: 'a' },
  { name: 'MidTom', key: 's' },
  { name: 'HiTom', key: 'd' },
  { name: 'Conga', key: 'f' },
  { name: 'Chirp', key: 'z' },
  { name: 'Keys', key: 'x' },
  { name: 'Bass', key: 'c' },
  { name: 'Swell', key: 'v' },
]

export const KEYMAP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3,
  q: 4, w: 5, e: 6, r: 7,
  a: 8, s: 9, d: 10, f: 11,
  z: 12, x: 13, c: 14, v: 15,
}

const STORAGE_KEY = 'fable-cricket-loop-lab:v1'
const MAX_EVENTS = 500

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

type Voice = (e: LoopLabEngine, t: number, v: number) => void

function tone(
  e: LoopLabEngine, t: number, v: number,
  type: OscillatorType, f0: number, f1: number,
  dur: number, peak: number, attack = 0.004,
): void {
  const ctx = e.ctx
  const bus = e.bus
  if (!ctx || !bus) return
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(Math.max(20, f0), t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.7)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak * v, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(bus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function nz(
  e: LoopLabEngine, t: number, v: number,
  type: BiquadFilterType, freq: number, q: number,
  dur: number, peak: number, attack = 0.002,
): void {
  const ctx = e.ctx
  const bus = e.bus
  const buf = e.noiseBuf
  if (!ctx || !bus || !buf) return
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.playbackRate.value = 0.7 + Math.random() * 0.6
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak * v, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f)
  f.connect(g)
  g.connect(bus)
  s.start(t)
  s.stop(t + dur + 0.05)
}

const VOICES: Voice[] = [
  (e, t, v) => { tone(e, t, v, 'sine', 160, 44, 0.3, 0.95); nz(e, t, v, 'highpass', 4000, 1, 0.03, 0.25) },
  (e, t, v) => { tone(e, t, v, 'sine', 62, 38, 0.55, 0.8) },
  (e, t, v) => { nz(e, t, v, 'bandpass', 1900, 0.8, 0.2, 0.6); tone(e, t, v, 'triangle', 195, 150, 0.12, 0.4) },
  (e, t, v) => { nz(e, t, v, 'highpass', 1300, 1, 0.09, 0.5); nz(e, t + 0.018, v, 'highpass', 1300, 1, 0.09, 0.45); nz(e, t + 0.042, v, 'highpass', 1300, 1, 0.22, 0.4) },
  (e, t, v) => { nz(e, t, v, 'highpass', 7800, 1, 0.05, 0.38) },
  (e, t, v) => { nz(e, t, v, 'highpass', 7200, 1, 0.38, 0.34) },
  (e, t, v) => { tone(e, t, v, 'square', 830, 660, 0.05, 0.4); nz(e, t, v, 'bandpass', 3200, 2, 0.03, 0.3) },
  (e, t, v) => { nz(e, t, v, 'bandpass', 5200, 1.2, 0.12, 0.32); nz(e, t + 0.07, v * 0.8, 'bandpass', 5200, 1.2, 0.1, 0.25) },
  (e, t, v) => { tone(e, t, v, 'sine', 132, 60, 0.28, 0.8) },
  (e, t, v) => { tone(e, t, v, 'sine', 205, 95, 0.24, 0.75) },
  (e, t, v) => { tone(e, t, v, 'sine', 330, 150, 0.2, 0.7) },
  (e, t, v) => { tone(e, t, v, 'triangle', 390, 210, 0.16, 0.6); nz(e, t, v, 'bandpass', 2600, 1.5, 0.05, 0.25) },
  (e, t, v) => { tone(e, t, v, 'sine', 4300, 4300, 0.045, 0.22); tone(e, t + 0.06, v, 'sine', 4700, 4700, 0.045, 0.2); tone(e, t + 0.12, v, 'sine', 5200, 5200, 0.05, 0.18) },
  (e, t, v) => { tone(e, t, v, 'triangle', 220, 220, 0.7, 0.2, 0.01); tone(e, t, v, 'triangle', 277.18, 277.18, 0.7, 0.2, 0.01); tone(e, t, v, 'sine', 110, 110, 0.8, 0.15, 0.01) },
  (e, t, v) => { tone(e, t, v, 'sawtooth', 60, 36, 0.5, 0.5) },
  (e, t, v) => { nz(e, t, v, 'bandpass', 850, 1.2, 1.1, 0.4, 0.35) },
]

interface Persisted {
  bpm: number
  bars: number
  metroOn: boolean
  delayTime: number
  feedback: number
  cutoff: number
  reso: number
  tracks: { events: LoopEvent[]; muted: boolean }[]
}

export class LoopLabEngine {
  ctx: AudioContext | null = null
  bus: GainNode | null = null
  noiseBuf: AudioBuffer | null = null

  bpm = 96
  bars = 2
  metroOn = true
  playing = false
  capturing: boolean[] = [false, false, false, false]
  tracks: TrackState[] = [
    { events: [], muted: false },
    { events: [], muted: false },
    { events: [], muted: false },
    { events: [], muted: false },
  ]
  delayTime = 0.34
  feedback = 0.42
  cutoff = 3800
  reso = 1.2
  lastHit = { pad: -1, vel: 0, n: 0 }

  private filter: BiquadFilterNode | null = null
  private delay: DelayNode | null = null
  private delayFb: GainNode | null = null
  private loopStart = 0
  private nextBeatTime = 0
  private nextBeatIdx = 0
  private schedFrom = 0
  private lastTap = 0
  private tapGaps: number[] = []
  private lastBeatNotified = -1
  private timer: number | null = null
  private listeners = new Set<() => void>()

  constructor() {
    this.load()
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  spb(): number {
    return 60 / this.bpm
  }

  loopDur(): number {
    return this.bars * 4 * this.spb()
  }

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 6
    comp.connect(ctx.destination)
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(comp)
    const bus = ctx.createGain()
    this.bus = bus
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = this.cutoff
    filter.Q.value = this.reso
    this.filter = filter
    const dry = ctx.createGain()
    dry.gain.value = 0.85
    bus.connect(filter)
    filter.connect(dry)
    dry.connect(master)
    const delay = ctx.createDelay(2.0)
    delay.delayTime.value = this.delayTime
    this.delay = delay
    const fb = ctx.createGain()
    fb.gain.value = this.feedback
    this.delayFb = fb
    const wet = ctx.createGain()
    wet.gain.value = 0.5
    filter.connect(delay)
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(master)
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf
    const crack = ctx.createBufferSource()
    crack.buffer = buf
    crack.loop = true
    const crackF = ctx.createBiquadFilter()
    crackF.type = 'lowpass'
    crackF.frequency.value = 3200
    const crackG = ctx.createGain()
    crackG.gain.value = 0.008
    crack.connect(crackF)
    crackF.connect(crackG)
    crackG.connect(master)
    crack.start()
  }

  voice(i: number, t: number, v: number): void {
    const fn = VOICES[i]
    if (fn) fn(this, t, clamp(v, 0.05, 1))
  }

  playPad(i: number, vel = 0.8): void {
    this.ensure()
    const ctx = this.ctx
    if (!ctx || i < 0 || i >= VOICES.length) return
    const v = clamp(vel, 0.05, 1)
    const t = ctx.currentTime
    this.voice(i, t, v)
    if (this.playing) {
      const dur = this.loopDur()
      let wrote = false
      for (let k = 0; k < this.capturing.length; k++) {
        if (!this.capturing[k]) continue
        const tr = this.tracks[k]
        if (!tr || tr.events.length >= MAX_EVENTS) continue
        let off = (t - this.loopStart) % dur
        if (off < 0) off += dur
        tr.events.push({ pad: i, t: off, vel: v })
        wrote = true
      }
      if (wrote) this.save()
    }
    this.lastHit = { pad: i, vel: v, n: this.lastHit.n + 1 }
    this.notify()
  }

  uiTick(): void {
    this.ensure()
    const ctx = this.ctx
    if (!ctx) return
    tone(this, ctx.currentTime, 0.5, 'triangle', 660, 660, 0.06, 0.12)
  }

  private click(t: number, beatIdx: number): void {
    const accent = beatIdx % 4 === 0
    tone(this, t, 1, 'sine', accent ? 2300 : 1600, accent ? 2300 : 1600, 0.05, accent ? 0.22 : 0.12)
  }

  private tick = (): void => {
    const ctx = this.ctx
    if (!ctx || !this.playing) return
    const ahead = ctx.currentTime + 0.15
    while (this.nextBeatTime < ahead) {
      if (this.metroOn) this.click(this.nextBeatTime, this.nextBeatIdx)
      this.nextBeatIdx += 1
      this.nextBeatTime += this.spb()
    }
    const dur = this.loopDur()
    for (const tr of this.tracks) {
      if (tr.muted || tr.events.length === 0) continue
      for (const ev of tr.events) {
        let k = Math.ceil((this.schedFrom - this.loopStart - ev.t) / dur)
        if (k < 0 || !Number.isFinite(k)) k = 0
        let occ = this.loopStart + k * dur + ev.t
        let guard = 0
        while (occ < ahead && guard < 8) {
          if (occ >= ctx.currentTime - 0.02) this.voice(ev.pad, occ, ev.vel)
          k += 1
          occ = this.loopStart + k * dur + ev.t
          guard += 1
        }
      }
    }
    this.schedFrom = ahead
    const beatNow = Math.floor((ctx.currentTime - this.loopStart) / this.spb())
    if (beatNow !== this.lastBeatNotified) {
      this.lastBeatNotified = beatNow
      this.notify()
    }
  }

  private resync(): void {
    if (!this.ctx || !this.playing) return
    const now = this.ctx.currentTime + 0.03
    this.loopStart = now
    this.nextBeatTime = now
    this.nextBeatIdx = 0
    this.schedFrom = now
    this.lastBeatNotified = -1
  }

  start(): void {
    this.ensure()
    if (!this.ctx || this.playing) return
    this.playing = true
    const t = this.ctx.currentTime + 0.08
    this.loopStart = t
    this.nextBeatTime = t
    this.nextBeatIdx = 0
    this.schedFrom = t
    this.lastBeatNotified = -1
    this.timer = window.setInterval(this.tick, 25)
    this.notify()
    this.save()
  }

  stop(): void {
    this.playing = false
    this.capturing = [false, false, false, false]
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.notify()
    this.save()
  }

  togglePlay(): void {
    if (this.playing) this.stop()
    else {
      this.uiTick()
      this.start()
    }
  }

  toggleCapture(i: number): void {
    if (i < 0 || i > 3) return
    this.ensure()
    if (!this.playing) this.start()
    this.capturing[i] = !this.capturing[i]
    if (!this.capturing[i]) this.save()
    this.notify()
  }

  clearTrack(i: number): void {
    const tr = this.tracks[i]
    if (!tr) return
    tr.events = []
    this.capturing[i] = false
    this.uiTick()
    this.notify()
    this.save()
  }

  clearAll(): void {
    for (const tr of this.tracks) tr.events = []
    this.uiTick()
    this.notify()
    this.save()
  }

  toggleMute(i: number): void {
    const tr = this.tracks[i]
    if (!tr) return
    tr.muted = !tr.muted
    this.uiTick()
    this.notify()
    this.save()
  }

  toggleMetro(): void {
    this.metroOn = !this.metroOn
    this.uiTick()
    this.notify()
    this.save()
  }

  setBpm(b: number): void {
    const nb = clamp(Math.round(b), 60, 180)
    if (nb === this.bpm) return
    this.bpm = nb
    this.tapGaps = []
    this.resync()
    this.notify()
    this.save()
  }

  setBars(b: number): void {
    if (b !== 1 && b !== 2 && b !== 4) return
    if (b === this.bars) return
    this.bars = b
    const dur = this.loopDur()
    for (const tr of this.tracks) {
      for (const ev of tr.events) ev.t = ev.t % dur
    }
    this.resync()
    this.notify()
    this.save()
  }

  tap(): void {
    this.ensure()
    const ctx = this.ctx
    if (!ctx) return
    const now = performance.now() / 1000
    if (this.lastTap > 0) {
      const gap = now - this.lastTap
      if (gap < 2 && gap > 0.2) {
        this.tapGaps.push(gap)
        if (this.tapGaps.length > 5) this.tapGaps.shift()
        const avg = this.tapGaps.reduce((a, b) => a + b, 0) / this.tapGaps.length
        const nb = clamp(Math.round(60 / avg), 60, 180)
        if (nb !== this.bpm) {
          this.bpm = nb
          this.resync()
          this.notify()
          this.save()
        }
      } else {
        this.tapGaps = []
      }
    }
    this.lastTap = now
    this.click(ctx.currentTime, 0)
  }

  setDelay(time: number, fb: number): void {
    this.delayTime = clamp(time, 0, 1)
    this.feedback = clamp(fb, 0, 0.85)
    if (this.delay) this.delay.delayTime.value = this.delayTime
    if (this.delayFb) this.delayFb.gain.value = this.feedback
    this.notify()
    this.save()
  }

  setFilter(cutoff: number, reso: number): void {
    this.cutoff = clamp(cutoff, 200, 12000)
    this.reso = clamp(reso, 0, 12)
    if (this.filter) {
      this.filter.frequency.value = this.cutoff
      this.filter.Q.value = this.reso
    }
    this.notify()
    this.save()
  }

  position(): { phase: number; beat: number } {
    const ctx = this.ctx
    if (!ctx || !this.playing) return { phase: 0, beat: 1 }
    const dur = this.loopDur()
    const el = ctx.currentTime - this.loopStart
    const mod = ((el % dur) + dur) % dur
    return { phase: mod / dur, beat: (el / this.spb()) % 1 }
  }

  private save(): void {
    try {
      const data: Persisted = {
        bpm: this.bpm,
        bars: this.bars,
        metroOn: this.metroOn,
        delayTime: this.delayTime,
        feedback: this.feedback,
        cutoff: this.cutoff,
        reso: this.reso,
        tracks: this.tracks.map((t) => ({ events: t.events.slice(0, MAX_EVENTS), muted: t.muted })),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable — session still works */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Partial<Persisted>
      if (typeof data.bpm === 'number') this.bpm = clamp(Math.round(data.bpm), 60, 180)
      if (data.bars === 1 || data.bars === 2 || data.bars === 4) this.bars = data.bars
      if (typeof data.metroOn === 'boolean') this.metroOn = data.metroOn
      if (typeof data.delayTime === 'number') this.delayTime = clamp(data.delayTime, 0, 1)
      if (typeof data.feedback === 'number') this.feedback = clamp(data.feedback, 0, 0.85)
      if (typeof data.cutoff === 'number') this.cutoff = clamp(data.cutoff, 200, 12000)
      if (typeof data.reso === 'number') this.reso = clamp(data.reso, 0, 12)
      if (Array.isArray(data.tracks)) {
        for (let i = 0; i < 4; i++) {
          const src = data.tracks[i]
          const dst = this.tracks[i]
          if (!src || !dst) continue
          dst.muted = src.muted === true
          dst.events = (Array.isArray(src.events) ? src.events : [])
            .filter((ev) => Number.isInteger(ev.pad) && ev.pad >= 0 && ev.pad < 16 && Number.isFinite(ev.t) && Number.isFinite(ev.vel))
            .map((ev) => ({ pad: ev.pad, t: Math.max(0, ev.t), vel: clamp(ev.vel, 0.05, 1) }))
            .slice(0, MAX_EVENTS)
        }
      }
    } catch {
      /* corrupt storage — start fresh */
    }
  }
}

export const engine = new LoopLabEngine()
