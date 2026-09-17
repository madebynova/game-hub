/**
 * Central game state.
 *
 * ONE object is the single source of truth and is exactly what gets serialised
 * to localStorage. Rule for future phases: if it needs to survive a refresh it
 * lives here; if it's per-frame or derived (positions of particles, cached
 * canvases, resolved area objects) it does NOT.
 *
 * Adding a new field is safe — `migrate()` in systems/save.js merges a loaded
 * save over a fresh default, so old saves silently gain new fields.
 */

export const SAVE_VERSION = 1;

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    savedAt: 0,

    /** Where the player is. `area` is a key in data/dimensions.js. */
    player: {
      area: 'garage',
      x: 470,
      y: 330,
      facing: 'down',
    },

    /** Free-form story/progression booleans. Cheap to add, cheap to check. */
    flags: {
      introSeen: false,
      portalUnlocked: false,     // set once the player learns the portal works
      memoryDeviceOnline: false, // the first research unlock flips this
      watcherEvent1: false,      // "something moved in the garage"
      watcherEvent2: false,      // the silhouette
      metBipp: false,
    },

    /** itemId -> count. */
    inventory: {},

    research: {
      /** completed research entry ids */
      completed: [],
      /** { itemId, entryId, remaining, duration } or null */
      active: null,
      /** entry ids the player has read the full report for */
      read: [],
    },

    memory: {
      recovery: 0,          // percent, 0-100
      fragments: [],        // fragment ids, in discovery order
      lastViewed: null,
    },

    /** Story clue ids the player has uncovered, from any source. */
    clues: [],

    /** Journal lines: { t: epoch ms, text, kind } */
    journal: [],

    dimensions: {
      /** ids the player knows about (portal destination list) */
      known: ['garage'],
      /** id -> { visits, firstVisit, seed } */
      visited: {},
    },

    /** Per-area persistent world changes: `${areaId}:${propId}` -> true */
    world: {
      taken: {},
      opened: {},
    },

    /** Home-base progression. Phase 2 hangs upgrades off this. */
    garage: {
      upgrades: [],
      power: 1,
    },

    settings: {
      volume: 0.7,
      muted: false,
    },

    stats: {
      playtimeMs: 0,
      discoveries: 0,
      portalTrips: 0,
    },
  };
}

/**
 * Thin wrapper that owns the state object and shouts on the bus when things
 * change, so UI never has to poll.
 */
export class GameState {
  /** @param {import('./events.js').EventBus} bus */
  constructor(bus) {
    this.bus = bus;
    this.data = createInitialState();
  }

  replace(data) {
    this.data = data;
    this.bus.emit('state:replaced', this.data);
  }

  // ── flags ────────────────────────────────────────────────────────────────
  flag(name) { return !!this.data.flags[name]; }

  setFlag(name, value = true) {
    if (this.data.flags[name] === value) return false;
    this.data.flags[name] = value;
    this.bus.emit('flag:set', { name, value });
    return true;
  }

  // ── journal ──────────────────────────────────────────────────────────────
  log(text, kind = 'note') {
    this.data.journal.push({ t: Date.now(), text, kind });
    // Keep it bounded; the journal is flavour, not an audit log.
    if (this.data.journal.length > 200) this.data.journal.shift();
    this.bus.emit('journal:add', { text, kind });
  }

  // ── clues ────────────────────────────────────────────────────────────────
  hasClue(id) { return this.data.clues.includes(id); }

  addClue(id) {
    if (this.hasClue(id)) return false;
    this.data.clues.push(id);
    this.bus.emit('clue:found', id);
    return true;
  }

  // ── world persistence ────────────────────────────────────────────────────
  isTaken(areaId, propId) { return !!this.data.world.taken[`${areaId}:${propId}`]; }
  markTaken(areaId, propId) { this.data.world.taken[`${areaId}:${propId}`] = true; }

  isOpened(areaId, propId) { return !!this.data.world.opened[`${areaId}:${propId}`]; }
  markOpened(areaId, propId) { this.data.world.opened[`${areaId}:${propId}`] = true; }
}
