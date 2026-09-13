import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/config';
import { defaultSave, loadSave, sanitizeSave, writeSave } from '../src/core/save';
import { LOOT_TABLES, RARITIES, TREASURES, rollTreasure } from '../src/data/treasures';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('treasure data', () => {
  it('rarer tiers are worth more on average', () => {
    const avgByTier = new Map<number, number[]>();
    for (const def of Object.values(TREASURES)) {
      const tier = RARITIES[def.rarity].tier;
      avgByTier.set(tier, [...(avgByTier.get(tier) ?? []), def.baseValue]);
    }
    const avgs = [...avgByTier.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.reduce((s, x) => s + x, 0) / v.length);
    for (let i = 1; i < avgs.length; i++) expect(avgs[i]).toBeGreaterThan(avgs[i - 1]);
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

  it('deeper tables roll more valuable loot', () => {
    const avg = (table: 'shallows' | 'abyss') => {
      let sum = 0;
      for (let i = 0; i < 2000; i++) sum += rollTreasure(table).value;
      return sum / 2000;
    };
    expect(avg('abyss')).toBeGreaterThan(avg('shallows') * 5);
  });
});

describe('save data', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const save = defaultSave();
    save.cash = 1234;
    save.upgrades.tank = 2;
    save.lostSatchel = { x: 10, y: 900, items: [rollTreasure('reef')] };
    writeSave(save, storage);
    const loaded = loadSave(storage);
    expect(loaded.cash).toBe(1234);
    expect(loaded.upgrades.tank).toBe(2);
    expect(loaded.lostSatchel?.items).toHaveLength(1);
  });

  it('recovers from corrupt or tampered saves', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadSave(storage)).toEqual(defaultSave());

    const s = sanitizeSave({ cash: -50, upgrades: { tank: 99, bag: 'x' }, lostSatchel: { items: [{ defId: 'nope', value: 1 }] } });
    expect(s.cash).toBe(0);
    expect(s.upgrades.tank).toBe(3);
    expect(s.upgrades.bag).toBe(0);
    expect(s.lostSatchel).toBeNull();
  });
});
