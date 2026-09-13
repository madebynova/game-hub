export type UpgradeId = 'tank' | 'bag' | 'light' | 'fins';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  description: string;
  /** Stat value at each level; index 0 is the starting gear. */
  values: number[];
  /** costs[i] is the price to go from level i to level i + 1. */
  costs: number[];
  format: (v: number) => string;
}

/**
 * Phase 2 adds two "deep-rated" tiers to the original gear and a new pair of fins.
 * Levels 0–3 keep their Phase 1 stats so existing saves play exactly as before;
 * the new tiers are priced against wreck and abyss income, not reef income.
 */
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  tank: {
    id: 'tank',
    name: 'Oxygen Tank',
    icon: '🫧',
    description: 'More air per dive. The abyss eats through it.',
    values: [60, 85, 115, 150, 190, 240],
    costs: [200, 550, 1300, 4800, 10500],
    format: (v) => `${v}s air`,
  },
  bag: {
    id: 'bag',
    name: 'Dive Bag',
    icon: '🎒',
    description: 'More slots. Heavy relics take two.',
    values: [5, 8, 12, 16, 20, 24],
    costs: [150, 450, 1100, 3900, 8500],
    format: (v) => `${v} slots`,
  },
  light: {
    id: 'light',
    name: 'Flashlight',
    icon: '🔦',
    description: 'Cut through the wreck’s gloom and the abyss dark.',
    values: [170, 260, 350, 460, 560, 680],
    costs: [120, 400, 1000, 3600, 8000],
    format: (v) => `${Math.round(v / 16)}m beam`,
  },
  fins: {
    id: 'fins',
    name: 'Power Fins',
    icon: '🦈',
    description: 'Swim faster and fight strong currents.',
    values: [1, 1.08, 1.16, 1.25],
    costs: [350, 1400, 3800],
    format: (v) => (v === 1 ? 'Standard fins' : `+${Math.round((v - 1) * 100)}% speed`),
  },
};

export const UPGRADE_ORDER: UpgradeId[] = ['tank', 'bag', 'light', 'fins'];

/** Fraction of a current's push that each fins level cancels out. */
export const FIN_CURRENT_RESIST = [0, 0.2, 0.35, 0.5];

export const maxLevel = (id: UpgradeId) => UPGRADES[id].costs.length;
export const upgradeValue = (id: UpgradeId, level: number) => UPGRADES[id].values[Math.min(level, maxLevel(id))];
export const nextCost = (id: UpgradeId, level: number): number | null =>
  level >= maxLevel(id) ? null : UPGRADES[id].costs[level];
export const totalUpgradeCost = () =>
  UPGRADE_ORDER.reduce((sum, id) => sum + UPGRADES[id].costs.reduce((s, c) => s + c, 0), 0);
