import { AREA_NAMES, ACTIVE_OBJECTIVES, OBJECTIVE_POOL, type AreaId, type ObjectiveKind, type ObjectiveTemplate } from '../data/objectives';
import { RARITIES, TREASURES, type HaulItem, type Rarity, type TreasureId } from '../data/treasures';

export interface Objective extends ObjectiveTemplate {
  id: string;
}

export interface DiveProgress {
  collected: number;
  maxDepthM: number;
  bestTier: number;
  items: Set<TreasureId>;
  visited: Set<AreaId>;
}

const freshProgress = (): DiveProgress => ({ collected: 0, maxDepthM: 0, bestTier: -1, items: new Set(), visited: new Set() });

export function describeObjective(o: ObjectiveTemplate): string {
  switch (o.kind) {
    case 'collect': return `Collect ${o.target} treasures in one dive`;
    case 'depth': return `Reach ${o.target}m`;
    case 'rarity': return `Find a ${RARITIES[o.target as Rarity].label.toLowerCase()} or better treasure`;
    case 'visit': return `Explore ${AREA_NAMES[o.target as AreaId]}`;
    case 'haulValue': return `Bring back a $${Number(o.target).toLocaleString('en-US')} haul`;
    case 'item': return `Recover a ${TREASURES[o.target as TreasureId].name}`;
  }
}

/** Progress towards an objective within the current dive. */
export function objectiveProgress(o: ObjectiveTemplate, p: DiveProgress): { current: number; goal: number } {
  switch (o.kind) {
    case 'collect': return { current: Math.min(p.collected, o.target as number), goal: o.target as number };
    case 'depth': return { current: Math.min(p.maxDepthM, o.target as number), goal: o.target as number };
    case 'rarity': return { current: p.bestTier >= RARITIES[o.target as Rarity].tier ? 1 : 0, goal: 1 };
    case 'visit': return { current: p.visited.has(o.target as AreaId) ? 1 : 0, goal: 1 };
    case 'item': return { current: p.items.has(o.target as TreasureId) ? 1 : 0, goal: 1 };
    case 'haulValue': return { current: 0, goal: 1 }; // judged when you climb aboard
  }
}

/** Progression tier from the zones a player has reached. */
export function objectiveTier(zonesVisited: string[]): 0 | 1 | 2 {
  if (zonesVisited.includes('abyss')) return 2;
  if (zonesVisited.includes('wreck')) return 1;
  return 0;
}

const sameGoal = (a: ObjectiveTemplate, b: ObjectiveTemplate) => a.kind === b.kind && a.target === b.target;

/**
 * Pick a new objective for a tier, avoiding duplicates of what is already active.
 * Lower-tier "explore X" goals for places the player has already reached are skipped —
 * they would be free money for a deeper diver.
 */
export function generateObjective(tier: 0 | 1 | 2, existing: ObjectiveTemplate[], rng: () => number = Math.random, visited: string[] = []): Objective {
  const usedKinds = new Set<ObjectiveKind>(existing.map((o) => o.kind));
  const stale = (o: ObjectiveTemplate) => o.kind === 'visit' && o.tier < tier && visited.includes(o.target as string);
  const fresh = (o: ObjectiveTemplate) => !stale(o) && !existing.some((e) => sameGoal(e, o));
  const candidates = (t: number) => OBJECTIVE_POOL.filter((o) => o.tier === t && fresh(o));
  let pool = candidates(tier);
  if (tier > 0 && rng() < 0.2 && candidates(tier - 1).length) pool = candidates(tier - 1);
  if (!pool.length) pool = OBJECTIVE_POOL.filter((o) => o.tier <= tier && fresh(o));
  if (!pool.length) pool = OBJECTIVE_POOL.filter((o) => o.tier <= tier && !stale(o));
  const varied = pool.filter((o) => !usedKinds.has(o.kind));
  const pickFrom = varied.length ? varied : pool;
  const t = pickFrom[Math.floor(rng() * pickFrom.length)];
  return { ...t, id: `${t.kind}:${t.target}:${Math.floor(rng() * 1e9).toString(36)}` };
}

export function fillObjectives(list: Objective[], tier: 0 | 1 | 2, rng: () => number = Math.random, visited: string[] = []) {
  while (list.length < ACTIVE_OBJECTIVES) list.push(generateObjective(tier, list, rng, visited));
  return list;
}

/**
 * Tracks the active objectives across a dive. Objectives complete underwater but only
 * pay out when you climb back aboard — black out and the progress is lost.
 */
export class ObjectiveTracker {
  progress = freshProgress();
  completed = new Set<string>();

  constructor(public list: Objective[]) {}

  startDive() {
    this.progress = freshProgress();
    this.completed.clear();
  }

  failDive() {
    this.startDive();
  }

  isComplete(o: Objective) {
    return this.completed.has(o.id);
  }

  private check(): Objective[] {
    const fresh: Objective[] = [];
    for (const o of this.list) {
      if (this.completed.has(o.id) || o.kind === 'haulValue') continue;
      const { current, goal } = objectiveProgress(o, this.progress);
      if (current >= goal) {
        this.completed.add(o.id);
        fresh.push(o);
      }
    }
    return fresh;
  }

  recordCollect(item: HaulItem) {
    this.progress.collected++;
    this.progress.items.add(item.defId);
    this.progress.bestTier = Math.max(this.progress.bestTier, RARITIES[item.rarity].tier);
    return this.check();
  }

  recordDepth(meters: number) {
    if (meters <= this.progress.maxDepthM) return [];
    this.progress.maxDepthM = meters;
    return this.check();
  }

  recordVisit(areas: AreaId[]) {
    let changed = false;
    for (const a of areas) {
      if (!this.progress.visited.has(a)) {
        this.progress.visited.add(a);
        changed = true;
      }
    }
    return changed ? this.check() : [];
  }

  /** Called when climbing aboard with the haul still unsold. */
  evaluateBoarding(haulValue: number): Objective[] {
    const fresh: Objective[] = [];
    for (const o of this.list) {
      if (o.kind === 'haulValue' && !this.completed.has(o.id) && haulValue >= (o.target as number)) {
        this.completed.add(o.id);
        fresh.push(o);
      }
    }
    return fresh;
  }

  /** Remove and return every completed objective so its reward can be paid. */
  claim(): Objective[] {
    const done = this.list.filter((o) => this.completed.has(o.id));
    for (const o of done) {
      this.list.splice(this.list.indexOf(o), 1);
      this.completed.delete(o.id);
    }
    return done;
  }
}
