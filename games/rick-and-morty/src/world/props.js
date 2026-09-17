/**
 * Reusable prop factories.
 *
 * Areas are mostly assembled from these, so a future dimension is a list of
 * placements rather than a wall of bespoke objects. Anything genuinely unique
 * still gets written by hand in the area file.
 */

import { getItem } from '../data/items.js';

/**
 * A collectable item lying in the world.
 * Persists via world.taken, so it stays gone after a save/load and a revisit.
 *
 * @param {object} def { id, x, y, item, label, hint, draw, radius, lines,
 *                       clues, requires(state), narrateFirstOnly }
 */
export function pickup(def) {
  const item = getItem(def.item);
  return {
    id: def.id,
    x: def.x, y: def.y,
    w: def.w ?? 26, h: def.h ?? 20,
    radius: def.radius ?? 58,
    sortY: def.sortY,
    marker: def.marker ?? false,
    markerColor: def.markerColor,
    markerHeight: def.markerHeight,
    markerDone: (s) => !!s.world.taken[`${def.area}:${def.id}`],
    label: def.label ?? item?.name ?? 'Something',
    hint: def.hint ?? 'Take',
    focusColor: def.focusColor,
    draw: def.draw,
    /** Hidden once taken — or if a requirement is not met yet. */
    gone: (s) => !!s.world.taken[`${def.area}:${def.id}`]
      || (def.requires ? !def.requires(s) : false),
    onInteract(api) {
      api.state.markTaken(def.area, def.id);
      api.inventory.add(def.item, def.count ?? 1);
      api.audio.play(item?.rarity === 'common' ? 'pickup' : 'discovery');
      api.ui.toastItem(def.item, def.pickupLabel ?? 'Picked up');
      for (const c of def.clues ?? []) api.state.addClue(c);
      if (def.lines?.length) api.ui.narrate(def.lines);
      api.state.log(`Picked up: ${item?.name ?? def.item}.`, 'find');
    },
  };
}

/**
 * A thing you can look at but not take. The backbone of environmental
 * storytelling — cheap to add, and each one can quietly grant clues.
 */
export function examine(def) {
  return {
    id: def.id,
    x: def.x, y: def.y,
    w: def.w ?? 40, h: def.h ?? 30,
    solid: def.solid ?? false,
    radius: def.radius ?? 62,
    sortY: def.sortY,
    interactYOffset: def.interactYOffset,
    focusColor: def.focusColor,
    marker: def.marker ?? false,
    markerColor: def.markerColor,
    markerHeight: def.markerHeight,
    markerDone: def.markerDone ?? ((s) => !!s.world.opened[`${def.area}:${def.id}`]),
    label: def.label,
    hint: def.hint ?? 'Examine',
    draw: def.draw,
    gone: def.gone,
    onInteract(api) {
      api.audio.play(def.sound ?? 'examine');
      const firstTime = !api.state.isOpened(def.area, def.id);
      api.state.markOpened(def.area, def.id);
      for (const c of def.clues ?? []) api.state.addClue(c);
      const lines = firstTime ? def.lines : (def.repeatLines ?? def.lines);
      if (lines?.length) api.ui.narrate(lines);
      if (def.onFirst && firstTime) def.onFirst(api);
      if (def.onEvery) def.onEvery(api);
    },
  };
}

/** Decorative only — no interaction, no collision beyond an optional footprint. */
export function scenery(def) {
  return {
    id: def.id,
    x: def.x, y: def.y,
    w: def.w ?? 0, h: def.h ?? 0,
    solid: def.solid ?? false,
    sortY: def.sortY,
    draw: def.draw,
  };
}
