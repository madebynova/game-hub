/* Adaptations.

   Three tracks, one unlock each in Phase 1. None of them is a percentage on a
   stat - each one changes a rule about the world:

     Tidelung   - deep water stops being a wall
     Springcoil - the Windfall Gap stops being an edge
     Rendmaw    - bramble and shell stop being solid

   Progress comes from doing the thing the track is about, so a player who just
   plays naturally will unlock whichever one matches how they have been
   playing. That is the point: the creature grows into how it was used. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var GOAL = 100;

  var DEFS = {
    aquatic: {
      id: 'aquatic',
      track: 'Aquatic',
      name: 'Tidelung',
      hint: 'Spend time in water',
      colour: '#58c8e0',
      blurb: 'Your throat opens into a second set of lungs and your tail broadens into a fin. Deep water stops being a wall.',
      effects: [
        'Swim through deep water instead of being turned back',
        'Move freely in the shallows rather than wading',
        'Reach Mirror Isle, and the pearls on the pool floor'
      ],
      gain: 'You can swim. Mirror Isle is out there.',
      sources: 'Wading, swimming and picking Dewbeads'
    },
    mobility: {
      id: 'mobility',
      track: 'Mobility',
      name: 'Springcoil',
      hint: 'Explore new ground',
      colour: '#f2a83f',
      blurb: 'Your hind legs lengthen and fold into a coil that stores every step you take. Ground you cannot walk across, you can cross anyway.',
      effects: [
        'Leap with SPACE - a long, committed bound',
        'Carry over the Windfall Gap and onto the Sunstone Shelf',
        'Run noticeably faster on open ground'
      ],
      gain: 'Press SPACE to leap. The Gap is not as wide as it looks.',
      sources: 'Covering ground you have not walked before'
    },
    gathering: {
      id: 'gathering',
      track: 'Gathering',
      name: 'Rendmaw',
      hint: 'Harvest what grows',
      colour: '#96d95c',
      blurb: 'Your jaw splits into a pair of working mandibles. What was too tough to open, or too dense to pass, no longer is.',
      effects: [
        'Crack Ironcaps off the stone',
        'Tear through Bramblethorn walls',
        'Harvest everything faster'
      ],
      gain: 'You can tear brambles. Thornhollow is open.',
      sources: 'Harvesting plants and resources'
    }
  };

  var order = ['aquatic', 'mobility', 'gathering'];

  var A = {
    GOAL: GOAL,
    DEFS: DEFS,
    order: order,

    progress: { aquatic: 0, mobility: 0, gathering: 0 },
    unlocked: { aquatic: false, mobility: false, gathering: false },

    /* Set by main so the systems can announce things without importing UI. */
    onUnlock: null,
    onGain: null,

    reset: function () {
      order.forEach(function (k) {
        A.progress[k] = 0;
        A.unlocked[k] = false;
      });
    },

    has: function (id) { return !!A.unlocked[id]; },

    count: function () {
      var n = 0;
      order.forEach(function (k) { if (A.unlocked[k]) n++; });
      return n;
    },

    allUnlocked: function () { return A.count() === order.length; },

    /* Returns true if this gain completed the track. */
    add: function (id, amount) {
      if (!DEFS[id] || amount <= 0) return false;
      if (A.unlocked[id]) return false;

      var before = A.progress[id];
      A.progress[id] = Math.min(GOAL, before + amount);

      if (A.onGain && A.progress[id] !== before) A.onGain(id, A.progress[id] - before);

      if (A.progress[id] >= GOAL) {
        A.unlocked[id] = true;
        if (A.onUnlock) A.onUnlock(DEFS[id]);
        return true;
      }
      return false;
    },

    ratio: function (id) {
      return A.unlocked[id] ? 1 : A.progress[id] / GOAL;
    },

    /* Trait names for the HUD chips, in a stable order. */
    traits: function () {
      return order.filter(function (k) { return A.unlocked[k]; })
                  .map(function (k) { return DEFS[k]; });
    },

    /* The creature's stage name is derived from what it has become, not from
       a level counter - that is the difference the design is after. */
    stageName: function () {
      var n = A.count();
      if (n === 0) return 'Hatchling';
      if (n === 3) return 'Cradleborn';
      var names = A.traits().map(function (d) { return d.name; });
      return names.join(' ') + ' Hatchling';
    },

    /* Flags the rest of the game reads. */
    canSwim:    function () { return A.unlocked.aquatic; },
    canLeap:    function () { return A.unlocked.mobility; },
    canRend:    function () { return A.unlocked.gathering; },

    moveSpeed: function () {
      return A.unlocked.mobility ? 178 : 142;
    },
    shallowFactor: function () {
      // Wading is a real tax until Tidelung; afterwards water is neutral.
      return A.unlocked.aquatic ? 1.0 : 0.62;
    },
    harvestFactor: function () {
      return A.unlocked.gathering ? 0.55 : 1;
    },

    serialise: function () {
      return { progress: A.progress, unlocked: A.unlocked };
    },

    restore: function (data) {
      A.reset();
      if (!data) return;
      order.forEach(function (k) {
        if (data.progress && typeof data.progress[k] === 'number') {
          A.progress[k] = U.clamp(data.progress[k], 0, GOAL);
        }
        if (data.unlocked && data.unlocked[k]) {
          A.unlocked[k] = true;
          A.progress[k] = GOAL;
        }
      });
    }
  };

  EVO.Adapt = A;
})(window.EVO);
