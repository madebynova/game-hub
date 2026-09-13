import { formatMoney } from '../core/math';
import type { SaveData } from '../core/save';
import type { TreasureId } from '../data/treasures';
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
