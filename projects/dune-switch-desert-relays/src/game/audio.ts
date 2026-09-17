/** Tiny WebAudio synth — engine hum, SFX, retro arp. No assets. */
export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private arpTimer: number | null = null;
  private arpStep = 0;
  muted = false;

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    // engine hum
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(lp);
    lp.connect(this.master);
    this.engineOsc.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  /** speed 0..1 → engine pitch + level */
  engine(on: boolean, speed01: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 90, t, 0.1);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pickup(): void {
    this.blip(880 + Math.random() * 120, 0.12, 'square', 0.12, 660);
  }
  crash(): void {
    this.blip(160, 0.35, 'sawtooth', 0.22, -120);
    this.blip(70, 0.4, 'square', 0.15, -30);
  }
  whoosh(): void {
    this.blip(300, 0.25, 'sine', 0.16, 900);
  }
  gate(): void {
    this.blip(523, 0.14, 'triangle', 0.16);
    window.setTimeout(() => this.blip(784, 0.2, 'triangle', 0.16), 90);
  }
  miss(): void {
    this.blip(220, 0.2, 'triangle', 0.1, -80);
  }
  bonk(): void {
    this.blip(140, 0.5, 'sawtooth', 0.18, -60);
  }

  startArp(): void {
    if (!this.ctx || this.arpTimer !== null) return;
    const scale = [110, 130.8, 164.8, 196, 220, 196, 164.8, 130.8];
    this.arpTimer = window.setInterval(() => {
      if (this.muted) return;
      const f = scale[this.arpStep % scale.length] as number;
      this.blip(f, 0.22, 'triangle', 0.05);
      this.arpStep += 1;
    }, 240);
  }

  stopArp(): void {
    if (this.arpTimer !== null) {
      window.clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
  }

  dispose(): void {
    this.stopArp();
    try {
      this.engineOsc?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
