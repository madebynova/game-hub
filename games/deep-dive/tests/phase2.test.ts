import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/math';
import { sanitizeSave } from '../src/core/save';
import { ACTIVE_OBJECTIVES, OBJECTIVE_POOL } from '../src/data/objectives';
import { rollTreasure, type HaulItem } from '../src/data/treasures';
import { FIN_CURRENT_RESIST } from '../src/data/upgrades';
import { AirPocketSystem, COLLAPSE_WARNING_SECONDS, CollapseSystem, collapsePenalty, flowAt } from '../src/systems/hazards';
import { ObjectiveTracker, describeObjective, fillObjectives, generateObjective, objectiveTier, type Objective } from '../src/systems/objectives';
import { World } from '../src/world/world';

const world = new World();
const obj = (partial: Omit<Objective, 'id' | 'tier' | 'reward'> & Partial<Objective>): Objective =>
  ({ id: `${partial.kind}-${partial.target}`, tier: 0, reward: 100, ...partial }) as Objective;
const found = (defId: HaulItem['defId'], rarity: HaulItem['rarity'] = 'common'): HaulItem => ({ defId, name: defId, rarity, value: 10 });

describe('currents', () => {
  const pull = world.currents.find((c) => c.id === 'pull')!;
  const mid = { x: (pull.rect.x0 + pull.rect.x1) / 2, y: (pull.rect.y0 + pull.rect.y1) / 2 };

  it('push at full strength inside, fade at the edges and vanish outside', () => {
    const inside = flowAt(world.currents, mid.x, mid.y);
    expect(inside.fy).toBeCloseTo(pull.fy);
    expect(inside.current?.id).toBe('pull');
    const edge = flowAt(world.currents, pull.rect.x0 + 10, mid.y);
    expect(edge.fy).toBeGreaterThan(0);
    expect(edge.fy).toBeLessThan(pull.fy);
    expect(flowAt(world.currents, 900, 300)).toMatchObject({ fx: 0, fy: 0, strength: 0, current: null });
  });

  it('are resisted by better fins', () => {
    const base = flowAt(world.currents, mid.x, mid.y, FIN_CURRENT_RESIST[0]).fy;
    const best = flowAt(world.currents, mid.x, mid.y, FIN_CURRENT_RESIST[3]).fy;
    expect(best).toBeCloseTo(base * 0.5);
  });
});

describe('collapsing wreckage', () => {
  const def = world.collapses[0];
  const inside = { x: (def.rect.x0 + def.rect.x1) / 2, y: (def.rect.y0 + def.rect.y1) / 2 };

  it('warns first, then falls on a diver who stays underneath', () => {
    const sys = new CollapseSystem([def]);
    expect(sys.update(0.016, 0, 0)).toEqual([]);
    const warn = sys.update(0.016, inside.x, inside.y);
    expect(warn[0].type).toBe('warning');
    let impact = null;
    for (let t = 0; t < COLLAPSE_WARNING_SECONDS + 0.1 && !impact; t += 0.05) {
      impact = sys.update(0.05, inside.x, inside.y).find((e) => e.type === 'impact') ?? null;
    }
    expect(impact).toMatchObject({ type: 'impact', hit: true });
    expect(sys.update(1, inside.x, inside.y)).toEqual([]); // spent for this dive
  });

  it('misses a diver who gets clear in time, and resets for the next dive', () => {
    const sys = new CollapseSystem([def]);
    sys.update(0.016, inside.x, inside.y);
    const events = sys.update(COLLAPSE_WARNING_SECONDS + 0.1, 0, 0);
    expect(events).toEqual([expect.objectContaining({ type: 'impact', hit: false })]);
    sys.reset();
    expect(sys.states[0].phase).toBe('stable');
  });

  it('costs more air with a bigger tank but never most of it', () => {
    expect(collapsePenalty(240)).toBeGreaterThan(collapsePenalty(60));
    expect(collapsePenalty(60)).toBeLessThan(60 * 0.3);
  });
});

describe('air pockets', () => {
  it('refill a limited amount per dive, never above the tank', () => {
    const pocket = world.airPockets[0];
    const sys = new AirPocketSystem([pocket]);
    let oxygen = 10;
    for (let i = 0; i < 600; i++) oxygen += sys.update(1 / 60, pocket.x, pocket.y, oxygen, 1000).gained;
    expect(oxygen).toBeCloseTo(10 + pocket.capacity);
    expect(sys.update(1, pocket.x, pocket.y, 5, 1000).gained).toBe(0);
    sys.reset();
    expect(sys.update(1, pocket.x, pocket.y, 59, 60).gained).toBeCloseTo(1);
    expect(sys.update(1, 0, 0, 10, 60)).toEqual({ gained: 0, pocket: null });
  });
});

describe('objectives', () => {
  it('complete from dive events and pay out only when claimed', () => {
    const list = [
      obj({ kind: 'collect', target: 2 }),
      obj({ kind: 'depth', target: 40 }),
      obj({ kind: 'rarity', target: 'rare' }),
    ];
    const t = new ObjectiveTracker(list);
    t.startDive();
    expect(t.recordCollect(found('coins'))).toEqual([]);
    expect(t.recordCollect(found('brooch', 'rare')).map((o) => o.kind).sort()).toEqual(['collect', 'rarity']);
    expect(t.recordDepth(39)).toEqual([]);
    expect(t.recordDepth(41).map((o) => o.kind)).toEqual(['depth']);
    expect(t.recordDepth(80)).toEqual([]); // no double completion
    const claimed = t.claim();
    expect(claimed).toHaveLength(3);
    expect(list).toHaveLength(0);
  });

  it('handles visits, specific items and haul value at boarding', () => {
    const list = [obj({ kind: 'visit', target: 'hold' }), obj({ kind: 'item', target: 'bell' }), obj({ kind: 'haulValue', target: 500 })];
    const t = new ObjectiveTracker(list);
    t.startDive();
    expect(t.recordVisit(['wreck'])).toEqual([]);
    expect(t.recordVisit(['wreck', 'hold'])[0].kind).toBe('visit');
    expect(t.recordCollect(found('bell', 'uncommon'))[0].kind).toBe('item');
    expect(t.evaluateBoarding(499)).toEqual([]);
    expect(t.evaluateBoarding(500)[0].kind).toBe('haulValue');
  });

  it('lose unclaimed progress when you black out', () => {
    const list = [obj({ kind: 'collect', target: 1 })];
    const t = new ObjectiveTracker(list);
    t.startDive();
    t.recordCollect(found('coins'));
    t.failDive();
    expect(t.claim()).toEqual([]);
    expect(list).toHaveLength(1);
  });

  it('generate by tier, without duplicates, and refill to three', () => {
    const rng = mulberry32(3);
    expect(objectiveTier([])).toBe(0);
    expect(objectiveTier(['wreck'])).toBe(1);
    expect(objectiveTier(['wreck', 'abyss'])).toBe(2);
    for (let i = 0; i < 50; i++) expect(generateObjective(0, [], rng).tier).toBe(0);
    const list = fillObjectives([], 2, rng);
    expect(list).toHaveLength(ACTIVE_OBJECTIVES);
    expect(new Set(list.map((o) => `${o.kind}:${o.target}`)).size).toBe(ACTIVE_OBJECTIVES);
    expect(new Set(list.map((o) => o.id)).size).toBe(ACTIVE_OBJECTIVES);
    for (const o of list) expect(o.tier).toBeGreaterThanOrEqual(1);
  });

  it('have readable descriptions and survive a save round-trip', () => {
    for (const t of OBJECTIVE_POOL) expect(describeObjective(t)).toMatch(/\w/);
    const list = fillObjectives([], 1, mulberry32(9));
    const loaded = sanitizeSave({ objectives: JSON.parse(JSON.stringify(list)) });
    expect(loaded.objectives).toEqual(list);
  });

  it('never offer a lower-tier "explore" goal for a place already reached', () => {
    const rng = mulberry32(11);
    const visited = ['reef', 'wreck', 'hold', 'abyss'];
    for (let i = 0; i < 300; i++) {
      const o = generateObjective(2, [], rng, visited);
      if (o.kind === 'visit') expect(o.tier).toBe(2);
    }
    const list = fillObjectives([], 1, mulberry32(5), ['wreck', 'hold']);
    for (const o of list) expect(o.kind === 'visit' && o.target === 'wreck').toBe(false);
  });

  it('deep objectives reward more than shallow ones, but less than a typical haul there', () => {
    const avg = (tier: number) => {
      const r = OBJECTIVE_POOL.filter((o) => o.tier === tier).map((o) => o.reward);
      return r.reduce((a, b) => a + b, 0) / r.length;
    };
    expect(avg(1)).toBeGreaterThan(avg(0) * 2);
    expect(avg(2)).toBeGreaterThan(avg(1) * 2);
    const abyssHaul = Array.from({ length: 400 }, () => rollTreasure('abyss').value).reduce((a, b) => a + b, 0) / 400 * 8;
    expect(avg(2)).toBeLessThan(abyssHaul * 0.25);
  });
});
