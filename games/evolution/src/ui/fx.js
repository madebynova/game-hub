/* Feedback: particles, expanding rings, floating text and toasts.

   Small, cheap, and used everywhere - a footstep puff, a splash, spores, the
   burst when a node comes free. Most of the "this feels like a game" budget
   goes here rather than into extra content. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var parts = [];
  var rings = [];
  var floats = [];

  var FX = {
    particles: parts,
    rings: rings,
    floats: floats,

    clear: function () {
      parts.length = 0;
      rings.length = 0;
      floats.length = 0;
    },

    burst: function (x, y, opts) {
      var n = opts.count || 8;
      for (var i = 0; i < n; i++) {
        var a = opts.angle !== undefined
          ? opts.angle + U.range(Math.random, -(opts.spread || 0.6), (opts.spread || 0.6))
          : Math.random() * 6.2832;
        var sp = U.range(Math.random, opts.speedMin || 20, opts.speedMax || 70);
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          vz: opts.lift ? U.range(Math.random, opts.lift * 0.4, opts.lift) : 0,
          z: opts.z0 || 0,
          life: 0,
          max: U.range(Math.random, opts.lifeMin || 0.4, opts.lifeMax || 0.9),
          r: U.range(Math.random, opts.rMin || 1.4, opts.rMax || 3.4),
          colour: opts.colour || '#ffffff',
          gravity: opts.gravity === undefined ? 90 : opts.gravity,
          drag: opts.drag === undefined ? 2.4 : opts.drag,
          shape: opts.shape || 'dot',
          spin: U.range(Math.random, -6, 6),
          rot: Math.random() * 6.28,
          fade: opts.fade === undefined ? 1 : opts.fade
        });
      }
    },

    ring: function (x, y, opts) {
      rings.push({
        x: x, y: y,
        life: 0,
        max: opts.duration || 0.6,
        r0: opts.r0 || 4,
        r1: opts.r1 || 50,
        colour: opts.colour || 'rgba(255,255,255,0.7)',
        width: opts.width || 2,
        squash: opts.squash || 0.55
      });
    },

    float: function (x, y, text, colour) {
      floats.push({
        x: x, y: y, text: text, colour: colour || '#ffe6a0',
        life: 0, max: 1.15, drift: U.range(Math.random, -12, 12)
      });
    },

    /* --- authored one-shots -------------------------------------------- */

    footPuff: function (x, y, inWater) {
      if (inWater) {
        FX.burst(x, y + 4, {
          count: 5, colour: '#cdf2ff', speedMin: 18, speedMax: 52,
          lift: 46, rMin: 1, rMax: 2.2, lifeMin: 0.28, lifeMax: 0.5, gravity: 150
        });
        FX.ring(x, y + 4, { r0: 5, r1: 26, duration: 0.5, colour: 'rgba(210,244,255,0.5)', width: 1.4 });
      } else {
        FX.burst(x, y + 5, {
          count: 3, colour: '#b6a887', speedMin: 8, speedMax: 26,
          lift: 14, rMin: 1.2, rMax: 2.6, lifeMin: 0.25, lifeMax: 0.45, gravity: 40
        });
      }
    },

    splash: function (x, y, big) {
      FX.burst(x, y + 3, {
        count: big ? 22 : 12, colour: '#dff6ff',
        speedMin: 30, speedMax: big ? 150 : 90,
        lift: big ? 120 : 70, rMin: 1.2, rMax: big ? 3.4 : 2.4,
        lifeMin: 0.35, lifeMax: 0.8, gravity: 220
      });
      FX.ring(x, y + 3, { r0: 6, r1: big ? 62 : 38, duration: 0.65, colour: 'rgba(224,250,255,0.75)', width: 2 });
    },

    landPuff: function (x, y) {
      FX.burst(x, y + 5, {
        count: 14, colour: '#c2b393', speedMin: 40, speedMax: 130,
        lift: 26, rMin: 1.4, rMax: 3.6, lifeMin: 0.3, lifeMax: 0.62, gravity: 110
      });
      FX.ring(x, y + 5, { r0: 8, r1: 54, duration: 0.42, colour: 'rgba(226,214,180,0.55)', width: 2.4 });
    },

    leapPuff: function (x, y, dx, dy) {
      FX.burst(x - dx * 10, y - dy * 10 + 4, {
        count: 10, colour: '#cdbfa0',
        angle: Math.atan2(-dy, -dx), spread: 0.8,
        speedMin: 50, speedMax: 140, lift: 20,
        rMin: 1.2, rMax: 3, lifeMin: 0.25, lifeMax: 0.5, gravity: 90
      });
    },

    harvestPop: function (x, y, colour) {
      FX.burst(x, y, {
        count: 16, colour: colour, speedMin: 30, speedMax: 110,
        lift: 90, rMin: 1.2, rMax: 3.2, lifeMin: 0.4, lifeMax: 0.85,
        gravity: 150, shape: 'spark'
      });
      FX.ring(x, y, { r0: 4, r1: 40, duration: 0.45, colour: U.rgba('#ffffff', 0.6), width: 2 });
    },

    bramblePop: function (x, y) {
      FX.burst(x, y, {
        count: 26, colour: '#6d5a3a', speedMin: 40, speedMax: 170,
        lift: 60, rMin: 1.6, rMax: 4.2, lifeMin: 0.5, lifeMax: 1.1,
        gravity: 260, shape: 'shard'
      });
      FX.burst(x, y, {
        count: 10, colour: '#2f5c3a', speedMin: 20, speedMax: 90,
        lift: 40, rMin: 1.4, rMax: 3, lifeMin: 0.6, lifeMax: 1.2, gravity: 120
      });
      FX.ring(x, y, { r0: 10, r1: 90, duration: 0.6, colour: 'rgba(200,180,120,0.5)', width: 3 });
    },

    sporeCloud: function (x, y) {
      FX.burst(x, y, {
        count: 60, colour: '#ffd98a', speedMin: 10, speedMax: 70,
        lift: 60, rMin: 1.4, rMax: 3.6, lifeMin: 1.4, lifeMax: 2.8,
        gravity: -6, drag: 1.1, shape: 'spore'
      });
      FX.ring(x, y, { r0: 6, r1: 80, duration: 1, colour: 'rgba(255,224,150,0.5)', width: 2.5 });
    },

    unlockBurst: function (x, y, colour) {
      FX.ring(x, y, { r0: 10, r1: 260, duration: 1.2, colour: U.rgba(colour, 0.7), width: 5 });
      FX.ring(x, y, { r0: 10, r1: 170, duration: 0.9, colour: 'rgba(255,255,255,0.8)', width: 3 });
      FX.burst(x, y, {
        count: 52, colour: colour, speedMin: 50, speedMax: 260,
        lift: 160, rMin: 1.6, rMax: 4.4, lifeMin: 0.8, lifeMax: 1.8,
        gravity: 60, shape: 'spark'
      });
    },

    denied: function (x, y) {
      FX.ring(x, y, { r0: 14, r1: 40, duration: 0.35, colour: 'rgba(255,150,130,0.6)', width: 2.5 });
    },

    /* --- simulation ----------------------------------------------------- */

    update: function (dt) {
      var i, p;
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        var k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz -= p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.rot += p.spin * dt;
      }
      for (i = rings.length - 1; i >= 0; i--) {
        rings[i].life += dt;
        if (rings[i].life >= rings[i].max) rings.splice(i, 1);
      }
      for (i = floats.length - 1; i >= 0; i--) {
        floats[i].life += dt;
        if (floats[i].life >= floats[i].max) floats.splice(i, 1);
      }
    },

    /* --- drawing (world space) ------------------------------------------ */

    draw: function (ctx) {
      var i, p, t;

      for (i = 0; i < rings.length; i++) {
        var r = rings[i];
        t = r.life / r.max;
        var rad = U.lerp(r.r0, r.r1, U.easeOutCubic(t));
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = r.colour;
        ctx.lineWidth = r.width * (1 - t * 0.6);
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * r.squash, 0, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
      }

      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        t = p.life / p.max;
        ctx.save();
        ctx.globalAlpha = p.fade * (1 - t * t);
        ctx.fillStyle = p.colour;
        var py = p.y - p.z;

        if (p.shape === 'shard') {
          ctx.translate(p.x, py);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        } else if (p.shape === 'spark') {
          ctx.translate(p.x, py);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-p.r * 2, -p.r * 0.35, p.r * 4, p.r * 0.7);
        } else if (p.shape === 'spore') {
          ctx.globalAlpha *= 0.75;
          ctx.beginPath();
          ctx.arc(p.x + Math.sin(p.life * 3 + p.rot) * 6, py, p.r, 0, 6.2832);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, py, p.r * (1 - t * 0.4), 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }

      for (i = 0; i < floats.length; i++) {
        var f = floats[i];
        t = f.life / f.max;
        ctx.save();
        ctx.globalAlpha = (1 - U.easeInCubic(t)) * 0.95;
        ctx.fillStyle = f.colour;
        ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(f.text, f.x + f.drift * t, f.y - 20 - t * 34);
        ctx.restore();
      }
    }
  };

  EVO.FX = FX;
})(window.EVO);
