import { DEPTH_ZONES, WORLD } from '../config';
import { mulberry32 } from '../core/math';
import type { LootTable } from '../data/treasures';

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

const FLOOR_STEP = 16;

/** Hand-authored seafloor profile: shallow shelf → reef → wreck ledge → drop-off → abyssal trench. */
const FLOOR_CONTROL: [number, number][] = [
  [0, 380], [250, 520], [600, 600], [950, 640], [1300, 700], [1600, 760],
  [1850, 980], [2100, 1220], [2350, 1300], [2650, 1330], [2860, 1420],
  [2990, 1950], [3150, 2650], [3450, 2820], [3750, 2760], [3950, 2450], [4200, 1700],
];

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
  readonly spawns: SpawnPoint[] = [];
  readonly wreck = { x: 2470, y: 0, angle: -0.12 };
  readonly shrine = { x: 3480, y: 0 };

  constructor(seed = 7) {
    const rng = mulberry32(seed);
    const n = Math.ceil(WORLD.width / FLOOR_STEP) + 1;
    this.floor = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * FLOOR_STEP;
      const bumps = Math.sin(x * 0.011) * 16 + Math.sin(x * 0.037 + 1.3) * 7 + Math.sin(x * 0.09) * 2.5;
      this.floor[i] = controlFloor(x) + bumps;
    }
    this.wreck.y = this.floorY(this.wreck.x);
    this.shrine.y = this.floorY(this.shrine.x);

    this.buildRocks(rng);
    this.buildFlora(rng);
    this.buildSpawns();
    this.clearBouldersFromSpawns();
  }

  /** Small scattered boulders must never bury a treasure spot. */
  private clearBouldersFromSpawns() {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      if (r.r >= 44) continue;
      if (this.spawns.some((s) => Math.hypot(s.x - r.x, s.y - r.y) < r.r + 30)) this.rocks.splice(i, 1);
    }
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

  zoneAt(y: number): 'shallows' | 'reef' | 'abyss' {
    return y >= DEPTH_ZONES.abyss ? 'abyss' : y >= DEPTH_ZONES.reef ? 'reef' : 'shallows';
  }

  private addRock(x: number, r: number, rng: () => number, sink = 0.35) {
    const shape = Array.from({ length: 14 }, () => 0.82 + rng() * 0.26);
    const rock: Rock = { x, y: this.floorY(x) - r * (1 - sink) + r * 0.2, r, shape, tone: rng() };
    this.rocks.push(rock);
    return rock;
  }

  private buildRocks(rng: () => number) {
    const big: [number, number][] = [
      [1040, 58], [1560, 72], [2020, 62], [2760, 48], [3300, 84], [3830, 66], [360, 44], [3620, 40],
    ];
    for (const [x, r] of big) this.addRock(x, r, rng);
    // Scattered small boulders for texture.
    for (let x = 200; x < WORLD.width - 200; x += 140 + rng() * 160) {
      if (Math.abs(x - this.wreck.x) < 200 || Math.abs(x - this.shrine.x) < 140) continue;
      this.addRock(x, 14 + rng() * 18, rng, 0.5);
    }
  }

  private buildFlora(rng: () => number) {
    for (let x = 180; x < WORLD.width - 150; x += 30 + rng() * 60) {
      const y = this.floorY(x);
      if (y < DEPTH_ZONES.abyss - 150 && rng() < 0.55) {
        const shallow = y < DEPTH_ZONES.reef;
        this.kelp.push({
          x, baseY: y + 6,
          height: (shallow ? 140 : 90) + rng() * (shallow ? 200 : 140),
          phase: rng() * Math.PI * 2,
          width: 5 + rng() * 5,
          front: rng() < 0.18,
        });
      }
      if (y > DEPTH_ZONES.reef - 150 && y < DEPTH_ZONES.abyss && rng() < 0.5) {
        const kinds: Coral['kind'][] = ['fan', 'brain', 'tube'];
        this.corals.push({ x: x + rng() * 20, y: this.floorY(x) + 4, size: 14 + rng() * 22, hue: [350, 18, 290, 175][Math.floor(rng() * 4)], kind: kinds[Math.floor(rng() * 3)] });
      }
      if (y > DEPTH_ZONES.abyss + 200 && rng() < 0.5) {
        this.glowPlants.push({ x, y: y + 4, height: 30 + rng() * 60, phase: rng() * 10, hue: rng() < 0.6 ? 180 : 280 });
      }
    }
  }

  private buildSpawns() {
    const onFloor = (x: number, table: LootTable, lift = 14) => this.spawns.push({ x, y: this.floorY(x) - lift, table });
    const tableFor = (x: number): LootTable => this.zoneAt(this.floorY(x));

    for (const x of [300, 470, 900, 1180, 1320, 1470, 1690, 1800, 1960, 2140, 2230, 2660, 2830, 3080, 3200, 3380, 3700, 3790, 3920, 4030]) {
      onFloor(x, tableFor(x));
    }
    // Treasure perched on top of the big rocks.
    for (const rock of this.rocks.filter((r) => r.r >= 44)) {
      this.spawns.push({ x: rock.x, y: rock.y - rock.r * 0.92 - 10, table: tableFor(rock.x) });
    }
    // The wreck's hold and the abyssal shrine roll special loot tables.
    for (const dx of [-90, -10, 80]) onFloor(this.wreck.x + dx, 'wreck', 22);
    onFloor(this.shrine.x - 26, 'shrine', 20);
    onFloor(this.shrine.x + 30, 'shrine', 20);
  }
}
