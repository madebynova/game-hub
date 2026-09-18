/* Ambient life.

   Three small animals that do not fight, drop loot or block anything. They
   exist so the Cradle keeps moving when the player stands still, and so that
   walking toward something you noticed is occasionally rewarded: each species
   is a journal entry the first time you get close enough to watch one. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;

  var C = {
    flits: [],
    skimmers: [],
    burrowers: [],
    motes: []
  };

  C.spawn = function () {
    var rand = U.rng(5150);
    var i;

    C.flits.length = 0;
    C.skimmers.length = 0;
    C.burrowers.length = 0;
    C.motes.length = 0;

    /* Flits: paired wing-blurs that drift over meadow in loose swarms. */
    for (i = 0; i < 46; i++) {
      var hx, hy, tries = 0;
      do {
        hx = rand() * W.width;
        hy = U.range(rand, 780, W.height - 60);
        tries++;
      } while (W.depthAt(hx, hy) > -30 && tries < 40);
      C.flits.push({
        homeX: hx, homeY: hy,
        x: hx, y: hy,
        z: U.range(rand, 14, 34),
        phase: rand() * 6.28,
        speed: U.range(rand, 0.5, 1.1),
        radius: U.range(rand, 40, 120),
        wobble: rand() * 6.28,
        scared: 0,
        hue: rand()
      });
    }

    /* Skimmers: long-legged things that stand on the surface film and dart. */
    for (i = 0; i < 26; i++) {
      var sx, sy, t2 = 0;
      do {
        sx = rand() * W.width;
        sy = rand() * W.height;
        t2++;
      } while (W.depthAt(sx, sy) < 20 && t2 < 400);
      if (W.depthAt(sx, sy) < 20) continue;
      C.skimmers.push({
        x: sx, y: sy, homeX: sx, homeY: sy,
        a: rand() * 6.28,
        wait: U.range(rand, 0.4, 2.4),
        dart: 0,
        vx: 0, vy: 0,
        size: U.range(rand, 0.8, 1.3)
      });
    }

    /* Burrowers: they surface, look around, and drop back down when you get
       too close. Mostly found under the brambles. */
    for (i = 0; i < 22; i++) {
      var bx, by, t3 = 0;
      do {
        bx = rand() * W.width;
        by = rand() * W.height;
        t3++;
      } while ((W.depthAt(bx, by) > -24 || W.inCliff(bx, by, 10) || W.inChasm(bx, by, 10)) && t3 < 200);
      C.burrowers.push({
        x: bx, y: by,
        up: 0,                       // 0 buried, 1 fully out
        timer: U.range(rand, 1, 9),
        state: 'down',
        look: 0,
        seed: Math.floor(rand() * 999)
      });
    }

    /* Drifting pollen motes - pure atmosphere, no behaviour. */
    for (i = 0; i < 260; i++) {
      C.motes.push({
        x: rand() * W.width,
        y: rand() * W.height,
        z: U.range(rand, 4, 40),
        phase: rand() * 6.28,
        speed: U.range(rand, 4, 16),
        r: U.range(rand, 0.8, 2.2)
      });
    }
  };

  /* Returns the nearest critter kind the player is close enough to observe,
     so the discovery system can award it. */
  C.observedNear = function (px, py, range) {
    var i, r2 = range * range;
    for (i = 0; i < C.flits.length; i++) {
      if (U.dist2(px, py, C.flits[i].x, C.flits[i].y) < r2) return 'flit';
    }
    for (i = 0; i < C.skimmers.length; i++) {
      if (U.dist2(px, py, C.skimmers[i].x, C.skimmers[i].y) < r2) return 'skimmer';
    }
    for (i = 0; i < C.burrowers.length; i++) {
      var b = C.burrowers[i];
      if (b.up > 0.35 && U.dist2(px, py, b.x, b.y) < r2) return 'burrower';
    }
    return null;
  };

  C.update = function (dt, t, player) {
    var i;

    for (i = 0; i < C.flits.length; i++) {
      var f = C.flits[i];
      f.phase += dt * f.speed;
      f.wobble += dt * (2.2 + f.speed);

      var d = U.dist(f.x, f.y, player.x, player.y);
      if (d < 110) {
        // Scatter away from the player, then drift home.
        f.scared = 1;
        var ax = f.x - player.x, ay = f.y - player.y;
        var l = Math.max(1, Math.sqrt(ax * ax + ay * ay));
        f.homeX += (ax / l) * 90 * dt;
        f.homeY += (ay / l) * 90 * dt;
      } else {
        f.scared = U.damp(f.scared, 0, 1.4, dt);
      }

      f.x = f.homeX + Math.cos(f.phase) * f.radius;
      f.y = f.homeY + Math.sin(f.phase * 1.37) * f.radius * 0.6;
      f.z = 18 + Math.sin(f.wobble) * 8 + f.scared * 14;

      f.homeX = U.clamp(f.homeX, 40, W.width - 40);
      f.homeY = U.clamp(f.homeY, 40, W.height - 40);
    }

    for (i = 0; i < C.skimmers.length; i++) {
      var s = C.skimmers[i];
      if (s.dart > 0) {
        s.dart -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.9;
        s.vy *= 0.9;
        if (W.depthAt(s.x, s.y) < 12) {   // never leave the water
          s.x -= s.vx * dt * 2;
          s.y -= s.vy * dt * 2;
          s.dart = 0;
        }
      } else {
        s.wait -= dt;
        var pd = U.dist(s.x, s.y, player.x, player.y);
        if (s.wait <= 0 || pd < 90) {
          s.a = pd < 90
            ? Math.atan2(s.y - player.y, s.x - player.x)
            : Math.random() * 6.28;
          var power = pd < 90 ? 340 : 190;
          s.vx = Math.cos(s.a) * power;
          s.vy = Math.sin(s.a) * power;
          s.dart = 0.32;
          s.wait = U.range(Math.random, 0.7, 3.2);
        }
      }
    }

    for (i = 0; i < C.burrowers.length; i++) {
      var b = C.burrowers[i];
      var pdist = U.dist(b.x, b.y, player.x, player.y);
      b.timer -= dt;

      if (b.state === 'down') {
        b.up = U.damp(b.up, 0, 6, dt);
        if (b.timer <= 0 && pdist > 150) {
          b.state = 'up';
          b.timer = U.range(Math.random, 2.5, 6);
        }
      } else {
        b.up = U.damp(b.up, 1, 5, dt);
        b.look += dt * 1.6;
        if (b.timer <= 0 || pdist < 96) {
          b.state = 'down';
          b.timer = U.range(Math.random, 3, 11);
        }
      }
    }

    for (i = 0; i < C.motes.length; i++) {
      var m = C.motes[i];
      m.phase += dt * 0.6;
      m.x += Math.cos(m.phase * 0.7) * m.speed * dt + 5 * dt;
      m.y += Math.sin(m.phase) * m.speed * 0.5 * dt;
      if (m.x > W.width) m.x -= W.width;
      if (m.x < 0) m.x += W.width;
      if (m.y > W.height) m.y -= W.height;
      if (m.y < 0) m.y += W.height;
    }
  };

  EVO.Critters = C;
})(window.EVO);
