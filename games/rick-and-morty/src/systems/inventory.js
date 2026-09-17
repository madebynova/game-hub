/**
 * Inventory.
 *
 * Intentionally boring: a map of itemId -> count, with events. No weight, no
 * slots, no equipment in Phase 1 — but every mutation goes through here, so
 * adding capacity limits or containers later is a single-file change.
 */

import { getItem } from '../data/items.js';

export class Inventory {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
  }

  get bag() { return this.state.data.inventory; }

  count(id) { return this.bag[id] ?? 0; }
  has(id, n = 1) { return this.count(id) >= n; }
  isEmpty() { return Object.keys(this.bag).length === 0; }

  add(id, n = 1, meta = {}) {
    const item = getItem(id);
    if (!item) return false;
    const first = !this.has(id);
    this.bag[id] = this.count(id) + n;
    if (first) this.state.data.stats.discoveries++;
    this.bus.emit('item:collected', { id, item, n, first, ...meta });
    return true;
  }

  remove(id, n = 1) {
    if (!this.has(id, n)) return false;
    this.bag[id] -= n;
    if (this.bag[id] <= 0) delete this.bag[id];
    this.bus.emit('item:removed', { id, n });
    return true;
  }

  /** [{ item, count }] sorted by rarity then name — what the UI renders. */
  list() {
    const order = { rare: 0, anomalous: 0, odd: 1, common: 2 };
    return Object.entries(this.bag)
      .map(([id, count]) => ({ item: getItem(id), count }))
      .filter((e) => e.item)
      .sort((a, b) =>
        (order[a.item.rarity] ?? 3) - (order[b.item.rarity] ?? 3) ||
        a.item.name.localeCompare(b.item.name));
  }
}
