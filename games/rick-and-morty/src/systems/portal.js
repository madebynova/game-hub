/**
 * Portal system — the travel sequence.
 *
 * Deliberately separated from the portal *prop* (which is just art + an
 * interaction) and from the dimension *registry* (which is just data). This
 * file owns the transition: lock input, open, flash, swap area, land.
 *
 * Future phases hook in here for travel costs (fuel), travel risks (misfires,
 * "you arrive somewhere you did not dial"), and arrival events.
 */

import { getDimension, isDialable } from '../data/dimensions.js';

export class PortalSystem {
  constructor(api) {
    this.api = api;
    this.travelling = false;
  }

  /** Can the player go to `id` right now? -> { ok, reason } */
  check(id) {
    const dim = getDimension(id);
    if (!dim) return { ok: false, reason: 'No such coordinate.' };
    if (dim.locked) return { ok: false, reason: dim.lockedReason ?? 'The dial refuses this coordinate.' };
    if (!isDialable(dim, this.api.state.data)) return { ok: false, reason: 'You lack what this destination needs.' };
    return { ok: true, dim };
  }

  /**
   * Travel. Returns a promise that resolves when the player is standing in the
   * new area.
   */
  async travel(id) {
    if (this.travelling) return false;
    const { ok, reason, dim } = this.check(id);
    if (!ok) {
      this.api.audio.play('denied');
      this.api.ui.toast(reason, { kind: 'warn', label: 'PORTAL' });
      return false;
    }

    this.travelling = true;
    const { ui, audio, world, state, fx } = this.api;

    ui.closePanel();
    ui.lockInput(true);
    audio.play('portal_open');
    await ui.wait(420);
    audio.play('portal_step');
    await fx.fadeOut(520);

    // Leaving home vs. arriving home both count as a trip; the story beats read
    // portalTrips to decide when the garage should start being wrong.
    state.data.stats.portalTrips++;

    // The area's own onEnter sets the location tag and ambience; the portal
    // deliberately does not, so an area can present itself however it likes.
    world.enter(id, 'portal');

    await ui.wait(160);
    await fx.fadeIn(560);
    ui.lockInput(false);
    this.travelling = false;

    this.api.bus.emit('portal:arrived', { id, dim });
    return true;
  }
}
