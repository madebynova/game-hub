/**
 * World manager: owns the currently-loaded area, the player, the camera, and
 * the "what am I standing next to?" interaction query.
 *
 * Areas are built on demand from the dimension registry and cached, so walking
 * back into the garage restores the same object (and its baked background)
 * instead of rebuilding it.
 */

import { getDimension } from '../data/dimensions.js';
import { Player } from './player.js';
import { WorldRenderer } from './render.js';
import { markCollidersDirty } from './area.js';
import { dist2 } from '../core/util.js';

export class World {
  /** @param {object} api service bundle (see main.js) */
  constructor(api) {
    this.api = api;
    this.state = api.state;
    this.bus = api.bus;
    this.player = new Player(api.state);
    this.renderer = new WorldRenderer();
    /** areaId -> built Area */
    this.areas = new Map();
    this.current = null;
    this.focus = null;
    this.time = 0;
    /**
     * Seconds remaining on the "someone is standing there" apparition. Areas
     * read this in paintOverlay; the frame loop counts it down. Kept here
     * rather than in save state because it is a moment, not progress.
     */
    this.apparition = 0;
    /**
     * Temporary camera target: { x, y, time }. While it has time left the
     * camera looks here instead of at the player. A small cinematic tool, used
     * by story beats that need the player to actually SEE something.
     */
    this.cinematic = null;
  }

  /** Show the watcher silhouette for `seconds` (see systems/story.js). */
  showApparition(seconds = 4) { this.apparition = seconds; }

  /** Pan the camera to a world point for `seconds`, then hand it back. */
  lookAt(x, y, seconds = 3) { this.cinematic = { x, y, time: seconds }; }

  /** Build (or fetch the cached) area for a dimension id. */
  getArea(id) {
    if (this.areas.has(id)) return this.areas.get(id);
    const dim = getDimension(id);
    if (!dim || !dim.build) throw new Error(`[world] dimension "${id}" has no builder`);
    const area = dim.build(this.api);
    this.areas.set(id, area);
    return area;
  }

  /**
   * Move the player into an area.
   * @param {string} id dimension id
   * @param {{x:number,y:number}|'portal'|null} at where to place the player
   */
  enter(id, at = null) {
    if (this.current?.onExit) this.current.onExit(this.api);

    const area = this.getArea(id);
    this.current = area;
    this.state.data.player.area = id;

    const spot = at === 'portal' ? area.portalArrival
      : at && typeof at === 'object' ? at
      : area.spawn;
    this.player.setPosition(spot.x, spot.y);

    this.refreshProps();
    this.renderer.camera.follow(this.player.pos.x, this.player.pos.y, area, 0, true);

    // Visit bookkeeping — drives "first time here" beats and future rare rolls.
    const visits = this.state.data.dimensions.visited;
    if (!visits[id]) visits[id] = { visits: 0, firstVisit: Date.now(), seed: (Math.random() * 0xffffffff) >>> 0 };
    visits[id].visits++;
    if (!this.state.data.dimensions.known.includes(id)) this.state.data.dimensions.known.push(id);

    this.bus.emit('area:entered', { id, area, visits: visits[id].visits });
    if (area.onEnter) area.onEnter(this.api, visits[id].visits);
  }

  /** Re-evaluate every prop's hidden/marker status against current save data. */
  refreshProps() {
    const area = this.current;
    if (!area) return;
    for (const p of area.props) {
      p._hidden = typeof p.gone === 'function' ? !!p.gone(this.state.data, this.api) : false;
      if (p.marker) {
        p._markerDone = typeof p.markerDone === 'function'
          ? !!p.markerDone(this.state.data, this.api)
          : false;
      }
    }
    markCollidersDirty(area);
  }

  /** Nearest interactable prop within its radius, or null. */
  findFocus() {
    const area = this.current;
    if (!area) return null;
    const px = this.player.pos.x, py = this.player.pos.y;
    let best = null, bestD = Infinity;
    for (const p of area.props) {
      if (p._hidden || !p.onInteract) continue;
      const r = p.radius ?? 64;
      const d = dist2(px, py, p.x, p.y - (p.interactYOffset ?? 0));
      if (d < r * r && d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  update(dt, input) {
    this.time += dt;
    const area = this.current;
    if (!area) return;

    this.player.update(dt, input.moveVector(), area, input.held('sprint'));
    this.focus = this.findFocus();

    if (this.cinematic) {
      this.cinematic.time -= dt;
      if (this.cinematic.time <= 0) this.cinematic = null;
    }
    const camTarget = this.cinematic ?? this.player.pos;
    this.renderer.camera.follow(camTarget.x, camTarget.y, area, dt);

    if (area.update) area.update(dt, this.time, this.api);
  }

  /** Try to interact with whatever is in focus. Returns true if something ran. */
  interact() {
    if (!this.focus) return false;
    const prop = this.focus;
    try {
      prop.onInteract(this.api, prop);
    } catch (err) {
      console.error(`[world] interact on ${prop.id} failed`, err);
    }
    this.refreshProps();
    return true;
  }

  render(ctx) {
    if (!this.current) return;
    this.renderer.render(ctx, {
      area: this.current,
      player: this.player,
      t: this.time,
      focus: this.focus,
    });
  }
}
