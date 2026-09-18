/* Procedural audio. Every sound is synthesised at runtime, so the game stays a
   handful of text files with no binary assets to load or host.

   Two layers:
     - an ambient bed (filtered noise "wind", a water layer that swells near the
       pool, and sparse birdcall-ish chirps)
     - one-shot effects for footsteps, splashes, harvesting and unlocks. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var ctx = null;
  var master = null;
  var ambientGain = null;
  var windGain = null;
  var waterGain = null;
  var started = false;
  var muted = false;
  var chirpTimer = 3;

  function noiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function now() { return ctx.currentTime; }

  var Audio = {
    get muted() { return muted; },

    /* Must be called from a user gesture (the title screen buttons). */
    start: function () {
      if (started) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch (e) {
        return;
      }
      started = true;

      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 1;
      ambientGain.connect(master);

      // Wind: looping noise through a slowly-wobbling low-pass.
      var wind = ctx.createBufferSource();
      wind.buffer = noiseBuffer(4);
      wind.loop = true;
      var windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0.05;
      wind.connect(windFilter).connect(windGain).connect(ambientGain);
      wind.start();

      // Very slow LFO on the filter so the bed breathes instead of hissing.
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain).connect(windFilter.frequency);
      lfo.start();

      // Water: brighter band-passed noise, gated by proximity to the pool.
      var water = ctx.createBufferSource();
      water.buffer = noiseBuffer(4);
      water.loop = true;
      var waterFilter = ctx.createBiquadFilter();
      waterFilter.type = 'bandpass';
      waterFilter.frequency.value = 1500;
      waterFilter.Q.value = 0.8;
      waterGain = ctx.createGain();
      waterGain.gain.value = 0;
      water.connect(waterFilter).connect(waterGain).connect(ambientGain);
      water.start();
    },

    resume: function () {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },

    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, now(), 0.05);
    },

    /* nearness: 0 far from water, 1 standing in it. */
    setWaterProximity: function (nearness) {
      if (!waterGain) return;
      waterGain.gain.setTargetAtTime(0.075 * U.clamp(nearness, 0, 1), now(), 0.35);
    },

    update: function (dt) {
      if (!ctx || muted) return;
      chirpTimer -= dt;
      if (chirpTimer <= 0) {
        chirpTimer = U.range(Math.random, 3.5, 11);
        this.chirp();
      }
    },

    /* --- one-shots ---------------------------------------------------- */

    tone: function (freq, dur, type, vol, attack) {
      if (!ctx || muted) return;
      var t = now();
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + (attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    sweep: function (f0, f1, dur, type, vol) {
      if (!ctx || muted) return;
      var t = now();
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    burst: function (dur, freq, q, vol) {
      if (!ctx || muted) return;
      var t = now();
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer(Math.max(0.12, dur));
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(freq, t);
      f.Q.value = q;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    },

    step: function (inWater) {
      if (inWater) this.burst(0.13, 900 + Math.random() * 500, 1.1, 0.055);
      else this.burst(0.07, 260 + Math.random() * 180, 1.6, 0.035);
    },

    splash: function (big) {
      this.burst(big ? 0.42 : 0.24, big ? 1100 : 1500, 0.7, big ? 0.16 : 0.09);
      this.sweep(big ? 620 : 820, 240, 0.22, 'sine', 0.05);
    },

    leap: function () {
      this.sweep(320, 720, 0.19, 'triangle', 0.075);
      this.burst(0.1, 500, 1.4, 0.04);
    },

    land: function () {
      this.burst(0.16, 180, 1.2, 0.08);
      this.tone(110, 0.14, 'sine', 0.06);
    },

    harvestTick: function (progress) {
      this.burst(0.05, 700 + progress * 900, 2.4, 0.03);
    },

    harvest: function () {
      this.sweep(520, 980, 0.16, 'triangle', 0.07);
      this.burst(0.12, 1800, 1.2, 0.045);
    },

    blocked: function () {
      this.tone(150, 0.16, 'square', 0.028);
      this.tone(112, 0.2, 'sine', 0.03);
    },

    discovery: function () {
      var self = this;
      [660, 880, 1174].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 0.5, 'sine', 0.062); }, i * 95);
      });
    },

    unlock: function () {
      var self = this;
      var notes = [392, 523, 659, 784, 1046];
      notes.forEach(function (f, i) {
        setTimeout(function () {
          self.tone(f, 1.1, 'sine', 0.075);
          self.tone(f * 2, 0.7, 'triangle', 0.022);
        }, i * 135);
      });
      setTimeout(function () { self.burst(1.4, 2400, 0.5, 0.05); }, 140);
    },

    chirp: function () {
      var base = 1500 + Math.random() * 1400;
      var n = 2 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        (function (i) {
          setTimeout(function () {
            Audio.sweep(base, base * (1 + Math.random() * 0.5), 0.07, 'sine', 0.016);
          }, i * (55 + Math.random() * 60));
        })(i);
      }
    },

    ui: function () { this.tone(720, 0.07, 'sine', 0.03); }
  };

  EVO.Audio = Audio;
})(window.EVO);
