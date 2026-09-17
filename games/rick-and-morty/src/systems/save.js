/**
 * Save system — versioned localStorage with forward migration.
 *
 * Rules that keep saves from breaking as the game grows:
 *   1. Every save carries a `version`.
 *   2. Loading merges the stored save OVER a fresh default object, so fields
 *      added in later phases appear automatically with sane values.
 *   3. Version bumps register a migration function in MIGRATIONS; load runs
 *      them in order. Nobody ever loses a save to a schema change.
 *   4. Writes are debounced and wrapped — a full quota or a locked-down school
 *      profile degrades to "no saving", never to a crash.
 */

import { createInitialState, SAVE_VERSION } from '../core/state.js';

const KEY = 'untitled-garage:save:v1';
const AUTOSAVE_MS = 12000;

/**
 * version N -> N+1 transforms. Example for later:
 *   2: (data) => { data.garage.modules ??= []; return data; }
 */
const MIGRATIONS = {
  // 1: (data) => { ...; data.version = 2; return data; },
};

export class SaveSystem {
  constructor(state, bus) {
    this.state = state;
    this.bus = bus;
    this.available = this._probe();
    this._dirty = false;
    this._timer = 0;

    // Never lose a session to a closed tab.
    window.addEventListener('beforeunload', () => { if (this._dirty) this.save(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this._dirty) this.save(true);
    });

    // Anything meaningful marks the save dirty; the ticker flushes it.
    for (const evt of ['item:collected', 'research:complete', 'memory:recovered',
      'clue:found', 'flag:set', 'area:entered', 'journal:add', 'settings:changed']) {
      bus.on(evt, () => { this._dirty = true; });
    }
  }

  _probe() {
    try {
      const k = '__ug_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      console.warn('[save] localStorage unavailable — progress will not persist.');
      return false;
    }
  }

  hasSave() {
    if (!this.available) return false;
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  }

  /** Called every frame; flushes a dirty save on a timer. */
  tick(dt) {
    this.state.data.stats.playtimeMs += dt * 1000;
    if (!this._dirty) return;
    this._timer += dt * 1000;
    if (this._timer >= AUTOSAVE_MS) this.save();
  }

  save(silent = false) {
    this._timer = 0;
    this._dirty = false;
    if (!this.available) return false;
    try {
      this.state.data.savedAt = Date.now();
      this.state.data.version = SAVE_VERSION;
      localStorage.setItem(KEY, JSON.stringify(this.state.data));
      if (!silent) this.bus.emit('save:written', this.state.data.savedAt);
      return true;
    } catch (err) {
      console.error('[save] write failed', err);
      this.bus.emit('save:failed', err);
      return false;
    }
  }

  /** @returns {object|null} loaded state data, or null if nothing valid stored. */
  load() {
    if (!this.available) return null;
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { return null; }
    if (!raw) return null;

    let parsed;
    try { parsed = JSON.parse(raw); } catch (err) {
      console.error('[save] corrupt save, ignoring', err);
      return null;
    }

    let data = this._migrate(parsed);
    data = mergeDefaults(createInitialState(), data);
    return data;
  }

  _migrate(data) {
    let v = data.version ?? 1;
    while (v < SAVE_VERSION) {
      const step = MIGRATIONS[v];
      if (!step) { data.version = SAVE_VERSION; break; }
      data = step(data);
      v = data.version ?? v + 1;
    }
    return data;
  }

  wipe() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    this._dirty = false;
  }
}

/**
 * Merge `loaded` over `defaults` recursively for plain objects. Arrays and
 * primitives from the save win outright; objects are merged key-by-key so new
 * default keys survive.
 */
export function mergeDefaults(defaults, loaded) {
  if (loaded === null || loaded === undefined) return defaults;
  if (Array.isArray(defaults) || Array.isArray(loaded)) return loaded;
  if (typeof defaults !== 'object' || typeof loaded !== 'object') return loaded;

  const out = { ...defaults };
  for (const key of Object.keys(loaded)) {
    out[key] = key in defaults ? mergeDefaults(defaults[key], loaded[key]) : loaded[key];
  }
  return out;
}
