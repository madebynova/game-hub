/* The HUD: adaptation tracks, creature card, prompts, toasts, zone banner,
   minimap and the unlock ceremony.

   Rule followed throughout: the world is the thing being looked at. Everything
   here sits in a corner, stays small, and says only what the player needs in
   order to know what to do next. */

(function (EVO) {
  'use strict';

  var U = EVO.U;
  var A = EVO.Adapt;
  var D = EVO.Discovery;
  var W = EVO.World;

  function $(id) { return document.getElementById(id); }

  var els = {};
  var trackEls = {};
  var toastQueue = [];
  var zoneTimer = 0;

  var HUD = {
    ceremonyOpen: false,
    ceremonyQueue: [],
    onCeremonyClose: null,

    init: function () {
      els.hud = $('hud');
      els.stageName = $('stage-name');
      els.chips = $('trait-chips');
      els.biomass = $('biomass');
      els.prompt = $('prompt');
      els.promptKey = $('prompt-key');
      els.promptText = $('prompt-text');
      els.toasts = $('toasts');
      els.zoneBanner = $('zone-banner');
      els.zoneName = $('zone-name');
      els.zoneSub = $('zone-sub');
      els.abilities = $('abilities');
      els.ceremony = $('ceremony');
      els.cerInner = $('cer-inner');
      els.cerName = $('cer-name');
      els.cerTrack = $('cer-track');
      els.cerDesc = $('cer-desc');
      els.cerGain = $('cer-gain');
      els.minimap = $('minimap');
      els.minimapCtx = els.minimap.getContext('2d');

      A.order.forEach(function (id) {
        var root = document.querySelector('.track[data-track="' + id + '"]');
        trackEls[id] = {
          root: root,
          fill: root.querySelector('.track-bar i'),
          flash: root.querySelector('.track-bar b'),
          val: root.querySelector('.track-val'),
          hint: root.querySelector('.track-hint')
        };
        trackEls[id].hint.textContent = A.DEFS[id].hint;
      });

      // Leap readout only exists once there is a leap to read out.
      els.abilities.innerHTML =
        '<div class="ability" id="ability-leap" style="display:none">' +
          '<span class="a-fill"></span><kbd>Space</kbd><span class="a-label">Leap</span>' +
        '</div>';
      els.leap = $('ability-leap');
      els.leapFill = els.leap.querySelector('.a-fill');
    },

    show: function () { els.hud.classList.remove('hidden'); },
    hide: function () { els.hud.classList.add('hidden'); },

    /* --- tracks / creature card ----------------------------------------- */

    refreshTracks: function () {
      A.order.forEach(function (id) {
        var t = trackEls[id];
        var done = A.has(id);
        var val = done ? A.GOAL : Math.floor(A.progress[id]);
        t.fill.style.width = (A.ratio(id) * 100) + '%';
        t.val.innerHTML = val + '<i>/' + A.GOAL + '</i>';
        t.root.classList.toggle('done', done);
        t.root.classList.toggle('ready', !done && A.progress[id] >= A.GOAL * 0.75);
        if (done) t.hint.textContent = A.DEFS[id].name + ' developed';
      });
    },

    pulseTrack: function (id) {
      var t = trackEls[id];
      if (!t) return;
      t.root.classList.remove('gain');
      void t.root.offsetWidth;   // restart the flash animation
      t.root.classList.add('gain');
    },

    refreshCreature: function (biomass) {
      els.stageName.textContent = A.stageName();
      els.biomass.textContent = biomass;

      var traits = A.traits();
      var have = {};
      Array.prototype.forEach.call(els.chips.children, function (c) { have[c.dataset.id] = c; });

      traits.forEach(function (def) {
        if (have[def.id]) return;
        var chip = document.createElement('span');
        chip.className = 'chip fresh ' + def.id;
        chip.dataset.id = def.id;
        chip.textContent = def.name;
        els.chips.appendChild(chip);
        setTimeout(function () { chip.classList.remove('fresh'); }, 600);
      });
    },

    /* --- prompt ---------------------------------------------------------- */

    setPrompt: function (prompt, holding) {
      if (!prompt) {
        els.prompt.classList.add('hidden');
        els.prompt.classList.remove('show');
        return;
      }
      if (els.prompt.classList.contains('hidden')) {
        els.prompt.classList.remove('hidden');
        els.prompt.classList.remove('show');
        void els.prompt.offsetWidth;
        els.prompt.classList.add('show');
      }
      els.promptKey.textContent = prompt.key;
      els.promptText.textContent = prompt.text;
      els.prompt.classList.toggle('locked', !!prompt.locked);
      els.prompt.classList.toggle('holding', !!holding);
    },

    /* --- toasts ---------------------------------------------------------- */

    toast: function (kicker, name, desc, tone) {
      var el = document.createElement('div');
      el.className = 'toast' + (tone ? ' ' + tone : '');
      var html = '<div class="t-kicker"></div><div class="t-name"></div>';
      if (desc) html += '<div class="t-desc"></div>';
      el.innerHTML = html;
      el.querySelector('.t-kicker').textContent = kicker;
      el.querySelector('.t-name').textContent = name;
      if (desc) el.querySelector('.t-desc').textContent = desc;

      els.toasts.appendChild(el);

      // Keep the stack short; the world matters more than the notifications.
      while (els.toasts.children.length > 4) {
        els.toasts.removeChild(els.toasts.firstChild);
      }

      setTimeout(function () {
        el.classList.add('out');
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 360);
      }, 4600);
    },

    /* --- zone banner ------------------------------------------------------ */

    showZone: function (zone) {
      els.zoneName.textContent = zone.name;
      els.zoneSub.textContent = zone.sub;
      els.zoneBanner.classList.remove('hidden', 'show');
      void els.zoneBanner.offsetWidth;
      els.zoneBanner.classList.add('show');
      zoneTimer = 3.7;
    },

    /* --- abilities -------------------------------------------------------- */

    refreshAbilities: function (player) {
      if (!A.canLeap()) {
        els.leap.style.display = 'none';
        return;
      }
      els.leap.style.display = '';
      var ready = player.leapCd <= 0 && player.leapT < 0;
      var pct = ready ? 100 : (1 - player.leapCd / 0.85) * 100;
      els.leapFill.style.width = U.clamp(pct, 0, 100) + '%';
      els.leap.classList.toggle('cooling', !ready);
    },

    /* --- unlock ceremony --------------------------------------------------- */

    playCeremony: function (def) {
      HUD.ceremonyQueue.push(def);
      if (!HUD.ceremonyOpen) HUD.nextCeremony();
    },

    nextCeremony: function () {
      var def = HUD.ceremonyQueue.shift();
      if (!def) {
        HUD.ceremonyOpen = false;
        els.ceremony.classList.add('hidden');
        if (HUD.onCeremonyClose) HUD.onCeremonyClose();
        return;
      }
      HUD.ceremonyOpen = true;
      els.cerInner.className = def.id;
      els.cerName.textContent = def.name;
      els.cerTrack.textContent = def.track + ' adaptation';
      els.cerDesc.textContent = def.blurb;
      els.cerGain.textContent = def.gain;
      els.ceremony.classList.remove('hidden');
    },

    closeCeremony: function () {
      if (!HUD.ceremonyOpen) return false;
      HUD.nextCeremony();
      return true;
    },

    /* --- minimap ----------------------------------------------------------- */

    /* Fog of exploration reuses the same grid that feeds Mobility progress, so
       the map fills in exactly as fast as the track does. */
    drawMinimap: function (player) {
      var c = els.minimapCtx;
      var size = els.minimap.width;
      var cell = EVO.Player.EXPLORE_CELL;
      var span = 1500;                   // world units across the whole dial
      var k = size / span;

      c.clearRect(0, 0, size, size);
      c.save();
      c.translate(size / 2, size / 2);

      c.fillStyle = 'rgba(8,24,18,0.55)';
      c.fillRect(-size / 2, -size / 2, size, size);

      var ox = player.x, oy = player.y;
      var cx0 = Math.floor((ox - span / 2) / cell);
      var cx1 = Math.floor((ox + span / 2) / cell);
      var cy0 = Math.floor((oy - span / 2) / cell);
      var cy1 = Math.floor((oy + span / 2) / cell);

      for (var gy = cy0; gy <= cy1; gy++) {
        for (var gx = cx0; gx <= cx1; gx++) {
          if (!player.explored[gx + ':' + gy]) continue;
          var wx = gx * cell, wy = gy * cell;
          var sx = (wx - ox) * k, sy = (wy - oy) * k;
          var s = cell * k + 1;
          // Colour the tile by what is actually there.
          var mid = W.depthAt(wx + cell / 2, wy + cell / 2);
          if (mid > W.SHALLOW_MAX) c.fillStyle = 'rgba(30,86,120,0.85)';
          else if (mid > 0) c.fillStyle = 'rgba(68,150,168,0.8)';
          else if (wy < 720) c.fillStyle = 'rgba(112,110,92,0.8)';
          else if (wx < 950 && wy > 1800) c.fillStyle = 'rgba(38,70,50,0.85)';
          else c.fillStyle = 'rgba(62,116,74,0.85)';
          c.fillRect(sx, sy, s, s);
        }
      }

      // Landmarks the player has already found, as small gold pips.
      c.fillStyle = 'rgba(255,217,138,0.95)';
      for (var i = 0; i < W.landmarks.length; i++) {
        var lm = W.landmarks[i];
        if (!lm.used) continue;
        var lx = (lm.x - ox) * k, ly = (lm.y - oy) * k;
        if (lx * lx + ly * ly > (size / 2 - 6) * (size / 2 - 6)) continue;
        c.beginPath();
        c.arc(lx, ly, 2.6, 0, 6.2832);
        c.fill();
      }

      // The creature, always dead centre, pointing where it faces.
      c.save();
      c.rotate(player.facing);
      c.fillStyle = '#eafff2';
      c.beginPath();
      c.moveTo(5.5, 0);
      c.lineTo(-3.5, -3.6);
      c.lineTo(-1.6, 0);
      c.lineTo(-3.5, 3.6);
      c.closePath();
      c.fill();
      c.restore();

      c.restore();
    },

    /* --- per-frame ---------------------------------------------------------- */

    update: function (dt, player, biomass) {
      if (zoneTimer > 0) {
        zoneTimer -= dt;
        if (zoneTimer <= 0) els.zoneBanner.classList.add('hidden');
      }
      HUD.refreshAbilities(player);
      HUD.drawMinimap(player);
      els.biomass.textContent = biomass;
    }
  };

  EVO.HUD = HUD;
})(window.EVO);
