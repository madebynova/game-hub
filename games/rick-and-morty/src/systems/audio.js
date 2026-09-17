/**
 * Audio system.
 *
 * Everything here is synthesised with the Web Audio API — zero asset bytes, no
 * loading, no broken paths, and it works offline on a locked-down Chromebook.
 *
 * The important part for later phases is the SHAPE:
 *   audio.play('portal_open')        — id-addressed one-shots
 *   audio.ambience('flats')          — crossfaded looping beds
 *   audio.registerSample(id, url)    — drop in a real file and it wins over
 *                                      the generated version automatically
 * So replacing placeholder audio with recorded assets never touches call sites.
 */

const SFX = {
  // id: { type, freq, dur, ... }  consumed by _synth()
  ui_blip:      { kind: 'blip', f0: 620, f1: 880, dur: 0.07, gain: 0.16, wave: 'square' },
  ui_close:     { kind: 'blip', f0: 520, f1: 300, dur: 0.09, gain: 0.13, wave: 'square' },
  examine:      { kind: 'blip', f0: 380, f1: 520, dur: 0.1,  gain: 0.14, wave: 'triangle' },
  pickup:       { kind: 'arp',  notes: [660, 880, 1320], step: 0.055, dur: 0.1, gain: 0.16, wave: 'triangle' },
  discovery:    { kind: 'arp',  notes: [523, 659, 784, 1046], step: 0.085, dur: 0.22, gain: 0.18, wave: 'sine' },
  denied:       { kind: 'blip', f0: 220, f1: 120, dur: 0.16, gain: 0.16, wave: 'sawtooth' },
  research_start:{ kind: 'sweep', f0: 200, f1: 900, dur: 0.5, gain: 0.12, wave: 'sawtooth' },
  research_done:{ kind: 'arp',  notes: [440, 587, 880], step: 0.1, dur: 0.3, gain: 0.17, wave: 'sine' },
  portal_open:  { kind: 'portal', dur: 1.2, gain: 0.3 },
  portal_step:  { kind: 'whoosh', dur: 0.9, gain: 0.3 },
  memory:       { kind: 'memory', dur: 2.4, gain: 0.22 },
  unease:       { kind: 'drone', f0: 55, dur: 3.2, gain: 0.2 },
  glitch:       { kind: 'noiseburst', dur: 0.35, gain: 0.18 },
  door_locked:  { kind: 'blip', f0: 150, f1: 90, dur: 0.22, gain: 0.2, wave: 'square' },
};

/** Ambience beds: layered oscillators + filtered noise, built on demand. */
const BEDS = {
  garage: { noise: 0.035, noiseFreq: 420, drones: [{ f: 58, g: 0.05, wave: 'sine' }, { f: 87, g: 0.018, wave: 'triangle' }], lfo: 0.07 },
  flats:  { noise: 0.055, noiseFreq: 900, drones: [{ f: 74, g: 0.028, wave: 'sine' }, { f: 196, g: 0.012, wave: 'sine' }], lfo: 0.14 },
  unease: { noise: 0.02, noiseFreq: 200, drones: [{ f: 41, g: 0.06, wave: 'sine' }, { f: 43.5, g: 0.05, wave: 'sine' }], lfo: 0.05 },
  citadel:{ noise: 0.04, noiseFreq: 600, drones: [{ f: 65, g: 0.04, wave: 'triangle' }], lfo: 0.1 },
};

export class AudioSystem {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.bedGain = null;
    this.currentBed = null;
    this._bedNodes = null;
    /** id -> AudioBuffer, populated by registerSample() */
    this.samples = new Map();
    this._noiseBuffer = null;
    this.ready = false;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[audio] Web Audio unavailable'); return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.state.data.settings.muted ? 0 : this.state.data.settings.volume;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);

    this.bedGain = this.ctx.createGain();
    this.bedGain.gain.value = 0.85;
    this.bedGain.connect(this.master);

    this.ready = true;
    if (this.currentBed) this._startBed(this.currentBed);
  }

  setMuted(muted) {
    this.state.data.settings.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.state.data.settings.volume, this.ctx.currentTime, 0.05);
    }
    this.bus.emit('settings:changed', { muted });
  }

  toggleMute() { this.setMuted(!this.state.data.settings.muted); return this.state.data.settings.muted; }

  setVolume(v) {
    this.state.data.settings.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.state.data.settings.muted) {
      this.master.gain.setTargetAtTime(this.state.data.settings.volume, this.ctx.currentTime, 0.05);
    }
    this.bus.emit('settings:changed', { volume: v });
  }

  /**
   * Register a real audio file for an id. Once loaded it takes priority over
   * the synthesised version — this is the seam for swapping in real assets.
   */
  async registerSample(id, url) {
    if (!this.ctx) return false;
    try {
      const res = await fetch(url);
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this.samples.set(id, buf);
      return true;
    } catch (err) {
      console.warn(`[audio] sample "${id}" failed to load from ${url}`, err);
      return false;
    }
  }

  play(id, opts = {}) {
    if (!this.ready || !this.ctx) return;
    if (this.state.data.settings.muted) return;

    if (this.samples.has(id)) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.samples.get(id);
      const g = this.ctx.createGain();
      g.gain.value = opts.gain ?? 0.8;
      src.connect(g).connect(this.sfxGain);
      src.start();
      return;
    }

    const def = SFX[id];
    if (!def) { console.warn(`[audio] unknown sfx "${id}"`); return; }
    try { this._synth(def, opts); } catch (err) { console.warn('[audio] synth failed', err); }
  }

  // ── Ambience ────────────────────────────────────────────────────────────

  ambience(bedId) {
    if (this.currentBed === bedId) return;
    this.currentBed = bedId;
    if (!this.ready) return;
    this._stopBed();
    if (bedId) this._startBed(bedId);
  }

  _startBed(bedId) {
    const def = BEDS[bedId];
    if (!def || !this.ctx) return;
    const now = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + 2.2);
    out.connect(this.bedGain);

    const nodes = { out, sources: [] };

    // Filtered noise floor — the "room"
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noise();
    noise.loop = true;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = def.noiseFreq;
    const ng = this.ctx.createGain();
    ng.gain.value = def.noise;
    noise.connect(nf).connect(ng).connect(out);
    noise.start();
    nodes.sources.push(noise);

    // Drones — the "mood"
    for (const d of def.drones) {
      const osc = this.ctx.createOscillator();
      osc.type = d.wave ?? 'sine';
      osc.frequency.value = d.f;
      const g = this.ctx.createGain();
      g.gain.value = d.g;

      // Slow LFO on gain so the bed breathes instead of sitting flat.
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = def.lfo * (0.7 + Math.random() * 0.6);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = d.g * 0.5;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();

      osc.connect(g).connect(out);
      osc.start();
      nodes.sources.push(osc, lfo);
    }

    this._bedNodes = nodes;
  }

  _stopBed() {
    const nodes = this._bedNodes;
    if (!nodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    nodes.out.gain.cancelScheduledValues(now);
    nodes.out.gain.setValueAtTime(nodes.out.gain.value, now);
    nodes.out.gain.linearRampToValueAtTime(0, now + 0.8);
    for (const s of nodes.sources) { try { s.stop(now + 0.9); } catch { /* already stopped */ } }
    this._bedNodes = null;
  }

  // ── Synthesis ───────────────────────────────────────────────────────────

  _noise() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Brown-ish noise: softer and less fatiguing in headphones than white.
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    this._noiseBuffer = buf;
    return buf;
  }

  _env(gain, dur, peak = 1, attack = 0.008) {
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    return now;
  }

  _synth(def, opts) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(this.sfxGain);
    const vol = (def.gain ?? 0.15) * (opts.gain ?? 1);

    switch (def.kind) {
      case 'blip': {
        const osc = ctx.createOscillator();
        osc.type = def.wave ?? 'square';
        const now = this._env(g, def.dur, vol);
        osc.frequency.setValueAtTime(def.f0, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(def.f1, 1), now + def.dur);
        osc.connect(g);
        osc.start(now);
        osc.stop(now + def.dur + 0.02);
        break;
      }
      case 'sweep': {
        const osc = ctx.createOscillator();
        osc.type = def.wave ?? 'sawtooth';
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.Q.value = 6;
        const now = this._env(g, def.dur, vol, 0.04);
        osc.frequency.setValueAtTime(def.f0, now);
        osc.frequency.linearRampToValueAtTime(def.f1, now + def.dur);
        filt.frequency.setValueAtTime(def.f0 * 2, now);
        filt.frequency.linearRampToValueAtTime(def.f1 * 2, now + def.dur);
        osc.connect(filt).connect(g);
        osc.start(now);
        osc.stop(now + def.dur + 0.05);
        break;
      }
      case 'arp': {
        def.notes.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const ng = ctx.createGain();
          osc.type = def.wave ?? 'sine';
          const start = ctx.currentTime + i * def.step;
          ng.gain.setValueAtTime(0.0001, start);
          ng.gain.exponentialRampToValueAtTime(vol, start + 0.01);
          ng.gain.exponentialRampToValueAtTime(0.0001, start + def.dur);
          osc.frequency.value = f;
          osc.connect(ng).connect(this.sfxGain);
          osc.start(start);
          osc.stop(start + def.dur + 0.02);
        });
        break;
      }
      case 'portal': {
        // Rising shimmer + a wet slap at the end: the sound of a hole opening.
        const now = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const og = ctx.createGain();
          osc.type = i === 0 ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(90 + i * 40, now);
          osc.frequency.exponentialRampToValueAtTime(420 + i * 260, now + def.dur * 0.8);
          og.gain.setValueAtTime(0.0001, now);
          og.gain.exponentialRampToValueAtTime(vol * (0.6 - i * 0.15), now + 0.25);
          og.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
          osc.connect(og).connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + def.dur + 0.05);
        }
        const n = ctx.createBufferSource();
        n.buffer = this._noise();
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.setValueAtTime(300, now);
        nf.frequency.exponentialRampToValueAtTime(2600, now + def.dur);
        nf.Q.value = 2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.exponentialRampToValueAtTime(vol * 0.8, now + 0.3);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
        n.connect(nf).connect(ng).connect(this.sfxGain);
        n.start(now);
        n.stop(now + def.dur + 0.05);
        break;
      }
      case 'whoosh': {
        const now = ctx.currentTime;
        const n = ctx.createBufferSource();
        n.buffer = this._noise();
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.4;
        f.frequency.setValueAtTime(1800, now);
        f.frequency.exponentialRampToValueAtTime(140, now + def.dur);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.exponentialRampToValueAtTime(vol, now + 0.08);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
        n.connect(f).connect(ng).connect(this.sfxGain);
        n.start(now);
        n.stop(now + def.dur + 0.05);
        break;
      }
      case 'memory': {
        // Two detuned sines drifting apart — woozy, wrong, personal.
        const now = ctx.currentTime;
        [220, 223.5, 330].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const og = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          osc.frequency.linearRampToValueAtTime(f * (i === 2 ? 0.75 : 1.06), now + def.dur);
          og.gain.setValueAtTime(0.0001, now);
          og.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.5);
          og.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
          osc.connect(og).connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + def.dur + 0.05);
        });
        break;
      }
      case 'drone': {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = def.f0;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, now);
        og.gain.exponentialRampToValueAtTime(vol, now + 0.9);
        og.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
        osc.connect(og).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + def.dur + 0.05);
        break;
      }
      case 'noiseburst': {
        const now = ctx.currentTime;
        const n = ctx.createBufferSource();
        n.buffer = this._noise();
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 900;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + def.dur);
        n.connect(f).connect(ng).connect(this.sfxGain);
        n.start(now);
        n.stop(now + def.dur + 0.02);
        break;
      }
      default:
        console.warn('[audio] unhandled synth kind', def.kind);
    }
  }
}
