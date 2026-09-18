/* THE CRADLE - the one biome of Phase 1.

   The layout is authored, not procedural: each of the three adaptations has a
   direction of its own, and each direction has a barrier the starting creature
   cannot pass.

        y=0   +--------------------------------------------------+
              |         SUNSTONE SHELF              ~ | CRADLE    |
              |                                     ~ |   HEART   |   <- needs all three
        y=720 |=====cliff=====[ GAP ]=====cliff=====~~~|===========|
              |                                                   |
              |     THE HOLLOW              THE LUMEN POOL        |
              |      (spawn)                 o Mirror Isle        |
              |                                                   |
              |  ######## brambles ########                       |
              |     THORNHOLLOW                                   |
       y=2400 +--------------------------------------------------+
             x=0                                              x=3400

   - The Lumen Pool's deep ring stops you reaching Mirror Isle    -> AQUATIC
   - The Windfall Gap splits the cliff into the Sunstone Shelf    -> MOBILITY
   - Bramblethorn walls seal Thornhollow                          -> GATHERING

   The Cradle Heart sits behind one of each, so it can only be reached by a
   creature that has developed all three. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  var W = {
    width: 3400,
    height: 2400,

    /* Water is a union of circles with island circles carved back out. That
       keeps the shoreline organic while `depthAt` stays a couple of loops -
       cheap enough to call every frame, and exactly what the renderer bakes,
       so what the player sees is what the physics does. */
    SHALLOW_MAX: 70,

    waterCircles: [
      // The Lumen Pool
      { x: 2280, y: 1520, r: 430 },
      { x: 2020, y: 1320, r: 250 },
      { x: 2540, y: 1740, r: 265 },
      { x: 2090, y: 1780, r: 235 },
      { x: 2570, y: 1320, r: 215 },
      { x: 1830, y: 1520, r: 160 },
      // The Runnel - a shallow stream trailing north out of the pool. Every
      // radius here is below SHALLOW_MAX on purpose: it is scenery and a route,
      // never a barrier.
      { x: 2430, y: 1080, r: 68 },
      { x: 2470, y: 975,  r: 62 },
      { x: 2505, y: 880,  r: 54 },
      // The Sable Channel - deep water sealing off the Cradle Heart. It lies
      // entirely ABOVE the cliff, so it can only be reached from the Sunstone
      // Shelf. That is what makes the Heart need all three adaptations: leap
      // the Gap to get up here, swim the channel, tear the gate.
      //
      // Spacing must stay well under 2r or the midpoints between circles
      // become wadeable and the gate leaks: at r=140 and 110 apart the
      // shallowest point on the centre line is 85, comfortably deep.
      { x: 2680, y: 0,   r: 140 },
      { x: 2680, y: 110, r: 140 },
      { x: 2680, y: 220, r: 140 },
      { x: 2680, y: 330, r: 140 },
      { x: 2680, y: 440, r: 140 },
      { x: 2680, y: 550, r: 140 },
      { x: 2680, y: 660, r: 140 }
    ],

    islands: [
      { x: 2280, y: 1500, r: 168 }   // Mirror Isle
    ],

    /* Solid rock escarpment across the whole north. Unbroken except for the
       Windfall Gap, which is the only way up - including for anything that can
       swim, since the cliff blocks water routes too. */
    cliffs: [
      { x: 0,    y: 715, w: 1650, h: 178 },
      { x: 1800, y: 715, w: 1600, h: 178 }
    ],

    /* The Windfall Gap: a void you can only be over, never in. Its height plus
       the creature's radius on each bank is what the leap has to beat. */
    chasms: [
      { x: 1650, y: 702, w: 150, h: 204 }
    ],

    zones: [
      { id: 'hollow', name: 'The Hollow',      sub: 'where you woke',        x: 900,  y: 1420, r: 520, priority: 1 },
      { id: 'pool',   name: 'The Lumen Pool',  sub: 'still and bright',      x: 2280, y: 1520, r: 700, priority: 1 },
      { id: 'isle',   name: 'Mirror Isle',     sub: 'ringed by deep water',  x: 2280, y: 1500, r: 175, priority: 3 },
      { id: 'gap',    name: 'The Windfall Gap', sub: 'a split in the rock',  x: 1725, y: 804, r: 210, priority: 3 },
      { id: 'shelf',  name: 'Sunstone Shelf',  sub: 'above the cliff',       x: 1500, y: 360, r: 900, priority: 1 },
      { id: 'thorn',  name: 'Thornhollow',     sub: 'under the brambles',    x: 560,  y: 2060, r: 520, priority: 2 },
      { id: 'heart',  name: 'The Cradle Heart', sub: 'the place it began',   x: 3060, y: 400, r: 210, priority: 3 }
    ],

    /* Populated by generate(). */
    rocks: [],
    trees: [],
    brambles: [],
    nodes: [],
    landmarks: [],
    tufts: [],
    flowers: [],
    pebbles: [],
    reeds: [],
    lilies: [],

    grid: null,
    detailGrid: null
  };

  /* ---- water ------------------------------------------------------- */

  /* > 0 inside water; the value is roughly how far in from the edge you are. */
  W.depthAt = function (x, y) {
    var best = -1e9;
    for (var i = 0; i < W.waterCircles.length; i++) {
      var c = W.waterCircles[i];
      var d = c.r - U.dist(x, y, c.x, c.y);
      if (d > best) best = d;
    }
    for (var j = 0; j < W.islands.length; j++) {
      var s = W.islands[j];
      var out = U.dist(x, y, s.x, s.y) - s.r;
      if (out < best) best = out;
    }
    return best;
  };

  W.isWater = function (x, y) { return W.depthAt(x, y) > 0; };
  W.isDeep = function (x, y) { return W.depthAt(x, y) > W.SHALLOW_MAX; };

  /* ---- static geometry queries ------------------------------------- */

  function inRect(x, y, r, rect) {
    return x + r > rect.x && x - r < rect.x + rect.w &&
           y + r > rect.y && y - r < rect.y + rect.h;
  }

  W.inChasm = function (x, y, r) {
    for (var i = 0; i < W.chasms.length; i++) {
      if (inRect(x, y, r || 0, W.chasms[i])) return W.chasms[i];
    }
    return null;
  };

  W.inCliff = function (x, y, r) {
    for (var i = 0; i < W.cliffs.length; i++) {
      if (inRect(x, y, r || 0, W.cliffs[i])) return W.cliffs[i];
    }
    return null;
  };

  /* ---- spatial index ------------------------------------------------ */

  var CELL = 220;

  function Grid(cell) {
    this.cell = cell;
    this.cols = Math.ceil(W.width / cell) + 1;
    this.rows = Math.ceil(W.height / cell) + 1;
    this.buckets = new Array(this.cols * this.rows);
    for (var i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }
  Grid.prototype.key = function (cx, cy) { return cy * this.cols + cx; };
  Grid.prototype.add = function (item) {
    var cx = U.clamp(Math.floor(item.x / this.cell), 0, this.cols - 1);
    var cy = U.clamp(Math.floor(item.y / this.cell), 0, this.rows - 1);
    this.buckets[this.key(cx, cy)].push(item);
  };
  Grid.prototype.near = function (x, y, radius, out) {
    out = out || [];
    out.length = 0;
    var c0 = U.clamp(Math.floor((x - radius) / this.cell), 0, this.cols - 1);
    var c1 = U.clamp(Math.floor((x + radius) / this.cell), 0, this.cols - 1);
    var r0 = U.clamp(Math.floor((y - radius) / this.cell), 0, this.rows - 1);
    var r1 = U.clamp(Math.floor((y + radius) / this.cell), 0, this.rows - 1);
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        var b = this.buckets[this.key(cx, cy)];
        for (var i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  };
  Grid.prototype.inRect = function (x0, y0, x1, y1, out) {
    out = out || [];
    out.length = 0;
    var c0 = U.clamp(Math.floor(x0 / this.cell), 0, this.cols - 1);
    var c1 = U.clamp(Math.floor(x1 / this.cell), 0, this.cols - 1);
    var r0 = U.clamp(Math.floor(y0 / this.cell), 0, this.rows - 1);
    var r1 = U.clamp(Math.floor(y1 / this.cell), 0, this.rows - 1);
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        var b = this.buckets[this.key(cx, cy)];
        for (var i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  };

  W.Grid = Grid;

  /* ---- collision ---------------------------------------------------- */

  var scratch = [];

  /* Push a circle out of any solid it overlaps. Returns true if it moved.
     Brambles stop counting as solid once they have been cleared. */
  W.resolveCircle = function (p, radius) {
    var hit = false;
    var solids = W.grid.near(p.x, p.y, radius + 130, scratch);
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s.cleared) continue;
      var dx = p.x - s.x, dy = p.y - s.y;
      var min = radius + s.solidR;
      var d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.0001) {
        var d = Math.sqrt(d2);
        var push = (min - d);
        p.x += (dx / d) * push;
        p.y += (dy / d) * push;
        hit = true;
      } else if (d2 <= 0.0001) {
        p.x += min;
        hit = true;
      }
    }
    return hit;
  };

  /* Axis-aligned push-out, used for cliffs and (when grounded) chasms. */
  W.resolveRects = function (p, radius, rects) {
    var hit = false;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!inRect(p.x, p.y, radius, r)) continue;
      // Choose the cheapest axis to leave by.
      var left   = (r.x - radius) - p.x;
      var right  = (r.x + r.w + radius) - p.x;
      var top    = (r.y - radius) - p.y;
      var bottom = (r.y + r.h + radius) - p.y;
      var bx = Math.abs(left) < Math.abs(right) ? left : right;
      var by = Math.abs(top) < Math.abs(bottom) ? top : bottom;
      if (Math.abs(bx) < Math.abs(by)) p.x += bx; else p.y += by;
      hit = true;
    }
    return hit;
  };

  W.clampToWorld = function (p, radius) {
    p.x = U.clamp(p.x, radius, W.width - radius);
    p.y = U.clamp(p.y, radius, W.height - radius);
  };

  /* ---- zones -------------------------------------------------------- */

  W.zoneAt = function (x, y) {
    var best = null;
    for (var i = 0; i < W.zones.length; i++) {
      var z = W.zones[i];
      if (U.dist(x, y, z.x, z.y) <= z.r) {
        if (!best || z.priority > best.priority) best = z;
      }
    }
    return best;
  };

  /* ---- generation --------------------------------------------------- */

  function clearOfSolids(x, y, pad) {
    var near = W.grid.near(x, y, pad + 140, []);
    for (var i = 0; i < near.length; i++) {
      if (U.dist(x, y, near[i].x, near[i].y) < near[i].solidR + pad) return false;
    }
    return true;
  }

  function openGround(x, y, pad) {
    if (x < 40 || y < 40 || x > W.width - 40 || y > W.height - 40) return false;
    if (W.depthAt(x, y) > -pad) return false;
    if (W.inCliff(x, y, pad)) return false;
    if (W.inChasm(x, y, pad)) return false;
    return true;
  }

  function addSolid(item) {
    W.grid.add(item);
    return item;
  }

  W.generate = function () {
    W.grid = new Grid(CELL);
    W.rocks.length = 0;
    W.trees.length = 0;
    W.brambles.length = 0;
    W.nodes.length = 0;
    W.landmarks.length = 0;
    W.tufts.length = 0;
    W.flowers.length = 0;
    W.pebbles.length = 0;
    W.reeds.length = 0;
    W.lilies.length = 0;

    var rand = U.rng(20260917);

    /* -- brambles: the Thornhollow wall and the Cradle Heart gate ------ */
    function bramble(x, y, r, gate) {
      var b = {
        kind: 'bramble', x: x, y: y, r: r, solidR: r * 0.82,
        gate: gate, cleared: false, seed: Math.floor(rand() * 9999),
        shake: 0
      };
      W.brambles.push(b);
      addSolid(b);
      return b;
    }

    // Spacing must keep neighbouring solid radii overlapping, jitter included,
    // or the "wall" has a seam the player can squeeze through and the gate is
    // worthless. 112 apart at r=80 (solid 65.6) overlaps by ~19 even at the
    // worst jitter.
    var tx, ty;
    for (tx = 70; tx <= 900; tx += 112) bramble(tx, 1810 + Math.sin(tx * 0.01) * 16, 80, 'thorn');
    for (ty = 1900; ty <= 2390; ty += 112) bramble(900 + Math.cos(ty * 0.01) * 16, ty, 80, 'thorn');

    // The Cradle Heart gate: a wall from the map edge down to the cliff.
    for (ty = 10; ty <= 700; ty += 112) bramble(2880 + Math.sin(ty * 0.013) * 14, ty, 80, 'heart');

    /* -- rocks --------------------------------------------------------- */
    function rock(x, y, r, seedv) {
      var o = { kind: 'rock', x: x, y: y, r: r, solidR: r * 0.78, seed: seedv };
      W.rocks.push(o);
      addSolid(o);
      return o;
    }

    // Ringed boulders that give the Hollow a sense of enclosure without
    // actually closing it - the eye reads a clearing, the feet find the gaps.
    var hollowRing = [
      [470, 1100, 52], [640, 1000, 40], [1280, 1090, 58], [1400, 1220, 44],
      [1370, 1650, 50], [1180, 1810, 42], [520, 1300, 46], [430, 1520, 38],
      [760, 1720, 34], [1010, 1015, 36]
    ];
    hollowRing.forEach(function (r) { rock(r[0], r[1], r[2], Math.floor(rand() * 9999)); });

    // Scatter the rest, denser on the shelf where the ground is stony.
    var attempts = 0, placed = 0;
    while (placed < 96 && attempts < 4000) {
      attempts++;
      var x = rand() * W.width, y = rand() * W.height;
      var onShelf = y < 700;
      if (!onShelf && rand() < 0.45) continue;
      var r = U.range(rand, 22, onShelf ? 74 : 56);
      if (!openGround(x, y, r + 16)) continue;
      if (!clearOfSolids(x, y, r + 40)) continue;
      if (U.dist(x, y, 900, 1420) < 200) continue;   // keep spawn clear
      rock(x, y, r, Math.floor(rand() * 9999));
      placed++;
    }

    /* -- trees --------------------------------------------------------- */
    function tree(x, y, scale, type, seedv) {
      var o = {
        kind: 'tree', x: x, y: y, scale: scale, type: type,
        solidR: 15 * scale, seed: seedv, r: 90 * scale
      };
      W.trees.push(o);
      addSolid(o);
      return o;
    }

    // The Elderbough: the biggest thing in the Cradle, and the landmark the
    // player can see from most of the Hollow.
    var elder = tree(560, 1650, 2.3, 'elder', 1);
    elder.isElder = true;

    attempts = 0; placed = 0;
    while (placed < 78 && attempts < 5000) {
      attempts++;
      var tX = rand() * W.width, tY = rand() * W.height;
      var scale = U.range(rand, 0.8, 1.5);
      var type = rand() < 0.34 ? 'spire' : 'broad';
      if (tY < 700) { if (rand() < 0.6) continue; scale *= 0.8; type = 'spire'; }
      if (tY > 1800 && tX < 950) { scale *= 1.15; type = 'gnarled'; }
      if (!openGround(tX, tY, 40 * scale)) continue;
      if (!clearOfSolids(tX, tY, 70 * scale)) continue;
      if (U.dist(tX, tY, 900, 1420) < 260) continue;
      tree(tX, tY, scale, type, Math.floor(rand() * 9999));
      placed++;
    }

    /* -- resource nodes ------------------------------------------------ */
    function node(type, x, y) {
      var def = W.NODE_TYPES[type];
      var o = {
        kind: 'node', type: type, x: x, y: y, def: def,
        harvested: false, respawn: 0, seed: Math.floor(rand() * 9999),
        pop: 0
      };
      W.nodes.push(o);
      return o;
    }

    // Sporecaps: everywhere there is open grass, so the very first thing a new
    // player walks into is something they can pick.
    attempts = 0; placed = 0;
    while (placed < 64 && attempts < 4000) {
      attempts++;
      var sx = rand() * W.width, sy = rand() * W.height;
      if (!openGround(sx, sy, 18)) continue;
      if (!clearOfSolids(sx, sy, 34)) continue;
      if (sx > 2760 && sy < 700) continue;     // save the Heart for its own set
      node('sporecap', sx, sy);
      placed++;
    }

    // Dewbeads sit in the shallows, which is what quietly teaches the player
    // that water is worth standing in.
    attempts = 0; placed = 0;
    while (placed < 34 && attempts < 6000) {
      attempts++;
      var dx = rand() * W.width, dy = rand() * W.height;
      var d = W.depthAt(dx, dy);
      if (d < 14 || d > W.SHALLOW_MAX - 8) continue;
      if (!clearOfSolids(dx, dy, 30)) continue;
      node('dewbead', dx, dy);
      placed++;
    }

    // Glimmer pearls only exist in deep water: visible from the shore, and
    // completely out of reach until Tidelung.
    attempts = 0; placed = 0;
    while (placed < 22 && attempts < 8000) {
      attempts++;
      var gx = rand() * W.width, gy = rand() * W.height;
      if (W.depthAt(gx, gy) < W.SHALLOW_MAX + 22) continue;
      node('glimmer', gx, gy);
      placed++;
    }

    // Ironcaps grow against stone. Hard shell - nothing short of Rendmaw opens
    // one, and the player will try long before they can.
    for (var ri = 0; ri < W.rocks.length; ri++) {
      var rk = W.rocks[ri];
      if (rk.r < 36 || rand() > 0.34) continue;
      var a = rand() * Math.PI * 2;
      var nx = rk.x + Math.cos(a) * (rk.solidR + 16);
      var ny = rk.y + Math.sin(a) * (rk.solidR + 16);
      if (!openGround(nx, ny, 10)) continue;
      node('ironcap', nx, ny);
    }

    // Amberdrops: only inside Thornhollow, so they are the reward for the wall.
    attempts = 0; placed = 0;
    while (placed < 16 && attempts < 4000) {
      attempts++;
      var ax = U.range(rand, 60, 880), ay = U.range(rand, 1880, 2350);
      if (!openGround(ax, ay, 18)) continue;
      if (!clearOfSolids(ax, ay, 40)) continue;
      node('amberdrop', ax, ay);
      placed++;
    }

    /* -- landmarks ----------------------------------------------------- */
    function landmark(id, x, y, opts) {
      var o = {
        kind: 'landmark', id: id, x: x, y: y,
        radius: opts.radius || 44,
        prompt: opts.prompt,
        lockedPrompt: opts.lockedPrompt || null,
        discovery: opts.discovery || null,
        used: false,
        glow: 0
      };
      W.landmarks.push(o);
      return o;
    }

    landmark('sporebloom', 1120, 1215, {
      radius: 46,
      prompt: 'Nudge the Spore Bloom',
      discovery: 'spore_bloom'
    });
    landmark('elderbough', 560, 1650, {
      radius: 84,
      prompt: 'Touch the Elderbough',
      discovery: 'elderbough'
    });
    landmark('mirrorstone', 2280, 1478, {
      radius: 52,
      prompt: 'Look into the Mirror Stone',
      discovery: 'mirror_isle'
    });
    landmark('sunstone', 1420, 300, {
      radius: 56,
      prompt: 'Warm yourself on the Sunstone',
      discovery: 'sunstone'
    });
    landmark('heart', 3060, 400, {
      radius: 96,
      prompt: 'Approach the Cradle Heart',
      discovery: 'cradle_heart'
    });

    /* -- soft detail: grass, flowers, pebbles, reeds, lilies ----------- */
    W.detailGrid = new Grid(200);

    var i;
    for (i = 0; i < 5200; i++) {
      var gx2 = rand() * W.width, gy2 = rand() * W.height;
      var depth = W.depthAt(gx2, gy2);
      if (depth > -4) continue;
      if (W.inCliff(gx2, gy2, 4) || W.inChasm(gx2, gy2, 4)) continue;
      var lush = U.fbm(gx2 * 0.0016, gy2 * 0.0016, 3, 7);
      if (gy2 < 700) lush *= 0.45;            // the shelf is sparse and stony
      if (rand() > lush + 0.22) continue;
      W.detailGrid.add({
        t: 'tuft', x: gx2, y: gy2,
        h: U.range(rand, 9, 22),
        blades: 3 + Math.floor(rand() * 3),
        phase: rand() * 6.28,
        tint: rand()
      });
    }

    for (i = 0; i < 620; i++) {
      var fx = rand() * W.width, fy = rand() * W.height;
      if (W.depthAt(fx, fy) > -8) continue;
      if (W.inCliff(fx, fy, 8) || W.inChasm(fx, fy, 8)) continue;
      W.detailGrid.add({
        t: 'flower', x: fx, y: fy,
        phase: rand() * 6.28,
        kind: Math.floor(rand() * 3),
        size: U.range(rand, 2.4, 4.4)
      });
    }

    for (i = 0; i < 900; i++) {
      var px = rand() * W.width, py = rand() * W.height;
      if (W.depthAt(px, py) > -6) continue;
      if (W.inChasm(px, py, 6)) continue;
      W.detailGrid.add({
        t: 'pebble', x: px, y: py,
        r: U.range(rand, 1.6, 4.2),
        tone: rand()
      });
    }

    // Reeds trace the shoreline: they are how the pool announces itself from
    // a distance, before you can see the water at all.
    for (i = 0; i < 2600; i++) {
      var rx = rand() * W.width, ry = rand() * W.height;
      var rd = W.depthAt(rx, ry);
      if (rd < -22 || rd > 46) continue;
      W.detailGrid.add({
        t: 'reed', x: rx, y: ry,
        h: U.range(rand, 16, 40),
        phase: rand() * 6.28,
        lean: U.range(rand, -0.3, 0.3)
      });
    }

    for (i = 0; i < 260; i++) {
      var lx = rand() * W.width, ly = rand() * W.height;
      var ld = W.depthAt(lx, ly);
      if (ld < 30) continue;
      W.detailGrid.add({
        t: 'lily', x: lx, y: ly,
        r: U.range(rand, 11, 22),
        phase: rand() * 6.28,
        flower: rand() < 0.3
      });
    }

    return W;
  };

  /* ---- node definitions --------------------------------------------- */

  W.NODE_TYPES = {
    sporecap: {
      name: 'Sporecap',
      colour: '#e6b8d8',
      stem: '#f0e2d4',
      holdTime: 0.45,
      biomass: 2,
      gathering: 3,
      aquatic: 0,
      respawn: 55,
      requires: null,
      discovery: 'sporecap',
      verb: 'Pick'
    },
    dewbead: {
      name: 'Dewbead',
      colour: '#9be8e2',
      stem: '#7fc7a8',
      holdTime: 0.5,
      biomass: 2,
      gathering: 2,
      aquatic: 5,
      respawn: 55,
      requires: null,
      discovery: 'dewbead',
      verb: 'Pluck'
    },
    glimmer: {
      name: 'Glimmer Pearl',
      colour: '#cfeaff',
      stem: '#7fb6d8',
      holdTime: 0.7,
      biomass: 5,
      gathering: 4,
      aquatic: 8,
      respawn: 80,
      requires: null,           // reachable only by swimming - gated by place
      discovery: 'glimmer',
      verb: 'Gather'
    },
    ironcap: {
      name: 'Ironcap',
      colour: '#b8c2b0',
      stem: '#8f9a88',
      holdTime: 1.15,
      biomass: 6,
      gathering: 6,
      aquatic: 0,
      respawn: 75,
      requires: 'gathering',
      lockedText: 'Shell too hard for your jaws',
      discovery: 'ironcap',
      verb: 'Crack'
    },
    amberdrop: {
      name: 'Amberdrop',
      colour: '#ffbe5c',
      stem: '#a8702e',
      holdTime: 0.9,
      biomass: 8,
      gathering: 7,
      aquatic: 0,
      respawn: 80,
      requires: null,           // gated by the Thornhollow wall
      discovery: 'amberdrop',
      verb: 'Take'
    }
  };

  EVO.World = W;
})(window.EVO);
