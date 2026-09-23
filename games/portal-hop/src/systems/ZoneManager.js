/**
 * Tracks which "zone" (garage, temporary test area, and later real
 * dimensions) is currently active. A 2D canvas has no display list to
 * add/remove from — the render loop just asks ZoneManager for the
 * active zone and draws/updates/collides against that one. Adding a
 * real first dimension later is just: build a zone module like
 * GarageZone2D/TestZone2D, register it, and activate its key.
 */
export class ZoneManager {
  constructor() {
    this.zones = new Map();
    this.activeKey = null;
    this.active = null;
  }

  register(key, zone) {
    this.zones.set(key, zone);
  }

  activate(key) {
    const next = this.zones.get(key);
    if (!next) throw new Error(`ZoneManager: unknown zone "${key}"`);
    this.activeKey = key;
    this.active = next;
    return next;
  }
}
