/* The Discovery Journal.

   Nineteen entries, all of them real things that exist in the world and can
   actually be found. No filler: an empty-looking journal that fills up slowly
   is better than a long one full of entries nobody will ever reach.

   Entries are listed even before they are found, but only as a silhouette -
   knowing there are three animals you have not met is itself a reason to keep
   walking. */

(function (EVO) {
  'use strict';

  var CATEGORIES = [
    { id: 'location',   label: 'Locations' },
    { id: 'flora',      label: 'Flora' },
    { id: 'resource',   label: 'Resources' },
    { id: 'fauna',      label: 'Fauna' },
    { id: 'phenomenon', label: 'Phenomena' }
  ];

  var ENTRIES = {
    /* --- locations --- */
    loc_hollow: {
      cat: 'location', name: 'The Hollow',
      desc: 'A sunlit bowl of grass ringed by boulders. Warm, open, and quiet. You woke here.',
      teaser: 'Somewhere you have already been'
    },
    loc_pool: {
      cat: 'location', name: 'The Lumen Pool',
      desc: 'A wide, still water. The pale shallows give way to a dark middle that does not want you in it.',
      teaser: 'Water, east of the Hollow'
    },
    mirror_isle: {
      cat: 'location', name: 'Mirror Isle',
      desc: 'An island in the middle of the pool, unreachable on foot. A smooth black stone stands at its centre, showing you back to yourself.',
      teaser: 'Land surrounded by deep water'
    },
    loc_gap: {
      cat: 'location', name: 'The Windfall Gap',
      desc: 'A split in the northern cliff. Cold air rises out of it. The far side is close enough to see and too far to step.',
      teaser: 'A break in the northern rock'
    },
    loc_shelf: {
      cat: 'location', name: 'Sunstone Shelf',
      desc: 'The stony terrace above the cliff. Thin grass, hard light, and a long view back down over the whole Cradle.',
      teaser: 'Whatever lies above the cliff'
    },
    loc_thorn: {
      cat: 'location', name: 'Thornhollow',
      desc: 'A shaded grove behind the bramble wall. Older, wetter and darker than the Hollow, and thick with resin.',
      teaser: 'Something behind the brambles'
    },
    cradle_heart: {
      cat: 'location', name: 'The Cradle Heart',
      desc: 'A pale shore behind deep water and a wall of thorn. Whatever this place is, it was here before any of the rest of it.',
      teaser: 'Sealed behind water, rock and thorn'
    },

    /* --- flora --- */
    sporecap: {
      cat: 'flora', name: 'Sporecap',
      desc: 'A soft pink mushroom that grows anywhere the ground is kind. Comes away with a pop.',
      teaser: 'Something common underfoot'
    },
    dewbead: {
      cat: 'flora', name: 'Dewbead Reed',
      desc: 'A shallow-water reed hung with beads of held water. Cool and faintly sweet.',
      teaser: 'Something growing in the shallows'
    },
    bramblethorn: {
      cat: 'flora', name: 'Bramblethorn',
      desc: 'A dense, woody tangle that grows in walls rather than clumps. Nothing soft gets through it.',
      teaser: 'Something that will not let you past'
    },
    elderbough: {
      cat: 'flora', name: 'The Elderbough',
      desc: 'The oldest tree in the Cradle, wide enough to shade half the Hollow. Its roots are warm to the touch.',
      teaser: 'The largest living thing here'
    },

    /* --- resources --- */
    glimmer: {
      cat: 'resource', name: 'Glimmer Pearl',
      desc: 'A cold, lit bead that forms only on the floor of deep water. It keeps glowing after you take it.',
      teaser: 'Something on the bottom of the pool'
    },
    ironcap: {
      cat: 'resource', name: 'Ironcap',
      desc: 'A grey shelf-growth welded to bare stone. The shell is harder than anything else that grows here.',
      teaser: 'Something growing on the rocks'
    },
    amberdrop: {
      cat: 'resource', name: 'Amberdrop',
      desc: 'Resin from the old trees of Thornhollow, still soft in the middle. Dense with whatever the grove has been storing.',
      teaser: 'Something the old trees make'
    },

    /* --- fauna --- */
    flit: {
      cat: 'fauna', name: 'Flit',
      desc: 'A palm-sized flier that never quite settles. They travel in loose companies and scatter if you come too close.',
      teaser: 'Something that keeps moving'
    },
    skimmer: {
      cat: 'fauna', name: 'Pond Skimmer',
      desc: 'Stands on the surface of the water without breaking it, then crosses a stretch of pool faster than you can turn your head.',
      teaser: 'Something that walks on water'
    },
    burrower: {
      cat: 'fauna', name: 'Hollow Burrower',
      desc: 'Comes up, looks around, and is gone again. Nobody has seen the whole of one.',
      teaser: 'Something that lives under the ground'
    },

    /* --- phenomena --- */
    spore_bloom: {
      cat: 'phenomenon', name: 'Spore Bloom',
      desc: 'A swollen cap that answers a nudge with a slow cloud of gold. The spores drift a long way before they settle.',
      teaser: 'Something that reacts to being touched'
    },
    sunstone: {
      cat: 'phenomenon', name: 'The Sunstone',
      desc: 'A block of the shelf that holds the day’s heat long past sundown, and gives it back slowly.',
      teaser: 'Something warm on the high ground'
    }
  };

  var order = Object.keys(ENTRIES);

  var D = {
    CATEGORIES: CATEGORIES,
    ENTRIES: ENTRIES,

    found: Object.create(null),
    onDiscover: null,

    reset: function () {
      D.found = Object.create(null);
    },

    has: function (id) { return !!D.found[id]; },

    total: function () { return order.length; },

    count: function () {
      var n = 0;
      for (var i = 0; i < order.length; i++) if (D.found[order[i]]) n++;
      return n;
    },

    /* Returns the entry if it is new, or null if already known. */
    discover: function (id) {
      var e = ENTRIES[id];
      if (!e || D.found[id]) return null;
      D.found[id] = true;
      if (D.onDiscover) D.onDiscover(id, e);
      return e;
    },

    byCategory: function (catId) {
      return order.filter(function (id) { return ENTRIES[id].cat === catId; })
                  .map(function (id) {
                    return { id: id, entry: ENTRIES[id], found: !!D.found[id] };
                  });
    },

    serialise: function () {
      return order.filter(function (id) { return D.found[id]; });
    },

    restore: function (list) {
      D.reset();
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        if (ENTRIES[list[i]]) D.found[list[i]] = true;
      }
    }
  };

  EVO.Discovery = D;
})(window.EVO);
