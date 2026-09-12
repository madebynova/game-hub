/**
 * All sound is synthesised with WebAudio — no audio files.
 *
 * That keeps the production build a single small HTML file, and means the
 * doorbell can be retuned by editing numbers instead of re-recording anything.
 */

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  muted = false;

  /** Browsers block audio until a gesture, so this is called from input. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return; // No audio available; the game stays perfectly playable.
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    volume: number,
    wave: Wave = 'sine',
    endFreq?: number,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, volume: number, filterHz: number, sweepTo?: number): void {
    if (!this.ctx || !this.master || this.muted) return;

    if (!this.noiseBuffer) {
      const length = Math.floor(this.ctx.sampleRate * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterHz, start);
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  /** The sound the whole game is named after. Two-tone chime, high then low. */
  dingDong(): void {
    const t = this.now;
    // "Ding" — E5 with a soft octave shimmer.
    this.tone(659.25, t, 0.55, 0.32, 'sine');
    this.tone(1318.5, t, 0.35, 0.08, 'sine');
    // "Dong" — C5, a beat later.
    this.tone(523.25, t + 0.34, 0.85, 0.32, 'sine');
    this.tone(1046.5, t + 0.34, 0.5, 0.07, 'sine');
  }

  /** Muffled footsteps crossing a hallway — the first "they heard it" cue. */
  approach(): void {
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      this.noise(t + i * 0.14, 0.07, 0.09, 190, 110);
    }
  }

  /** A deadbolt turning. The last warning before the door comes open. */
  latch(): void {
    const t = this.now;
    this.tone(1200, t, 0.05, 0.12, 'square', 700);
    this.noise(t + 0.04, 0.09, 0.14, 2600, 1100);
  }

  doorSlam(): void {
    const t = this.now;
    this.noise(t, 0.22, 0.5, 220, 70);
    this.tone(90, t, 0.2, 0.35, 'square', 40);
  }

  bark(): void {
    const t = this.now;
    this.tone(320, t, 0.11, 0.3, 'sawtooth', 150);
    this.tone(300, t + 0.15, 0.1, 0.24, 'sawtooth', 140);
    this.noise(t, 0.1, 0.14, 900);
  }

  shout(): void {
    const t = this.now;
    this.tone(200, t, 0.28, 0.26, 'sawtooth', 320);
    this.noise(t, 0.2, 0.1, 700, 1400);
  }

  footstep(): void {
    this.noise(this.now, 0.06, 0.07, 500, 200);
  }

  cash(): void {
    const t = this.now;
    // Rising arpeggio: this is the "you got away with it" payoff.
    this.tone(784, t, 0.14, 0.2, 'triangle');
    this.tone(988, t + 0.08, 0.14, 0.2, 'triangle');
    this.tone(1319, t + 0.16, 0.34, 0.22, 'triangle');
  }

  /** Sharp stab the instant somebody lays eyes on you. */
  spotted(): void {
    const t = this.now;
    this.tone(880, t, 0.14, 0.2, 'square', 620);
    this.tone(587, t + 0.1, 0.22, 0.16, 'square', 440);
  }

  /** The exhale when the last person hunting you gives up. */
  allClear(): void {
    const t = this.now;
    this.tone(523, t, 0.26, 0.12, 'sine');
    this.tone(784, t + 0.12, 0.4, 0.12, 'sine');
  }

  /** A gasp of air and you're going again. */
  secondWind(): void {
    const t = this.now;
    this.noise(t, 0.3, 0.12, 420, 1500);
    this.tone(392, t + 0.05, 0.3, 0.14, 'triangle', 587);
  }

  /** Rustle of getting over a hedge. */
  vault(): void {
    this.noise(this.now, 0.22, 0.16, 2200, 700);
  }

  caught(): void {
    const t = this.now;
    this.tone(300, t, 0.5, 0.3, 'sawtooth', 60);
    this.noise(t, 0.4, 0.3, 400, 90);
  }

  extract(): void {
    const t = this.now;
    this.tone(392, t, 0.2, 0.22, 'triangle');
    this.tone(523, t + 0.13, 0.2, 0.22, 'triangle');
    this.tone(659, t + 0.26, 0.2, 0.22, 'triangle');
    this.tone(784, t + 0.39, 0.6, 0.26, 'triangle');
  }

  alarm(): void {
    const t = this.now;
    for (let i = 0; i < 3; i++) {
      this.tone(880, t + i * 0.24, 0.12, 0.18, 'square');
      this.tone(660, t + i * 0.24 + 0.12, 0.12, 0.18, 'square');
    }
  }

  carHorn(): void {
    const t = this.now;
    this.tone(330, t, 0.45, 0.22, 'sawtooth');
    this.tone(415, t, 0.45, 0.18, 'sawtooth');
  }

  blip(): void {
    this.tone(660, this.now, 0.07, 0.12, 'square');
  }

  thud(): void {
    const t = this.now;
    this.tone(140, t, 0.16, 0.22, 'sine', 60);
  }

  /** Pitch rises with heat — the neighbourhood tightening around you. */
  heatSting(intensity: number): void {
    const t = this.now;
    this.tone(160 + intensity * 200, t, 0.5, 0.16, 'sawtooth', 90 + intensity * 80);
  }
}

export const audio = new AudioEngine();
