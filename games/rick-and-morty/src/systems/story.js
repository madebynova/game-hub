/**
 * Story / beat engine.
 *
 * A "beat" is a scripted moment: a condition plus a thing that happens. Beats
 * are evaluated whenever the bus emits anything interesting, and each one fires
 * at most once (tracked by a flag, so it survives saving).
 *
 * This is deliberately a tiny declarative table rather than if-statements
 * scattered through the world code: Phase 2 story content is appended here and
 * nothing else has to know about it.
 *
 * Beat shape:
 *   id       unique; also the flag name used to mark it fired
 *   on       array of event names that should re-evaluate it
 *   when     (state, api) => boolean
 *   run      (api) => void | Promise   — the actual moment
 */

export const BEATS = [
  /* ── The first thing that is wrong ──────────────────────────────────────
     The player comes home from their first trip and the garage is subtly not
     how they left it. No explanation, no objective marker. */
  {
    id: 'watcherEvent1',
    on: ['area:entered'],
    when: (s) => s.player.area === 'garage'
      && s.stats.portalTrips >= 1
      && !s.flags.watcherEvent1,
    run: async (api) => {
      await api.ui.wait(900);
      api.audio.play('unease');
      api.fx.glitch();
      api.ui.narrate([
        'The garage is exactly as you left it.',
        'Except the stool is upright now. You are sure it was on its side, because you tripped over it on the way out and said something unkind to it.',
        'The terminal is awake. You did not leave it awake.',
      ], { sound: false });
      api.state.addClue('clue_watcher_moved');
      api.state.log('Came back from the flats. Something in the garage had moved.', 'event');
      api.world.refreshProps();
    },
  },

  /* ── The second thing that is wrong ─────────────────────────────────────
     Fires shortly after the first memory fragment. A figure, briefly, in the
     garage doorway. Gone before it resolves into anything. */
  {
    id: 'watcherEvent2',
    on: ['memory:recovered', 'ui:panel-closed'],
    when: (s, api) => s.memory.fragments.length >= 1
      && s.player.area === 'garage'
      && !s.flags.watcherEvent2
      && !api.ui.isPanelOpen(),
    run: async (api) => {
      await api.ui.wait(2600);
      if (api.state.data.player.area !== 'garage') return;   // don't fire off-screen
      api.audio.play('glitch');
      // Pan down to the shutter first — an event the player cannot see is not
      // an event.
      api.world.lookAt(470, 620, 6.5);
      await api.ui.wait(700);
      api.world.showApparition(5.0);
      await api.ui.wait(1100);
      api.audio.play('unease');
      api.ui.narrate([
        'Someone is standing in the shutter gap.',
        'Lab coat. Hands in pockets. Not moving, not hiding — just waiting for you to notice, the way you wait for a slow lift.',
        'You blink. The gap is empty, and the shutter is down, and it was down the whole time.',
      ], { sound: false });
      api.state.addClue('clue_watcher_seen');
      api.state.log('Saw someone in the shutter gap. The shutter was closed.', 'event');
    },
  },

  /* ── Terminal gets a new entry after the watcher shows up ──────────────
     Pure set-dressing: it makes the terminal worth re-reading. */
  {
    id: 'terminalIntruderLog',
    on: ['clue:found'],
    when: (s) => s.clues.includes('clue_watcher_moved') && !s.flags.terminalIntruderLog,
    run: (api) => {
      api.state.log('New entry appeared in the terminal session log.', 'system');
      api.ui.toast('The terminal has a new session log entry.', { kind: 'odd', label: 'GARAGE' });
    },
  },
];

export class StorySystem {
  constructor(state, bus, api) {
    this.state = state;
    this.bus = bus;
    this.api = api;
    this._running = new Set();

    const events = new Set();
    for (const b of BEATS) for (const e of b.on) events.add(e);
    for (const e of events) bus.on(e, () => this.evaluate());
  }

  /** Check every beat; fire the first eligible one (they queue naturally). */
  evaluate() {
    for (const beat of BEATS) {
      if (this._running.has(beat.id)) continue;
      if (this.state.data.flags[beat.id]) continue;
      let ok = false;
      try { ok = beat.when(this.state.data, this.api); }
      catch (err) { console.error(`[story] beat ${beat.id} condition threw`, err); }
      if (!ok) continue;

      this._running.add(beat.id);
      this.state.setFlag(beat.id, true);
      Promise.resolve()
        .then(() => beat.run(this.api))
        .catch((err) => console.error(`[story] beat ${beat.id} failed`, err))
        .finally(() => this._running.delete(beat.id));
      return;
    }
  }
}
