import { formatMoney } from '../core/math';
import type { SaveData } from '../core/save';
import { RARITIES, RARITY_ORDER, TREASURES, type Rarity, type TreasureId } from '../data/treasures';
import { describeObjective, objectiveProgress, type ObjectiveTracker } from './objectives';

/** Record zones/areas reached. Returns the ones reached for the first time ever. */
export function recordVisits(save: SaveData, places: string[]): string[] {
  const fresh = [...new Set(places)].filter((p) => !save.stats.zonesVisited.includes(p));
  save.stats.zonesVisited.push(...fresh);
  return fresh;
}

/** Add a treasure type to the treasure log. Returns true the first time it's found. */
export function recordDiscovery(save: SaveData, id: TreasureId): boolean {
  if (save.discovered.includes(id)) return false;
  save.discovered.push(id);
  return true;
}

export interface ObjectiveRowData {
  text: string;
  progress: string;
  done: boolean;
  reward: number;
}

/** Display rows for the HUD tracker and the trading deck. */
export function objectiveRows(tracker: ObjectiveTracker, haulValue: number): ObjectiveRowData[] {
  return tracker.list.map((o) => {
    const { current, goal } = objectiveProgress(o, tracker.progress);
    let progress = '—';
    if (o.kind === 'collect') progress = `${current}/${goal}`;
    else if (o.kind === 'depth') progress = `${current}/${goal}m`;
    else if (o.kind === 'haulValue') progress = formatMoney(Math.min(haulValue, o.target as number));
    return { text: describeObjective(o), progress, done: tracker.isComplete(o), reward: o.reward };
  });
}

export interface TreasureLogEntry {
  id: TreasureId;
  name: string;
  /** Base value — actual finds vary by ±15%. */
  value: number;
  slots: number;
  found: boolean;
}

export interface TreasureLogGroup {
  rarity: Rarity;
  label: string;
  color: string;
  found: number;
  entries: TreasureLogEntry[];
}

/** The treasure log: every treasure grouped by rarity (cheapest first), marking what has been found. */
export function treasureLog(discovered: readonly TreasureId[]): TreasureLogGroup[] {
  const have = new Set(discovered);
  return RARITY_ORDER.map((rarity) => {
    const entries = Object.values(TREASURES)
      .filter((t) => t.rarity === rarity)
      .sort((a, b) => a.baseValue - b.baseValue)
      .map((t) => ({ id: t.id, name: t.name, value: t.baseValue, slots: t.slots, found: have.has(t.id) }));
    return { rarity, label: RARITIES[rarity].label, color: RARITIES[rarity].color, found: entries.filter((e) => e.found).length, entries };
  });
}
