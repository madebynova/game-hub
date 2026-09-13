import type { Rarity } from '../data/treasures';
import { RARITIES } from '../data/treasures';
import { Ambience } from './ambience';
import {
  BUS_LEVELS, MASTER_LEVEL, SURFACE_ENV, ambienceMix, ambientEventRates, strokeInterval, warningInterval,
  type AudioBus, type AudioEnv,
} from './audioMix';
import type { OxygenStatus } from '../systems/oxygen';
import { damp, rand } from './math';

/** How often the ambience and muffle chase the diver's position (seconds). */
const ENV_UPDATE_SECONDS = 0.1;
const NOISE_SECONDS = 4;

interface ToneOptions {
  bus?: AudioBus;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
  /** Multiply the frequency by this over the note's length. */
  slide?: number;
  attack?: number;
  detune?: number;
  /** Optional low-pass cutoff for softer, rounder notes. */
  lowpass?: number;
}

interface NoiseOptions {
  bus?: AudioBus;
  vol?: number;
  delay?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency over the sound's length. */
  sweepTo?: number;
  q?: number;
  color?: 'white' | 'brown';
}

/**
 * The game's sound: synthesized with Web Audio, no asset files.
 *
 *  - Five buses (warning > discovery > sfx > ambience > ui) set the mix hierarchy.
 *  - Gameplay sounds run through a low-pass that closes underwater.
 *  - A persistent ambience (see ambience.ts) follows depth; sparse events add life.
 *  - The AudioContext is only created on the player's first interaction (autoplay rules).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<AudioBus, GainNode>> = {};
  private muffle: BiquadFilterNode | null = null;
  private duckGain: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private ambience: Ambience | null = null;
  private submerged = 0;
  private envTimer = 0;
  private warnTimer = 0.4;
  private warnStatus: OxygenStatus = 'ok';
  private strokeTimer = 0;
  private fadeLevel = 1;
  muted = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    this.master.connect(ctx.destination);
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.Q.value = 0.4;
    this.muffle.connect(this.master);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.master);
    for (const bus of Object.keys(BUS_LEVELS) as AudioBus[]) {
      const g = ctx.createGain();
      g.gain.value = BUS_LEVELS[bus];
      g.connect(bus === 'sfx' ? this.muffle : bus === 'ambience' ? this.duckGain : this.master);
      this.buses[bus] = g;
    }

    this.white = this.makeNoise('white');
    this.brown = this.makeNoise('brown');
    this.ambience = new Ambience(ctx, this.buses.ambience!, this.brown);

    // Browsers can suspend audio again (tab switches, mobile); resume on the next interaction.
    const resume = () => {
      if (ctx.state === 'suspended') void ctx.resume();
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) resume();
    });
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL * this.fadeLevel, this.ctx.currentTime, 0.05);
  }

  /** Once per frame: follow the diver with the ambience, strokes and oxygen warnings. */
  update(dt: number, env: AudioEnv = SURFACE_ENV) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.submerged = damp(this.submerged, env.submerged, env.submerged > this.submerged ? 4 : 6, dt);
    const heard: AudioEnv = { ...env, submerged: this.submerged };

    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = ENV_UPDATE_SECONDS;
      const mix = ambienceMix(heard);
      this.ambience?.apply(mix);
      const t = ctx.currentTime;
      this.muffle!.frequency.setTargetAtTime(mix.sfxCutoff, t, 0.12);
      this.fadeLevel = mix.master;
      if (!this.muted) this.master!.gain.setTargetAtTime(MASTER_LEVEL * mix.master, t, 0.3);
    }

    const rates = ambientEventRates(heard);
    if (Math.random() < rates.bubbles * dt) this.distantBubbles();
    if (Math.random() < rates.creaks * dt) this.distantCreak();
    if (Math.random() < rates.calls * dt) this.distantCall();

    this.swimStrokes(dt, env.swim);
    this.oxygenWarnings(dt, env);
  }

  // ------------------------------------------------------------------ building blocks

  private makeNoise(color: 'white' | 'brown') {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * NOISE_SECONDS;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    // Remove drift so the loop point is seamless.
    const drift = d[len - 1] - d[0];
    for (let i = 0; i < len; i++) d[i] -= (drift * i) / len;
    return buf;
  }

  private tone(freq: number, dur: number, o: ToneOptions = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const attack = o.attack ?? 0.012;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * o.slide, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.02));
    osc.connect(g);
    let tail: AudioNode = g;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      tail = g.connect(f);
    }
    tail.connect(this.buses[o.bus ?? 'sfx']!);
    osc.start(t0);
    osc.stop(t0 + Math.max(dur, attack) + 0.05);
  }

  private noise(dur: number, o: NoiseOptions = {}) {
    const ctx = this.ctx;
    const buf = o.color === 'brown' ? this.brown : this.white;
    if (!ctx || !buf) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const attack = o.attack ?? 0.005;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    f.Q.value = o.q ?? 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.02));
    src.connect(f).connect(g).connect(this.buses[o.bus ?? 'sfx']!);
    src.start(t0, Math.random() * Math.max(0, buf.duration - dur - 0.1));
    src.stop(t0 + dur + 0.05);
  }

  /** A struck bell: a few inharmonic partials with long decays. */
  private bell(freq: number, dur: number, vol: number, bus: AudioBus, delay = 0) {
    for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]]) {
      this.tone(freq * ratio, dur / Math.sqrt(ratio), { bus, vol: vol * amp, delay, attack: 0.004 });
    }
  }

  private bubbleBurst(count: number, vol: number, bus: AudioBus = 'sfx') {
    let delay = 0;
    for (let i = 0; i < count; i++) {
      this.tone(rand(600, 1300), 0.06, { bus, vol, slide: 1.8, delay });
      delay += rand(0.03, 0.07);
    }
  }

  /** Briefly lower the ambience under a big moment. */
  private duck(amount: number, seconds: number) {
    const ctx = this.ctx;
    const g = this.duckGain?.gain;
    if (!ctx || !g) return;
    const t = ctx.currentTime;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else g.cancelScheduledValues(t);
    g.setTargetAtTime(1 - amount, t, 0.08);
    g.setTargetAtTime(1, t + seconds, 0.6);
  }

  // ------------------------------------------------------------------ continuous behaviour

  private swimStrokes(dt: number, swim: number) {
    if (swim < 0.2 || this.submerged < 0.5) {
      this.strokeTimer = Math.min(this.strokeTimer, 0.15);
      return;
    }
    this.strokeTimer -= dt;
    if (this.strokeTimer > 0) return;
    this.strokeTimer = strokeInterval(swim);
    this.noise(0.4, { filter: 'lowpass', freq: 700, sweepTo: 260, attack: 0.1, vol: 0.05 + 0.07 * swim, color: 'brown' });
  }

  private oxygenWarnings(dt: number, env: AudioEnv) {
    const interval = warningInterval(env.oxygenStatus, env.oxygenFrac);
    if (interval === null) {
      this.warnTimer = 0.4;
      this.warnStatus = env.oxygenStatus;
      return;
    }
    // Escalating straight to critical shouldn't wait out the slower low-air cadence.
    if (env.oxygenStatus !== this.warnStatus) this.warnTimer = Math.min(this.warnTimer, 0.3);
    this.warnStatus = env.oxygenStatus;
    this.warnTimer -= dt;
    if (this.warnTimer > 0) return;
    this.warnTimer = interval;
    if (env.oxygenStatus === 'critical') {
      this.tone(880, 0.12, { bus: 'warning', type: 'triangle', vol: 0.13 });
      this.tone(880, 0.12, { bus: 'warning', type: 'triangle', vol: 0.13, delay: 0.17 });
      this.tone(110, 0.25, { bus: 'warning', vol: 0.16, slide: 0.7 });
    } else {
      this.tone(660, 0.22, { bus: 'warning', vol: 0.09, attack: 0.03 });
      this.tone(550, 0.3, { bus: 'warning', vol: 0.08, attack: 0.03, delay: 0.2 });
    }
  }

  private distantBubbles() {
    let delay = 0;
    for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) {
      this.tone(rand(420, 900), 0.08, { bus: 'ambience', vol: rand(0.03, 0.06), slide: 1.7, delay, lowpass: 1200 });
      delay += rand(0.05, 0.12);
    }
  }

  private distantCreak() {
    this.tone(rand(70, 120), rand(1, 1.8), { bus: 'ambience', type: 'sawtooth', vol: 0.05, slide: rand(0.75, 0.9), attack: 0.3, lowpass: 380 });
    this.noise(0.9, { bus: 'ambience', filter: 'bandpass', freq: rand(250, 450), q: 6, vol: 0.05, attack: 0.3, delay: 0.1, color: 'brown' });
  }

  /** A far-off, low call from somewhere in the dark. */
  private distantCall() {
    const f = rand(78, 104);
    const d = rand(2.4, 3.4);
    this.tone(f, d, { bus: 'ambience', vol: 0.12, slide: 0.72, attack: 0.9, lowpass: 420 });
    this.tone(f * 1.5, d * 0.8, { bus: 'ambience', type: 'triangle', vol: 0.03, slide: 0.7, attack: 1.1, lowpass: 520, delay: 0.2 });
  }

  // ------------------------------------------------------------------ diving

  splash() {
    this.noise(0.45, { filter: 'highpass', freq: 1200, vol: 0.35 });
    this.noise(0.6, { filter: 'lowpass', freq: 900, sweepTo: 200, vol: 0.4, delay: 0.03, color: 'brown' });
    this.bubbleBurst(6, 0.05);
  }

  /** Slipping under the surface: the world goes muffled. */
  submerge() {
    this.noise(0.7, { filter: 'lowpass', freq: 1600, sweepTo: 220, attack: 0.05, vol: 0.22, color: 'brown' });
    this.bubbleBurst(5, 0.04);
  }

  /** Breaking the surface, then a breath of air. */
  surface() {
    this.noise(0.35, { filter: 'lowpass', freq: 300, sweepTo: 2800, attack: 0.03, vol: 0.25 });
    this.noise(0.5, { filter: 'bandpass', freq: 1700, q: 0.6, attack: 0.12, vol: 0.08, delay: 0.25 });
  }

  /** Coming round on the boat after a blackout. */
  gasp() {
    this.noise(0.55, { filter: 'bandpass', freq: 1500, q: 0.8, attack: 0.08, vol: 0.14 });
  }

  /** Climbing the stern ladder: two rung clunks and a drip. */
  boardBoat() {
    for (const delay of [0, 0.18]) {
      this.tone(190, 0.12, { type: 'triangle', vol: 0.14, slide: 0.8, delay });
      this.noise(0.05, { filter: 'bandpass', freq: 900, q: 4, vol: 0.12, delay });
    }
    this.tone(rand(1300, 1600), 0.06, { vol: 0.04, slide: 1.6, delay: 0.42 });
  }

  bubble() {
    this.tone(rand(550, 950), 0.07, { vol: 0.03, slide: 1.9 });
  }

  airPocket() {
    this.noise(0.25, { filter: 'bandpass', freq: 2600, vol: 0.1 });
    this.bubbleBurst(2, 0.035);
  }

  heartbeat() {
    this.tone(62, 0.18, { bus: 'warning', vol: 0.45, slide: 0.6 });
    this.tone(55, 0.2, { bus: 'warning', vol: 0.32, slide: 0.6, delay: 0.22 });
  }

  blackout() {
    this.tone(180, 2, { bus: 'warning', vol: 0.22, slide: 0.25, attack: 0.05 });
    this.noise(2, { bus: 'warning', filter: 'lowpass', freq: 400, sweepTo: 80, attack: 0.6, vol: 0.15, color: 'brown' });
  }

  // ------------------------------------------------------------------ treasure

  /** A soft underwater clink. Rare and better finds layer `discovery` on top. */
  pickup(rarity: Rarity) {
    const tier = RARITIES[rarity].tier;
    const base = 1175 + Math.min(tier, 2) * 90;
    this.tone(base, 0.18, { type: 'triangle', vol: 0.14 });
    this.tone(base * 2, 0.12, { vol: 0.05, delay: 0.015 });
    if (tier === 1) this.tone(base * 1.5, 0.22, { type: 'triangle', vol: 0.1, delay: 0.07 });
    this.bubbleBurst(3, 0.03);
  }

  pryTick() {
    this.noise(0.06, { filter: 'bandpass', freq: rand(900, 1300), q: 2, vol: 0.05 });
  }

  /** Discovery sting, timed with the discovery freeze: shimmer, bell, then boom and chord. */
  discovery(tier: number) {
    const bus: AudioBus = 'discovery';
    this.duck(0.35, 1.5 + tier * 0.6);
    if (tier <= 2) {
      [1319, 1661, 1976, 2637].forEach((f, i) => this.tone(f, 0.5, { bus, type: 'triangle', vol: 0.07, delay: i * 0.05 }));
      this.bell(1319, 1.4, 0.1, bus, 0.22);
      return;
    }
    if (tier === 3) {
      this.tone(196, 2.4, { bus, vol: 0.16, attack: 0.35 });
      this.tone(294, 2.2, { bus, vol: 0.07, attack: 0.45 });
      this.bell(784, 2.6, 0.16, bus);
      [1175, 1568, 1976, 2349].forEach((f, i) => this.tone(f, 0.6, { bus, type: 'triangle', vol: 0.05, delay: 0.18 + i * 0.06 }));
      return;
    }
    this.tone(72, 1.6, { bus, vol: 0.35, slide: 0.55, attack: 0.01 });
    for (const f of [220, 277.2, 329.6, 440]) {
      for (let v = 0; v < 2; v++) this.tone(f, 3.2, { bus, type: 'sawtooth', vol: 0.022, attack: 0.6, detune: rand(-8, 8), lowpass: 1400 });
    }
    [880, 1109, 1319, 1760, 2217].forEach((f, i) => this.bell(f, 1.8, 0.09, bus, 0.25 + i * 0.11));
  }

  satchelRecovered() {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, { bus: 'discovery', type: 'triangle', vol: 0.09, delay: i * 0.06 }));
    this.bubbleBurst(6, 0.04);
  }

  /** First find of a treasure type — a quiet note for the treasure log. */
  newDiscovery() {
    this.tone(1760, 0.12, { bus: 'ui', vol: 0.1, delay: 0.3 });
    this.tone(2349, 0.2, { bus: 'ui', vol: 0.1, delay: 0.38 });
  }

  // ------------------------------------------------------------------ world

  /** A soft swell as a new zone opens up — brighter at the reef, darker below. */
  zoneEnter(rank: number) {
    const [root, fifth] = ([[392, 587], [196, 233], [98, 147]] as const)[Math.min(rank, 2)];
    this.tone(root, 2.6, { bus: 'ambience', vol: 0.25, attack: 0.7 });
    this.tone(fifth, 2.4, { bus: 'ambience', vol: 0.14, attack: 0.9, delay: 0.15 });
    if (rank >= 2) this.tone(root / 2, 3, { bus: 'ambience', vol: 0.2, attack: 1 });
  }

  /** Unstable wreckage groaning before it falls. */
  rumble() {
    this.noise(1.2, { filter: 'lowpass', freq: 180, attack: 0.2, vol: 0.6, color: 'brown' });
    this.tone(rand(90, 130), 0.8, { type: 'sawtooth', vol: 0.03, slide: 0.8, attack: 0.15, lowpass: 500 });
  }

  debris() {
    this.noise(0.7, { filter: 'lowpass', freq: 500, sweepTo: 150, vol: 0.8, color: 'brown' });
    this.noise(0.4, { filter: 'bandpass', freq: 1400, vol: 0.2, delay: 0.08 });
    this.tone(70, 0.5, { vol: 0.35, slide: 0.5 });
  }

  pressureGroan() {
    this.tone(rand(55, 70), 2.2, { bus: 'ambience', vol: 0.25, slide: 0.85, attack: 0.5 });
    this.tone(82, 2, { bus: 'ambience', type: 'triangle', vol: 0.08, slide: 0.9, attack: 0.7, lowpass: 300 });
  }

  // ------------------------------------------------------------------ boat & UI

  sell(itemCount: number) {
    const n = Math.min(8, Math.max(3, itemCount));
    for (let i = 0; i < n; i++) this.tone(1400 + i * 110 + rand(-20, 20), 0.07, { type: 'triangle', vol: 0.05, delay: i * 0.05 });
    this.tone(2093, 0.45, { type: 'triangle', vol: 0.12, delay: n * 0.05 });
    this.noise(0.25, { filter: 'highpass', freq: 5000, vol: 0.04, delay: n * 0.05 });
  }

  /** A ratchet of fittings, then a rising chime. */
  upgrade() {
    for (let i = 0; i < 3; i++) this.noise(0.03, { filter: 'bandpass', freq: 2200, q: 3, vol: 0.08, delay: i * 0.05 });
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: 0.16 + i * 0.07 }));
  }

  objective() {
    [784, 1175].forEach((f, i) => this.tone(f, 0.25, { bus: 'ui', type: 'triangle', vol: 0.18, delay: i * 0.09 }));
  }

  /** Can't do that — a soft, low thud rather than a buzzer. */
  deny() {
    this.tone(150, 0.16, { bus: 'ui', vol: 0.16, slide: 0.7 });
    this.noise(0.08, { bus: 'ui', filter: 'lowpass', freq: 400, vol: 0.1 });
  }

  /** Opening or closing a panel: a short wooden clack. */
  panel(open: boolean) {
    this.noise(0.07, { bus: 'ui', filter: 'bandpass', freq: open ? 1400 : 1000, q: 3, vol: 0.12 });
    this.tone(open ? 520 : 420, 0.08, { bus: 'ui', type: 'triangle', vol: 0.06, delay: 0.01 });
  }
}
