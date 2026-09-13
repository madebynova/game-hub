import type { Rarity } from '../data/treasures';
import { RARITIES } from '../data/treasures';

/**
 * Tiny synthesized sound kit using WebAudio — no asset files needed.
 * The AudioContext is created lazily on the first user gesture (browser autoplay rules).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** 0 = on the boat, 1 = deep underwater. */
  setUnderwater(amount: number) {
    if (!this.ctx || !this.ambientGain || !this.ambientFilter) return;
    const t = this.ctx.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.05 + amount * 0.22, t, 0.4);
    this.ambientFilter.frequency.setTargetAtTime(900 - amount * 620, t, 0.4);
  }

  private startAmbient() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.ambientFilter = ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 900;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    src.connect(this.ambientFilter).connect(this.ambientGain).connect(this.master!);
    src.start();
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, freq: number, vol: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  pickup(rarity: Rarity) {
    const tier = RARITIES[rarity].tier;
    const notes = [880, 1108, 1318, 1760, 2217];
    for (let i = 0; i <= tier; i++) this.tone(notes[i], 0.22 + tier * 0.05, { type: 'triangle', vol: 0.16, delay: i * 0.07 });
    if (tier >= 3) this.tone(440, 0.9, { type: 'sine', vol: 0.12, delay: 0.05 });
  }

  pryTick() {
    this.tone(220 + Math.random() * 60, 0.05, { type: 'square', vol: 0.03 });
  }

  sell(itemCount: number) {
    const n = Math.min(8, Math.max(3, itemCount));
    for (let i = 0; i < n; i++) this.tone(1400 + i * 120, 0.08, { type: 'square', vol: 0.05, delay: i * 0.055 });
    this.tone(2093, 0.5, { type: 'triangle', vol: 0.18, delay: n * 0.055 });
  }

  upgrade() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.08 }));
  }

  deny() {
    this.tone(180, 0.18, { type: 'square', vol: 0.06, slide: 0.7 });
  }

  warn(critical: boolean) {
    this.tone(critical ? 988 : 740, 0.12, { type: 'sine', vol: critical ? 0.14 : 0.09 });
    if (critical) this.tone(988, 0.12, { type: 'sine', vol: 0.14, delay: 0.16 });
  }

  heartbeat() {
    this.tone(60, 0.18, { type: 'sine', vol: 0.4, slide: 0.6 });
    this.tone(55, 0.18, { type: 'sine', vol: 0.3, slide: 0.6, delay: 0.22 });
  }

  splash() {
    this.noise(0.5, 900, 0.5);
    this.noise(0.3, 2400, 0.2, 0.05);
  }

  breathe() {
    this.noise(0.6, 1500, 0.25);
  }

  bubble() {
    this.tone(500 + Math.random() * 500, 0.06, { type: 'sine', vol: 0.025, slide: 1.8 });
  }

  blackout() {
    this.tone(220, 1.6, { type: 'sine', vol: 0.25, slide: 0.3 });
  }

  /** Discovery sting for rare+ finds: shimmer (rare), bell chord (very rare), full swell (legendary). */
  discovery(tier: number) {
    const chord = tier >= 4 ? [523, 659, 784, 988, 1318] : tier === 3 ? [587, 740, 880, 1175] : [659, 988, 1318];
    chord.forEach((f, i) => this.tone(f, 0.9 + tier * 0.25, { type: 'triangle', vol: 0.09, delay: i * (tier >= 4 ? 0.09 : 0.06) }));
    if (tier >= 3) this.tone(tier >= 4 ? 131 : 196, 1.6, { type: 'sine', vol: 0.18, delay: 0.02 });
    if (tier >= 4) {
      [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.05, delay: 0.5 + i * 0.12 }));
    }
  }

  newDiscovery() {
    this.tone(1760, 0.12, { type: 'sine', vol: 0.06, delay: 0.25 });
    this.tone(2349, 0.2, { type: 'sine', vol: 0.06, delay: 0.33 });
  }

  zoneEnter(rank: number) {
    const base = [392, 294, 196][rank] ?? 196;
    this.tone(base, 1.8, { type: 'sine', vol: 0.16 });
    this.tone(base * 1.5, 1.6, { type: 'sine', vol: 0.07, delay: 0.25 });
  }

  creak() {
    this.tone(90 + Math.random() * 40, 0.7, { type: 'sawtooth', vol: 0.025, slide: 0.8 });
  }

  rumble() {
    this.noise(1.2, 120, 0.6);
    this.creak();
  }

  debris() {
    this.noise(0.7, 300, 0.9);
    this.noise(0.4, 1400, 0.25, 0.08);
    this.tone(70, 0.5, { type: 'sine', vol: 0.35, slide: 0.5 });
  }

  airPocket() {
    this.noise(0.25, 2600, 0.12);
    this.tone(700 + Math.random() * 300, 0.1, { type: 'sine', vol: 0.03, slide: 1.6 });
  }

  pressureGroan() {
    this.tone(55 + Math.random() * 15, 2.2, { type: 'sine', vol: 0.12, slide: 0.85 });
  }

  objective() {
    [784, 1175].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.09 }));
  }

  click() {
    this.tone(1200, 0.04, { type: 'triangle', vol: 0.05 });
  }
}
