export type UpgradeId = 'tank' | 'bag' | 'light';

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

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  tank: {
    id: 'tank',
    name: 'Oxygen Tank',
    icon: '🫧',
    description: 'More air per dive. Reach deeper, stay longer.',
    values: [60, 85, 115, 150],
    costs: [150, 450, 1100],
    format: (v) => `${v}s air`,
  },
  bag: {
    id: 'bag',
    name: 'Dive Bag',
    icon: '🎒',
    description: 'Carry more treasure before heading back.',
    values: [5, 8, 12, 16],
    costs: [120, 380, 950],
    format: (v) => `${v} slots`,
  },
  light: {
    id: 'light',
    name: 'Flashlight',
    icon: '🔦',
    description: 'Cut through the dark of the deep water.',
    values: [170, 260, 350, 460],
    costs: [100, 320, 850],
    format: (v) => `${Math.round(v / 16)}m beam`,
  },
};

export const UPGRADE_ORDER: UpgradeId[] = ['tank', 'bag', 'light'];

export const maxLevel = (id: UpgradeId) => UPGRADES[id].costs.length;
export const upgradeValue = (id: UpgradeId, level: number) => UPGRADES[id].values[Math.min(level, maxLevel(id))];
export const nextCost = (id: UpgradeId, level: number): number | null =>
  level >= maxLevel(id) ? null : UPGRADES[id].costs[level];
