/**
 * Memory system.
 *
 * Owns MEMORY RECOVERY % and the fragment collection. Fragments are gated by
 * the requirements declared on each fragment (research done, flags set, other
 * fragments recovered), so the whole progression curve is data, not code.
 */

import { FRAGMENTS, getFragment, availableFragments, TOTAL_FRAGMENTS } from '../data/memories.js';

export class MemorySystem {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
  }

  get recovery() { return this.state.data.memory.recovery; }
  get fragments() { return this.state.data.memory.fragments; }

  isOnline() { return this.state.flag('memoryDeviceOnline'); }
  has(id) { return this.fragments.includes(id); }

  /** Fragments the device could reconstruct right now. */
  pending() { return availableFragments(this.state.data); }

  /** Fragments the player already owns, in discovery order. */
  owned() { return this.fragments.map(getFragment).filter(Boolean); }

  /**
   * Recover a fragment. Returns the fragment (so the caller can play it) or
   * null if it isn't available.
   */
  recover(id) {
    const frag = getFragment(id);
    if (!frag || this.has(id)) return null;
    if (!this.pending().some((f) => f.id === id)) return null;

    this.fragments.push(id);
    this.state.data.memory.recovery = Math.min(100, this.recovery + (frag.recovery ?? 0));
    this.state.data.memory.lastViewed = id;

    for (const clueId of frag.clues ?? []) this.state.addClue(clueId);
    this.state.log(`Memory reconstructed: ${frag.title}`, 'memory');
    this.bus.emit('memory:recovered', { fragment: frag, recovery: this.recovery });
    return frag;
  }

  /** For the device readout: "1 / 12 fragments". */
  progressText() {
    return `${this.fragments.length} / ${TOTAL_FRAGMENTS} fragments indexed`;
  }

  /** All fragments that exist, for a future "archive" view. */
  all() { return Object.values(FRAGMENTS).sort((a, b) => a.index - b.index); }
}
