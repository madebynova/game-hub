/**
 * Research system.
 *
 * Loop: an item in the bag + a matching entry in data/research.js -> a timed
 * analysis -> a report, plus whatever rewards the entry declares (clues, flags,
 * memory fragments, dimension unlocks).
 *
 * The station runs ONE analysis at a time and it ticks only while the game is
 * running — no wall-clock cheese, and no offline progress to reconcile on load.
 * (A Phase 2 garage upgrade adding parallel slots would change `active` to an
 * array; everything else here already works per-job.)
 */

import { RESEARCH, getResearch, entriesForItem } from '../data/research.js';

export class ResearchSystem {
  constructor(state, bus, deps) {
    this.state = state;
    this.bus = bus;
    this.inventory = deps.inventory;
  }

  get active() { return this.state.data.research.active; }
  isComplete(entryId) { return this.state.data.research.completed.includes(entryId); }

  /** Why an entry can't be started right now — or null if it can. */
  blockedReason(entry) {
    if (this.isComplete(entry.id)) return 'Already analysed.';
    if (this.active) return 'The station is busy.';
    if (!this.inventory.has(entry.item)) return 'You do not have the sample.';
    const req = entry.requires ?? {};
    for (const f of req.flags ?? []) {
      if (!this.state.data.flags[f]) return 'The station lacks the equipment for this.';
    }
    for (const r of req.research ?? []) {
      if (!this.isComplete(r)) return `Requires prior analysis: ${getResearch(r)?.title ?? r}.`;
    }
    for (const u of req.upgrades ?? []) {
      if (!this.state.data.garage.upgrades.includes(u)) return 'Requires a garage upgrade you do not have.';
    }
    return null;
  }

  /** Entries the player could see listed at the station (has the item for). */
  availableEntries() {
    const out = [];
    for (const itemId of Object.keys(this.state.data.inventory)) {
      for (const entry of entriesForItem(itemId)) out.push(entry);
    }
    // Completed ones stay listed (greyed) so the station reads as a log too.
    for (const id of this.state.data.research.completed) {
      const e = getResearch(id);
      if (e && !out.includes(e)) out.push(e);
    }
    return out.sort((a, b) => Number(this.isComplete(a.id)) - Number(this.isComplete(b.id))
      || a.title.localeCompare(b.title));
  }

  start(entryId) {
    const entry = getResearch(entryId);
    if (!entry) return false;
    const blocked = this.blockedReason(entry);
    if (blocked) { this.bus.emit('research:blocked', { entry, reason: blocked }); return false; }

    this.state.data.research.active = {
      entryId: entry.id,
      itemId: entry.item,
      duration: entry.seconds,
      remaining: entry.seconds,
    };
    this.bus.emit('research:start', { entry });
    return true;
  }

  cancel() {
    if (!this.active) return;
    const entry = getResearch(this.active.entryId);
    this.state.data.research.active = null;
    this.bus.emit('research:cancelled', { entry });
  }

  tick(dt) {
    const job = this.active;
    if (!job) return;
    job.remaining -= dt;
    if (job.remaining > 0) {
      this.bus.emit('research:progress', { job, pct: 1 - job.remaining / job.duration });
      return;
    }
    this._complete(job);
  }

  _complete(job) {
    const entry = getResearch(job.entryId);
    this.state.data.research.active = null;
    if (!entry) return;

    this.state.data.research.completed.push(entry.id);
    if (entry.consumes) this.inventory.remove(entry.item, 1);

    // Apply declared rewards. Everything is optional; unknown keys are ignored,
    // which keeps old entries valid as the reward vocabulary grows.
    const r = entry.rewards ?? {};
    for (const clueId of r.clues ?? []) this.state.addClue(clueId);
    for (const [flag, value] of Object.entries(r.flags ?? {})) this.state.setFlag(flag, value);
    for (const dimId of r.dimensions ?? []) {
      if (!this.state.data.dimensions.known.includes(dimId)) {
        this.state.data.dimensions.known.push(dimId);
        this.bus.emit('dimension:unlocked', dimId);
      }
    }

    this.state.log(`Analysis complete: ${entry.title}.`, 'research');
    this.bus.emit('research:complete', { entry });
  }

  /** Progress 0..1 of the active job, or 0. */
  progress() {
    const job = this.active;
    return job ? 1 - job.remaining / job.duration : 0;
  }

  /** How many entries exist in total — used for the "archive" readout. */
  totalEntries() { return Object.keys(RESEARCH).length; }
}
