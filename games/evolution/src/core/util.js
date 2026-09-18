/* Shared maths, easing and a seeded RNG.
   Everything hangs off a single global so the game can run from file:// with
   plain <script> tags - no build step, no module server needed. */

window.EVO = window.EVO || {};

(function (EVO) {
  'use strict';

  var U = {};

  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };

  /* Frame-rate independent smoothing. `rate` is roughly "how much of the gap
     is closed per second" - higher is snappier. */
  U.damp = function (a, b, rate, dt) {
    return U.lerp(a, b, 1 - Math.exp(-rate * dt));
  };

  U.dist = function (ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  };
  U.dist2 = function (ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };

  /* Shortest signed angular difference, in radians. */
  U.angleDelta = function (a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.angleTowards = function (a, b, maxStep) {
    var d = U.angleDelta(a, b);
    return a + U.clamp(d, -maxStep, maxStep);
  };

  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeInCubic = function (t) { return t * t * t; };
  U.easeOutBack = function (t) {
    var c = 1.70158, c3 = c + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };
  U.smoothstep = function (a, b, x) {
    var t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* Deterministic RNG (mulberry32). The world is authored, but scatter detail
     - grass, pebbles, flowers - is generated, and it must look identical every
     session so the place feels remembered rather than reshuffled. */
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Cheap value noise - smooth, seamless enough for ground mottling. */
  U.noise2 = function (x, y, seed) {
    var s = seed || 0;
    function h(ix, iy) {
      var n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 2147483647);
      n = (n ^ (n >>> 13)) | 0;
      n = Math.imul(n, 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = x - x0, fy = y - y0;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
    return U.lerp(U.lerp(a, b, sx), U.lerp(c, d, sx), sy);
  };

  U.fbm = function (x, y, octaves, seed) {
    var v = 0, amp = 0.5, freq = 1, total = 0;
    for (var i = 0; i < octaves; i++) {
      v += U.noise2(x * freq, y * freq, (seed || 0) + i * 101) * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v / total;
  };

  U.choice = function (rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; };
  U.range = function (rand, lo, hi) { return lo + rand() * (hi - lo); };

  /* rgba() string from a hex colour - handy for tinting without string soup. */
  U.rgba = function (colour, alpha) {
    var c = parseColour(colour);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  };

  /* Accepts "#rgb", "#rrggbb" or the "rgb(r,g,b)" this function itself
     returns, so mixes can be chained - which is exactly what the creature does
     as it stacks up adaptations. */
  function parseColour(c) {
    if (c.charAt(0) === 'r') {
      var m = c.match(/-?\d+/g);
      return [+m[0], +m[1], +m[2]];
    }
    var h = c.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  U.mixHex = function (a, b, t) {
    var ca = parseColour(a), cb = parseColour(b);
    return 'rgb(' + Math.round(U.lerp(ca[0], cb[0], t)) + ',' +
                    Math.round(U.lerp(ca[1], cb[1], t)) + ',' +
                    Math.round(U.lerp(ca[2], cb[2], t)) + ')';
  };

  U.formatTime = function (seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    if (h > 0) return h + 'h ' + (m % 60) + 'm';
    if (m > 0) return m + 'm ' + (s % 60) + 's';
    return s + 's';
  };

  EVO.U = U;
})(window.EVO);
