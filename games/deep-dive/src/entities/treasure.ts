import { rollTreasure, type HaulItem } from '../data/treasures';
import type { SpawnPoint } from '../world/world';

export class Treasure {
  item: HaulItem;
  collected = false;
  /** 0..1 progress of prying the item loose. */
  progress = 0;
  phase = Math.random() * Math.PI * 2;

  constructor(public spawn: SpawnPoint) {
    this.item = rollTreasure(spawn.table);
  }

  get x() {
    return this.spawn.x;
  }

  get y() {
    return this.spawn.y;
  }

  reroll() {
    this.item = rollTreasure(this.spawn.table);
    this.collected = false;
    this.progress = 0;
  }
}

/** Uncollected treasure stays put between dives; collected spots restock with a fresh roll. */
export class TreasureField {
  items: Treasure[];

  constructor(spawns: SpawnPoint[]) {
    this.items = spawns.map((s) => new Treasure(s));
  }

  restock() {
    for (const t of this.items) if (t.collected) t.reroll();
  }

  nearest(x: number, y: number, radius: number): Treasure | null {
    let best: Treasure | null = null;
    let bestD = radius;
    for (const t of this.items) {
      if (t.collected) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
