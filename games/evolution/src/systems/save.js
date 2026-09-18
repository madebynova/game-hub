/* Local save.

   One slot in localStorage, written on a timer and immediately after anything
   the player would be upset to lose (an unlock, a discovery, a harvest). No
   backend, nothing to sign into - the creature belongs to this browser.

   Every read is defensive: a save from an older layout, a corrupted string, or
   a browser with storage disabled must all end up as "start fresh" rather than
   a broken game. */

(function (EVO) {
  'use strict';

  var KEY = 'evolution.cradle.v1';
  var VERSION = 1;

  var S = {
    available: (function () {
      try {
        var t = '__evo_test__';
        window.localStorage.setItem(t, '1');
        window.localStorage.removeItem(t);
        return true;
      } catch (e) {
        return false;
      }
    })(),

    lastSavedAt: 0,

    settings: { muted: false },

    read: function () {
      if (!S.available) return null;
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (!data || data.v !== VERSION) return null;
        return data;
      } catch (e) {
        return null;
      }
    },

    has: function () { return !!S.read(); },

    save: function () {
      if (!S.available) return false;
      try {
        var data = {
          v: VERSION,
          savedAt: Date.now(),
          adapt: EVO.Adapt.serialise(),
          discovery: EVO.Discovery.serialise(),
          player: EVO.Player.serialise(),
          world: EVO.Interact.serialise(),
          settings: S.settings
        };
        window.localStorage.setItem(KEY, JSON.stringify(data));
        S.lastSavedAt = data.savedAt;
        return true;
      } catch (e) {
        return false;
      }
    },

    load: function () {
      var data = S.read();
      if (!data) return false;
      EVO.Adapt.restore(data.adapt);
      EVO.Discovery.restore(data.discovery);
      EVO.Interact.restore(data.world);
      EVO.Player.restore(data.player);
      if (data.settings) S.settings.muted = !!data.settings.muted;
      S.lastSavedAt = data.savedAt || 0;
      return true;
    },

    clear: function () {
      if (!S.available) return;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
      S.lastSavedAt = 0;
    },

    /* One line for the title screen, so "Continue" is not a leap of faith. */
    describe: function () {
      var data = S.read();
      if (!data) return null;
      var found = (data.discovery || []).length;
      var unlocked = 0;
      if (data.adapt && data.adapt.unlocked) {
        ['aquatic', 'mobility', 'gathering'].forEach(function (k) {
          if (data.adapt.unlocked[k]) unlocked++;
        });
      }
      var when = data.savedAt ? new Date(data.savedAt) : null;
      var stamp = when
        ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
          ', ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : 'unknown';
      return {
        adaptations: unlocked,
        discoveries: found,
        playtime: (data.player && data.player.playtime) || 0,
        text: unlocked + ' adaptation' + (unlocked === 1 ? '' : 's') + ' · ' +
              found + ' discover' + (found === 1 ? 'y' : 'ies') + ' · saved ' + stamp
      };
    }
  };

  EVO.Save = S;
})(window.EVO);
