import { weightedPick } from '../core/math';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** `epic` keeps its Phase 1 id for save compatibility but is presented as "Very Rare". */
export const RARITIES: Record<Rarity, { label: string; color: string; tier: number; pryTime: number }> = {
  common: { label: 'Common', color: '#d9e4ea', tier: 0, pryTime: 0.15 },
  uncommon: { label: 'Uncommon', color: '#6fe39a', tier: 1, pryTime: 0.45 },
  rare: { label: 'Rare', color: '#5cb8ff', tier: 2, pryTime: 0.8 },
  epic: { label: 'Very Rare', color: '#c586ff', tier: 3, pryTime: 1.3 },
  legendary: { label: 'Legendary', color: '#ffb547', tier: 4, pryTime: 2.0 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export type TreasureId =
  // Phase 1
  | 'coins' | 'doubloon' | 'amphora' | 'compass' | 'brooch' | 'pearls' | 'idol' | 'heart'
  // Phase 2
  | 'bottle' | 'tools' | 'silver' | 'ring' | 'bell' | 'chalice' | 'emerald' | 'astrolabe'
  | 'bust' | 'crown' | 'mask' | 'leviathan';

export type TreasureCategory = 'Coins' | 'Salvage' | 'Silver' | 'Artifact' | 'Jewelry' | 'Gemstone' | 'Relic';

export interface TreasureDef {
  id: TreasureId;
  name: string;
  category: TreasureCategory;
  rarity: Rarity;
  baseValue: number;
  /** Bag slots this item occupies. Heavy finds force a choice about what to carry. */
  slots: number;
}

const def = (id: TreasureId, name: string, category: TreasureCategory, rarity: Rarity, baseValue: number, slots = 1): TreasureDef =>
  ({ id, name, category, rarity, baseValue, slots });

export const TREASURES: Record<TreasureId, TreasureDef> = {
  // Common — the reef's everyday salvage
  coins: def('coins', 'Tarnished Coins', 'Coins', 'common', 14),
  bottle: def('bottle', 'Message Bottle', 'Salvage', 'common', 18),
  tools: def('tools', 'Brass Tools', 'Salvage', 'common', 22),
  doubloon: def('doubloon', 'Gold Doubloon', 'Coins', 'common', 32),
  // Uncommon — antiques and silver
  amphora: def('amphora', 'Clay Amphora', 'Artifact', 'uncommon', 75, 2),
  compass: def('compass', 'Brass Compass', 'Artifact', 'uncommon', 95),
  silver: def('silver', 'Silver Candlestick', 'Silver', 'uncommon', 110),
  ring: def('ring', 'Gold Signet Ring', 'Jewelry', 'uncommon', 125),
  bell: def('bell', "Ship's Bell", 'Artifact', 'uncommon', 170, 2),
  // Rare — gems and valuable artifacts
  brooch: def('brooch', 'Sapphire Brooch', 'Jewelry', 'rare', 185),
  pearls: def('pearls', 'Pearl Necklace', 'Jewelry', 'rare', 260),
  emerald: def('emerald', 'Uncut Emerald', 'Gemstone', 'rare', 300),
  chalice: def('chalice', 'Jeweled Chalice', 'Artifact', 'rare', 340),
  astrolabe: def('astrolabe', 'Bronze Astrolabe', 'Artifact', 'rare', 380),
  bust: def('bust', 'Marble Bust', 'Artifact', 'rare', 460, 2),
  // Very rare — relics
  idol: def('idol', 'Jade Idol', 'Relic', 'epic', 620),
  mask: def('mask', 'Abyssal Mask', 'Relic', 'epic', 820),
  crown: def('crown', 'Drowned Crown', 'Jewelry', 'epic', 950),
  // Legendary — unique deep-sea treasures
  heart: def('heart', 'Heart of the Deep', 'Relic', 'legendary', 1800),
  leviathan: def('leviathan', 'Leviathan Pearl', 'Gemstone', 'legendary', 2600),
};

export type LootTable = 'shallows' | 'reef' | 'wreck' | 'hold' | 'abyss' | 'shrine';

/** Spawn weights per area. Deeper and harder-to-reach areas roll better loot. */
export const LOOT_TABLES: Record<LootTable, Partial<Record<TreasureId, number>>> = {
  shallows: { coins: 40, bottle: 26, tools: 20, doubloon: 12, amphora: 2 },
  reef: { doubloon: 30, tools: 10, amphora: 14, compass: 16, silver: 14, ring: 10, brooch: 5, pearls: 1 },
  wreck: { doubloon: 22, silver: 20, ring: 15, compass: 14, bell: 12, brooch: 10, astrolabe: 5, pearls: 2 },
  hold: { brooch: 22, pearls: 20, chalice: 18, astrolabe: 16, bust: 12, idol: 7, crown: 5 },
  abyss: { emerald: 18, pearls: 8, chalice: 14, astrolabe: 10, bust: 8, idol: 18, mask: 14, heart: 4 },
  shrine: { idol: 44, mask: 34, heart: 15, leviathan: 7 },
};

export interface HaulItem {
  defId: TreasureId;
  name: string;
  rarity: Rarity;
  value: number;
}

export const slotsOf = (item: Pick<HaulItem, 'defId'>) => TREASURES[item.defId]?.slots ?? 1;

/** Roll a concrete treasure (with ±15% value variance) from a loot table. */
export function rollTreasure(table: LootTable, rng: () => number = Math.random): HaulItem {
  const id = weightedPick(LOOT_TABLES[table], rng);
  const d = TREASURES[id];
  const variance = 0.85 + rng() * 0.3;
  return { defId: id, name: d.name, rarity: d.rarity, value: Math.round(d.baseValue * variance) };
}

/** Average value of one roll from a table (ignoring variance, which averages out). */
export function expectedValue(table: LootTable): number {
  const entries = Object.entries(LOOT_TABLES[table]) as [TreasureId, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return entries.reduce((s, [id, w]) => s + (TREASURES[id].baseValue * w) / total, 0);
}

/** Average value per bag slot from a table — what a full bag is worth. */
export function expectedValuePerSlot(table: LootTable): number {
  const entries = Object.entries(LOOT_TABLES[table]) as [TreasureId, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const slots = entries.reduce((s, [id, w]) => s + (TREASURES[id].slots * w) / total, 0);
  return expectedValue(table) / slots;
}
