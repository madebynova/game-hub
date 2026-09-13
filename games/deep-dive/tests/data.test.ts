import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/config';
import { defaultSave, loadSave, sanitizeSave, writeSave } from '../src/core/save';
import { LOOT_TABLES, RARITIES, TREASURES, expectedValuePerSlot, rollTreasure, type LootTable } from '../src/data/treasures';
import { UPGRADES, UPGRADE_ORDER, totalUpgradeCost, upgradeValue } from '../src/data/upgrades';
import { oxygenToSurface } from '../src/systems/oxygen';
import { World } from '../src/world/world';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

/** A real Phase 1 save, exactly as it was stored in the browser. */
const PHASE1_SAVE = {
  cash: 6803,
  lostSatchel: null,
  muted: false,
  seenHints: ['start', 'collect', 'haul', 'oxygen', 'marker', 'sell', 'satchel'],
  stats: { bestDepthM: 176, bestSale: 6743, dives: 9, totalEarned: 10823 },
  upgrades: { bag: 3, light: 3, tank: 3 },
  version: 1,
};

describe('treasure data', () => {
  it('rarer tiers are worth more on average, and every tier is distinct', () => {
    const byTier = new Map<number, number[]>();
    for (const def of Object.values(TREASURES)) {
      const tier = RARITIES[def.rarity].tier;
      byTier.set(tier, [...(byTier.get(tier) ?? []), def.baseValue / def.slots]);
    }
    const tiers = [...byTier.entries()].sort((a, b) => a[0] - b[0]);
    expect(tiers).toHaveLength(5);
    for (let i = 1; i < tiers.length; i++) {
      expect(Math.min(...tiers[i][1])).toBeGreaterThan(Math.max(...tiers[i - 1][1]) * 0.9);
    }
  });

  it('has at least three treasures in each rarity below legendary', () => {
    for (const r of ['common', 'uncommon', 'rare', 'epic'] as const) {
      expect(Object.values(TREASURES).filter((t) => t.rarity === r).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('loot tables only reference known treasures', () => {
    for (const table of Object.values(LOOT_TABLES)) {
      for (const id of Object.keys(table)) expect(TREASURES).toHaveProperty(id);
    }
  });

  it('rolls stay within ±15% of base value', () => {
    for (let i = 0; i < 500; i++) {
      const it = rollTreasure('abyss');
      const base = TREASURES[it.defId].baseValue;
      expect(it.value).toBeGreaterThanOrEqual(Math.floor(base * 0.85));
      expect(it.value).toBeLessThanOrEqual(Math.ceil(base * 1.15));
    }
  });

  it('each step deeper is worth more per bag slot', () => {
    const order: LootTable[] = ['shallows', 'reef', 'wreck', 'hold', 'abyss', 'shrine'];
    for (let i = 1; i < order.length; i++) {
      expect(expectedValuePerSlot(order[i]), order[i]).toBeGreaterThan(expectedValuePerSlot(order[i - 1]) * 1.3);
    }
  });
});

describe('progression balance', () => {
  it('keeps Phase 1 gear stats identical so existing saves play the same', () => {
    expect(UPGRADES.tank.values.slice(0, 4)).toEqual([60, 85, 115, 150]);
    expect(UPGRADES.bag.values.slice(0, 4)).toEqual([5, 8, 12, 16]);
    expect(UPGRADES.light.values.slice(0, 4)).toEqual([170, 260, 350, 460]);
  });

  it('maxing all gear costs far more than Phase 1 did', () => {
    const phase1Total = 150 + 450 + 1100 + 120 + 380 + 950 + 100 + 320 + 850;
    expect(totalUpgradeCost()).toBeGreaterThan(phase1Total * 8);
  });

  it('every upgrade gets steadily more expensive', () => {
    for (const id of UPGRADE_ORDER) {
      const c = UPGRADES[id].costs;
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1] * 1.8);
    }
  });

  it('a full starting bag from the shallows cannot buy an upgrade in one dive', () => {
    const cheapest = Math.min(...UPGRADE_ORDER.map((id) => UPGRADES[id].costs[0]));
    expect(expectedValuePerSlot('shallows') * upgradeValue('bag', 0)).toBeLessThan(cheapest);
  });

  it('the deep tiers cost several full abyss bags each', () => {
    const abyssBag = expectedValuePerSlot('abyss') * upgradeValue('bag', 3);
    expect(UPGRADES.tank.costs[4] / abyssBag).toBeGreaterThan(1);
    const deepTiers = UPGRADE_ORDER.reduce((s, id) => s + UPGRADES[id].costs.slice(3).reduce((a, b) => a + b, 0), 0);
    expect(deepTiers / abyssBag).toBeGreaterThan(5);
  });

  it('the shrine is out of reach for a starting tank but tight even with maxed Phase 1 air', () => {
    const shrineY = new World().shrine.y;
    const roundTrip = oxygenToSurface(shrineY) * 2;
    expect(roundTrip).toBeGreaterThan(upgradeValue('tank', 0));
    expect(roundTrip).toBeLessThan(upgradeValue('tank', 3));
    expect(roundTrip / upgradeValue('tank', 3)).toBeGreaterThan(0.4);
  });
});

describe('save data', () => {
  it('keeps the original save key, so renaming the game never orphans saves', () => {
    expect(SAVE_KEY).toBe('deepdive.save.v1');
  });

  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const save = defaultSave();
    save.cash = 1234;
    save.upgrades.tank = 2;
    save.upgrades.fins = 1;
    save.discovered = ['coins', 'bell'];
    save.stats.zonesVisited = ['wreck'];
    save.lostSatchel = { x: 10, y: 900, items: [rollTreasure('reef')] };
    writeSave(save, storage);
    const loaded = loadSave(storage);
    expect(loaded.cash).toBe(1234);
    expect(loaded.upgrades).toEqual({ tank: 2, bag: 0, light: 0, fins: 1 });
    expect(loaded.discovered).toEqual(['coins', 'bell']);
    expect(loaded.stats.zonesVisited).toEqual(['wreck']);
    expect(loaded.lostSatchel?.items).toHaveLength(1);
  });

  it('loads a real Phase 1 save without losing any progress', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(PHASE1_SAVE));
    const s = loadSave(storage);
    expect(s.cash).toBe(6803);
    expect(s.upgrades).toEqual({ tank: 3, bag: 3, light: 3, fins: 0 });
    expect(s.stats).toMatchObject({ bestDepthM: 176, bestSale: 6743, dives: 9, totalEarned: 10823, zonesVisited: [], objectivesDone: 0 });
    expect(s.seenHints).toEqual(PHASE1_SAVE.seenHints);
    expect(s.objectives).toEqual([]);
    expect(s.discovered).toEqual([]);
    expect(s.version).toBe(2);
  });

  it('keeps a Phase 1 lost satchel (including items that are now heavy)', () => {
    const s = sanitizeSave({ ...PHASE1_SAVE, lostSatchel: { x: 3116, y: 2474, items: [{ defId: 'amphora', name: 'Clay Amphora', rarity: 'uncommon', value: 61 }] } });
    expect(s.lostSatchel?.items[0].defId).toBe('amphora');
  });

  it('recovers from corrupt or tampered saves', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadSave(storage)).toEqual(defaultSave());

    const s = sanitizeSave({
      cash: -50,
      upgrades: { tank: 99, bag: 'x' },
      lostSatchel: { items: [{ defId: 'nope', value: 1 }] },
      objectives: [{ id: 'x', kind: 'collect', target: 999, tier: 0, reward: 1e9 }, 'junk'],
      discovered: ['coins', 'dragon'],
    });
    expect(s.cash).toBe(0);
    expect(s.upgrades.tank).toBe(5);
    expect(s.upgrades.bag).toBe(0);
    expect(s.lostSatchel).toBeNull();
    expect(s.objectives).toEqual([]);
    expect(s.discovered).toEqual(['coins']);
  });
});
