import { UPGRADES } from './upgrades';

export interface SaveData {
  version: number;
  cash: number;
  upgrades: Record<string, number>;
  stats: {
    runs: number;
    extractions: number;
    busts: number;
    doorbells: number;
    bestRun: number;
    totalEarned: number;
  };
}

const KEY = 'runout.save.v1';
const VERSION = 1;

export function emptySave(): SaveData {
  return {
    version: VERSION,
    cash: 0,
    upgrades: {},
    stats: { runs: 0, extractions: 0, busts: 0, doorbells: 0, bestRun: 0, totalEarned: 0 },
  };
}

export function loadSave(): SaveData {
  const fresh = emptySave();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return fresh; // Storage blocked (private mode, locked-down machine): play unsaved.
  }
  if (!raw) return fresh;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fresh;
    const data = parsed as Partial<SaveData>;

    fresh.cash = Math.max(0, Number(data.cash) || 0);

    // Only accept upgrade ids we still ship, clamped to their current max level.
    if (data.upgrades && typeof data.upgrades === 'object') {
      for (const upgrade of UPGRADES) {
        const level = Number((data.upgrades as Record<string, unknown>)[upgrade.id]) || 0;
        if (level > 0) fresh.upgrades[upgrade.id] = Math.min(upgrade.maxLevel, Math.floor(level));
      }
    }

    if (data.stats && typeof data.stats === 'object') {
      const stats = data.stats as Record<string, unknown>;
      for (const key of Object.keys(fresh.stats) as Array<keyof SaveData['stats']>) {
        fresh.stats[key] = Math.max(0, Number(stats[key]) || 0);
      }
    }
  } catch {
    return emptySave();
  }

  return fresh;
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* Not being able to save shouldn't interrupt a run. */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
