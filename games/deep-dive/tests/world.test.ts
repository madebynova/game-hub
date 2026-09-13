import { describe, expect, it } from 'vitest';
import { BOAT, PLAYER, WORLD } from '../src/config';
import { mulberry32 } from '../src/core/math';
import { Player } from '../src/entities/player';
import { World } from '../src/world/world';

describe('world layout', () => {
  const world = new World();

  it('has water between the surface and the seafloor everywhere', () => {
    for (let x = WORLD.wallMargin; x < WORLD.width - WORLD.wallMargin; x += 8) {
      expect(world.floorY(x)).toBeGreaterThan(250);
      expect(world.floorY(x)).toBeLessThan(WORLD.bottom);
    }
  });

  it('places every treasure in open water (above floor, outside rocks, inside the walls)', () => {
    for (const s of world.spawns) {
      expect(s.y).toBeLessThan(world.floorY(s.x));
      expect(s.y).toBeGreaterThan(0);
      expect(s.x).toBeGreaterThan(WORLD.wallMargin);
      expect(s.x).toBeLessThan(WORLD.width - WORLD.wallMargin);
      for (const r of world.rocks) {
        expect(Math.hypot(s.x - r.x, s.y - r.y)).toBeGreaterThan(r.r * 0.9);
      }
    }
  });

  it('has several treasure spots in each depth zone', () => {
    const zones = { shallows: 0, reef: 0, abyss: 0 };
    for (const s of world.spawns) zones[world.zoneAt(s.y)]++;
    expect(zones.shallows).toBeGreaterThanOrEqual(5);
    expect(zones.reef).toBeGreaterThanOrEqual(5);
    expect(zones.abyss).toBeGreaterThanOrEqual(5);
  });
});

describe('player movement', () => {
  it('walking off the stern drops the diver into the water', () => {
    const world = new World();
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

  it('never leaves the playable area during random swimming', () => {
    const world = new World();
    const rng = mulberry32(42);
    const p = new Player();
    p.mode = 'swim';
    p.x = 1200;
    p.y = 200;
    let ax = 0;
    let ay = 1;
    for (let i = 0; i < 60 * 240; i++) {
      if (i % 45 === 0) {
        ax = Math.round(rng() * 2 - 1);
        ay = rng() < 0.6 ? 1 : Math.round(rng() * 2 - 1); // bias downward to scrape terrain
      }
      p.updateSwim(1 / 60, ax, ay, world);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.waterY);
      expect(p.y).toBeLessThan(world.floorY(p.x));
      expect(p.x).toBeGreaterThanOrEqual(WORLD.wallMargin);
      expect(p.x).toBeLessThanOrEqual(WORLD.width - WORLD.wallMargin);
      expect(Number.isFinite(p.x + p.y)).toBe(true);
    }
  });

  it('can reach the bottom of the trench', () => {
    const world = new World();
    const p = new Player();
    p.mode = 'swim';
    p.x = 3450;
    p.y = 0;
    for (let i = 0; i < 60 * 30; i++) p.updateSwim(1 / 60, 0, 1, world);
    expect(p.y).toBeGreaterThan(world.floorY(p.x) - PLAYER.radius * 3);
  });
});
