/* Drawing the Cradle.

   Order: baked ground, water, terrain features, then every object y-sorted so
   the creature passes in front of and behind things correctly (tree canopies
   included - they sort by their trunk base, which is what makes walking behind
   a tree work without any extra logic).

   Live detail - grass, reeds, caustics, light - is drawn on top of the baked
   layers, culled to the view rectangle. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;
  var T = EVO.Terrain;
  var A = EVO.Adapt;
  var C = EVO.Critters;

  var R = {};
  var detailBuf = [];
  var sortBuf = [];

  /* A soft-edged ellipse. Drawing a circular gradient into a squashed ellipse
     clips the fade long before it reaches zero, which leaves a hard top and
     bottom edge - the shape has to be scaled instead. */
  function softBlob(ctx, x, y, rx, ry, rgb, alpha, falloff) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    g.addColorStop(falloff === undefined ? 0.55 : falloff,
                   'rgba(' + rgb + ',' + alpha * 0.55 + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* ---- water ---------------------------------------------------------- */

  function drawWater(ctx, view, t) {
    var s = 1 / T.scale;
    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // Baked body + deep region, both drawn scaled from the small bake.
    ctx.globalAlpha = 0.92;
    ctx.drawImage(T.water, 0, 0, T.water.width, T.water.height, 0, 0, W.width, W.height);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(T.deep, 0, 0, T.deep.width, T.deep.height, 0, 0, W.width, W.height);
    ctx.globalAlpha = 1;

    // Caustics: a shimmering lattice, skipped anywhere that is not water so no
    // mask or extra buffer is needed. Additive, because translucent white over
    // dark water just turns grey and reads as silt rather than light.
    var step = 44;
    var x0 = Math.floor(view.x0 / step) * step;
    var y0 = Math.floor(view.y0 / step) * step;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgb(46,104,120)';
    for (var y = y0; y < view.y1; y += step) {
      for (var x = x0; x < view.x1; x += step) {
        // Jitter the lattice by position so it does not read as a grid.
        var jx = x + Math.sin(x * 0.07 + y * 0.031) * 16;
        var jy = y + Math.cos(y * 0.061 - x * 0.027) * 16;
        var d = W.depthAt(jx, jy);
        if (d < 6) continue;
        var w1 = Math.sin(jx * 0.021 + t * 1.1) * Math.sin(jy * 0.019 - t * 0.85);
        var w2 = Math.sin((jx + jy) * 0.013 + t * 0.6);
        var a = (w1 * 0.5 + w2 * 0.5);
        if (a < 0.2) continue;
        ctx.globalAlpha = (a - 0.2) * 0.8 * U.clamp(d / 40, 0.3, 1);
        var rr = 8 + a * 12;
        ctx.beginPath();
        ctx.ellipse(jx + Math.sin(t * 0.7 + jy * 0.01) * 7, jy + Math.cos(t * 0.5 + jx * 0.01) * 5,
                    rr, rr * 0.38, w2, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Shoreline foam, breathing slightly.
    ctx.globalAlpha = 0.5 + Math.sin(t * 0.9) * 0.12;
    ctx.drawImage(T.foam, 0, 0, T.foam.width, T.foam.height, 0, 0, W.width, W.height);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ---- cliffs and the chasm -------------------------------------------- */

  function drawCliffs(ctx, view, t) {
    var i, j;
    for (i = 0; i < W.cliffs.length; i++) {
      var c = W.cliffs[i];
      if (c.x > view.x1 || c.x + c.w < view.x0 || c.y > view.y1 || c.y + c.h < view.y0) continue;

      var rand = U.rng(Math.floor(c.x) + 7);

      // Body of the escarpment: dark at the base where it meets the ground.
      var g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
      g.addColorStop(0, '#6a6455');
      g.addColorStop(0.35, '#514d42');
      g.addColorStop(0.75, '#32302b');
      g.addColorStop(1, '#1d1c1a');
      ctx.fillStyle = g;
      ctx.fillRect(c.x, c.y, c.w, c.h);

      // Angled facets: overlapping slabs are what stop the band reading flat.
      for (j = c.x; j < c.x + c.w; j += 54) {
        var fw = 48 + rand() * 46;
        var tone = 0.35 + rand() * 0.5;
        ctx.fillStyle = 'rgba(' + Math.round(86 + tone * 54) + ',' +
                                  Math.round(82 + tone * 50) + ',' +
                                  Math.round(68 + tone * 42) + ',0.34)';
        ctx.beginPath();
        ctx.moveTo(j, c.y + 2);
        ctx.lineTo(j + fw, c.y + 2);
        ctx.lineTo(j + fw - 10 + rand() * 20, c.y + c.h * (0.5 + rand() * 0.35));
        ctx.lineTo(j - 8 + rand() * 16, c.y + c.h * (0.5 + rand() * 0.35));
        ctx.closePath();
        ctx.fill();
      }

      // Sunlit top ridge, jagged rather than a ruled line.
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + 16);
      for (j = c.x; j <= c.x + c.w; j += 22) {
        ctx.lineTo(j, c.y - 4 + Math.sin(j * 0.09) * 5 + rand() * 9);
      }
      ctx.lineTo(c.x + c.w, c.y + 20);
      ctx.closePath();
      var tg2 = ctx.createLinearGradient(0, c.y - 10, 0, c.y + 22);
      tg2.addColorStop(0, '#9a937b');
      tg2.addColorStop(1, '#6b6555');
      ctx.fillStyle = tg2;
      ctx.fill();

      // Jagged fissures.
      ctx.strokeStyle = 'rgba(20,19,16,0.45)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (j = 0; j < c.w / 46; j++) {
        var fx = c.x + rand() * c.w;
        ctx.beginPath();
        ctx.moveTo(fx, c.y + 10);
        var fy = c.y + 10;
        while (fy < c.y + c.h - 6) {
          fy += 22 + rand() * 24;
          fx += (rand() - 0.5) * 22;
          ctx.lineTo(fx, Math.min(fy, c.y + c.h - 4));
        }
        ctx.stroke();
      }

      // Scree spilling out along the foot of the rock.
      for (j = 0; j < c.w / 30; j++) {
        var sxr = c.x + rand() * c.w;
        var syr = c.y + c.h - 4 + rand() * 16;
        var srr = 3 + rand() * 8;
        ctx.fillStyle = rand() < 0.5 ? 'rgba(96,92,78,0.8)' : 'rgba(62,60,52,0.8)';
        ctx.beginPath();
        ctx.ellipse(sxr, syr, srr, srr * 0.66, rand(), 0, 6.2832);
        ctx.fill();
      }

      // Shadow pooling at the base.
      var sg = ctx.createLinearGradient(0, c.y + c.h - 20, 0, c.y + c.h + 40);
      sg.addColorStop(0, 'rgba(6,14,10,0.5)');
      sg.addColorStop(1, 'rgba(6,14,10,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(c.x, c.y + c.h - 20, c.w, 60);
    }

    for (i = 0; i < W.chasms.length; i++) {
      var ch = W.chasms[i];
      if (ch.x > view.x1 || ch.x + ch.w < view.x0) continue;

      var crand = U.rng(Math.floor(ch.x) + 31);
      var cg = ctx.createLinearGradient(ch.x, 0, ch.x + ch.w, 0);
      cg.addColorStop(0, '#2a2824');
      cg.addColorStop(0.22, '#080a0c');
      cg.addColorStop(0.78, '#080a0c');
      cg.addColorStop(1, '#2a2824');
      ctx.fillStyle = cg;

      // Ragged edges: a perfect rectangle reads as a door, not a split in rock.
      ctx.beginPath();
      ctx.moveTo(ch.x + 6, ch.y - 8);
      var yy;
      for (yy = ch.y - 8; yy <= ch.y + ch.h + 8; yy += 26) {
        ctx.lineTo(ch.x + 2 + crand() * 12, yy);
      }
      ctx.lineTo(ch.x + ch.w - 4, ch.y + ch.h + 8);
      for (yy = ch.y + ch.h + 8; yy >= ch.y - 8; yy -= 26) {
        ctx.lineTo(ch.x + ch.w - 2 - crand() * 12, yy);
      }
      ctx.closePath();
      ctx.fill();

      // A hint of something far below, so the drop reads as depth not a hole.
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 0.7) * 0.05;
      var glow = ctx.createLinearGradient(0, ch.y, 0, ch.y + ch.h);
      glow.addColorStop(0, 'rgba(90,150,180,0)');
      glow.addColorStop(0.5, 'rgba(90,150,180,0.5)');
      glow.addColorStop(1, 'rgba(90,150,180,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(ch.x + ch.w * 0.3, ch.y, ch.w * 0.4, ch.h);
      ctx.restore();

      // Rising mist - soft-edged, or it reads as a stack of grey pills.
      for (var m = 0; m < 6; m++) {
        var mt = (t * 0.2 + m * 0.167) % 1;
        var my = ch.y + ch.h - mt * (ch.h + 50);
        var mx = ch.x + ch.w / 2 + Math.sin(t * 0.6 + m * 2.1) * 26;
        var mr = 20 + mt * 34;
        softBlob(ctx, mx, my, mr, mr * 0.42, '207,228,234',
                 0.26 * Math.sin(mt * Math.PI), 0.4);
      }
    }
  }

  /* ---- ground detail ---------------------------------------------------- */

  function drawDetail(ctx, view, t, wind) {
    var items = W.detailGrid.inRect(view.x0, view.y0, view.x1, view.y1, detailBuf);

    // Pebbles first: they sit under everything.
    var i, d;
    for (i = 0; i < items.length; i++) {
      d = items[i];
      if (d.t !== 'pebble') continue;
      ctx.fillStyle = d.tone > 0.5 ? 'rgba(150,146,126,0.55)' : 'rgba(96,100,84,0.5)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.72, 0, 0, 6.2832);
      ctx.fill();
    }

    for (i = 0; i < items.length; i++) {
      d = items[i];
      if (d.t !== 'lily') continue;
      var lw = Math.sin(t * 0.8 + d.phase) * 0.12;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(lw);
      ctx.fillStyle = 'rgba(10,40,34,0.28)';
      ctx.beginPath();
      ctx.ellipse(2, 3, d.r, d.r * 0.85, 0, 0, 6.2832);
      ctx.fill();
      // Vary the pad tone by position so a cluster does not read as stickers.
      var lt = (Math.sin(d.x * 0.03 + d.y * 0.017) + 1) / 2;
      var lg = ctx.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 0, 0, 0, d.r);
      lg.addColorStop(0, U.mixHex('#4e8a52', '#2c5c3c', lt));
      lg.addColorStop(1, U.mixHex('#2e6040', '#1d4430', lt));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0.42, Math.PI * 2 + 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,200,150,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (d.flower) {
        ctx.fillStyle = '#f6e8f2';
        ctx.beginPath();
        ctx.arc(0, -1, d.r * 0.3, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath();
        ctx.arc(0, -1, d.r * 0.13, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }

    // Grass. Each tuft is a few strokes; the sway is a shared wind phase with
    // a per-tuft offset so the field moves as one thing.
    ctx.lineCap = 'round';
    for (i = 0; i < items.length; i++) {
      d = items[i];
      if (d.t !== 'tuft') continue;
      var sway = Math.sin(wind + d.phase) * (2.2 + d.h * 0.13);
      var dark = d.tint < 0.45;
      ctx.strokeStyle = dark ? 'rgba(42,92,56,0.85)' : 'rgba(96,158,88,0.8)';
      ctx.lineWidth = 1.6;
      for (var b = 0; b < d.blades; b++) {
        var off = (b - (d.blades - 1) / 2) * 3.1;
        ctx.beginPath();
        ctx.moveTo(d.x + off, d.y);
        ctx.quadraticCurveTo(
          d.x + off + sway * 0.4, d.y - d.h * 0.6,
          d.x + off + sway, d.y - d.h * (0.8 + (b % 2) * 0.2)
        );
        ctx.stroke();
      }
    }

    for (i = 0; i < items.length; i++) {
      d = items[i];
      if (d.t !== 'reed') continue;
      var rs = Math.sin(wind * 0.8 + d.phase) * 4.5;
      ctx.strokeStyle = 'rgba(64,118,86,0.9)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.quadraticCurveTo(d.x + d.lean * d.h + rs * 0.4, d.y - d.h * 0.6,
                           d.x + d.lean * d.h * 1.6 + rs, d.y - d.h);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,170,120,0.8)';
      ctx.beginPath();
      ctx.ellipse(d.x + d.lean * d.h * 1.6 + rs, d.y - d.h, 1.6, 3.4,
                  d.lean + rs * 0.04, 0, 6.2832);
      ctx.fill();
    }

    var FLOWERS = ['#f2d0e6', '#ffe8a8', '#dcd4ff'];
    for (i = 0; i < items.length; i++) {
      d = items[i];
      if (d.t !== 'flower') continue;
      var fs = Math.sin(wind + d.phase) * 1.8;
      ctx.strokeStyle = 'rgba(70,124,72,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + fs, d.y - 8);
      ctx.stroke();
      ctx.fillStyle = FLOWERS[d.kind];
      for (var pt = 0; pt < 5; pt++) {
        var ang = (pt / 5) * 6.2832;
        ctx.beginPath();
        ctx.arc(d.x + fs + Math.cos(ang) * d.size * 0.7,
                d.y - 8 + Math.sin(ang) * d.size * 0.7, d.size * 0.6, 0, 6.2832);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(d.x + fs, d.y - 8, d.size * 0.42, 0, 6.2832);
      ctx.fill();
    }
  }

  /* ---- objects ---------------------------------------------------------- */

  function drawRock(ctx, r, t) {
    var rand = U.rng(r.seed);
    ctx.save();
    ctx.translate(r.x, r.y);

    softBlob(ctx, 3, r.r * 0.34, r.r * 1.12, r.r * 0.5, '8,18,12', 0.38, 0.5);

    // Two or three overlapping lumps read as a boulder more convincingly than
    // one ellipse ever does.
    var lumps = 2 + Math.floor(rand() * 2);
    for (var i = 0; i < lumps; i++) {
      var ox = (rand() - 0.5) * r.r * 0.5;
      var oy = (rand() - 0.5) * r.r * 0.3;
      var rr = r.r * U.range(rand, 0.6, 0.95);
      var g = ctx.createLinearGradient(ox - rr, oy - rr, ox + rr * 0.6, oy + rr);
      g.addColorStop(0, '#a7a391');
      g.addColorStop(0.5, '#7d7a6b');
      g.addColorStop(1, '#4e4c43');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ox, oy, rr, rr * 0.82, rand() * 0.6, 0, 6.2832);
      ctx.fill();
    }

    // Moss creeping up the shaded base.
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#416b3e';
    ctx.beginPath();
    ctx.ellipse(-r.r * 0.2, r.r * 0.3, r.r * 0.5, r.r * 0.2, -0.16, 0, 6.2832);
    ctx.fill();

    // Sunlit cap: a soft blob on the top-left, not an outline. An arc here
    // reads as a drawn-on smile at almost every size.
    var hg = ctx.createRadialGradient(-r.r * 0.3, -r.r * 0.4, 0, -r.r * 0.25, -r.r * 0.32, r.r * 0.8);
    hg.addColorStop(0, 'rgba(240,242,222,0.4)');
    hg.addColorStop(1, 'rgba(240,242,222,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(-r.r * 0.25, -r.r * 0.32, r.r * 0.8, r.r * 0.6, -0.3, 0, 6.2832);
    ctx.fill();

    ctx.restore();
  }

  function drawTree(ctx, tr, t) {
    var rand = U.rng(tr.seed);
    var s = tr.scale;
    var sway = Math.sin(t * 0.55 + tr.seed) * 0.024 + Math.sin(t * 1.3 + tr.seed) * 0.008;

    ctx.save();
    ctx.translate(tr.x, tr.y);

    // Soft-edged shadow: a hard ellipse under every tree reads as a sticker.
    softBlob(ctx, 6 * s, 8 * s, 36 * s, 16 * s, '6,16,10', 0.36, 0.5);

    // Trunk
    var trunkH = (tr.type === 'spire' ? 52 : 40) * s;
    var tg = ctx.createLinearGradient(-9 * s, 0, 9 * s, 0);
    tg.addColorStop(0, '#5a4430');
    tg.addColorStop(0.45, '#7d6046');
    tg.addColorStop(1, '#3e2f22');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 6 * s);
    ctx.quadraticCurveTo(-6 * s, -trunkH * 0.5, -5 * s + sway * 40 * s, -trunkH);
    ctx.lineTo(5 * s + sway * 40 * s, -trunkH);
    ctx.quadraticCurveTo(6 * s, -trunkH * 0.5, 10 * s, 6 * s);
    ctx.closePath();
    ctx.fill();

    if (tr.type === 'gnarled' || tr.isElder) {
      ctx.strokeStyle = 'rgba(40,30,20,0.55)';
      ctx.lineWidth = 2 * s;
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo((-6 + k * 5) * s, 4 * s);
        ctx.quadraticCurveTo((-4 + k * 5) * s, -trunkH * 0.5, (-3 + k * 4) * s, -trunkH * 0.9);
        ctx.stroke();
      }
    }

    // Canopy
    ctx.save();
    ctx.translate(sway * 46 * s, -trunkH);
    ctx.rotate(sway * 0.5);

    var blobs, baseR, litCol, darkCol;
    if (tr.type === 'spire') {
      blobs = 4; baseR = 26 * s; litCol = '#4f8f5c'; darkCol = '#20452f';
    } else if (tr.type === 'gnarled') {
      blobs = 5; baseR = 34 * s; litCol = '#3c6b46'; darkCol = '#16301f';
    } else {
      blobs = 5; baseR = 38 * s; litCol = '#5da35f'; darkCol = '#245036';
    }
    // The Elderbough is the biggest thing here, but one huge blob reads as a
    // glass dome rather than foliage - it needs many smaller, high-contrast
    // clumps instead.
    if (tr.isElder) { blobs = 22; baseR = 22 * s; litCol = '#77bb6c'; darkCol = '#10301f'; }

    // Scalloped rim first, underneath, so the canopy edge is broken up.
    ctx.fillStyle = darkCol;
    var rimR = baseR * (tr.type === 'spire' ? 0.9 : 1.35);
    for (var sc = 0; sc < 14; sc++) {
      var sa = (sc / 14) * 6.2832;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * rimR * 0.78, Math.sin(sa) * rimR * 0.5 - (tr.type === 'spire' ? 14 * s : 0),
              baseR * 0.42, 0, 6.2832);
      ctx.fill();
    }

    for (var i = 0; i < blobs; i++) {
      var ang = (i / blobs) * 6.2832 + rand() * 1.4;
      var spread = tr.type === 'spire' ? baseR * 0.45 : baseR * (tr.isElder ? 1.5 : 0.7);
      var bx = Math.cos(ang) * spread * U.range(rand, 0.35, 1);
      var by = Math.sin(ang) * spread * 0.6 * U.range(rand, 0.35, 1)
               - (tr.type === 'spire' ? i * 11 * s : 0);
      var br = baseR * U.range(rand, 0.55, 0.95);
      // Light falls from the upper left, so blobs on that side are lit more.
      // The spread has to be wide relative to the blob size or the clumps melt
      // into a single smooth dome.
      var litAmt = U.clamp(0.5 - (bx + by) / (baseR * 3.4), 0, 1);
      var g = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.55, br * 0.05, bx, by, br * 1.02);
      g.addColorStop(0, U.mixHex(darkCol, litCol, 0.45 + litAmt * 0.55));
      g.addColorStop(0.55, U.mixHex(darkCol, litCol, 0.22 + litAmt * 0.38));
      g.addColorStop(1, darkCol);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, by, br, br * 0.86, ang, 0, 6.2832);
      ctx.fill();

      // A dark crease under each clump keeps them reading as separate masses.
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = darkCol;
      ctx.beginPath();
      ctx.ellipse(bx + br * 0.1, by + br * 0.45, br * 0.72, br * 0.3, ang, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Sun catching the top-left of the crown. Flat discs here read as bubbles
    // stuck on the tree, so each one fades out to nothing at its edge.
    for (var hl = 0; hl < 5; hl++) {
      var hx = -baseR * (0.5 + hl * 0.34), hy = -baseR * (0.7 - hl * 0.18);
      var hr = baseR * 0.3;
      var hgr = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hgr.addColorStop(0, 'rgba(198,236,168,0.28)');
      hgr.addColorStop(1, 'rgba(198,236,168,0)');
      ctx.fillStyle = hgr;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, 6.2832);
      ctx.fill();
    }

    if (tr.isElder) {
      // Hanging strands make the Elderbough read as old rather than just big.
      // Short, curling strands hanging off the crown's edge - long straight
      // ones read as wires strung across the trunk.
      ctx.strokeStyle = 'rgba(104,152,104,0.5)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (var v = 0; v < 14; v++) {
        var va = U.range(rand, 0.15, Math.PI - 0.15);
        var vx = Math.cos(va) * baseR * U.range(rand, 1.1, 1.9) * (rand() < 0.5 ? -1 : 1);
        var vy = Math.sin(va) * baseR * 0.7;
        var vlen = U.range(rand, 14, 34) * s;
        var curl = Math.sin(t * 0.8 + v) * 5;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.quadraticCurveTo(vx + curl, vy + vlen * 0.6, vx + curl * 2.2, vy + vlen);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  function drawBramble(ctx, b, t) {
    var rand = U.rng(b.seed);
    ctx.save();
    ctx.translate(b.x, b.y);

    if (b.cleared) {
      // Torn stubble, so cleared gates stay visible as something you did.
      ctx.strokeStyle = 'rgba(70,56,36,0.7)';
      ctx.lineWidth = 2.2;
      for (var s = 0; s < 7; s++) {
        var a = rand() * 6.2832;
        var len = U.range(rand, 5, 13);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * b.r * 0.5, Math.sin(a) * b.r * 0.5);
        ctx.lineTo(Math.cos(a) * b.r * 0.5 + Math.cos(a) * len,
                   Math.sin(a) * b.r * 0.5 + Math.sin(a) * len * 0.6);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    var shake = b.shake > 0 ? Math.sin(t * 40) * b.shake * 2.2 : 0;
    ctx.translate(shake, 0);

    ctx.fillStyle = 'rgba(4,12,8,0.4)';
    ctx.beginPath();
    ctx.ellipse(4, b.r * 0.34, b.r * 0.95, b.r * 0.4, 0, 0, 6.2832);
    ctx.fill();

    // Mass first, so the tangle reads as solid from a distance.
    ctx.fillStyle = '#1d3322';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r * 0.86, b.r * 0.7, 0, 0, 6.2832);
    ctx.fill();

    ctx.strokeStyle = '#3d3122';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (var i = 0; i < 16; i++) {
      var a0 = rand() * 6.2832;
      var a1 = a0 + U.range(rand, -1.6, 1.6);
      var r0 = U.range(rand, 0.15, 0.9) * b.r;
      var r1 = U.range(rand, 0.3, 1) * b.r;
      var x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0 * 0.8;
      var x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1 * 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (rand() - 0.5) * 20,
                           (y0 + y1) / 2 + (rand() - 0.5) * 20, x1, y1);
      ctx.stroke();

      // Thorns
      if (rand() < 0.55) {
        ctx.fillStyle = '#6b5836';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (rand() - 0.5) * 8, y1 - 5);
        ctx.lineTo(x1 + (rand() - 0.5) * 6, y1 + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3d3122';
      }
    }

    // A few sour-looking leaves to keep it from being a black blob.
    ctx.fillStyle = 'rgba(58,96,60,0.8)';
    for (var l = 0; l < 9; l++) {
      var la = rand() * 6.2832, lr = U.range(rand, 0.3, 0.95) * b.r;
      ctx.save();
      ctx.translate(Math.cos(la) * lr, Math.sin(la) * lr * 0.8);
      ctx.rotate(la);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawNode(ctx, n, t) {
    if (n.harvested) return;
    var def = n.def;
    var pop = U.easeOutBack(U.clamp(n.pop, 0, 1));
    var bob = Math.sin(t * 1.6 + n.seed) * 1.4;

    ctx.save();
    ctx.translate(n.x, n.y + bob);
    ctx.scale(pop, pop);

    ctx.fillStyle = 'rgba(6,16,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 9, 4, 0, 0, 6.2832);
    ctx.fill();

    if (n.type === 'sporecap') {
      for (var i = 0; i < 3; i++) {
        var ox = (i - 1) * 6, sc = i === 1 ? 1 : 0.68;
        ctx.fillStyle = def.stem;
        ctx.fillRect(ox - 1.4 * sc, -8 * sc, 2.8 * sc, 9 * sc);
        var g = ctx.createLinearGradient(ox, -14 * sc, ox, -6 * sc);
        g.addColorStop(0, '#f6d5ea');
        g.addColorStop(1, def.colour);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(ox, -9 * sc, 6.5 * sc, 4.6 * sc, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(ox - 2 * sc, -10.5 * sc, 1.1 * sc, 0, 6.2832);
        ctx.fill();
      }
    } else if (n.type === 'dewbead') {
      ctx.strokeStyle = def.stem;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (var r = -1; r <= 1; r++) {
        var lean = r * 5;
        ctx.beginPath();
        ctx.moveTo(r * 3, 2);
        ctx.quadraticCurveTo(r * 3 + lean * 0.4, -12, r * 3 + lean, -20);
        ctx.stroke();
        var gg = ctx.createRadialGradient(r * 3 + lean - 1, -21, 0, r * 3 + lean, -20, 5);
        gg.addColorStop(0, '#ffffff');
        gg.addColorStop(0.5, def.colour);
        gg.addColorStop(1, 'rgba(155,232,226,0.2)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(r * 3 + lean, -20 + Math.sin(t * 2 + r) * 1, 4.2, 0, 6.2832);
        ctx.fill();
      }
    } else if (n.type === 'glimmer') {
      // Seen through water: soft, cold and slightly blurred by a wide halo.
      var pulse = 0.6 + Math.sin(t * 2 + n.seed) * 0.25;
      var hg = ctx.createRadialGradient(0, -3, 0, 0, -3, 22);
      hg.addColorStop(0, U.rgba('#cfeaff', 0.75 * pulse));
      hg.addColorStop(1, U.rgba('#cfeaff', 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(0, -3, 22, 0, 6.2832);
      ctx.fill();
      var pg = ctx.createRadialGradient(-2, -5, 0, 0, -3, 7);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, '#8fc3e8');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, -3, 6.2, 0, 6.2832);
      ctx.fill();
    } else if (n.type === 'ironcap') {
      ctx.fillStyle = def.stem;
      ctx.beginPath();
      ctx.ellipse(0, -2, 11, 5, 0, Math.PI, 0);
      ctx.fill();
      var ig = ctx.createLinearGradient(0, -12, 0, -2);
      ig.addColorStop(0, '#d5dcd0');
      ig.addColorStop(1, def.colour);
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(0, -6, 12, 7, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,70,58,0.6)';
      ctx.lineWidth = 1;
      for (var ri = -2; ri <= 2; ri++) {
        ctx.beginPath();
        ctx.moveTo(ri * 4, -6);
        ctx.lineTo(ri * 4.8, -12);
        ctx.stroke();
      }
      if (!A.canRend()) {
        // A hard glint, so "you cannot open this yet" is visible before you try.
        ctx.globalAlpha = 0.35 + Math.sin(t * 1.4 + n.seed) * 0.12;
        ctx.strokeStyle = '#eef3ea';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-5, -11);
        ctx.lineTo(1, -8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else if (n.type === 'amberdrop') {
      var ag = ctx.createRadialGradient(-2, -9, 0, 0, -6, 12);
      ag.addColorStop(0, '#ffe2a0');
      ag.addColorStop(0.6, def.colour);
      ag.addColorStop(1, '#a8702e');
      ctx.fillStyle = ag;
      for (var d2 = 0; d2 < 3; d2++) {
        var dx = (d2 - 1) * 7, dy = -4 - (d2 === 1 ? 5 : 0);
        ctx.beginPath();
        ctx.moveTo(dx, dy - 7);
        ctx.quadraticCurveTo(dx + 5, dy - 1, dx, dy + 4);
        ctx.quadraticCurveTo(dx - 5, dy - 1, dx, dy - 7);
        ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff3d0';
      ctx.beginPath();
      ctx.arc(-1, -10, 1.6, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawLandmark(ctx, lm, t) {
    ctx.save();
    ctx.translate(lm.x, lm.y);

    if (lm.id === 'sporebloom') {
      ctx.fillStyle = 'rgba(6,16,10,0.3)';
      ctx.beginPath();
      ctx.ellipse(3, 8, 30, 12, 0, 0, 6.2832);
      ctx.fill();
      var breathe = 1 + Math.sin(t * 1.1) * 0.03;
      ctx.save();
      ctx.scale(breathe, breathe);
      ctx.fillStyle = '#e8dcc4';
      ctx.beginPath();
      ctx.moveTo(-8, 6);
      ctx.quadraticCurveTo(-5, -12, -6, -20);
      ctx.lineTo(6, -20);
      ctx.quadraticCurveTo(5, -12, 8, 6);
      ctx.closePath();
      ctx.fill();
      var cg = ctx.createRadialGradient(-8, -34, 2, 0, -26, 34);
      cg.addColorStop(0, '#ffe9b8');
      cg.addColorStop(0.5, '#e8a8c8');
      cg.addColorStop(1, '#a5628c');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(0, -24, 30, 20, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (var s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.arc(-18 + s * 9, -30 + (s % 2) * 5, 2.4, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    } else if (lm.id === 'mirrorstone') {
      ctx.fillStyle = 'rgba(6,16,10,0.4)';
      ctx.beginPath();
      ctx.ellipse(5, 10, 26, 10, 0, 0, 6.2832);
      ctx.fill();
      var mg = ctx.createLinearGradient(-16, -60, 16, 8);
      mg.addColorStop(0, '#39424f');
      mg.addColorStop(0.45, '#131a24');
      mg.addColorStop(1, '#070a0f');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(-15, 8);
      ctx.lineTo(-11, -52);
      ctx.lineTo(4, -62);
      ctx.lineTo(16, -44);
      ctx.lineTo(13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35 + Math.sin(t * 0.9) * 0.18;
      ctx.strokeStyle = '#bfe8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-5, -48);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (lm.id === 'sunstone') {
      var warm = 0.55 + Math.sin(t * 0.8) * 0.15;
      var hg2 = ctx.createRadialGradient(0, -10, 4, 0, -10, 90);
      hg2.addColorStop(0, U.rgba('#ffd07a', 0.5 * warm));
      hg2.addColorStop(1, U.rgba('#ffd07a', 0));
      ctx.fillStyle = hg2;
      ctx.beginPath();
      ctx.arc(0, -10, 90, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,26,18,0.4)';
      ctx.beginPath();
      ctx.ellipse(6, 14, 34, 12, 0, 0, 6.2832);
      ctx.fill();
      var sgr = ctx.createLinearGradient(-26, -40, 26, 14);
      sgr.addColorStop(0, '#f6d79a');
      sgr.addColorStop(0.5, '#d8a45c');
      sgr.addColorStop(1, '#8a5f31');
      ctx.fillStyle = sgr;
      ctx.beginPath();
      ctx.moveTo(-26, 12);
      ctx.lineTo(-20, -30);
      ctx.lineTo(10, -40);
      ctx.lineTo(28, -14);
      ctx.lineTo(24, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = warm;
      ctx.strokeStyle = '#ffeec0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (lm.id === 'heart') {
      var lit = lm.used ? 1 : 0.55;
      var glow = 0.5 + Math.sin(t * 0.7) * 0.2;
      var g3 = ctx.createRadialGradient(0, -20, 6, 0, -20, 160);
      g3.addColorStop(0, U.rgba('#cfe8ff', 0.55 * glow * lit));
      g3.addColorStop(1, U.rgba('#cfe8ff', 0));
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.arc(0, -20, 160, 0, 6.2832);
      ctx.fill();

      ctx.fillStyle = 'rgba(10,20,30,0.4)';
      ctx.beginPath();
      ctx.ellipse(4, 16, 46, 16, 0, 0, 6.2832);
      ctx.fill();

      // A ring of pale spires around a bright core. This is the last thing in
      // the Cradle a player reaches, so it is built to be seen from a distance.
      for (var i = 0; i < 9; i++) {
        var a = (i / 9) * 6.2832;
        var px = Math.cos(a) * 62;
        var py = Math.sin(a) * 26;
        var h = 58 + Math.sin(i * 2.1) * 34;
        var sg2 = ctx.createLinearGradient(px, py - h, px, py + 10);
        sg2.addColorStop(0, '#f2faff');
        sg2.addColorStop(0.55, '#a9c6dc');
        sg2.addColorStop(1, '#4a6782');
        ctx.fillStyle = sg2;
        ctx.beginPath();
        ctx.moveTo(px - 12, py + 10);
        ctx.lineTo(px - 3, py - h);
        ctx.lineTo(px + 3, py - h);
        ctx.lineTo(px + 12, py + 10);
        ctx.closePath();
        ctx.fill();
      }
      var cg2 = ctx.createRadialGradient(0, -48, 0, 0, -48, 52);
      cg2.addColorStop(0, U.rgba('#ffffff', 0.95 * lit));
      cg2.addColorStop(0.42, U.rgba('#bfe6ff', 0.72 * lit));
      cg2.addColorStop(1, U.rgba('#a8dcff', 0));
      ctx.fillStyle = cg2;
      ctx.beginPath();
      ctx.arc(0, -48, 52, 0, 6.2832);
      ctx.fill();

      // Motes drifting up out of the core.
      for (var mi = 0; mi < 9; mi++) {
        var mp = ((t * 0.16 + mi * 0.111) % 1);
        ctx.globalAlpha = Math.sin(mp * Math.PI) * 0.7 * lit;
        ctx.fillStyle = '#eaf7ff';
        ctx.beginPath();
        ctx.arc(Math.sin(mi * 3.1 + t * 0.5) * 44, 10 - mp * 130, 2.2, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /* ---- critters --------------------------------------------------------- */

  function drawBurrower(ctx, b, t) {
    if (b.up < 0.02) return;
    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.fillStyle = 'rgba(48,38,26,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 5.5, 0, 0, 6.2832);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(-14, -30, 28, 32);
    ctx.clip();
    var rise = b.up * 16;
    ctx.translate(0, 2 - rise);
    var g = ctx.createRadialGradient(-2, -4, 1, 0, 0, 11);
    g.addColorStop(0, '#b79a72');
    g.addColorStop(1, '#6b5539');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -2, 8.5, 9.5, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = '#20180f';
    var look = Math.sin(b.look) * 2;
    ctx.beginPath();
    ctx.arc(-3 + look, -4, 1.7, 0, 6.2832);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 + look, -4, 1.7, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = '#d8c0a0';
    ctx.beginPath();
    ctx.ellipse(0 + look * 0.5, 0.5, 3, 2, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawSkimmer(ctx, s, t) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.atan2(s.vy, s.vx) || 0);
    ctx.scale(s.size, s.size);

    ctx.strokeStyle = 'rgba(210,240,250,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, 6.2832);
    ctx.stroke();

    ctx.strokeStyle = '#243830';
    ctx.lineWidth = 1.1;
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-2 + i * 2.6, 0);
        ctx.lineTo(-5 + i * 5, side * (5 + i));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#31463a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 1.9, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawFlit(ctx, f, t) {
    var x = f.x, y = f.y - f.z;
    ctx.save();

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#0a1a12';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 2, 3.4, 1.6, 0, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 1;

    var wing = Math.sin(t * 34 + f.phase * 10) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(226,246,255,' + (0.28 + wing * 0.3) + ')';
    ctx.beginPath();
    ctx.ellipse(x - 2.6, y - 1, 3.6, 1.5 + wing * 1.6, -0.5, 0, 6.2832);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2.6, y - 1, 3.6, 1.5 + wing * 1.6, 0.5, 0, 6.2832);
    ctx.fill();

    ctx.fillStyle = f.hue > 0.5 ? '#f2c76a' : '#8fd8b0';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.6, 1.7, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* ---- interaction highlight -------------------------------------------- */

  function drawTargetRing(ctx, target, progress, t) {
    if (!target) return;
    var r = target.kind === 'bramble' ? target.r * 0.9
          : (target.kind === 'landmark' ? target.radius * 0.8 : 18);
    ctx.save();
    ctx.translate(target.x, target.y);

    ctx.globalAlpha = 0.34 + Math.sin(t * 3) * 0.08;
    ctx.strokeStyle = '#ffe6a0';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.ellipse(0, 4, r + 8, (r + 8) * 0.52, 0, 0, 6.2832);
    ctx.stroke();
    ctx.setLineDash([]);

    if (progress > 0.02) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(0, 4, r + 8, (r + 8) * 0.52, 0,
                  -Math.PI / 2, -Math.PI / 2 + progress * 6.2832);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- lighting --------------------------------------------------------- */

  function drawLight(ctx, w, h, player, t) {
    // Warm key light from the upper left, cool shadow elsewhere.
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    var g = ctx.createLinearGradient(0, 0, w * 0.7, h);
    g.addColorStop(0, 'rgba(255,226,160,0.22)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.04)');
    g.addColorStop(1, 'rgba(20,50,70,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Slow sun shafts.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.028;
    ctx.fillStyle = '#ffeec0';
    for (var i = 0; i < 3; i++) {
      var off = ((t * 6 + i * 420) % (w + 900)) - 450;
      ctx.save();
      ctx.translate(off, -100);
      ctx.rotate(0.38);
      ctx.fillRect(0, 0, 110 + i * 46, h * 2);
      ctx.restore();
    }
    ctx.restore();

    // Vignette, tighter when swimming so the pool feels enclosing.
    var vr = Math.max(w, h) * (player.swimming ? 0.62 : 0.78);
    var vg = ctx.createRadialGradient(w / 2, h / 2, vr * 0.42, w / 2, h / 2, vr);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, player.swimming ? 'rgba(4,22,34,0.6)' : 'rgba(4,14,10,0.46)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---- main entry -------------------------------------------------------- */

  R.draw = function (ctx, cam, player, t, targetInfo) {
    var w = cam.viewW, h = cam.viewH;
    var wind = t * 1.15;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1c17';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    cam.applyTransform(ctx);
    var view = cam.viewRect(180);

    // Baked ground, blitted at the view rectangle only.
    var s = T.scale;
    var sx = U.clamp(view.x0 * s, 0, T.ground.width);
    var sy = U.clamp(view.y0 * s, 0, T.ground.height);
    var sw = U.clamp((view.x1 - view.x0) * s, 1, T.ground.width - sx);
    var sh = U.clamp((view.y1 - view.y0) * s, 1, T.ground.height - sy);
    ctx.drawImage(T.ground, sx, sy, sw, sh, sx / s, sy / s, sw / s, sh / s);

    drawWater(ctx, view, t);
    drawDetail(ctx, view, t, wind);
    drawCliffs(ctx, view, t);

    // Skimmers sit on the water surface, below everything solid.
    var i;
    for (i = 0; i < C.skimmers.length; i++) {
      var sk = C.skimmers[i];
      if (sk.x < view.x0 || sk.x > view.x1 || sk.y < view.y0 || sk.y > view.y1) continue;
      drawSkimmer(ctx, sk, t);
    }

    if (targetInfo && targetInfo.target) {
      drawTargetRing(ctx, targetInfo.target, targetInfo.progress || 0, t);
    }

    /* Everything that can occlude or be occluded, sorted by ground Y. */
    sortBuf.length = 0;
    function consider(list, kind) {
      for (var k = 0; k < list.length; k++) {
        var o = list[k];
        var pad = kind === 'tree' ? 260 : 120;
        if (o.x < view.x0 - pad || o.x > view.x1 + pad ||
            o.y < view.y0 - pad || o.y > view.y1 + pad) continue;
        sortBuf.push({ o: o, y: o.y, kind: kind });
      }
    }
    consider(W.rocks, 'rock');
    consider(W.brambles, 'bramble');
    consider(W.nodes, 'node');
    consider(W.landmarks, 'landmark');
    consider(W.trees, 'tree');
    consider(C.burrowers, 'burrower');
    sortBuf.push({ o: player, y: player.y, kind: 'player' });
    sortBuf.sort(function (a, b) { return a.y - b.y; });

    for (i = 0; i < sortBuf.length; i++) {
      var it = sortBuf[i];
      switch (it.kind) {
        case 'rock': drawRock(ctx, it.o, t); break;
        case 'bramble': drawBramble(ctx, it.o, t); break;
        case 'node': drawNode(ctx, it.o, t); break;
        case 'landmark': drawLandmark(ctx, it.o, t); break;
        case 'tree': drawTree(ctx, it.o, t); break;
        case 'burrower': drawBurrower(ctx, it.o, t); break;
        case 'player': R.drawPlayer(ctx, player, t); break;
      }
    }

    EVO.FX.draw(ctx);

    // Flits and pollen ride above everything.
    for (i = 0; i < C.motes.length; i++) {
      var m = C.motes[i];
      if (m.x < view.x0 || m.x > view.x1 || m.y < view.y0 || m.y > view.y1) continue;
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = '#fff4cf';
      ctx.beginPath();
      ctx.arc(m.x, m.y - m.z, m.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (i = 0; i < C.flits.length; i++) {
      var f = C.flits[i];
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) continue;
      drawFlit(ctx, f, t);
    }

    ctx.restore();

    drawLight(ctx, w, h, player, t);
  };

  R.drawPlayer = function (ctx, player, t) {
    ctx.save();
    ctx.translate(player.x, player.y);

    if (player.inWater) {
      EVO.Creature.drawWaterContact(ctx, {
        swimming: player.swimming
      }, t);
    }

    EVO.Creature.draw(ctx, {
      facing: player.facing,
      speedNorm: player.speedNorm,
      walkPhase: player.walkPhase,
      hop: player.hop,
      squashX: player.squashX,
      squashY: player.squashY,
      swimming: player.swimming,
      inWater: player.inWater,
      adapt: A.unlocked,
      blink: player.blink,
      harvest: player.harvest,
      flash: player.flash
    }, t);

    // Submerged creatures get a waterline wash over the lower half.
    if (player.swimming) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#1d5f80';
      ctx.beginPath();
      ctx.ellipse(0, 6, 24, 13, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  EVO.Render = R;
})(window.EVO);
