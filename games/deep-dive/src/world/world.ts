import { WORLD } from '../config';
import { closestOnSegment, mulberry32, pointInPolygon, smoothstep } from '../core/math';
import type { AreaId } from '../data/objectives';
import type { LootTable } from '../data/treasures';
import { buildWreck, type AirPocketDef, type CollapseDef, type Rect, type Wall, type WreckLayout } from './wreck';
import { zoneAt, type ZoneId } from './zones';

export interface Rock {
  x: number;
  y: number;
  r: number;
  /** Irregular outline, as radius multipliers around the circle. */
  shape: number[];
  tone: number;
}

export interface Kelp {
  x: number;
  baseY: number;
  height: number;
  phase: number;
  width: number;
  front: boolean;
}

export interface Coral {
  x: number;
  y: number;
  size: number;
  hue: number;
  kind: 'fan' | 'brain' | 'tube';
}

export interface GlowPlant {
  x: number;
  y: number;
  height: number;
  phase: number;
  hue: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  table: LootTable;
}

export interface Current {
  id: string;
  name: string;
  rect: Rect;
  /** Flow velocity in world units per second at full strength. */
  fx: number;
  fy: number;
}

/** Decorative wreck-field props (crates, cannons, barrels). */
export interface Prop {
  x: number;
  y: number;
  kind: 'crate' | 'cannon' | 'barrel';
  angle: number;
}

const FLOOR_STEP = 16;
export const CURRENT_FEATHER = 60;

/**
 * Hand-authored seafloor: reef shelf → reef edge → flat wreck field → the Edge →
 * abyssal trench (250m) → rising far wall.
 */
const FLOOR_CONTROL: [number, number][] = [
  [0, 380], [250, 520], [600, 600], [950, 640], [1300, 700], [1600, 760], [1850, 900],
  [2000, 1180], [2150, 1560], [2250, 1680], [2700, 1680], [3150, 1690], [3300, 1720],
  [3420, 1900], [3520, 2500], [3650, 3100], [3800, 3500], [4100, 3750], [4400, 3980],
  [4800, 4000], [5050, 3700], [5250, 3000], [5400, 2200], [5600, 1600],
];

const WRECK_X = 2700;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function controlFloor(x: number) {
  const pts = FLOOR_CONTROL;
  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
  const a = pts[Math.max(0, i - 1)];
  const b = pts[i];
  const c = pts[i + 1];
  const d = pts[Math.min(pts.length - 1, i + 2)];
  const t = (x - b[0]) / (c[0] - b[0]);
  return catmull(a[1], b[1], c[1], d[1], Math.max(0, Math.min(1, t)));
}

export class World {
  readonly floor: Float32Array;
  readonly rocks: Rock[] = [];
  readonly kelp: Kelp[] = [];
  readonly corals: Coral[] = [];
  readonly glowPlants: GlowPlant[] = [];
  readonly props: Prop[] = [];
  readonly spawns: SpawnPoint[] = [];
  readonly wreck: WreckLayout;
  readonly walls: Wall[];
  readonly shrine: { x: number; y: number };
  readonly currents: Current[];
  readonly airPockets: AirPocketDef[];
  readonly collapses: CollapseDef[];

  constructor(seed = 7) {
    const rng = mulberry32(seed);
    const n = Math.ceil(WORLD.width / FLOOR_STEP) + 1;
    this.floor = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * FLOOR_STEP;
      // The wreck rests on a flat, sandy bed; everywhere else gets natural bumps.
      const flat = smoothstep(2150, 2250, x) * (1 - smoothstep(3150, 3250, x));
      const bumps = Math.sin(x * 0.011) * 16 + Math.sin(x * 0.037 + 1.3) * 7 + Math.sin(x * 0.09) * 2.5;
      this.floor[i] = controlFloor(x) + bumps * (1 - flat * 0.9);
    }

    this.wreck = buildWreck(WRECK_X, this.floorY(WRECK_X), 0.03);
    this.walls = this.wreck.walls;
    this.shrine = { x: 4600, y: this.floorY(4600) };
    this.currents = [
      { id: 'rip', name: 'Reef Rip', rect: { x0: 1760, y0: 250, x1: 2140, y1: 1050 }, fx: 120, fy: 50 },
      { id: 'cross', name: 'Wreck Crosscurrent', rect: { x0: 2200, y0: 1080, x1: 3250, y1: 1400 }, fx: -150, fy: 15 },
      { id: 'pull', name: 'Abyssal Pull', rect: { x0: 3680, y0: 2250, x1: 3980, y1: 3500 }, fx: 0, fy: 140 },
    ];
    this.airPockets = [
      ...this.wreck.airPockets,
      { id: 'vent', x: 4250, y: this.floorY(4250) - 70, r: 42, capacity: 40, kind: 'vent' },
    ];
    this.collapses = this.wreck.collapses;

    this.buildRocks(rng);
    this.buildFlora(rng);
    this.buildProps(rng);
    this.buildSpawns();
    this.clearBouldersFromSpawns();
  }

  /** Seafloor height at world x (linear between samples). */
  floorY(x: number) {
    const fx = Math.max(0, Math.min(WORLD.width, x)) / FLOOR_STEP;
    const i = Math.min(this.floor.length - 2, Math.floor(fx));
    const t = fx - i;
    return this.floor[i] * (1 - t) + this.floor[i + 1] * t;
  }

  floorSample(i: number) {
    return this.floor[Math.max(0, Math.min(this.floor.length - 1, i))];
  }

  get floorStep() {
    return FLOOR_STEP;
  }

  zoneAt(x: number, y: number): ZoneId {
    return zoneAt(x, y);
  }

  insideWreck(x: number, y: number) {
    return pointInPolygon(x, y, this.wreck.hull);
  }

  /** Named areas the diver is currently in (for objectives). */
  areasAt(x: number, y: number): AreaId[] {
    const areas: AreaId[] = [];
    const zone = zoneAt(x, y);
    if (zone === 'wreck') areas.push('wreck');
    if (zone === 'abyss') areas.push('abyss');
    if (this.insideWreck(x, y)) areas.push('hold');
    if (Math.hypot(x - this.shrine.x, y - (this.shrine.y - 100)) < 260) areas.push('shrine');
    return areas;
  }

  /** Distance from a point to the nearest nearby stretch of seafloor. */
  floorDistance(x: number, y: number, reach = 64) {
    const i0 = Math.floor((x - reach) / FLOOR_STEP);
    const i1 = Math.ceil((x + reach) / FLOOR_STEP);
    let best = Infinity;
    for (let i = i0; i < i1; i++) {
      best = Math.min(best, closestOnSegment(x, y, i * FLOOR_STEP, this.floorSample(i), (i + 1) * FLOOR_STEP, this.floorSample(i + 1)).d);
    }
    return best;
  }

  /** True if a circle of radius r at (x, y) overlaps no terrain, rock or wall. */
  isOpen(x: number, y: number, r: number) {
    if (y < 0 || x < WORLD.wallMargin || x > WORLD.width - WORLD.wallMargin) return false;
    if (y > this.floorY(x) - r) return false;
    if (this.floorDistance(x, y, r * 3) < r) return false;
    for (const rock of this.rocks) if (Math.hypot(x - rock.x, y - rock.y) < rock.r * 0.9 + r) return false;
    for (const w of this.walls) if (closestOnSegment(x, y, w.ax, w.ay, w.bx, w.by).d < w.half + r) return false;
    return true;
  }

  /** Move a point (e.g. an old save's lost satchel) to the nearest open water above it. */
  clampToOpenWater(x: number, y: number, r = 20): { x: number; y: number } {
    let cx = Math.max(WORLD.wallMargin + r, Math.min(WORLD.width - WORLD.wallMargin - r, x));
    let cy = Math.max(r + 10, Math.min(y, this.floorY(cx) - r - 4));
    for (let i = 0; i < 200 && !this.isOpen(cx, cy, r); i++) cy -= 10;
    if (cy < r) cy = r + 10;
    return { x: cx, y: cy };
  }

  private addRock(x: number, r: number, rng: () => number, sink = 0.35) {
    const shape = Array.from({ length: 14 }, () => 0.82 + rng() * 0.26);
    const rock: Rock = { x, y: this.floorY(x) - r * (1 - sink) + r * 0.2, r, shape, tone: rng() };
    this.rocks.push(rock);
    return rock;
  }

  private buildRocks(rng: () => number) {
    const big: [number, number][] = [
      [360, 44], [1040, 58], [1560, 72], [1880, 46], // reef
      [2120, 56], [3290, 46], // wreck field
      [4050, 90], [4350, 58], [4900, 84], [5160, 60], // abyss spires
    ];
    for (const [x, r] of big) this.addRock(x, r, rng);
    for (let x = 200; x < WORLD.width - 200; x += 140 + rng() * 160) {
      if (x > 2180 && x < 3230) continue; // keep the wreck bed clear
      if (Math.abs(x - this.shrine.x) < 170 || (x > 3450 && x < 3700)) continue;
      this.addRock(x, 14 + rng() * 18, rng, 0.5);
    }
  }

  private buildFlora(rng: () => number) {
    for (let x = 180; x < WORLD.width - 150; x += 30 + rng() * 60) {
      const y = this.floorY(x);
      const zone = zoneAt(x, y - 10);
      if (zone === 'reef' && rng() < 0.6) {
        const shallow = y < 800;
        this.kelp.push({
          x, baseY: y + 6,
          height: (shallow ? 140 : 100) + rng() * (shallow ? 200 : 160),
          phase: rng() * Math.PI * 2,
          width: 5 + rng() * 5,
          front: rng() < 0.18,
        });
      }
      if (zone === 'reef' && y > 520 && rng() < 0.65) {
        const kinds: Coral['kind'][] = ['fan', 'brain', 'tube'];
        this.corals.push({ x: x + rng() * 20, y: this.floorY(x) + 4, size: 14 + rng() * 22, hue: [350, 18, 290, 175, 45][Math.floor(rng() * 5)], kind: kinds[Math.floor(rng() * 3)] });
      }
      if (zone === 'abyss' && y > 2100 && rng() < 0.55) {
        this.glowPlants.push({ x, y: y + 4, height: 30 + rng() * 70, phase: rng() * 10, hue: rng() < 0.6 ? 180 : 280 });
      }
    }
  }

  private buildProps(rng: () => number) {
    const kinds: Prop['kind'][] = ['crate', 'barrel', 'cannon'];
    for (const x of [2160, 2200, 3200, 3240, 3350, 2050]) {
      this.props.push({ x, y: this.floorY(x), kind: kinds[Math.floor(rng() * kinds.length)], angle: (rng() - 0.5) * 0.6 });
    }
  }

  private buildSpawns() {
    // Lift each floor spawn until it clears the terrain — steep slopes need more than the nominal lift.
    const onFloor = (x: number, table: LootTable, lift = 14) => {
      let y = this.floorY(x) - lift;
      for (let i = 0; i < 40 && this.floorDistance(x, y) < 12; i++) y -= 4;
      this.spawns.push({ x, y, table });
    };

    for (const x of [300, 470, 900, 1180, 1320, 1470, 1690]) onFloor(x, 'shallows');
    for (const x of [1800, 1930]) onFloor(x, 'reef');
    for (const x of [2160, 3240, 3340]) onFloor(x, 'wreck', 18);
    for (const x of [3480, 3760, 3920, 4180, 4440, 4760, 5000, 5250]) onFloor(x, 'abyss');

    const rockTable = (x: number): LootTable => (x < 1400 ? 'shallows' : x < 2000 ? 'reef' : x < 3400 ? 'wreck' : 'abyss');
    for (const rock of this.rocks.filter((r) => r.r >= 44)) {
      this.spawns.push({ x: rock.x, y: rock.y - rock.r * 0.92 - 10, table: rockTable(rock.x) });
    }

    this.spawns.push(...this.wreck.spawns);

    onFloor(this.shrine.x - 60, 'shrine', 20);
    onFloor(this.shrine.x + 60, 'shrine', 20);
    this.spawns.push({ x: this.shrine.x, y: this.shrine.y - 58, table: 'shrine' });
  }

  /** Small scattered boulders must never bury a treasure spot. */
  private clearBouldersFromSpawns() {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      if (r.r >= 44) continue;
      if (this.spawns.some((s) => Math.hypot(s.x - r.x, s.y - r.y) < r.r + 30)) this.rocks.splice(i, 1);
    }
  }
}
