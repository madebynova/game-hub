import type { AmbienceMix } from './audioMix';

/** Seconds for ambience levels to glide to a new target — long, so zones blend rather than switch. */
const GLIDE = 0.9;

/**
 * The persistent soundscape: a handful of looping layers built once when audio unlocks.
 * Nothing is created per frame — only their levels and filters move.
 */
export class Ambience {
  private waves: GainNode;
  private bed: GainNode;
  private bedFilter: BiquadFilterNode;
  private drone: GainNode;
  private droneLow: OscillatorNode;
  private droneHigh: OscillatorNode;
  private enclosure: GainNode;

  constructor(private ctx: AudioContext, out: AudioNode, noise: AudioBuffer) {
    const loop = (offset: number) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.start(0, offset % noise.duration);
      return src;
    };
    const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (value: number) => {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    };
    /** Slow modulation: an LFO added onto an audio parameter. */
    const lfo = (rate: number, depth: number, target: AudioParam) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = rate;
      osc.connect(gain(depth)).connect(target);
      osc.start();
    };

    // On the boat: small waves lapping at the hull, swelling slowly.
    this.waves = gain(0);
    const swell = gain(0.6);
    lfo(0.16, 0.35, swell.gain);
    loop(0).connect(filter('lowpass', 700)).connect(swell).connect(this.waves).connect(out);

    // Underwater: water noise pushed through a heavy low-pass, breathing in and out.
    this.bed = gain(0);
    this.bedFilter = filter('lowpass', 900, 0.4);
    lfo(0.06, 70, this.bedFilter.frequency);
    loop(1.1).connect(this.bedFilter).connect(this.bed).connect(out);

    // Depth: two low tones a fifth apart, felt more than heard.
    this.drone = gain(0);
    const droneTone = filter('lowpass', 320);
    const droneBreath = gain(0.8);
    lfo(0.045, 0.2, droneBreath.gain);
    this.droneLow = ctx.createOscillator();
    this.droneLow.frequency.value = 64;
    this.droneHigh = ctx.createOscillator();
    this.droneHigh.type = 'triangle';
    this.droneHigh.frequency.value = 96;
    this.droneLow.connect(droneTone);
    this.droneHigh.connect(gain(0.3)).connect(droneTone);
    droneTone.connect(droneBreath).connect(this.drone).connect(out);
    this.droneLow.start();
    this.droneHigh.start();

    // Around and inside the wreck: a hollow, boxed-in resonance.
    this.enclosure = gain(0);
    loop(2.3).connect(filter('bandpass', 170, 4)).connect(this.enclosure).connect(out);
  }

  apply(mix: AmbienceMix) {
    const t = this.ctx.currentTime;
    this.waves.gain.setTargetAtTime(mix.waves, t, GLIDE);
    this.bed.gain.setTargetAtTime(mix.bed, t, GLIDE);
    this.bedFilter.frequency.setTargetAtTime(mix.bedCutoff, t, GLIDE);
    this.drone.gain.setTargetAtTime(mix.drone, t, GLIDE * 1.5);
    this.droneLow.frequency.setTargetAtTime(mix.droneFreq, t, GLIDE * 2);
    this.droneHigh.frequency.setTargetAtTime(mix.droneFreq * 1.5, t, GLIDE * 2);
    this.enclosure.gain.setTargetAtTime(mix.enclosure, t, GLIDE);
  }
}
