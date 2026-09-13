import type { HaulItem } from '../data/treasures';

/** The treasure carried on the current dive. It is at risk until sold on the boat. */
export class Haul {
  items: HaulItem[] = [];

  constructor(public capacity: number) {}

  get count() {
    return this.items.length;
  }

  get total() {
    return this.items.reduce((s, i) => s + i.value, 0);
  }

  get isFull() {
    return this.items.length >= this.capacity;
  }

  get freeSlots() {
    return Math.max(0, this.capacity - this.items.length);
  }

  add(item: HaulItem): boolean {
    if (this.isFull) return false;
    this.items.push(item);
    return true;
  }

  /** Add as many items as fit; returns the ones that did not fit. */
  addMany(items: HaulItem[]): HaulItem[] {
    const fit = items.slice(0, this.freeSlots);
    this.items.push(...fit);
    return items.slice(fit.length);
  }

  clear(): HaulItem[] {
    const out = this.items;
    this.items = [];
    return out;
  }
}
