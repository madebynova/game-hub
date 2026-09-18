/* Boot, the title screen, and the game loop that ties the systems together.

   The systems deliberately do not know about each other - the player does not
   know what a journal is, the journal does not know what water is. This file
   is the only place that decides "swimming into a new place means a discovery
   and a save". */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var W = EVO.World;
  var T = EVO.Terrain;
  var A = EVO.Adapt;
  var D = EVO.Discovery;
  var P = EVO.Player;
  var I = EVO.Interact;
  var S = EVO.Save;
  var FX = EVO.FX;
  var HUD = EVO.HUD;
  var Panels = EVO.Panels;
  var Audio = EVO.Audio;
  var Critters = EVO.Critters;
  var Render = EVO.Render;
  var Input = EVO.Input;

  function $(id) { return document.getElementById(id); }

  var SPAWN_X = 900, SPAWN_Y = 1420;

  var canvas, ctx, cam;
  var state = 'title';
  var time = 0;
  var last = 0;
  var dpr = 1;

  var saveTimer = 0;
  var critterTimer = 0;
  var blockedCooldown = 0;
  var lastZoneId = null;
  var targetInfo = null;

  var ZONE_DISCOVERY = {
    hollow: 'loc_hollow',
    pool: 'loc_pool',
    isle: 'mirror_isle',
    gap: 'loc_gap',
    shelf: 'loc_shelf',
    thorn: 'loc_thorn',
    heart: 'cradle_heart'
  };

  /* ---- canvas ---------------------------------------------------------- */

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    cam.viewW = w;
    cam.viewH = h;
    // Keep a constant slice of world on screen vertically, so the creature is
    // the same size for everyone and never gets lost in the meadow.
    cam.targetZoom = U.clamp(h / 540, 1.05, 2.2);
    if (state !== 'playing') cam.zoom = cam.targetZoom;
  }

  /* ---- wiring ----------------------------------------------------------- */

  function wire() {
    P.onStep = function (inWater) {
      FX.footPuff(P.x, P.y, inWater);
      Audio.step(inWater);
    };

    P.onSplash = function (big) {
      FX.splash(P.x, P.y, big);
      Audio.splash(big);
      if (big) cam.kick(3);
    };

    P.onLeap = function () {
      FX.leapPuff(P.x, P.y, P.leapDX, P.leapDY);
      Audio.leap();
    };

    P.onLand = function () {
      FX.landPuff(P.x, P.y);
      Audio.land();
      cam.kick(5);
    };

    P.onBlockedDeep = function () {
      if (blockedCooldown > 0) return;
      blockedCooldown = 1.6;
      FX.denied(P.x, P.y);
      FX.float(P.x, P.y, 'Too deep', '#bfe4ff');
      Audio.blocked();
    };

    I.onHarvest = function (node) {
      FX.harvestPop(node.x, node.y - 8, node.def.colour);
      FX.float(node.x, node.y - 10, '+' + node.def.biomass, '#ffd98a');
      Audio.harvest();
      P.flash = 1;
      cam.kick(1.6);
      markDirty(true);
    };

    I.onBramble = function (b) {
      FX.bramblePop(b.x, b.y);
      Audio.harvest();
      Audio.burst(0.3, 400, 1.2, 0.09);
      cam.kick(6);
      markDirty(true);
    };

    I.onLandmark = function (lm) {
      if (lm.id === 'sporebloom') {
        FX.sporeCloud(lm.x, lm.y - 26);
        Audio.burst(0.6, 700, 0.8, 0.06);
      } else if (lm.id === 'elderbough') {
        FX.ring(lm.x, lm.y, { r0: 20, r1: 210, duration: 1.1, colour: 'rgba(180,230,160,0.6)', width: 3 });
        FX.burst(lm.x, lm.y - 30, {
          count: 30, colour: '#b6e39a', speedMin: 20, speedMax: 90,
          lift: 70, lifeMin: 0.8, lifeMax: 1.8, gravity: 20, shape: 'spore'
        });
      } else if (lm.id === 'mirrorstone') {
        FX.ring(lm.x, lm.y, { r0: 10, r1: 170, duration: 1, colour: 'rgba(190,232,255,0.7)', width: 3 });
      } else if (lm.id === 'sunstone') {
        FX.ring(lm.x, lm.y, { r0: 14, r1: 200, duration: 1, colour: 'rgba(255,214,140,0.7)', width: 4 });
        FX.burst(lm.x, lm.y - 20, {
          count: 26, colour: '#ffd07a', speedMin: 30, speedMax: 120,
          lift: 90, lifeMin: 0.6, lifeMax: 1.4, gravity: 40, shape: 'spark'
        });
      } else if (lm.id === 'heart') {
        FX.unlockBurst(lm.x, lm.y - 20, '#cfe8ff');
        cam.kick(10);
        Audio.unlock();
      }
      Audio.ui();
      markDirty(true);
    };

    I.onDenied = function (target, prompt) {
      FX.denied(target.x, target.y);
      FX.float(target.x, target.y - 10, prompt.text, '#ffb4a2');
      Audio.blocked();
    };

    I.onHoldTick = function (progress) {
      Audio.harvestTick(progress);
    };

    A.onGain = function (id) {
      HUD.pulseTrack(id);
      HUD.refreshTracks();
    };

    A.onUnlock = function (def) {
      HUD.refreshTracks();
      HUD.refreshCreature(I.biomass);
      FX.unlockBurst(P.x, P.y, def.colour);
      cam.kick(14);
      Audio.unlock();
      HUD.playCeremony(def);
      markDirty(true);
    };

    D.onDiscover = function (id, entry) {
      var tone = null;
      if (entry.cat === 'location') {
        tone = 'mobility';
        A.add('mobility', 10);
      } else if (entry.cat === 'flora' || entry.cat === 'resource') {
        A.add('gathering', 6);
      } else if (entry.cat === 'fauna') {
        A.add('mobility', 5);
      }
      HUD.toast('Discovered', entry.name, entry.desc, tone);
      Audio.discovery();
      markDirty(true);
    };

    P.onNewGround = null;

    HUD.onCeremonyClose = function () {
      // Recentre attention on the creature after the overlay clears.
      cam.kick(2);
    };

    Panels.onChange = function (open) {
      Input.clear();
      if (!open) markDirty(false);
    };
    Panels.onNewGame = function () {
      Panels.close();
      beginGame(true);
    };
    Panels.onSaveNow = function () { S.save(); };
    Panels.onToggleAudio = function () {
      Audio.setMuted(!Audio.muted);
      S.settings.muted = Audio.muted;
      S.save();
    };
  }

  var dirty = false;
  function markDirty(immediate) {
    dirty = true;
    if (immediate) {
      S.save();
      dirty = false;
      saveTimer = 0;
    }
  }

  /* ---- title ------------------------------------------------------------ */

  function setupTitle() {
    var info = S.describe();
    var cont = $('btn-continue');
    var line = $('title-save-line');

    if (info) {
      cont.disabled = false;
      line.textContent = info.text;
    } else {
      cont.disabled = true;
      cont.classList.remove('primary');
      $('btn-new').classList.add('primary');
      line.textContent = S.available
        ? 'No creature yet.'
        : 'This browser is blocking storage, so progress will not be kept.';
    }

    cont.addEventListener('click', function () {
      if (cont.disabled) return;
      beginGame(false);
    });
    $('btn-new').addEventListener('click', function () { beginGame(true); });
  }

  function beginGame(fresh) {
    Audio.start();
    Audio.resume();

    if (fresh) {
      S.clear();
      A.reset();
      D.reset();
      I.reset();
      P.reset(SPAWN_X, SPAWN_Y);
      FX.clear();
      lastZoneId = null;
    } else {
      A.reset();
      D.reset();
      I.reset();
      P.reset(SPAWN_X, SPAWN_Y);
      FX.clear();
      lastZoneId = null;
      S.load();
    }

    Audio.setMuted(!!S.settings.muted);

    cam.snapTo(P.x, P.y);
    HUD.refreshTracks();
    HUD.refreshCreature(I.biomass);

    $('fade').classList.add('on');
    setTimeout(function () {
      $('title').classList.add('hidden');
      HUD.show();
      state = 'playing';
      // First steps should not be silent: say where we are.
      var z = W.zoneAt(P.x, P.y);
      if (z) {
        lastZoneId = z.id;
        HUD.showZone(z);
        D.discover(ZONE_DISCOVERY[z.id]);
      }
      $('fade').classList.remove('on');
      S.save();
    }, 480);
  }

  /* ---- keys -------------------------------------------------------------- */

  function setupKeys() {
    Input.on(function (code) {
      if (state !== 'playing') return;

      if (HUD.ceremonyOpen) {
        if (code === 'Space' || code === 'Enter' || code === 'Escape' || code === 'KeyE') {
          HUD.closeCeremony();
        }
        return;
      }

      if (code === 'Escape') {
        if (Panels.open) Panels.close();
        else Panels.show('menu');
        return;
      }
      if (Panels.open) {
        if (code === 'KeyJ' || code === 'KeyC') Panels.toggle(code === 'KeyJ' ? 'journal' : 'creature');
        return;
      }
      if (code === 'KeyJ') { Panels.show('journal'); Audio.ui(); return; }
      if (code === 'KeyC') { Panels.show('creature'); Audio.ui(); return; }
      if (code === 'Space') { P.tryLeap(); return; }
    });

    document.querySelectorAll('#buttons .btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state !== 'playing') return;
        var which = btn.dataset.panel || 'menu';
        Panels.toggle(which);
        Audio.ui();
      });
    });
  }

  /* ---- loop --------------------------------------------------------------- */

  function frame(now) {
    requestAnimationFrame(frame);

    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    dt = U.clamp(dt, 0, 0.05);

    if (state !== 'playing') {
      // Still render the world behind the title so the game never looks dead.
      time += dt;
      drawFrame(dt);
      return;
    }

    var paused = !!Panels.open || HUD.ceremonyOpen || document.hidden;
    var controls = !paused;

    time += dt;
    Input.update();

    if (!paused) {
      blockedCooldown = Math.max(0, blockedCooldown - dt);

      P.update(dt, controls);
      targetInfo = I.update(dt, P, controls);
      Critters.update(dt, time, P);
      FX.update(dt);

      checkZone();
      checkCritters(dt);

      Audio.update(dt);
      Audio.setWaterProximity(P.inWater ? 1 : U.clamp(1 - (0 - Math.min(0, W.depthAt(P.x, P.y))) / 420, 0, 0.8));

      saveTimer += dt;
      if (saveTimer > 14 && dirty) {
        S.save();
        dirty = false;
        saveTimer = 0;
      }
    }

    cam.update(P, paused ? 0 : dt, { w: W.width, h: W.height });
    HUD.setPrompt(paused ? null : (targetInfo && targetInfo.prompt), targetInfo && targetInfo.holding);
    HUD.update(dt, P, I.biomass);

    drawFrame(dt);
  }

  function drawFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    Render.draw(ctx, cam, P, time, targetInfo);
  }

  function checkZone() {
    var z = W.zoneAt(P.x, P.y);
    var id = z ? z.id : null;
    if (id === lastZoneId) return;
    lastZoneId = id;
    if (!z) return;
    HUD.showZone(z);
    D.discover(ZONE_DISCOVERY[z.id]);
  }

  function checkCritters(dt) {
    critterTimer -= dt;
    if (critterTimer > 0) return;
    critterTimer = 0.4;
    var kind = Critters.observedNear(P.x, P.y, 96);
    if (kind) D.discover(kind);
  }

  /* ---- boot ---------------------------------------------------------------- */

  function boot() {
    canvas = $('game');
    ctx = canvas.getContext('2d');
    cam = new EVO.Camera();

    W.generate();
    T.bake();
    Critters.spawn();

    Input.init();
    HUD.init();
    Panels.init();
    wire();
    setupKeys();
    setupTitle();

    // Idle camera over the Hollow while the title is up.
    P.reset(SPAWN_X, SPAWN_Y);
    HUD.refreshTracks();
    HUD.refreshCreature(0);

    resize();
    cam.snapTo(SPAWN_X, SPAWN_Y);
    window.addEventListener('resize', resize);

    window.addEventListener('beforeunload', function () {
      if (state === 'playing') S.save();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'playing') S.save();
      else if (!document.hidden) { last = 0; Audio.resume(); }
    });

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.EVO);
