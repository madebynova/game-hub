import { weightedPick } from '../core/math';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITIES: Record<Rarity, { label: string; color: string; tier: number; pryTime: number }> = {
  common: { label: 'Common', color: '#d9e4ea', tier: 0, pryTime: 0.15 },
  uncommon: { label: 'Uncommon', color: '#6fe39a', tier: 1, pryTime: 0.45 },
  rare: { label: 'Rare', color: '#5cb8ff', tier: 2, pryTime: 0.8 },
  epic: { label: 'Epic', color: '#c586ff', tier: 3, pryTime: 1.3 },
  legendary: { label: 'Legendary', color: '#ffb547', tier: 4, pryTime: 2.0 },
};

export type TreasureId = 'coins' | 'doubloon' | 'amphora' | 'compass' | 'brooch' | 'pearls' | 'idol' | 'heart';

export interface TreasureDef {
  id: TreasureId;
  name: string;
  category: 'Coins' | 'Artifact' | 'Jewelry' | 'Relic';
  rarity: Rarity;
  baseValue: number;
}

export const TREASURES: Record<TreasureId, TreasureDef> = {
  coins: { id: 'coins', name: 'Tarnished Coins', category: 'Coins', rarity: 'common', baseValue: 14 },
  doubloon: { id: 'doubloon', name: 'Gold Doubloon', category: 'Coins', rarity: 'common', baseValue: 32 },
  amphora: { id: 'amphora', name: 'Clay Amphora', category: 'Artifact', rarity: 'uncommon', baseValue: 70 },
  compass: { id: 'compass', name: 'Brass Compass', category: 'Artifact', rarity: 'uncommon', baseValue: 95 },
  brooch: { id: 'brooch', name: 'Sapphire Brooch', category: 'Jewelry', rarity: 'rare', baseValue: 185 },
  pearls: { id: 'pearls', name: 'Pearl Necklace', category: 'Jewelry', rarity: 'rare', baseValue: 260 },
  idol: { id: 'idol', name: 'Jade Idol', category: 'Relic', rarity: 'epic', baseValue: 620 },
  heart: { id: 'heart', name: 'Heart of the Deep', category: 'Relic', rarity: 'legendary', baseValue: 1800 },
};

export type LootTable = 'shallows' | 'reef' | 'abyss' | 'wreck' | 'shrine';

/** Spawn weights per area. Deeper / harder-to-reach areas roll better loot. */
export const LOOT_TABLES: Record<LootTable, Partial<Record<TreasureId, number>>> = {
  shallows: { coins: 60, doubloon: 30, amphora: 9, compass: 1 },
  reef: { coins: 18, doubloon: 34, amphora: 22, compass: 14, brooch: 9, pearls: 3 },
  abyss: { doubloon: 12, amphora: 16, compass: 14, brooch: 24, pearls: 18, idol: 13, heart: 3 },
  wreck: { doubloon: 15, compass: 25, brooch: 32, pearls: 20, idol: 8 },
  shrine: { pearls: 30, idol: 50, heart: 20 },
};

export interface HaulItem {
  defId: TreasureId;
  name: string;
  rarity: Rarity;
  value: number;
}

/** Roll a concrete treasure (with ±15% value variance) from a loot table. */
export function rollTreasure(table: LootTable, rng: () => number = Math.random): HaulItem {
  const id = weightedPick(LOOT_TABLES[table], rng);
  const def = TREASURES[id];
  const variance = 0.85 + rng() * 0.3;
  return { defId: id, name: def.name, rarity: def.rarity, value: Math.round(def.baseValue * variance) };
}
