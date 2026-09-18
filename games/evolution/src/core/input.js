/* Keyboard input. Deliberately small: WASD/arrows to move, E to interact,
   Space to leap, and a few panel keys. No mouse steering - the creature reads
   better under direct keyboard control, and adding click-to-move would mean
   two systems fighting over the same intent. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var down = Object.create(null);      // physical key held right now
  var pressed = Object.create(null);   // went down since the last consume()
  var listeners = [];

  var MOVE = {
    up:    ['KeyW', 'ArrowUp'],
    down:  ['KeyS', 'ArrowDown'],
    left:  ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight']
  };

  function anyDown(codes) {
    for (var i = 0; i < codes.length; i++) if (down[codes[i]]) return true;
    return false;
  }

  var Input = {
    /* Smoothed analogue-feeling stick built from digital keys. The raw axis is
       what movement integrates against; smoothing lives in the player. */
    axis: { x: 0, y: 0 },

    enabled: true,

    isDown: function (code) { return !!down[code]; },

    /* True once per physical press. */
    consume: function (code) {
      if (pressed[code]) { pressed[code] = false; return true; }
      return false;
    },

    on: function (fn) { listeners.push(fn); },

    clear: function () {
      down = Object.create(null);
      pressed = Object.create(null);
      this.axis.x = 0;
      this.axis.y = 0;
    },

    update: function () {
      var x = 0, y = 0;
      if (this.enabled) {
        if (anyDown(MOVE.left)) x -= 1;
        if (anyDown(MOVE.right)) x += 1;
        if (anyDown(MOVE.up)) y -= 1;
        if (anyDown(MOVE.down)) y += 1;
      }
      var len = Math.sqrt(x * x + y * y);
      if (len > 1) { x /= len; y /= len; }
      this.axis.x = x;
      this.axis.y = y;
    },

    init: function () {
      window.addEventListener('keydown', function (e) {
        // Let the browser keep its own shortcuts; only swallow game keys.
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (!down[e.code]) pressed[e.code] = true;
        down[e.code] = true;

        for (var i = 0; i < listeners.length; i++) listeners[i](e.code, e);

        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0 || e.code === 'Tab') {
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', function (e) {
        down[e.code] = false;
      });

      // Held keys would otherwise stick when the tab loses focus.
      window.addEventListener('blur', function () { Input.clear(); });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) Input.clear();
      });
    }
  };

  EVO.Input = Input;
})(window.EVO);
