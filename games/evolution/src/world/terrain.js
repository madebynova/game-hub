/* Terrain baking.

   The ground, the water shape, the deep-water region and the shoreline never
   change, so they are painted once into offscreen canvases at load and then
   blitted each frame. Everything that moves - caustics, grass sway, critters,
   light - is drawn live on top.

   The deep-water layer is baked from exactly the same circles that
   World.depthAt uses, so the dark water the player can see is precisely the
   water they cannot enter. That honesty is the whole gate. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;

  var SCALE = 0.45;

  var T = {
    scale: SCALE,
    ground: null,
    water: null,
    deep: null,
    foam: null
  };

  function make(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }

  function blurred(canvas, px) {
    var out = make(canvas.width, canvas.height);
    var g = out.getContext('2d');
    try {
      g.filter = 'blur(' + px + 'px)';
    } catch (e) { /* older browsers just get a crisp edge */ }
    g.drawImage(canvas, 0, 0);
    return out;
  }

  /* Union of the water circles, optionally shrunk, with islands carved out. */
  function waterShape(inset, islandGrow, colour) {
    var c = make(W.width * SCALE, W.height * SCALE);
    var g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.fillStyle = colour;
    var i, o;
    for (i = 0; i < W.waterCircles.length; i++) {
      o = W.waterCircles[i];
      var r = o.r - inset;
      if (r <= 0) continue;
      g.beginPath();
      g.arc(o.x, o.y, r, 0, 6.2832);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < W.islands.length; i++) {
      o = W.islands[i];
      g.beginPath();
      g.arc(o.x, o.y, o.r + islandGrow, 0, 6.2832);
      g.fill();
    }
    return c;
  }

  /* A band that hugs the shoreline on the water side, plus a matching band
     around every island. */
  function shoreBand(width, colour) {
    var c = make(W.width * SCALE, W.height * SCALE);
    var g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.fillStyle = colour;
    var i, o;

    for (i = 0; i < W.waterCircles.length; i++) {
      o = W.waterCircles[i];
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, 6.2832);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < W.waterCircles.length; i++) {
      o = W.waterCircles[i];
      if (o.r - width <= 0) continue;
      g.beginPath();
      g.arc(o.x, o.y, o.r - width, 0, 6.2832);
      g.fill();
    }

    // Islands get their own ring on the water side.
    g.globalCompositeOperation = 'source-over';
    for (i = 0; i < W.islands.length; i++) {
      o = W.islands[i];
      g.beginPath();
      g.arc(o.x, o.y, o.r + width, 0, 6.2832);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < W.islands.length; i++) {
      o = W.islands[i];
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, 6.2832);
      g.fill();
    }
    return c;
  }

  /* Soft-edged region masks used to tint whole areas of the map. */
  function regionWash(g, x, y, r, colour, alpha) {
    var grad = g.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, U.rgba(colour, alpha));
    grad.addColorStop(0.62, U.rgba(colour, alpha * 0.72));
    grad.addColorStop(1, U.rgba(colour, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, 6.2832);
    g.fill();
  }

  T.bake = function () {
    var rand = U.rng(884422);
    var i;

    /* ---- ground ---------------------------------------------------- */
    var gc = make(W.width * SCALE, W.height * SCALE);
    var g = gc.getContext('2d');
    g.scale(SCALE, SCALE);

    // Base: warm meadow green, cooling toward the north where the shelf is.
    var base = g.createLinearGradient(0, 0, 0, W.height);
    base.addColorStop(0.00, '#4a5748');
    base.addColorStop(0.28, '#3f6b47');
    base.addColorStop(0.55, '#3d7a4d');
    base.addColorStop(0.82, '#356b45');
    base.addColorStop(1.00, '#2a5239');
    g.fillStyle = base;
    g.fillRect(0, 0, W.width, W.height);

    // Painterly mottling: a few thousand soft blobs whose colour is chosen by
    // low-frequency noise, so patches of lush and dry ground read as places
    // rather than static.
    // Warm dry olives and cool deep greens both present, so the meadow has
    // tonal range instead of one flat hue.
    var palette = ['#4f8c57', '#35663f', '#6d9a52', '#2a5738', '#7fa858', '#3f7449', '#8a9a4e'];
    for (i = 0; i < 3200; i++) {
      var bx = rand() * W.width;
      var by = rand() * W.height;
      var br = U.range(rand, 26, 150);
      var n = U.fbm(bx * 0.0013, by * 0.0013, 4, 3);
      var col = palette[Math.min(palette.length - 1, Math.floor(n * palette.length))];
      var grad = g.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, U.rgba(col, U.range(rand, 0.08, 0.2)));
      grad.addColorStop(0.7, U.rgba(col, U.range(rand, 0.03, 0.08)));
      grad.addColorStop(1, U.rgba(col, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(bx, by, br, 0, 6.2832);
      g.fill();
    }

    // Broad shadow drifts, as if cloud were passing. Breaks up the evenness
    // more than any amount of extra small mottling does.
    for (i = 0; i < 90; i++) {
      var dx2 = rand() * W.width, dy2 = rand() * W.height;
      var dr = U.range(rand, 200, 520);
      var dg = g.createRadialGradient(dx2, dy2, dr * 0.1, dx2, dy2, dr);
      dg.addColorStop(0, 'rgba(10,30,22,0.16)');
      dg.addColorStop(1, 'rgba(10,30,22,0)');
      g.fillStyle = dg;
      g.beginPath();
      g.arc(dx2, dy2, dr, 0, 6.2832);
      g.fill();
    }

    // The Sunstone Shelf is stone, not meadow.
    g.save();
    var shelfGrad = g.createLinearGradient(0, 0, 0, 760);
    shelfGrad.addColorStop(0, 'rgba(126,122,104,0.92)');
    shelfGrad.addColorStop(0.7, 'rgba(112,110,95,0.78)');
    shelfGrad.addColorStop(1, 'rgba(112,110,95,0)');
    g.fillStyle = shelfGrad;
    g.fillRect(0, 0, W.width, 760);
    for (i = 0; i < 420; i++) {
      var sx = rand() * W.width, sy = rand() * 720;
      var sr = U.range(rand, 30, 130);
      var sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      var tone = rand() < 0.5 ? '#8d8873' : '#6a6a5c';
      sg.addColorStop(0, U.rgba(tone, U.range(rand, 0.1, 0.3)));
      sg.addColorStop(1, U.rgba(tone, 0));
      g.fillStyle = sg;
      g.beginPath();
      g.arc(sx, sy, sr, 0, 6.2832);
      g.fill();
    }
    g.restore();

    // Thornhollow: shadowed, mossy, a little sour.
    regionWash(g, 500, 2120, 720, '#1d3a2a', 0.62);
    regionWash(g, 820, 1960, 380, '#24402c', 0.4);

    // The Cradle Heart's shore is pale and strange.
    regionWash(g, 3060, 400, 420, '#5b6f86', 0.42);

    // Warm light pooling in the Hollow, which is where the player starts and
    // where the game wants their eye first.
    regionWash(g, 900, 1420, 560, '#7fb964', 0.3);
    regionWash(g, 900, 1420, 260, '#9ed07a', 0.24);

    // Trodden earth around the big rocks and under the Elderbough.
    for (i = 0; i < W.rocks.length; i++) {
      var rk = W.rocks[i];
      regionWash(g, rk.x, rk.y, rk.r * 2.4, '#4a4536', 0.3);
    }
    regionWash(g, 560, 1650, 230, '#4d4030', 0.38);

    // Sand where the land meets the water.
    var sand = shoreBand(34, '#c9bE94');
    var sandSoft = blurred(sand, 7);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 0.5;
    g.drawImage(sandSoft, 0, 0);
    g.globalAlpha = 1;
    g.restore();

    T.ground = gc;

    /* ---- water ----------------------------------------------------- */
    T.water = waterShape(0, 0, '#2f7f92');
    T.deep = blurred(waterShape(W.SHALLOW_MAX, W.SHALLOW_MAX, '#0e3448'), 9);
    T.foam = blurred(shoreBand(13, 'rgba(226,248,255,0.85)'), 3);

    return T;
  };

  EVO.Terrain = T;
})(window.EVO);
