import type { SaveData } from '../core/save';
import { nextCost, type UpgradeId } from '../data/upgrades';
import type { Haul } from './haul';

/** Convert the current haul into permanent cash. Returns the amount earned. */
export function sellHaul(save: SaveData, haul: Haul): number {
  const earned = haul.total;
  if (earned <= 0) return 0;
  haul.clear();
  save.cash += earned;
  save.stats.totalEarned += earned;
  save.stats.bestSale = Math.max(save.stats.bestSale, earned);
  return earned;
}

export type PurchaseResult = { ok: true; level: number; cost: number } | { ok: false; reason: 'maxed' | 'funds' };

export function purchaseUpgrade(save: SaveData, id: UpgradeId): PurchaseResult {
  const level = save.upgrades[id];
  const cost = nextCost(id, level);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (save.cash < cost) return { ok: false, reason: 'funds' };
  save.cash -= cost;
  save.upgrades[id] = level + 1;
  return { ok: true, level: level + 1, cost };
}
