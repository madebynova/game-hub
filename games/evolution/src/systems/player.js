/* The player creature: movement, water, the leap, and the two kinds of
   progress that come from simply moving around (ground covered, time spent in
   water).

   Movement is velocity-based with real acceleration and a separate turn rate,
   because a creature that changes direction instantly reads as a cursor, not
   an animal. Deceleration is faster than acceleration so stopping still feels
   tight. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;
  var A = EVO.Adapt;

  var EXPLORE_CELL = 190;
  var RADIUS = 12;

  /* The leap has to clear the Windfall Gap with room to spare. The chasm plus
     the creature's radius on both banks comes to ~228px, so anything close to
     that turns the one Mobility payoff into a pixel-perfect stunt. 270 lands it
     comfortably even at an angle, and deep water still stops it regardless of
     distance, so the other gates are unaffected. */
  var LEAP_DIST = 270;
  var LEAP_TIME = 0.5;
  var LEAP_COOLDOWN = 0.85;

  var P = {
    x: 900, y: 1420,
    vx: 0, vy: 0,
    facing: -Math.PI / 2,

    speedNorm: 0,
    walkPhase: 0,
    hop: 0,
    squashX: 1, squashY: 1,

    inWater: false,
    swimming: false,
    depth: -1,

    blink: 0,
    blinkTimer: 2,
    harvest: 0,
    flash: 0,

    leapCd: 0,
    leapT: -1,
    leapDX: 0, leapDY: 0,
    leapDone: 0,

    stepAccum: 0,
    waterTime: 0,
    distance: 0,
    playtime: 0,

    explored: Object.create(null),
    exploredCount: 0,

    zone: null,

    /* Hooks assigned by main. */
    onBlockedDeep: null,
    onStep: null,
    onSplash: null,
    onLeap: null,
    onLand: null,
    onNewGround: null,

    reset: function (spawnX, spawnY) {
      P.x = spawnX;
      P.y = spawnY;
      P.vx = P.vy = 0;
      P.facing = -Math.PI / 2;
      P.speedNorm = 0;
      P.walkPhase = 0;
      P.hop = 0;
      P.squashX = P.squashY = 1;
      P.leapT = -1;
      P.leapCd = 0;
      P.harvest = 0;
      P.flash = 0;
      P.waterTime = 0;
      P.distance = 0;
      P.playtime = 0;
      P.explored = Object.create(null);
      P.exploredCount = 0;
      P.zone = null;
      P.inWater = false;
      P.swimming = false;
    },

    isLeaping: function () { return P.leapT >= 0; },

    tryLeap: function () {
      if (!A.canLeap()) return false;
      if (P.leapT >= 0 || P.leapCd > 0) return false;
      if (P.swimming) return false;

      var ax = EVO.Input.axis.x, ay = EVO.Input.axis.y;
      var len = Math.sqrt(ax * ax + ay * ay);
      if (len > 0.1) {
        P.leapDX = ax / len;
        P.leapDY = ay / len;
      } else {
        P.leapDX = Math.cos(P.facing);
        P.leapDY = Math.sin(P.facing);
      }
      P.facing = Math.atan2(P.leapDY, P.leapDX);
      P.leapT = 0;
      P.leapDone = 0;
      P.squashX = 1.3;
      P.squashY = 0.74;
      if (P.onLeap) P.onLeap();
      return true;
    },

    /* --- movement ------------------------------------------------------ */

    update: function (dt, controlsEnabled) {
      P.playtime += dt;
      P.leapCd = Math.max(0, P.leapCd - dt);
      P.flash = Math.max(0, P.flash - dt * 3);

      var prevX = P.x, prevY = P.y;
      var wasSwimming = P.swimming;
      var wasInWater = P.inWater;

      if (P.leapT >= 0) {
        P.updateLeap(dt);
      } else {
        P.updateWalk(dt, controlsEnabled);
      }

      P.resolve();

      // Water state after the move, so the splash matches where we ended up.
      P.depth = W.depthAt(P.x, P.y);
      P.inWater = P.depth > 0;
      P.swimming = P.depth > W.SHALLOW_MAX && A.canSwim() && P.leapT < 0;

      if (P.inWater && !wasInWater && P.onSplash) P.onSplash(P.swimming);
      if (P.swimming && !wasSwimming && P.onSplash) P.onSplash(true);

      var moved = U.dist(prevX, prevY, P.x, P.y);
      P.distance += moved;

      P.trackExploration();
      P.accrueTrackProgress(dt, moved);
      P.animate(dt, moved);
    },

    updateWalk: function (dt, controlsEnabled) {
      var ax = controlsEnabled ? EVO.Input.axis.x : 0;
      var ay = controlsEnabled ? EVO.Input.axis.y : 0;
      var wants = (ax !== 0 || ay !== 0);

      var maxSpeed = A.moveSpeed();
      if (P.swimming) maxSpeed *= A.canSwim() ? 0.92 : 0.5;
      else if (P.inWater) maxSpeed *= A.shallowFactor();
      if (P.harvest > 0) maxSpeed *= 0.35;

      var accel = wants ? (P.swimming ? 620 : 1150) : 0;
      var drag = wants ? 3.2 : (P.swimming ? 4.2 : 10.5);

      P.vx += ax * accel * dt;
      P.vy += ay * accel * dt;

      // Clamp to max speed along the current heading.
      var sp = Math.sqrt(P.vx * P.vx + P.vy * P.vy);
      if (sp > maxSpeed) {
        P.vx = (P.vx / sp) * maxSpeed;
        P.vy = (P.vy / sp) * maxSpeed;
        sp = maxSpeed;
      }

      // Exponential drag keeps stopping smooth at any frame rate.
      var k = Math.exp(-drag * dt);
      if (!wants || sp > maxSpeed * 0.02) {
        P.vx *= k;
        P.vy *= k;
      }

      P.x += P.vx * dt;
      P.y += P.vy * dt;

      sp = Math.sqrt(P.vx * P.vx + P.vy * P.vy);
      P.speedNorm = U.clamp(sp / Math.max(1, A.moveSpeed()), 0, 1.4);

      if (sp > 6) {
        var want = Math.atan2(P.vy, P.vx);
        var turnRate = (P.swimming ? 6 : 13) * dt;
        P.facing = U.angleTowards(P.facing, want, turnRate);
      }
    },

    updateLeap: function (dt) {
      P.leapT += dt;
      var t = U.clamp(P.leapT / LEAP_TIME, 0, 1);

      // Distance profile: quick out of the gate, gliding at the end.
      var eased = 1 - Math.pow(1 - t, 2.1);
      var travel = eased * LEAP_DIST - P.leapDone;
      P.leapDone += travel;

      P.x += P.leapDX * travel;
      P.y += P.leapDY * travel;

      P.hop = Math.sin(t * Math.PI) * 34;
      P.speedNorm = 1.2;
      P.vx = P.leapDX * (LEAP_DIST / LEAP_TIME) * (1 - t);
      P.vy = P.leapDY * (LEAP_DIST / LEAP_TIME) * (1 - t);

      // Airborne stretch, then a squash on touchdown.
      P.squashX = U.lerp(1.24, 1, U.smoothstep(0, 0.7, t));
      P.squashY = U.lerp(0.8, 1, U.smoothstep(0, 0.7, t));

      if (t >= 1) {
        P.leapT = -1;
        P.hop = 0;
        P.leapCd = LEAP_COOLDOWN;
        P.squashX = 0.76;
        P.squashY = 1.26;
        P.vx *= 0.25;
        P.vy *= 0.25;
        P.landRecover();
        if (P.onLand) P.onLand();
      }
    },

    /* Cut a leap short mid-air: used when it runs into water it cannot cross. */
    abortLeap: function () {
      if (P.leapT < 0) return;
      P.leapT = -1;
      P.hop = 0;
      P.leapCd = LEAP_COOLDOWN * 0.6;
      P.squashX = 0.82;
      P.squashY = 1.18;
      P.vx *= 0.1;
      P.vy *= 0.1;
    },

    /* Never let a leap end somewhere the player could not otherwise be. */
    landRecover: function () {
      var chasm = W.inChasm(P.x, P.y, RADIUS);
      if (chasm) {
        var toTop = Math.abs(P.y - chasm.y);
        var toBottom = Math.abs((chasm.y + chasm.h) - P.y);
        var toLeft = Math.abs(P.x - chasm.x);
        var toRight = Math.abs((chasm.x + chasm.w) - P.x);
        var m = Math.min(toTop, toBottom, toLeft, toRight);
        if (m === toTop) P.y = chasm.y - RADIUS - 2;
        else if (m === toBottom) P.y = chasm.y + chasm.h + RADIUS + 2;
        else if (m === toLeft) P.x = chasm.x - RADIUS - 2;
        else P.x = chasm.x + chasm.w + RADIUS + 2;
      }
      if (!A.canSwim() && W.depthAt(P.x, P.y) > W.SHALLOW_MAX) {
        P.pushOutOfDeep();
      }
    },

    /* --- collision ------------------------------------------------------ */

    resolve: function () {
      var leaping = P.leapT >= 0;

      W.resolveCircle(P, RADIUS);
      W.resolveRects(P, RADIUS, W.cliffs);
      if (!leaping) W.resolveRects(P, RADIUS, W.chasms);

      // Deep water stops a leap as surely as it stops a step. Springcoil
      // crosses gaps in the ground - it is not a way over the pool, and if it
      // were, it would open Mirror Isle and the Cradle Heart on its own and
      // there would be no reason to develop Tidelung at all.
      if (!A.canSwim() && W.depthAt(P.x, P.y) > W.SHALLOW_MAX) {
        P.pushOutOfDeep();
        if (leaping) P.abortLeap();
        if (P.onBlockedDeep) P.onBlockedDeep();
      }

      W.clampToWorld(P, RADIUS);
    },

    /* Walk back along the depth gradient until we are in water we can stand
       in. Cheap, stable, and it slides the player along the shoreline rather
       than stopping them dead. */
    pushOutOfDeep: function () {
      var e = 6;
      for (var step = 0; step < 14; step++) {
        var d = W.depthAt(P.x, P.y);
        if (d <= W.SHALLOW_MAX) break;
        var gx = W.depthAt(P.x + e, P.y) - W.depthAt(P.x - e, P.y);
        var gy = W.depthAt(P.x, P.y + e) - W.depthAt(P.x, P.y - e);
        var len = Math.sqrt(gx * gx + gy * gy);
        if (len < 0.0001) { P.x -= 4; break; }
        P.x -= (gx / len) * Math.min(14, d - W.SHALLOW_MAX + 3);
        P.y -= (gy / len) * Math.min(14, d - W.SHALLOW_MAX + 3);
      }
      // Kill the inward part of the velocity so we do not judder against it.
      P.vx *= 0.3;
      P.vy *= 0.3;
    },

    /* --- progress ------------------------------------------------------- */

    trackExploration: function () {
      var cx = Math.floor(P.x / EXPLORE_CELL);
      var cy = Math.floor(P.y / EXPLORE_CELL);
      var key = cx + ':' + cy;
      if (P.explored[key]) return;
      P.explored[key] = true;
      P.exploredCount++;
      A.add('mobility', 2.0);
      if (P.onNewGround) P.onNewGround(cx, cy);
    },

    accrueTrackProgress: function (dt, moved) {
      if (P.inWater) {
        P.waterTime += dt;
        A.add('aquatic', dt * (P.swimming ? 1.8 : 1.1));
      }
    },

    /* --- animation ------------------------------------------------------ */

    animate: function (dt, moved) {
      // Gait speed follows actual ground speed, so the legs never skate.
      if (P.leapT < 0) {
        P.walkPhase += (P.swimming ? 4 : 11) * P.speedNorm * dt + (P.swimming ? dt * 2 : 0);
        P.hop = U.damp(P.hop, P.swimming ? Math.sin(P.playtime * 2.4) * 1.5 : 0, 12, dt);
      }

      P.squashX = U.damp(P.squashX, 1, 11, dt);
      P.squashY = U.damp(P.squashY, 1, 11, dt);

      // A gentle breathing squash when idle keeps it alive while standing.
      if (P.speedNorm < 0.08 && P.leapT < 0) {
        var breath = Math.sin(P.playtime * 1.9) * 0.022;
        P.squashX += breath * 0.6;
        P.squashY -= breath;
      }

      // Blinks: irregular, occasionally a double.
      P.blinkTimer -= dt;
      if (P.blinkTimer <= 0) {
        P.blink = 1;
        P.blinkTimer = U.range(Math.random, 1.8, 6.2);
      }
      P.blink = Math.max(0, P.blink - dt * 7.5);

      // Footfalls, timed off distance so they stay in step at any speed.
      if (P.leapT < 0 && P.speedNorm > 0.12) {
        P.stepAccum += moved;
        var stride = P.swimming ? 60 : 34;
        if (P.stepAccum > stride) {
          P.stepAccum = 0;
          if (P.onStep) P.onStep(P.inWater);
        }
      } else {
        P.stepAccum = 0;
      }
    },

    serialise: function () {
      var cells = [];
      for (var k in P.explored) if (P.explored[k]) cells.push(k);
      return {
        x: Math.round(P.x), y: Math.round(P.y),
        waterTime: Math.round(P.waterTime),
        distance: Math.round(P.distance),
        playtime: Math.round(P.playtime),
        explored: cells
      };
    },

    restore: function (data) {
      if (!data) return;
      if (typeof data.x === 'number') P.x = data.x;
      if (typeof data.y === 'number') P.y = data.y;
      P.waterTime = data.waterTime || 0;
      P.distance = data.distance || 0;
      P.playtime = data.playtime || 0;
      P.explored = Object.create(null);
      P.exploredCount = 0;
      if (data.explored && data.explored.length) {
        for (var i = 0; i < data.explored.length; i++) {
          P.explored[data.explored[i]] = true;
          P.exploredCount++;
        }
      }
      // Never load into geometry - saves predate any later layout change.
      P.resolve();
      if (!A.canSwim() && W.depthAt(P.x, P.y) > W.SHALLOW_MAX) P.pushOutOfDeep();
    }
  };

  P.RADIUS = RADIUS;
  P.EXPLORE_CELL = EXPLORE_CELL;

  EVO.Player = P;
})(window.EVO);
