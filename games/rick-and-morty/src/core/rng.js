/**
 * Seeded deterministic RNG (mulberry32).
 *
 * Phase 1 barely uses this, but it exists now so that future phases can build
 * randomised / repeatable dimension content the right way: a dimension instance
 * gets a seed, and everything in it (loot rolls, anomaly placement, rare NPC
 * spawns, "different versions of the same dimension") derives from that seed.
 * That makes runs reproducible and, crucially, save-able as a single number.
 */

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  /** @param {number|string} seed */
  constructor(seed = Date.now()) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._s = this.seed;
  }

  /** Float in [0, 1). */
  next() {
    this._s = (this._s + 0x6d2b79f5) >>> 0;
    let t = this._s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min, max) { return min + this.next() * (max - min); }

  /** Integer in [min, max] inclusive. */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }

  /** True with probability p. */
  chance(p) { return this.next() < p; }

  pick(arr) { return arr[this.int(0, arr.length - 1)]; }

  /**
   * Weighted pick over [{ weight, ...}] — the shape future loot tables use.
   * Entries without a weight count as 1.
   */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.weight ?? 1;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= e.weight ?? 1;
      if (roll <= 0) return e;
    }
    return entries[entries.length - 1];
  }

  /** Derive a stable child RNG — e.g. per-area streams from one run seed. */
  derive(label) { return new RNG(this.seed ^ hashString(String(label))); }
}

/** Unseeded convenience instance for cosmetic-only randomness (particles etc.). */
export const cosmetic = new RNG(Date.now() ^ 0x9e3779b9);
