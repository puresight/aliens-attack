// Retro arcade sound synthesis using the native Web Audio API. No audio files.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    freqEnd: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, filterStart: number, filterEnd: number, gain: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const len = Math.floor(ctx.sampleRate * 0.7);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterStart, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  laser(): void {
    // classic earth-shooter: snappy square-wave downward pitch sweep
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.14);
    g.gain.setValueAtTime(0.3, t0);
    g.gain.setValueAtTime(0.3, t0 + 0.04);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  alienLaser(): void {
    this.tone(320, 90, 0.18, 'square', 0.05);
  }

  march(note: number): void {
    // 4-note descending bass loop: D2, A1, Ab1, G1
    const freqs = [58.7, 55.0, 51.9, 49.0];
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freqs[note % freqs.length], t0);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t0);
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  explosion(big = false): void {
    this.noise(big ? 0.6 : 0.3, big ? 900 : 1400, big ? 60 : 120, big ? 0.3 : 0.18);
    this.tone(big ? 110 : 200, 40, big ? 0.4 : 0.2, 'sine', 0.15);
  }

  barrierHit(): void {
    this.tone(240, 80, 0.08, 'triangle', 0.09);
  }

  playerHit(): void {
    this.noise(0.7, 1000, 50, 0.35);
    this.tone(300, 40, 0.6, 'sawtooth', 0.2);
  }

  waveClear(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.09, i * 0.09));
  }

  gameOver(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, f * 0.98, 0.3, 'triangle', 0.12, i * 0.2));
    this.noise(1.0, 600, 40, 0.2);
  }

  uiClick(): void {
    this.tone(660, 660, 0.05, 'square', 0.06);
  }
}
