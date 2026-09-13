import { describe, expect, it } from 'vitest';
import { BOAT, PLAYER, WORLD } from '../src/config';
import { mulberry32 } from '../src/core/math';
import { Player } from '../src/entities/player';
import { ZONE_ORDER, zoneAt } from '../src/world/zones';
import { World } from '../src/world/world';

const world = new World();

/** Flood-fill every position the diver's body can occupy, starting in open water beside the boat. */
function reachableGrid(step = 6) {
  const cols = Math.ceil(WORLD.width / step);
  const rows = Math.ceil(WORLD.bottom / step);
  const seen = new Uint8Array(cols * rows);
  const r = PLAYER.radius;
  const queue: number[] = [];
  const start = Math.floor((BOAT.x + 240) / step) + Math.floor(30 / step) * cols;
  seen[start] = 1;
  queue.push(start);
  for (let qi = 0; qi < queue.length; qi++) {
    const idx = queue[qi];
    const cx = idx % cols;
    const cy = (idx - cx) / cols;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen[n]) continue;
      if (!world.isOpen(nx * step, ny * step, r)) {
        seen[n] = 2;
        continue;
      }
      seen[n] = 1;
      queue.push(n);
    }
  }
  const canReachNear = (x: number, y: number, radius: number) => {
    for (let gy = Math.floor((y - radius) / step); gy <= Math.ceil((y + radius) / step); gy++) {
      for (let gx = Math.floor((x - radius) / step); gx <= Math.ceil((x + radius) / step); gx++) {
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        if (seen[gy * cols + gx] === 1 && Math.hypot(gx * step - x, gy * step - y) <= radius) return true;
      }
    }
    return false;
  };
  return { canReachNear };
}

describe('world layout', () => {
  it('has water between the surface and the seafloor everywhere', () => {
    for (let x = WORLD.wallMargin; x < WORLD.width - WORLD.wallMargin; x += 8) {
      expect(world.floorY(x)).toBeGreaterThan(250);
      expect(world.floorY(x)).toBeLessThan(WORLD.bottom);
    }
  });

  it('places every treasure in open water (above floor, outside rocks and wreck walls)', () => {
    for (const s of world.spawns) {
      expect(s.y).toBeLessThan(world.floorY(s.x));
      expect(s.y).toBeGreaterThan(0);
      expect(world.isOpen(s.x, s.y, 6), `spawn at ${Math.round(s.x)},${Math.round(s.y)}`).toBe(true);
    }
  });

  it('has several treasure spots in each zone', () => {
    const counts = { reef: 0, wreck: 0, abyss: 0 };
    for (const s of world.spawns) counts[world.zoneAt(s.x, s.y)]++;
    for (const z of ZONE_ORDER) expect(counts[z], z).toBeGreaterThanOrEqual(5);
  });

  it('puts the best loot tables in the harder zones', () => {
    for (const s of world.spawns) {
      if (s.table === 'hold') expect(world.insideWreck(s.x, s.y)).toBe(true);
      if (s.table === 'abyss' || s.table === 'shrine') expect(world.zoneAt(s.x, s.y)).toBe('abyss');
      if (s.table === 'shallows') expect(world.zoneAt(s.x, s.y)).toBe('reef');
    }
  });

  it('every treasure, air pocket and unstable section can actually be reached by the diver', () => {
    const grid = reachableGrid();
    for (const s of world.spawns) {
      expect(grid.canReachNear(s.x, s.y, PLAYER.interactRadius - 4), `${s.table} spawn at ${Math.round(s.x)},${Math.round(s.y)}`).toBe(true);
    }
    for (const p of world.airPockets) expect(grid.canReachNear(p.x, p.y, p.r), p.id).toBe(true);
    for (const c of world.collapses) {
      const cx = (c.rect.x0 + c.rect.x1) / 2;
      const cy = (c.rect.y0 + c.rect.y1) / 2;
      expect(grid.canReachNear(cx, cy, 60), c.id).toBe(true);
    }
  }, 30_000);
});

describe('zones', () => {
  it('progress from reef to wreck to abyss as you go deeper', () => {
    expect(zoneAt(900, 300)).toBe('reef');
    expect(zoneAt(1500, 700)).toBe('reef');
    expect(zoneAt(2700, 1500)).toBe('wreck');
    expect(zoneAt(2500, 1300)).toBe('wreck');
    expect(zoneAt(4600, 3900)).toBe('abyss');
    expect(zoneAt(3700, 1200)).toBe('abyss');
    expect(zoneAt(2700, 100)).toBe('reef');
  });

  it('marks the wreck interior and shrine as named areas', () => {
    const hold = world.spawns.find((s) => s.table === 'hold')!;
    expect(world.areasAt(hold.x, hold.y)).toContain('hold');
    expect(world.areasAt(world.shrine.x, world.shrine.y - 80)).toContain('shrine');
    expect(world.areasAt(900, 300)).toEqual([]);
  });

  it('relocates positions buried in terrain (e.g. Phase 1 satchels) into reachable water', () => {
    for (const [x, y] of [[3116, 2474], [2700, 1690], [4050, 3700], [100, 5000]]) {
      const p = world.clampToOpenWater(x, y);
      expect(world.isOpen(p.x, p.y, 20), `${x},${y}`).toBe(true);
    }
  });
});

describe('player movement', () => {
  it('walking off the stern drops the diver into the water', () => {
    const p = new Player();
    p.placeOnDeck();
    let jumped = false;
    for (let i = 0; i < 240 && !jumped; i++) jumped = p.updateDeck(1 / 60, 1);
    expect(jumped).toBe(true);
    let splashed = false;
    for (let i = 0; i < 240 && !splashed; i++) splashed = p.updateAirborne(1 / 60);
    expect(splashed).toBe(true);
    expect(p.mode).toBe('swim');
    p.updateSwim(1 / 60, 0, 0, world);
    expect(p.x).toBeGreaterThan(BOAT.deckRight);
  });

  it('never leaves the playable area or clips into walls during random swimming', () => {
    const rng = mulberry32(42);
    const p = new Player();
    p.mode = 'swim';
    p.x = 2500;
    p.y = 1300;
    let ax = 0;
    let ay = 1;
    for (let i = 0; i < 60 * 240; i++) {
      if (i % 45 === 0) {
        ax = Math.round(rng() * 2 - 1);
        ay = rng() < 0.6 ? 1 : Math.round(rng() * 2 - 1);
      }
      p.updateSwim(1 / 60, ax, ay, world, 1, (rng() - 0.5) * 120, (rng() - 0.5) * 120);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.waterY);
      expect(p.y).toBeLessThan(world.floorY(p.x));
      expect(p.x).toBeGreaterThanOrEqual(WORLD.wallMargin);
      expect(p.x).toBeLessThanOrEqual(WORLD.width - WORLD.wallMargin);
      expect(world.isOpen(p.x, p.y, PLAYER.radius * 0.5)).toBe(true);
    }
  });

  it('can reach the bottom of the abyss', () => {
    const p = new Player();
    p.mode = 'swim';
    p.x = world.shrine.x + 150;
    p.y = 0;
    for (let i = 0; i < 60 * 30; i++) p.updateSwim(1 / 60, 0, 1, world);
    expect(p.y).toBeGreaterThan(world.floorY(p.x) - PLAYER.radius * 3);
  });

  it('is carried by currents', () => {
    const still = new Player();
    const pushed = new Player();
    for (const p of [still, pushed]) {
      p.mode = 'swim';
      p.x = 3830;
      p.y = 2600;
    }
    for (let i = 0; i < 60; i++) {
      still.updateSwim(1 / 60, 0, 0, world);
      pushed.updateSwim(1 / 60, 0, 0, world, 1, 0, 175);
    }
    expect(pushed.y - still.y).toBeGreaterThan(150);
  });
});
