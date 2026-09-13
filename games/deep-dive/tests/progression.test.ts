import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/core/save';
import { ObjectiveTracker, type Objective } from '../src/systems/objectives';
import { TREASURES } from '../src/data/treasures';
import { objectiveRows, recordDiscovery, recordVisits, treasureLog } from '../src/systems/progression';

describe('progression log', () => {
  it('records zones once and reports first-time visits', () => {
    const save = defaultSave();
    expect(recordVisits(save, ['reef', 'reef'])).toEqual(['reef']);
    expect(recordVisits(save, ['reef', 'wreck', 'hold'])).toEqual(['wreck', 'hold']);
    expect(recordVisits(save, ['wreck'])).toEqual([]);
    expect(save.stats.zonesVisited).toEqual(['reef', 'wreck', 'hold']);
  });

  it('adds each treasure type to the log only once', () => {
    const save = defaultSave();
    expect(recordDiscovery(save, 'bell')).toBe(true);
    expect(recordDiscovery(save, 'bell')).toBe(false);
    expect(save.discovered).toEqual(['bell']);
  });

  it('builds the treasure log grouped by rarity, cheapest first, marking what was found', () => {
    const log = treasureLog(['coins', 'heart', 'bell']);
    expect(log.map((g) => g.rarity)).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
    expect(log.reduce((n, g) => n + g.entries.length, 0)).toBe(Object.keys(TREASURES).length);
    expect(log.map((g) => g.found)).toEqual([1, 1, 0, 0, 1]);
    expect(log[0].entries[0]).toMatchObject({ id: 'coins', found: true, value: 14 });
    expect(log[1].entries.find((e) => e.id === 'bell')).toMatchObject({ found: true, slots: 2 });
    for (const g of log) {
      for (let i = 1; i < g.entries.length; i++) expect(g.entries[i].value).toBeGreaterThanOrEqual(g.entries[i - 1].value);
    }
    expect(treasureLog([]).every((g) => g.found === 0)).toBe(true);
  });

  it('formats objective rows with live progress', () => {
    const list: Objective[] = [
      { id: 'a', kind: 'collect', target: 3, tier: 0, reward: 40 },
      { id: 'b', kind: 'depth', target: 40, tier: 0, reward: 35 },
      { id: 'c', kind: 'haulValue', target: 150, tier: 0, reward: 50 },
    ];
    const t = new ObjectiveTracker(list);
    t.startDive();
    t.recordCollect({ defId: 'coins', name: 'Tarnished Coins', rarity: 'common', value: 14 });
    t.recordDepth(52);
    const rows = objectiveRows(t, 90);
    expect(rows.map((r) => r.progress)).toEqual(['1/3', '40/40m', '$90']);
    expect(rows.map((r) => r.done)).toEqual([false, true, false]);
    expect(rows[0].text).toBe('Collect 3 treasures in one dive');
  });
});
