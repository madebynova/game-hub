import { SAVE_KEY } from '../config';
import type { HaulItem } from '../data/treasures';
import { TREASURES } from '../data/treasures';
import { UPGRADE_ORDER, maxLevel, type UpgradeId } from '../data/upgrades';

export interface LostSatchel {
  x: number;
  y: number;
  items: HaulItem[];
}

export interface SaveData {
  version: 1;
  cash: number;
  upgrades: Record<UpgradeId, number>;
  stats: {
    dives: number;
    bestDepthM: number;
    totalEarned: number;
    bestSale: number;
  };
  seenHints: string[];
  lostSatchel: LostSatchel | null;
  muted: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function defaultSave(): SaveData {
  return {
    version: 1,
    cash: 0,
    upgrades: { tank: 0, bag: 0, light: 0 },
    stats: { dives: 0, bestDepthM: 0, totalEarned: 0, bestSale: 0 },
    seenHints: [],
    lostSatchel: null,
    muted: false,
  };
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

const isHaulItem = (v: unknown): v is HaulItem => {
  const i = v as HaulItem;
  return !!i && typeof i === 'object' && i.defId in TREASURES && typeof i.value === 'number';
};

/** Parse untrusted saved JSON, falling back to defaults for anything missing or malformed. */
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
  }
  if (Array.isArray(r.seenHints)) base.seenHints = r.seenHints.filter((h) => typeof h === 'string');
  const s = r.lostSatchel;
  if (s && typeof s === 'object' && Array.isArray(s.items)) {
    const items = s.items.filter(isHaulItem);
    if (items.length) base.lostSatchel = { x: num(s.x, 0), y: num(s.y, 0), items };
  }
  base.muted = r.muted === true;
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
