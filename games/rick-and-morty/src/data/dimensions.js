/**
 * Dimension registry.
 *
 * The portal reads this list and nothing else. To add a dimension in a future
 * phase you write an area module, import it here, and add one entry — no other
 * file needs to change.
 *
 * Fields:
 *   id            key used everywhere (also the save key for visits)
 *   designation   the Citadel-style code shown in the portal UI
 *   name          display name
 *   blurb         one-liner shown on the dial
 *   kind          'home' | 'dimension'
 *   danger        0-3, cosmetic in Phase 1, drives warnings/gear checks later
 *   build         factory (api) => Area
 *   requires      { flags: [], research: [] } — gating for later destinations
 *   ambience      audio bed id (systems/audio.js)
 *   procedural    Phase 2+: if true the area factory receives a per-visit seed
 */

import { buildGarage } from './areas/garage.js';
import { buildGlassFlats } from './areas/glassflats.js';

export const DIMENSIONS = {
  garage: {
    id: 'garage',
    designation: 'HOME',
    name: "Rick's Garage",
    blurb: 'Not yours. Currently yours.',
    kind: 'home',
    danger: 0,
    build: buildGarage,
    requires: {},
    ambience: 'garage',
    procedural: false,
  },

  glassflats: {
    id: 'glassflats',
    designation: 'J-19-ZETA-7 "GLASSFLATS"',
    name: 'The Glass Flats',
    blurb: 'Preloaded in the portal buffer. Somebody was going here.',
    kind: 'dimension',
    danger: 1,
    build: buildGlassFlats,
    requires: {},
    ambience: 'flats',
    procedural: false,
  },

  // ── Phase 2 slots (visible, deliberately unreachable) ────────────────────
  // These are listed so the portal UI already reads like a growing network
  // rather than a single button. `locked: true` keeps them undialable.
  citadel_lower: {
    id: 'citadel_lower',
    designation: 'C-137 CITADEL / LOWER RINGS',
    name: 'The Citadel, Lower Rings',
    blurb: 'Where you were walking home from. The portal refuses the coordinate.',
    kind: 'dimension',
    danger: 2,
    locked: true,
    lockedReason: 'COORDINATE REJECTED — destination flagged by an authority this terminal will not name.',
    requires: { flags: ['phase2'] },
    ambience: 'citadel',
    procedural: false,
  },
  unknown_9orph: {
    id: 'unknown_9orph',
    designation: '9-ORPH / ???',
    name: 'Unlisted',
    blurb: 'A route number, not a place. The dial will not hold it steady.',
    kind: 'dimension',
    danger: 3,
    locked: true,
    lockedReason: 'INSUFFICIENT COORDINATE DATA — the chit alone is not enough to dial this.',
    requires: { flags: ['phase2'] },
    ambience: 'unease',
    procedural: true,
  },
};

export function getDimension(id) { return DIMENSIONS[id]; }

/** Destinations the portal should offer right now. */
export function dialableDimensions(state) {
  return Object.values(DIMENSIONS).filter((d) => d.kind !== 'home');
}

export function isDialable(dim, state) {
  if (dim.locked) return false;
  const req = dim.requires ?? {};
  return (req.flags ?? []).every((f) => state.flags[f])
    && (req.research ?? []).every((r) => state.research.completed.includes(r));
}
