import type { Rarity, TreasureId } from './treasures';

export type ObjectiveKind = 'collect' | 'depth' | 'rarity' | 'visit' | 'haulValue' | 'item';
export type AreaId = 'wreck' | 'hold' | 'abyss' | 'shrine';

export interface ObjectiveTemplate {
  kind: ObjectiveKind;
  /** Which progression tier offers it: 0 reef, 1 wreck reached, 2 abyss reached. */
  tier: 0 | 1 | 2;
  /** Count, meters, dollars, minimum rarity, area id or treasure id depending on kind. */
  target: number | Rarity | AreaId | TreasureId;
  reward: number;
}

/** Rewards are a bonus on top of a good dive (roughly 10–20% of that tier's haul), never a replacement. */
export const OBJECTIVE_POOL: ObjectiveTemplate[] = [
  // Tier 0 — the reef
  { tier: 0, kind: 'collect', target: 3, reward: 40 },
  { tier: 0, kind: 'depth', target: 40, reward: 35 },
  { tier: 0, kind: 'rarity', target: 'uncommon', reward: 60 },
  { tier: 0, kind: 'haulValue', target: 150, reward: 50 },
  { tier: 0, kind: 'item', target: 'bottle', reward: 30 },
  { tier: 0, kind: 'visit', target: 'wreck', reward: 120 },
  // Tier 1 — the wreck
  { tier: 1, kind: 'collect', target: 6, reward: 120 },
  { tier: 1, kind: 'depth', target: 110, reward: 150 },
  { tier: 1, kind: 'rarity', target: 'rare', reward: 200 },
  { tier: 1, kind: 'visit', target: 'hold', reward: 180 },
  { tier: 1, kind: 'haulValue', target: 900, reward: 220 },
  { tier: 1, kind: 'item', target: 'bell', reward: 160 },
  { tier: 1, kind: 'visit', target: 'abyss', reward: 300 },
  // Tier 2 — the abyss
  { tier: 2, kind: 'collect', target: 10, reward: 350 },
  { tier: 2, kind: 'depth', target: 200, reward: 450 },
  { tier: 2, kind: 'rarity', target: 'epic', reward: 600 },
  { tier: 2, kind: 'visit', target: 'shrine', reward: 500 },
  { tier: 2, kind: 'haulValue', target: 3000, reward: 650 },
  { tier: 2, kind: 'item', target: 'crown', reward: 550 },
  { tier: 2, kind: 'item', target: 'mask', reward: 500 },
];

export const ACTIVE_OBJECTIVES = 3;

export const AREA_NAMES: Record<AreaId, string> = {
  wreck: 'the Wreck',
  hold: 'inside the wreck',
  abyss: 'the Abyss',
  shrine: 'the abyssal shrine',
};
