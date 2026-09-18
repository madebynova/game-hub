/* Interaction: what the creature is close enough to touch, and what happens
   when it does.

   Harvesting is a short hold rather than a tap. That reads as effort, it gives
   the animation somewhere to go, and it makes Rendmaw's faster jaws something
   the hands notice and not just the numbers. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;
  var A = EVO.Adapt;
  var D = EVO.Discovery;

  var RANGE = 56;
  var BRAMBLE_HOLD = 1.25;

  var I = {
    target: null,
    hold: 0,
    holdNeed: 1,
    biomass: 0,

    /* Hooks assigned by main. */
    onHarvest: null,
    onBramble: null,
    onLandmark: null,
    onDenied: null,
    onHoldTick: null,

    reset: function () {
      I.target = null;
      I.hold = 0;
      I.biomass = 0;
      for (var i = 0; i < W.nodes.length; i++) {
        W.nodes[i].harvested = false;
        W.nodes[i].respawn = 0;
        W.nodes[i].pop = 0;
      }
      for (var j = 0; j < W.brambles.length; j++) {
        W.brambles[j].cleared = false;
        W.brambles[j].shake = 0;
      }
      for (var k = 0; k < W.landmarks.length; k++) {
        W.landmarks[k].used = false;
      }
    },

    /* --- finding a target ---------------------------------------------- */

    findTarget: function (px, py) {
      var best = null, bestD = RANGE * RANGE, i, d;

      for (i = 0; i < W.nodes.length; i++) {
        var n = W.nodes[i];
        if (n.harvested) continue;
        d = U.dist2(px, py, n.x, n.y);
        if (d < bestD) { bestD = d; best = n; }
      }

      for (i = 0; i < W.landmarks.length; i++) {
        var lm = W.landmarks[i];
        var lr = lm.radius + 26;
        d = U.dist2(px, py, lm.x, lm.y);
        if (d < lr * lr && d < bestD + lr * lr) {
          // Landmarks win ties: they are the deliberate, authored moments.
          if (!best || d < bestD + 900) { bestD = d; best = lm; }
        }
      }

      for (i = 0; i < W.brambles.length; i++) {
        var b = W.brambles[i];
        if (b.cleared) continue;
        var br = b.solidR + 34;
        d = U.dist2(px, py, b.x, b.y);
        if (d < br * br && (!best || d < bestD)) { bestD = d; best = b; }
      }

      return best;
    },

    /* What the HUD should say about the current target. */
    promptFor: function (target) {
      if (!target) return null;

      if (target.kind === 'node') {
        var def = target.def;
        if (def.requires && !A.has(def.requires)) {
          return { text: def.lockedText || 'You cannot open this yet', locked: true, key: 'E' };
        }
        var known = D.has(def.discovery);
        return {
          text: def.verb + ' ' + (known ? def.name : 'the growth'),
          locked: false, key: 'E', hold: true
        };
      }

      if (target.kind === 'bramble') {
        if (!A.canRend()) {
          return { text: 'Too dense for your jaws', locked: true, key: 'E' };
        }
        return { text: 'Tear through the bramble', locked: false, key: 'E', hold: true };
      }

      if (target.kind === 'landmark') {
        return { text: target.prompt, locked: false, key: 'E', hold: false };
      }
      return null;
    },

    /* --- per-frame ------------------------------------------------------ */

    update: function (dt, player, controlsEnabled) {
      var i;

      // Respawns keep the world stocked without letting one patch of ground be
      // farmed: by the time a Sporecap is back, walking on is quicker.
      for (i = 0; i < W.nodes.length; i++) {
        var n = W.nodes[i];
        if (n.harvested) {
          n.respawn -= dt;
          if (n.respawn <= 0) {
            n.harvested = false;
            n.pop = 0;
          }
        } else if (n.pop < 1) {
          n.pop = Math.min(1, n.pop + dt * 2.6);
        }
      }

      for (i = 0; i < W.brambles.length; i++) {
        if (W.brambles[i].shake > 0) W.brambles[i].shake = Math.max(0, W.brambles[i].shake - dt * 3);
      }

      var target = controlsEnabled && !player.isLeaping()
        ? I.findTarget(player.x, player.y)
        : null;

      if (target !== I.target) {
        I.target = target;
        I.hold = 0;
        // Seeing a bramble up close is itself the lesson about what it is.
        if (target && target.kind === 'bramble') D.discover('bramblethorn');
      }

      var prompt = I.promptFor(target);
      var holding = false;

      if (target && prompt && !prompt.locked && controlsEnabled) {
        var wantsHold = EVO.Input.isDown('KeyE');

        if (prompt.hold) {
          if (wantsHold) {
            holding = true;
            var need = target.kind === 'bramble'
              ? BRAMBLE_HOLD * A.harvestFactor()
              : target.def.holdTime * A.harvestFactor();
            I.holdNeed = need;

            var before = I.hold;
            I.hold += dt;
            if (Math.floor(I.hold * 9) !== Math.floor(before * 9) && I.onHoldTick) {
              I.onHoldTick(I.hold / need);
            }
            if (target.kind === 'bramble') target.shake = 1;

            if (I.hold >= need) {
              I.hold = 0;
              if (target.kind === 'bramble') I.clearBramble(target);
              else I.harvest(target);
              I.target = null;
              target = null;
              prompt = null;
            }
          } else {
            I.hold = Math.max(0, I.hold - dt * 2.4);
          }
        } else if (EVO.Input.consume('KeyE')) {
          I.useLandmark(target);
        }
      } else {
        I.hold = Math.max(0, I.hold - dt * 3);
        if (target && prompt && prompt.locked && controlsEnabled && EVO.Input.consume('KeyE')) {
          if (I.onDenied) I.onDenied(target, prompt);
        }
      }

      player.harvest = U.damp(player.harvest, holding ? 1 : 0, 12, dt);

      return { target: target, prompt: prompt, holding: holding, progress: I.hold / I.holdNeed };
    },

    /* --- effects -------------------------------------------------------- */

    harvest: function (node) {
      var def = node.def;
      node.harvested = true;
      node.respawn = def.respawn * U.range(Math.random, 0.85, 1.2);
      node.pop = 0;

      I.biomass += def.biomass;
      if (def.gathering) A.add('gathering', def.gathering);
      if (def.aquatic) A.add('aquatic', def.aquatic);

      if (def.discovery) D.discover(def.discovery);
      if (I.onHarvest) I.onHarvest(node);
    },

    clearBramble: function (b) {
      b.cleared = true;
      A.add('gathering', 3);
      I.biomass += 1;
      if (I.onBramble) I.onBramble(b);
    },

    useLandmark: function (lm) {
      lm.used = true;
      lm.glow = 1;
      if (lm.discovery) D.discover(lm.discovery);
      if (I.onLandmark) I.onLandmark(lm);
    },

    serialise: function () {
      var nodes = [];
      for (var i = 0; i < W.nodes.length; i++) {
        var n = W.nodes[i];
        if (n.harvested) nodes.push([i, Math.round(n.respawn)]);
      }
      var brambles = [];
      for (var j = 0; j < W.brambles.length; j++) {
        if (W.brambles[j].cleared) brambles.push(j);
      }
      var landmarks = [];
      for (var k = 0; k < W.landmarks.length; k++) {
        if (W.landmarks[k].used) landmarks.push(k);
      }
      return { biomass: I.biomass, nodes: nodes, brambles: brambles, landmarks: landmarks };
    },

    restore: function (data) {
      I.reset();
      if (!data) return;
      I.biomass = data.biomass || 0;
      var i;
      if (data.nodes) {
        for (i = 0; i < data.nodes.length; i++) {
          var rec = data.nodes[i];
          var n = W.nodes[rec[0]];
          if (n) { n.harvested = true; n.respawn = rec[1]; }
        }
      }
      if (data.brambles) {
        for (i = 0; i < data.brambles.length; i++) {
          var b = W.brambles[data.brambles[i]];
          if (b) b.cleared = true;
        }
      }
      if (data.landmarks) {
        for (i = 0; i < data.landmarks.length; i++) {
          var lm = W.landmarks[data.landmarks[i]];
          if (lm) lm.used = true;
        }
      }
    }
  };

  I.RANGE = RANGE;

  EVO.Interact = I;
})(window.EVO);
