// All sound is synthesised — no audio files, no network. Singleton, unlocked on first gesture.

type Ctx = AudioContext

class Sound {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  muted = false

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02)
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.25, to?: number, delay = 0) {
    const ctx = this.unlock()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noise(dur: number, gain = 0.2, hz = 2200, q = 0.8, delay = 0) {
    const ctx = this.unlock()
    if (!ctx || !this.master) return
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.5)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
    }
    const t0 = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = hz
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  /** koto-ish pluck; the step climbs a pentatonic scale as the chain grows */
  slice(step: number) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880]
    const f = scale[step % 5] * (Math.floor(step / 5) % 2 === 0 ? 1 : 2)
    this.tone(f, 0.22, 'triangle', 0.22)
    this.tone(f * 2, 0.1, 'sine', 0.08, undefined, 0.005)
    this.noise(0.07, 0.1, 3200, 1.4)
  }

  perfect() {
    this.tone(1568, 0.28, 'sine', 0.14)
    this.tone(2093, 0.36, 'sine', 0.1, undefined, 0.04)
    this.noise(0.12, 0.12, 5200, 2)
  }

  whiff() {
    this.noise(0.1, 0.1, 900, 0.7)
    this.tone(140, 0.09, 'sawtooth', 0.05, 90)
  }

  miss() {
    this.tone(126, 0.5, 'sine', 0.3, 54)
    this.noise(0.26, 0.16, 520, 0.6)
    this.tone(392, 0.9, 'sine', 0.07, 380)
  }

  sutra() {
    ;[659.25, 783.99, 987.77, 1174.66].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.16, undefined, i * 0.07))
  }

  begin() {
    this.tone(220, 0.3, 'sine', 0.18)
    this.tone(330, 0.34, 'triangle', 0.14, undefined, 0.1)
    this.tone(440, 0.5, 'sine', 0.12, undefined, 0.2)
  }

  end() {
    this.tone(523.25, 1.6, 'sine', 0.2)
    this.tone(784, 1.8, 'sine', 0.12, undefined, 0.08)
    this.tone(1046.5, 2.2, 'sine', 0.06, undefined, 0.16)
  }

  tick() {
    this.tone(1760, 0.035, 'square', 0.035)
  }
}

export const sound = new Sound()
