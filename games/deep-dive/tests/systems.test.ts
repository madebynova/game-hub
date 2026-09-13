import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/core/save';
import type { HaulItem } from '../src/data/treasures';
import { purchaseUpgrade, sellHaul } from '../src/systems/economy';
import { Haul } from '../src/systems/haul';
import { drainRate, oxygenStatus, oxygenToSurface } from '../src/systems/oxygen';

const item = (value: number): HaulItem => ({ defId: 'coins', name: 'Tarnished Coins', rarity: 'common', value });

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
    for (let i = 0; i < 3; i++) expect(purchaseUpgrade(save, 'bag').ok).toBe(true);
    expect(save.upgrades.bag).toBe(3);
    expect(purchaseUpgrade(save, 'bag')).toEqual({ ok: false, reason: 'maxed' });
    expect(save.cash).toBe(100_000 - 120 - 380 - 950);
  });
});

describe('oxygen', () => {
  it('drains faster with depth', () => {
    expect(drainRate(0)).toBe(1);
    expect(drainRate(3000)).toBeCloseTo(1.8);
    expect(drainRate(1500)).toBeGreaterThan(drainRate(500));
  });

  it('needs more air to surface from deeper water', () => {
    expect(oxygenToSurface(0)).toBe(0);
    expect(oxygenToSurface(2000)).toBeGreaterThan(oxygenToSurface(1000));
  });

  it('starting tank can comfortably explore the shallows and reach the reef', () => {
    // Round trip straight down to the reef (~1300) should use well under the base 60s tank.
    expect(oxygenToSurface(1300) * 2).toBeLessThan(30);
  });

  it('flags critical when there is not enough air to surface', () => {
    expect(oxygenStatus(50, 60, 100)).toBe('ok');
    expect(oxygenStatus(15, 60, 100)).toBe('low');
    expect(oxygenStatus(5, 60, 100)).toBe('critical');
    expect(oxygenStatus(12, 60, 2800)).toBe('critical');
    expect(oxygenStatus(0, 60, 100)).toBe('empty');
  });
});
