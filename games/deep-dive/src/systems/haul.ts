import { slotsOf, type HaulItem } from '../data/treasures';

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

  /** Bag slots in use — heavy finds take more than one. */
  get usedSlots() {
    return this.items.reduce((s, i) => s + slotsOf(i), 0);
  }

  get isFull() {
    return this.usedSlots >= this.capacity;
  }

  get freeSlots() {
    return Math.max(0, this.capacity - this.usedSlots);
  }

  canFit(item: HaulItem) {
    return slotsOf(item) <= this.freeSlots;
  }

  add(item: HaulItem): boolean {
    if (!this.canFit(item)) return false;
    this.items.push(item);
    return true;
  }

  /** Add everything that fits (in order); returns the items that did not fit. */
  addMany(items: HaulItem[]): HaulItem[] {
    const leftover: HaulItem[] = [];
    for (const item of items) if (!this.add(item)) leftover.push(item);
    return leftover;
  }

  clear(): HaulItem[] {
    const out = this.items;
    this.items = [];
    return out;
  }
}
