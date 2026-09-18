/* The creature.

   Drawn entirely from paths so it can change shape as the player develops it -
   that matters more here than any sprite would, because the whole promise of
   the game is that this is *your* creature and you can see what you have made
   of it.

   Silhouette: a forward-heavy teardrop with a low centre of mass, three dorsal
   fronds breaking the outline, and a tail that trails. Large eyes set wide and
   forward so the facing direction is legible at a glance, even small.

   Adaptations rewrite parts of it:
     Tidelung   - broad caudal fin, gill frills, webbed feet, cooler skin
     Springcoil - long coiled hind legs, amber-tipped feet
     Rendmaw    - forward mandibles and a heavier jaw */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var Creature = {};

  var BASE_A = '#8fe3b4';   // lit skin
  var BASE_B = '#2f8f74';   // shaded skin
  var BELLY  = '#d9f7dd';

  function skinColours(a) {
    var lit = BASE_A, shade = BASE_B;
    if (a.aquatic) {
      lit = U.mixHex(lit, '#8fe0f0', 0.5);
      shade = U.mixHex(shade, '#1f6f92', 0.5);
    }
    if (a.gathering) {
      lit = U.mixHex(lit, '#cbe98a', 0.34);
      shade = U.mixHex(shade, '#4c7a30', 0.3);
    }
    if (a.mobility) {
      lit = U.mixHex(lit, '#f4d79a', 0.2);
    }
    return { lit: lit, shade: shade };
  }

  /* Small tapering leaf used for fronds and fins. */
  function leaf(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.closePath();
  }

  function drawShadow(ctx, c) {
    var lift = U.clamp(c.hop / 34, 0, 1);
    var s = 1 - lift * 0.42;
    ctx.save();
    ctx.globalAlpha = (c.swimming ? 0.12 : 0.3) * (1 - lift * 0.5);
    ctx.fillStyle = '#04120c';
    ctx.beginPath();
    ctx.ellipse(0, 7, 20 * s, 10 * s, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawTail(ctx, c, t, col) {
    var sway = Math.sin(t * (c.swimming ? 7.5 : 3.2) + c.walkPhase * 0.4) *
               (c.swimming ? 0.55 : 0.3) * (0.4 + c.speedNorm * 0.8);
    ctx.save();
    ctx.translate(-17, 0);
    ctx.rotate(Math.PI + sway);

    // Tapered trunk of the tail.
    ctx.fillStyle = col.shade;
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.quadraticCurveTo(10, -3.6, 17, -1.6);
    ctx.lineTo(17, 1.6);
    ctx.quadraticCurveTo(10, 3.6, 0, 5.5);
    ctx.closePath();
    ctx.fill();

    if (c.adapt.aquatic) {
      // Broad translucent caudal fin, with faint rays.
      ctx.save();
      ctx.translate(16, 0);
      ctx.rotate(Math.sin(t * 8.5) * 0.28);
      var g = ctx.createLinearGradient(0, 0, 16, 0);
      g.addColorStop(0, 'rgba(150,232,246,0.85)');
      g.addColorStop(1, 'rgba(120,205,235,0.25)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(12, -13, 18, -9);
      ctx.quadraticCurveTo(14, 0, 18, 9);
      ctx.quadraticCurveTo(12, 13, 0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,250,255,0.4)';
      ctx.lineWidth = 0.7;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(1, i * 1.3);
        ctx.lineTo(15, i * 7);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = col.shade;
      ctx.beginPath();
      ctx.ellipse(17, 0, 4.5, 2.6, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLeg(ctx, c, t, col, bx, by, isHind) {
    if (c.swimming) return;

    var long = isHind && c.adapt.mobility;
    var phase = c.walkPhase + (isHind ? 0 : Math.PI) + (by > 0 ? Math.PI : 0);
    var swing = Math.sin(phase) * (2.6 + c.speedNorm * 4.4) * (long ? 1.35 : 1);
    var lift = Math.max(0, Math.cos(phase)) * c.speedNorm * 1.6;

    // Limbs need real reach and weight, or from above they vanish under the
    // body and the creature looks like it is gliding.
    var reach = long ? 14 : 10.5;
    var fx = bx + swing;
    var fy = by + Math.sign(by) * reach;

    ctx.save();
    ctx.strokeStyle = col.shade;
    ctx.lineCap = 'round';
    ctx.lineWidth = long ? 4.4 : 3.8;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    if (long) {
      // Coiled hind limb: a visible kink that reads as stored spring.
      var kx = bx + swing * 0.4 - 3;
      var ky = by + Math.sign(by) * (reach * 0.55);
      ctx.quadraticCurveTo(kx, ky, fx, fy - lift);
    } else {
      ctx.lineTo(fx, fy - lift);
    }
    ctx.stroke();

    // Foot
    ctx.fillStyle = c.adapt.mobility && isHind ? '#f0b566' : col.lit;
    if (c.adapt.aquatic) {
      // Webbing: a small fan instead of a pad.
      ctx.save();
      ctx.translate(fx, fy - lift);
      ctx.rotate(Math.sign(by) * 0.5);
      ctx.globalAlpha = 0.95;
      // Webbing: a rounded fan, not a dart.
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.quadraticCurveTo(3, -4.4, 6, -2.4);
      ctx.quadraticCurveTo(7.2, 0, 6, 2.4);
      ctx.quadraticCurveTo(3, 4.4, -1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.ellipse(fx, fy - lift, 3.4, 2.7, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  /* The frill: leaf-shaped plates set around the back half of the body and
     pointing outward, so they break the silhouette instead of lying across the
     face. Seen from directly above there is no "up" for a dorsal fin to stand
     in, so the crest has to read at the outline or not at all. */
  function drawFronds(ctx, c, t, col) {
    var N = 5;
    var lit = c.adapt.aquatic ? 'rgba(190,244,255,0.95)' : 'rgba(198,240,192,0.95)';
    var mid = c.adapt.aquatic ? 'rgba(126,216,238,0.95)' : 'rgba(122,202,142,0.95)';

    for (var i = 0; i < N; i++) {
      var a = Math.PI * 0.56 + (i / (N - 1)) * Math.PI * 0.88;
      var ripple = Math.sin(t * 2.6 - i * 0.7 + c.walkPhase * 0.3) * 0.22
                 + (c.swimming ? Math.sin(t * 6 - i) * 0.26 : 0);
      // Longest in the middle of the run, tapering at both ends.
      var taper = 0.62 + Math.sin((i / (N - 1)) * Math.PI) * 0.5;
      var len = 12 * taper, wid = 4.4 * taper;

      var px = Math.cos(a) * 17;
      var py = Math.sin(a) * 13.2;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + ripple);

      var g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, U.rgba(col.shade, 0.95));
      g.addColorStop(0.5, mid);
      g.addColorStop(1, lit);
      ctx.fillStyle = g;
      leaf(ctx, len, wid);
      ctx.fill();

      ctx.strokeStyle = U.rgba(col.shade, 0.45);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(len - 1.5, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGills(ctx, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(126,232,252,0.9)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    var flare = 1 + Math.sin(t * 3.4) * 0.2;
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(2 - i * 3.4, side * 9.5, 3.4 * flare, side > 0 ? 0.2 : -1.35, side > 0 ? 1.35 : -0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMandibles(ctx, c, t) {
    var open = 0.25 + (c.harvest || 0) * 0.8 + Math.sin(t * 1.7) * 0.05;
    ctx.save();
    ctx.fillStyle = '#e8dfb4';
    ctx.strokeStyle = '#a89a5e';
    ctx.lineWidth = 0.6;
    for (var side = -1; side <= 1; side += 2) {
      // Short, heavy and hooked - thin curves read as whiskers from above.
      ctx.save();
      ctx.translate(15, side * 4.2);
      ctx.rotate(side * (0.3 + open * 0.45));
      ctx.beginPath();
      ctx.moveTo(-1, side * -2.4);
      ctx.quadraticCurveTo(6.5, side * -3.6, 8.6, side * -1.2);
      ctx.quadraticCurveTo(6, side * 1.2, 4.2, side * 3.4);
      ctx.quadraticCurveTo(2, side * 1.6, -1, side * 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEyes(ctx, c, t) {
    var blink = c.blink || 0;                    // 0 open, 1 shut
    var openness = 1 - U.smoothstep(0.35, 1, blink);
    var look = U.clamp(c.speedNorm * 1.3, 0, 1);

    for (var side = -1; side <= 1; side += 2) {
      var ex = 10.5, ey = side * 6.6;
      ctx.save();
      ctx.translate(ex, ey);

      // Eye white / membrane
      ctx.fillStyle = '#f4fff8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.7, 4.7 * Math.max(0.06, openness), 0, 0, 6.2832);
      ctx.fill();

      if (openness > 0.2) {
        ctx.fillStyle = '#10201c';
        ctx.beginPath();
        ctx.ellipse(1.2 + look * 0.9, side * 0.3, 2.7, 2.7 * openness, 0, 0, 6.2832);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(2.3 + look * 0.9, side * 0.3 - 1.1, 1.05, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(-0.4, side * 0.3 + 1.3, 0.6, 0, 6.2832);
        ctx.fill();
      }

      // Lid line - gives the face a shape even when shut.
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#123';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.7, 4.7 * Math.max(0.06, openness), 0, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* c: {
       facing, speedNorm, walkPhase, hop, squashX, squashY, swimming, inWater,
       adapt:{aquatic,mobility,gathering}, blink, harvest, glow, flash
     } */
  Creature.draw = function (ctx, c, t) {
    var col = skinColours(c.adapt);
    var traits = (c.adapt.aquatic ? 1 : 0) + (c.adapt.mobility ? 1 : 0) + (c.adapt.gathering ? 1 : 0);

    ctx.save();

    drawShadow(ctx, c);

    ctx.translate(0, -c.hop);
    ctx.rotate(c.facing);

    // Harvesting makes it lean in; that lean is most of the interaction feel.
    if (c.harvest > 0) ctx.translate(c.harvest * 2.6, 0);
    ctx.scale(c.squashX, c.squashY);

    drawTail(ctx, c, t, col);
    // Behind the body, so the plates emerge from under its edge.
    drawFronds(ctx, c, t, col);

    drawLeg(ctx, c, t, col, -10, -9, true);
    drawLeg(ctx, c, t, col, -10, 9, true);
    drawLeg(ctx, c, t, col, 4, -10, false);
    drawLeg(ctx, c, t, col, 4, 10, false);

    if (c.adapt.gathering) drawMandibles(ctx, c, t);

    // Body
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.bezierCurveTo(-19, -13, -6, -16.5, 6, -14.5);
    ctx.bezierCurveTo(16, -12.5, 21, -6, 21, 0);
    ctx.bezierCurveTo(21, 6, 16, 12.5, 6, 14.5);
    ctx.bezierCurveTo(-6, 16.5, -19, 13, -19, 0);
    ctx.closePath();

    var bodyGrad = ctx.createRadialGradient(2, -6, 2, 0, 2, 26);
    bodyGrad.addColorStop(0, col.lit);
    bodyGrad.addColorStop(0.55, U.mixHex(col.lit, col.shade, 0.55));
    bodyGrad.addColorStop(1, col.shade);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Belly plate, slightly offset so the body reads as rounded.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(3, 2.5, 12, 8.5, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();

    // Speckles - the only "texture", and they keep the silhouette from
    // looking like flat plastic.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#1d5c48';
    var spots = [[-11, -6, 2.1], [-6, 5, 1.6], [-13, 3, 1.3], [-2, -9, 1.5], [1, 8, 1.2]];
    for (var i = 0; i < spots.length; i++) {
      ctx.beginPath();
      ctx.ellipse(spots[i][0], spots[i][1], spots[i][2], spots[i][2] * 0.78, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();

    // Rim light along the top edge.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(232,255,240,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-15, -8.5);
    ctx.bezierCurveTo(-8, -15.5, 8, -15, 18, -6);
    ctx.stroke();
    ctx.restore();

    if (c.adapt.aquatic) drawGills(ctx, t);

    // Core light: brightens with every adaptation, so the creature literally
    // glows more the further it has come.
    var pulse = 0.55 + Math.sin(t * 2.1) * 0.12 + (c.flash || 0) * 0.9;
    var glowR = 7 + traits * 1.6;
    var cg = ctx.createRadialGradient(-1, 1, 0, -1, 1, glowR);
    var glowCol = traits >= 3 ? '#fff0b8' : '#ffe6a0';
    cg.addColorStop(0, U.rgba(glowCol, U.clamp(pulse, 0, 1)));
    cg.addColorStop(1, U.rgba(glowCol, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(-1, 1, glowR, 0, 6.2832);
    ctx.fill();

    drawEyes(ctx, c, t);

    ctx.restore();
  };

  /* Ripples and a waterline for when the creature is actually in the water.
     Drawn in world space around the creature, under it. */
  Creature.drawWaterContact = function (ctx, c, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(216,246,255,0.5)';
    ctx.lineWidth = 1.4;
    for (var i = 0; i < 3; i++) {
      var p = ((t * 0.7 + i * 0.33) % 1);
      ctx.globalAlpha = (1 - p) * (c.swimming ? 0.55 : 0.34);
      ctx.beginPath();
      ctx.ellipse(0, 3, 16 + p * 26, 8 + p * 13, 0, 0, 6.2832);
      ctx.stroke();
    }
    ctx.restore();
  };

  EVO.Creature = Creature;
})(window.EVO);
