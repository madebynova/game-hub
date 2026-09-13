import { SAVE_KEY } from '../config';
import { OBJECTIVE_POOL } from '../data/objectives';
import type { HaulItem, TreasureId } from '../data/treasures';
import { TREASURES } from '../data/treasures';
import { UPGRADE_ORDER, maxLevel, type UpgradeId } from '../data/upgrades';
import type { Objective } from '../systems/objectives';

export interface LostSatchel {
  x: number;
  y: number;
  items: HaulItem[];
}

export interface SaveData {
  /** 1 = Phase 1 saves (still loadable), 2 = Phase 2. */
  version: 2;
  cash: number;
  upgrades: Record<UpgradeId, number>;
  stats: {
    dives: number;
    bestDepthM: number;
    totalEarned: number;
    bestSale: number;
    /** Zones and areas ever reached ('wreck', 'abyss', ...). */
    zonesVisited: string[];
    objectivesDone: number;
  };
  seenHints: string[];
  lostSatchel: LostSatchel | null;
  muted: boolean;
  objectives: Objective[];
  /** Treasure types found at least once (the treasure log). */
  discovered: TreasureId[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function defaultSave(): SaveData {
  return {
    version: 2,
    cash: 0,
    upgrades: { tank: 0, bag: 0, light: 0, fins: 0 },
    stats: { dives: 0, bestDepthM: 0, totalEarned: 0, bestSale: 0, zonesVisited: [], objectivesDone: 0 },
    seenHints: [],
    lostSatchel: null,
    muted: false,
    objectives: [],
    discovered: [],
  };
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

const isHaulItem = (v: unknown): v is HaulItem => {
  const i = v as HaulItem;
  return !!i && typeof i === 'object' && typeof i.defId === 'string' && i.defId in TREASURES && typeof i.value === 'number';
};

/** Only objectives that still exist in the pool survive a load. */
const isObjective = (v: unknown): v is Objective => {
  const o = v as Objective;
  return !!o && typeof o === 'object' && typeof o.id === 'string' &&
    OBJECTIVE_POOL.some((t) => t.kind === o.kind && t.target === o.target && t.tier === o.tier);
};

/**
 * Parse untrusted saved JSON, falling back to defaults for anything missing or malformed.
 * Phase 1 saves have no fins, objectives, zones or treasure log — those simply start fresh.
 */
export function sanitizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;

  base.cash = Math.max(0, Math.floor(num(r.cash, 0)));
  for (const id of UPGRADE_ORDER) {
    const lvl = Math.floor(num(r.upgrades?.[id], 0));
    base.upgrades[id] = Math.max(0, Math.min(maxLevel(id), lvl));
  }
  if (r.stats && typeof r.stats === 'object') {
    base.stats.dives = num(r.stats.dives, 0);
    base.stats.bestDepthM = num(r.stats.bestDepthM, 0);
    base.stats.totalEarned = num(r.stats.totalEarned, 0);
    base.stats.bestSale = num(r.stats.bestSale, 0);
    base.stats.zonesVisited = strings(r.stats.zonesVisited);
    base.stats.objectivesDone = num(r.stats.objectivesDone, 0);
  }
  base.seenHints = strings(r.seenHints);
  const s = r.lostSatchel;
  if (s && typeof s === 'object' && Array.isArray(s.items)) {
    const items = s.items.filter(isHaulItem);
    if (items.length) base.lostSatchel = { x: num(s.x, 0), y: num(s.y, 0), items };
  }
  base.muted = r.muted === true;
  if (Array.isArray(r.objectives)) base.objectives = r.objectives.filter(isObjective).map((o) => ({ ...o, reward: Math.max(0, num(o.reward, 0)) }));
  base.discovered = strings(r.discovered).filter((id): id is TreasureId => id in TREASURES);
  return base;
}

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(storage: StorageLike | null = getStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const text = storage.getItem(SAVE_KEY);
    return text ? sanitizeSave(JSON.parse(text)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, storage: StorageLike | null = getStorage()) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked — the game keeps running with in-memory progress.
  }
}

export function clearSave(storage: StorageLike | null = getStorage()) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
