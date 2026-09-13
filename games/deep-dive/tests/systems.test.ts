import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/core/save';
import type { HaulItem } from '../src/data/treasures';
import { UPGRADES } from '../src/data/upgrades';
import { purchaseUpgrade, sellHaul } from '../src/systems/economy';
import { Haul } from '../src/systems/haul';
import { drainRate, oxygenStatus, oxygenToSurface } from '../src/systems/oxygen';

const item = (value: number, defId: HaulItem['defId'] = 'coins'): HaulItem => ({ defId, name: defId, rarity: 'common', value });

describe('Haul', () => {
  it('respects bag capacity', () => {
    const haul = new Haul(2);
    expect(haul.add(item(10))).toBe(true);
    expect(haul.add(item(20))).toBe(true);
    expect(haul.add(item(30))).toBe(false);
    expect(haul.count).toBe(2);
    expect(haul.total).toBe(30);
    expect(haul.isFull).toBe(true);
  });

  it('addMany returns the items that did not fit', () => {
    const haul = new Haul(3);
    haul.add(item(1));
    const leftover = haul.addMany([item(2), item(3), item(4)]);
    expect(haul.count).toBe(3);
    expect(leftover.map((i) => i.value)).toEqual([4]);
  });

  it('heavy treasure takes two slots', () => {
    const haul = new Haul(3);
    expect(haul.add(item(170, 'bell'))).toBe(true);
    expect(haul.usedSlots).toBe(2);
    expect(haul.freeSlots).toBe(1);
    expect(haul.add(item(460, 'bust'))).toBe(false);
    expect(haul.add(item(14))).toBe(true);
    expect(haul.isFull).toBe(true);
  });

  it('addMany skips heavy items that do not fit but still packs lighter ones', () => {
    const haul = new Haul(2);
    haul.add(item(1));
    const leftover = haul.addMany([item(460, 'bust'), item(14)]);
    expect(haul.items.map((i) => i.defId)).toEqual(['coins', 'coins']);
    expect(leftover.map((i) => i.defId)).toEqual(['bust']);
  });
});

describe('economy', () => {
  it('selling moves haul value into permanent cash and clears the haul', () => {
    const save = defaultSave();
    const haul = new Haul(5);
    haul.add(item(40));
    haul.add(item(60));
    expect(sellHaul(save, haul)).toBe(100);
    expect(save.cash).toBe(100);
    expect(save.stats.totalEarned).toBe(100);
    expect(haul.count).toBe(0);
    expect(sellHaul(save, haul)).toBe(0);
  });

  it('upgrades cost cash, level up, and cap at max level', () => {
    const save = defaultSave();
    expect(purchaseUpgrade(save, 'bag')).toEqual({ ok: false, reason: 'funds' });
    save.cash = 100_000;
    const costs = UPGRADES.bag.costs;
    for (let i = 0; i < costs.length; i++) expect(purchaseUpgrade(save, 'bag').ok).toBe(true);
    expect(save.upgrades.bag).toBe(costs.length);
    expect(purchaseUpgrade(save, 'bag')).toEqual({ ok: false, reason: 'maxed' });
    expect(save.cash).toBe(100_000 - costs.reduce((s, c) => s + c, 0));
  });
});

describe('oxygen', () => {
  it('drains faster with depth, and much faster in the abyss', () => {
    expect(drainRate(0)).toBe(1);
    expect(drainRate(1500)).toBeGreaterThan(drainRate(500));
    expect(drainRate(4000)).toBeCloseTo(3);
    expect(drainRate(3500)).toBeGreaterThan(drainRate(600) * 2);
    for (let y = 0; y < 4400; y += 50) expect(drainRate(y + 50)).toBeGreaterThanOrEqual(drainRate(y));
  });

  it('needs more air to surface from deeper water', () => {
    expect(oxygenToSurface(0)).toBe(0);
    expect(oxygenToSurface(2000)).toBeGreaterThan(oxygenToSurface(1000));
    expect(oxygenToSurface(2000, 300)).toBeLessThan(oxygenToSurface(2000, 215));
  });

  it('starting tank can comfortably explore the reef and reach the wreck', () => {
    expect(oxygenToSurface(760) * 2).toBeLessThan(12);
    expect(oxygenToSurface(1700) * 2).toBeLessThan(30);
  });

  it('flags critical when there is not enough air to surface', () => {
    expect(oxygenStatus(50, 60, 100)).toBe('ok');
    expect(oxygenStatus(15, 60, 100)).toBe('low');
    expect(oxygenStatus(5, 60, 100)).toBe('critical');
    expect(oxygenStatus(12, 60, 2800)).toBe('critical');
    expect(oxygenStatus(0, 60, 100)).toBe('empty');
  });
});
